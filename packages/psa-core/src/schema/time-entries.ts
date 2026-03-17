/**
 * @cavaridge/psa-core — Time Entry and Dispatch schemas
 */
import {
  pgTable, uuid, text, boolean, integer, numeric, timestamp, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tickets } from './tickets';

// ─── Enums ───────────────────────────────────────────────────────────

export const workTypeEnum = pgEnum('work_type', [
  'reactive', 'proactive', 'project', 'admin', 'travel',
]);

export const dispatchSlotStatusEnum = pgEnum('dispatch_slot_status', [
  'scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled',
]);

// ─── Time Entries ────────────────────────────────────────────────────

export const timeEntries = pgTable('time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  ticketId: uuid('ticket_id').references(() => tickets.id),
  userId: uuid('user_id').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  durationMins: integer('duration_mins'),
  billable: boolean('billable').default(true),
  rateOverride: numeric('rate_override', { precision: 10, scale: 2 }),
  workType: workTypeEnum('work_type').default('reactive'),
  notes: text('notes'),
  approved: boolean('approved').default(false),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  invoiceLineId: uuid('invoice_line_id'),
  connectorExternalId: text('connector_external_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Dispatch Slots ──────────────────────────────────────────────────

export const dispatchSlots = pgTable('dispatch_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id),
  userId: uuid('user_id').notNull(),
  scheduledStart: timestamp('scheduled_start', { withTimezone: true }).notNull(),
  scheduledEnd: timestamp('scheduled_end', { withTimezone: true }).notNull(),
  actualStart: timestamp('actual_start', { withTimezone: true }),
  actualEnd: timestamp('actual_end', { withTimezone: true }),
  status: dispatchSlotStatusEnum('status').default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  ticket: one(tickets, { fields: [timeEntries.ticketId], references: [tickets.id] }),
}));

export const dispatchSlotsRelations = relations(dispatchSlots, ({ one }) => ({
  ticket: one(tickets, { fields: [dispatchSlots.ticketId], references: [tickets.id] }),
}));
