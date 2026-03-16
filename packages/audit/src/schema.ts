/**
 * Canonical audit_log table — single source of truth.
 *
 * Replaces duplicates in:
 *   - packages/auth/src/schema.ts
 *   - apps/ducky/shared/schema.ts
 *
 * New columns vs. originals: app_code, correlation_id.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details_json").default({}),
  ipAddress: text("ip_address"),
  /** Originating app (e.g. "ducky", "meridian") */
  appCode: varchar("app_code", { length: 50 }),
  /** Request-level correlation ID for tracing */
  correlationId: uuid("correlation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("audit_log_org_idx").on(table.organizationId),
  index("audit_log_user_idx").on(table.userId),
  index("audit_log_action_idx").on(table.action),
  index("audit_log_correlation_idx").on(table.correlationId),
]);

export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
