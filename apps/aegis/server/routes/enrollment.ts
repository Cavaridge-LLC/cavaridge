/**
 * CVG-AEGIS — Device Enrollment Routes
 *
 * Handles extension enrollment flow:
 * 1. Extension activates → checks chrome.storage.local for device_id
 * 2. If absent, calls POST /api/v1/enroll with enrollment token
 * 3. Receives device_id + tenant_id + initial policy set
 *
 * Also: enrollment token management (CRUD for MSP admins).
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { getDb } from '../db';

export const enrollmentRouter = Router();

// ─── Public: Device enrollment (no tenant middleware) ──────────────────

/**
 * POST /api/v1/enroll
 * Called by the extension with an enrollment token.
 * Returns device_id, tenant_id, and initial policies.
 */
enrollmentRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { token, hostname, os, browser, browserVersion, extensionVersion, userAgent } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Enrollment token required.' });
      return;
    }

    const db = getDb();

    // Validate token
    const tokenResult = await db.execute({
      sql: `
        SELECT id, tenant_id, max_uses, use_count, expires_at, revoked_at
        FROM aegis.enrollment_tokens
        WHERE token = $1
      `,
      params: [token],
    } as any);

    const tokenRecord = (tokenResult as any)[0];
    if (!tokenRecord) {
      res.status(401).json({ error: 'Invalid enrollment token.' });
      return;
    }

    if (tokenRecord.revoked_at) {
      res.status(401).json({ error: 'Enrollment token has been revoked.' });
      return;
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      res.status(401).json({ error: 'Enrollment token has expired.' });
      return;
    }

    if (tokenRecord.max_uses > 0 && tokenRecord.use_count >= tokenRecord.max_uses) {
      res.status(401).json({ error: 'Enrollment token usage limit reached.' });
      return;
    }

    const deviceId = randomUUID();
    const tenantId = tokenRecord.tenant_id;

    // Create device record
    await db.execute({
      sql: `
        INSERT INTO aegis.devices (id, tenant_id, device_id, hostname, os, browser, browser_version, extension_version, enrollment_token_id, status, enrolled_at, user_agent, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'enrolled', now(), $10, $11)
      `,
      params: [
        randomUUID(), tenantId, deviceId,
        hostname ?? null, os ?? null, browser ?? null,
        browserVersion ?? null, extensionVersion ?? null,
        tokenRecord.id, userAgent ?? null,
        req.headers['x-forwarded-for'] ?? req.ip ?? null,
      ],
    } as any);

    // Increment token use count
    await db.execute({
      sql: `UPDATE aegis.enrollment_tokens SET use_count = use_count + 1 WHERE id = $1`,
      params: [tokenRecord.id],
    } as any);

    // Fetch initial policies for this tenant
    const policies = await db.execute({
      sql: `
        SELECT id, name, type, rules, priority
        FROM aegis.policies
        WHERE tenant_id = $1 AND enabled = true
        ORDER BY priority ASC
      `,
      params: [tenantId],
    } as any);

    res.status(201).json({
      deviceId,
      tenantId,
      policies: policies ?? [],
      policyCacheMinutes: 15,
      telemetryIntervalSeconds: 60,
    });
  } catch (err) {
    console.error('[aegis] Enrollment error:', err);
    res.status(500).json({ error: 'Enrollment failed.' });
  }
});

// ─── Token Management (requires tenant middleware) ─────────────────────

/**
 * GET /api/v1/enrollment/tokens — list tokens for tenant
 */
enrollmentRouter.get('/tokens', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT id, token, label, max_uses, use_count, expires_at, created_at, revoked_at
        FROM aegis.enrollment_tokens
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `,
      params: [req.tenantId],
    } as any);

    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/v1/enrollment/tokens — create new enrollment token
 */
enrollmentRouter.post('/tokens', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const token = randomBytes(24).toString('base64url');
    const { label, maxUses, expiresAt } = req.body;

    const result = await db.execute({
      sql: `
        INSERT INTO aegis.enrollment_tokens (tenant_id, token, label, max_uses, expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, token, label, max_uses, use_count, expires_at, created_at
      `,
      params: [
        req.tenantId, token,
        label ?? null,
        maxUses ?? 0,
        expiresAt ?? null,
        req.userId,
      ],
    } as any);

    res.status(201).json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /api/v1/enrollment/tokens/:id — revoke token
 */
enrollmentRouter.delete('/tokens/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: `
        UPDATE aegis.enrollment_tokens SET revoked_at = now()
        WHERE id = $1 AND tenant_id = $2
      `,
      params: [req.params.id, req.tenantId],
    } as any);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
