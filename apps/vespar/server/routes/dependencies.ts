import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { createDependencySchema } from "@shared/schema";

export function registerDependencyRoutes(app: Express) {
  // List dependencies for a project
  app.get(
    "/api/projects/:projectId/dependencies",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const dependencies = await storage.getDependenciesByProject(projectId, tenantId);
        res.json(dependencies);
      } catch (error) {
        console.error("Error fetching dependencies:", error);
        res.status(500).json({ message: "Failed to fetch dependencies" });
      }
    }
  );

  // Create dependency
  app.post(
    "/api/projects/:projectId/dependencies",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const parsed = createDependencySchema.parse(req.body);
        const dependency = await storage.createDependency({
          ...parsed,
          projectId,
          tenantId,
        });

        await logAudit(
          tenantId,
          req.user!.id,
          "create_dependency",
          "dependency",
          dependency.id,
          {
            sourceWorkloadId: parsed.sourceWorkloadId,
            targetWorkloadId: parsed.targetWorkloadId,
            projectId,
          },
          req.ip || undefined
        );

        res.status(201).json(dependency);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        console.error("Error creating dependency:", error);
        res.status(500).json({ message: "Failed to create dependency" });
      }
    }
  );

  // Delete dependency
  app.delete(
    "/api/dependencies/:id",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.orgId!;

        const deleted = await storage.deleteDependency(id, tenantId);
        if (!deleted) {
          return res.status(404).json({ message: "Dependency not found" });
        }

        await logAudit(
          tenantId,
          req.user!.id,
          "delete_dependency",
          "dependency",
          id,
          {},
          req.ip || undefined
        );

        res.json({ message: "Dependency deleted" });
      } catch (error) {
        console.error("Error deleting dependency:", error);
        res.status(500).json({ message: "Failed to delete dependency" });
      }
    }
  );
}
