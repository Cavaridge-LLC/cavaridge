/**
 * CVG-AEGIS — Security Posture Dashboard Routes
 *
 * MSP-level and client-level views. Trends. Peer comparison (anonymized).
 *
 * GET /overview: MSP-level dashboard overview
 * GET /client/:clientTenantId: client-level detail
 * GET /trends: score trending data
 * GET /peer-comparison: anonymized peer benchmarking
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { getDb } from "../db";

export const dashboardRouter = Router();

// ---------------------------------------------------------------------------
// GET /overview — MSP-level dashboard
// ---------------------------------------------------------------------------

dashboardRouter.get("/overview", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    // Aggregate scores across all clients
    const scoresResult = await db.execute({
      sql: `
        SELECT
          COUNT(DISTINCT client_tenant_id)::int as client_count,
          AVG(total_score::numeric)::numeric as avg_score,
          MIN(total_score::numeric)::numeric as min_score,
          MAX(total_score::numeric)::numeric as max_score,
          COUNT(*) FILTER (WHERE total_score::numeric >= 80)::int as strong_posture,
          COUNT(*) FILTER (WHERE total_score::numeric >= 50 AND total_score::numeric < 80)::int as moderate_posture,
          COUNT(*) FILTER (WHERE total_score::numeric < 50)::int as weak_posture
        FROM (
          SELECT DISTINCT ON (client_tenant_id)
            client_tenant_id, total_score
          FROM aegis.adjusted_scores
          WHERE tenant_id = $1 AND client_tenant_id IS NOT NULL
          ORDER BY client_tenant_id, calculated_at DESC
        ) latest
      `,
      params: [tenantId],
    } as any);

    // Device summary
    const devicesResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total_devices,
          COUNT(*) FILTER (WHERE status = 'active')::int as active_devices,
          COUNT(*) FILTER (WHERE last_seen_at > now() - interval '24 hours')::int as seen_today
        FROM aegis.devices WHERE tenant_id = $1
      `,
      params: [tenantId],
    } as any);

    // Recent scans
    const scansResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total_scans,
          COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE status = 'running')::int as in_progress,
          AVG(score::numeric) FILTER (WHERE score IS NOT NULL)::numeric as avg_scan_score
        FROM aegis.scan_results
        WHERE tenant_id = $1 AND created_at > now() - interval '30 days'
      `,
      params: [tenantId],
    } as any);

    // SaaS summary
    const saasResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total_apps,
          COUNT(*) FILTER (WHERE classification = 'unsanctioned')::int as unsanctioned,
          COUNT(*) FILTER (WHERE classification = 'unclassified')::int as unclassified
        FROM aegis.saas_applications WHERE tenant_id = $1
      `,
      params: [tenantId],
    } as any);

    // IAR summary
    const iarResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total_reviews,
          SUM(high_severity_count)::int as total_high_flags,
          MAX(completed_at) as last_review_at
        FROM aegis.iar_reviews
        WHERE tenant_id = $1 AND status = 'completed'
        AND created_at > now() - interval '90 days'
      `,
      params: [tenantId],
    } as any);

    res.json({
      scores: (scoresResult as any)?.[0] ?? {},
      devices: (devicesResult as any)?.[0] ?? {},
      scans: (scansResult as any)?.[0] ?? {},
      saas: (saasResult as any)?.[0] ?? {},
      iar: (iarResult as any)?.[0] ?? {},
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /client/:clientTenantId — client-level detail
// ---------------------------------------------------------------------------

dashboardRouter.get("/client/:clientTenantId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { clientTenantId } = req.params;

    // Latest score
    const scoreResult = await db.execute({
      sql: `
        SELECT * FROM aegis.adjusted_scores
        WHERE tenant_id = $1 AND client_tenant_id = $2
        ORDER BY calculated_at DESC LIMIT 1
      `,
      params: [tenantId, clientTenantId],
    } as any);

    // Score history (last 30)
    const historyResult = await db.execute({
      sql: `
        SELECT total_score, breakdown, recorded_at
        FROM aegis.score_history
        WHERE tenant_id = $1 AND client_tenant_id = $2
        ORDER BY recorded_at DESC LIMIT 30
      `,
      params: [tenantId, clientTenantId],
    } as any);

    // Device count
    const devicesResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'active')::int as active
        FROM aegis.devices WHERE tenant_id = $1
      `,
      params: [clientTenantId],
    } as any);

    // SaaS apps
    const saasResult = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE classification = 'unsanctioned')::int as unsanctioned
        FROM aegis.saas_applications WHERE tenant_id = $1
      `,
      params: [clientTenantId],
    } as any);

    // Latest IAR
    const iarResult = await db.execute({
      sql: `
        SELECT id, flag_count, high_severity_count, executive_summary, completed_at
        FROM aegis.iar_reviews
        WHERE tenant_id = $1 AND status = 'completed'
        ORDER BY completed_at DESC LIMIT 1
      `,
      params: [clientTenantId],
    } as any);

    // Compensating controls
    const controlsResult = await db.execute({
      sql: `
        SELECT control_type, name, is_detected, bonus_points
        FROM aegis.compensating_controls
        WHERE tenant_id = $1 AND enabled = true
      `,
      params: [clientTenantId],
    } as any);

    res.json({
      currentScore: (scoreResult as any)?.[0] ?? null,
      scoreHistory: historyResult ?? [],
      devices: (devicesResult as any)?.[0] ?? {},
      saas: (saasResult as any)?.[0] ?? {},
      latestIar: (iarResult as any)?.[0] ?? null,
      compensatingControls: controlsResult ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /trends — score trending data
// ---------------------------------------------------------------------------

dashboardRouter.get("/trends", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { clientTenantId, days = "90" } = req.query;

    let query = `
      SELECT
        date_trunc('day', recorded_at)::date as date,
        AVG(total_score::numeric)::numeric as avg_score,
        COUNT(*)::int as data_points
      FROM aegis.score_history
      WHERE tenant_id = $1
        AND recorded_at > now() - ($2 || ' days')::interval
    `;
    const params: unknown[] = [tenantId, days];
    let idx = 3;

    if (clientTenantId) {
      query += ` AND client_tenant_id = $${idx++}`;
      params.push(clientTenantId);
    }

    query += ` GROUP BY date ORDER BY date ASC`;

    const result = await db.execute({ sql: query, params } as any);
    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /peer-comparison — anonymized peer benchmarking
// ---------------------------------------------------------------------------

dashboardRouter.get("/peer-comparison", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    // Get this tenant's latest average score
    const ownScoreResult = await db.execute({
      sql: `
        SELECT AVG(total_score::numeric)::numeric as avg_score
        FROM (
          SELECT DISTINCT ON (client_tenant_id) total_score
          FROM aegis.adjusted_scores
          WHERE tenant_id = $1 AND client_tenant_id IS NOT NULL
          ORDER BY client_tenant_id, calculated_at DESC
        ) latest
      `,
      params: [tenantId],
    } as any);

    // Get anonymized percentile data across all tenants
    const peerResult = await db.execute({
      sql: `
        SELECT
          percentile_cont(0.25) WITHIN GROUP (ORDER BY avg_score) as p25,
          percentile_cont(0.50) WITHIN GROUP (ORDER BY avg_score) as p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY avg_score) as p75,
          percentile_cont(0.90) WITHIN GROUP (ORDER BY avg_score) as p90,
          COUNT(*)::int as peer_count
        FROM (
          SELECT tenant_id, AVG(total_score::numeric) as avg_score
          FROM (
            SELECT DISTINCT ON (tenant_id, client_tenant_id)
              tenant_id, total_score
            FROM aegis.adjusted_scores
            WHERE client_tenant_id IS NOT NULL
              AND calculated_at > now() - interval '30 days'
            ORDER BY tenant_id, client_tenant_id, calculated_at DESC
          ) latest
          GROUP BY tenant_id
        ) tenant_avgs
      `,
      params: [],
    } as any);

    const ownScore = parseFloat((ownScoreResult as any)?.[0]?.avg_score ?? "0");
    const peerData = (peerResult as any)?.[0] ?? {};

    // Calculate percentile rank
    let percentileRank: number | null = null;
    if (peerData.p50 !== null && ownScore > 0) {
      if (ownScore >= parseFloat(peerData.p90 ?? "100")) percentileRank = 90;
      else if (ownScore >= parseFloat(peerData.p75 ?? "75")) percentileRank = 75;
      else if (ownScore >= parseFloat(peerData.p50 ?? "50")) percentileRank = 50;
      else if (ownScore >= parseFloat(peerData.p25 ?? "25")) percentileRank = 25;
      else percentileRank = 10;
    }

    res.json({
      ownAverageScore: Math.round(ownScore * 10) / 10,
      peerBenchmarks: {
        p25: peerData.p25 ? Math.round(parseFloat(peerData.p25) * 10) / 10 : null,
        p50: peerData.p50 ? Math.round(parseFloat(peerData.p50) * 10) / 10 : null,
        p75: peerData.p75 ? Math.round(parseFloat(peerData.p75) * 10) / 10 : null,
        p90: peerData.p90 ? Math.round(parseFloat(peerData.p90) * 10) / 10 : null,
      },
      peerCount: peerData.peer_count ?? 0,
      percentileRank,
      note: "Peer data is anonymized. No individual tenant scores are disclosed.",
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
