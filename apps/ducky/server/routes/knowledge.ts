import type { Express } from "express";
import { db } from "../db";
import { knowledgeSources, knowledgeChunks, createKnowledgeSourceSchema, usageTracking } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, logAudit, requirePermissionMiddleware, type AuthenticatedRequest } from "../auth";
import { ingestContent, fetchUrlContent } from "../rag";
import { logger } from "../logger";

export function registerKnowledgeRoutes(app: Express) {
  // List knowledge sources (with chunk counts)
  app.get("/api/knowledge", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const sources = await db.select().from(knowledgeSources)
        .where(eq(knowledgeSources.tenantId, req.orgId!))
        .orderBy(desc(knowledgeSources.createdAt));

      const sourcesWithCounts = await Promise.all(
        sources.map(async (source) => {
          const chunks = await db.select({ id: knowledgeChunks.id })
            .from(knowledgeChunks)
            .where(eq(knowledgeChunks.sourceId, source.id));
          return { ...source, chunkCount: chunks.length };
        }),
      );

      res.json(sourcesWithCounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge sources" });
    }
  });

  // Create knowledge source with content ingestion
  app.post("/api/knowledge", requireAuth as any, requirePermissionMiddleware("manage_knowledge") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createKnowledgeSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const { name, sourceType, content, metadataJson } = parsed.data;

      const [source] = await db.insert(knowledgeSources).values({
        tenantId: req.orgId!,
        name,
        sourceType,
        metadataJson: metadataJson || {},
      }).returning();

      let chunksInserted = 0;
      let rawContent = content || "";

      // Fetch URL content if source is a URL
      if (sourceType === "url" && metadataJson && typeof (metadataJson as any).url === "string") {
        try {
          rawContent = await fetchUrlContent((metadataJson as any).url);
          await db.update(knowledgeSources).set({
            metadataJson: { ...(metadataJson || {}), fetchedAt: new Date().toISOString(), contentLength: rawContent.length },
          }).where(eq(knowledgeSources.id, source.id));
        } catch (err: any) {
          logger.warn({ err, sourceId: source.id }, "Failed to fetch URL content");
          await db.update(knowledgeSources).set({
            metadataJson: { ...(metadataJson || {}), fetchError: err.message },
          }).where(eq(knowledgeSources.id, source.id));
        }
      }

      // Ingest content into chunks + generate embeddings
      if (rawContent.trim().length > 0) {
        try {
          chunksInserted = await ingestContent(source.id, req.orgId!, rawContent);
        } catch (err) {
          logger.error({ err, sourceId: source.id }, "Failed to ingest content");
        }
      }

      await db.insert(usageTracking).values({
        tenantId: req.orgId!,
        userId: req.user!.id,
        actionType: "source_upload",
        tokensUsed: 0,
      });

      await logAudit(req.orgId!, req.user!.id, "create_knowledge_source", "knowledge_source", source.id, {
        name, sourceType, chunksInserted,
      });

      res.status(201).json({ ...source, chunkCount: chunksInserted });
    } catch (error) {
      logger.error({ error }, "Failed to create knowledge source");
      res.status(500).json({ message: "Failed to create knowledge source" });
    }
  });

  // Get knowledge source details
  app.get("/api/knowledge/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [source] = await db.select().from(knowledgeSources)
        .where(and(
          eq(knowledgeSources.id, req.params.id as string),
          eq(knowledgeSources.tenantId, req.orgId!),
        ));

      if (!source) {
        return res.status(404).json({ message: "Knowledge source not found" });
      }

      const chunks = await db.select().from(knowledgeChunks)
        .where(eq(knowledgeChunks.sourceId, source.id))
        .orderBy(knowledgeChunks.chunkIndex);

      res.json({ ...source, chunks });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge source" });
    }
  });

  // Toggle knowledge source active/inactive
  app.patch("/api/knowledge/:id", requireAuth as any, requirePermissionMiddleware("manage_knowledge") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [source] = await db.select().from(knowledgeSources)
        .where(and(
          eq(knowledgeSources.id, req.params.id as string),
          eq(knowledgeSources.tenantId, req.orgId!),
        ));

      if (!source) {
        return res.status(404).json({ message: "Knowledge source not found" });
      }

      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      const [updated] = await db.update(knowledgeSources)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(knowledgeSources.id, source.id))
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update knowledge source" });
    }
  });

  // Delete knowledge source
  app.delete("/api/knowledge/:id", requireAuth as any, requirePermissionMiddleware("manage_knowledge") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [source] = await db.select().from(knowledgeSources)
        .where(and(
          eq(knowledgeSources.id, req.params.id as string),
          eq(knowledgeSources.tenantId, req.orgId!),
        ));

      if (!source) {
        return res.status(404).json({ message: "Knowledge source not found" });
      }

      await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, source.id));
      await db.delete(knowledgeSources).where(eq(knowledgeSources.id, source.id));

      await logAudit(req.orgId!, req.user!.id, "delete_knowledge_source", "knowledge_source", source.id, {
        name: source.name,
      });

      res.json({ message: "Knowledge source deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete knowledge source" });
    }
  });
}
