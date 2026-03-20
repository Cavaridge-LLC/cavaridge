/**
 * Recall API — CVG-BRAIN
 *
 * Natural language query interface through Ducky → Spaniel.
 * POST /api/v1/recall — Ask a question, get knowledge-backed answer
 * POST /api/v1/recall/search — Semantic search without synthesis
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { RecallAgent } from "../agents/recall.js";
import { generateEmbedding } from "@cavaridge/spaniel";
import type { AgentContext } from "@cavaridge/agent-core";

const router = Router();
const recallAgent = new RecallAgent();

function getTenantContext(req: Request) {
  return {
    tenantId: (req as Record<string, unknown>).tenantId as string || req.headers["x-tenant-id"] as string || "",
    userId: (req as Record<string, unknown>).userId as string || req.headers["x-user-id"] as string || "",
  };
}

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

// Natural language recall — "Ducky, what did we decide about the migration timeline?"
router.post("/", async (req: Request, res: Response) => {
  const { tenantId, userId } = getTenantContext(req);
  if (!tenantId || !userId) {
    res.status(401).json({ error: "Missing tenant or user context" });
    return;
  }

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

    // Step 1: Generate query embedding
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

    // Step 2: Vector similarity search in pgvector
    // In production:
    // SELECT ko.*, 1 - (ko.embedding <=> $queryEmbedding) as similarity
    // FROM brain_knowledge_objects ko
    // WHERE ko.tenant_id = $tenantId
    //   AND ($type IS NULL OR ko.type = ANY($type))
    //   AND ($tags IS NULL OR ko.tags @> $tags::jsonb)
    //   AND ($dateFrom IS NULL OR ko.created_at >= $dateFrom)
    //   AND ($dateTo IS NULL OR ko.created_at <= $dateTo)
    // ORDER BY ko.embedding <=> $queryEmbedding ASC
    // LIMIT $maxResults

    // For now, return empty sources (DB not connected yet)
    const sources: Array<{
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

    // Step 3: Synthesize answer via Recall Agent
    const result = await recallAgent.runWithAudit({
      data: {
        query,
        tenantId,
        userId,
        filters,
        maxResults,
        sources,
      },
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
router.post("/search", async (req: Request, res: Response) => {
  const { tenantId, userId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const { query, filters, maxResults = 20 } = req.body as {
    query: string;
    filters?: Record<string, unknown>;
    maxResults?: number;
  };

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    // Generate embedding for vector search
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

    // In production: same pgvector query as above, but return raw results
    res.json({
      results: [],
      total: 0,
      queryEmbedding: queryEmbedding ? "[vector]" : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Search failed", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
