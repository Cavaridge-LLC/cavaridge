/**
 * /api/v1/assessments — Migration Assessment CRUD
 *
 * Assessments map to migration projects internally.
 * Tenant-scoped, requires MSP Admin or MSP Tech.
 */

import { Router, type IRouter } from "express";
import { storage } from "../../storage";
import {
  requireAuth,
  requirePermission,
  requireProjectAccess,
  logAudit,
  type AuthenticatedRequest,
} from "../../auth";
import { createProjectSchema } from "@shared/schema";

export const assessmentsRouter: IRouter = Router();

// POST /api/v1/assessments — Create a new migration assessment
assessmentsRouter.post(
  "/",
  requireAuth as any,
  requirePermission("create_projects") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createProjectSchema.parse(req.body);
      const assessment = await storage.createProject({
        ...parsed,
        tenantId: req.tenantId!,
        createdBy: req.user!.id,
      });

      await logAudit(
        req.tenantId!,
        req.user!.id,
        "create_assessment",
        "assessment",
        assessment.id,
        { name: parsed.name },
        req.ip || undefined,
      );

      res.status(201).json(assessment);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: (error as any).errors });
      }
      console.error("Error creating assessment:", error);
      res.status(500).json({ message: "Failed to create assessment" });
    }
  },
);

// GET /api/v1/assessments — List assessments for tenant
assessmentsRouter.get(
  "/",
  requireAuth as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const assessments = await storage.getProjectsByTenant(req.tenantId!);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  },
);

// GET /api/v1/assessments/:id — Get single assessment
assessmentsRouter.get(
  "/:id",
  requireAuth as any,
  requireProjectAccess as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const assessment = await storage.getProject(id, req.tenantId!);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      res.json(assessment);
    } catch (error) {
      console.error("Error fetching assessment:", error);
      res.status(500).json({ message: "Failed to fetch assessment" });
    }
  },
);

// PUT /api/v1/assessments/:id — Update assessment
assessmentsRouter.put(
  "/:id",
  requireAuth as any,
  requirePermission("edit_projects") as any,
  requireProjectAccess as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

      const updated = await storage.updateProject(id, tenantId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      await logAudit(
        tenantId,
        req.user!.id,
        "update_assessment",
        "assessment",
        id,
        { changes: Object.keys(req.body) },
        req.ip || undefined,
      );

      res.json(updated);
    } catch (error) {
      console.error("Error updating assessment:", error);
      res.status(500).json({ message: "Failed to update assessment" });
    }
  },
);

// POST /api/v1/assessments/:id/analyze — Run full migration readiness analysis
assessmentsRouter.post(
  "/:id/analyze",
  requireAuth as any,
  requirePermission("run_analysis") as any,
  requireProjectAccess as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { analyzeMigrationReadiness } = await import("../../agents");
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

      const project = await storage.getProject(id, tenantId);
      if (!project) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const result = await analyzeMigrationReadiness(id, tenantId, req.user!.id);

      if (result.readinessScore !== undefined) {
        await storage.updateProject(id, tenantId, {
          readinessScore: result.readinessScore,
        });
      }

      await logAudit(
        tenantId,
        req.user!.id,
        "analyze_readiness",
        "assessment",
        id,
        { readinessScore: result.readinessScore },
        req.ip || undefined,
      );

      res.json(result);
    } catch (error) {
      console.error("Error analyzing readiness:", error);
      res.status(500).json({ message: "Failed to analyze migration readiness" });
    }
  },
);

// GET /api/v1/assessments/:id/readiness — Get readiness summary
assessmentsRouter.get(
  "/:id/readiness",
  requireAuth as any,
  requireProjectAccess as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

      const project = await storage.getProject(id, tenantId);
      if (!project) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const [projectWorkloads, risks, costs, projectRunbooks] = await Promise.all([
        storage.getWorkloadsByProject(id, tenantId),
        storage.getRisksByProject(id, tenantId),
        storage.getCostsByProject(id, tenantId),
        storage.getRunbooksByProject(id, tenantId),
      ]);

      const risksBySeverity = risks.reduce(
        (acc: Record<string, number>, r) => {
          const sev = r.severity || "unknown";
          acc[sev] = (acc[sev] || 0) + 1;
          return acc;
        },
        {},
      );

      const totalMonthlyCost = costs.reduce(
        (sum: number, c) => sum + (parseFloat(c.projectedMonthlyCost ?? "0") || 0),
        0,
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
          workloadCount: projectWorkloads.length,
          riskCount: risks.length,
          risksBySeverity,
          costProjectionCount: costs.length,
          totalMonthlyCost,
          runbookCount: projectRunbooks.length,
        },
      });
    } catch (error) {
      console.error("Error fetching readiness summary:", error);
      res.status(500).json({ message: "Failed to fetch readiness summary" });
    }
  },
);
