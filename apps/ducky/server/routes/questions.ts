import type { Express } from "express";
import { db } from "../db";
import { conversations, messages, savedAnswers, askQuestionSchema } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { chatCompletion, hasAICapability } from "../openrouter";

export function registerQuestionRoutes(app: Express) {
  // Ask a question
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

      // Get conversation history for context
      const history = await db.select().from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(messages.createdAt);

      const chatMessages = history.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const startTime = Date.now();

      const answer = await chatCompletion({
        task: "answerGeneration",
        system: "You are Ducky, an AI-native answer engine by Cavaridge. Provide clear, accurate, well-sourced answers. Be direct and professional. Format responses with markdown when helpful.",
        messages: chatMessages,
        tenantId: req.orgId,
      });

      const latencyMs = Date.now() - startTime;

      // Store assistant message
      const [assistantMsg] = await db.insert(messages).values({
        conversationId: convId,
        tenantId: req.orgId!,
        role: "assistant",
        content: answer,
        latencyMs,
      }).returning();

      res.json({
        conversationId: convId,
        message: assistantMsg,
      });
    } catch (error: any) {
      console.error("Ask error:", error);
      res.status(500).json({ message: "Failed to generate answer" });
    }
  });

  // List conversations
  app.get("/api/conversations", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const convs = await db.select().from(conversations)
        .where(and(
          eq(conversations.tenantId, req.orgId!),
          eq(conversations.userId, req.user!.id),
          eq(conversations.isArchived, false),
        ))
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
          eq(conversations.id, req.params.id),
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
