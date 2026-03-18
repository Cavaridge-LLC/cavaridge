import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Role types (re-exported from shared auth package) ───────────────────
export { ROLES, ROLE_HIERARCHY, hasMinimumRole, isPlatformRole } from "@cavaridge/auth";
export type { Role } from "@cavaridge/auth";

export const USER_ROLES = [
  "platform_owner",
  "platform_admin",
  "tenant_admin",
  "user",
  "viewer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

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

// ── Profiles (linked 1:1 to Supabase auth.users) ───────────────────────
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id (NOT auto-generated)
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  isPlatformUser: boolean("is_platform_user").default(false),
  status: varchar("status", { length: 32 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;
export const insertProfileSchema = createInsertSchema(profiles);

// Backward-compatible aliases so existing code importing `users` / `User` still works
export const users = profiles;
export type User = Profile;
export type InsertUser = InsertProfile;
export const insertUserSchema = insertProfileSchema;

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

// ── Threads (conversation auto-branching) ───────────────────────────────
export const threads = pgTable("threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  parentThreadId: uuid("parent_thread_id"),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  title: text("title"),
  branchTrigger: varchar("branch_trigger", { length: 32 }), // "auto_detected" | "manual" | "system"
  similarityScore: numeric("similarity_score", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("threads_tenant_idx").on(table.tenantId),
  index("threads_conversation_idx").on(table.conversationId),
]);

export type Thread = typeof threads.$inferSelect;
export type InsertThread = typeof threads.$inferInsert;
export const insertThreadSchema = createInsertSchema(threads);

// ── Messages ────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  threadId: uuid("thread_id").references(() => threads.id),
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

// ── Audit Log — canonical definition in @cavaridge/audit ────────────────
export { auditLog } from "@cavaridge/audit/schema";
export type { AuditEntry as AuditLogEntry, NewAuditEntry as InsertAuditLog } from "@cavaridge/audit/schema";

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

// ── Agent Plans ──────────────────────────────────────────────────────
export const agentPlans = pgTable("agent_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  requestingApp: varchar("requesting_app", { length: 64 }),
  query: text("query").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  stepCount: integer("step_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("agent_plans_tenant_idx").on(table.tenantId),
  index("agent_plans_user_idx").on(table.userId),
  index("agent_plans_status_idx").on(table.status),
]);

export type AgentPlan = typeof agentPlans.$inferSelect;
export type InsertAgentPlan = typeof agentPlans.$inferInsert;
export const insertAgentPlanSchema = createInsertSchema(agentPlans);

// ── Agent Plan Steps ─────────────────────────────────────────────────
export const agentPlanSteps = pgTable("agent_plan_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").notNull().references(() => agentPlans.id),
  orderIndex: integer("order_index").notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  connector: varchar("connector", { length: 32 }).notNull(),
  description: text("description").notNull(),
  dependsOn: jsonb("depends_on").default([]),
  inputData: jsonb("input_data").default({}),
  outputData: jsonb("output_data"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("agent_plan_steps_plan_idx").on(table.planId),
  index("agent_plan_steps_status_idx").on(table.status),
]);

export type AgentPlanStep = typeof agentPlanSteps.$inferSelect;
export type InsertAgentPlanStep = typeof agentPlanSteps.$inferInsert;
export const insertAgentPlanStepSchema = createInsertSchema(agentPlanSteps);

// ── Agent Action Approvals ───────────────────────────────────────────
export const agentActionApprovals = pgTable("agent_action_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").notNull().references(() => agentPlans.id),
  stepId: uuid("step_id").notNull().references(() => agentPlanSteps.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  actionType: varchar("action_type", { length: 16 }).notNull(),
  actionPreview: jsonb("action_preview").notNull(),
  approved: boolean("approved").notNull(),
  responseComment: text("response_comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("agent_action_approvals_plan_idx").on(table.planId),
  index("agent_action_approvals_step_idx").on(table.stepId),
]);

export type AgentActionApprovalRow = typeof agentActionApprovals.$inferSelect;
export type InsertAgentActionApproval = typeof agentActionApprovals.$inferInsert;
export const insertAgentActionApprovalSchema = createInsertSchema(agentActionApprovals);

// ── Build Plans (CVGBuilder v3 Plan Mode) ───────────────────────────────
export const buildPlans = pgTable("build_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  agentGraph: jsonb("agent_graph").default({}),
  toolDefinitions: jsonb("tool_definitions").default([]),
  schemaTemplate: jsonb("schema_template").default({}),
  uiWireframe: jsonb("ui_wireframe").default({}),
  rbacMatrix: jsonb("rbac_matrix").default({}),
  testScenarios: jsonb("test_scenarios").default([]),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("build_plans_tenant_idx").on(table.tenantId),
  index("build_plans_status_idx").on(table.status),
]);

export type BuildPlan = typeof buildPlans.$inferSelect;
export type InsertBuildPlan = typeof buildPlans.$inferInsert;
export const insertBuildPlanSchema = createInsertSchema(buildPlans);
