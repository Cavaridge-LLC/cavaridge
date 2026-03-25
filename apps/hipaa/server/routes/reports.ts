import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  assessmentReports, riskAssessments, assessmentControls, remediationItems,
  assessmentAuditLog, insertAssessmentReportSchema,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError } from "../utils/errors";

function buildReportContent(
  assessment: any,
  controls: any[],
  remediations: any[],
) {
  const totalControls = controls.length;
  const implemented = controls.filter(c => c.currentState === "implemented").length;
  const partial = controls.filter(c => c.currentState === "partial").length;
  const notImplemented = controls.filter(c => c.currentState === "not_implemented").length;
  const complianceRate = totalControls > 0 ? Math.round((implemented / totalControls) * 100) : 0;

  const criticalFindings = controls.filter(c => c.riskLevel === "critical");
  const highFindings = controls.filter(c => c.riskLevel === "high");

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      framework: assessment.framework,
      status: assessment.status,
      createdAt: assessment.createdAt,
    },
    summary: {
      totalControls,
      implemented,
      partial,
      notImplemented,
      complianceRate,
      criticalCount: criticalFindings.length,
      highCount: highFindings.length,
    },
    findings: controls
      .filter(c => c.currentState !== "implemented")
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
      .map(c => ({
        controlRef: c.controlRef,
        controlName: c.controlName,
        category: c.category,
        currentState: c.currentState,
        riskScore: c.riskScore,
        riskLevel: c.riskLevel,
        findingDetail: c.findingDetail,
        riskTreatment: c.riskTreatment,
      })),
    remediation: {
      total: remediations.length,
      open: remediations.filter(r => r.status === "open").length,
      inProgress: remediations.filter(r => r.status === "in_progress").length,
      completed: remediations.filter(r => r.status === "completed" || r.status === "verified").length,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function registerReportRoutes(app: Express, auth: any[]) {
  // ── v1 routes ──

  // List reports for an assessment
  app.get("/api/v1/assessments/:assessmentId/reports", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const reports = await db.select().from(assessmentReports)
        .where(and(
          eq(assessmentReports.assessmentId, req.params.assessmentId as string),
          eq(assessmentReports.tenantId, tenantId),
        ))
        .orderBy(desc(assessmentReports.createdAt));

      res.json({ reports });
    } catch (err) {
      next(err);
    }
  });

  // Generate report
  app.post("/api/v1/assessments/:assessmentId/reports", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { reportType = "executive_summary", format = "pdf" } = req.body;

      const [assessment] = await db.select().from(riskAssessments)
        .where(and(eq(riskAssessments.id, req.params.assessmentId as string), eq(riskAssessments.tenantId, tenantId)));

      if (!assessment) throw new NotFoundError("Assessment not found");

      const controls = await db.select().from(assessmentControls)
        .where(eq(assessmentControls.assessmentId, assessment.id));

      const remediations = await db.select().from(remediationItems)
        .where(eq(remediationItems.assessmentId, assessment.id));

      const content = buildReportContent(assessment, controls, remediations);

      // Try AI-enhanced report if agent pipeline available
      let aiContent: any = null;
      try {
        const { runReportPipeline } = await import("../agents/report-pipeline");
        const findings = controls
          .filter(c => c.currentState !== "implemented")
          .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
          .slice(0, 10)
          .map(c => ({
            controlRef: c.controlRef,
            controlName: c.controlName,
            category: c.category,
            riskLevel: c.riskLevel || "medium",
            findingDetail: c.findingDetail || "",
          }));

        aiContent = await runReportPipeline(tenantId, user.id, reportType, {
          title: assessment.title,
          framework: assessment.framework,
          totalControls: controls.length,
          implemented: controls.filter(c => c.currentState === "implemented").length,
          partial: controls.filter(c => c.currentState === "partial").length,
          notImplemented: controls.filter(c => c.currentState === "not_implemented").length,
          findings,
        });
      } catch {
        // Non-critical — report content is still valid without AI enhancement
      }

      const [report] = await db.insert(assessmentReports).values({
        assessmentId: assessment.id,
        tenantId,
        reportType: reportType as any,
        format,
        content: { ...content, aiNarrative: aiContent } as any,
        generatedBy: user.id,
      }).returning();

      await db.insert(assessmentAuditLog).values({
        assessmentId: assessment.id,
        tenantId,
        userId: user.id,
        action: "report_generated",
        resourceType: "report",
        resourceId: report.id,
        details: { reportType, format, aiEnhanced: !!aiContent },
      });

      res.status(201).json({ report });
    } catch (err) {
      next(err);
    }
  });

  // Get report detail
  app.get("/api/v1/reports/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const [report] = await db.select().from(assessmentReports)
        .where(and(eq(assessmentReports.id, req.params.id as string), eq(assessmentReports.tenantId, tenantId)));

      if (!report) throw new NotFoundError("Report not found");
      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // ── Backward-compatible routes ──

  app.get("/api/assessments/:assessmentId/reports", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const reports = await db.select().from(assessmentReports)
        .where(and(
          eq(assessmentReports.assessmentId, req.params.assessmentId as string),
          eq(assessmentReports.tenantId, tenantId),
        ))
        .orderBy(desc(assessmentReports.createdAt));

      res.json({ reports });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/assessments/:assessmentId/reports", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { reportType = "executive_summary", format = "pdf" } = req.body;

      const [assessment] = await db.select().from(riskAssessments)
        .where(and(eq(riskAssessments.id, req.params.assessmentId as string), eq(riskAssessments.tenantId, tenantId)));

      if (!assessment) throw new NotFoundError("Assessment not found");

      const controls = await db.select().from(assessmentControls)
        .where(eq(assessmentControls.assessmentId, assessment.id));

      const remediations = await db.select().from(remediationItems)
        .where(eq(remediationItems.assessmentId, assessment.id));

      const content = buildReportContent(assessment, controls, remediations);

      const [report] = await db.insert(assessmentReports).values({
        assessmentId: assessment.id,
        tenantId,
        reportType: reportType as any,
        format,
        content: content as any,
        generatedBy: user.id,
      }).returning();

      await db.insert(assessmentAuditLog).values({
        assessmentId: assessment.id,
        tenantId,
        userId: user.id,
        action: "report_generated",
        resourceType: "report",
        resourceId: report.id,
        details: { reportType, format },
      });

      res.status(201).json({ report });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/reports/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const [report] = await db.select().from(assessmentReports)
        .where(and(eq(assessmentReports.id, req.params.id as string), eq(assessmentReports.tenantId, tenantId)));

      if (!report) throw new NotFoundError("Report not found");
      res.json({ report });
    } catch (err) {
      next(err);
    }
  });
}
