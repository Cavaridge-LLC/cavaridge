/**
 * @cavaridge/psa-core — Ticket schema (Drizzle ORM)
 *
 * Defines tickets, ticket_comments, and ticket_tags tables.
 * All tables enforce tenant_id for Supabase RLS.
 */
import {
  pgTable, uuid, text, boolean, real, timestamp, jsonb, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────

export const ticketStatusEnum = pgEnum('ticket_status', [
  'new', 'open', 'pending', 'on_hold', 'resolved', 'closed', 'cancelled',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'critical', 'high', 'medium', 'low',
]);

export const ticketSourceEnum = pgEnum('ticket_source', [
  'manual', 'email', 'portal', 'phone', 'chat', 'connector', 'alert',
]);

export const commentSourceEnum = pgEnum('comment_source', [
  'manual', 'email', 'portal', 'ai', 'connector',
]);

// ─── Tables ──────────────────────────────────────────────────────────

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  clientId: uuid('client_id').notNull(),
  siteId: uuid('site_id'),
  ticketNumber: text('ticket_number').notNull(),
  subject: text('subject').notNull(),
  description: text('description'),
  status: ticketStatusEnum('status').notNull().default('new'),
  priority: ticketPriorityEnum('priority').notNull().default('medium'),
  category: text('category'),
  subcategory: text('subcategory'),
  source: ticketSourceEnum('source').notNull().default('manual'),
  assignedTo: uuid('assigned_to'),
  requestedBy: uuid('requested_by'),
  slaPolicyId: uuid('sla_policy_id'),
  slaResponseDue: timestamp('sla_response_due', { withTimezone: true }),
  slaResolutionDue: timestamp('sla_resolution_due', { withTimezone: true }),
  slaRespondedAt: timestamp('sla_responded_at', { withTimezone: true }),
  slaResolvedAt: timestamp('sla_resolved_at', { withTimezone: true }),
  slaResponseBreached: boolean('sla_response_breached').default(false),
  slaResolutionBreached: boolean('sla_resolution_breached').default(false),
  contractId: uuid('contract_id'),
  connectorSource: text('connector_source'),
  connectorExternalId: text('connector_external_id'),
  aiCategoryConfidence: real('ai_category_confidence'),
  aiPriorityScore: real('ai_priority_score'),
  aiSuggestedResolution: text('ai_suggested_resolution'),
  aiSimilarTicketIds: uuid('ai_similar_ticket_ids').array(),
  customFields: jsonb('custom_fields').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const ticketComments = pgTable('ticket_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id),
  tenantId: uuid('tenant_id').notNull(),
  authorId: uuid('author_id').notNull(),
  body: text('body').notNull(),
  isInternal: boolean('is_internal').default(false),
  isResolution: boolean('is_resolution').default(false),
  source: commentSourceEnum('source').default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ticketTags = pgTable('ticket_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id),
  tenantId: uuid('tenant_id').notNull(),
  tag: text('tag').notNull(),
});

// ─── Relations ───────────────────────────────────────────────────────

export const ticketsRelations = relations(tickets, ({ many }) => ({
  comments: many(ticketComments),
  tags: many(ticketTags),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketComments.ticketId], references: [tickets.id] }),
}));

export const ticketTagsRelations = relations(ticketTags, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketTags.ticketId], references: [tickets.id] }),
}));
