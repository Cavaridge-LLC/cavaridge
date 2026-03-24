// @cavaridge/auth/schema — Canonical auth table definitions (UTM spec)
//
// Implements the Universal Tenant Model:
//   - 4-tier tenant hierarchy: platform → msp → client → site/prospect
//   - Self-referencing tenants table with parent_id
//   - tenant_memberships for per-tenant role assignment
//   - 6 standard RBAC roles
//
// Every app imports these tables for consistent auth schema.
// The `profiles` table is linked 1:1 to Supabase's `auth.users`.

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const tenantTypeEnum = pgEnum("tenant_type", [
  "platform",
  "msp",
  "client",
  "site",
  "prospect",
]);

export const roleEnum = pgEnum("role", [
  "platform_admin",
  "msp_admin",
  "msp_tech",
  "client_admin",
  "client_viewer",
  "prospect",
]);

// ---------------------------------------------------------------------------
// Tenants — 4-tier hierarchy
// ---------------------------------------------------------------------------

/**
 * Tenants — canonical shared tenant table (public.tenants).
 * All app-domain tables FK to this via `tenant_id`.
 * 4-tier hierarchy: platform → msp → client → site/prospect.
 * Self-referencing via `parent_id`.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  type: tenantTypeEnum("type").notNull().default("msp"),
  parentId: uuid("parent_id"),
  ownerUserId: uuid("owner_user_id"),
  planTier: varchar("plan_tier", { length: 50 }).default("starter"),
  maxUsers: integer("max_users").default(5),
  isActive: boolean("is_active").default(true),
  status: varchar("status", { length: 20 }).default("active"),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("tenants_parent_id_idx").on(table.parentId),
  index("tenants_type_idx").on(table.type),
]);

// ---------------------------------------------------------------------------
// Profiles — linked 1:1 to Supabase auth.users
// ---------------------------------------------------------------------------

/**
 * Profiles — linked 1:1 to Supabase auth.users.
 * The `id` column matches `auth.users.id` (set on insert, NOT auto-generated).
 * `tenantId` stores the user's primary tenant UUID.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: roleEnum("role").notNull().default("client_viewer"),
  tenantId: uuid("tenant_id"),
  isPlatformUser: boolean("is_platform_user").default(false),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("profiles_tenant_id_idx").on(table.tenantId),
  index("profiles_email_idx").on(table.email),
]);

// ---------------------------------------------------------------------------
// Tenant Memberships — per-tenant role assignment
// ---------------------------------------------------------------------------

/**
 * Tenant memberships — maps users to tenants with a specific role.
 * Enables users to have different roles in different tenants.
 * MSP Admin in their MSP tenant, but also viewable in child client tenants.
 */
export const tenantMemberships = pgTable("tenant_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  role: roleEnum("role").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("tenant_memberships_user_tenant_idx").on(table.userId, table.tenantId),
  index("tenant_memberships_tenant_id_idx").on(table.tenantId),
  index("tenant_memberships_user_id_idx").on(table.userId),
]);

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

/**
 * Invites — tracks pending, accepted, and expired invitations.
 * Used by admins to invite users to specific tenants with pre-assigned roles.
 */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tenantId: uuid("tenant_id"),
  role: roleEnum("role").notNull().default("client_viewer"),
  invitedBy: uuid("invited_by"),
  token: text("token").notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("invites_email_idx").on(table.email),
  index("invites_tenant_id_idx").on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Audit log — canonical definition in @cavaridge/audit
// ---------------------------------------------------------------------------

export { auditLog } from "@cavaridge/audit/schema";
export type { AuditEntry as AuditLogEntry } from "@cavaridge/audit/schema";

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;

/** User is an alias for Profile — the canonical user type across all apps. */
export type User = Profile;
