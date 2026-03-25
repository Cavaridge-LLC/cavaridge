/**
 * Entities API — CVG-BRAIN
 *
 * CRUD for entities in the knowledge graph.
 * GET /api/v1/entities — List entities
 * GET /api/v1/entities/:id — Get single entity
 * GET /api/v1/entities/:id/graph — Get entity relationship graph
 * PATCH /api/v1/entities/:id — Update entity
 * DELETE /api/v1/entities/:id — Delete entity
 */

import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../db.js";
import { entityMentions, relationships } from "../db/schema.js";
import { eq, and, or, desc, count, ilike } from "drizzle-orm";

const router = Router();

function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

// List entities
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { type, search, page = "1", limit = "50" } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  try {
    const conditions = [eq(entityMentions.tenantId, tenantId)];
    if (type) {
      conditions.push(eq(entityMentions.type, type as "person" | "organization" | "system" | "process" | "decision" | "action_item" | "project" | "technology" | "location" | "date" | "monetary_value" | "document" | "concept"));
    }
    if (search) {
      conditions.push(ilike(entityMentions.normalizedName, `%${search.toLowerCase()}%`));
    }

    const where = and(...conditions);

    const [data, totalResult] = await Promise.all([
      db.select().from(entityMentions).where(where).orderBy(desc(entityMentions.createdAt)).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(entityMentions).where(where),
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
    res.status(500).json({ error: "Failed to list entities", details: err instanceof Error ? err.message : String(err) });
  }
});

// Get single entity
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [entity] = await db
      .select()
      .from(entityMentions)
      .where(and(eq(entityMentions.id, paramStr(req.params.id)), eq(entityMentions.tenantId, tenantId)));

    if (!entity) {
      res.status(404).json({ error: "Entity not found" });
      return;
    }

    res.json(entity);
  } catch (err) {
    res.status(500).json({ error: "Failed to get entity", details: err instanceof Error ? err.message : String(err) });
  }
});

// Get entity relationship graph
router.get("/:id/graph", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { depth = "2" } = req.query as Record<string, string>;
  const maxDepth = Math.min(5, Math.max(1, parseInt(depth, 10)));

  try {
    const [entity] = await db
      .select()
      .from(entityMentions)
      .where(and(eq(entityMentions.id, paramStr(req.params.id)), eq(entityMentions.tenantId, tenantId)));

    if (!entity) {
      res.status(404).json({ error: "Entity not found" });
      return;
    }

    // Collect nodes and edges via BFS
    const visited = new Set<string>([entity.id]);
    const nodes = [entity];
    const edges: typeof relationships.$inferSelect[] = [];
    let frontier = [entity.id];

    for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
      const nextFrontier: string[] = [];

      for (const nodeId of frontier) {
        const rels = await db
          .select()
          .from(relationships)
          .where(
            and(
              eq(relationships.tenantId, tenantId),
              or(
                eq(relationships.sourceEntityId, nodeId),
                eq(relationships.targetEntityId, nodeId),
              ),
            ),
          );

        for (const rel of rels) {
          edges.push(rel);
          const neighborId = rel.sourceEntityId === nodeId ? rel.targetEntityId : rel.sourceEntityId;

          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextFrontier.push(neighborId);

            const [neighbor] = await db
              .select()
              .from(entityMentions)
              .where(eq(entityMentions.id, neighborId));

            if (neighbor) {
              nodes.push(neighbor);
            }
          }
        }
      }

      frontier = nextFrontier;
    }

    res.json({
      nodes,
      edges,
      depth: maxDepth,
      rootEntityId: paramStr(req.params.id),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get entity graph", details: err instanceof Error ? err.message : String(err) });
  }
});

// Update entity
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  const { name, type, metadata } = req.body as {
    name?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      updates.name = name;
      updates.normalizedName = name.toLowerCase().trim();
    }
    if (type !== undefined) updates.type = type;
    if (metadata !== undefined) updates.metadata = metadata;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db
      .update(entityMentions)
      .set(updates)
      .where(and(eq(entityMentions.id, paramStr(req.params.id)), eq(entityMentions.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Entity not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update entity", details: err instanceof Error ? err.message : String(err) });
  }
});

// Delete entity
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [deleted] = await db
      .delete(entityMentions)
      .where(and(eq(entityMentions.id, paramStr(req.params.id)), eq(entityMentions.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Entity not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete entity", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
