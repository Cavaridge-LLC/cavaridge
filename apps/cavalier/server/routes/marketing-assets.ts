/**
 * CVG-CAVALIER — Marketing Asset Library Routes
 *
 * Upload/categorize co-branded marketing materials.
 * Access gated by partner tier.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getSql } from "../db";

export const marketingAssetRouter = Router();

// Tier hierarchy for access control
const TIER_HIERARCHY = ["registered", "silver", "gold", "platinum"];

function canAccessTier(partnerTier: string, requiredTier: string): boolean {
  if (requiredTier === "all") return true;
  const partnerIdx = TIER_HIERARCHY.indexOf(partnerTier);
  const requiredIdx = TIER_HIERARCHY.indexOf(requiredTier);
  if (partnerIdx === -1 || requiredIdx === -1) return false;
  return partnerIdx >= requiredIdx;
}

// ─── List assets ───────────────────────────────────────────────────────
marketingAssetRouter.get("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { category, partnerTier, productCode, search } = req.query;

    // Get the requesting partner's tier for access filtering
    const effectiveTier = (partnerTier as string) ?? "registered";

    // Build tier filter: show assets whose access_tier the partner can reach
    const accessibleTiers = TIER_HIERARCHY.slice(0, TIER_HIERARCHY.indexOf(effectiveTier) + 1);
    accessibleTiers.push("all");

    let query = `
      SELECT id, tenant_id, title, description, category, file_url, file_type,
             file_size_bytes, thumbnail_url, access_tier, product_codes, tags,
             download_count, created_at
      FROM marketing_assets
      WHERE tenant_id = $1 AND is_active = true
        AND access_tier = ANY($2)
    `;
    const params: unknown[] = [req.tenantId!, accessibleTiers];
    let idx = 3;

    if (category) { query += ` AND category = $${idx++}`; params.push(category); }
    if (productCode) { query += ` AND product_codes @> $${idx++}::jsonb`; params.push(JSON.stringify([productCode])); }
    if (search) {
      query += ` AND (title ILIKE $${idx} OR description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await sql.unsafe(query, params as any[]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get single asset ──────────────────────────────────────────────────
marketingAssetRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT * FROM marketing_assets WHERE id = $1 AND tenant_id = $2`,
      [req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Create asset ──────────────────────────────────────────────────────
marketingAssetRouter.post("/", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const {
      title, description, category, fileUrl, fileType,
      fileSizeBytes, thumbnailUrl, accessTier, productCodes, tags,
    } = req.body;

    if (!title || !category || !fileUrl || !fileType) {
      res.status(400).json({ error: "title, category, fileUrl, and fileType are required" });
      return;
    }

    const validTiers = [...TIER_HIERARCHY, "all"];
    if (accessTier && !validTiers.includes(accessTier)) {
      res.status(400).json({ error: `Invalid accessTier. Must be one of: ${validTiers.join(", ")}` });
      return;
    }

    const result = await sql.unsafe(
      `INSERT INTO marketing_assets
        (tenant_id, title, description, category, file_url, file_type,
         file_size_bytes, thumbnail_url, access_tier, product_codes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.tenantId!, title, description ?? null, category, fileUrl, fileType,
        fileSizeBytes ?? null, thumbnailUrl ?? null, accessTier ?? "all",
        JSON.stringify(productCodes ?? []), JSON.stringify(tags ?? []),
      ],
    );

    res.status(201).json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update asset ──────────────────────────────────────────────────────
marketingAssetRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const allowedFields: Record<string, string> = {
      title: "title",
      description: "description",
      category: "category",
      fileUrl: "file_url",
      fileType: "file_type",
      fileSizeBytes: "file_size_bytes",
      thumbnailUrl: "thumbnail_url",
      accessTier: "access_tier",
      productCodes: "product_codes",
      tags: "tags",
      isActive: "is_active",
    };

    const updates: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];
    let idx = 1;

    for (const [camelKey, snakeKey] of Object.entries(allowedFields)) {
      if (req.body[camelKey] !== undefined) {
        const value = (camelKey === "productCodes" || camelKey === "tags")
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
      `UPDATE marketing_assets SET ${updates.join(", ")}
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING *`,
      params as any[],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Record download ───────────────────────────────────────────────────
marketingAssetRouter.post("/:id/download", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `UPDATE marketing_assets SET download_count = download_count + 1
       WHERE id = $1 AND tenant_id = $2
       RETURNING file_url, title`,
      [req.params.id as string, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Delete asset ──────────────────────────────────────────────────────
marketingAssetRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    await sql.unsafe(
      `DELETE FROM marketing_assets WHERE id = $1 AND tenant_id = $2`,
      [req.params.id as string, req.tenantId!],
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── List categories ───────────────────────────────────────────────────
marketingAssetRouter.get("/meta/categories", async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT DISTINCT category, COUNT(*)::int as count
       FROM marketing_assets
       WHERE tenant_id = $1 AND is_active = true
       GROUP BY category
       ORDER BY category`,
      [req.tenantId!],
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
