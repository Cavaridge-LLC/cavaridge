/**
 * Captures API — CVG-BRAIN
 *
 * Voice capture endpoint. Receives text or audio transcripts,
 * processes them through knowledge extraction via Ducky.
 *
 * POST /api/v1/captures — Create new capture (text or audio transcript)
 * GET  /api/v1/captures — List captures for tenant/user
 */

import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../db.js";
import { sourceRecordings, knowledgeObjects, entityMentions, relationships } from "../db/schema.js";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { KnowledgeExtractionAgent } from "../agents/knowledge-extraction.js";
import type { AgentContext } from "@cavaridge/agent-core";

const router = Router();
const extractionAgent = new KnowledgeExtractionAgent();

function buildAgentContext(tenantId: string, userId: string): AgentContext {
  return {
    tenantId,
    userId,
    config: {
      agentId: "brain-knowledge-extraction",
      agentName: "Brain Knowledge Extraction Agent",
      appCode: "CVG-BRAIN",
      version: "0.1.0",
    },
    correlationId: crypto.randomUUID(),
  };
}

// Create a new capture from text or audio transcript
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const { text, title, sourceType, contextHint } = req.body as {
    text: string;
    title?: string;
    sourceType?: string;
    contextHint?: string;
  };

  if (!text || text.trim().length < 10) {
    res.status(400).json({ error: "text must be at least 10 characters" });
    return;
  }

  try {
    // 1. Create source recording
    const [recording] = await db
      .insert(sourceRecordings)
      .values({
        tenantId,
        userId,
        title: title || `Capture ${new Date().toLocaleString()}`,
        transcript: text,
        sourceType: (sourceType as "microphone" | "upload" | "email" | "calendar" | "notes" | "connector" | "api") || "api",
        status: "processing",
        metadata: contextHint ? { contextHint } : {},
      })
      .returning();

    // 2. Run knowledge extraction via Ducky
    const context = buildAgentContext(tenantId, userId);
    const extraction = await extractionAgent.runWithAudit({
      data: {
        transcript: text,
        recordingId: recording.id,
        sourceType: (sourceType as "microphone" | "upload" | "meeting" | "connector") || "microphone",
        contextHint,
      },
      context,
    });

    const result = extraction.result;

    // 3. Store knowledge objects
    const storedObjects = [];
    for (const ko of result.knowledgeObjects) {
      const [stored] = await db
        .insert(knowledgeObjects)
        .values({
          tenantId,
          userId,
          recordingId: recording.id,
          type: ko.type,
          content: ko.content,
          summary: ko.summary,
          confidence: ko.confidence,
          tags: ko.tags,
          dueDate: ko.dueDate ? new Date(ko.dueDate) : null,
        })
        .returning();
      storedObjects.push(stored);

      // 4. Store entity mentions for this knowledge object
      for (const entity of ko.entities) {
        await db.insert(entityMentions).values({
          tenantId,
          name: entity.name,
          normalizedName: entity.name.toLowerCase().trim(),
          type: mapEntityType(entity.type),
          knowledgeObjectId: stored.id,
          recordingId: recording.id,
        });
      }
    }

    // 5. Store standalone entities not already captured
    const entityMap = new Map<string, string>();
    for (const entity of result.entities) {
      const normalized = entity.name.toLowerCase().trim();
      if (!entityMap.has(normalized) && storedObjects.length > 0) {
        const [stored] = await db
          .insert(entityMentions)
          .values({
            tenantId,
            name: entity.name,
            normalizedName: normalized,
            type: mapEntityType(entity.type),
            knowledgeObjectId: storedObjects[0].id,
            recordingId: recording.id,
          })
          .returning();
        entityMap.set(normalized, stored.id);
      }
    }

    // 6. Store relationships
    for (const rel of result.relationships) {
      const sourceNorm = rel.sourceEntity.toLowerCase().trim();
      const targetNorm = rel.targetEntity.toLowerCase().trim();
      const sourceId = entityMap.get(sourceNorm);
      const targetId = entityMap.get(targetNorm);

      if (sourceId && targetId) {
        await db.insert(relationships).values({
          tenantId,
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          type: mapRelType(rel.type),
          weight: rel.confidence,
          knowledgeObjectId: storedObjects[0]?.id,
        });
      }
    }

    // 7. Mark recording as completed
    await db
      .update(sourceRecordings)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(sourceRecordings.id, recording.id));

    res.status(201).json({
      capture: {
        id: recording.id,
        title: recording.title,
        sourceType: recording.sourceType,
        status: "completed",
        createdAt: recording.createdAt,
      },
      extraction: {
        knowledgeObjects: storedObjects.length,
        entities: result.entities.length,
        relationships: result.relationships.length,
        languageAnalysis: result.languageAnalysis,
      },
      metadata: {
        executionTimeMs: extraction.metadata.executionTimeMs,
        tokensUsed: extraction.metadata.tokensUsed,
        modelsUsed: extraction.metadata.modelsUsed,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "Capture processing failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// List captures
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { page = "1", limit = "20", sourceType, status } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * pageSize;

  try {
    const conditions = [eq(sourceRecordings.tenantId, tenantId)];
    if (sourceType) {
      conditions.push(eq(sourceRecordings.sourceType, sourceType as "microphone" | "upload" | "email" | "calendar" | "notes" | "connector" | "api"));
    }
    if (status) {
      conditions.push(eq(sourceRecordings.status, status as "recording" | "transcribing" | "processing" | "completed" | "failed"));
    }

    const where = and(...conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(sourceRecordings)
        .where(where)
        .orderBy(desc(sourceRecordings.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(sourceRecordings)
        .where(where),
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
    res.status(500).json({
      error: "Failed to list captures",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────

function mapEntityType(
  type: string,
): "person" | "organization" | "system" | "process" | "decision" | "action_item" | "project" | "technology" | "location" | "date" | "monetary_value" | "document" | "concept" {
  const mapping: Record<string, string> = {
    person: "person",
    organization: "organization",
    system: "system",
    process: "process",
    decision: "decision",
    action_item: "action_item",
    project: "project",
    technology: "technology",
    location: "location",
    date: "date",
    monetary_value: "monetary_value",
    document: "document",
    concept: "concept",
  };
  return (mapping[type] ?? "concept") as ReturnType<typeof mapEntityType>;
}

function mapRelType(
  type: string,
): "owns" | "manages" | "connects_to" | "depends_on" | "decided_by" | "mentioned_in" | "related_to" | "assigned_to" | "part_of" | "follows" | "contradicts" | "supersedes" {
  const mapping: Record<string, string> = {
    owns: "owns",
    manages: "manages",
    connects_to: "connects_to",
    depends_on: "depends_on",
    decided_by: "decided_by",
    mentioned_in: "mentioned_in",
    related_to: "related_to",
    assigned_to: "assigned_to",
    part_of: "part_of",
    follows: "follows",
    contradicts: "contradicts",
    supersedes: "supersedes",
  };
  return (mapping[type] ?? "related_to") as ReturnType<typeof mapRelType>;
}

export default router;
