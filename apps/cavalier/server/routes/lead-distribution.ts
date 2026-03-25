/**
 * CVG-CAVALIER — Lead Distribution Routes
 *
 * Inbound leads distributed to partners by geography, specialization, tier.
 * Round-robin with weighted priority.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getSql } from "../db";
import { rankPartnersForLead, selectRoundRobin, type PartnerCandidate } from "../services/leads/distribution";

export const leadDistributionRouter = Router();

// ─── List leads ────────────────────────────────────────────────────────
leadDistributionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { status, partnerId, geography, page = "1", pageSize = "50" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    let query = `
      SELECT l.*, cp.company_name as assigned_partner_name
      FROM leads l
      LEFT JOIN channel_partners cp ON cp.id = l.assigned_partner_id
      WHERE l.tenant_id = $1
    `;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (status) { query += ` AND l.status = $${idx++}`; params.push(status); }
    if (partnerId) { query += ` AND l.assigned_partner_id = $${idx++}`; params.push(partnerId); }
    if (geography) { query += ` AND l.geography ILIKE $${idx++}`; params.push(`%${geography}%`); }

    query += ` ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await sql.unsafe(query, params as any[]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Create and auto-distribute lead ───────────────────────────────────
leadDistributionRouter.post("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const {
      prospectName, prospectEmail, prospectPhone, prospectCompany,
      geography, productInterest, source, score, autoAssign = true,
    } = req.body;

    if (!prospectName || !prospectCompany) {
      res.status(400).json({ error: "prospectName and prospectCompany are required" });
      return;
    }

    // Generate lead number
    const countResult = await sql.unsafe(
      `SELECT COUNT(*)::int + 1 as next_num FROM leads WHERE tenant_id = $1`,
      [req.tenantId!],
    );
    const nextNum = (countResult as any)[0]?.next_num ?? 1;
    const leadNumber = `LEAD-${String(nextNum).padStart(5, "0")}`;

    // Expiration: 14 days
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    let assignedPartnerId: string | null = null;
    let assignedAt: string | null = null;
    let leadStatus = "new";

    // Auto-assign if requested
    if (autoAssign) {
      const partnerResult = await sql.unsafe(
        `SELECT id, company_name as "companyName", tier, geography,
                specializations, round_robin_weight as "roundRobinWeight", status
         FROM channel_partners
         WHERE tenant_id = $1 AND status = 'active'`,
        [req.tenantId!],
      );

      const partners: PartnerCandidate[] = (partnerResult as any[]).map((p) => ({
        ...p,
        specializations: Array.isArray(p.specializations) ? p.specializations : [],
      }));

      if (partners.length > 0) {
        const ranked = rankPartnersForLead(
          { geography, productInterest: productInterest ?? [] },
          partners,
        );

        // Get round-robin state for geography
        const geoKey = (geography ?? "global").toLowerCase();
        const rrState = await sql.unsafe(
          `SELECT last_partner_id as "lastPartnerId"
           FROM round_robin_state
           WHERE tenant_id = $1 AND geography = $2`,
          [req.tenantId!, geoKey],
        );

        const lastPartnerId = (rrState as any)[0]?.lastPartnerId ?? null;
        const selected = selectRoundRobin(ranked, lastPartnerId);

        if (selected) {
          assignedPartnerId = selected.partnerId;
          assignedAt = new Date().toISOString();
          leadStatus = "assigned";

          // Update round-robin state
          await sql.unsafe(
            `INSERT INTO round_robin_state (tenant_id, geography, last_partner_id, last_assigned_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT ON CONSTRAINT uq_round_robin_geo
             DO UPDATE SET last_partner_id = EXCLUDED.last_partner_id, last_assigned_at = NOW()`,
            [req.tenantId!, geoKey, assignedPartnerId],
          );
        }
      }
    }

    const result = await sql.unsafe(
      `INSERT INTO leads
        (tenant_id, lead_number, prospect_name, prospect_email, prospect_phone,
         prospect_company, geography, product_interest, source, status,
         assigned_partner_id, assigned_at, score, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.tenantId!, leadNumber, prospectName, prospectEmail ?? null,
        prospectPhone ?? null, prospectCompany, geography ?? null,
        JSON.stringify(productInterest ?? []), source ?? null,
        leadStatus, assignedPartnerId, assignedAt,
        score ?? null, expiresAt.toISOString(),
      ],
    );

    res.status(201).json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Manually assign lead ──────────────────────────────────────────────
leadDistributionRouter.post("/:id/assign", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { partnerId } = req.body;

    if (!partnerId) {
      res.status(400).json({ error: "partnerId is required" });
      return;
    }

    const result = await sql.unsafe(
      `UPDATE leads
       SET assigned_partner_id = $1, assigned_at = NOW(), status = 'assigned', updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [partnerId, req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Partner accepts lead ──────────────────────────────────────────────
leadDistributionRouter.post("/:id/accept", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `UPDATE leads
       SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'assigned'
       RETURNING *`,
      [req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Lead not found or not in assigned status" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Partner rejects lead ──────────────────────────────────────────────
leadDistributionRouter.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { reason } = req.body;

    const result = await sql.unsafe(
      `UPDATE leads
       SET status = 'rejected', rejected_at = NOW(), rejected_reason = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND status = 'assigned'
       RETURNING *`,
      [reason ?? null, req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Lead not found or not in assigned status" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Convert lead to deal ──────────────────────────────────────────────
leadDistributionRouter.post("/:id/convert", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { dealId } = req.body;

    const result = await sql.unsafe(
      `UPDATE leads
       SET status = 'converted', converted_deal_id = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND status IN ('accepted', 'assigned')
       RETURNING *`,
      [dealId ?? null, req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Lead not found or not in convertible status" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Preview distribution (dry run) ───────────────────────────────────
leadDistributionRouter.post("/preview-distribution", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { geography, productInterest } = req.body;

    const partnerResult = await sql.unsafe(
      `SELECT id, company_name as "companyName", tier, geography,
              specializations, round_robin_weight as "roundRobinWeight", status
       FROM channel_partners
       WHERE tenant_id = $1 AND status = 'active'`,
      [req.tenantId!],
    );

    const partners: PartnerCandidate[] = (partnerResult as any[]).map((p) => ({
      ...p,
      specializations: Array.isArray(p.specializations) ? p.specializations : [],
    }));

    const ranked = rankPartnersForLead(
      { geography, productInterest: productInterest ?? [] },
      partners,
    );

    res.json({ ranked });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
