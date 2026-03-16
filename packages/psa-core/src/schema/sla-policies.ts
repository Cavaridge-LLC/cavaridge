/**
 * @cavaridge/psa-core — SLA, Business Hours, and Service Catalog schemas
 */
import {
  pgTable, uuid, text, boolean, integer, timestamp, jsonb,
} from 'drizzle-orm/pg-core';

// ─── SLA Policies ────────────────────────────────────────────────────

export const slaPolicies = pgTable('sla_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  responseTargetCritical: integer('response_target_critical').notNull(),
  responseTargetHigh: integer('response_target_high').notNull(),
  responseTargetMedium: integer('response_target_medium').notNull(),
  responseTargetLow: integer('response_target_low').notNull(),
  resolutionTargetCritical: integer('resolution_target_critical').notNull(),
  resolutionTargetHigh: integer('resolution_target_high').notNull(),
  resolutionTargetMedium: integer('resolution_target_medium').notNull(),
  resolutionTargetLow: integer('resolution_target_low').notNull(),
  businessHoursId: uuid('business_hours_id'),
  escalationRules: jsonb('escalation_rules').default('[]'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Business Hours ──────────────────────────────────────────────────

export const businessHours = pgTable('business_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  schedule: jsonb('schedule').notNull(),
  holidays: jsonb('holidays').default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Service Catalog ─────────────────────────────────────────────────

export const serviceCatalogItems = pgTable('service_catalog_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  defaultPriority: text('default_priority').default('medium'),
  defaultSlaPolicyId: uuid('default_sla_policy_id'),
  estimatedMinutes: integer('estimated_minutes'),
  requiresApproval: boolean('requires_approval').default(false),
  visibleInPortal: boolean('visible_in_portal').default(true),
  formSchema: jsonb('form_schema').default('{}'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
