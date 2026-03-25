/**
 * Knowledge Graph Routes — Meridian M&A Intelligence
 *
 * Build and query the deal knowledge graph.
 */

import { storage, requireAuth, verifyDealAccess, param, type AuthenticatedRequest } from './_helpers';
import { KnowledgeGraphBuilderAgent } from "../agents/knowledge-graph/agent";
import { createMeridianContext } from "../agents/context";
import type { KnowledgeGraph } from "../agents/knowledge-graph/types";
import { type Express } from "express";

const kgAgent = new KnowledgeGraphBuilderAgent();

// In-memory KG cache (per deal). In production this should be persisted to DB.
const kgCache = new Map<string, KnowledgeGraph>();

export function registerKnowledgeGraphRoutes(app: Express) {

  /**
   * POST /api/deals/:id/knowledge-graph/build
   * Trigger knowledge graph extraction for a deal.
   */
  app.post("/api/deals/:id/knowledge-graph/build", requireAuth as never, verifyDealAccess as never, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = param(req.params.id);
      const deal = await storage.getDeal(dealId);
      if (!deal) return res.status(404).json({ message: "Deal not found" });

      // Gather document text
      const documents = await storage.getDocumentsByDeal(dealId);
      const textParts: string[] = [];
      for (const doc of documents) {
        if (doc.extractedText && doc.extractedText.trim().length > 0) {
          textParts.push(`--- Document: ${doc.filename} ---\n${doc.extractedText.slice(0, 8000)}`);
        }
      }

      const documentText = textParts.join("\n\n");
      if (documentText.trim().length < 50) {
        return res.status(400).json({
          message: "Not enough document content to build a knowledge graph. Upload and process more documents first.",
        });
      }

      // Get tech stack and findings for enrichment
      const techStack = await storage.getTechStackByDeal(dealId);
      const findingsList = await storage.getFindingsByDeal(dealId);

      const context = createMeridianContext(req.orgId!, req.user!.id, {
        agentId: "knowledge-graph-builder",
        agentName: "Knowledge Graph Builder",
      });

      const output = await kgAgent.runWithAudit({
        data: {
          dealId,
          documentText,
          techStack: techStack.map(t => ({
            itemName: t.itemName,
            category: t.category,
            status: t.status ?? "unknown",
          })),
          findings: findingsList.map(f => ({
            title: f.title,
            severity: f.severity,
            pillar: "unknown",
          })),
        },
        context,
      });

      // Cache the result
      kgCache.set(dealId, output.result);

      res.json({
        message: "Knowledge graph built successfully",
        graph: output.result,
        metadata: {
          entityCount: output.result.entities.length,
          relationshipCount: output.result.relationships.length,
          executionTimeMs: output.metadata.executionTimeMs,
          tokensUsed: output.metadata.tokensUsed,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[knowledge-graph] Build failed:", message);
      res.status(500).json({ message: `Knowledge graph build failed: ${message}` });
    }
  });

  /**
   * GET /api/deals/:id/knowledge-graph
   * Retrieve the knowledge graph for a deal.
   */
  app.get("/api/deals/:id/knowledge-graph", requireAuth as never, verifyDealAccess as never, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = param(req.params.id);
      const graph = kgCache.get(dealId);

      if (!graph) {
        return res.json({
          entities: [],
          relationships: [],
          metadata: {
            dealId,
            entityCount: 0,
            relationshipCount: 0,
            buildTimestamp: null,
            message: "No knowledge graph built yet. Use POST /api/deals/:id/knowledge-graph/build to create one.",
          },
        });
      }

      res.json(graph);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ message: `Failed to retrieve knowledge graph: ${message}` });
    }
  });

  /**
   * GET /api/deals/:id/knowledge-graph/entity/:entityId
   * Get a specific entity with its relationships.
   */
  app.get("/api/deals/:id/knowledge-graph/entity/:entityId", requireAuth as never, verifyDealAccess as never, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = param(req.params.id);
      const entityId = param(req.params.entityId);
      const graph = kgCache.get(dealId);

      if (!graph) {
        return res.status(404).json({ message: "Knowledge graph not built yet" });
      }

      const entity = graph.entities.find(e => e.id === entityId);
      if (!entity) {
        return res.status(404).json({ message: "Entity not found" });
      }

      // Find all relationships involving this entity
      const relationships = graph.relationships.filter(
        r => r.sourceEntityId === entityId || r.targetEntityId === entityId,
      );

      // Find connected entities
      const connectedIds = new Set<string>();
      for (const r of relationships) {
        if (r.sourceEntityId !== entityId) connectedIds.add(r.sourceEntityId);
        if (r.targetEntityId !== entityId) connectedIds.add(r.targetEntityId);
      }
      const connectedEntities = graph.entities.filter(e => connectedIds.has(e.id));

      res.json({
        entity,
        relationships,
        connectedEntities,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ message });
    }
  });
}
