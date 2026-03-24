/**
 * CVG-AEGIS — Policy Management Routes
 *
 * CRUD for security policies. Policies are JSON data pushed to extensions.
 * Types: url_block, url_allow, saas_block, dlp, credential, browser_config, dns
 *
 * Read: MSP Tech+ (enforced at router mount).
 * Write (POST/PATCH/DELETE): MSP Admin only.
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '@cavaridge/auth/server';
import { requireRole } from '@cavaridge/auth/guards';
import { ROLES } from '@cavaridge/auth';
import { getDb } from '../db';

export const policyRouter = Router();

// ─── List policies ─────────────────────────────────────────────────────

policyRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { type, enabled } = req.query;

    let query = `SELECT * FROM aegis.policies WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
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

policyRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const result = await db.execute({
      sql: `SELECT * FROM aegis.policies WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, tenantId],
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

// ─── Create policy (MSP Admin only) ─────────────────────────────────

policyRouter.post('/', requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
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
        tenantId, name, description ?? null, type,
        JSON.stringify(rules), priority ?? 100,
        JSON.stringify(appliesTo ?? { all: true }),
        enabled ?? true, userId,
      ],
    } as any);

    res.status(201).json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update policy (MSP Admin only) ─────────────────────────────────

policyRouter.patch('/:id', requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
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

    params.push(req.params.id, tenantId);

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

// ─── Delete policy (MSP Admin only) ─────────────────────────────────

policyRouter.delete('/:id', requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    await db.execute({
      sql: `DELETE FROM aegis.policies WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, tenantId],
    } as any);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get active policies for a device (public — device-authenticated) ─

policyRouter.get('/device/:deviceId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();

    // Verify device exists — device auth, not user auth
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
