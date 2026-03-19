import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { createWorkloadSchema } from "@shared/schema";

export function registerWorkloadRoutes(app: Express) {
  // List workloads for a project
  app.get(
    "/api/projects/:projectId/workloads",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const workloads = await storage.getWorkloadsByProject(projectId, tenantId);
        res.json(workloads);
      } catch (error) {
        console.error("Error fetching workloads:", error);
        res.status(500).json({ message: "Failed to fetch workloads" });
      }
    }
  );

  // Create workload
  app.post(
    "/api/projects/:projectId/workloads",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const parsed = createWorkloadSchema.parse(req.body);
        const workload = await storage.createWorkload({
          ...parsed,
          projectId,
          tenantId,
        });

        await logAudit(
          tenantId,
          req.user!.id,
          "create_workload",
          "workload",
          workload.id,
          { name: parsed.name, projectId },
          req.ip || undefined
        );

        res.status(201).json(workload);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        console.error("Error creating workload:", error);
        res.status(500).json({ message: "Failed to create workload" });
      }
    }
  );

  // Bulk create workloads
  app.post(
    "/api/projects/:projectId/workloads/bulk",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.orgId!;
        const { workloads } = req.body;
        if (!Array.isArray(workloads) || workloads.length === 0) {
          return res.status(400).json({ message: "workloads array is required" });
        }

        const insertData = workloads.map((item: any) => {
          const parsed = createWorkloadSchema.parse(item);
          return { ...parsed, projectId, tenantId };
        });

        const created = await storage.bulkCreateWorkloads(insertData);

        await logAudit(
          tenantId,
          req.user!.id,
          "bulk_create_workloads",
          "workload",
          projectId,
          { count: created.length, projectId },
          req.ip || undefined
        );

        res.status(201).json(created);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        console.error("Error bulk creating workloads:", error);
        res.status(500).json({ message: "Failed to bulk create workloads" });
      }
    }
  );

  // Update workload
  app.patch(
    "/api/workloads/:id",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.orgId!;

        const updated = await storage.updateWorkload(id, tenantId, req.body);
        if (!updated) {
          return res.status(404).json({ message: "Workload not found" });
        }

        await logAudit(
          tenantId,
          req.user!.id,
          "update_workload",
          "workload",
          id,
          { changes: Object.keys(req.body) },
          req.ip || undefined
        );

        res.json(updated);
      } catch (error) {
        console.error("Error updating workload:", error);
        res.status(500).json({ message: "Failed to update workload" });
      }
    }
  );

  // Delete workload
  app.delete(
    "/api/workloads/:id",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.orgId!;

        // getWorkload to verify existence and get name for audit
        const workload = await storage.getWorkload(id, tenantId);
        if (!workload) {
          return res.status(404).json({ message: "Workload not found" });
        }

        await storage.deleteWorkload(id, tenantId);

        await logAudit(
          tenantId,
          req.user!.id,
          "delete_workload",
          "workload",
          id,
          { name: workload.name, projectId: workload.projectId },
          req.ip || undefined
        );

        res.json({ message: "Workload deleted" });
      } catch (error) {
        console.error("Error deleting workload:", error);
        res.status(500).json({ message: "Failed to delete workload" });
      }
    }
  );
}
