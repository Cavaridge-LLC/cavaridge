import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  industry: text("industry"),
  headcount: integer("headcount"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const initiatives = pgTable("initiatives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  team: text("team").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  quarter: text("quarter").notNull(),
  cost: text("cost"),
  businessProblem: text("business_problem"),
  serviceArea: text("service_area"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertInitiativeSchema = createInsertSchema(initiatives).omit({ id: true });
export type InsertInitiative = z.infer<typeof insertInitiativeSchema>;
export type Initiative = typeof initiatives.$inferSelect;

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  clientName: text("client_name").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  state: text("state").notNull().default("Draft"),
  dateLabel: text("date_label").notNull(),
  attendees: text("attendees").array().notNull().default(sql`'{}'::text[]`),
  agenda: text("agenda").notNull().default(""),
  notes: text("notes").notNull().default(""),
  executiveSummary: text("executive_summary"),
  nextSteps: text("next_steps").array().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

export const snapshots = pgTable("snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  engagementScore: integer("engagement_score").notNull().default(0),
  goalsAligned: integer("goals_aligned").notNull().default(0),
  riskLevel: text("risk_level").notNull().default("Low"),
  budgetTotal: integer("budget_total").notNull().default(0),
  adoptionPercent: integer("adoption_percent").notNull().default(0),
  roiStatus: text("roi_status").notNull().default("On track"),
});

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({ id: true });
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type Snapshot = typeof snapshots.$inferSelect;
