/**
 * @cavaridge/psa-core — Billing Engine
 *
 * Generates invoices from contracts and time entries. Manages block hours
 * tracking and contract renewal detection.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, between, sql, lte, gte } from 'drizzle-orm';
import { contracts } from '../schema/contracts';
import { invoices, invoiceLines } from '../schema/contracts';
import { timeEntries } from '../schema/time-entries';
import type { GenerateInvoicesInput, BlockHoursBalance, PsaEvent } from '../types';

type EventEmitter = { emit(event: PsaEvent): void };

export class BillingEngine {
  constructor(
    private db: PostgresJsDatabase<any>,
    private eventBus: EventEmitter,
  ) {}

  /**
   * Generate monthly invoices for all active contracts in a tenant.
   */
  async generateMonthlyInvoices(input: GenerateInvoicesInput) {
    const activeContracts = await this.db
      .select()
      .from(contracts)
      .where(and(
        eq(contracts.tenantId, input.tenantId),
        eq(contracts.status, 'active'),
      ));

    const generatedInvoices = [];

    for (const contract of activeContracts) {
      if (contract.type === 'managed' || contract.type === 'retainer') {
        const invoice = await this.generateRecurringInvoice(contract, input.periodStart, input.periodEnd);
        if (invoice) generatedInvoices.push(invoice);
      }

      if (contract.type === 'time_and_materials') {
        const invoice = await this.generateTimeAndMaterialsInvoice(contract, input.periodStart, input.periodEnd);
        if (invoice) generatedInvoices.push(invoice);
      }
    }

    return generatedInvoices;
  }

  /**
   * Check block hours balance for a contract.
   */
  async checkBlockHoursBalance(contractId: string): Promise<BlockHoursBalance> {
    const [contract] = await this.db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId));

    if (!contract || contract.type !== 'block_hours') {
      throw new Error(`Contract ${contractId} is not a block hours contract`);
    }

    const total = contract.blockHoursTotal ?? 0;
    const used = contract.blockHoursUsed ?? 0;
    const remaining = total - used;
    const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;

    return { contractId, total, used, remaining, percentUsed };
  }

  /**
   * Find contracts expiring within the specified number of days.
   */
  async getExpiringContracts(tenantId: string, daysAhead: number) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.db
      .select()
      .from(contracts)
      .where(and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.status, 'active'),
        lte(contracts.endDate, futureDate.toISOString().split('T')[0]),
        gte(contracts.endDate, new Date().toISOString().split('T')[0]),
      ));
  }

  // ─── Private ─────────────────────────────────────────────────────

  private async generateRecurringInvoice(contract: any, periodStart: Date, periodEnd: Date) {
    if (!contract.monthlyAmount) return null;

    const invoiceNumber = await this.generateInvoiceNumber(contract.tenantId);
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 30); // Net 30

    const [invoice] = await this.db.insert(invoices).values({
      tenantId: contract.tenantId,
      clientId: contract.clientId,
      invoiceNumber,
      status: 'draft',
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      subtotal: contract.monthlyAmount,
      total: contract.monthlyAmount,
    }).returning();

    await this.db.insert(invoiceLines).values({
      invoiceId: invoice.id,
      tenantId: contract.tenantId,
      description: `${contract.name} — Monthly recurring (${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]})`,
      quantity: '1',
      unitPrice: contract.monthlyAmount,
      amount: contract.monthlyAmount,
      sourceType: 'contract_recurring',
      sourceId: contract.id,
    });

    this.eventBus.emit({
      type: 'invoice.generated',
      tenantId: contract.tenantId,
      timestamp: new Date(),
      payload: invoice,
    });

    return invoice;
  }

  private async generateTimeAndMaterialsInvoice(contract: any, periodStart: Date, periodEnd: Date) {
    // Get approved, unbilled time entries for this contract's client
    const entries = await this.db
      .select()
      .from(timeEntries)
      .where(and(
        eq(timeEntries.tenantId, contract.tenantId),
        eq(timeEntries.billable, true),
        eq(timeEntries.approved, true),
        sql`${timeEntries.invoiceLineId} IS NULL`,
        gte(timeEntries.startTime, periodStart),
        lte(timeEntries.startTime, periodEnd),
      ));

    if (entries.length === 0) return null;

    const invoiceNumber = await this.generateInvoiceNumber(contract.tenantId);
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 30);

    let subtotal = 0;
    const lineItems = entries.map((entry) => {
      const hours = (entry.durationMins ?? 0) / 60;
      const rate = entry.rateOverride ? Number(entry.rateOverride) : Number(contract.hourlyRate ?? 0);
      const amount = hours * rate;
      subtotal += amount;
      return { entry, hours, rate, amount };
    });

    const [invoice] = await this.db.insert(invoices).values({
      tenantId: contract.tenantId,
      clientId: contract.clientId,
      invoiceNumber,
      status: 'draft',
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      subtotal: String(subtotal),
      total: String(subtotal),
    }).returning();

    for (const item of lineItems) {
      const [line] = await this.db.insert(invoiceLines).values({
        invoiceId: invoice.id,
        tenantId: contract.tenantId,
        description: `${item.entry.notes ?? 'Time entry'} — ${item.hours.toFixed(2)}h @ $${item.rate}/hr`,
        quantity: String(item.hours),
        unitPrice: String(item.rate),
        amount: String(item.amount),
        sourceType: 'time_entry',
        sourceId: item.entry.id,
      }).returning();

      // Mark time entry as billed
      await this.db
        .update(timeEntries)
        .set({ invoiceLineId: line.id })
        .where(eq(timeEntries.id, item.entry.id));
    }

    this.eventBus.emit({
      type: 'invoice.generated',
      tenantId: contract.tenantId,
      timestamp: new Date(),
      payload: invoice,
    });

    return invoice;
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.execute(sql`
      SELECT COUNT(*)::int + 1 as next_num
      FROM invoices
      WHERE tenant_id = ${tenantId}
      AND EXTRACT(YEAR FROM created_at) = ${year}
    `);
    const nextNum = (result as any)[0]?.next_num ?? 1;
    return `INV-${year}-${String(nextNum).padStart(5, '0')}`;
  }
}
