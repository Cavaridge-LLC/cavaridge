/**
 * Meridian — Assessment CRUD API Routes
 *
 * Express 5 routes for the 12-section IT Due Diligence Assessment framework.
 * All routes are tenant-scoped and require MSP Admin or MSP Tech role.
 *
 * Endpoints:
 *   POST   /api/v1/assessments              — Create assessment
 *   GET    /api/v1/assessments              — List assessments (tenant-scoped)
 *   GET    /api/v1/assessments/:id          — Get assessment with sections
 *   PUT    /api/v1/assessments/:id          — Update assessment
 *   POST   /api/v1/assessments/:id/sections/:sectionId — Update section
 *   GET    /api/v1/assessments/:id/evidence — List evidence items
 *   POST   /api/v1/assessments/:id/evidence — Create evidence item
 *   GET    /api/v1/assessments/:id/risk-matrix — Get risk matrix
 *   POST   /api/v1/assessments/:id/risk-matrix — Create risk matrix entry
 *   POST   /api/v1/assessments/:id/risk-matrix/generate — Auto-generate from findings
 *   POST   /api/v1/assessments/:id/analyze  — AI-powered analysis via Ducky
 *   POST   /api/v1/assessments/:id/sections/:sectionId/narrative — AI section narrative
 *   GET    /api/v1/assessments/:id/tenant-data — Get tenant-intel data
 *   POST   /api/v1/assessments/:id/tenant-data — Capture tenant-intel snapshot
 *   GET    /api/v1/dashboard/assessments    — Dashboard metrics
 */

import type { Express } from "express";
import { z } from "zod";
import {
  requireAuth,
  logAudit,
  type AuthenticatedRequest,
} from "../auth";
import { requirePerm } from "./_helpers";
import {
  createAssessment,
  getAssessment,
  getAssessmentsByTenant,
  getAssessmentsByDeal,
  updateAssessment,
  getAssessmentSections,
  getAssessmentSection,
  updateAssessmentSection,
  createEvidenceItem,
  getEvidenceBySection,
  getEvidenceByAssessment,
  updateEvidenceItem,
  deleteEvidenceItem,
  createRiskMatrixEntry,
  getRiskMatrix,
  updateRiskMatrixEntry,
  deleteRiskMatrixEntry,
  generateRiskMatrixFromFindings,
  computeRiskScore,
  saveAssessmentTenantData,
  getAssessmentTenantData,
  getDashboardMetrics,
} from "../services/assessment-service";
import { storage } from "../storage";
import { analyzeFindings, generateSectionNarrative } from "../services/ducky-client";
import { enrichDealWithTenantIntel } from "../services/tenant-intel";
import type { RiskSeverity, RiskLikelihood } from "@shared/schema";

// ── Validation schemas ────────────────────────────────────────────────

const createAssessmentBody = z.object({
  dealId: z.string().min(1),
  title: z.string().min(1).max(500),
  assessmentType: z.enum(["full", "targeted", "update"]).default("full"),
  assignedTo: z.string().optional(),
  targetTenantId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const updateAssessmentBody = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(["draft", "in_progress", "review", "complete", "archived"]).optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  overallRiskRating: z.enum(["critical", "high", "medium", "low"]).optional(),
});

const updateSectionBody = z.object({
  status: z.enum(["not_started", "in_progress", "complete", "needs_review"]).optional(),
  narrativeContent: z.string().optional(),
  summaryNotes: z.string().optional(),
  evidenceTag: z.enum(["OBSERVED", "REPRESENTED", "UNVERIFIED"]).optional(),
  riskLevel: z.enum(["critical", "high", "medium", "low"]).optional(),
  completedBy: z.string().optional(),
});

const createEvidenceBody = z.object({
  sectionId: z.string().min(1),
  evidenceType: z.enum(["document", "screenshot", "interview", "note", "configuration", "scan_result"]),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  evidenceTag: z.enum(["OBSERVED", "REPRESENTED", "UNVERIFIED"]).default("UNVERIFIED"),
  sourceType: z.string().optional(),
  sourceReference: z.string().optional(),
  attachmentDocumentId: z.string().optional(),
  attachmentFilename: z.string().optional(),
  attachmentMimeType: z.string().optional(),
  attachmentSize: z.number().optional(),
  interviewSubject: z.string().optional(),
  interviewDate: z.string().datetime().optional(),
  interviewNotes: z.string().optional(),
  screenshotUrl: z.string().url().optional(),
});

const createRiskEntryBody = z.object({
  sectionId: z.string().optional(),
  findingId: z.string().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  likelihood: z.enum(["almost_certain", "likely", "possible", "unlikely", "rare"]),
  capexEstimateLow: z.number().optional(),
  capexEstimateHigh: z.number().optional(),
  remediationPlan: z.string().optional(),
  remediationTimeline: z.string().optional(),
  owner: z.string().optional(),
  evidenceTag: z.enum(["OBSERVED", "REPRESENTED", "UNVERIFIED"]).optional(),
});

// ── Helper: extract param as string ───────────────────────────────────

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// ── Route Registration ────────────────────────────────────────────────

export function registerAssessmentRoutes(app: Express): void {

  // ── POST /api/v1/assessments ──────────────────────────────────────
  app.post("/api/v1/assessments", requireAuth as any, requirePerm("create_deals") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createAssessmentBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const { dealId, title, assessmentType, assignedTo, targetTenantId, notes } = parsed.data;

      // Verify deal exists and belongs to tenant
      const deal = await storage.getDeal(dealId);
      if (!deal || deal.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Deal not found" });
      }

      const assessment = await createAssessment({
        tenantId: req.orgId!,
        dealId,
        title,
        assessmentType,
        assignedTo: assignedTo ?? null,
        targetTenantId: targetTenantId ?? null,
        notes: notes ?? null,
        status: "draft",
        completedSections: 0,
        totalSections: 12,
        startedAt: null,
        completedAt: null,
        overallRiskRating: null,
      });

      await logAudit(req.orgId!, req.user!.id, "deal_created", "assessment", assessment.id,
        { title, dealId, assessmentType }, req.ip || undefined);

      res.status(201).json(assessment);
    } catch (error) {
      req.log?.error({ error }, "Failed to create assessment");
      res.status(500).json({ message: "Failed to create assessment" });
    }
  });

  // ── GET /api/v1/assessments ───────────────────────────────────────
  app.get("/api/v1/assessments", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const dealId = req.query.dealId as string | undefined;
      let result;
      if (dealId) {
        // Verify deal belongs to tenant
        const deal = await storage.getDeal(dealId);
        if (!deal || deal.tenantId !== req.orgId) {
          return res.status(404).json({ message: "Deal not found" });
        }
        result = await getAssessmentsByDeal(dealId);
      } else {
        result = await getAssessmentsByTenant(req.orgId!);
      }
      res.json(result);
    } catch (error) {
      req.log?.error({ error }, "Failed to list assessments");
      res.status(500).json({ message: "Failed to list assessments" });
    }
  });

  // ── GET /api/v1/assessments/:id ───────────────────────────────────
  app.get("/api/v1/assessments/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const id = param(req.params.id);
      const assessment = await getAssessment(id);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      const sections = await getAssessmentSections(id);
      res.json({ ...assessment, sections });
    } catch (error) {
      req.log?.error({ error }, "Failed to get assessment");
      res.status(500).json({ message: "Failed to get assessment" });
    }
  });

  // ── PUT /api/v1/assessments/:id ───────────────────────────────────
  app.put("/api/v1/assessments/:id", requireAuth as any, requirePerm("edit_deal_metadata") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const id = param(req.params.id);
      const assessment = await getAssessment(id);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const parsed = updateAssessmentBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updates.title = parsed.data.title;
      if (parsed.data.status !== undefined) {
        updates.status = parsed.data.status;
        if (parsed.data.status === "in_progress" && !assessment.startedAt) {
          updates.startedAt = new Date();
        }
        if (parsed.data.status === "complete") {
          updates.completedAt = new Date();
        }
      }
      if (parsed.data.assignedTo !== undefined) updates.assignedTo = parsed.data.assignedTo;
      if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
      if (parsed.data.overallRiskRating !== undefined) updates.overallRiskRating = parsed.data.overallRiskRating;

      const updated = await updateAssessment(id, updates as any);

      await logAudit(req.orgId!, req.user!.id, "deal_updated", "assessment", id,
        { changes: Object.keys(updates) }, req.ip || undefined);

      res.json(updated);
    } catch (error) {
      req.log?.error({ error }, "Failed to update assessment");
      res.status(500).json({ message: "Failed to update assessment" });
    }
  });

  // ── POST /api/v1/assessments/:id/sections/:sectionId ─────────────
  app.post("/api/v1/assessments/:id/sections/:sectionId", requireAuth as any, requirePerm("edit_deal_metadata") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const sectionId = param(req.params.sectionId);

      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const section = await getAssessmentSection(sectionId);
      if (!section || section.assessmentId !== assessmentId) {
        return res.status(404).json({ message: "Section not found" });
      }

      const parsed = updateSectionBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;
      if (parsed.data.narrativeContent !== undefined) updates.narrativeContent = parsed.data.narrativeContent;
      if (parsed.data.summaryNotes !== undefined) updates.summaryNotes = parsed.data.summaryNotes;
      if (parsed.data.evidenceTag !== undefined) updates.evidenceTag = parsed.data.evidenceTag;
      if (parsed.data.riskLevel !== undefined) updates.riskLevel = parsed.data.riskLevel;
      if (parsed.data.completedBy !== undefined) updates.completedBy = parsed.data.completedBy;
      if (parsed.data.status === "complete") {
        updates.completedAt = new Date();
        updates.completedBy = updates.completedBy || req.user!.id;
      }

      const updated = await updateAssessmentSection(sectionId, updates as any);
      res.json(updated);
    } catch (error) {
      req.log?.error({ error }, "Failed to update section");
      res.status(500).json({ message: "Failed to update section" });
    }
  });

  // ── Evidence Endpoints ────────────────────────────────────────────

  app.get("/api/v1/assessments/:id/evidence", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const sectionId = req.query.sectionId as string | undefined;
      const evidence = sectionId
        ? await getEvidenceBySection(sectionId)
        : await getEvidenceByAssessment(assessmentId);
      res.json(evidence);
    } catch (error) {
      req.log?.error({ error }, "Failed to list evidence");
      res.status(500).json({ message: "Failed to list evidence" });
    }
  });

  app.post("/api/v1/assessments/:id/evidence", requireAuth as any, requirePerm("add_findings") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const parsed = createEvidenceBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      // Verify section belongs to this assessment
      const section = await getAssessmentSection(parsed.data.sectionId);
      if (!section || section.assessmentId !== assessmentId) {
        return res.status(404).json({ message: "Section not found in this assessment" });
      }

      const item = await createEvidenceItem({
        assessmentId,
        sectionId: parsed.data.sectionId,
        evidenceType: parsed.data.evidenceType,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        evidenceTag: parsed.data.evidenceTag,
        sourceType: parsed.data.sourceType ?? null,
        sourceReference: parsed.data.sourceReference ?? null,
        attachmentDocumentId: parsed.data.attachmentDocumentId ?? null,
        attachmentFilename: parsed.data.attachmentFilename ?? null,
        attachmentMimeType: parsed.data.attachmentMimeType ?? null,
        attachmentSize: parsed.data.attachmentSize ?? null,
        interviewSubject: parsed.data.interviewSubject ?? null,
        interviewDate: parsed.data.interviewDate ? new Date(parsed.data.interviewDate) : null,
        interviewNotes: parsed.data.interviewNotes ?? null,
        screenshotUrl: parsed.data.screenshotUrl ?? null,
        collectedBy: req.user!.id,
        collectedAt: new Date(),
        metadataJson: null,
      });

      await logAudit(req.orgId!, req.user!.id, "finding_added", "evidence", item.id,
        { title: parsed.data.title, sectionId: parsed.data.sectionId }, req.ip || undefined);

      res.status(201).json(item);
    } catch (error) {
      req.log?.error({ error }, "Failed to create evidence item");
      res.status(500).json({ message: "Failed to create evidence item" });
    }
  });

  // ── Risk Matrix Endpoints ─────────────────────────────────────────

  app.get("/api/v1/assessments/:id/risk-matrix", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const matrix = await getRiskMatrix(assessmentId);

      // Compute summary
      const summary = {
        totalEntries: matrix.length,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>,
        totalCapexLow: 0,
        totalCapexHigh: 0,
      };
      for (const entry of matrix) {
        summary.bySeverity[entry.severity] = (summary.bySeverity[entry.severity] || 0) + 1;
        if (entry.status === "open" || entry.status === "in_progress") {
          summary.totalCapexLow += entry.capexEstimateLow ?? 0;
          summary.totalCapexHigh += entry.capexEstimateHigh ?? 0;
        }
      }

      res.json({ entries: matrix, summary });
    } catch (error) {
      req.log?.error({ error }, "Failed to get risk matrix");
      res.status(500).json({ message: "Failed to get risk matrix" });
    }
  });

  app.post("/api/v1/assessments/:id/risk-matrix", requireAuth as any, requirePerm("add_findings") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const parsed = createRiskEntryBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const riskScore = computeRiskScore(
        parsed.data.severity as RiskSeverity,
        parsed.data.likelihood as RiskLikelihood
      );

      const entry = await createRiskMatrixEntry({
        assessmentId,
        sectionId: parsed.data.sectionId ?? null,
        findingId: parsed.data.findingId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        severity: parsed.data.severity,
        likelihood: parsed.data.likelihood,
        riskScore,
        capexEstimateLow: parsed.data.capexEstimateLow ?? null,
        capexEstimateHigh: parsed.data.capexEstimateHigh ?? null,
        remediationPlan: parsed.data.remediationPlan ?? null,
        remediationTimeline: parsed.data.remediationTimeline ?? null,
        owner: parsed.data.owner ?? null,
        status: "open",
        evidenceTag: parsed.data.evidenceTag ?? "UNVERIFIED",
      });

      res.status(201).json(entry);
    } catch (error) {
      req.log?.error({ error }, "Failed to create risk matrix entry");
      res.status(500).json({ message: "Failed to create risk matrix entry" });
    }
  });

  app.post("/api/v1/assessments/:id/risk-matrix/generate", requireAuth as any, requirePerm("add_findings") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Get findings from the associated deal
      const findingsList = await storage.getFindingsByDeal(assessment.dealId);
      if (findingsList.length === 0) {
        return res.status(400).json({ message: "No findings to generate risk matrix from" });
      }

      const entries = await generateRiskMatrixFromFindings(assessmentId, findingsList);

      await logAudit(req.orgId!, req.user!.id, "deal_updated", "assessment", assessmentId,
        { action: "risk_matrix_generated", entryCount: entries.length }, req.ip || undefined);

      res.status(201).json({ entries, count: entries.length });
    } catch (error) {
      req.log?.error({ error }, "Failed to generate risk matrix");
      res.status(500).json({ message: "Failed to generate risk matrix" });
    }
  });

  // ── AI Analysis Endpoints (via Ducky) ─────────────────────────────

  app.post("/api/v1/assessments/:id/analyze", requireAuth as any, requirePerm("use_chat") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const deal = await storage.getDeal(assessment.dealId);
      if (!deal) {
        return res.status(404).json({ message: "Associated deal not found" });
      }

      const findingsList = await storage.getFindingsByDeal(assessment.dealId);
      const analysis = await analyzeFindings(
        deal.targetName,
        deal.industry,
        findingsList.map(f => ({
          title: f.title,
          severity: f.severity,
          description: f.description,
        }))
      );

      res.json(analysis);
    } catch (error) {
      req.log?.error({ error }, "Failed to analyze assessment");
      res.status(500).json({ message: "Failed to analyze assessment" });
    }
  });

  app.post("/api/v1/assessments/:id/sections/:sectionId/narrative", requireAuth as any, requirePerm("use_chat") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const sectionId = param(req.params.sectionId);

      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const section = await getAssessmentSection(sectionId);
      if (!section || section.assessmentId !== assessmentId) {
        return res.status(404).json({ message: "Section not found" });
      }

      const deal = await storage.getDeal(assessment.dealId);
      if (!deal) {
        return res.status(404).json({ message: "Associated deal not found" });
      }

      // Gather evidence and findings for the section
      const evidence = await getEvidenceBySection(sectionId);
      const evidenceSummaries = evidence.map(e =>
        `[${e.evidenceTag}] ${e.title}${e.description ? ` — ${e.description}` : ""}`
      );

      const findingsList = await storage.getFindingsByDeal(assessment.dealId);
      const findingsSummaries = findingsList.map(f => `[${f.severity}] ${f.title}`);

      const narrative = await generateSectionNarrative(
        section.sectionName,
        deal.targetName,
        evidenceSummaries,
        findingsSummaries
      );

      res.json(narrative);
    } catch (error) {
      req.log?.error({ error }, "Failed to generate section narrative");
      res.status(500).json({ message: "Failed to generate section narrative" });
    }
  });

  // ── Tenant-Intel Endpoints ────────────────────────────────────────

  app.get("/api/v1/assessments/:id/tenant-data", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const tenantData = await getAssessmentTenantData(assessmentId);
      res.json(tenantData || null);
    } catch (error) {
      req.log?.error({ error }, "Failed to get tenant data");
      res.status(500).json({ message: "Failed to get tenant data" });
    }
  });

  app.post("/api/v1/assessments/:id/tenant-data", requireAuth as any, requirePerm("edit_deal_metadata") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentId = param(req.params.id);
      const assessment = await getAssessment(assessmentId);
      if (!assessment || assessment.tenantId !== req.orgId) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      if (!assessment.targetTenantId) {
        return res.status(400).json({ message: "No target tenant configured for this assessment" });
      }

      // Attempt to enrich with tenant-intel data
      const intelData = await enrichDealWithTenantIntel(assessment.targetTenantId);

      if (!intelData) {
        return res.json({
          message: "Tenant intelligence not available. Configure M365/GWS credentials for the target tenant.",
          available: false,
        });
      }

      const saved = await saveAssessmentTenantData({
        assessmentId,
        tenantId: assessment.targetTenantId,
        sourceVendor: "microsoft",
        snapshotData: intelData.snapshot,
        securityPostureData: intelData.securityPosture,
        licenseData: intelData.licenseUtilization,
        userCount: intelData.userCount,
        licensedUserCount: intelData.licensedUserCount,
        securityScore: intelData.securityScore ? String(intelData.securityScore) : null,
        securityScoreMax: intelData.securityScoreMax ? String(intelData.securityScoreMax) : null,
        deviceCount: intelData.deviceCount,
        capturedAt: new Date(),
      });

      res.status(201).json(saved);
    } catch (error) {
      req.log?.error({ error }, "Failed to capture tenant data");
      res.status(500).json({ message: "Failed to capture tenant data" });
    }
  });

  // ── Dashboard Endpoint ────────────────────────────────────────────

  app.get("/api/v1/dashboard/assessments", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const metrics = await getDashboardMetrics(req.orgId!);
      res.json(metrics);
    } catch (error) {
      req.log?.error({ error }, "Failed to get dashboard metrics");
      res.status(500).json({ message: "Failed to get dashboard metrics" });
    }
  });
}
