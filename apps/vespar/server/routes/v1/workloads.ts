/**
 * /api/v1/workloads — Workload CRUD + AI Strategy Classification
 *
 * Tenant-scoped. MSP Admin + MSP Tech.
 */

import { Router, type IRouter } from "express";
import { storage } from "../../storage";
import {
  requireAuth,
  requirePermission,
  logAudit,
  type AuthenticatedRequest,
} from "../../auth";
import { createWorkloadSchema } from "@shared/schema";
import { classifyWorkloadStrategy } from "../../ducky-client";

export const workloadsRouter: IRouter = Router();

// POST /api/v1/workloads — Create workload (requires projectId in body)
workloadsRouter.post(
  "/",
  requireAuth as any,
  requirePermission("manage_workloads") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, ...rest } = req.body;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }
      const parsed = createWorkloadSchema.parse(rest);
      const workload = await storage.createWorkload({
        ...parsed,
        projectId,
        tenantId: req.tenantId!,
      });

      await logAudit(
        req.tenantId!,
        req.user!.id,
        "create_workload",
        "workload",
        workload.id,
        { name: parsed.name, projectId },
        req.ip || undefined,
      );

      res.status(201).json(workload);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: (error as any).errors });
      }
      console.error("Error creating workload:", error);
      res.status(500).json({ message: "Failed to create workload" });
    }
  },
);

// GET /api/v1/workloads — List workloads (requires ?projectId query param)
workloadsRouter.get(
  "/",
  requireAuth as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ message: "projectId query parameter is required" });
      }
      const workloads = await storage.getWorkloadsByProject(projectId, req.tenantId!);
      res.json(workloads);
    } catch (error) {
      console.error("Error fetching workloads:", error);
      res.status(500).json({ message: "Failed to fetch workloads" });
    }
  },
);

// GET /api/v1/workloads/:id — Get single workload
workloadsRouter.get(
  "/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const workload = await storage.getWorkload(id, req.tenantId!);
      if (!workload) {
        return res.status(404).json({ message: "Workload not found" });
      }
      res.json(workload);
    } catch (error) {
      console.error("Error fetching workload:", error);
      res.status(500).json({ message: "Failed to fetch workload" });
    }
  },
);

// PUT /api/v1/workloads/:id — Update workload
workloadsRouter.put(
  "/:id",
  requireAuth as any,
  requirePermission("manage_workloads") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

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
        req.ip || undefined,
      );

      res.json(updated);
    } catch (error) {
      console.error("Error updating workload:", error);
      res.status(500).json({ message: "Failed to update workload" });
    }
  },
);

// DELETE /api/v1/workloads/:id — Delete workload
workloadsRouter.delete(
  "/:id",
  requireAuth as any,
  requirePermission("manage_workloads") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

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
        { name: workload.name },
        req.ip || undefined,
      );

      res.json({ message: "Workload deleted" });
    } catch (error) {
      console.error("Error deleting workload:", error);
      res.status(500).json({ message: "Failed to delete workload" });
    }
  },
);

// POST /api/v1/workloads/:id/classify — AI-assisted strategy classification via Ducky
workloadsRouter.post(
  "/:id/classify",
  requireAuth as any,
  requirePermission("run_analysis") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

      const workload = await storage.getWorkload(id, tenantId);
      if (!workload) {
        return res.status(404).json({ message: "Workload not found" });
      }

      const classification = await classifyWorkloadStrategy({
        name: workload.name,
        type: workload.type,
        criticality: workload.criticality,
        currentHosting: workload.currentHosting,
        environmentDetails: workload.environmentDetails,
        notes: workload.notes,
      });

      // Auto-apply the strategy if requested
      if (req.body.apply) {
        await storage.updateWorkload(id, tenantId, {
          migrationStrategy: classification.strategy,
        });
      }

      await logAudit(
        tenantId,
        req.user!.id,
        "classify_workload",
        "workload",
        id,
        { strategy: classification.strategy, confidence: classification.confidence },
        req.ip || undefined,
      );

      res.json(classification);
    } catch (error) {
      console.error("Error classifying workload:", error);
      res.status(500).json({ message: "Failed to classify workload" });
    }
  },
);

// POST /api/v1/workloads/bulk-classify — Classify all workloads in a project
workloadsRouter.post(
  "/bulk-classify",
  requireAuth as any,
  requirePermission("run_analysis") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, apply } = req.body;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      const tenantId = req.tenantId!;
      const projectWorkloads = await storage.getWorkloadsByProject(projectId, tenantId);
      const unclassified = projectWorkloads.filter((w) => !w.migrationStrategy);

      const results = await Promise.all(
        unclassified.map(async (w) => {
          const classification = await classifyWorkloadStrategy({
            name: w.name,
            type: w.type,
            criticality: w.criticality,
            currentHosting: w.currentHosting,
            environmentDetails: w.environmentDetails,
            notes: w.notes,
          });

          if (apply) {
            await storage.updateWorkload(w.id, tenantId, {
              migrationStrategy: classification.strategy,
            });
          }

          return { workloadId: w.id, workloadName: w.name, ...classification };
        }),
      );

      await logAudit(
        tenantId,
        req.user!.id,
        "bulk_classify_workloads",
        "project",
        projectId,
        { classifiedCount: results.length },
        req.ip || undefined,
      );

      res.json({ classified: results.length, results });
    } catch (error) {
      console.error("Error bulk classifying workloads:", error);
      res.status(500).json({ message: "Failed to bulk classify workloads" });
    }
  },
);
