/**
 * CVG-CAVALIER — Billing Routes
 *
 * Invoice tracking (INV-YYYY-NNNNN), contract management (CTR-NNNNN),
 * time entry for technicians.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';
import { BillingEngine } from '@cavaridge/psa-core';
import { eventBus } from '../events';

export const billingRouter = Router();

function getBillingEngine() {
  return new BillingEngine(getDb() as any, eventBus);
}

// ─── Contracts ──────────────────────────────────────────────────────

billingRouter.get('/contracts', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, clientId } = req.query;
    let query = `SELECT * FROM contracts WHERE tenant_id = $1`;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (status) { query += ` AND status = $${idx++}`; params.push(status); }
    if (clientId) { query += ` AND client_id = $${idx++}`; params.push(clientId); }
    query += ` ORDER BY created_at DESC`;

    const result = await db.execute({ sql: query, params } as any);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

billingRouter.post('/contracts', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    // Generate contract number CTR-NNNNN
    const countResult = await db.execute({
      sql: `SELECT COUNT(*)::int + 1 as next_num FROM contracts WHERE tenant_id = $1`,
      params: [req.tenantId!],
    } as any);
    const nextNum = (countResult as any)[0]?.next_num ?? 1;
    const contractNumber = `CTR-${String(nextNum).padStart(5, '0')}`;

    const result = await db.execute({
      sql: `
        INSERT INTO contracts
          (tenant_id, client_id, name, contract_number, type, status,
           start_date, end_date, monthly_amount, hourly_rate,
           block_hours_total, sla_policy_id, auto_renew,
           scope_description, exclusions)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `,
      params: [
        req.tenantId!, req.body.clientId, req.body.name, contractNumber,
        req.body.type, req.body.status ?? 'draft',
        req.body.startDate, req.body.endDate ?? null,
        req.body.monthlyAmount ?? null, req.body.hourlyRate ?? null,
        req.body.blockHoursTotal ?? null, req.body.slaPolicyId ?? null,
        req.body.autoRenew ?? true, req.body.scopeDescription ?? null,
        req.body.exclusions ?? null,
      ],
    } as any);

    res.status(201).json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

billingRouter.get('/contracts/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id as string, req.tenantId!],
    } as any);

    const contract = (result as any)[0];
    if (!contract) { res.status(404).json({ error: 'Contract not found' }); return; }

    res.json(contract);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

billingRouter.patch('/contracts/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowedFields = [
      'name', 'type', 'status', 'start_date', 'end_date',
      'monthly_amount', 'hourly_rate', 'block_hours_total',
      'sla_policy_id', 'auto_renew', 'scope_description', 'exclusions',
    ];

    // Map camelCase request body to snake_case DB columns
    const camelToSnake: Record<string, string> = {
      startDate: 'start_date', endDate: 'end_date',
      monthlyAmount: 'monthly_amount', hourlyRate: 'hourly_rate',
      blockHoursTotal: 'block_hours_total', slaPolicyId: 'sla_policy_id',
      autoRenew: 'auto_renew', scopeDescription: 'scope_description',
    };

    for (const [key, value] of Object.entries(req.body)) {
      const dbField = camelToSnake[key] ?? key;
      if (allowedFields.includes(dbField) && value !== undefined) {
        fields.push(`${dbField} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id as string, req.tenantId!);

    const result = await db.execute({
      sql: `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params: values,
    } as any);

    res.json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Block hours balance
billingRouter.get('/contracts/:id/block-hours', async (req: Request, res: Response) => {
  try {
    const engine = getBillingEngine();
    const balance = await engine.checkBlockHoursBalance(req.params.id as string);
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Expiring contracts
billingRouter.get('/contracts-expiring', async (req: Request, res: Response) => {
  try {
    const engine = getBillingEngine();
    const daysAhead = parseInt(req.query.days as string) || 30;
    const contracts = await engine.getExpiringContracts(req.tenantId!, daysAhead);
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Invoices ───────────────────────────────────────────────────────

billingRouter.get('/invoices', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, clientId } = req.query;
    let query = `SELECT * FROM invoices WHERE tenant_id = $1`;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (status) { query += ` AND status = $${idx++}`; params.push(status); }
    if (clientId) { query += ` AND client_id = $${idx++}`; params.push(clientId); }
    query += ` ORDER BY created_at DESC`;

    const result = await db.execute({ sql: query, params } as any);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

billingRouter.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const invoice = await db.execute({
      sql: `SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id as string, req.tenantId!],
    } as any);

    if (!(invoice as any)[0]) { res.status(404).json({ error: 'Invoice not found' }); return; }

    const lines = await db.execute({
      sql: `SELECT * FROM invoice_lines WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY sort_order`,
      params: [req.params.id as string, req.tenantId!],
    } as any);

    res.json({ ...(invoice as any)[0], lines });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

billingRouter.post('/invoices/generate', async (req: Request, res: Response) => {
  try {
    const engine = getBillingEngine();
    const invoices = await engine.generateMonthlyInvoices({
      tenantId: req.tenantId!,
      periodStart: new Date(req.body.periodStart),
      periodEnd: new Date(req.body.periodEnd),
    });

    res.status(201).json(invoices);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Update invoice status (approve, send, mark paid, void)
billingRouter.patch('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (req.body.status) {
      updates.push(`status = $${idx++}`);
      params.push(req.body.status);
    }
    if (req.body.paidAmount) {
      updates.push(`paid_amount = $${idx++}`, `paid_at = NOW()`);
      params.push(req.body.paidAmount);
    }
    if (req.body.notes) {
      updates.push(`notes = $${idx++}`);
      params.push(req.body.notes);
    }

    params.push(req.params.id as string, req.tenantId!);

    const result = await db.execute({
      sql: `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params,
    } as any);

    res.json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Time Entries ───────────────────────────────────────────────────

billingRouter.get('/time-entries', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { ticketId, userId, billable, approved } = req.query;
    let query = `SELECT * FROM time_entries WHERE tenant_id = $1`;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (ticketId) { query += ` AND ticket_id = $${idx++}`; params.push(ticketId); }
    if (userId) { query += ` AND user_id = $${idx++}`; params.push(userId); }
    if (billable !== undefined) { query += ` AND billable = $${idx++}`; params.push(billable === 'true'); }
    if (approved !== undefined) { query += ` AND approved = $${idx++}`; params.push(approved === 'true'); }
    query += ` ORDER BY start_time DESC`;

    const result = await db.execute({ sql: query, params } as any);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

billingRouter.post('/time-entries', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        INSERT INTO time_entries
          (tenant_id, ticket_id, user_id, start_time, end_time, duration_mins,
           billable, rate_override, work_type, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      params: [
        req.tenantId!, req.body.ticketId ?? null, req.body.userId ?? req.userId!,
        req.body.startTime, req.body.endTime ?? null, req.body.durationMins ?? null,
        req.body.billable ?? true, req.body.rateOverride ?? null,
        req.body.workType ?? 'reactive', req.body.notes ?? null,
      ],
    } as any);

    res.status(201).json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Start timer (create entry with start_time, no end_time)
billingRouter.post('/time-entries/start', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        INSERT INTO time_entries
          (tenant_id, ticket_id, user_id, start_time, billable, work_type, notes)
        VALUES ($1, $2, $3, NOW(), $4, $5, $6)
        RETURNING *
      `,
      params: [
        req.tenantId!, req.body.ticketId ?? null, req.userId!,
        req.body.billable ?? true, req.body.workType ?? 'reactive',
        req.body.notes ?? null,
      ],
    } as any);

    res.status(201).json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Stop timer
billingRouter.post('/time-entries/:id/stop', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        UPDATE time_entries
        SET end_time = NOW(),
            duration_mins = EXTRACT(EPOCH FROM (NOW() - start_time))::int / 60,
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND end_time IS NULL
        RETURNING *
      `,
      params: [req.params.id as string, req.tenantId!],
    } as any);

    const entry = (result as any)[0];
    if (!entry) { res.status(404).json({ error: 'Running timer not found' }); return; }

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Approve time entry
billingRouter.post('/time-entries/:id/approve', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        UPDATE time_entries
        SET approved = true, approved_by = $1, approved_at = NOW(), updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING *
      `,
      params: [req.userId!, req.params.id as string, req.tenantId!],
    } as any);

    res.json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Billing summary (dashboard) ────────────────────────────────────
billingRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT
          (SELECT COALESCE(SUM(total::numeric), 0)::text FROM invoices WHERE tenant_id = $1 AND status = 'paid') as total_collected,
          (SELECT COALESCE(SUM(total::numeric), 0)::text FROM invoices WHERE tenant_id = $1 AND status IN ('sent', 'overdue')) as outstanding,
          (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1 AND status = 'overdue') as overdue_count,
          (SELECT COUNT(*)::int FROM contracts WHERE tenant_id = $1 AND status = 'active') as active_contracts,
          (SELECT COALESCE(SUM(duration_mins), 0)::int FROM time_entries WHERE tenant_id = $1 AND billable = true AND approved = true AND invoice_line_id IS NULL) as unbilled_minutes
      `,
      params: [req.tenantId!],
    } as any);

    res.json((result as any)[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
