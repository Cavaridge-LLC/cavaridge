/**
 * Recall API — CVG-BRAIN
 *
 * Natural language query interface through Ducky -> Spaniel.
 * POST /api/v1/recall — Ask a question, get knowledge-backed answer
 * POST /api/v1/recall/search — Semantic search without synthesis
 */

import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { RecallAgent } from "../agents/recall.js";
import { generateEmbedding } from "@cavaridge/spaniel";
import type { AgentContext } from "@cavaridge/agent-core";
import { db } from "../db.js";
import { knowledgeObjects, entityMentions } from "../db/schema.js";
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";

const router = Router();
const recallAgent = new RecallAgent();

function buildAgentContext(tenantId: string, userId: string): AgentContext {
  return {
    tenantId,
    userId,
    config: {
      agentId: "brain-recall",
      agentName: "Brain Recall Agent",
      appCode: "CVG-BRAIN",
      version: "0.1.0",
    },
    correlationId: crypto.randomUUID(),
  };
}

// Natural language recall
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const { query, filters, maxResults = 10 } = req.body as {
    query: string;
    filters?: {
      type?: string[];
      tags?: string[];
      dateFrom?: string;
      dateTo?: string;
      entityName?: string;
    };
    maxResults?: number;
  };

  if (!query || query.trim().length < 3) {
    res.status(400).json({ error: "query must be at least 3 characters" });
    return;
  }

  try {
    const context = buildAgentContext(tenantId, userId);

    // Generate query embedding for vector search
    let queryEmbedding: number[] | undefined;
    try {
      const embeddings = await generateEmbedding(query, {
        tenantId,
        userId,
        appCode: "CVG-BRAIN",
      });
      queryEmbedding = embeddings[0];
    } catch {
      // Embedding failed — fall back to text search
    }

    // Fetch matching knowledge objects
    let sources: Array<{
      id: string;
      type: string;
      content: string;
      summary: string;
      confidence: number;
      similarity: number;
      tags: string[];
      entities: Array<{ name: string; type: string }>;
      createdAt: string;
      recordingId?: string;
    }> = [];

    if (queryEmbedding) {
      // Vector similarity search using pgvector
      const vectorStr = `[${queryEmbedding.join(",")}]`;
      const rows = await db
        .select({
          id: knowledgeObjects.id,
          type: knowledgeObjects.type,
          content: knowledgeObjects.content,
          summary: knowledgeObjects.summary,
          confidence: knowledgeObjects.confidence,
          tags: knowledgeObjects.tags,
          createdAt: knowledgeObjects.createdAt,
          recordingId: knowledgeObjects.recordingId,
          similarity: sql<number>`1 - (${knowledgeObjects.embedding} <=> ${vectorStr}::vector)`.as("similarity"),
        })
        .from(knowledgeObjects)
        .where(
          and(
            eq(knowledgeObjects.tenantId, tenantId),
            sql`${knowledgeObjects.embedding} IS NOT NULL`,
          ),
        )
        .orderBy(sql`${knowledgeObjects.embedding} <=> ${vectorStr}::vector`)
        .limit(maxResults);

      for (const row of rows) {
        const entities = await db
          .select({ name: entityMentions.name, type: entityMentions.type })
          .from(entityMentions)
          .where(eq(entityMentions.knowledgeObjectId, row.id));

        sources.push({
          id: row.id,
          type: row.type,
          content: row.content,
          summary: row.summary ?? "",
          confidence: row.confidence,
          similarity: row.similarity ?? 0,
          tags: (row.tags ?? []) as string[],
          entities,
          createdAt: row.createdAt.toISOString(),
          recordingId: row.recordingId ?? undefined,
        });
      }
    } else {
      // Fallback: text search by fetching recent knowledge objects
      const rows = await db
        .select()
        .from(knowledgeObjects)
        .where(eq(knowledgeObjects.tenantId, tenantId))
        .orderBy(desc(knowledgeObjects.createdAt))
        .limit(maxResults);

      for (const row of rows) {
        const entities = await db
          .select({ name: entityMentions.name, type: entityMentions.type })
          .from(entityMentions)
          .where(eq(entityMentions.knowledgeObjectId, row.id));

        sources.push({
          id: row.id,
          type: row.type,
          content: row.content,
          summary: row.summary ?? "",
          confidence: row.confidence,
          similarity: 0,
          tags: (row.tags ?? []) as string[],
          entities,
          createdAt: row.createdAt.toISOString(),
          recordingId: row.recordingId ?? undefined,
        });
      }
    }

    // Synthesize answer via Recall Agent
    const result = await recallAgent.runWithAudit({
      data: {
        query,
        tenantId,
        userId,
        filters,
        maxResults,
        sources,
      } as any,
      context,
    });

    res.json({
      answer: result.result.answer,
      sources: result.result.sources,
      totalMatches: result.result.totalMatches,
      metadata: {
        executionTimeMs: result.metadata.executionTimeMs,
        tokensUsed: result.metadata.tokensUsed,
        modelsUsed: result.metadata.modelsUsed,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Recall failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// Semantic search — returns matching knowledge objects without LLM synthesis
router.post("/search", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;

  const { query, maxResults = 20 } = req.body as {
    query: string;
    filters?: Record<string, unknown>;
    maxResults?: number;
  };

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    let queryEmbedding: number[] | undefined;
    try {
      const embeddings = await generateEmbedding(query, {
        tenantId,
        userId,
        appCode: "CVG-BRAIN",
      });
      queryEmbedding = embeddings[0];
    } catch {
      // Fall back to text search
    }

    if (queryEmbedding) {
      const vectorStr = `[${queryEmbedding.join(",")}]`;
      const results = await db
        .select({
          id: knowledgeObjects.id,
          type: knowledgeObjects.type,
          content: knowledgeObjects.content,
          summary: knowledgeObjects.summary,
          confidence: knowledgeObjects.confidence,
          tags: knowledgeObjects.tags,
          createdAt: knowledgeObjects.createdAt,
          similarity: sql<number>`1 - (${knowledgeObjects.embedding} <=> ${vectorStr}::vector)`.as("similarity"),
        })
        .from(knowledgeObjects)
        .where(
          and(
            eq(knowledgeObjects.tenantId, tenantId),
            sql`${knowledgeObjects.embedding} IS NOT NULL`,
          ),
        )
        .orderBy(sql`${knowledgeObjects.embedding} <=> ${vectorStr}::vector`)
        .limit(maxResults);

      res.json({
        results,
        total: results.length,
        queryEmbedding: "[vector]",
      });
    } else {
      // Fallback text search
      const results = await db
        .select()
        .from(knowledgeObjects)
        .where(eq(knowledgeObjects.tenantId, tenantId))
        .orderBy(desc(knowledgeObjects.createdAt))
        .limit(maxResults);

      res.json({
        results,
        total: results.length,
        queryEmbedding: null,
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Search failed", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
