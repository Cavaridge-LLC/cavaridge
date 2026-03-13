// @cavaridge/auth/schema — Canonical auth table definitions
//
// Every app imports these tables for consistent auth schema.
// The `profiles` table is linked 1:1 to Supabase's `auth.users`.

import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/** Organizations (tenants) — every app is multi-tenant */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerUserId: uuid("owner_user_id"),
  planTier: varchar("plan_tier", { length: 50 }).default("starter"),
  maxUsers: integer("max_users").default(5),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Profiles — linked 1:1 to Supabase auth.users.
 * The `id` column matches `auth.users.id` (set on insert, NOT auto-generated).
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  isPlatformUser: boolean("is_platform_user").default(false),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Audit log — tracks auth and security-relevant events */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Inferred types for use in app code */
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
