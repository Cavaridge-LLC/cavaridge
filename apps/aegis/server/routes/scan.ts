/**
 * CVG-AEGIS — Scan Routes
 *
 * External posture scanning (DNS, TLS, port checks).
 * POST /public is freemium (no auth) — lead gen.
 * All other endpoints require MSP Tech+ (enforced at router mount).
 * POST / (tenant-scoped scan) requires MSP Admin.
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '@cavaridge/auth/server';
import { requireRole } from '@cavaridge/auth/guards';
import { ROLES } from '@cavaridge/auth';
import { randomUUID } from 'crypto';
import { getDb } from '../db';
import { runExternalScan } from '../lib/scanner';

export const scanRouter = Router();

/**
 * POST /api/v1/scan/public
 * Freemium scan — no auth required.
 * Captures prospect info for lead gen.
 */
scanRouter.post('/public', async (req: AuthenticatedRequest, res: Response) => {
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

    // Create scan record (no tenant_id for public scans)
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
 * POST /api/v1/scan — tenant-scoped scan (MSP Admin only)
 */
scanRouter.post('/', requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
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
      params: [scanId, tenantId, scanType, target],
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
scanRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const result = await db.execute({
      sql: `
        SELECT id, scan_type, target, status, score, started_at, completed_at, created_at
        FROM aegis.scan_results
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      params: [tenantId],
    } as any);

    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/v1/scan/:id — get scan details (tenant-scoped or public)
 */
scanRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    // Allow access to public scans (no tenant_id) or tenant-scoped scans
    const result = await db.execute({
      sql: `
        SELECT * FROM aegis.scan_results
        WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
      `,
      params: [req.params.id, tenantId],
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
