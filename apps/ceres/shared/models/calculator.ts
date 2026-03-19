import { pgTable, text, varchar, timestamp, uuid, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const confidenceEnum = pgEnum("scan_confidence", ["high", "medium", "low"]);

/**
 * Calculator results — tenant-scoped storage of saved frequency calculations.
 *
 * Every row carries a tenant_id for RLS isolation. Calculator logic is
 * deterministic (no LLM) but results are persisted for reporting/audit.
 */
export const calculatorResults = pgTable("calculator_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  patientRef: varchar("patient_ref", { length: 100 }),
  socDate: varchar("soc_date", { length: 10 }).notNull(), // YYYY-MM-DD
  visits: jsonb("visits").notNull(), // number[] — per-week visit counts
  frequencyStr: varchar("frequency_str", { length: 255 }),
  totalVisits: integer("total_visits").notNull(),
  period1Visits: integer("period1_visits"),
  period2Visits: integer("period2_visits"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CalculatorResult = typeof calculatorResults.$inferSelect;
export type InsertCalculatorResult = typeof calculatorResults.$inferInsert;

export const insertCalculatorResultSchema = createInsertSchema(calculatorResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * EMR scan results — tenant-scoped storage of AI-extracted schedule data.
 */
export const scanResults = pgTable("scan_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  calculatorResultId: uuid("calculator_result_id"),
  socDate: varchar("soc_date", { length: 10 }).notNull(),
  visits: jsonb("visits").notNull(),
  visitDates: jsonb("visit_dates"), // string[] of YYYY-MM-DD
  emrSystem: varchar("emr_system", { length: 50 }),
  confidence: varchar("confidence", { length: 10 }),
  aiNotes: text("ai_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ScanResult = typeof scanResults.$inferSelect;
export type InsertScanResult = typeof scanResults.$inferInsert;

export const insertScanResultSchema = createInsertSchema(scanResults).omit({
  id: true,
  createdAt: true,
});
