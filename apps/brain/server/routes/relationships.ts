/**
 * Relationships API — CVG-BRAIN
 *
 * CRUD for entity relationships in the knowledge graph.
 * GET /api/v1/relationships — List relationships
 * GET /api/v1/relationships/:id — Get single relationship
 * POST /api/v1/relationships — Create relationship
 * PATCH /api/v1/relationships/:id — Update relationship
 * DELETE /api/v1/relationships/:id — Delete relationship
 */

import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../db.js";
import { relationships, entityMentions } from "../db/schema.js";
import { eq, and, desc, count } from "drizzle-orm";

const router = Router();

function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

// List relationships
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { type, page = "1", limit = "50" } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  try {
    const conditions = [eq(relationships.tenantId, tenantId)];
    if (type) {
      conditions.push(eq(relationships.type, type as "owns" | "manages" | "connects_to" | "depends_on" | "decided_by" | "mentioned_in" | "related_to" | "assigned_to" | "part_of" | "follows" | "contradicts" | "supersedes"));
    }

    const where = and(...conditions);

    const [data, totalResult] = await Promise.all([
      db.select().from(relationships).where(where).orderBy(desc(relationships.createdAt)).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(relationships).where(where),
    ]);

    const total = totalResult[0]?.total ?? 0;

    res.json({
      data,
      total,
      page: pageNum,
      pageSize,
      hasMore: offset + pageSize < total,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list relationships", details: err instanceof Error ? err.message : String(err) });
  }
});

// Get single relationship
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [rel] = await db
      .select()
      .from(relationships)
      .where(and(eq(relationships.id, paramStr(req.params.id)), eq(relationships.tenantId, tenantId)));

    if (!rel) {
      res.status(404).json({ error: "Relationship not found" });
      return;
    }

    // Fetch source and target entities
    const [source, target] = await Promise.all([
      db.select().from(entityMentions).where(eq(entityMentions.id, rel.sourceEntityId)),
      db.select().from(entityMentions).where(eq(entityMentions.id, rel.targetEntityId)),
    ]);

    res.json({
      ...rel,
      sourceEntity: source[0] ?? null,
      targetEntity: target[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get relationship", details: err instanceof Error ? err.message : String(err) });
  }
});

// Create relationship
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  const { sourceEntityId, targetEntityId, type, weight, knowledgeObjectId, metadata } = req.body as {
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    weight?: number;
    knowledgeObjectId?: string;
    metadata?: Record<string, unknown>;
  };

  if (!sourceEntityId || !targetEntityId || !type) {
    res.status(400).json({ error: "sourceEntityId, targetEntityId, and type are required" });
    return;
  }

  try {
    // Verify entities exist and belong to tenant
    const [source] = await db.select().from(entityMentions).where(and(eq(entityMentions.id, sourceEntityId), eq(entityMentions.tenantId, tenantId)));
    const [target] = await db.select().from(entityMentions).where(and(eq(entityMentions.id, targetEntityId), eq(entityMentions.tenantId, tenantId)));

    if (!source || !target) {
      res.status(404).json({ error: "Source or target entity not found in this tenant" });
      return;
    }

    const [created] = await db
      .insert(relationships)
      .values({
        tenantId,
        sourceEntityId,
        targetEntityId,
        type: type as "owns" | "manages" | "connects_to" | "depends_on" | "decided_by" | "mentioned_in" | "related_to" | "assigned_to" | "part_of" | "follows" | "contradicts" | "supersedes",
        weight: weight ?? 1.0,
        knowledgeObjectId: knowledgeObjectId ?? null,
        metadata: metadata ?? {},
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create relationship", details: err instanceof Error ? err.message : String(err) });
  }
});

// Update relationship
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  const { type, weight, metadata } = req.body as {
    type?: string;
    weight?: number;
    metadata?: Record<string, unknown>;
  };

  try {
    const updates: Record<string, unknown> = {};
    if (type !== undefined) updates.type = type;
    if (weight !== undefined) updates.weight = weight;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db
      .update(relationships)
      .set(updates)
      .where(and(eq(relationships.id, paramStr(req.params.id)), eq(relationships.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Relationship not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update relationship", details: err instanceof Error ? err.message : String(err) });
  }
});

// Delete relationship
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [deleted] = await db
      .delete(relationships)
      .where(and(eq(relationships.id, paramStr(req.params.id)), eq(relationships.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Relationship not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete relationship", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
