/**
 * @cavaridge/blueprints — Drizzle schema for the blueprints table.
 *
 * All rows are RLS-scoped: platform-level blueprints have tenant_id = NULL,
 * MSP-scoped blueprints have tenant_id set to the MSP's UUID.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  jsonb,
  integer,
  real,
  timestamp,
  index,
  vector,
} from "drizzle-orm/pg-core";

export const blueprintCategoryEnum = pgEnum("blueprint_category", [
  "agent",
  "app",
  "component",
  "workflow",
  "integration",
]);

export const blueprints = pgTable("blueprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: blueprintCategoryEnum("category").notNull(),
  buildPlan: jsonb("build_plan").notNull().default({}),
  templateCode: jsonb("template_code").notNull().default([]),
  variables: jsonb("variables").notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  version: varchar("version", { length: 50 }).notNull().default("1.0.0"),
  tenantId: uuid("tenant_id"),
  usageCount: integer("usage_count").notNull().default(0),
  avgTestScore: real("avg_test_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("blueprints_tenant_idx").on(table.tenantId),
  index("blueprints_category_idx").on(table.category),
  index("blueprints_name_idx").on(table.name),
]);

/**
 * Embeddings table for semantic search via pgvector.
 * Each blueprint gets one embedding row generated from name + description + tags.
 */
export const blueprintEmbeddings = pgTable("blueprint_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  blueprintId: uuid("blueprint_id").notNull().references(() => blueprints.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("blueprint_embeddings_blueprint_idx").on(table.blueprintId),
]);

/** Inferred types */
export type BlueprintRow = typeof blueprints.$inferSelect;
export type NewBlueprintRow = typeof blueprints.$inferInsert;
export type BlueprintEmbeddingRow = typeof blueprintEmbeddings.$inferSelect;
export type NewBlueprintEmbeddingRow = typeof blueprintEmbeddings.$inferInsert;
