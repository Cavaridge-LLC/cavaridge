import { pgTable, uuid } from "drizzle-orm/pg-core";

// Minimal shared-schema references for FK targets.
// Full definitions live in @cavaridge/auth (packages/auth).

export const tenants = pgTable("tenants", { id: uuid("id").primaryKey() });

// Minimal user reference for FKs (maps to public.profiles)
export const users = pgTable("profiles", { id: uuid("id").primaryKey() });
export type User = typeof users.$inferSelect;

// Backward-compatible alias
export const profiles = users;
export type Profile = User;
