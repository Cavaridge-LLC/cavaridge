/**
 * CVG-AEGIS — Scan Routes
 *
 * External posture scanning (DNS, TLS, port checks).
 * Includes the freemium public scan endpoint for lead gen.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db';
import { runExternalScan } from '../lib/scanner';

export const scanRouter = Router();

/**
 * POST /api/v1/scan/public
 * Freemium scan — no auth required.
 * Captures prospect info for lead gen.
 */
scanRouter.post('/public', async (req: Request, res: Response) => {
  try {
    const { target, email, name, company } = req.body;

    if (!target) {
      res.status(400).json({ error: 'Target domain required.' });
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(target)) {
      res.status(400).json({ error: 'Invalid domain format.' });
      return;
    }

    const db = getDb();
    const scanId = randomUUID();

    // Create scan record
    await db.execute({
      sql: `
        INSERT INTO aegis.scan_results (id, scan_type, target, status, prospect_email, prospect_name, prospect_company, started_at)
        VALUES ($1, 'external_posture', $2, 'running', $3, $4, $5, now())
      `,
      params: [scanId, target, email ?? null, name ?? null, company ?? null],
    } as any);

    // Run scan (Phase 1: synchronous for simplicity; Phase 2: queue-based)
    try {
      const { findings, summary } = await runExternalScan(target);

      await db.execute({
        sql: `
          UPDATE aegis.scan_results
          SET status = 'completed', findings = $1, summary = $2, score = $3, completed_at = now()
          WHERE id = $4
        `,
        params: [JSON.stringify(findings), JSON.stringify(summary), summary.score, scanId],
      } as any);

      res.json({ scanId, ...summary, findings });
    } catch (scanErr) {
      await db.execute({
        sql: `UPDATE aegis.scan_results SET status = 'failed', metadata = $1 WHERE id = $2`,
        params: [JSON.stringify({ error: (scanErr as Error).message }), scanId],
      } as any);

      res.status(500).json({ error: 'Scan failed. Please try again.' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/v1/scan — tenant-scoped scan (requires auth)
 */
scanRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { target, scanType = 'external_posture' } = req.body;

    if (!target) {
      res.status(400).json({ error: 'Target domain required.' });
      return;
    }

    const db = getDb();
    const scanId = randomUUID();

    await db.execute({
      sql: `
        INSERT INTO aegis.scan_results (id, tenant_id, scan_type, target, status, started_at)
        VALUES ($1, $2, $3, $4, 'running', now())
      `,
      params: [scanId, req.tenantId, scanType, target],
    } as any);

    try {
      const { findings, summary } = await runExternalScan(target);

      await db.execute({
        sql: `
          UPDATE aegis.scan_results
          SET status = 'completed', findings = $1, summary = $2, score = $3, completed_at = now()
          WHERE id = $4
        `,
        params: [JSON.stringify(findings), JSON.stringify(summary), summary.score, scanId],
      } as any);

      res.json({ scanId, ...summary, findings });
    } catch (scanErr) {
      await db.execute({
        sql: `UPDATE aegis.scan_results SET status = 'failed', metadata = $1 WHERE id = $2`,
        params: [JSON.stringify({ error: (scanErr as Error).message }), scanId],
      } as any);

      res.status(500).json({ error: 'Scan failed.' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/v1/scan — list scans for tenant
 */
scanRouter.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT id, scan_type, target, status, score, started_at, completed_at, created_at
        FROM aegis.scan_results
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      params: [req.tenantId],
    } as any);

    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/v1/scan/:id — get scan details
 */
scanRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    // Allow access to public scans (no tenant_id) or tenant-scoped scans
    const result = await db.execute({
      sql: `
        SELECT * FROM aegis.scan_results
        WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
      `,
      params: [req.params.id, req.tenantId ?? '00000000-0000-0000-0000-000000000000'],
    } as any);

    const scan = (result as any)[0];
    if (!scan) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    res.json(scan);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
