import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { createRiskFindingSchema } from "@shared/schema";
import { analyzeWorkloadRisks } from "../agents";

export function registerRiskRoutes(app: Express) {
  // List risk findings for a project
  app.get(
    "/api/projects/:projectId/risks",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;
        const risks = await storage.getRisksByProject(projectId, tenantId);
        res.json(risks);
      } catch (error) {
        console.error("Error fetching risk findings:", error);
        res.status(500).json({ message: "Failed to fetch risk findings" });
      }
    }
  );

  // Create manual risk finding
  app.post(
    "/api/projects/:projectId/risks",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;
        const parsed = createRiskFindingSchema.parse(req.body);
        const risk = await storage.createRisk({
          ...parsed,
          projectId,
          tenantId,
        });

        await logAudit(
          tenantId,
          req.user!.id,
          "create_risk_finding",
          "risk_finding",
          risk.id,
          { title: parsed.title, severity: parsed.severity, projectId },
          req.ip || undefined
        );

        res.status(201).json(risk);
      } catch (error: any) {
        if (error.name === "ZodError") {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        console.error("Error creating risk finding:", error);
        res.status(500).json({ message: "Failed to create risk finding" });
      }
    }
  );

  // Trigger AI risk analysis
  app.post(
    "/api/projects/:projectId/risks/analyze",
    requireAuth as any,
    requireProjectAccess as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const projectId = req.params.projectId as string;
        const tenantId = req.tenantId!;
        const result = await analyzeWorkloadRisks(
          projectId,
          tenantId,
          req.user!.id
        );

        await logAudit(
          tenantId,
          req.user!.id,
          "analyze_risks",
          "project",
          projectId,
          { findingsGenerated: result.length },
          req.ip || undefined
        );

        res.json(result);
      } catch (error) {
        console.error("Error analyzing risks:", error);
        res.status(500).json({ message: "Failed to analyze risks" });
      }
    }
  );

  // Update risk finding
  app.patch(
    "/api/risks/:id",
    requireAuth as any,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
        const tenantId = req.tenantId!;

        const updated = await storage.updateRisk(id, tenantId, req.body);
        if (!updated) {
          return res.status(404).json({ message: "Risk finding not found" });
        }

        await logAudit(
          tenantId,
          req.user!.id,
          "update_risk_finding",
          "risk_finding",
          id,
          { changes: Object.keys(req.body) },
          req.ip || undefined
        );

        res.json(updated);
      } catch (error) {
        console.error("Error updating risk finding:", error);
        res.status(500).json({ message: "Failed to update risk finding" });
      }
    }
  );
}
