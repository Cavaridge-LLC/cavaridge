/**
 * CVG-CAVALIER — AI Partner Matching Routes
 *
 * Via Ducky (app_code=CVG-CAVALIER): match prospects to best-fit partners.
 * Falls back to rule-based matching when AI is unavailable.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getSql } from "../db";
import { matchPartnerToProspect } from "../services/ai/partner-matching";

export const aiMatchingRouter = Router();

// ─── Match prospect to partners ────────────────────────────────────────
aiMatchingRouter.post("/match", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { prospect } = req.body;

    if (!prospect || !prospect.company) {
      res.status(400).json({ error: "prospect.company is required" });
      return;
    }

    // Get active partners with their stats
    const partnerResult = await sql.unsafe(
      `SELECT id, company_name as "companyName", tier, geography,
              specializations, certifications, deals_won as "dealsWon",
              total_revenue as "totalRevenue"
       FROM channel_partners
       WHERE tenant_id = $1 AND status = 'active'`,
      [req.tenantId!],
    );

    if ((partnerResult as any[]).length === 0) {
      res.json({
        rankings: [],
        recommendation: "No active partners available for matching.",
        aiPowered: false,
      });
      return;
    }

    const result = await matchPartnerToProspect({
      tenantId: req.tenantId!,
      userId: req.userId!,
      prospect,
      partners: partnerResult as any[],
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
