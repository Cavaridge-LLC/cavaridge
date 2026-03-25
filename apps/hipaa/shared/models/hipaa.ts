import {
  pgTable, uuid, text, timestamp, jsonb, integer, index, pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { tenants } from "./auth";

// ── HIPAA-specific enums ──

export const assessmentTypeEnum = pgEnum("hipaa_assessment_type", [
  "security_rule", "privacy_rule", "breach_notification",
]);

export const assessmentStatusEnum = pgEnum("hipaa_assessment_status", [
  "draft", "in_progress", "review", "completed", "approved",
]);

export const frameworkEnum = pgEnum("hipaa_framework", [
  "hipaa_security", "hipaa_privacy", "hitrust",
]);

export const controlCategoryEnum = pgEnum("hipaa_control_category", [
  "administrative", "physical", "technical",
]);

export const controlStateEnum = pgEnum("hipaa_control_state", [
  "not_implemented", "partial", "implemented",
]);

export const riskLevelEnum = pgEnum("hipaa_risk_level", [
  "critical", "high", "medium", "low",
]);

export const riskTreatmentEnum = pgEnum("hipaa_risk_treatment", [
  "mitigate", "accept", "transfer", "avoid",
]);

export const remediationStatusEnum = pgEnum("hipaa_remediation_status", [
  "open", "in_progress", "completed", "verified",
]);

export const reportTypeEnum = pgEnum("hipaa_report_type", [
  "executive_summary", "detailed", "gap_analysis", "risk_register",
]);

// ── Risk Assessments ──

export const riskAssessments = pgTable("hipaa_risk_assessments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  siteId: uuid("site_id").references(() => tenants.id),
  title: text("title").notNull(),
  assessmentType: assessmentTypeEnum("assessment_type").notNull().default("security_rule"),
  status: assessmentStatusEnum("status").notNull().default("draft"),
  framework: frameworkEnum("framework").notNull().default("hipaa_security"),
  createdBy: uuid("created_by").notNull(),
  assignedTo: uuid("assigned_to"),
  completedAt: timestamp("completed_at"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("hipaa_ra_tenant_id_idx").on(table.tenantId),
  index("hipaa_ra_status_idx").on(table.status),
  index("hipaa_ra_framework_idx").on(table.framework),
]);

export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = typeof riskAssessments.$inferInsert;

export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  approvedBy: true,
  approvedAt: true,
});

// ── Assessment Controls ──

export const assessmentControls = pgTable("hipaa_assessment_controls", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: uuid("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  controlRef: text("control_ref").notNull(),
  controlName: text("control_name").notNull(),
  category: controlCategoryEnum("category").notNull(),
  safeguardType: text("safeguard_type"),
  currentState: controlStateEnum("current_state").notNull().default("not_implemented"),
  findingDetail: text("finding_detail"),
  likelihood: integer("likelihood").default(1),
  impact: integer("impact").default(1),
  riskScore: integer("risk_score").default(1),
  riskLevel: riskLevelEnum("risk_level").default("low"),
  riskTreatment: riskTreatmentEnum("risk_treatment"),
  evidenceNotes: text("evidence_notes"),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("hipaa_ac_assessment_id_idx").on(table.assessmentId),
  index("hipaa_ac_control_ref_idx").on(table.controlRef),
  index("hipaa_ac_tenant_id_idx").on(table.tenantId),
]);

export type AssessmentControl = typeof assessmentControls.$inferSelect;
export type InsertAssessmentControl = typeof assessmentControls.$inferInsert;

export const insertAssessmentControlSchema = createInsertSchema(assessmentControls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ── Remediation Items ──

export const remediationItems = pgTable("hipaa_remediation_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: uuid("control_id").references(() => assessmentControls.id),
  assessmentId: uuid("assessment_id").notNull().references(() => riskAssessments.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  status: remediationStatusEnum("status").notNull().default("open"),
  priority: integer("priority").notNull().default(3),
  assignedTo: uuid("assigned_to"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  verifiedBy: uuid("verified_by"),
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("hipaa_ri_assessment_id_idx").on(table.assessmentId),
  index("hipaa_ri_status_idx").on(table.status),
  index("hipaa_ri_tenant_id_idx").on(table.tenantId),
]);

export type RemediationItem = typeof remediationItems.$inferSelect;
export type InsertRemediationItem = typeof remediationItems.$inferInsert;

export const insertRemediationItemSchema = createInsertSchema(remediationItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  verifiedBy: true,
  verifiedAt: true,
});

// ── Assessment Evidence ──

export const assessmentEvidence = pgTable("hipaa_assessment_evidence", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: uuid("control_id").notNull().references(() => assessmentControls.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileUrl: text("file_url").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("hipaa_ae_control_id_idx").on(table.controlId),
  index("hipaa_ae_tenant_id_idx").on(table.tenantId),
]);

export type AssessmentEvidenceRow = typeof assessmentEvidence.$inferSelect;

// ── Assessment Reports ──

export const assessmentReports = pgTable("hipaa_assessment_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: uuid("assessment_id").notNull().references(() => riskAssessments.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  reportType: reportTypeEnum("report_type").notNull(),
  format: text("format").notNull().default("pdf"),
  content: jsonb("content"),
  generatedBy: uuid("generated_by").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("hipaa_ar_assessment_id_idx").on(table.assessmentId),
  index("hipaa_ar_tenant_id_idx").on(table.tenantId),
]);

export type AssessmentReport = typeof assessmentReports.$inferSelect;

export const insertAssessmentReportSchema = createInsertSchema(assessmentReports).omit({
  id: true,
  createdAt: true,
});

// ── Compliance Frameworks (seed data) ──

export const complianceFrameworks = pgTable("hipaa_compliance_frameworks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  frameworkId: text("framework_id").unique().notNull(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  controls: jsonb("controls").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ComplianceFramework = typeof complianceFrameworks.$inferSelect;

// ── Assessment Audit Log ──

export const assessmentAuditLog = pgTable("hipaa_assessment_audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: uuid("assessment_id"),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: uuid("user_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: uuid("resource_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("hipaa_aal_assessment_id_idx").on(table.assessmentId),
  index("hipaa_aal_tenant_id_idx").on(table.tenantId),
  index("hipaa_aal_created_at_idx").on(table.createdAt),
]);

export type AssessmentAuditLogEntry = typeof assessmentAuditLog.$inferSelect;

// ── Compliance Timeline Snapshots ──

export const complianceSnapshots = pgTable("hipaa_compliance_snapshots", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: uuid("assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  snapshotDate: timestamp("snapshot_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  totalControls: integer("total_controls").notNull().default(0),
  implemented: integer("implemented").notNull().default(0),
  partial: integer("partial").notNull().default(0),
  notImplemented: integer("not_implemented").notNull().default(0),
  complianceRate: integer("compliance_rate").notNull().default(0),
  criticalFindings: integer("critical_findings").notNull().default(0),
  highFindings: integer("high_findings").notNull().default(0),
  mediumFindings: integer("medium_findings").notNull().default(0),
  lowFindings: integer("low_findings").notNull().default(0),
  openRemediations: integer("open_remediations").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("hipaa_cs_assessment_id_idx").on(table.assessmentId),
  index("hipaa_cs_tenant_id_idx").on(table.tenantId),
  index("hipaa_cs_snapshot_date_idx").on(table.snapshotDate),
]);

export type ComplianceSnapshot = typeof complianceSnapshots.$inferSelect;
export type InsertComplianceSnapshot = typeof complianceSnapshots.$inferInsert;

// ── Safeguard Compliance Score Enum ──

export const safeguardScoreEnum = pgEnum("hipaa_safeguard_score", [
  "compliant", "partially_compliant", "non_compliant", "not_applicable",
]);

// ── Helper: compute risk level from score ──

export function computeRiskLevel(likelihood: number, impact: number): { score: number; level: "critical" | "high" | "medium" | "low" } {
  const score = likelihood * impact;
  let level: "critical" | "high" | "medium" | "low";
  if (score >= 16) level = "critical";
  else if (score >= 11) level = "high";
  else if (score >= 6) level = "medium";
  else level = "low";
  return { score, level };
}

// ── Helper: map control state to safeguard score ──

export function controlStateToScore(state: string): "compliant" | "partially_compliant" | "non_compliant" | "not_applicable" {
  switch (state) {
    case "implemented": return "compliant";
    case "partial": return "partially_compliant";
    case "not_implemented": return "non_compliant";
    default: return "not_applicable";
  }
}

// ── Helper: generate gap analysis from controls ──

export interface GapAnalysisItem {
  controlRef: string;
  controlName: string;
  category: string;
  currentState: string;
  score: "compliant" | "partially_compliant" | "non_compliant" | "not_applicable";
  riskLevel: string | null;
  riskScore: number | null;
  findingDetail: string | null;
  recommendation: string;
  priority: "critical" | "high" | "medium" | "low";
}

export function generateGapAnalysis(controls: AssessmentControl[]): GapAnalysisItem[] {
  return controls
    .filter(c => c.currentState !== "implemented")
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    .map(c => {
      const score = controlStateToScore(c.currentState);
      const priority = c.riskLevel === "critical" ? "critical"
        : c.riskLevel === "high" ? "high"
        : c.riskLevel === "medium" ? "medium"
        : "low";

      const recommendation = c.currentState === "not_implemented"
        ? `Implement ${c.controlName} (${c.controlRef}) to meet HIPAA Security Rule requirements. This control is currently not implemented and requires immediate attention.`
        : `Complete the implementation of ${c.controlName} (${c.controlRef}). This control is partially implemented and needs additional work to achieve full compliance.`;

      return {
        controlRef: c.controlRef,
        controlName: c.controlName,
        category: c.category,
        currentState: c.currentState,
        score,
        riskLevel: c.riskLevel,
        riskScore: c.riskScore,
        findingDetail: c.findingDetail,
        recommendation,
        priority,
      };
    });
}
