import { pgTable, text, varchar, timestamp, boolean, uuid } from "drizzle-orm/pg-core";

// Profiles — linked 1:1 to Supabase auth.users
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id (NOT auto-generated)
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

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

// Backward-compatible aliases
export const users = profiles;
export type User = Profile;
