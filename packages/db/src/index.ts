// @cavaridge/db — Supabase client + Drizzle ORM shared utilities
//
// Every table must include tenant_id for isolation.
// RLS policies enforced in Supabase — Drizzle handles the ORM layer.
//
// Usage in apps:
//   import { createDb, baseColumns } from "@cavaridge/db";
//   import { tenantSchema } from "@cavaridge/db/schema";

import { pgTable, uuid, timestamp, text } from "drizzle-orm/pg-core";

/** Base columns included on every table */
export const baseColumns = {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

/** Tenants table — exists in every Supabase project */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
