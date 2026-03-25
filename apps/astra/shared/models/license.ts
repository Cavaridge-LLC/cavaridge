import { serial, integer, real, text, timestamp, jsonb, uuid, index, pgSchema, boolean } from "drizzle-orm/pg-core";
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

// ── Tenant Connections ──────────────────────────────────────────────

export const tenantConnections = astraSchema.table("tenant_connections", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  m365TenantId: text("m365_tenant_id").notNull(),
  clientId: text("client_id").notNull(),
  /** Encrypted client secret — never stored in plaintext */
  encryptedSecret: text("encrypted_secret").notNull(),
  status: text("status").notNull().default("active"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("tenant_connections_tenant_id_idx").on(table.tenantId),
]);

export const insertTenantConnectionSchema = createInsertSchema(tenantConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TenantConnection = typeof tenantConnections.$inferSelect;
export type InsertTenantConnection = z.infer<typeof insertTenantConnectionSchema>;

// ── License Audits ──────────────────────────────────────────────────

export const licenseAudits = astraSchema.table("license_audits", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  connectionId: integer("connection_id").references(() => tenantConnections.id),
  status: text("status").notNull().default("pending"),
  config: jsonb("config"),
  /** Raw user data snapshot at audit time */
  userData: jsonb("user_data"),
  /** Waste detection results */
  wasteResults: jsonb("waste_results"),
  /** Summary metrics */
  totalUsers: integer("total_users"),
  totalMonthlyCost: real("total_monthly_cost"),
  totalWastedCost: real("total_wasted_cost"),
  findingsCount: integer("findings_count"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("license_audits_tenant_id_idx").on(table.tenantId),
  index("license_audits_status_idx").on(table.status),
]);

export const insertLicenseAuditSchema = createInsertSchema(licenseAudits).omit({
  id: true,
  createdAt: true,
});

export type LicenseAudit = typeof licenseAudits.$inferSelect;
export type InsertLicenseAudit = z.infer<typeof insertLicenseAuditSchema>;

// ── Recommendations ─────────────────────────────────────────────────

export const recommendations = astraSchema.table("recommendations", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  auditId: integer("audit_id").notNull().references(() => licenseAudits.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  userDisplayName: text("user_display_name"),
  userPrincipalName: text("user_principal_name"),
  type: text("type").notNull(),
  currentLicenses: jsonb("current_licenses").notNull(),
  recommendedLicenses: jsonb("recommended_licenses").notNull(),
  currentMonthlyCost: real("current_monthly_cost").notNull(),
  recommendedMonthlyCost: real("recommended_monthly_cost").notNull(),
  monthlySavings: real("monthly_savings").notNull(),
  annualSavings: real("annual_savings").notNull(),
  rationale: text("rationale").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  implementationNotes: text("implementation_notes"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  implementedAt: timestamp("implemented_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("recommendations_tenant_id_idx").on(table.tenantId),
  index("recommendations_audit_id_idx").on(table.auditId),
  index("recommendations_status_idx").on(table.status),
]);

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
  createdAt: true,
});

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;

// ── Optimization Plans ──────────────────────────────────────────────

export const optimizationPlans = astraSchema.table("optimization_plans", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  auditId: integer("audit_id").notNull().references(() => licenseAudits.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  totalRecommendations: integer("total_recommendations").notNull().default(0),
  totalMonthlySavings: real("total_monthly_savings").notNull().default(0),
  totalAnnualSavings: real("total_annual_savings").notNull().default(0),
  implementationPlan: jsonb("implementation_plan"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("optimization_plans_tenant_id_idx").on(table.tenantId),
  index("optimization_plans_audit_id_idx").on(table.auditId),
]);

export const insertOptimizationPlanSchema = createInsertSchema(optimizationPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OptimizationPlan = typeof optimizationPlans.$inferSelect;
export type InsertOptimizationPlan = z.infer<typeof insertOptimizationPlanSchema>;

// ── vCIO Reports ────────────────────────────────────────────────────

export const vcioReports = astraSchema.table("vcio_reports", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  auditId: integer("audit_id").notNull().references(() => licenseAudits.id),
  planId: integer("plan_id").references(() => optimizationPlans.id),
  title: text("title").notNull(),
  content: text("content"),
  /** Report data used for DOCX generation */
  reportData: jsonb("report_data"),
  includesIAR: boolean("includes_iar").notNull().default(false),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("vcio_reports_tenant_id_idx").on(table.tenantId),
  index("vcio_reports_audit_id_idx").on(table.auditId),
])

export const insertVcioReportSchema = createInsertSchema(vcioReports).omit({
  id: true,
  createdAt: true,
});

export type VcioReport = typeof vcioReports.$inferSelect;
export type InsertVcioReport = z.infer<typeof insertVcioReportSchema>;
