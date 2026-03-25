/**
 * /api/v1/cost-models — Cost Modeling API
 *
 * On-prem vs projected cloud TCO analysis.
 * Tenant-scoped, MSP Admin + MSP Tech.
 */

import { Router, type IRouter } from "express";
import { storage } from "../../storage";
import {
  requireAuth,
  requirePermission,
  logAudit,
  type AuthenticatedRequest,
} from "../../auth";
import { createCostProjectionSchema } from "@shared/schema";

export const costModelsRouter: IRouter = Router();

// POST /api/v1/cost-models — Create or run cost model for a project
costModelsRouter.post(
  "/",
  requireAuth as any,
  requirePermission("manage_costs") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, useAgent, ...costData } = req.body;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      const tenantId = req.tenantId!;

      // If useAgent is true, run AI-assisted cost analysis
      if (useAgent) {
        const { analyzeWorkloadCosts } = await import("../../agents");
        const projections = await analyzeWorkloadCosts(projectId, tenantId, req.user!.id);

        await logAudit(
          tenantId,
          req.user!.id,
          "analyze_costs",
          "project",
          projectId,
          { projectionsGenerated: projections.length },
          req.ip || undefined,
        );

        return res.status(201).json({
          source: "agent",
          projections,
          summary: computeCostSummary(projections),
        });
      }

      // Manual cost projection creation
      const parsed = createCostProjectionSchema.parse(costData);
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
        req.ip || undefined,
      );

      res.status(201).json(cost);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: (error as any).errors });
      }
      console.error("Error creating cost model:", error);
      res.status(500).json({ message: "Failed to create cost model" });
    }
  },
);

// GET /api/v1/cost-models — Get cost projections with TCO summary
costModelsRouter.get(
  "/",
  requireAuth as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ message: "projectId query parameter is required" });
      }

      const tenantId = req.tenantId!;
      const costs = await storage.getCostsByProject(projectId, tenantId);

      res.json({
        projections: costs,
        summary: computeCostSummary(costs),
      });
    } catch (error) {
      console.error("Error fetching cost models:", error);
      res.status(500).json({ message: "Failed to fetch cost models" });
    }
  },
);

/**
 * Compute TCO summary from cost projections.
 */
function computeCostSummary(
  projections: Array<{
    currentMonthlyCost?: string | null;
    projectedMonthlyCost?: string | null;
    migrationCostOnetime?: string | null;
    savingsMonthly?: string | null;
    savingsAnnual?: string | null;
  }>,
) {
  let totalCurrentMonthly = 0;
  let totalProjectedMonthly = 0;
  let totalMigrationOnetime = 0;

  for (const p of projections) {
    totalCurrentMonthly += parseFloat(p.currentMonthlyCost ?? "0") || 0;
    totalProjectedMonthly += parseFloat(p.projectedMonthlyCost ?? "0") || 0;
    totalMigrationOnetime += parseFloat(p.migrationCostOnetime ?? "0") || 0;
  }

  const monthlySavings = totalCurrentMonthly - totalProjectedMonthly;
  const annualSavings = monthlySavings * 12;
  const paybackMonths = monthlySavings > 0
    ? Math.ceil(totalMigrationOnetime / monthlySavings)
    : null;

  return {
    totalCurrentMonthly: Math.round(totalCurrentMonthly * 100) / 100,
    totalProjectedMonthly: Math.round(totalProjectedMonthly * 100) / 100,
    totalMigrationOnetime: Math.round(totalMigrationOnetime * 100) / 100,
    monthlySavings: Math.round(monthlySavings * 100) / 100,
    annualSavings: Math.round(annualSavings * 100) / 100,
    threeYearTco: Math.round((totalProjectedMonthly * 36 + totalMigrationOnetime) * 100) / 100,
    currentThreeYearTco: Math.round(totalCurrentMonthly * 36 * 100) / 100,
    paybackMonths,
    projectionCount: projections.length,
  };
}
