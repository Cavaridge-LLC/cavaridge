import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { riskAssessments, assessmentControls, remediationItems, assessmentAuditLog } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

function buildDashboardSummary(
  assessments: any[],
  allControls: any[],
  allRemediation: any[],
  recentAudit: any[],
) {
  const now = new Date();
  const openFindings = allControls.filter(c => c.currentState !== "implemented");

  return {
    summary: {
      totalAssessments: assessments.length,
      byStatus: {
        draft: assessments.filter(a => a.status === "draft").length,
        inProgress: assessments.filter(a => a.status === "in_progress").length,
        review: assessments.filter(a => a.status === "review").length,
        completed: assessments.filter(a => a.status === "completed").length,
        approved: assessments.filter(a => a.status === "approved").length,
      },
      openFindings: {
        total: openFindings.length,
        critical: openFindings.filter(c => c.riskLevel === "critical").length,
        high: openFindings.filter(c => c.riskLevel === "high").length,
        medium: openFindings.filter(c => c.riskLevel === "medium").length,
        low: openFindings.filter(c => c.riskLevel === "low").length,
      },
      remediation: {
        total: allRemediation.length,
        overdue: allRemediation.filter(r => r.dueDate && new Date(r.dueDate) < now && r.status !== "completed" && r.status !== "verified").length,
      },
      complianceRate: allControls.length > 0
        ? Math.round((allControls.filter(c => c.currentState === "implemented").length / allControls.length) * 100)
        : 0,
    },
    recentActivity: recentAudit.map(a => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      details: a.details,
      createdAt: a.createdAt,
    })),
  };
}

function buildHeatmap(controls: any[]) {
  const heatmap = {
    administrative: { total: 0, implemented: 0, partial: 0, notImplemented: 0 },
    physical: { total: 0, implemented: 0, partial: 0, notImplemented: 0 },
    technical: { total: 0, implemented: 0, partial: 0, notImplemented: 0 },
  };

  for (const c of controls) {
    const cat = c.category as keyof typeof heatmap;
    if (!heatmap[cat]) continue;
    heatmap[cat].total++;
    if (c.currentState === "implemented") heatmap[cat].implemented++;
    else if (c.currentState === "partial") heatmap[cat].partial++;
    else heatmap[cat].notImplemented++;
  }

  return heatmap;
}

export function registerDashboardRoutes(app: Express, auth: any[]) {
  const dashboardHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;

      const assessments = await db.select().from(riskAssessments)
        .where(eq(riskAssessments.tenantId, tenantId));

      const allControls = await db.select().from(assessmentControls)
        .where(eq(assessmentControls.tenantId, tenantId));

      const allRemediation = await db.select().from(remediationItems)
        .where(eq(remediationItems.tenantId, tenantId));

      const recentAudit = await db.select().from(assessmentAuditLog)
        .where(eq(assessmentAuditLog.tenantId, tenantId))
        .orderBy(desc(assessmentAuditLog.createdAt))
        .limit(10);

      res.json(buildDashboardSummary(assessments, allControls, allRemediation, recentAudit));
    } catch (err) {
      next(err);
    }
  };

  const heatmapHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const controls = await db.select().from(assessmentControls)
        .where(eq(assessmentControls.tenantId, tenantId));

      res.json({ heatmap: buildHeatmap(controls) });
    } catch (err) {
      next(err);
    }
  };

  // v1 routes
  app.get("/api/v1/dashboard/summary", ...auth, dashboardHandler);
  app.get("/api/v1/dashboard/risk-heatmap", ...auth, heatmapHandler);

  // Backward-compatible
  app.get("/api/dashboard/summary", ...auth, dashboardHandler);
  app.get("/api/dashboard/risk-heatmap", ...auth, heatmapHandler);
}
