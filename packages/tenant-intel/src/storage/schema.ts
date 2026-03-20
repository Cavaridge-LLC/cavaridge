/**
 * @cavaridge/tenant-intel — Drizzle ORM Schema
 *
 * All tables are tenant-scoped with RLS enforcement.
 * Table names prefixed with "ti_" to avoid collisions in shared DB.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "@cavaridge/auth/schema";

// ── Tenant Snapshots ────────────────────────────────────────────────

export const tenantSnapshots = pgTable(
  "ti_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceVendor: varchar("source_vendor", { length: 20 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    trigger: varchar("trigger", { length: 20 }).notNull().default("manual"),
    userCount: integer("user_count").notNull().default(0),
    licensedUserCount: integer("licensed_user_count").notNull().default(0),
    licenseCount: integer("license_count").notNull().default(0),
    securityScore: real("security_score"),
    securityScoreMax: real("security_score_max"),
    deviceCount: integer("device_count").notNull().default(0),
    managedDeviceCount: integer("managed_device_count").notNull().default(0),
    conditionalAccessPolicyCount: integer("ca_policy_count").notNull().default(0),
    domainNames: jsonb("domain_names").notNull().default([]),
    dataHash: varchar("data_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_ti_snapshots_tenant").on(table.tenantId),
    capturedIdx: index("idx_ti_snapshots_captured").on(table.tenantId, table.capturedAt),
  }),
);

// ── User Directory ──────────────────────────────────────────────────

export const userDirectory = pgTable(
  "ti_user_directory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => tenantSnapshots.id, { onDelete: "cascade" }),
    sourceVendor: varchar("source_vendor", { length: 20 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    userPrincipalName: text("user_principal_name"),
    department: text("department"),
    jobTitle: text("job_title"),
    accountEnabled: boolean("account_enabled").notNull().default(true),
    mfaEnabled: boolean("mfa_enabled"),
    mfaMethod: varchar("mfa_method", { length: 50 }),
    isAdmin: boolean("is_admin").notNull().default(false),
    adminRoles: jsonb("admin_roles").default([]),
    lastSignIn: timestamp("last_sign_in", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_ti_users_tenant").on(table.tenantId),
    snapshotIdx: index("idx_ti_users_snapshot").on(table.snapshotId),
    emailIdx: index("idx_ti_users_email").on(table.tenantId, table.email),
    departmentIdx: index("idx_ti_users_department").on(table.tenantId, table.department),
  }),
);

// ── License Assignments ─────────────────────────────────────────────

export const licenseAssignments = pgTable(
  "ti_license_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => tenantSnapshots.id, { onDelete: "cascade" }),
    sourceVendor: varchar("source_vendor", { length: 20 }).notNull(),
    skuId: varchar("sku_id", { length: 255 }).notNull(),
    skuName: text("sku_name").notNull(),
    totalQuantity: integer("total_quantity").notNull().default(0),
    assignedCount: integer("assigned_count").notNull().default(0),
    availableCount: integer("available_count").notNull().default(0),
    utilizationPct: real("utilization_pct").notNull().default(0),
    estimatedMonthlyCost: real("estimated_monthly_cost"),
    serviceUtilization: jsonb("service_utilization").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_ti_licenses_tenant").on(table.tenantId),
    snapshotIdx: index("idx_ti_licenses_snapshot").on(table.snapshotId),
    skuIdx: index("idx_ti_licenses_sku").on(table.tenantId, table.skuId),
  }),
);

// ── Security Scores ─────────────────────────────────────────────────

export const securityScores = pgTable(
  "ti_security_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => tenantSnapshots.id, { onDelete: "cascade" }),
    sourceVendor: varchar("source_vendor", { length: 20 }).notNull(),
    nativeScore: real("native_score").notNull(),
    maxPossibleScore: real("max_possible_score").notNull(),
    scorePct: real("score_pct").notNull(),
    controls: jsonb("controls").notNull().default([]),
    conditionalAccessPolicies: jsonb("conditional_access_policies").default([]),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_ti_security_tenant").on(table.tenantId),
    snapshotIdx: index("idx_ti_security_snapshot").on(table.snapshotId),
    capturedIdx: index("idx_ti_security_captured").on(table.tenantId, table.capturedAt),
  }),
);

// ── Config Snapshots ────────────────────────────────────────────────

export const configSnapshots = pgTable(
  "ti_config_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => tenantSnapshots.id, { onDelete: "cascade" }),
    sourceVendor: varchar("source_vendor", { length: 20 }).notNull(),
    configCategory: varchar("config_category", { length: 100 }).notNull(),
    configKey: varchar("config_key", { length: 255 }).notNull(),
    configValue: jsonb("config_value").notNull(),
    previousValue: jsonb("previous_value"),
    hasChanged: boolean("has_changed").notNull().default(false),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_ti_config_tenant").on(table.tenantId),
    snapshotIdx: index("idx_ti_config_snapshot").on(table.snapshotId),
    categoryIdx: index("idx_ti_config_category").on(table.tenantId, table.configCategory),
    changedIdx: index("idx_ti_config_changed").on(table.tenantId, table.hasChanged),
  }),
);

// ── Managed Devices ─────────────────────────────────────────────────

export const managedDevices = pgTable(
  "ti_managed_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => tenantSnapshots.id, { onDelete: "cascade" }),
    sourceVendor: varchar("source_vendor", { length: 20 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    deviceName: text("device_name").notNull(),
    operatingSystem: varchar("operating_system", { length: 100 }).notNull(),
    osVersion: varchar("os_version", { length: 100 }),
    complianceState: varchar("compliance_state", { length: 20 }).notNull().default("unknown"),
    isManaged: boolean("is_managed").notNull().default(false),
    enrolledDateTime: timestamp("enrolled_date_time", { withTimezone: true }),
    lastSyncDateTime: timestamp("last_sync_date_time", { withTimezone: true }),
    ownerType: varchar("owner_type", { length: 20 }).notNull().default("unknown"),
    userPrincipalName: text("user_principal_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_ti_devices_tenant").on(table.tenantId),
    snapshotIdx: index("idx_ti_devices_snapshot").on(table.snapshotId),
    complianceIdx: index("idx_ti_devices_compliance").on(table.tenantId, table.complianceState),
  }),
);

// ── Ingestion Jobs ──────────────────────────────────────────────────

export const ingestionJobs = pgTable(
  "ti_ingestion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceVendor: varchar("source_vendor", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    trigger: varchar("trigger", { length: 20 }).notNull().default("manual"),
    modules: jsonb("modules").notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    snapshotId: uuid("snapshot_id"),
    error: text("error"),
    moduleResults: jsonb("module_results").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("idx_ti_jobs_tenant").on(table.tenantId),
    statusIdx: index("idx_ti_jobs_status").on(table.status),
  }),
);

// ── Schema export ───────────────────────────────────────────────────

export const tenantIntelTables = {
  tenantSnapshots,
  userDirectory,
  licenseAssignments,
  securityScores,
  configSnapshots,
  managedDevices,
  ingestionJobs,
};
