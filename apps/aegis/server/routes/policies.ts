/**
 * CVG-AEGIS — Policy Management Routes
 *
 * CRUD for security policies. Policies are JSON data pushed to extensions.
 * Types: url_block, url_allow, saas_block, dlp, credential, browser_config, dns
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';

export const policyRouter = Router();

// ─── List policies ─────────────────────────────────────────────────────

policyRouter.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { type, enabled } = req.query;

    let query = `SELECT * FROM aegis.policies WHERE tenant_id = $1`;
    const params: unknown[] = [req.tenantId];
    let idx = 2;

    if (type) {
      query += ` AND type = $${idx++}`;
      params.push(type);
    }
    if (enabled !== undefined) {
      query += ` AND enabled = $${idx++}`;
      params.push(enabled === 'true');
    }

    query += ` ORDER BY priority ASC, created_at DESC`;

    const result = await db.execute({ sql: query, params } as any);
    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get single policy ────────────────────────────────────────────────

policyRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM aegis.policies WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, req.tenantId],
    } as any);

    const policy = (result as any)[0];
    if (!policy) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Create policy ────────────────────────────────────────────────────

policyRouter.post('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, description, type, rules, priority, appliesTo, enabled } = req.body;

    if (!name || !type || !rules) {
      res.status(400).json({ error: 'name, type, and rules are required.' });
      return;
    }

    const validTypes = ['url_block', 'url_allow', 'saas_block', 'dlp', 'credential', 'browser_config', 'dns'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `Invalid policy type. Valid: ${validTypes.join(', ')}` });
      return;
    }

    const result = await db.execute({
      sql: `
        INSERT INTO aegis.policies (tenant_id, name, description, type, rules, priority, applies_to, enabled, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      params: [
        req.tenantId, name, description ?? null, type,
        JSON.stringify(rules), priority ?? 100,
        JSON.stringify(appliesTo ?? { all: true }),
        enabled ?? true, req.userId,
      ],
    } as any);

    res.status(201).json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update policy ────────────────────────────────────────────────────

policyRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, description, rules, priority, appliesTo, enabled } = req.body;

    const sets: string[] = ['updated_at = now()', 'version = version + 1'];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); params.push(description); }
    if (rules !== undefined) { sets.push(`rules = $${idx++}`); params.push(JSON.stringify(rules)); }
    if (priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(priority); }
    if (appliesTo !== undefined) { sets.push(`applies_to = $${idx++}`); params.push(JSON.stringify(appliesTo)); }
    if (enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(enabled); }

    params.push(req.params.id, req.tenantId);

    const result = await db.execute({
      sql: `UPDATE aegis.policies SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      params,
    } as any);

    const policy = (result as any)[0];
    if (!policy) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Delete policy ────────────────────────────────────────────────────

policyRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: `DELETE FROM aegis.policies WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, req.tenantId],
    } as any);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get active policies for a device (used by extension) ──────────────

policyRouter.get('/device/:deviceId', async (req: Request, res: Response) => {
  try {
    const db = getDb();

    // Verify device belongs to tenant
    const deviceResult = await db.execute({
      sql: `SELECT tenant_id FROM aegis.devices WHERE device_id = $1`,
      params: [req.params.deviceId],
    } as any);

    const device = (deviceResult as any)[0];
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const policies = await db.execute({
      sql: `
        SELECT id, name, type, rules, priority
        FROM aegis.policies
        WHERE tenant_id = $1 AND enabled = true
        ORDER BY priority ASC
      `,
      params: [device.tenant_id],
    } as any);

    res.json({ policies: policies ?? [], cacheMinutes: 15 });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
