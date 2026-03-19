import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { createRunbookSchema } from "@shared/schema";
import { generateMigrationRunbook } from "../agents";

export function registerRunbookRoutes(app: Express) {
  // List runbooks for a project
  app.get(
    "/api/projects/:projectId/runbooks",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const runbooks = await storage.getRunbooksByProject(projectId, tenantId);
        res.json(runbooks);
      } catch (error) {
        console.error("Error fetching runbooks:", error);
        res.status(500).json({ message: "Failed to fetch runbooks" });
      }
    }
  );

  // Get single runbook with content
  app.get(
    "/api/runbooks/:id",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.orgId!;
        const runbook = await storage.getRunbook(id, tenantId);
        if (!runbook) {
          return res.status(404).json({ message: "Runbook not found" });
        }
        res.json(runbook);
      } catch (error) {
        console.error("Error fetching runbook:", error);
        res.status(500).json({ message: "Failed to fetch runbook" });
      }
    }
  );

  // Create runbook manually
  app.post(
    "/api/projects/:projectId/runbooks",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const parsed = createRunbookSchema.parse(req.body);
        const runbook = await storage.createRunbook({
          ...parsed,
          projectId,
          tenantId,
        });

        await logAudit(
          tenantId,
          req.user!.id,
          "create_runbook",
          "runbook",
          runbook.id,
          { title: parsed.title, projectId },
          req.ip || undefined
        );

        res.status(201).json(runbook);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        console.error("Error creating runbook:", error);
        res.status(500).json({ message: "Failed to create runbook" });
      }
    }
  );

  // Generate runbook via AI agent
  app.post(
    "/api/projects/:projectId/runbooks/generate",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const result = await generateMigrationRunbook(
          projectId,
          tenantId,
          req.user!.id
        );

        const runbook = await storage.createRunbook({
          projectId,
          tenantId,
          title: result.title || "Migration Runbook",
          content: result.content,
          generatedBy: "agent",
        });

        await logAudit(
          tenantId,
          req.user!.id,
          "generate_runbook",
          "runbook",
          runbook.id,
          { projectId, generated: true },
          req.ip || undefined
        );

        res.status(201).json(runbook);
      } catch (error) {
        console.error("Error generating runbook:", error);
        res.status(500).json({ message: "Failed to generate runbook" });
      }
    }
  );

  // Update runbook (status, content)
  app.patch(
    "/api/runbooks/:id",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.orgId!;

        const updated = await storage.updateRunbook(id, tenantId, req.body);
        if (!updated) {
          return res.status(404).json({ message: "Runbook not found" });
        }

        await logAudit(
          tenantId,
          req.user!.id,
          "update_runbook",
          "runbook",
          id,
          { changes: Object.keys(req.body) },
          req.ip || undefined
        );

        res.json(updated);
      } catch (error) {
        console.error("Error updating runbook:", error);
        res.status(500).json({ message: "Failed to update runbook" });
      }
    }
  );
}
