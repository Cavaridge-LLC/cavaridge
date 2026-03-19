import {
  pgTable, serial, integer, text, timestamp, jsonb, boolean, uuid, index,
  pgEnum, real, decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { tenants } from "./auth";

// ── Forge-specific enums ──

export const projectStatusEnum = pgEnum("forge_project_status", [
  "draft", "estimating", "queued", "running", "validating",
  "completed", "failed", "revised",
]);

export const outputFormatEnum = pgEnum("forge_output_format", [
  "docx", "pdf", "markdown",
]);

export const agentRunTypeEnum = pgEnum("forge_agent_run_type", [
  "intake", "estimate", "research", "structure", "generate", "validate", "revise", "render",
]);

export const agentRunStatusEnum = pgEnum("forge_agent_run_status", [
  "pending", "running", "completed", "failed",
]);

export const creditTypeEnum = pgEnum("forge_credit_type", [
  "production", "revision", "free_revision",
]);

// ── Forge Projects ──

export const forgeProjects = pgTable("forge_projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  createdBy: uuid("created_by").notNull(),
  title: text("title").notNull(),
  brief: jsonb("brief").notNull(),
  estimatedCredits: integer("estimated_credits"),
  actualCredits: integer("actual_credits").default(0),
  status: projectStatusEnum("status").notNull().default("draft"),
  outputFormat: outputFormatEnum("output_format").notNull(),
  outputUrl: text("output_url"),
  revisionCount: integer("revision_count").notNull().default(0),
  maxFreeRevisions: integer("max_free_revisions").notNull().default(3),
  qualityScore: real("quality_score"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("forge_projects_tenant_id_idx").on(table.tenantId),
  index("forge_projects_status_idx").on(table.status),
  index("forge_projects_created_by_idx").on(table.createdBy),
]);

export const insertForgeProjectSchema = createInsertSchema(forgeProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  actualCredits: true,
  revisionCount: true,
  qualityScore: true,
  outputUrl: true,
});

export type ForgeProject = typeof forgeProjects.$inferSelect;
export type InsertForgeProject = z.infer<typeof insertForgeProjectSchema>;

// ── Forge Agent Runs ──

export const forgeAgentRuns = pgTable("forge_agent_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").notNull().references(() => forgeProjects.id, { onDelete: "cascade" }),
  runType: agentRunTypeEnum("run_type").notNull(),
  agentName: text("agent_name").notNull(),
  modelUsed: text("model_used"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }),
  langfuseTraceId: text("langfuse_trace_id"),
  status: agentRunStatusEnum("status").notNull().default("pending"),
  result: jsonb("result"),
  error: jsonb("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("forge_agent_runs_project_id_idx").on(table.projectId),
  index("forge_agent_runs_run_type_idx").on(table.runType),
]);

export type ForgeAgentRun = typeof forgeAgentRuns.$inferSelect;

// ── Forge Templates ──

export const forgeTemplates = pgTable("forge_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  outputFormat: outputFormatEnum("output_format").notNull(),
  templateData: jsonb("template_data").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("forge_templates_tenant_id_idx").on(table.tenantId),
  index("forge_templates_format_idx").on(table.outputFormat),
]);

export type ForgeTemplate = typeof forgeTemplates.$inferSelect;

// ── Forge Usage (Credit Tracking) ──

export const forgeUsage = pgTable("forge_usage", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: uuid("user_id").notNull(),
  projectId: uuid("project_id").notNull().references(() => forgeProjects.id),
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
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id),
  totalCredits: integer("total_credits").notNull().default(50),
  usedCredits: integer("used_credits").notNull().default(0),
  tier: text("tier").notNull().default("free"),
  resetAt: timestamp("reset_at"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ForgeTenantCredits = typeof forgeTenantCredits.$inferSelect;
