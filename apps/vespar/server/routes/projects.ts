import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requirePermission,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { createProjectSchema } from "@shared/schema";

export function registerProjectRoutes(app: Express) {
  // List projects for tenant
  app.get(
    "/api/projects",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projects = await storage.getProjectsByTenant(req.tenantId!);
        res.json(projects);
      } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ message: "Failed to fetch projects" });
      }
    }
  );

  // Get single project
  app.get(
    "/api/projects/:id",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.tenantId!;
        const project = await storage.getProject(id, tenantId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }
        res.json(project);
      } catch (error) {
        console.error("Error fetching project:", error);
        res.status(500).json({ message: "Failed to fetch project" });
      }
    }
  );

  // Create project
  app.post(
    "/api/projects",
    requireAuth as any,
    requirePermission("create_projects") as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = createProjectSchema.parse(req.body);
        const project = await storage.createProject({
          ...parsed,
          tenantId: req.tenantId!,
          createdBy: req.user!.id,
        });

        await logAudit(
          req.tenantId!,
          req.user!.id,
          "create_project",
          "project",
          project.id,
          { name: parsed.name },
          req.ip || undefined
        );

        res.status(201).json(project);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        console.error("Error creating project:", error);
        res.status(500).json({ message: "Failed to create project" });
      }
    }
  );

  // Update project
  app.patch(
    "/api/projects/:id",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.tenantId!;

        const updated = await storage.updateProject(id, tenantId, req.body);
        if (!updated) {
          return res.status(404).json({ message: "Project not found" });
        }

        await logAudit(
          tenantId,
          req.user!.id,
          "update_project",
          "project",
          id,
          { changes: Object.keys(req.body) },
          req.ip || undefined
        );

        res.json(updated);
      } catch (error) {
        console.error("Error updating project:", error);
        res.status(500).json({ message: "Failed to update project" });
      }
    }
  );

  // Soft delete (archive) project
  app.delete(
    "/api/projects/:id",
    requireAuth as any,
    requirePermission("delete_projects") as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.tenantId!;

        const project = await storage.getProject(id, tenantId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        await storage.updateProject(id, tenantId, { status: "archived" });

        await logAudit(
          tenantId,
          req.user!.id,
          "archive_project",
          "project",
          id,
          { name: project.name },
          req.ip || undefined
        );

        res.json({ message: "Project archived" });
      } catch (error) {
        console.error("Error archiving project:", error);
        res.status(500).json({ message: "Failed to archive project" });
      }
    }
  );
}
