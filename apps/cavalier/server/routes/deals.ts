/**
 * CVG-CAVALIER — Deal Registration Routes
 *
 * Partners register deals. Status: Registered → Qualified → Won → Lost → Expired.
 * Conflict detection when same prospect registered by multiple partners.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getSql } from "../db";
import { detectConflict } from "../services/deals/conflict-detection";

export const dealRouter = Router();

// ─── List deals ────────────────────────────────────────────────────────
dealRouter.get("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { status, partnerId, search, page = "1", pageSize = "50" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    let query = `
      SELECT d.*, cp.company_name as partner_name
      FROM deal_registrations d
      LEFT JOIN channel_partners cp ON cp.id = d.partner_id
      WHERE d.tenant_id = $1
    `;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (status) { query += ` AND d.status = $${idx++}`; params.push(status); }
    if (partnerId) { query += ` AND d.partner_id = $${idx++}`; params.push(partnerId); }
    if (search) {
      query += ` AND (d.prospect_company ILIKE $${idx} OR d.prospect_name ILIKE $${idx} OR d.deal_number ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await sql.unsafe(query, params as any[]);

    const countResult = await sql.unsafe(
      `SELECT COUNT(*)::int as total FROM deal_registrations WHERE tenant_id = $1`,
      [req.tenantId!],
    );

    res.json({
      data: result,
      total: (countResult as any)[0]?.total ?? 0,
      page: parseInt(page as string),
      pageSize: limit,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get single deal ───────────────────────────────────────────────────
dealRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT d.*, cp.company_name as partner_name
       FROM deal_registrations d
       LEFT JOIN channel_partners cp ON cp.id = d.partner_id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Register deal ─────────────────────────────────────────────────────
dealRouter.post("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const {
      partnerId, prospectName, prospectEmail, prospectPhone,
      prospectCompany, prospectDomain, productCodes,
      estimatedValue, estimatedCloseDate, notes,
    } = req.body;

    if (!partnerId || !prospectName || !prospectCompany) {
      res.status(400).json({ error: "partnerId, prospectName, and prospectCompany are required" });
      return;
    }

    // Generate deal number
    const countResult = await sql.unsafe(
      `SELECT COUNT(*)::int + 1 as next_num FROM deal_registrations WHERE tenant_id = $1`,
      [req.tenantId!],
    );
    const nextNum = (countResult as any)[0]?.next_num ?? 1;
    const dealNumber = `DEAL-${String(nextNum).padStart(5, "0")}`;

    // Conflict detection
    const existingDeals = await sql.unsafe(
      `SELECT id, partner_id as "partnerId", prospect_company as "prospectCompany",
              prospect_domain as "prospectDomain", prospect_email as "prospectEmail",
              status, created_at::text as "createdAt"
       FROM deal_registrations
       WHERE tenant_id = $1 AND status NOT IN ('lost', 'expired')`,
      [req.tenantId!],
    );

    const conflict = detectConflict(
      { prospectCompany, prospectDomain, prospectEmail },
      existingDeals as any[],
      partnerId,
    );

    // Set expiration (90 days)
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const result = await sql.unsafe(
      `INSERT INTO deal_registrations
        (tenant_id, partner_id, deal_number, prospect_name, prospect_email,
         prospect_phone, prospect_company, prospect_domain, product_codes,
         estimated_value, estimated_close_date, status, expires_at,
         conflict_detected, conflict_partner_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'registered', $12, $13, $14, $15)
       RETURNING *`,
      [
        req.tenantId!, partnerId, dealNumber, prospectName, prospectEmail ?? null,
        prospectPhone ?? null, prospectCompany, prospectDomain ?? null,
        JSON.stringify(productCodes ?? []), estimatedValue ?? null,
        estimatedCloseDate ?? null, expiresAt.toISOString(),
        conflict.hasConflict, conflict.conflictingDeal?.partnerId ?? null,
        notes ?? null,
      ],
    );

    // Update partner deal count
    await sql.unsafe(
      `UPDATE channel_partners SET total_deals = total_deals + 1, last_activity_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [partnerId, req.tenantId!],
    );

    res.status(201).json({
      deal: result[0],
      conflict: conflict.hasConflict ? {
        detected: true,
        type: conflict.conflictType,
        confidence: conflict.confidence,
        conflictingDealId: conflict.conflictingDeal?.id,
        conflictingPartnerId: conflict.conflictingDeal?.partnerId,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update deal status ────────────────────────────────────────────────
dealRouter.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { status, lostReason } = req.body;
    const validStatuses = ["registered", "qualified", "won", "lost", "expired"];

    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    let extraFields = "";
    const extraParams: unknown[] = [];
    let extraIdx = 4; // first 3 are status, id, tenantId

    if (status === "won") {
      extraFields += `, won_at = NOW()`;
    } else if (status === "lost") {
      extraFields += `, lost_at = NOW()`;
      if (lostReason) {
        extraFields += `, lost_reason = $${extraIdx++}`;
        extraParams.push(lostReason);
      }
    }

    const params = [status, req.params.id as string, req.tenantId!, ...extraParams];

    const result = await sql.unsafe(
      `UPDATE deal_registrations SET status = $1, updated_at = NOW()${extraFields}
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      params as any[],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }

    // Update partner stats on won
    if (status === "won") {
      const deal = result[0] as any;
      await sql.unsafe(
        `UPDATE channel_partners
         SET deals_won = deals_won + 1,
             total_revenue = total_revenue + COALESCE($1::numeric, 0),
             last_activity_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [deal.estimated_value ?? "0", deal.partner_id, req.tenantId!],
      );
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update deal details ───────────────────────────────────────────────
dealRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const allowedFields: Record<string, string> = {
      prospectName: "prospect_name",
      prospectEmail: "prospect_email",
      prospectPhone: "prospect_phone",
      prospectCompany: "prospect_company",
      prospectDomain: "prospect_domain",
      productCodes: "product_codes",
      estimatedValue: "estimated_value",
      estimatedCloseDate: "estimated_close_date",
      notes: "notes",
    };

    const updates: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];
    let idx = 1;

    for (const [camelKey, snakeKey] of Object.entries(allowedFields)) {
      if (req.body[camelKey] !== undefined) {
        const value = camelKey === "productCodes"
          ? JSON.stringify(req.body[camelKey])
          : req.body[camelKey];
        updates.push(`${snakeKey} = $${idx++}`);
        params.push(value);
      }
    }

    if (params.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    params.push(req.params.id as string, req.tenantId!);

    const result = await sql.unsafe(
      `UPDATE deal_registrations SET ${updates.join(", ")}
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING *`,
      params as any[],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Check conflicts for a prospect ───────────────────────────────────
dealRouter.post("/check-conflict", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { prospectCompany, prospectDomain, prospectEmail, partnerId } = req.body;

    const existingDeals = await sql.unsafe(
      `SELECT id, partner_id as "partnerId", prospect_company as "prospectCompany",
              prospect_domain as "prospectDomain", prospect_email as "prospectEmail",
              status, created_at::text as "createdAt"
       FROM deal_registrations
       WHERE tenant_id = $1 AND status NOT IN ('lost', 'expired')`,
      [req.tenantId!],
    );

    const conflict = detectConflict(
      { prospectCompany, prospectDomain, prospectEmail },
      existingDeals as any[],
      partnerId ?? "",
    );

    res.json(conflict);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
