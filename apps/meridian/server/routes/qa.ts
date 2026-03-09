import { storage, requireAuth, requirePerm, checkPlanLimit, incrementUsage, type AuthenticatedRequest } from './_helpers';
import { processQaQuestion, saveQaAnswer } from "../qa-engine";
import { type Express } from "express";

export function registerQaRoutes(app: Express) {
app.post("/api/deals/:dealId/qa/ask", requireAuth as any, requirePerm("use_chat") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const queryLimit = await checkPlanLimit(req.orgId!, "queries");
    if (!queryLimit.allowed) {
      return res.status(403).json({ message: "Plan limit reached", limitType: "queries", current: queryLimit.current, limit: queryLimit.limit });
    }

    const { question, conversation_id } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ message: "question is required" });
    }

    const result = await processQaQuestion(dealId, req.orgId!, req.user!.id, question, conversation_id || null);

    await incrementUsage(req.orgId!, "queries");

    res.json(result);
  } catch (err: any) {
    console.error("Q&A ask error:", err.message);
    res.status(err.message?.includes("API key") ? 503 : 500).json({ message: err.message });
  }
});

app.get("/api/deals/:dealId/qa/conversations", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const conversations = await storage.getQaConversationsByDeal(dealId, req.orgId!);

    const withPreviews = await Promise.all(
      conversations.map(async (conv) => {
        const messages = await storage.getQaMessagesByConversation(conv.id);
        const lastMessage = messages[messages.length - 1];
        return {
          ...conv,
          messageCount: messages.length,
          lastMessage: lastMessage ? { role: lastMessage.role, content: lastMessage.content.slice(0, 120) } : null,
        };
      })
    );

    res.json(withPreviews);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/deals/:dealId/qa/conversations/:convId", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId, convId } = req.params;
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const conv = await storage.getQaConversation(convId);
    if (!conv || conv.dealId !== dealId || conv.tenantId !== req.orgId) return res.status(404).json({ message: "Conversation not found" });

    const messages = await storage.getQaMessagesByConversation(convId);
    res.json({ ...conv, messages });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/deals/:dealId/qa/save-answer", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const { message_id } = req.body;
    if (!message_id) return res.status(400).json({ message: "message_id is required" });

    await saveQaAnswer(dealId, req.orgId!, req.user!.id, message_id);
    res.json({ message: "Answer saved for future reference" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/deals/:dealId/qa/conversations/:convId", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId, convId } = req.params;
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const conv = await storage.getQaConversation(convId);
    if (!conv || conv.dealId !== dealId || conv.tenantId !== req.orgId) return res.status(404).json({ message: "Conversation not found" });

    await storage.deleteQaConversation(convId);
    res.json({ message: "Conversation deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
}
