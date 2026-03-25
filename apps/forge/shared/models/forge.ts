import {
  pgTable, integer, text, timestamp, jsonb, boolean, uuid, index,
  pgEnum, real, decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// NOTE: FK references to tenants.id removed from column definitions to avoid
// cross-package @types/pg version mismatch (drizzle-orm resolves two different
// @types/pg versions across workspace packages). FK constraints are still
// enforced at the database level via migrations / drizzle-kit push.

// ── Forge-specific enums ──

export const contentStatusEnum = pgEnum("forge_content_status", [
  "draft", "estimating", "queued", "research_outline", "draft_generation",
  "review_refinement", "formatting_polish", "export",
  "completed", "failed", "revised",
]);

export const outputFormatEnum = pgEnum("forge_output_format", [
  "docx", "pdf", "html",
]);

export const contentTypeEnum = pgEnum("forge_content_type", [
  "blog_post", "case_study", "white_paper", "email_campaign",
  "social_media_series", "proposal", "one_pager", "custom",
]);

export const stageRunStatusEnum = pgEnum("forge_stage_run_status", [
  "pending", "running", "completed", "failed", "skipped",
]);

export const creditTypeEnum = pgEnum("forge_credit_type", [
  "production", "revision", "free_revision",
]);

// ── Forge Content (primary entity) ──

export const forgeContent = pgTable("forge_content", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  title: text("title").notNull(),
  brief: jsonb("brief").notNull(),
  contentType: contentTypeEnum("content_type").notNull().default("custom"),
  estimatedCredits: integer("estimated_credits"),
  actualCredits: integer("actual_credits").default(0),
  status: contentStatusEnum("status").notNull().default("draft"),
  outputFormat: outputFormatEnum("output_format").notNull(),
  outputUrl: text("output_url"),
  revisionCount: integer("revision_count").notNull().default(0),
  maxFreeRevisions: integer("max_free_revisions").notNull().default(3),
  qualityScore: real("quality_score"),
  templateId: uuid("template_id"),
  brandVoiceId: uuid("brand_voice_id"),
  batchId: uuid("batch_id"),
  metadata: jsonb("metadata"),
  pipelineState: jsonb("pipeline_state"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("forge_content_tenant_id_idx").on(table.tenantId),
  index("forge_content_status_idx").on(table.status),
  index("forge_content_created_by_idx").on(table.createdBy),
  index("forge_content_content_type_idx").on(table.contentType),
  index("forge_content_batch_id_idx").on(table.batchId),
]);

export const insertForgeContentSchema = createInsertSchema(forgeContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  actualCredits: true,
  revisionCount: true,
  qualityScore: true,
  outputUrl: true,
  pipelineState: true,
});

export type ForgeContent = typeof forgeContent.$inferSelect;
export type InsertForgeContent = z.infer<typeof insertForgeContentSchema>;

// ── Pipeline Stage Runs (observability) ──

export const forgeStageRuns = pgTable("forge_stage_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentId: uuid("content_id").notNull().references(() => forgeContent.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  status: stageRunStatusEnum("status").notNull().default("pending"),
  agentName: text("agent_name").notNull(),
  modelUsed: text("model_used"),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }),
  durationMs: integer("duration_ms"),
  langfuseTraceId: text("langfuse_trace_id"),
  intermediateOutput: jsonb("intermediate_output"),
  error: jsonb("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("forge_stage_runs_content_id_idx").on(table.contentId),
  index("forge_stage_runs_stage_idx").on(table.stage),
]);

export type ForgeStageRun = typeof forgeStageRuns.$inferSelect;

// ── Forge Templates ──

export const forgeTemplates = pgTable("forge_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  contentType: contentTypeEnum("content_type").notNull(),
  outputFormats: jsonb("output_formats").notNull().default(sql`'["docx","pdf","html"]'::jsonb`),
  templateData: jsonb("template_data").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("forge_templates_tenant_id_idx").on(table.tenantId),
  index("forge_templates_content_type_idx").on(table.contentType),
  index("forge_templates_slug_idx").on(table.slug),
]);

export type ForgeTemplate = typeof forgeTemplates.$inferSelect;

// ── Forge Brand Voice (per-tenant) ──

export const forgeBrandVoices = pgTable("forge_brand_voices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  tone: text("tone").notNull(),
  vocabulary: jsonb("vocabulary").notNull().default(sql`'[]'::jsonb`),
  styleGuide: text("style_guide").notNull().default(""),
  avoidTerms: jsonb("avoid_terms").notNull().default(sql`'[]'::jsonb`),
  examplePhrases: jsonb("example_phrases").notNull().default(sql`'[]'::jsonb`),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("forge_brand_voices_tenant_id_idx").on(table.tenantId),
]);

export type ForgeBrandVoice = typeof forgeBrandVoices.$inferSelect;

// ── Forge Batches ──

export const forgeBatches = pgTable("forge_batches", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  topic: text("topic").notNull(),
  contentCount: integer("content_count").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  sharedResearch: jsonb("shared_research"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("forge_batches_tenant_id_idx").on(table.tenantId),
]);

export type ForgeBatch = typeof forgeBatches.$inferSelect;

// ── Forge Usage (Credit Tracking) ──

export const forgeUsage = pgTable("forge_usage", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  contentId: uuid("content_id").notNull().references(() => forgeContent.id),
  creditsUsed: integer("credits_used").notNull(),
  creditType: creditTypeEnum("credit_type").notNull(),
  billingPeriod: timestamp("billing_period").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("forge_usage_tenant_id_idx").on(table.tenantId),
  index("forge_usage_user_id_idx").on(table.userId),
  index("forge_usage_billing_period_idx").on(table.billingPeriod),
]);

export type ForgeUsage = typeof forgeUsage.$inferSelect;

// ── Forge Tenant Credits ──

export const forgeTenantCredits = pgTable("forge_tenant_credits", {
  tenantId: uuid("tenant_id").primaryKey(),
  totalCredits: integer("total_credits").notNull().default(50),
  usedCredits: integer("used_credits").notNull().default(0),
  tier: text("tier").notNull().default("free"),
  resetAt: timestamp("reset_at"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ForgeTenantCredits = typeof forgeTenantCredits.$inferSelect;

// ── Backward compat re-exports for old code referencing forgeProjects / forgeAgentRuns ──

/** @deprecated Use forgeContent */
export const forgeProjects = forgeContent;
/** @deprecated Use forgeStageRuns */
export const forgeAgentRuns = forgeStageRuns;
