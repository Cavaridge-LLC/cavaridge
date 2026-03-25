/**
 * CVG-CAVALIER — Channel Partner Management Routes
 *
 * CRUD for channel partners (MSPs reselling Cavaridge).
 * Partner profiles, tiers (Registered, Silver, Gold, Platinum),
 * status lifecycle (pending → approved → active → suspended → inactive).
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getSql } from "../db";

export const channelPartnerRouter = Router();

// ─── List partners ─────────────────────────────────────────────────────
channelPartnerRouter.get("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { tier, status, geography, search, page = "1", pageSize = "50" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    let query = `SELECT * FROM channel_partners WHERE tenant_id = $1`;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (tier) { query += ` AND tier = $${idx++}`; params.push(tier); }
    if (status) { query += ` AND status = $${idx++}`; params.push(status); }
    if (geography) { query += ` AND geography ILIKE $${idx++}`; params.push(`%${geography}%`); }
    if (search) {
      query += ` AND (company_name ILIKE $${idx} OR contact_name ILIKE $${idx} OR contact_email ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await sql.unsafe(query, params as any[]);

    const countResult = await sql.unsafe(
      `SELECT COUNT(*)::int as total FROM channel_partners WHERE tenant_id = $1`,
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

// ─── Get single partner ────────────────────────────────────────────────
channelPartnerRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT * FROM channel_partners WHERE id = $1 AND tenant_id = $2`,
      [req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Partner not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Create partner ────────────────────────────────────────────────────
channelPartnerRouter.post("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const {
      companyName, contactName, contactEmail, contactPhone,
      website, tier = "registered", geography, specializations,
      certifications, techCount, notes,
    } = req.body;

    if (!companyName || !contactName || !contactEmail) {
      res.status(400).json({ error: "companyName, contactName, and contactEmail are required" });
      return;
    }

    const result = await sql.unsafe(
      `INSERT INTO channel_partners
        (tenant_id, company_name, contact_name, contact_email, contact_phone,
         website, tier, status, geography, specializations, certifications,
         tech_count, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.tenantId!, companyName, contactName, contactEmail, contactPhone ?? null,
        website ?? null, tier, geography ?? null,
        JSON.stringify(specializations ?? []), JSON.stringify(certifications ?? []),
        techCount ?? 1, notes ?? null,
      ],
    );

    res.status(201).json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update partner ────────────────────────────────────────────────────
channelPartnerRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const allowedFields: Record<string, string> = {
      companyName: "company_name",
      contactName: "contact_name",
      contactEmail: "contact_email",
      contactPhone: "contact_phone",
      website: "website",
      geography: "geography",
      specializations: "specializations",
      certifications: "certifications",
      techCount: "tech_count",
      roundRobinWeight: "round_robin_weight",
      assignedPsm: "assigned_psm",
      notes: "notes",
    };

    const updates: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];
    let idx = 1;

    for (const [camelKey, snakeKey] of Object.entries(allowedFields)) {
      if (req.body[camelKey] !== undefined) {
        const value = (camelKey === "specializations" || camelKey === "certifications")
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
      `UPDATE channel_partners SET ${updates.join(", ")}
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING *`,
      params as any[],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Partner not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update partner tier ───────────────────────────────────────────────
channelPartnerRouter.patch("/:id/tier", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { tier } = req.body;
    const validTiers = ["registered", "silver", "gold", "platinum"];

    if (!validTiers.includes(tier)) {
      res.status(400).json({ error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` });
      return;
    }

    const result = await sql.unsafe(
      `UPDATE channel_partners SET tier = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [tier, req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Partner not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update partner status ─────────────────────────────────────────────
channelPartnerRouter.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { status } = req.body;
    const validStatuses = ["pending", "approved", "active", "suspended", "inactive"];

    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    const extraFields = status === "active" ? ", onboarded_at = COALESCE(onboarded_at, NOW())" : "";

    const result = await sql.unsafe(
      `UPDATE channel_partners SET status = $1, updated_at = NOW()${extraFields}
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [status, req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Partner not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Delete partner ────────────────────────────────────────────────────
channelPartnerRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    await sql.unsafe(
      `DELETE FROM channel_partners WHERE id = $1 AND tenant_id = $2`,
      [req.params.id as string, req.tenantId!],
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
