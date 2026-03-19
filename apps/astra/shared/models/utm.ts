import { pgTable, uuid } from "drizzle-orm/pg-core";

// Minimal shared-schema reference for FK targets.
// Full tenants definition lives in @cavaridge/auth (packages/auth).

export const tenants = pgTable("tenants", { id: uuid("id").primaryKey() });
export type Tenant = typeof tenants.$inferSelect;
