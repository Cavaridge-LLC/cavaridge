/**
 * V1 Query API — One-shot queries with no conversation persistence.
 *
 * POST /api/v1/query — Send a one-shot question, get an answer.
 * No conversation state is created or stored.
 */

import type { Express, Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../../auth.js";
import {
  chatCompletion,
  hasAICapability,
  traceRequest,
} from "@cavaridge/spaniel";
import type { ChatMessage } from "@cavaridge/spaniel";
import { detectPromptInjection } from "@cavaridge/security";
import { retrieveRelevantChunks } from "../../rag.js";
import { resolveTemplate, buildPromptFromTemplate } from "../../prompt-templates.js";
import { DUCKY_BRANDING } from "../../ducky-state.js";
import { logger } from "../../logger.js";

const querySchema = z.object({
  question: z.string().min(1).max(50000),
  systemPrompt: z.string().max(10000).optional(),
  taskType: z.string().optional().default("chat"),
  context: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .optional(),
  useRag: z.boolean().optional().default(true),
  options: z
    .object({
      requireConsensus: z.boolean().optional(),
      maxTokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
});

export function registerV1QueryRoutes(app: Express): void {
  app.post("/api/v1/query", requireAuth as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = querySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }

      const { question, systemPrompt, taskType, context, useRag, options } = parsed.data;

      // Security: prompt injection check
      const injectionResult = detectPromptInjection(question);
      if (injectionResult.isInjection) {
        logger.warn({ tenantId: req.tenantId, score: injectionResult.score }, "Prompt injection detected");
        return res.status(400).json({ error: "Input flagged for safety review. Please rephrase." });
      }

      if (!hasAICapability()) {
        return res.status(503).json({ error: "AI features not configured" });
      }

      // RAG context
      let contextBlock = "";
      let sources: Array<{ name: string; type: string; score: number }> = [];
      if (useRag) {
        try {
          const chunks = await retrieveRelevantChunks(question, req.tenantId!, 5, 0.3);
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
      }

      // Resolve prompt template
      let finalSystemPrompt =
        systemPrompt ||
        `You are ${DUCKY_BRANDING.CHARACTER_NAME}, an AI-native answer engine by Cavaridge. ` +
          "Provide clear, accurate, well-sourced answers. Be direct and professional. " +
          "Format responses with markdown when helpful." +
          contextBlock;

      const template = await resolveTemplate(req.tenantId!, DUCKY_BRANDING.APP_CODE, taskType!);
      if (template && !systemPrompt) {
        const built = buildPromptFromTemplate(template, { context: contextBlock, question });
        finalSystemPrompt = built.system;
      }

      // Build message array
      const chatMessages: ChatMessage[] = [];
      if (context) {
        chatMessages.push(...context);
      }
      chatMessages.push({ role: "user", content: question });

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

      return res.json({
        answer: spanielResponse.content,
        sources,
        tokens: spanielResponse.tokens,
        cost: spanielResponse.cost,
        modelUsed: spanielResponse.modelsUsed.primary,
        latencyMs,
        branding: DUCKY_BRANDING.FOOTER_TAGLINE,
      });
    } catch (err) {
      logger.error({ err }, "Query failed");
      return res.status(500).json({ error: "Failed to generate answer" });
    }
  });
}
