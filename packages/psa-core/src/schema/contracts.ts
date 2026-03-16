/**
 * @cavaridge/psa-core — Contract and Invoice schemas
 */
import {
  pgTable, uuid, text, boolean, integer, numeric, date, timestamp, jsonb, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────

export const contractTypeEnum = pgEnum('contract_type', [
  'managed', 'block_hours', 'time_and_materials', 'project', 'retainer',
]);

export const contractStatusEnum = pgEnum('contract_status', [
  'draft', 'active', 'expiring', 'expired', 'cancelled',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft', 'approved', 'sent', 'paid', 'overdue', 'void',
]);

export const invoiceLineSourceTypeEnum = pgEnum('invoice_line_source_type', [
  'contract_recurring', 'time_entry', 'ad_hoc', 'expense',
]);

// ─── Contracts ───────────────────────────────────────────────────────

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  clientId: uuid('client_id').notNull(),
  name: text('name').notNull(),
  contractNumber: text('contract_number'),
  type: contractTypeEnum('type').notNull(),
  status: contractStatusEnum('status').notNull().default('draft'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  monthlyAmount: numeric('monthly_amount', { precision: 10, scale: 2 }),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  blockHoursTotal: integer('block_hours_total'),
  blockHoursUsed: integer('block_hours_used').default(0),
  blockHoursRollover: boolean('block_hours_rollover').default(false),
  slaPolicyId: uuid('sla_policy_id'),
  autoRenew: boolean('auto_renew').default(true),
  renewalTermMonths: integer('renewal_term_months').default(12),
  noticePeriodDays: integer('notice_period_days').default(30),
  scopeDescription: text('scope_description'),
  exclusions: text('exclusions'),
  connectorExternalId: text('connector_external_id'),
  customFields: jsonb('custom_fields').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Invoices ────────────────────────────────────────────────────────

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  clientId: uuid('client_id').notNull(),
  invoiceNumber: text('invoice_number'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  dueDate: date('due_date').notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).default('0'),
  taxAmount: numeric('tax_amount', { precision: 10, scale: 2 }).default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
  paidAmount: numeric('paid_amount', { precision: 10, scale: 2 }).default('0'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  externalId: text('external_id'),
  externalSystem: text('external_system'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  tenantId: uuid('tenant_id').notNull(),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  sourceType: invoiceLineSourceTypeEnum('source_type').notNull(),
  sourceId: uuid('source_id'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────

export const invoicesRelations = relations(invoices, ({ many }) => ({
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
}));
