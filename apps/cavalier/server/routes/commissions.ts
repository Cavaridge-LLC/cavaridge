/**
 * CVG-CAVALIER — Commission Engine Routes
 *
 * Commission structures per product and partner tier.
 * Track earned, pending, paid commissions.
 * Calculate on deal close and payment.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getSql } from "../db";
import {
  calculateCommission,
  summarizeCommissions,
  type CommissionStructureInput,
  type CommissionCalculationResult,
} from "../services/commission/engine";

export const commissionRouter = Router();

// ─── Commission Structures ─────────────────────────────────────────────

// List commission structures
commissionRouter.get("/structures", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { productCode, partnerTier } = req.query;

    let query = `SELECT * FROM commission_structures WHERE tenant_id = $1`;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (productCode) { query += ` AND product_code = $${idx++}`; params.push(productCode); }
    if (partnerTier) { query += ` AND partner_tier = $${idx++}`; params.push(partnerTier); }
    query += ` ORDER BY product_code, partner_tier`;

    const result = await sql.unsafe(query, params as any[]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create/update commission structure
commissionRouter.put("/structures", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const {
      productCode, productName, partnerTier,
      commissionPercent, recurringPercent, recurringMonths,
      bonusThreshold, bonusPercent,
    } = req.body;

    if (!productCode || !productName || !partnerTier || commissionPercent === undefined) {
      res.status(400).json({ error: "productCode, productName, partnerTier, commissionPercent required" });
      return;
    }

    const result = await sql.unsafe(
      `INSERT INTO commission_structures
        (tenant_id, product_code, product_name, partner_tier,
         commission_percent, recurring_percent, recurring_months,
         bonus_threshold, bonus_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ON CONSTRAINT uq_commission_product_tier
       DO UPDATE SET
         product_name = EXCLUDED.product_name,
         commission_percent = EXCLUDED.commission_percent,
         recurring_percent = EXCLUDED.recurring_percent,
         recurring_months = EXCLUDED.recurring_months,
         bonus_threshold = EXCLUDED.bonus_threshold,
         bonus_percent = EXCLUDED.bonus_percent,
         updated_at = NOW()
       RETURNING *`,
      [
        req.tenantId!, productCode, productName, partnerTier,
        commissionPercent, recurringPercent ?? 0, recurringMonths ?? 12,
        bonusThreshold ?? null, bonusPercent ?? null,
      ],
    );

    res.status(201).json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Commission Records ────────────────────────────────────────────────

// List commission records for a partner or all
commissionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { partnerId, status, page = "1", pageSize = "50" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    let query = `
      SELECT cr.*, cp.company_name as partner_name, d.deal_number, d.prospect_company
      FROM commission_records cr
      LEFT JOIN channel_partners cp ON cp.id = cr.partner_id
      LEFT JOIN deal_registrations d ON d.id = cr.deal_id
      WHERE cr.tenant_id = $1
    `;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (partnerId) { query += ` AND cr.partner_id = $${idx++}`; params.push(partnerId); }
    if (status) { query += ` AND cr.status = $${idx++}`; params.push(status); }

    query += ` ORDER BY cr.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await sql.unsafe(query, params as any[]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Calculate and create commissions when a deal is won
commissionRouter.post("/calculate", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { dealId } = req.body;

    if (!dealId) {
      res.status(400).json({ error: "dealId is required" });
      return;
    }

    // Get deal with partner info
    const dealResult = await sql.unsafe(
      `SELECT d.*, cp.tier as partner_tier, cp.total_revenue as partner_total_revenue
       FROM deal_registrations d
       JOIN channel_partners cp ON cp.id = d.partner_id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [dealId, req.tenantId!],
    );

    const deal = dealResult[0] as any;
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }

    if (deal.status !== "won") {
      res.status(400).json({ error: "Commission can only be calculated for won deals" });
      return;
    }

    // Get commission structures
    const structures = await sql.unsafe(
      `SELECT id, product_code as "productCode", partner_tier as "partnerTier",
              commission_percent as "commissionPercent",
              recurring_percent as "recurringPercent",
              recurring_months as "recurringMonths",
              bonus_threshold as "bonusThreshold",
              bonus_percent as "bonusPercent"
       FROM commission_structures
       WHERE tenant_id = $1 AND is_active = true`,
      [req.tenantId!],
    );

    // Calculate for each product code in the deal
    const productCodes: string[] = Array.isArray(deal.product_codes) ? deal.product_codes : [];
    const dealValue = parseFloat(deal.estimated_value ?? "0");

    if (productCodes.length === 0) {
      // Use a generic "default" product code
      productCodes.push("default");
    }

    const results: CommissionCalculationResult[] = [];

    for (const productCode of productCodes) {
      const result = calculateCommission(
        {
          dealId: deal.id,
          partnerId: deal.partner_id,
          productCode,
          dealValue: dealValue / productCodes.length,
          partnerTier: deal.partner_tier,
          partnerTotalRevenue: parseFloat(deal.partner_total_revenue ?? "0"),
        },
        structures as unknown as CommissionStructureInput[],
      );

      results.push(result);

      // Insert commission record if non-zero
      if (result.totalCommission > 0) {
        await sql.unsafe(
          `INSERT INTO commission_records
            (tenant_id, partner_id, deal_id, structure_id, product_code,
             deal_value, commission_percent, commission_amount,
             is_recurring, status, earned_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'earned', NOW())`,
          [
            req.tenantId!, deal.partner_id, dealId, result.structureId,
            productCode, result.dealValue, result.commissionPercent,
            result.totalCommission, result.recurringCommissions.length > 0,
          ],
        );

        // Insert recurring commission records
        for (const recurring of result.recurringCommissions) {
          await sql.unsafe(
            `INSERT INTO commission_records
              (tenant_id, partner_id, deal_id, structure_id, product_code,
               deal_value, commission_percent, commission_amount,
               is_recurring, recurring_month, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, 'pending')`,
            [
              req.tenantId!, deal.partner_id, dealId, result.structureId,
              productCode, result.dealValue, recurring.percent, recurring.amount,
              recurring.month,
            ],
          );
        }
      }
    }

    const summary = summarizeCommissions(results);

    res.status(201).json({ results, summary });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Mark commission as paid
commissionRouter.patch("/:id/pay", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { paymentReference } = req.body;

    const result = await sql.unsafe(
      `UPDATE commission_records
       SET status = 'paid', paid_at = NOW(), payment_reference = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND status = 'earned'
       RETURNING *`,
      [paymentReference ?? null, req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Commission record not found or not in earned status" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Cancel commission
commissionRouter.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `UPDATE commission_records
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'earned')
       RETURNING *`,
      [req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Commission record not found or already paid/cancelled" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Partner commission summary
commissionRouter.get("/summary/:partnerId", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0)::text as pending,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'earned'), 0)::text as earned,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0)::text as paid,
         COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('earned', 'paid')), 0)::text as total_earned,
         COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
         COUNT(*) FILTER (WHERE status = 'earned')::int as earned_count,
         COUNT(*) FILTER (WHERE status = 'paid')::int as paid_count
       FROM commission_records
       WHERE tenant_id = $1 AND partner_id = $2`,
      [req.tenantId!, req.params.partnerId as string],
    );

    res.json(result[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
