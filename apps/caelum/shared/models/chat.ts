import { pgTable, serial, integer, text, timestamp, jsonb, boolean, uuid, index, primaryKey, pgEnum } from "drizzle-orm/pg-core";
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

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  sowJson: jsonb("sow_json"),
  flagged: boolean("flagged").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("conversations_tenant_id_idx").on(table.tenantId),
]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("messages_tenant_id_idx").on(table.tenantId),
]);

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const sowVersions = pgTable("sow_versions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  version: integer("version").notNull(),
  sowJson: jsonb("sow_json").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("sow_versions_tenant_id_idx").on(table.tenantId),
]);

export const insertSowVersionSchema = createInsertSchema(sowVersions).omit({
  id: true,
  createdAt: true,
});

export type SowVersion = typeof sowVersions.$inferSelect;
export type InsertSowVersion = z.infer<typeof insertSowVersionSchema>;

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
