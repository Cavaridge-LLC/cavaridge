/**
 * Knowledge Objects API — CVG-BRAIN
 *
 * CRUD for knowledge objects.
 * GET /api/v1/knowledge — List knowledge objects (filterable)
 * GET /api/v1/knowledge/:id — Get single knowledge object with entities
 * PATCH /api/v1/knowledge/:id — Update knowledge object (resolve, edit, retag)
 * DELETE /api/v1/knowledge/:id — Delete knowledge object
 * GET /api/v1/knowledge/timeline — Chronological timeline view
 * GET /api/v1/knowledge/stats — Knowledge base statistics
 */

import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../db.js";
import {
  knowledgeObjects,
  entityMentions,
  relationships,
  sourceRecordings,
} from "../db/schema.js";
import { eq, and, desc, asc, count, sql, gte, lte } from "drizzle-orm";

const router = Router();

/** Extract route param as string (Express 5 params are string | string[]) */
function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

// List knowledge objects with filters
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  const {
    type,
    dateFrom,
    dateTo,
    isResolved,
    page = "1",
    limit = "20",
    sort = "createdAt",
    order = "desc",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  try {
    const conditions = [eq(knowledgeObjects.tenantId, tenantId)];

    if (type) {
      conditions.push(eq(knowledgeObjects.type, type as "fact" | "decision" | "action_item" | "question" | "insight" | "meeting_note" | "reference"));
    }
    if (dateFrom) {
      conditions.push(gte(knowledgeObjects.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(knowledgeObjects.createdAt, new Date(dateTo)));
    }
    if (isResolved === "true") {
      conditions.push(eq(knowledgeObjects.isResolved, true));
    } else if (isResolved === "false") {
      conditions.push(eq(knowledgeObjects.isResolved, false));
    }

    const where = and(...conditions);
    const orderBy = order === "asc"
      ? asc(sort === "type" ? knowledgeObjects.type : knowledgeObjects.createdAt)
      : desc(sort === "type" ? knowledgeObjects.type : knowledgeObjects.createdAt);

    const [data, totalResult] = await Promise.all([
      db.select().from(knowledgeObjects).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(knowledgeObjects).where(where),
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
    res.status(500).json({ error: "Failed to list knowledge objects", details: err instanceof Error ? err.message : String(err) });
  }
});

// Get single knowledge object with its entities and relationships
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [ko] = await db
      .select()
      .from(knowledgeObjects)
      .where(and(eq(knowledgeObjects.id, paramStr(paramStr(req.params.id))), eq(knowledgeObjects.tenantId, tenantId)));

    if (!ko) {
      res.status(404).json({ error: "Knowledge object not found" });
      return;
    }

    const entities = await db
      .select()
      .from(entityMentions)
      .where(eq(entityMentions.knowledgeObjectId, ko.id));

    const entityIds = entities.map((e) => e.id);
    let rels: typeof relationships.$inferSelect[] = [];
    if (entityIds.length > 0) {
      rels = await db
        .select()
        .from(relationships)
        .where(eq(relationships.knowledgeObjectId, ko.id));
    }

    res.json({
      ...ko,
      entities,
      relationships: rels,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get knowledge object", details: err instanceof Error ? err.message : String(err) });
  }
});

// Update knowledge object
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  const { content, summary, tags, isResolved, dueDate } = req.body as {
    content?: string;
    summary?: string;
    tags?: string[];
    isResolved?: boolean;
    dueDate?: string;
  };

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (content !== undefined) updates.content = content;
    if (summary !== undefined) updates.summary = summary;
    if (tags !== undefined) updates.tags = tags;
    if (isResolved !== undefined) {
      updates.isResolved = isResolved;
      if (isResolved) updates.resolvedAt = new Date();
    }
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;

    const [updated] = await db
      .update(knowledgeObjects)
      .set(updates)
      .where(and(eq(knowledgeObjects.id, paramStr(req.params.id)), eq(knowledgeObjects.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Knowledge object not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update knowledge object", details: err instanceof Error ? err.message : String(err) });
  }
});

// Delete knowledge object (cascades to entities and relationships)
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const [deleted] = await db
      .delete(knowledgeObjects)
      .where(and(eq(knowledgeObjects.id, paramStr(req.params.id)), eq(knowledgeObjects.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Knowledge object not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete knowledge object", details: err instanceof Error ? err.message : String(err) });
  }
});

// Knowledge timeline — chronological view
router.get("/timeline", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { dateFrom, dateTo, groupBy = "day" } = req.query as Record<string, string>;

  try {
    const conditions = [eq(knowledgeObjects.tenantId, tenantId)];
    if (dateFrom) conditions.push(gte(knowledgeObjects.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(knowledgeObjects.createdAt, new Date(dateTo)));

    const where = and(...conditions);

    const data = await db
      .select()
      .from(knowledgeObjects)
      .where(where)
      .orderBy(desc(knowledgeObjects.createdAt))
      .limit(200);

    res.json({
      timeline: data,
      groupBy,
      total: data.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get timeline", details: err instanceof Error ? err.message : String(err) });
  }
});

// Knowledge base statistics
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    const tenantWhere = eq(knowledgeObjects.tenantId, tenantId);
    const recWhere = eq(sourceRecordings.tenantId, tenantId);
    const entWhere = eq(entityMentions.tenantId, tenantId);
    const relWhere = eq(relationships.tenantId, tenantId);

    const [totalKo, totalRec, totalEnt, totalRel, unresolvedItems] = await Promise.all([
      db.select({ total: count() }).from(knowledgeObjects).where(tenantWhere),
      db.select({ total: count() }).from(sourceRecordings).where(recWhere),
      db.select({ total: count() }).from(entityMentions).where(entWhere),
      db.select({ total: count() }).from(relationships).where(relWhere),
      db.select({ total: count() }).from(knowledgeObjects).where(
        and(tenantWhere, eq(knowledgeObjects.type, "action_item"), eq(knowledgeObjects.isResolved, false)),
      ),
    ]);

    res.json({
      totalRecordings: totalRec[0]?.total ?? 0,
      totalKnowledgeObjects: totalKo[0]?.total ?? 0,
      totalEntities: totalEnt[0]?.total ?? 0,
      totalRelationships: totalRel[0]?.total ?? 0,
      unresolvedActionItems: unresolvedItems[0]?.total ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get stats", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
