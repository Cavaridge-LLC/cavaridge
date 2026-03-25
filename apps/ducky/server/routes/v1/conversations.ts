/**
 * V1 Conversation API — Multi-turn conversation management.
 *
 * Endpoints:
 *   POST   /api/v1/conversations              — Create new conversation
 *   GET    /api/v1/conversations               — List user conversations
 *   GET    /api/v1/conversations/:id           — Get conversation with messages
 *   POST   /api/v1/conversations/:id/messages  — Send message in conversation
 *   DELETE /api/v1/conversations/:id           — Delete conversation
 *
 * All endpoints are tenant-scoped and role-gated.
 */

import type { Express, Response } from "express";
import { z } from "zod";
import { db } from "../../db.js";
import {
  conversations,
  messages,
  threads,
  usageTracking,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../../auth.js";
import {
  chatCompletion,
  chatCompletionStream,
  hasAICapability,
  generateEmbedding,
  traceRequest,
} from "@cavaridge/spaniel";
import type { ChatMessage, StreamCallbacks } from "@cavaridge/spaniel";
import { detectPromptInjection, scanForPii } from "@cavaridge/security";
import { retrieveRelevantChunks, cosineSimilarity } from "../../rag.js";
import { resolveTemplate, buildPromptFromTemplate } from "../../prompt-templates.js";
import { DUCKY_BRANDING, getAnimationForPhase, type ApiLifecyclePhase } from "../../ducky-state.js";
import { logger } from "../../logger.js";

const BRANCH_SIMILARITY_THRESHOLD = 0.65;

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createConversationSchema = z.object({
  title: z.string().max(500).optional(),
  systemPrompt: z.string().max(10000).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(50000),
  systemPrompt: z.string().max(10000).optional(),
  taskType: z.string().optional().default("chat"),
  options: z
    .object({
      requireConsensus: z.boolean().optional(),
      maxTokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
  stream: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Default system prompt
// ---------------------------------------------------------------------------

function getDefaultSystemPrompt(contextBlock: string): string {
  return (
    `You are ${DUCKY_BRANDING.CHARACTER_NAME}, an AI-native answer engine by Cavaridge. ` +
    "Provide clear, accurate, well-sourced answers. Be direct and professional. " +
    "Format responses with markdown when helpful." +
    contextBlock
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerV1ConversationRoutes(app: Express): void {
  // POST /api/v1/conversations — Create new conversation
  app.post("/api/v1/conversations", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = createConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }

      const [conv] = await db
        .insert(conversations)
        .values({
          tenantId: req.tenantId!,
          userId: req.user!.id,
          title: parsed.data.title || "New Conversation",
        })
        .returning();

      return res.status(201).json({
        id: conv.id,
        tenantId: conv.tenantId,
        title: conv.title,
        isArchived: conv.isArchived,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        branding: DUCKY_BRANDING.FOOTER_TAGLINE,
      });
    } catch (err) {
      logger.error({ err }, "Failed to create conversation");
      return res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // GET /api/v1/conversations — List conversations for current user
  app.get("/api/v1/conversations", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const includeArchived = req.query.archived === "true";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const conditions = [
        eq(conversations.tenantId, req.tenantId!),
        eq(conversations.userId, req.user!.id),
      ];
      if (!includeArchived) {
        conditions.push(eq(conversations.isArchived, false));
      }

      const convs = await db
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.updatedAt))
        .limit(limit)
        .offset(offset);

      return res.json({
        conversations: convs,
        count: convs.length,
        offset,
        branding: DUCKY_BRANDING.FOOTER_TAGLINE,
      });
    } catch (err) {
      logger.error({ err }, "Failed to list conversations");
      return res.status(500).json({ error: "Failed to list conversations" });
    }
  });

  // GET /api/v1/conversations/:id — Get conversation with messages
  app.get("/api/v1/conversations/:id", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, req.params.id as string),
            eq(conversations.tenantId, req.tenantId!),
          ),
        );

      if (!conv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(messages.createdAt);

      return res.json({
        conversation: conv,
        messages: msgs,
        branding: DUCKY_BRANDING.FOOTER_TAGLINE,
      });
    } catch (err) {
      logger.error({ err }, "Failed to get conversation");
      return res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  // POST /api/v1/conversations/:id/messages — Send message in conversation
  app.post(
    "/api/v1/conversations/:id/messages",
    requireAuth as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = sendMessageSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
        }

        const { content, systemPrompt, taskType, options, stream } = parsed.data;
        const convId = req.params.id as string;

        // Verify conversation exists and belongs to this tenant
        const [conv] = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, convId),
              eq(conversations.tenantId, req.tenantId!),
            ),
          );

        if (!conv) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        // Security: prompt injection check
        const injectionResult = detectPromptInjection(content);
        if (injectionResult.isInjection) {
          logger.warn({ tenantId: req.tenantId, score: injectionResult.score }, "Prompt injection detected");
          return res.status(400).json({ error: "Input flagged for safety review. Please rephrase." });
        }

        // Security: PII scan (log only)
        const piiResult = scanForPii(content);
        if (piiResult.hasPii) {
          logger.warn({ tenantId: req.tenantId, piiTypes: piiResult.matches.map((m) => m.type) }, "PII detected");
        }

        if (!hasAICapability()) {
          return res.status(503).json({ error: "AI features not configured" });
        }

        // Thread auto-branching
        let threadId: string | undefined;
        try {
          const lastAssistantMsg = await db
            .select()
            .from(messages)
            .where(and(eq(messages.conversationId, convId), eq(messages.role, "assistant")))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          if (lastAssistantMsg.length > 0) {
            const [questionEmbArr, lastMsgEmbArr] = await Promise.all([
              generateEmbedding(content, { tenantId: req.tenantId!, userId: req.user!.id }),
              generateEmbedding(lastAssistantMsg[0].content.slice(0, 500), {
                tenantId: req.tenantId!,
                userId: req.user!.id,
              }),
            ]);

            const questionEmb = questionEmbArr?.[0];
            const lastMsgEmb = lastMsgEmbArr?.[0];

            if (questionEmb && lastMsgEmb) {
              const similarity = cosineSimilarity(questionEmb, lastMsgEmb);
              if (similarity < BRANCH_SIMILARITY_THRESHOLD) {
                const [newThread] = await db
                  .insert(threads)
                  .values({
                    conversationId: convId,
                    tenantId: req.tenantId!,
                    title: content.slice(0, 100),
                    branchTrigger: "auto_detected",
                    similarityScore: similarity.toFixed(2),
                  })
                  .returning();
                threadId = newThread.id;
                logger.info({ conversationId: convId, threadId, similarity }, "Auto-branched thread");
              }
            }
          }
        } catch (err) {
          logger.warn({ err }, "Thread branching check failed, continuing without branch");
        }

        // Store user message
        await db.insert(messages).values({
          conversationId: convId,
          threadId,
          tenantId: req.tenantId!,
          role: "user",
          content,
        });

        // RAG: retrieve relevant chunks
        let contextBlock = "";
        let sources: Array<{ name: string; type: string; score: number }> = [];
        try {
          const chunks = await retrieveRelevantChunks(content, req.tenantId!, 5, 0.3);
          if (chunks.length > 0) {
            sources = chunks.map((c) => ({
              name: c.sourceName,
              type: c.sourceType,
              score: Math.round(c.score * 100) / 100,
            }));
            contextBlock =
              "\n\n<knowledge_context>\n" +
              chunks.map((c, i) => `[Source ${i + 1}: ${c.sourceName}]\n${c.content}`).join("\n\n") +
              "\n</knowledge_context>\n\nUse the above knowledge context when relevant. Cite sources by name.";
          }
        } catch (err) {
          logger.warn({ err }, "RAG retrieval failed, continuing without context");
        }

        // Resolve prompt template
        let finalSystemPrompt = systemPrompt || getDefaultSystemPrompt(contextBlock);
        const template = await resolveTemplate(req.tenantId!, DUCKY_BRANDING.APP_CODE, taskType!);
        if (template && !systemPrompt) {
          const built = buildPromptFromTemplate(template, { context: contextBlock });
          finalSystemPrompt = built.system;
        }

        // Get conversation history
        const history = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convId))
          .orderBy(messages.createdAt);

        const chatMessages: ChatMessage[] = history.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

        // Streaming response
        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("X-Accel-Buffering", "no");
          res.flushHeaders();

          // Send initial animation state
          res.write(`data: ${JSON.stringify({ type: "state", animationState: getAnimationForPhase("calling_spaniel") })}\n\n`);

          let fullContent = "";
          const streamCallbacks: StreamCallbacks = {
            onToken(token: string) {
              fullContent += token;
              res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
            },
            async onDone(metadata) {
              // Store assistant message
              const [assistantMsg] = await db
                .insert(messages)
                .values({
                  conversationId: convId,
                  threadId,
                  tenantId: req.tenantId!,
                  role: "assistant",
                  content: fullContent,
                  sourcesJson: sources,
                  modelUsed: metadata.modelUsed,
                  tokensUsed: metadata.tokens.total,
                })
                .returning();

              // Track usage
              await db.insert(usageTracking).values({
                tenantId: req.tenantId!,
                userId: req.user!.id,
                actionType: "question",
                tokensUsed: metadata.tokens.total,
              });

              // Update conversation timestamp
              await db
                .update(conversations)
                .set({ updatedAt: new Date() })
                .where(eq(conversations.id, convId));

              res.write(
                `data: ${JSON.stringify({
                  type: "done",
                  messageId: assistantMsg.id,
                  sources,
                  ...metadata,
                  branding: DUCKY_BRANDING.FOOTER_TAGLINE,
                  animationState: getAnimationForPhase("response_complete"),
                })}\n\n`,
              );
              res.end();
            },
            onError(error: Error) {
              res.write(
                `data: ${JSON.stringify({
                  type: "error",
                  message: error.message,
                  animationState: getAnimationForPhase("response_error"),
                })}\n\n`,
              );
              res.end();
            },
          };

          await chatCompletionStream(
            {
              tenantId: req.tenantId!,
              userId: req.user!.id,
              appCode: DUCKY_BRANDING.APP_CODE,
              taskType: taskType as any,
              system: finalSystemPrompt,
              messages: chatMessages,
              options: options
                ? {
                    requireConsensus: options.requireConsensus,
                    maxTokens: options.maxTokens,
                    temperature: options.temperature,
                  }
                : undefined,
            },
            streamCallbacks,
          );
          return;
        }

        // Non-streaming response
        const startTime = Date.now();

        const spanielResponse = await chatCompletion({
          tenantId: req.tenantId!,
          userId: req.user!.id,
          appCode: DUCKY_BRANDING.APP_CODE,
          taskType: taskType as any,
          system: finalSystemPrompt,
          messages: chatMessages,
          options: options
            ? {
                requireConsensus: options.requireConsensus,
                maxTokens: options.maxTokens,
                temperature: options.temperature,
              }
            : undefined,
        });

        const latencyMs = Date.now() - startTime;

        // Langfuse tracing
        traceRequest({
          requestId: spanielResponse.requestId,
          tenantId: req.tenantId!,
          userId: req.user!.id,
          appCode: DUCKY_BRANDING.APP_CODE,
          taskType: taskType as any,
          model: spanielResponse.modelsUsed.primary,
          inputTokens: spanielResponse.tokens.input,
          outputTokens: spanielResponse.tokens.output,
          costUsd: spanielResponse.cost.amount,
          latencyMs,
          status: spanielResponse.status,
          fallbackUsed: spanielResponse.fallbackUsed,
          });

        // Store assistant message
        const [assistantMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            threadId,
            tenantId: req.tenantId!,
            role: "assistant",
            content: spanielResponse.content,
            sourcesJson: sources,
            modelUsed: spanielResponse.modelsUsed.primary,
            tokensUsed: spanielResponse.tokens.total,
            latencyMs,
          })
          .returning();

        // Track usage
        await db.insert(usageTracking).values({
          tenantId: req.tenantId!,
          userId: req.user!.id,
          actionType: "question",
          tokensUsed: spanielResponse.tokens.total,
        });

        // Update conversation timestamp
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, convId));

        return res.json({
          message: assistantMsg,
          sources,
          tokens: spanielResponse.tokens,
          modelUsed: spanielResponse.modelsUsed.primary,
          branding: DUCKY_BRANDING.FOOTER_TAGLINE,
        });
      } catch (err) {
        logger.error({ err }, "Failed to send message");
        return res.status(500).json({ error: "Failed to generate response" });
      }
    },
  );

  // DELETE /api/v1/conversations/:id — Delete conversation
  app.delete("/api/v1/conversations/:id", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const convId = req.params.id as string;

      const [conv] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, convId),
            eq(conversations.tenantId, req.tenantId!),
            eq(conversations.userId, req.user!.id),
          ),
        );

      if (!conv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Delete messages first, then threads, then conversation
      await db.delete(messages).where(eq(messages.conversationId, convId));
      await db.delete(threads).where(eq(threads.conversationId, convId));
      await db.delete(conversations).where(eq(conversations.id, convId));

      return res.json({ deleted: true, id: convId });
    } catch (err) {
      logger.error({ err }, "Failed to delete conversation");
      return res.status(500).json({ error: "Failed to delete conversation" });
    }
  });
}
