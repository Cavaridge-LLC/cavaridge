import { serial, integer, real, text, timestamp, jsonb, uuid, index, pgSchema } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { tenants } from "./utm";

/** Astra app schema — all app-specific tables live here */
export const astraSchema = pgSchema("astra");

export const reports = astraSchema.table("reports", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  strategy: text("strategy").notNull().default("current"),
  commitment: text("commitment").notNull().default("monthly"),
  userData: jsonb("user_data").notNull(),
  customRules: jsonb("custom_rules"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("reports_tenant_id_idx").on(table.tenantId),
]);

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export const executiveSummaries = astraSchema.table("executive_summaries", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  reportId: integer("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  costCurrent: real("cost_current").notNull(),
  costSecurity: real("cost_security").notNull(),
  costSaving: real("cost_saving").notNull(),
  costBalanced: real("cost_balanced").notNull(),
  costCustom: real("cost_custom"),
  commitment: text("commitment").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("executive_summaries_tenant_id_idx").on(table.tenantId),
]);

export const insertExecutiveSummarySchema = createInsertSchema(executiveSummaries).omit({
  id: true,
  createdAt: true,
});

export type ExecutiveSummary = typeof executiveSummaries.$inferSelect;
export type InsertExecutiveSummary = z.infer<typeof insertExecutiveSummarySchema>;

export const microsoftTokens = astraSchema.table("microsoft_tokens", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  sessionId: text("session_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at").notNull(),
  m365TenantId: text("m365_tenant_id"),
  userEmail: text("user_email"),
  userName: text("user_name"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMicrosoftTokenSchema = createInsertSchema(microsoftTokens).omit({
  id: true,
  createdAt: true,
});

export type MicrosoftToken = typeof microsoftTokens.$inferSelect;
export type InsertMicrosoftToken = z.infer<typeof insertMicrosoftTokenSchema>;

export const loginHistory = astraSchema.table("login_history", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  userEmail: text("user_email").notNull(),
  userName: text("user_name"),
  m365TenantId: text("m365_tenant_id"),
  loginAt: timestamp("login_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLoginHistorySchema = createInsertSchema(loginHistory).omit({
  id: true,
  loginAt: true,
});

export type LoginHistory = typeof loginHistory.$inferSelect;
export type InsertLoginHistory = z.infer<typeof insertLoginHistorySchema>;
