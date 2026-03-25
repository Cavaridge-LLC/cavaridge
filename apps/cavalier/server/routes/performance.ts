/**
 * CVG-CAVALIER — Performance Dashboard Routes
 *
 * Scorecards: deals registered/won, revenue, commission, certifications.
 * MSP Admin view of all partners. Partner-scoped view for individual partners.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getSql } from "../db";

export const performanceRouter = Router();

// ─── Partner scorecard ─────────────────────────────────────────────────
performanceRouter.get("/scorecard/:partnerId", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const partnerId = req.params.partnerId as string;

    // Real-time stats
    const stats = await sql.unsafe(
      `SELECT
         cp.company_name,
         cp.tier,
         cp.status,
         cp.total_deals,
         cp.deals_won,
         cp.total_revenue,
         cp.onboarded_at,
         (SELECT COUNT(*)::int FROM deal_registrations WHERE partner_id = $1 AND tenant_id = $2 AND status = 'registered') as active_deals,
         (SELECT COUNT(*)::int FROM deal_registrations WHERE partner_id = $1 AND tenant_id = $2 AND status = 'qualified') as qualified_deals,
         (SELECT COALESCE(SUM(commission_amount), 0)::text FROM commission_records WHERE partner_id = $1 AND tenant_id = $2 AND status = 'earned') as commission_earned,
         (SELECT COALESCE(SUM(commission_amount), 0)::text FROM commission_records WHERE partner_id = $1 AND tenant_id = $2 AND status = 'paid') as commission_paid,
         (SELECT COALESCE(SUM(commission_amount), 0)::text FROM commission_records WHERE partner_id = $1 AND tenant_id = $2 AND status = 'pending') as commission_pending,
         (SELECT COUNT(*)::int FROM leads WHERE assigned_partner_id = $1 AND tenant_id = $2) as leads_received,
         (SELECT COUNT(*)::int FROM leads WHERE assigned_partner_id = $1 AND tenant_id = $2 AND status = 'converted') as leads_converted,
         cp.certifications
       FROM channel_partners cp
       WHERE cp.id = $1 AND cp.tenant_id = $2`,
      [partnerId, req.tenantId!],
    );

    if (!stats[0]) {
      res.status(404).json({ error: "Partner not found" });
      return;
    }

    const partner = stats[0] as any;

    // Win rate
    const winRate = partner.total_deals > 0
      ? Math.round((partner.deals_won / partner.total_deals) * 100)
      : 0;

    // Lead conversion rate
    const leadConversionRate = partner.leads_received > 0
      ? Math.round((partner.leads_converted / partner.leads_received) * 100)
      : 0;

    // Certification count
    const certifications = Array.isArray(partner.certifications) ? partner.certifications : [];

    // Overall score (0-100): weighted composite
    const overallScore = Math.min(100, Math.round(
      winRate * 0.3 +
      leadConversionRate * 0.2 +
      Math.min(100, parseFloat(partner.total_revenue ?? "0") / 1000) * 0.3 +
      Math.min(100, certifications.length * 10) * 0.2
    ));

    res.json({
      ...partner,
      winRate,
      leadConversionRate,
      certificationCount: certifications.length,
      overallScore,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── All partners overview (MSP Admin) ─────────────────────────────────
performanceRouter.get("/overview", async (req: Request, res: Response) => {
  try {
    const sql = getSql();

    const result = await sql.unsafe(
      `SELECT
         cp.id,
         cp.company_name,
         cp.tier,
         cp.status,
         cp.total_deals,
         cp.deals_won,
         cp.total_revenue,
         cp.onboarded_at,
         CASE WHEN cp.total_deals > 0
           THEN ROUND((cp.deals_won::numeric / cp.total_deals) * 100)
           ELSE 0
         END as win_rate,
         COALESCE(
           (SELECT SUM(commission_amount) FROM commission_records WHERE partner_id = cp.id AND tenant_id = $1 AND status IN ('earned', 'paid')),
           0
         )::text as total_commission,
         COALESCE(
           (SELECT COUNT(*) FROM leads WHERE assigned_partner_id = cp.id AND tenant_id = $1 AND status = 'converted'),
           0
         )::int as leads_converted,
         cp.last_activity_at
       FROM channel_partners cp
       WHERE cp.tenant_id = $1
       ORDER BY cp.total_revenue DESC NULLS LAST`,
      [req.tenantId!],
    );

    // Platform summary
    const summary = await sql.unsafe(
      `SELECT
         COUNT(*)::int as total_partners,
         COUNT(*) FILTER (WHERE status = 'active')::int as active_partners,
         COALESCE(SUM(total_revenue), 0)::text as total_revenue,
         COALESCE(SUM(deals_won), 0)::int as total_deals_won,
         (SELECT COUNT(*)::int FROM deal_registrations WHERE tenant_id = $1 AND status = 'registered') as active_deals,
         (SELECT COALESCE(SUM(commission_amount), 0)::text FROM commission_records WHERE tenant_id = $1 AND status = 'pending') as pending_commissions,
         (SELECT COALESCE(SUM(commission_amount), 0)::text FROM commission_records WHERE tenant_id = $1 AND status = 'paid') as paid_commissions
       FROM channel_partners
       WHERE tenant_id = $1`,
      [req.tenantId!],
    );

    res.json({
      partners: result,
      summary: summary[0] ?? {},
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Tier distribution ─────────────────────────────────────────────────
performanceRouter.get("/tier-distribution", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT tier, COUNT(*)::int as count,
              COALESCE(SUM(total_revenue), 0)::text as revenue,
              COALESCE(SUM(deals_won), 0)::int as deals_won
       FROM channel_partners
       WHERE tenant_id = $1 AND status = 'active'
       GROUP BY tier
       ORDER BY tier`,
      [req.tenantId!],
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Deal pipeline summary ─────────────────────────────────────────────
performanceRouter.get("/pipeline", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT
         status,
         COUNT(*)::int as count,
         COALESCE(SUM(estimated_value), 0)::text as total_value
       FROM deal_registrations
       WHERE tenant_id = $1
       GROUP BY status
       ORDER BY
         CASE status
           WHEN 'registered' THEN 1
           WHEN 'qualified' THEN 2
           WHEN 'won' THEN 3
           WHEN 'lost' THEN 4
           WHEN 'expired' THEN 5
         END`,
      [req.tenantId!],
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Top partners leaderboard ──────────────────────────────────────────
performanceRouter.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { metric = "revenue", limit = "10" } = req.query;
    const limitNum = Math.min(50, parseInt(limit as string) || 10);

    let orderBy: string;
    switch (metric) {
      case "deals_won":
        orderBy = "cp.deals_won DESC";
        break;
      case "commission":
        orderBy = "total_commission DESC NULLS LAST";
        break;
      case "win_rate":
        orderBy = "win_rate DESC NULLS LAST";
        break;
      default:
        orderBy = "cp.total_revenue DESC NULLS LAST";
    }

    const result = await sql.unsafe(
      `SELECT
         cp.id,
         cp.company_name,
         cp.tier,
         cp.total_deals,
         cp.deals_won,
         cp.total_revenue,
         CASE WHEN cp.total_deals > 0
           THEN ROUND((cp.deals_won::numeric / cp.total_deals) * 100)
           ELSE 0
         END as win_rate,
         COALESCE(
           (SELECT SUM(commission_amount) FROM commission_records WHERE partner_id = cp.id AND tenant_id = $1 AND status IN ('earned', 'paid')),
           0
         )::text as total_commission
       FROM channel_partners cp
       WHERE cp.tenant_id = $1 AND cp.status = 'active'
       ORDER BY ${orderBy}
       LIMIT $2`,
      [req.tenantId!, limitNum],
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
