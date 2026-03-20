/**
 * CVG-AEGIS — Device Management Routes
 *
 * CRUD for enrolled devices, status tracking, heartbeat.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';

export const deviceRouter = Router();

// ─── List devices ──────────────────────────────────────────────────────

deviceRouter.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, search, page = '1', pageSize = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    let query = `
      SELECT d.*,
        (SELECT COUNT(*) FROM aegis.telemetry_events te WHERE te.device_id = d.id) as event_count
      FROM aegis.devices d
      WHERE d.tenant_id = $1
    `;
    const params: unknown[] = [req.tenantId];
    let idx = 2;

    if (status) {
      query += ` AND d.status = $${idx++}`;
      params.push(status);
    }
    if (search) {
      query += ` AND (d.hostname ILIKE $${idx} OR d.device_id ILIKE $${idx} OR d.os ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY d.last_seen_at DESC NULLS LAST LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await db.execute({ sql: query, params } as any);

    const countResult = await db.execute({
      sql: `SELECT COUNT(*)::int as total FROM aegis.devices WHERE tenant_id = $1`,
      params: [req.tenantId],
    } as any);

    res.json({
      data: result ?? [],
      total: (countResult as any)[0]?.total ?? 0,
      page: parseInt(page as string),
      pageSize: limit,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get single device ────────────────────────────────────────────────

deviceRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM aegis.devices WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, req.tenantId],
    } as any);

    const device = (result as any)[0];
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Recent telemetry
    const telemetry = await db.execute({
      sql: `
        SELECT event_type, domain, timestamp
        FROM aegis.telemetry_events
        WHERE device_id = $1 AND tenant_id = $2
        ORDER BY timestamp DESC
        LIMIT 50
      `,
      params: [req.params.id, req.tenantId],
    } as any);

    res.json({ ...device, recentTelemetry: telemetry ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update device status ──────────────────────────────────────────────

deviceRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status } = req.body;

    if (status && !['active', 'inactive', 'revoked'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Use: active, inactive, revoked.' });
      return;
    }

    await db.execute({
      sql: `
        UPDATE aegis.devices SET status = $1, updated_at = now()
        WHERE id = $2 AND tenant_id = $3
      `,
      params: [status, req.params.id, req.tenantId],
    } as any);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Device stats ──────────────────────────────────────────────────────

deviceRouter.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'enrolled')::int as enrolled,
          COUNT(*) FILTER (WHERE status = 'active')::int as active,
          COUNT(*) FILTER (WHERE status = 'inactive')::int as inactive,
          COUNT(*) FILTER (WHERE status = 'revoked')::int as revoked,
          COUNT(*) FILTER (WHERE last_seen_at > now() - interval '24 hours')::int as seen_today
        FROM aegis.devices
        WHERE tenant_id = $1
      `,
      params: [req.tenantId],
    } as any);

    res.json((result as any)[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
