import { sql } from "drizzle-orm";
import { pgTable, pgSchema, text, varchar, integer, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared auth tables from @cavaridge/auth (canonical source)
// ---------------------------------------------------------------------------

import {
  tenants as _tenants,
  profiles as _profiles,
  tenantMemberships as _tenantMemberships,
} from "@cavaridge/auth/schema";
import type {
  Tenant as _Tenant,
  NewTenant,
  Profile as _Profile,
  NewProfile,
} from "@cavaridge/auth/schema";

export const tenants = _tenants;
export const profiles = _profiles;
export const tenantMemberships = _tenantMemberships;
export type Tenant = _Tenant;
export type InsertTenant = NewTenant;
export type Profile = _Profile;
export type InsertProfile = NewProfile;

export const users = profiles;
export type User = Profile;
export type InsertUser = InsertProfile;

// ---------------------------------------------------------------------------
// Vespar App Schema — all app-specific tables live here
// ---------------------------------------------------------------------------

export const vesparSchema = pgSchema("vespar");

// ---------------------------------------------------------------------------
// Type Unions
// ---------------------------------------------------------------------------

export type ProjectStatus = "draft" | "assessment" | "planning" | "approved" | "in-progress" | "completed" | "archived";
export type EnvironmentType = "on-prem" | "aws" | "azure" | "gcp" | "other";
export type WorkloadType = "server" | "database" | "application" | "storage" | "network" | "identity" | "other";
export type MigrationStrategy = "rehost" | "replatform" | "refactor" | "repurchase" | "retire" | "retain";
export type Criticality = "critical" | "high" | "medium" | "low";
export type DependencyType = "hard" | "soft" | "data" | "network";
export type RiskCategory = "technical" | "operational" | "financial" | "compliance" | "organizational";
export type RiskStatus = "open" | "mitigated" | "accepted" | "closed";
export type RunbookStatus = "draft" | "reviewed" | "approved";
export type WorkloadStatus = "discovered" | "assessed" | "planned" | "migrating" | "validated" | "completed";
export type UserRole = "platform_admin" | "msp_admin" | "msp_tech" | "client_admin" | "client_viewer" | "prospect";

// ---------------------------------------------------------------------------
// Migration Projects
// ---------------------------------------------------------------------------

export const migrationProjects = vesparSchema.table("migration_projects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sourceEnvironment: text("source_environment").notNull(), // EnvironmentType
  targetEnvironment: text("target_environment").notNull(), // EnvironmentType
  status: text("status").notNull().default("draft"), // ProjectStatus
  readinessScore: integer("readiness_score"), // 0-100
  createdBy: varchar("created_by", { length: 36 }).references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMigrationProjectSchema = createInsertSchema(migrationProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  readinessScore: true,
});

export type MigrationProject = typeof migrationProjects.$inferSelect;
export type InsertMigrationProject = z.infer<typeof insertMigrationProjectSchema>;

// ---------------------------------------------------------------------------
// Workloads
// ---------------------------------------------------------------------------

export const workloads = vesparSchema.table("workloads", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).references(() => migrationProjects.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // WorkloadType
  environmentDetails: jsonb("environment_details").$type<Record<string, unknown>>(),
  currentHosting: text("current_hosting"),
  criticality: text("criticality").notNull().default("medium"), // Criticality
  migrationStrategy: text("migration_strategy"), // MigrationStrategy
  status: text("status").notNull().default("discovered"), // WorkloadStatus
  estimatedEffortHours: integer("estimated_effort_hours"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkloadSchema = createInsertSchema(workloads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Workload = typeof workloads.$inferSelect;
export type InsertWorkload = z.infer<typeof insertWorkloadSchema>;

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export const dependencies = vesparSchema.table("dependencies", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).references(() => migrationProjects.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  sourceWorkloadId: varchar("source_workload_id", { length: 36 }).references(() => workloads.id).notNull(),
  targetWorkloadId: varchar("target_workload_id", { length: 36 }).references(() => workloads.id).notNull(),
  dependencyType: text("dependency_type").notNull(), // DependencyType
  description: text("description"),
  blocksMigration: boolean("blocks_migration").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("dep_source_target_idx").on(table.sourceWorkloadId, table.targetWorkloadId),
]);

export const insertDependencySchema = createInsertSchema(dependencies).omit({
  id: true,
  createdAt: true,
});

export type Dependency = typeof dependencies.$inferSelect;
export type InsertDependency = z.infer<typeof insertDependencySchema>;

// ---------------------------------------------------------------------------
// Risk Findings
// ---------------------------------------------------------------------------

export const riskFindings = vesparSchema.table("risk_findings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).references(() => migrationProjects.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  workloadId: varchar("workload_id", { length: 36 }).references(() => workloads.id),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(), // Criticality
  category: text("category").notNull(), // RiskCategory
  mitigation: text("mitigation"),
  status: text("status").notNull().default("open"), // RiskStatus
  riskScore: integer("risk_score"), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRiskFindingSchema = createInsertSchema(riskFindings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RiskFinding = typeof riskFindings.$inferSelect;
export type InsertRiskFinding = z.infer<typeof insertRiskFindingSchema>;

// ---------------------------------------------------------------------------
// Cost Projections
// ---------------------------------------------------------------------------

export const costProjections = vesparSchema.table("cost_projections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).references(() => migrationProjects.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  workloadId: varchar("workload_id", { length: 36 }).references(() => workloads.id),
  currentMonthlyCost: text("current_monthly_cost"),
  projectedMonthlyCost: text("projected_monthly_cost"),
  migrationCostOnetime: text("migration_cost_onetime"),
  savingsMonthly: text("savings_monthly"),
  savingsAnnual: text("savings_annual"),
  assumptions: jsonb("assumptions").$type<Record<string, unknown>>(),
  costBreakdown: jsonb("cost_breakdown").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCostProjectionSchema = createInsertSchema(costProjections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CostProjection = typeof costProjections.$inferSelect;
export type InsertCostProjection = z.infer<typeof insertCostProjectionSchema>;

// ---------------------------------------------------------------------------
// Runbooks
// ---------------------------------------------------------------------------

export const runbooks = vesparSchema.table("runbooks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).references(() => migrationProjects.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  title: text("title").notNull(),
  content: text("content"), // markdown
  generatedBy: text("generated_by").notNull().default("manual"), // "manual" | "agent"
  status: text("status").notNull().default("draft"), // RunbookStatus
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRunbookSchema = createInsertSchema(runbooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});

export type Runbook = typeof runbooks.$inferSelect;
export type InsertRunbook = z.infer<typeof insertRunbookSchema>;

// ---------------------------------------------------------------------------
// Zod validation schemas for API input
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceEnvironment: z.enum(["on-prem", "aws", "azure", "gcp", "other"]),
  targetEnvironment: z.enum(["on-prem", "aws", "azure", "gcp", "other"]),
});

export const createWorkloadSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["server", "database", "application", "storage", "network", "identity", "other"]),
  environmentDetails: z.record(z.unknown()).optional(),
  currentHosting: z.string().max(200).optional(),
  criticality: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  migrationStrategy: z.enum(["rehost", "replatform", "refactor", "repurchase", "retire", "retain"]).optional(),
  estimatedEffortHours: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional(),
});

export const createDependencySchema = z.object({
  sourceWorkloadId: z.string().min(1),
  targetWorkloadId: z.string().min(1),
  dependencyType: z.enum(["hard", "soft", "data", "network"]),
  description: z.string().max(1000).optional(),
  blocksMigration: z.boolean().default(false),
});

export const createRiskFindingSchema = z.object({
  workloadId: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum(["technical", "operational", "financial", "compliance", "organizational"]),
  mitigation: z.string().max(5000).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
});

export const createCostProjectionSchema = z.object({
  workloadId: z.string().optional(),
  currentMonthlyCost: z.string().optional(),
  projectedMonthlyCost: z.string().optional(),
  migrationCostOnetime: z.string().optional(),
  savingsMonthly: z.string().optional(),
  savingsAnnual: z.string().optional(),
  assumptions: z.record(z.unknown()).optional(),
  costBreakdown: z.record(z.unknown()).optional(),
});

export const createRunbookSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  generatedBy: z.enum(["manual", "agent"]).default("manual"),
});

export function isPlatformRole(role: string): boolean {
  return role === "platform_admin";
}
