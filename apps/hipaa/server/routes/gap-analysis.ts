import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  riskAssessments, assessmentControls, remediationItems,
  assessmentAuditLog, generateGapAnalysis,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "../utils/errors";

export function registerGapAnalysisRoutes(app: Express, auth: any[]) {
  // GET /api/v1/assessments/:id/gap-analysis — Generate gap analysis from current scores
  app.get("/api/v1/assessments/:id/gap-analysis", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;

      const [assessment] = await db.select().from(riskAssessments)
        .where(and(
          eq(riskAssessments.id, req.params.id as string),
          eq(riskAssessments.tenantId, tenantId),
        ));

      if (!assessment) throw new NotFoundError("Assessment not found");

      const controls = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.assessmentId, assessment.id),
          eq(assessmentControls.tenantId, tenantId),
        ));

      const gaps = generateGapAnalysis(controls);

      // Summary statistics
      const totalControls = controls.length;
      const implemented = controls.filter(c => c.currentState === "implemented").length;
      const partial = controls.filter(c => c.currentState === "partial").length;
      const notImplemented = controls.filter(c => c.currentState === "not_implemented").length;
      const complianceRate = totalControls > 0 ? Math.round((implemented / totalControls) * 100) : 0;

      // Risk distribution
      const bySeverity = {
        critical: gaps.filter(g => g.priority === "critical").length,
        high: gaps.filter(g => g.priority === "high").length,
        medium: gaps.filter(g => g.priority === "medium").length,
        low: gaps.filter(g => g.priority === "low").length,
      };

      // By category
      const byCategory = {
        administrative: gaps.filter(g => g.category === "administrative").length,
        physical: gaps.filter(g => g.category === "physical").length,
        technical: gaps.filter(g => g.category === "technical").length,
      };

      res.json({
        assessment: {
          id: assessment.id,
          title: assessment.title,
          framework: assessment.framework,
          status: assessment.status,
        },
        summary: {
          totalControls,
          implemented,
          partial,
          notImplemented,
          complianceRate,
          totalGaps: gaps.length,
        },
        riskDistribution: bySeverity,
        categoryBreakdown: byCategory,
        gaps,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/assessments/:id/gap-analysis/generate — AI-powered gap analysis
  app.post("/api/v1/assessments/:id/gap-analysis/generate", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const [assessment] = await db.select().from(riskAssessments)
        .where(and(
          eq(riskAssessments.id, req.params.id as string),
          eq(riskAssessments.tenantId, tenantId),
        ));

      if (!assessment) throw new NotFoundError("Assessment not found");

      // Try AI-powered gap analysis via the agent pipeline
      try {
        const { runGapAnalysis } = await import("../agents/gap-analysis");
        const result = await runGapAnalysis(tenantId, user.id, assessment.id);

        await db.insert(assessmentAuditLog).values({
          assessmentId: assessment.id,
          tenantId,
          userId: user.id,
          action: "gap_analysis_generated",
          resourceType: "assessment",
          resourceId: assessment.id,
          details: { aiPowered: true },
        });

        return res.json({ result, aiPowered: true });
      } catch {
        // Fallback to deterministic gap analysis
        const controls = await db.select().from(assessmentControls)
          .where(and(
            eq(assessmentControls.assessmentId, assessment.id),
            eq(assessmentControls.tenantId, tenantId),
          ));

        const gaps = generateGapAnalysis(controls);

        await db.insert(assessmentAuditLog).values({
          assessmentId: assessment.id,
          tenantId,
          userId: user.id,
          action: "gap_analysis_generated",
          resourceType: "assessment",
          resourceId: assessment.id,
          details: { aiPowered: false, fallback: true },
        });

        return res.json({ gaps, aiPowered: false });
      }
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/assessments/:id/gap-analysis/remediate — Auto-generate remediation items from gaps
  app.post("/api/v1/assessments/:id/gap-analysis/remediate", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const [assessment] = await db.select().from(riskAssessments)
        .where(and(
          eq(riskAssessments.id, req.params.id as string),
          eq(riskAssessments.tenantId, tenantId),
        ));

      if (!assessment) throw new NotFoundError("Assessment not found");

      const controls = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.assessmentId, assessment.id),
          eq(assessmentControls.tenantId, tenantId),
        ));

      const gaps = generateGapAnalysis(controls);

      // Priority mapping
      const priorityMap: Record<string, number> = {
        critical: 5,
        high: 4,
        medium: 3,
        low: 2,
      };

      const created: any[] = [];

      for (const gap of gaps) {
        // Find control ID for this gap
        const control = controls.find(c => c.controlRef === gap.controlRef);

        const [item] = await db.insert(remediationItems).values({
          assessmentId: assessment.id,
          controlId: control?.id || null,
          tenantId,
          title: `Remediate: ${gap.controlName} (${gap.controlRef})`,
          description: gap.recommendation,
          status: "open",
          priority: priorityMap[gap.priority] || 3,
        }).returning();

        created.push(item);
      }

      await db.insert(assessmentAuditLog).values({
        assessmentId: assessment.id,
        tenantId,
        userId: user.id,
        action: "remediation_auto_generated",
        resourceType: "assessment",
        resourceId: assessment.id,
        details: { itemsCreated: created.length },
      });

      res.status(201).json({ items: created, count: created.length });
    } catch (err) {
      next(err);
    }
  });

  // Backward-compatible (no v1 prefix)
  app.get("/api/assessments/:id/gap-analysis", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;

      const [assessment] = await db.select().from(riskAssessments)
        .where(and(
          eq(riskAssessments.id, req.params.id as string),
          eq(riskAssessments.tenantId, tenantId),
        ));

      if (!assessment) throw new NotFoundError("Assessment not found");

      const controls = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.assessmentId, assessment.id),
          eq(assessmentControls.tenantId, tenantId),
        ));

      const gaps = generateGapAnalysis(controls);

      const totalControls = controls.length;
      const implemented = controls.filter(c => c.currentState === "implemented").length;
      const complianceRate = totalControls > 0 ? Math.round((implemented / totalControls) * 100) : 0;

      res.json({
        assessment: { id: assessment.id, title: assessment.title },
        summary: { totalControls, complianceRate, totalGaps: gaps.length },
        gaps,
      });
    } catch (err) {
      next(err);
    }
  });
}
