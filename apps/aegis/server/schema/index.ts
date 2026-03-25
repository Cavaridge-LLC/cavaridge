/**
 * CVG-AEGIS — Drizzle ORM Schema Definitions
 *
 * All tables in the aegis schema. Tenant-scoped via tenant_id.
 * Consumed by routes for type-safe queries.
 */
import {
  pgTable,
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const aegisSchema = pgSchema("aegis");

// ---------------------------------------------------------------------------
// Devices — enrolled browser extensions
// ---------------------------------------------------------------------------

export const devices = aegisSchema.table("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  deviceId: varchar("device_id", { length: 255 }).notNull(),
  hostname: text("hostname"),
  os: text("os"),
  browser: text("browser"),
  browserVersion: text("browser_version"),
  extensionVersion: text("extension_version"),
  enrollmentTokenId: uuid("enrollment_token_id"),
  status: varchar("status", { length: 20 }).notNull().default("enrolled"),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("devices_tenant_id_idx").on(table.tenantId),
  index("devices_device_id_idx").on(table.deviceId),
  index("devices_status_idx").on(table.status),
]);

// ---------------------------------------------------------------------------
// Enrollment Tokens
// ---------------------------------------------------------------------------

export const enrollmentTokens = aegisSchema.table("enrollment_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  label: text("label"),
  maxUses: integer("max_uses").default(0),
  useCount: integer("use_count").default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("enrollment_tokens_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Policies — security policies pushed to extensions
// ---------------------------------------------------------------------------

export const policies = aegisSchema.table("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(),
  rules: jsonb("rules").notNull(),
  priority: integer("priority").default(100),
  appliesTo: jsonb("applies_to").default({ all: true }),
  enabled: boolean("enabled").default(true),
  version: integer("version").default(1),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("policies_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Telemetry Events — browser extension telemetry
// ---------------------------------------------------------------------------

export const telemetryEvents = aegisSchema.table("telemetry_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  deviceId: uuid("device_id"),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  domain: text("domain"),
  url: text("url"),
  title: text("title"),
  metadata: jsonb("metadata").default({}),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("telemetry_events_tenant_id_idx").on(table.tenantId),
  index("telemetry_events_device_id_idx").on(table.deviceId),
  index("telemetry_events_domain_idx").on(table.domain),
]);

// ---------------------------------------------------------------------------
// SaaS Applications — discovered SaaS per tenant
// ---------------------------------------------------------------------------

export const saasApplications = aegisSchema.table("saas_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  category: varchar("category", { length: 100 }),
  classification: varchar("classification", { length: 20 }).default("unclassified"),
  riskScore: integer("risk_score").default(50),
  visitCount: integer("visit_count").default(0),
  notes: text("notes"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("saas_applications_tenant_domain_idx").on(table.tenantId, table.domain),
  index("saas_applications_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Scan Results — external posture scans
// ---------------------------------------------------------------------------

export const scanResults = aegisSchema.table("scan_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  scanType: varchar("scan_type", { length: 50 }).notNull(),
  target: text("target").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  score: numeric("score"),
  findings: jsonb("findings"),
  summary: jsonb("summary"),
  metadata: jsonb("metadata"),
  prospectEmail: text("prospect_email"),
  prospectName: text("prospect_name"),
  prospectCompany: text("prospect_company"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("scan_results_tenant_id_idx").on(table.tenantId),
  index("scan_results_status_idx").on(table.status),
]);

// ---------------------------------------------------------------------------
// Adjusted Scores — Cavaridge Adjusted Score snapshots
// ---------------------------------------------------------------------------

export const adjustedScores = aegisSchema.table("adjusted_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  clientTenantId: uuid("client_tenant_id"),
  microsoftSecureScoreRaw: numeric("microsoft_secure_score_raw"),
  microsoftSecureScoreWeighted: numeric("microsoft_secure_score_weighted"),
  browserSecurityRaw: numeric("browser_security_raw"),
  browserSecurityWeighted: numeric("browser_security_weighted"),
  googleWorkspaceRaw: numeric("google_workspace_raw"),
  googleWorkspaceWeighted: numeric("google_workspace_weighted"),
  credentialHygieneRaw: numeric("credential_hygiene_raw"),
  credentialHygieneWeighted: numeric("credential_hygiene_weighted"),
  dnsFilteringRaw: numeric("dns_filtering_raw"),
  dnsFilteringWeighted: numeric("dns_filtering_weighted"),
  sassShadowItRaw: numeric("saas_shadow_it_raw"),
  sassShadowItWeighted: numeric("saas_shadow_it_weighted"),
  compensatingControlsBonus: numeric("compensating_controls_bonus"),
  compensatingControls: jsonb("compensating_controls").default([]),
  totalScore: numeric("total_score").notNull(),
  weightConfig: jsonb("weight_config"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("adjusted_scores_tenant_id_idx").on(table.tenantId),
  index("adjusted_scores_client_tenant_id_idx").on(table.clientTenantId),
]);

// ---------------------------------------------------------------------------
// Score History — time-series for trending
// ---------------------------------------------------------------------------

export const scoreHistory = aegisSchema.table("score_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  clientTenantId: uuid("client_tenant_id"),
  totalScore: numeric("total_score").notNull(),
  breakdown: jsonb("breakdown"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("score_history_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Compensating Controls — per-tenant configurable controls catalog
// ---------------------------------------------------------------------------

export const compensatingControls = aegisSchema.table("compensating_controls", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  controlType: varchar("control_type", { length: 100 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  vendor: text("vendor"),
  signalSource: varchar("signal_source", { length: 100 }),
  detectionMethod: varchar("detection_method", { length: 50 }).default("manual"),
  isDetected: boolean("is_detected").default(false),
  detectedAt: timestamp("detected_at", { withTimezone: true }),
  bonusPoints: numeric("bonus_points").default("0"),
  maxBonus: numeric("max_bonus").default("5"),
  flagSuppressions: jsonb("flag_suppressions").default([]),
  metadata: jsonb("metadata").default({}),
  enabled: boolean("enabled").default(true),
  overriddenBy: uuid("overridden_by"),
  overriddenAt: timestamp("overridden_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("compensating_controls_tenant_id_idx").on(table.tenantId),
  uniqueIndex("compensating_controls_tenant_type_idx").on(table.tenantId, table.controlType),
]);

// ---------------------------------------------------------------------------
// ConnectSecure Scans — ingested vulnerability scan data
// ---------------------------------------------------------------------------

export const connectSecureScans = aegisSchema.table("connectsecure_scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  externalScanId: varchar("external_scan_id", { length: 255 }),
  scanType: varchar("scan_type", { length: 50 }).notNull(),
  target: text("target"),
  status: varchar("status", { length: 20 }).default("pending"),
  vulnerabilities: jsonb("vulnerabilities").default([]),
  complianceResults: jsonb("compliance_results").default([]),
  riskScore: numeric("risk_score"),
  summary: jsonb("summary"),
  rawData: jsonb("raw_data"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("connectsecure_scans_tenant_id_idx").on(table.tenantId),
  index("connectsecure_scans_external_id_idx").on(table.externalScanId),
]);

// ---------------------------------------------------------------------------
// IAR Reviews — Identity Access Review records
// ---------------------------------------------------------------------------

export const iarReviews = aegisSchema.table("iar_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  tier: varchar("tier", { length: 20 }).notNull().default("freemium"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  inputSource: varchar("input_source", { length: 50 }).notNull().default("csv_upload"),
  userCount: integer("user_count").default(0),
  flagCount: integer("flag_count").default(0),
  highSeverityCount: integer("high_severity_count").default(0),
  mediumSeverityCount: integer("medium_severity_count").default(0),
  lowSeverityCount: integer("low_severity_count").default(0),
  findings: jsonb("findings").default([]),
  executiveSummary: text("executive_summary"),
  contextualAdjustments: jsonb("contextual_adjustments"),
  prospectEmail: text("prospect_email"),
  prospectName: text("prospect_name"),
  prospectCompany: text("prospect_company"),
  metadata: jsonb("metadata").default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("iar_reviews_tenant_id_idx").on(table.tenantId),
  index("iar_reviews_tier_idx").on(table.tier),
]);

// ---------------------------------------------------------------------------
// IAR Flags — individual risk flags per review
// ---------------------------------------------------------------------------

export const iarFlags = aegisSchema.table("iar_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").notNull(),
  tenantId: uuid("tenant_id"),
  userPrincipalName: text("user_principal_name").notNull(),
  displayName: text("display_name"),
  flagType: varchar("flag_type", { length: 100 }).notNull(),
  baseSeverity: varchar("base_severity", { length: 20 }).notNull(),
  adjustedSeverity: varchar("adjusted_severity", { length: 20 }),
  adjustmentReason: text("adjustment_reason"),
  isSuppressed: boolean("is_suppressed").default(false),
  suppressionReason: text("suppression_reason"),
  detail: text("detail"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("iar_flags_review_id_idx").on(table.reviewId),
  index("iar_flags_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// IAR Historical Deltas — diff between reviews (full tier)
// ---------------------------------------------------------------------------

export const iarDeltas = aegisSchema.table("iar_deltas", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  currentReviewId: uuid("current_review_id").notNull(),
  previousReviewId: uuid("previous_review_id").notNull(),
  newFlags: jsonb("new_flags").default([]),
  resolvedFlags: jsonb("resolved_flags").default([]),
  changedFlags: jsonb("changed_flags").default([]),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("iar_deltas_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// AEGIS Probes — Raspberry Pi appliance registration
// ---------------------------------------------------------------------------

export const probes = aegisSchema.table("probes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  serialNumber: varchar("serial_number", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("registered"),
  firmwareVersion: text("firmware_version"),
  ipAddress: text("ip_address"),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  networkSegment: text("network_segment"),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("probes_tenant_id_idx").on(table.tenantId),
  uniqueIndex("probes_serial_number_idx").on(table.serialNumber),
]);

// ---------------------------------------------------------------------------
// Probe Scan Results
// ---------------------------------------------------------------------------

export const probeScanResults = aegisSchema.table("probe_scan_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  probeId: uuid("probe_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  scanType: varchar("scan_type", { length: 50 }).notNull(),
  target: text("target"),
  status: varchar("status", { length: 20 }).default("pending"),
  findings: jsonb("findings").default([]),
  discoveredAssets: jsonb("discovered_assets").default([]),
  summary: jsonb("summary"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("probe_scan_results_probe_id_idx").on(table.probeId),
  index("probe_scan_results_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Pen Test Engagements — Tier 1 (Nuclei) and Tier 2 (NodeZero)
// ---------------------------------------------------------------------------

export const pentestEngagements = aegisSchema.table("pentest_engagements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  clientTenantId: uuid("client_tenant_id"),
  tier: varchar("tier", { length: 10 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending_authorization"),
  target: text("target").notNull(),
  scope: jsonb("scope").default({}),
  authorizationDocUrl: text("authorization_doc_url"),
  authorizedBy: uuid("authorized_by"),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  findings: jsonb("findings").default([]),
  summary: jsonb("summary"),
  reportUrl: text("report_url"),
  nucleiTemplates: jsonb("nuclei_templates"),
  nodezeroConfig: jsonb("nodezero_config"),
  metadata: jsonb("metadata").default({}),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("pentest_engagements_tenant_id_idx").on(table.tenantId),
  index("pentest_engagements_status_idx").on(table.status),
]);

// ---------------------------------------------------------------------------
// Tenant Profiles — business context for IAR Contextual Intelligence Engine
// ---------------------------------------------------------------------------

export const tenantProfiles = aegisSchema.table("tenant_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().unique(),
  industryVertical: varchar("industry_vertical", { length: 100 }),
  isMAActive: boolean("is_ma_active").default(false),
  isMultiSite: boolean("is_multi_site").default(false),
  isContractorHeavy: boolean("is_contractor_heavy").default(false),
  vendorDensity: varchar("vendor_density", { length: 20 }).default("normal"),
  employeeCount: integer("employee_count"),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("tenant_profiles_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type EnrollmentToken = typeof enrollmentTokens.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type TelemetryEvent = typeof telemetryEvents.$inferSelect;
export type SaasApplication = typeof saasApplications.$inferSelect;
export type ScanResult = typeof scanResults.$inferSelect;
export type AdjustedScore = typeof adjustedScores.$inferSelect;
export type ScoreHistoryEntry = typeof scoreHistory.$inferSelect;
export type CompensatingControl = typeof compensatingControls.$inferSelect;
export type ConnectSecureScan = typeof connectSecureScans.$inferSelect;
export type IarReview = typeof iarReviews.$inferSelect;
export type IarFlag = typeof iarFlags.$inferSelect;
export type IarDelta = typeof iarDeltas.$inferSelect;
export type Probe = typeof probes.$inferSelect;
export type ProbeScanResult = typeof probeScanResults.$inferSelect;
export type PentestEngagement = typeof pentestEngagements.$inferSelect;
export type TenantProfile = typeof tenantProfiles.$inferSelect;
