import { pgTable, text, varchar, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** UTM tenant type enum — mirrors packages/auth/ bootstrap */
export const tenantTypeEnum = pgEnum("tenant_type", [
  "platform",
  "msp",
  "client",
  "site",
  "prospect",
]);

/**
 * Universal Tenant Model — self-referencing hierarchy.
 *
 * Platform → MSP → Client → Site/Prospect
 * Defined centrally in packages/auth/ — this is the Ceres-local reference
 * for Drizzle queries. The actual table is created by the UTM bootstrap migration.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  type: tenantTypeEnum("type").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  settings: text("settings"), // JSONB stored as text for Drizzle compat
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/**
 * User → Tenant mapping. A user belongs to exactly one tenant.
 * Used by tenantScope middleware to resolve req.tenantId from authenticated user.
 */
export const userTenants = pgTable("user_tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserTenant = typeof userTenants.$inferSelect;
export type InsertUserTenant = typeof userTenants.$inferInsert;
