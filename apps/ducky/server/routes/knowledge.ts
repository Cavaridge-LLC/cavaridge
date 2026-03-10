import type { Express } from "express";
import { db } from "../db";
import { knowledgeSources, knowledgeChunks, createKnowledgeSourceSchema } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../auth";

export function registerKnowledgeRoutes(app: Express) {
  // List knowledge sources
  app.get("/api/knowledge", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const sources = await db.select().from(knowledgeSources)
        .where(eq(knowledgeSources.tenantId, req.orgId!))
        .orderBy(desc(knowledgeSources.createdAt));

      res.json(sources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge sources" });
    }
  });

  // Create knowledge source
  app.post("/api/knowledge", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createKnowledgeSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const [source] = await db.insert(knowledgeSources).values({
        tenantId: req.orgId!,
        name: parsed.data.name,
        sourceType: parsed.data.sourceType,
        metadataJson: parsed.data.metadataJson || {},
      }).returning();

      res.status(201).json(source);
    } catch (error) {
      res.status(500).json({ message: "Failed to create knowledge source" });
    }
  });

  // Get knowledge source details
  app.get("/api/knowledge/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [source] = await db.select().from(knowledgeSources)
        .where(and(
          eq(knowledgeSources.id, req.params.id),
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

  // Delete knowledge source
  app.delete("/api/knowledge/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [source] = await db.select().from(knowledgeSources)
        .where(and(
          eq(knowledgeSources.id, req.params.id),
          eq(knowledgeSources.tenantId, req.orgId!),
        ));

      if (!source) {
        return res.status(404).json({ message: "Knowledge source not found" });
      }

      await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, source.id));
      await db.delete(knowledgeSources).where(eq(knowledgeSources.id, source.id));

      res.json({ message: "Knowledge source deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete knowledge source" });
    }
  });
}
