import { pgTable, text, timestamp, uuid, index, primaryKey, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { users } from "./auth";

/** UTM 4-tier tenant type hierarchy: platform > msp > client > site/prospect */
export const tenantTypeEnum = pgEnum("tenant_type", ["platform", "msp", "client", "site", "prospect"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: uuid("parent_id").references((): any => tenants.id),
  type: tenantTypeEnum("type").notNull().default("client"),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  configJson: jsonb("config_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("tenants_parent_id_idx").on(table.parentId),
  index("tenants_type_idx").on(table.type),
]);

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export const userTenants = pgTable("user_tenants", {
  userId: text("user_id").notNull().references(() => users.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
}, (table) => [
  primaryKey({ columns: [table.userId, table.tenantId] }),
]);

export type UserTenant = typeof userTenants.$inferSelect;

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").unique().notNull(),
  permissions: jsonb("permissions").notNull(),
});

export type Role = typeof roles.$inferSelect;

export const userRoles = pgTable("user_roles", {
  userId: text("user_id").notNull().references(() => users.id),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
}, (table) => [
  index("user_roles_user_tenant_idx").on(table.userId, table.tenantId),
]);

export type UserRole = typeof userRoles.$inferSelect;
