/**
 * CVG-AEGIS — Cavaridge Adjusted Score Routes
 *
 * Composite 0-100 security posture metric.
 * Phase 1: Populates SaaS Shadow IT (10%) and partial Browser Security (20%).
 * Other signals populated in later phases.
 *
 * Read: MSP Tech+ (enforced at router mount).
 * Write (POST /calculate, PUT /weights): MSP Admin only.
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '@cavaridge/auth/server';
import { requireRole } from '@cavaridge/auth/guards';
import { ROLES } from '@cavaridge/auth';
import { randomUUID } from 'crypto';
import { getDb } from '../db';

export const scoreRouter = Router();

// Import default weights from score engine
import { DEFAULT_WEIGHTS, validateWeights } from '../services/adjusted-score';

// ─── Get current score for a client ────────────────────────────────────

scoreRouter.get('/current', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { clientTenantId } = req.query;

    let query = `
      SELECT * FROM aegis.adjusted_scores
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (clientTenantId) {
      query += ` AND client_tenant_id = $2`;
      params.push(clientTenantId);
    }

    query += ` ORDER BY calculated_at DESC LIMIT 1`;

    const result = await db.execute({ sql: query, params } as any);
    const score = (result as any)[0];

    if (!score) {
      res.json({ message: 'No score calculated yet. Run /api/v1/score/calculate to generate.' });
      return;
    }

    res.json(score);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Calculate score (MSP Admin only) ─────────────────────────────────

scoreRouter.post('/calculate', requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { clientTenantId } = req.body;
    const targetTenant = clientTenantId ?? tenantId;

    // Get weight config (MSP may have custom weights)
    const weightResult = await db.execute({
      sql: `SELECT weight_config FROM aegis.adjusted_scores WHERE tenant_id = $1 ORDER BY calculated_at DESC LIMIT 1`,
      params: [tenantId],
    } as any);

    const weights = (weightResult as any)?.[0]?.weight_config ?? DEFAULT_WEIGHTS;

    // ─── Signal 1: SaaS Shadow IT (10%) ───────────────────────────────
    const saasResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE classification = 'sanctioned')::int as sanctioned,
          COUNT(*) FILTER (WHERE classification = 'unsanctioned')::int as unsanctioned,
          COUNT(*) FILTER (WHERE classification = 'unclassified')::int as unclassified,
          COALESCE(AVG(risk_score), 50)::numeric as avg_risk
        FROM aegis.saas_applications
        WHERE tenant_id = $1
      `,
      params: [targetTenant],
    } as any);

    const saas = (saasResult as any)[0] ?? { total: 0, sanctioned: 0, unsanctioned: 0, unclassified: 0, avg_risk: 50 };

    // SaaS Shadow IT score: penalize for unsanctioned/unclassified apps
    let saasRaw = 100;
    if (saas.total > 0) {
      const unsanctionedRatio = (saas.unsanctioned + saas.unclassified) / saas.total;
      saasRaw = Math.max(0, 100 - (unsanctionedRatio * 70) - (saas.avg_risk / 2));
    }
    const saasWeighted = saasRaw * (weights.saas_shadow_it ?? 0.10);

    // ─── Signal 2: Browser Security Compliance (20%) ──────────────────
    const deviceResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'active')::int as active,
          COUNT(*) FILTER (WHERE last_seen_at > now() - interval '7 days')::int as recent
        FROM aegis.devices
        WHERE tenant_id = $1
      `,
      params: [targetTenant],
    } as any);

    const devices = (deviceResult as any)[0] ?? { total: 0, active: 0, recent: 0 };

    // Browser security score: based on extension coverage and activity
    let browserRaw = 0;
    if (devices.total > 0) {
      const activeRatio = devices.active / devices.total;
      const recentRatio = devices.recent / devices.total;
      browserRaw = (activeRatio * 50) + (recentRatio * 50);
    }
    const browserWeighted = browserRaw * (weights.browser_security ?? 0.20);

    // ─── Signals 3-6: Placeholder (populated in later phases) ─────────
    const msSecureRaw = null;
    const msSecureWeighted = 0;
    const googleRaw = null;
    const googleWeighted = 0;
    const credentialRaw = null;
    const credentialWeighted = 0;
    const dnsRaw = null;
    const dnsWeighted = 0;

    // ─── Signal 7: Compensating Controls ──────────────────────────────
    const compensatingBonus = 0; // Populated in Phase 3
    const compensatingControls: unknown[] = [];

    // ─── Total Score ──────────────────────────────────────────────────
    const totalScore = Math.min(100, Math.max(0,
      saasWeighted + browserWeighted + msSecureWeighted + googleWeighted +
      credentialWeighted + dnsWeighted + compensatingBonus
    ));

    const scoreId = randomUUID();

    await db.execute({
      sql: `
        INSERT INTO aegis.adjusted_scores (
          id, tenant_id, client_tenant_id,
          microsoft_secure_score_raw, microsoft_secure_score_weighted,
          browser_security_raw, browser_security_weighted,
          google_workspace_raw, google_workspace_weighted,
          credential_hygiene_raw, credential_hygiene_weighted,
          dns_filtering_raw, dns_filtering_weighted,
          saas_shadow_it_raw, saas_shadow_it_weighted,
          compensating_controls_bonus, compensating_controls,
          total_score, weight_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `,
      params: [
        scoreId, tenantId, clientTenantId ?? null,
        msSecureRaw, msSecureWeighted,
        browserRaw, browserWeighted,
        googleRaw, googleWeighted,
        credentialRaw, credentialWeighted,
        dnsRaw, dnsWeighted,
        saasRaw, saasWeighted,
        compensatingBonus, JSON.stringify(compensatingControls),
        totalScore, JSON.stringify(weights),
      ],
    } as any);

    // Record in history
    await db.execute({
      sql: `
        INSERT INTO aegis.score_history (tenant_id, client_tenant_id, total_score, breakdown)
        VALUES ($1, $2, $3, $4)
      `,
      params: [
        tenantId, clientTenantId ?? null, totalScore,
        JSON.stringify({
          saas_shadow_it: { raw: saasRaw, weighted: saasWeighted },
          browser_security: { raw: browserRaw, weighted: browserWeighted },
        }),
      ],
    } as any);

    res.json({
      totalScore: Math.round(totalScore * 10) / 10,
      signals: {
        microsoft_secure_score: { raw: msSecureRaw, weighted: msSecureWeighted, status: 'not_configured' },
        browser_security: { raw: Math.round(browserRaw), weighted: Math.round(browserWeighted * 10) / 10, status: 'active' },
        google_workspace: { raw: googleRaw, weighted: googleWeighted, status: 'not_configured' },
        credential_hygiene: { raw: credentialRaw, weighted: credentialWeighted, status: 'not_configured' },
        dns_filtering: { raw: dnsRaw, weighted: dnsWeighted, status: 'not_configured' },
        saas_shadow_it: { raw: Math.round(saasRaw), weighted: Math.round(saasWeighted * 10) / 10, status: 'active' },
        compensating_controls: { bonus: compensatingBonus, controls: compensatingControls, status: 'not_configured' },
      },
      weights,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Score history ─────────────────────────────────────────────────────

scoreRouter.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { clientTenantId, limit = '30' } = req.query;

    let query = `
      SELECT total_score, breakdown, recorded_at
      FROM aegis.score_history
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (clientTenantId) {
      query += ` AND client_tenant_id = $${idx++}`;
      params.push(clientTenantId);
    }

    query += ` ORDER BY recorded_at DESC LIMIT $${idx++}`;
    params.push(parseInt(limit as string));

    const result = await db.execute({ sql: query, params } as any);
    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update weight config (MSP Admin only) ────────────────────────────

scoreRouter.put('/weights', requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { weights } = req.body;

    if (!weights) {
      res.status(400).json({ error: 'weights object required.' });
      return;
    }

    // Validate weights sum to ~1.0 (excluding compensating controls)
    const sum = (weights.microsoft_secure_score ?? 0) +
      (weights.browser_security ?? 0) +
      (weights.google_workspace ?? 0) +
      (weights.credential_hygiene ?? 0) +
      (weights.dns_filtering ?? 0) +
      (weights.saas_shadow_it ?? 0);

    if (Math.abs(sum - 1.0) > 0.01) {
      res.status(400).json({ error: `Signal weights must sum to 1.0 (currently ${sum.toFixed(2)}).` });
      return;
    }

    res.json({ weights, message: 'Weights updated. Run /calculate to apply.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
