import { serial, integer, text, timestamp, jsonb, boolean, uuid, index, pgSchema, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { tenants } from "./auth";

/** Caelum app schema — all app-specific tables live here */
export const caelumSchema = pgSchema("caelum");

/**
 * Cross-schema FK helper — drizzle's type system cannot reconcile columns
 * between pgTable (public) and pgSchema.table (caelum). This wrapper casts
 * the reference to satisfy the type checker. The actual FK constraint is
 * enforced at the database level via migration.
 */
function tenantIdRef(): () => AnyPgColumn {
  return () => tenants.id as unknown as AnyPgColumn;
}

export const conversations = caelumSchema.table("conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  tenantId: uuid("tenant_id").notNull().references(tenantIdRef()),
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
  tenantId: uuid("tenant_id").notNull().references(tenantIdRef()),
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
  tenantId: uuid("tenant_id").notNull().references(tenantIdRef()),
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

// ---------------------------------------------------------------------------
// SoWs — standalone SoW documents (v2.2 CRUD API)
// ---------------------------------------------------------------------------

export const sowStatusEnum = ["draft", "review", "approved", "archived"] as const;
export type SowStatus = typeof sowStatusEnum[number];

export const sows = caelumSchema.table("sows", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(tenantIdRef()),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  sowDocument: jsonb("sow_document").notNull(), // SowDocumentV2 shape
  currentVersion: integer("current_version").notNull().default(1),
  templateId: integer("template_id"), // FK to sow_templates if created from template
  /** Optional conversation link for chat-originated SoWs */
  conversationId: integer("conversation_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("sows_tenant_id_idx").on(table.tenantId),
  index("sows_user_id_idx").on(table.userId),
  index("sows_status_idx").on(table.status),
]);

export const sowRevisions = caelumSchema.table("sow_revisions", {
  id: serial("id").primaryKey(),
  sowId: integer("sow_id").notNull().references(() => sows.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(tenantIdRef()),
  version: integer("version").notNull(),
  sowDocument: jsonb("sow_document").notNull(),
  label: text("label").notNull(),
  changedBy: text("changed_by").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("sow_revisions_sow_id_idx").on(table.sowId),
  index("sow_revisions_tenant_id_idx").on(table.tenantId),
]);

export const insertSowSchema = createInsertSchema(sows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSowRevisionSchema = createInsertSchema(sowRevisions).omit({
  id: true,
  createdAt: true,
});

export type Sow = typeof sows.$inferSelect;
export type InsertSow = z.infer<typeof insertSowSchema>;
export type SowRevision = typeof sowRevisions.$inferSelect;
export type InsertSowRevision = z.infer<typeof insertSowRevisionSchema>;

// ---------------------------------------------------------------------------
// SoW Templates — reusable per project type, tenant-scoped
// ---------------------------------------------------------------------------

export const sowTemplates = caelumSchema.table("sow_templates", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(tenantIdRef()),
  name: text("name").notNull(),
  description: text("description"),
  projectType: text("project_type").notNull(), // e.g. "Network Deployment", "Onboarding & Stabilization"
  sowDocument: jsonb("sow_document").notNull(), // Partial SowDocumentV2 shape as template
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("sow_templates_tenant_id_idx").on(table.tenantId),
  index("sow_templates_project_type_idx").on(table.projectType),
]);

export const insertSowTemplateSchema = createInsertSchema(sowTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SowTemplate = typeof sowTemplates.$inferSelect;
export type InsertSowTemplate = z.infer<typeof insertSowTemplateSchema>;
