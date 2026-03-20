/**
 * Knowledge Objects API — CVG-BRAIN
 *
 * CRUD for knowledge objects, entities, and relationships.
 * GET /api/v1/knowledge — List knowledge objects (filterable)
 * GET /api/v1/knowledge/:id — Get single knowledge object with entities
 * PATCH /api/v1/knowledge/:id — Update knowledge object (resolve, edit, retag)
 * DELETE /api/v1/knowledge/:id — Delete knowledge object
 * GET /api/v1/knowledge/entities — List unique entities
 * GET /api/v1/knowledge/entities/:id/graph — Get entity relationship graph
 * GET /api/v1/knowledge/timeline — Chronological timeline view
 * GET /api/v1/knowledge/stats — Knowledge base statistics
 */

import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

function getTenantContext(req: Request) {
  return {
    tenantId: (req as Record<string, unknown>).tenantId as string || req.headers["x-tenant-id"] as string || "",
    userId: (req as Record<string, unknown>).userId as string || req.headers["x-user-id"] as string || "",
  };
}

// List knowledge objects with filters
router.get("/", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const {
    type,
    tags,
    entityName,
    dateFrom,
    dateTo,
    isResolved,
    page = "1",
    limit = "20",
    sort = "createdAt",
    order = "desc",
  } = req.query as Record<string, string>;

  // In production: Drizzle query with filters against brain_knowledge_objects
  // JOIN brain_entity_mentions for entity filtering
  // WHERE tenant_id = $tenantId
  // AND type = $type (if provided)
  // AND tags @> $tags::jsonb (if provided)
  // AND created_at BETWEEN $dateFrom AND $dateTo (if provided)
  // AND is_resolved = $isResolved (if provided)

  res.json({
    data: [],
    total: 0,
    page: parseInt(page, 10),
    pageSize: parseInt(limit, 10),
    hasMore: false,
    filters: { type, tags, entityName, dateFrom, dateTo, isResolved },
  });
});

// Get single knowledge object with its entities and relationships
router.get("/:id", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  // In production:
  // SELECT ko.*, array_agg(em.*) as entities, array_agg(rel.*) as relationships
  // FROM brain_knowledge_objects ko
  // LEFT JOIN brain_entity_mentions em ON em.knowledge_object_id = ko.id
  // LEFT JOIN brain_relationships rel ON rel.knowledge_object_id = ko.id
  // WHERE ko.id = $id AND ko.tenant_id = $tenantId

  res.json({
    id: req.params.id,
    tenantId,
    entities: [],
    relationships: [],
  });
});

// Update knowledge object
router.patch("/:id", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const { content, summary, tags, isResolved, dueDate } = req.body as {
    content?: string;
    summary?: string;
    tags?: string[];
    isResolved?: boolean;
    dueDate?: string;
  };

  // In production: UPDATE brain_knowledge_objects SET ... WHERE id = $id AND tenant_id = $tenantId
  // If isResolved changed to true, set resolved_at = now()
  // If content changed, regenerate embedding

  res.json({
    id: req.params.id,
    content,
    summary,
    tags,
    isResolved,
    dueDate,
    updatedAt: new Date().toISOString(),
  });
});

// Delete knowledge object (cascades to entities and relationships)
router.delete("/:id", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  // In production: DELETE FROM brain_knowledge_objects WHERE id = $id AND tenant_id = $tenantId
  // Cascades via FK to entity_mentions and relationships

  res.status(204).send();
});

// List unique entities across knowledge base
router.get("/entities", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const { type, search, page = "1", limit = "50" } = req.query as Record<string, string>;

  // In production:
  // SELECT normalized_name, type, COUNT(*) as mention_count
  // FROM brain_entity_mentions
  // WHERE tenant_id = $tenantId
  // GROUP BY normalized_name, type
  // ORDER BY mention_count DESC

  res.json({
    data: [],
    total: 0,
    page: parseInt(page, 10),
    pageSize: parseInt(limit, 10),
  });
});

// Get entity relationship graph (for visualization)
router.get("/entities/:id/graph", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const { depth = "2" } = req.query as Record<string, string>;

  // In production: Recursive CTE query to build graph from brain_relationships
  // Starting from entity $id, traverse $depth levels
  // Return nodes (entities) and edges (relationships)

  res.json({
    nodes: [],
    edges: [],
    depth: parseInt(depth, 10),
    rootEntityId: req.params.id,
  });
});

// Knowledge timeline — chronological view
router.get("/timeline", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const { dateFrom, dateTo, groupBy = "day" } = req.query as Record<string, string>;

  // In production:
  // SELECT date_trunc($groupBy, created_at) as period,
  //   type, COUNT(*) as count
  // FROM brain_knowledge_objects WHERE tenant_id = $tenantId
  // GROUP BY period, type ORDER BY period DESC

  res.json({
    timeline: [],
    groupBy,
    dateFrom,
    dateTo,
  });
});

// Knowledge base statistics
router.get("/stats", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  // In production: Aggregate queries across all brain tables

  res.json({
    totalRecordings: 0,
    totalKnowledgeObjects: 0,
    totalEntities: 0,
    totalRelationships: 0,
    byType: {
      fact: 0,
      decision: 0,
      action_item: 0,
      question: 0,
      insight: 0,
      meeting_note: 0,
      reference: 0,
    },
    unresolvedActionItems: 0,
    openQuestions: 0,
    topEntities: [],
    recentActivity: [],
  });
});

export default router;
