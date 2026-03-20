/**
 * CVG-CAVALIER — Dispatch Routes
 *
 * Technician scheduling, dispatch board, workload management.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';
import { DispatchEngine } from '@cavaridge/psa-core';

export const dispatchRouter = Router();

function getDispatchEngine() {
  return new DispatchEngine(getDb());
}

// ─── Dispatch board ─────────────────────────────────────────────────
dispatchRouter.get('/board', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const startDate = req.query.start ? new Date(req.query.start as string) : new Date();
    const endDate = req.query.end
      ? new Date(req.query.end as string)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Get all technicians for this tenant
    // In production, this queries the users table. For now, get from dispatch_slots.
    const techResult = await db.execute({
      sql: `SELECT DISTINCT user_id FROM dispatch_slots WHERE tenant_id = $1`,
      params: [req.tenantId],
    } as any);

    const techIds = (techResult as any[]).map((r: any) => r.user_id);

    const engine = getDispatchEngine();
    const board = await engine.getDispatchBoard(req.tenantId, { start: startDate, end: endDate }, techIds);

    res.json(board);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Create dispatch slot ───────────────────────────────────────────
dispatchRouter.post('/slots', async (req: Request, res: Response) => {
  try {
    const engine = getDispatchEngine();
    const slot = await engine.createSlot({
      tenantId: req.tenantId,
      ticketId: req.body.ticketId,
      userId: req.body.userId,
      scheduledStart: new Date(req.body.scheduledStart),
      scheduledEnd: new Date(req.body.scheduledEnd),
      notes: req.body.notes,
    });

    res.status(201).json(slot);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update dispatch slot ───────────────────────────────────────────
dispatchRouter.patch('/slots/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (req.body.scheduledStart) { updates.push(`scheduled_start = $${idx++}`); params.push(new Date(req.body.scheduledStart)); }
    if (req.body.scheduledEnd) { updates.push(`scheduled_end = $${idx++}`); params.push(new Date(req.body.scheduledEnd)); }
    if (req.body.status) { updates.push(`status = $${idx++}`); params.push(req.body.status); }
    if (req.body.actualStart) { updates.push(`actual_start = $${idx++}`); params.push(new Date(req.body.actualStart)); }
    if (req.body.actualEnd) { updates.push(`actual_end = $${idx++}`); params.push(new Date(req.body.actualEnd)); }
    if (req.body.notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(req.body.notes); }

    params.push(req.params.id, req.tenantId);

    const result = await db.execute({
      sql: `UPDATE dispatch_slots SET ${updates.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params,
    } as any);

    res.json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Technician workload ────────────────────────────────────────────
dispatchRouter.get('/workload/:userId', async (req: Request, res: Response) => {
  try {
    const engine = getDispatchEngine();
    const dateRange = {
      start: req.query.start ? new Date(req.query.start as string) : new Date(),
      end: req.query.end ? new Date(req.query.end as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const workload = await engine.getTechnicianWorkload(req.tenantId, req.params.userId, dateRange);
    res.json(workload);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Assignment suggestions ─────────────────────────────────────────
dispatchRouter.post('/suggest-assignment', async (req: Request, res: Response) => {
  try {
    const engine = getDispatchEngine();
    const suggestions = await engine.suggestAssignment(
      req.tenantId,
      req.body.ticketId,
      req.body.technicianIds,
    );

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
