// Re-export canonical auth tables from @cavaridge/auth
export { profiles, tenants, organizations } from "@cavaridge/auth/schema";
export type { Profile, Tenant, Organization } from "@cavaridge/auth/schema";

// Backward-compatible aliases
export { profiles as users } from "@cavaridge/auth/schema";
export type { Profile as User } from "@cavaridge/auth/schema";

// UTM RBAC tables — defined here so they're available via @shared/schema
import {
  pgTable, uuid, text, jsonb, index,
} from "drizzle-orm/pg-core";
import { profiles as _profiles } from "@cavaridge/auth/schema";

export const userTenants = pgTable("user_tenants", {
  userId: text("user_id").notNull().references(() => _profiles.id),
  tenantId: uuid("tenant_id").notNull(),
}, (table) => [
  index("astra_user_tenants_user_id_idx").on(table.userId),
  index("astra_user_tenants_tenant_id_idx").on(table.tenantId),
]);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").unique().notNull(),
  permissions: jsonb("permissions").notNull(),
});

export const userRoles = pgTable("user_roles", {
  userId: text("user_id").notNull().references(() => _profiles.id),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  tenantId: uuid("tenant_id").notNull(),
}, (table) => [
  index("astra_user_roles_user_tenant_idx").on(table.userId, table.tenantId),
]);
