import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { createCostProjectionSchema } from "@shared/schema";
import { analyzeWorkloadCosts } from "../agents";

export function registerCostRoutes(app: Express) {
  // List cost projections for a project
  app.get(
    "/api/projects/:projectId/costs",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;
        const costs = await storage.getCostsByProject(projectId, tenantId);
        res.json(costs);
      } catch (error) {
        console.error("Error fetching cost projections:", error);
        res.status(500).json({ message: "Failed to fetch cost projections" });
      }
    }
  );

  // Create manual cost projection
  app.post(
    "/api/projects/:projectId/costs",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;
        const parsed = createCostProjectionSchema.parse(req.body);
        const cost = await storage.createCost({
          ...parsed,
          projectId,
          tenantId,
        });

        await logAudit(
          tenantId,
          req.user!.id,
          "create_cost_projection",
          "cost_projection",
          cost.id,
          { projectId },
          req.ip || undefined
        );

        res.status(201).json(cost);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        console.error("Error creating cost projection:", error);
        res.status(500).json({ message: "Failed to create cost projection" });
      }
    }
  );

  // Trigger AI cost analysis
  app.post(
    "/api/projects/:projectId/costs/analyze",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;
        const result = await analyzeWorkloadCosts(
          projectId,
          tenantId,
          req.user!.id
        );

        await logAudit(
          tenantId,
          req.user!.id,
          "analyze_costs",
          "project",
          projectId,
          { projectionsGenerated: result.length },
          req.ip || undefined
        );

        res.json(result);
      } catch (error) {
        console.error("Error analyzing costs:", error);
        res.status(500).json({ message: "Failed to analyze costs" });
      }
    }
  );

  // Update cost projection
  app.patch(
    "/api/costs/:id",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.tenantId!;

        const updated = await storage.updateCost(id, tenantId, req.body);
        if (!updated) {
          return res.status(404).json({ message: "Cost projection not found" });
        }

        await logAudit(
          tenantId,
          req.user!.id,
          "update_cost_projection",
          "cost_projection",
          id,
          { changes: Object.keys(req.body) },
          req.ip || undefined
        );

        res.json(updated);
      } catch (error) {
        console.error("Error updating cost projection:", error);
        res.status(500).json({ message: "Failed to update cost projection" });
      }
    }
  );
}
