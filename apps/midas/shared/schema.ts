import { sql } from "drizzle-orm";
import {
  pgTable,
  pgSchema,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  uuid,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Midas Schema (dedicated Postgres schema) ────────────────────────
export const midasSchema = pgSchema("midas");

// ── Shared platform table (public schema) ───────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
});

// ── Clients ──────────────────────────────────────────────────────────

export const clients = midasSchema.table("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  industry: text("industry"),
  headcount: integer("headcount"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ── Initiatives ──────────────────────────────────────────────────────

export const initiatives = midasSchema.table("initiatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  team: text("team").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  quarter: text("quarter").notNull(),
  cost: text("cost"),
  businessProblem: text("business_problem"),
  serviceArea: text("service_area"),
  sortOrder: integer("sort_order").notNull().default(0),
  source: varchar("source", { length: 20 }).notNull().default("manual"),
  controlId: text("control_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertInitiativeSchema = createInsertSchema(initiatives).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertInitiative = z.infer<typeof insertInitiativeSchema>;
export type Initiative = typeof initiatives.$inferSelect;

// ── Meetings ─────────────────────────────────────────────────────────

export const meetings = midasSchema.table("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  clientName: text("client_name").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  state: text("state").notNull().default("Draft"),
  dateLabel: text("date_label").notNull(),
  attendees: text("attendees").array().notNull().default(sql`'{}'::text[]`),
  agenda: text("agenda").notNull().default(""),
  notes: text("notes").notNull().default(""),
  executiveSummary: text("executive_summary"),
  nextSteps: text("next_steps").array().default(sql`'{}'::text[]`),
  securityScoreReportId: uuid("security_score_report_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
});
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// ── Snapshots ────────────────────────────────────────────────────────

export const snapshots = midasSchema.table("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  engagementScore: integer("engagement_score").notNull().default(0),
  goalsAligned: integer("goals_aligned").notNull().default(0),
  riskLevel: text("risk_level").notNull().default("Low"),
  budgetTotal: integer("budget_total").notNull().default(0),
  adoptionPercent: integer("adoption_percent").notNull().default(0),
  roiStatus: text("roi_status").notNull().default("On track"),
  securityAdjustedScore: integer("security_adjusted_score"),
});

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({ id: true });
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type Snapshot = typeof snapshots.$inferSelect;

// ── Compensating Control Catalog (platform-scoped) ───────────────────

export const compensatingControlCatalog = midasSchema.table("compensating_control_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  nativeControlId: text("native_control_id").notNull(),
  nativeControlName: text("native_control_name").notNull(),
  vendor: varchar("vendor", { length: 20 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  thirdPartyProducts: jsonb("third_party_products").notNull().default("[]"),
  compensationLevel: varchar("compensation_level", { length: 10 }).notNull(),
  notes: text("notes"),
  lastVerified: timestamp("last_verified", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCatalogEntrySchema = createInsertSchema(compensatingControlCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCatalogEntry = z.infer<typeof insertCatalogEntrySchema>;
export type CatalogEntry = typeof compensatingControlCatalog.$inferSelect;

// ── Security Scoring Overrides (per-tenant, per-client) ──────────────

export const securityScoringOverrides = midasSchema.table(
  "security_scoring_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    nativeControlId: text("native_control_id").notNull(),
    overrideType: varchar("override_type", { length: 20 }).notNull(),
    thirdPartyProduct: text("third_party_product"),
    compensationLevel: varchar("compensation_level", { length: 10 }).notNull(),
    notes: text("notes").notNull(),
    setBy: uuid("set_by").notNull(),
    setAt: timestamp("set_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("override_tenant_client_control_idx").on(
      table.tenantId,
      table.clientId,
      table.nativeControlId,
    ),
  ],
);

export const insertOverrideSchema = createInsertSchema(securityScoringOverrides).omit({
  id: true,
  setAt: true,
});
export type InsertOverride = z.infer<typeof insertOverrideSchema>;
export type ScoringOverride = typeof securityScoringOverrides.$inferSelect;

// ── Security Score History ───────────────────────────────────────────

export const securityScoreHistory = midasSchema.table("security_score_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  vendor: varchar("vendor", { length: 20 }).notNull(),
  nativeScore: numeric("native_score").notNull(),
  nativeMaxScore: numeric("native_max_score").notNull(),
  adjustedScore: numeric("adjusted_score").notNull(),
  adjustedMaxScore: numeric("adjusted_max_score").notNull(),
  realGapCount: integer("real_gap_count").notNull(),
  compensatedCount: integer("compensated_count").notNull(),
  reportJson: jsonb("report_json").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertScoreHistorySchema = createInsertSchema(securityScoreHistory).omit({
  id: true,
  generatedAt: true,
});
export type InsertScoreHistory = z.infer<typeof insertScoreHistorySchema>;
export type ScoreHistory = typeof securityScoreHistory.$inferSelect;
