import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { analyzeMigrationReadiness } from "../agents";

export function registerAnalysisRoutes(app: Express) {
  // Run full migration readiness analysis pipeline
  app.post(
    "/api/projects/:projectId/analyze",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;

        const project = await storage.getProject(projectId, tenantId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const result = await analyzeMigrationReadiness(
          projectId,
          tenantId,
          req.user!.id
        );

        // Update project with readiness score from analysis
        if (result.readinessScore !== undefined) {
          await storage.updateProject(projectId, tenantId, {
            readinessScore: result.readinessScore,
          });
        }

        await logAudit(
          tenantId,
          req.user!.id,
          "analyze_readiness",
          "project",
          projectId,
          {
            readinessScore: result.readinessScore,
            recommendationCount: result.recommendations?.length || 0,
          },
          req.ip || undefined
        );

        res.json(result);
      } catch (error) {
        console.error("Error analyzing migration readiness:", error);
        res.status(500).json({ message: "Failed to analyze migration readiness" });
      }
    }
  );

  // Get project readiness summary
  app.get(
    "/api/projects/:projectId/readiness",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;

        const project = await storage.getProject(projectId, tenantId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }

        const [workloads, risks, costs, runbooks] = await Promise.all([
          storage.getWorkloadsByProject(projectId, tenantId),
          storage.getRisksByProject(projectId, tenantId),
          storage.getCostsByProject(projectId, tenantId),
          storage.getRunbooksByProject(projectId, tenantId),
        ]);

        const risksBySeverity = risks.reduce(
          (acc: Record<string, number>, r: any) => {
            const sev = r.severity || "unknown";
            acc[sev] = (acc[sev] || 0) + 1;
            return acc;
          },
          {}
        );

        const totalMonthlyCost = costs.reduce(
          (sum: number, c: any) => sum + (parseFloat(c.projectedMonthlyCost) || 0),
          0
        );

        res.json({
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            readinessScore: project.readinessScore,
            sourceEnvironment: project.sourceEnvironment,
            targetEnvironment: project.targetEnvironment,
          },
          summary: {
            workloadCount: workloads.length,
            riskCount: risks.length,
            risksBySeverity,
            costProjectionCount: costs.length,
            totalMonthlyCost,
            runbookCount: runbooks.length,
          },
        });
      } catch (error) {
        console.error("Error fetching readiness summary:", error);
        res.status(500).json({ message: "Failed to fetch readiness summary" });
      }
    }
  );
}
