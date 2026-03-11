import { db } from "../../db";
import { conversations, messages, sowVersions } from "@shared/schema";
import { eq, desc, and, sql, max, gte, lte } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number, tenantId: string): Promise<typeof conversations.$inferSelect | undefined>;
  getConversationsByUser(userId: string, tenantId: string): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(userId: string, title: string, tenantId: string): Promise<typeof conversations.$inferSelect>;
  updateConversationTitle(id: number, title: string, tenantId: string): Promise<void>;
  updateConversationSow(id: number, sowJson: any, tenantId: string): Promise<void>;
  touchConversation(id: number, tenantId: string): Promise<void>;
  toggleFlag(id: number, tenantId: string): Promise<boolean>;
  deleteConversation(id: number, tenantId: string): Promise<void>;
  getMessagesByConversation(conversationId: number, tenantId: string): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string, tenantId: string): Promise<typeof messages.$inferSelect>;
  getMessageById(id: number, tenantId: string): Promise<typeof messages.$inferSelect | undefined>;
  deleteMessage(id: number, tenantId: string): Promise<void>;
  deleteMessagesFrom(conversationId: number, fromMessageId: number, tenantId: string): Promise<void>;
  branchConversation(conversationId: number, upToMessageId: number, userId: string, title: string, tenantId: string): Promise<{ conversation: typeof conversations.$inferSelect; messages: (typeof messages.$inferSelect)[] }>;
  createSowVersion(conversationId: number, sowJson: any, tenantId: string, label?: string): Promise<typeof sowVersions.$inferSelect>;
  getSowVersions(conversationId: number, tenantId: string): Promise<(typeof sowVersions.$inferSelect)[]>;
  getSowVersion(id: number, tenantId: string): Promise<typeof sowVersions.$inferSelect | undefined>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number, tenantId: string) {
    const [conversation] = await db.select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
    return conversation;
  },

  async getConversationsByUser(userId: string, tenantId: string) {
    return db.select().from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.tenantId, tenantId)))
      .orderBy(desc(conversations.updatedAt));
  },

  async createConversation(userId: string, title: string, tenantId: string) {
    const [conversation] = await db.insert(conversations).values({ userId, title, tenantId }).returning();
    return conversation;
  },

  async updateConversationTitle(id: number, title: string, tenantId: string) {
    await db.update(conversations)
      .set({ title, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
  },

  async updateConversationSow(id: number, sowJson: any, tenantId: string) {
    await db.transaction(async (tx) => {
      await tx.update(conversations)
        .set({ sowJson, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
    });
  },

  async touchConversation(id: number, tenantId: string) {
    await db.update(conversations)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
  },

  async toggleFlag(id: number, tenantId: string) {
    const [convo] = await db.select({ flagged: conversations.flagged }).from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
    const newVal = !convo?.flagged;
    await db.update(conversations).set({ flagged: newVal })
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
    return newVal;
  },

  async deleteConversation(id: number, tenantId: string) {
    await db.delete(messages).where(and(eq(messages.conversationId, id), eq(messages.tenantId, tenantId)));
    await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
  },

  async getMessagesByConversation(conversationId: number, tenantId: string) {
    return db.select().from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId)))
      .orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string, tenantId: string) {
    const [message] = await db.insert(messages).values({ conversationId, role, content, tenantId }).returning();
    return message;
  },

  async getMessageById(id: number, tenantId: string) {
    const [message] = await db.select().from(messages)
      .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)));
    return message;
  },

  async deleteMessage(id: number, tenantId: string) {
    await db.delete(messages).where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)));
  },

  async deleteMessagesFrom(conversationId: number, fromMessageId: number, tenantId: string) {
    await db.delete(messages).where(
      and(eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId), gte(messages.id, fromMessageId))
    );
  },

  async branchConversation(conversationId: number, upToMessageId: number, userId: string, title: string, tenantId: string) {
    return await db.transaction(async (tx) => {
      const [newConvo] = await tx.insert(conversations).values({ userId, title, tenantId }).returning();
      const sourceMsgs = await tx.select().from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId), lte(messages.id, upToMessageId)))
        .orderBy(messages.createdAt);
      const newMsgs: (typeof messages.$inferSelect)[] = [];
      for (const m of sourceMsgs) {
        const [created] = await tx.insert(messages).values({
          conversationId: newConvo.id, role: m.role, content: m.content, tenantId,
        }).returning();
        newMsgs.push(created);
      }
      return { conversation: newConvo, messages: newMsgs };
    });
  },

  async createSowVersion(conversationId: number, sowJson: any, tenantId: string, label?: string) {
    return await db.transaction(async (tx) => {
      const existing = await tx.select({ maxVersion: max(sowVersions.version) })
        .from(sowVersions)
        .where(and(eq(sowVersions.conversationId, conversationId), eq(sowVersions.tenantId, tenantId)));
      const nextVersion = (existing[0]?.maxVersion ?? 0) + 1;
      const versionLabel = label || `Version ${nextVersion}`;
      const [version] = await tx.insert(sowVersions)
        .values({ conversationId, version: nextVersion, sowJson, label: versionLabel, tenantId })
        .returning();
      return version;
    });
  },

  async getSowVersions(conversationId: number, tenantId: string) {
    return db.select().from(sowVersions)
      .where(and(eq(sowVersions.conversationId, conversationId), eq(sowVersions.tenantId, tenantId)))
      .orderBy(desc(sowVersions.version));
  },

  async getSowVersion(id: number, tenantId: string) {
    const [version] = await db.select().from(sowVersions)
      .where(and(eq(sowVersions.id, id), eq(sowVersions.tenantId, tenantId)));
    return version;
  },
};
