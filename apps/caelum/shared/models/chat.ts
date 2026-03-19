import { serial, integer, text, timestamp, jsonb, boolean, uuid, index, pgSchema } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { tenants } from "./auth";

/** Caelum app schema — all app-specific tables live here */
export const caelumSchema = pgSchema("caelum");

export const conversations = caelumSchema.table("conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  sowJson: jsonb("sow_json"),
  flagged: boolean("flagged").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("conversations_tenant_id_idx").on(table.tenantId),
]);

export const messages = caelumSchema.table("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("messages_tenant_id_idx").on(table.tenantId),
]);

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const sowVersions = caelumSchema.table("sow_versions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  version: integer("version").notNull(),
  sowJson: jsonb("sow_json").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("sow_versions_tenant_id_idx").on(table.tenantId),
]);

export const insertSowVersionSchema = createInsertSchema(sowVersions).omit({
  id: true,
  createdAt: true,
});

export type SowVersion = typeof sowVersions.$inferSelect;
export type InsertSowVersion = z.infer<typeof insertSowVersionSchema>;
