import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const migrationPlans = pgTable("migration_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  destination: text("destination").notNull(),
  resources: text("resources").array().notNull(),
  timelineEstimate: text("timeline_estimate").notNull(),
  downtimeEstimate: text("downtime_estimate").notNull(),
  complexity: text("complexity").notNull(),
  riskLevel: text("risk_level").notNull(),
  steps: jsonb("steps").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMigrationPlanSchema = createInsertSchema(migrationPlans).omit({
  id: true,
  createdAt: true,
  timelineEstimate: true,
  downtimeEstimate: true,
  complexity: true,
  riskLevel: true,
  steps: true,
});

export type InsertMigrationPlan = z.infer<typeof insertMigrationPlanSchema>;
export type MigrationPlan = typeof migrationPlans.$inferSelect;