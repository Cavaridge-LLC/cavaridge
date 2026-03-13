/**
 * Spaniel LLM Gateway — Drizzle Schema
 *
 * Three tables in the `spaniel` Postgres schema:
 * - routing_matrix: task → primary/secondary/tertiary model mapping
 * - request_log: audit trail for every LLM call (RLS on tenant_id)
 * - model_catalog: available models with pricing and performance data
 */

import {
  pgTable,
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";

export const spanielSchema = pgSchema("spaniel");

export const routingMatrix = spanielSchema.table("routing_matrix", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskType: text("task_type").notNull().unique(),
  primaryModel: text("primary_model").notNull(),
  secondaryModel: text("secondary_model").notNull(),
  tertiaryModel: text("tertiary_model"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by").notNull().default("manual"),
});

export const requestLog = spanielSchema.table("request_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  appCode: text("app_code"),
  taskType: text("task_type"),
  primaryModel: text("primary_model"),
  secondaryModel: text("secondary_model"),
  tertiaryModel: text("tertiary_model"),
  modelUsed: text("model_used").notNull(),
  fallbackUsed: boolean("fallback_used").default(false),
  consensusAligned: boolean("consensus_aligned"),
  confidenceScore: numeric("confidence_score", { precision: 4, scale: 3 }),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  status: text("status").notNull().default("success"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const modelCatalog = spanielSchema.table("model_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: text("model_id").notNull().unique(),
  provider: text("provider").notNull(),
  contextWindow: integer("context_window"),
  costPerMInput: numeric("cost_per_m_input", { precision: 10, scale: 6 }),
  costPerMOutput: numeric("cost_per_m_output", { precision: 10, scale: 6 }),
  avgLatencyMs: integer("avg_latency_ms"),
  benchmarkScores: jsonb("benchmark_scores"),
  active: boolean("active").default(true),
  lastEvaluated: timestamp("last_evaluated", { withTimezone: true }),
});
