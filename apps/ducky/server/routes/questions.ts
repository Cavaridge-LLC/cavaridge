import type { Express } from "express";
import { db } from "../db";
import { conversations, messages, savedAnswers, usageTracking, askQuestionSchema } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, logAudit, type AuthenticatedRequest } from "../auth";
import { chatCompletion, hasAICapability } from "@cavaridge/spaniel";
import type { ChatMessage } from "@cavaridge/spaniel";
import { retrieveRelevantChunks } from "../rag";
import { logger } from "../logger";

export function registerQuestionRoutes(app: Express) {
  // Ask a question (with RAG)
  app.post("/api/ask", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = askQuestionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const { question, conversationId } = parsed.data;

      if (!hasAICapability()) {
        return res.status(503).json({ message: "AI features not configured" });
      }

      // Get or create conversation
      let convId = conversationId;
      if (!convId) {
        const [conv] = await db.insert(conversations).values({
          tenantId: req.orgId!,
          userId: req.user!.id,
          title: question.slice(0, 100),
        }).returning();
        convId = conv.id;
      }

      // Store user message
      await db.insert(messages).values({
        conversationId: convId,
        tenantId: req.orgId!,
        role: "user",
        content: question,
      });

      // RAG: retrieve relevant knowledge chunks
      let contextBlock = "";
      let sources: Array<{ name: string; type: string; score: number }> = [];
      try {
        const chunks = await retrieveRelevantChunks(question, req.orgId!, 5, 0.3);
        if (chunks.length > 0) {
          sources = chunks.map((c) => ({ name: c.sourceName, type: c.sourceType, score: Math.round(c.score * 100) / 100 }));
          contextBlock = "\n\n<knowledge_context>\n" +
            chunks.map((c, i) => `[Source ${i + 1}: ${c.sourceName}]\n${c.content}`).join("\n\n") +
            "\n</knowledge_context>\n\nUse the above knowledge context to inform your answer when relevant. Cite sources by name when you use them.";
        }
      } catch (err) {
        logger.warn({ err }, "RAG retrieval failed, continuing without context");
      }

      // Get conversation history for context
      const history = await db.select().from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(messages.createdAt);

      const chatMessages: ChatMessage[] = history.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const systemPrompt = "You are Ducky, an AI-native answer engine by Cavaridge. Provide clear, accurate, well-sourced answers. Be direct and professional. Format responses with markdown when helpful." + contextBlock;

      const startTime = Date.now();

      const spanielResponse = await chatCompletion({
        tenantId: req.orgId!,
        userId: req.user!.id,
        appCode: "CVG-DUCKY",
        taskType: "chat",
        system: systemPrompt,
        messages: chatMessages,
      });

      const answer = spanielResponse.content;
      const latencyMs = Date.now() - startTime;

      // Store assistant message with sources
      const [assistantMsg] = await db.insert(messages).values({
        conversationId: convId,
        tenantId: req.orgId!,
        role: "assistant",
        content: answer,
        sourcesJson: sources,
        latencyMs,
      }).returning();

      // Track usage (Spaniel provides token counts)
      await db.insert(usageTracking).values({
        tenantId: req.orgId!,
        userId: req.user!.id,
        actionType: "question",
        tokensUsed: spanielResponse.tokens.total,
      });

      // Update conversation timestamp
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, convId));

      res.json({
        conversationId: convId,
        message: assistantMsg,
        sources,
      });
    } catch (error: any) {
      logger.error({ err: error }, "Ask error");
      res.status(500).json({ message: "Failed to generate answer" });
    }
  });

  // List conversations (includes archived flag filter)
  app.get("/api/conversations", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const includeArchived = req.query.archived === "true";
      const conditions = [
        eq(conversations.tenantId, req.orgId!),
        eq(conversations.userId, req.user!.id),
      ];
      if (!includeArchived) {
        conditions.push(eq(conversations.isArchived, false));
      }

      const convs = await db.select().from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.updatedAt));

      res.json(convs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get conversation messages
  app.get("/api/conversations/:id/messages", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [conv] = await db.select().from(conversations)
        .where(and(
          eq(conversations.id, req.params.id as string),
          eq(conversations.tenantId, req.orgId!),
        ));

      if (!conv) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const msgs = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(messages.createdAt);

      res.json(msgs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Archive / unarchive conversation
  app.patch("/api/conversations/:id/archive", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [conv] = await db.select().from(conversations)
        .where(and(
          eq(conversations.id, req.params.id as string),
          eq(conversations.tenantId, req.orgId!),
          eq(conversations.userId, req.user!.id),
        ));

      if (!conv) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const isArchived = req.body.isArchived !== false; // default to archive
      const [updated] = await db.update(conversations)
        .set({ isArchived, updatedAt: new Date() })
        .where(eq(conversations.id, conv.id))
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to archive conversation" });
    }
  });

  // Export conversation as JSON
  app.get("/api/conversations/:id/export", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [conv] = await db.select().from(conversations)
        .where(and(
          eq(conversations.id, req.params.id as string),
          eq(conversations.tenantId, req.orgId!),
        ));

      if (!conv) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const msgs = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(messages.createdAt);

      const format = req.query.format || "json";

      if (format === "text") {
        const textExport = [
          `# ${conv.title || "Untitled Conversation"}`,
          `Date: ${conv.createdAt?.toISOString()}`,
          `---`,
          ...msgs.map(m => `\n**${m.role === "user" ? "You" : "Ducky"}** (${m.createdAt?.toISOString()}):\n${m.content}`),
        ].join("\n");

        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", `attachment; filename="ducky-conversation-${conv.id.slice(0, 8)}.txt"`);
        return res.send(textExport);
      }

      // JSON export
      res.json({
        conversation: {
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        },
        messages: msgs.map(m => ({
          role: m.role,
          content: m.content,
          sources: m.sourcesJson,
          createdAt: m.createdAt,
        })),
        exportedAt: new Date().toISOString(),
        exportedBy: "CVG-DUCKY",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to export conversation" });
    }
  });

  // Save an answer
  app.post("/api/saved-answers", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { question, answer, tags } = req.body;
      if (!question || !answer) {
        return res.status(400).json({ message: "question and answer are required" });
      }

      const [saved] = await db.insert(savedAnswers).values({
        tenantId: req.orgId!,
        userId: req.user!.id,
        question,
        answer,
        tags: tags || [],
      }).returning();

      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ message: "Failed to save answer" });
    }
  });

  // Delete saved answer
  app.delete("/api/saved-answers/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [answer] = await db.select().from(savedAnswers)
        .where(and(
          eq(savedAnswers.id, req.params.id as string),
          eq(savedAnswers.tenantId, req.orgId!),
        ));

      if (!answer) {
        return res.status(404).json({ message: "Saved answer not found" });
      }

      await db.delete(savedAnswers).where(eq(savedAnswers.id, answer.id));
      res.json({ message: "Saved answer deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete saved answer" });
    }
  });

  // List saved answers
  app.get("/api/saved-answers", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const answers = await db.select().from(savedAnswers)
        .where(eq(savedAnswers.tenantId, req.orgId!))
        .orderBy(desc(savedAnswers.createdAt));

      res.json(answers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved answers" });
    }
  });
}
