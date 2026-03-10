import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Role types ──────────────────────────────────────────────────────────
export const USER_ROLES = [
  "platform_owner",
  "platform_admin",
  "tenant_admin",
  "user",
  "viewer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isPlatformRole(role: string): boolean {
  return role === "platform_owner" || role === "platform_admin";
}

// ── Organizations (tenants) ─────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  ownerUserId: uuid("owner_user_id"),
  planTier: varchar("plan_tier", { length: 32 }).default("starter"),
  maxUsers: integer("max_users").default(5),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export const insertOrganizationSchema = createInsertSchema(organizations);

// ── Users ───────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  passwordHash: text("password_hash"),
  status: varchar("status", { length: 32 }).default("active"),
  isPlatformUser: boolean("is_platform_user").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export const insertUserSchema = createInsertSchema(users);

// ── Conversations ───────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title"),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("conversations_tenant_idx").on(table.tenantId),
  index("conversations_user_idx").on(table.userId),
]);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;
export const insertConversationSchema = createInsertSchema(conversations);

// ── Messages ────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  role: varchar("role", { length: 16 }).notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  sourcesJson: jsonb("sources_json").default([]),
  modelUsed: varchar("model_used", { length: 128 }),
  tokensUsed: integer("tokens_used"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("messages_conversation_idx").on(table.conversationId),
  index("messages_tenant_idx").on(table.tenantId),
]);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export const insertMessageSchema = createInsertSchema(messages);

// ── Knowledge Sources ───────────────────────────────────────────────────
export const knowledgeSources = pgTable("knowledge_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  sourceType: varchar("source_type", { length: 32 }).notNull(), // "document" | "url" | "api" | "manual"
  contentHash: varchar("content_hash", { length: 64 }),
  metadataJson: jsonb("metadata_json").default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("knowledge_sources_tenant_idx").on(table.tenantId),
]);

export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type InsertKnowledgeSource = typeof knowledgeSources.$inferInsert;
export const insertKnowledgeSourceSchema = createInsertSchema(knowledgeSources);

// ── Knowledge Chunks (for RAG) ──────────────────────────────────────────
export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => knowledgeSources.id),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  content: text("content").notNull(),
  embeddingJson: jsonb("embedding_json"),
  chunkIndex: integer("chunk_index").default(0),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("knowledge_chunks_source_idx").on(table.sourceId),
  index("knowledge_chunks_tenant_idx").on(table.tenantId),
]);

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type InsertKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunks);

// ── Saved Answers ───────────────────────────────────────────────────────
export const savedAnswers = pgTable("saved_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sourcesJson: jsonb("sources_json").default([]),
  tags: jsonb("tags").default([]),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("saved_answers_tenant_idx").on(table.tenantId),
  index("saved_answers_user_idx").on(table.userId),
]);

export type SavedAnswer = typeof savedAnswers.$inferSelect;
export type InsertSavedAnswer = typeof savedAnswers.$inferInsert;
export const insertSavedAnswerSchema = createInsertSchema(savedAnswers);

// ── Audit Log ───────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  detailsJson: jsonb("details_json").default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("audit_log_org_idx").on(table.organizationId),
]);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
export const insertAuditLogSchema = createInsertSchema(auditLog);

// ── Usage Tracking ──────────────────────────────────────────────────────
export const usageTracking = pgTable("usage_tracking", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  actionType: varchar("action_type", { length: 64 }).notNull(), // "question" | "source_upload" | "api_call"
  tokensUsed: integer("tokens_used").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("usage_tracking_tenant_idx").on(table.tenantId),
]);

export type UsageTrackingEntry = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = typeof usageTracking.$inferInsert;

// ── Zod Validation Schemas ──────────────────────────────────────────────
export const askQuestionSchema = z.object({
  question: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
});

export const createKnowledgeSourceSchema = z.object({
  name: z.string().min(1).max(500),
  sourceType: z.enum(["document", "url", "api", "manual"]),
  content: z.string().optional(),
  metadataJson: z.record(z.unknown()).optional(),
});
