// @cavaridge/auth/schema — Canonical auth table definitions
//
// Every app imports these tables for consistent auth schema.
// The `profiles` table is linked 1:1 to Supabase's `auth.users`.
//
// The shared `tenants` table is the canonical tenant reference for all
// app-domain tables (deals, conversations, etc.). The legacy `organizations`
// export is an alias pointing to the same table.

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

/**
 * Tenants — canonical shared tenant table (public.tenants).
 * All app-domain tables FK to this via `tenant_id`.
 * 4-tier hierarchy: platform → msp → client → site/prospect.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  type: varchar("type", { length: 20 }).notNull().default("msp"),
  parentId: uuid("parent_id"),
  ownerUserId: uuid("owner_user_id"),
  planTier: varchar("plan_tier", { length: 50 }).default("starter"),
  maxUsers: integer("max_users").default(5),
  isActive: boolean("is_active").default(true),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Organizations — legacy alias for the `tenants` table.
 * Kept for backward compatibility with auth middleware.
 *
 * @deprecated Use `tenants` for new code.
 */
export const organizations = tenants;

/**
 * Profiles — linked 1:1 to Supabase auth.users.
 * The `id` column matches `auth.users.id` (set on insert, NOT auto-generated).
 * `organizationId` stores the tenant UUID (DB column is `organization_id`
 * for backward compatibility).
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  organizationId: uuid("organization_id"),
  isPlatformUser: boolean("is_platform_user").default(false),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Invites — tracks pending, accepted, and expired invitations.
 * Used by Platform Admin to invite users to specific tenants with pre-assigned roles.
 */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tenantId: uuid("tenant_id"),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  invitedBy: uuid("invited_by"),
  token: text("token").notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Audit log — canonical definition now lives in @cavaridge/audit */
export { auditLog } from "@cavaridge/audit/schema";
export type { AuditEntry as AuditLogEntry } from "@cavaridge/audit/schema";

/** Inferred types for use in app code */
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
/** @deprecated Use `Tenant` */
export type Organization = Tenant;
/** @deprecated Use `NewTenant` */
export type NewOrganization = NewTenant;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
