import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  riskAssessments, assessmentControls, remediationItems,
  complianceSnapshots, assessmentAuditLog,
} from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { NotFoundError } from "../utils/errors";

export function registerTimelineRoutes(app: Express, auth: any[]) {
  // GET /api/v1/assessments/:id/timeline — Get compliance posture history
  app.get("/api/v1/assessments/:id/timeline", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;

      const [assessment] = await db.select().from(riskAssessments)
        .where(and(
          eq(riskAssessments.id, req.params.id as string),
          eq(riskAssessments.tenantId, tenantId),
        ));

      if (!assessment) throw new NotFoundError("Assessment not found");

      const snapshots = await db.select().from(complianceSnapshots)
        .where(and(
          eq(complianceSnapshots.assessmentId, assessment.id),
          eq(complianceSnapshots.tenantId, tenantId),
        ))
        .orderBy(asc(complianceSnapshots.snapshotDate));

      // Also get audit log for key events
      const auditEvents = await db.select().from(assessmentAuditLog)
        .where(and(
          eq(assessmentAuditLog.assessmentId, assessment.id),
          eq(assessmentAuditLog.tenantId, tenantId),
        ))
        .orderBy(desc(assessmentAuditLog.createdAt))
        .limit(50);

      res.json({
        assessment: {
          id: assessment.id,
          title: assessment.title,
          status: assessment.status,
          createdAt: assessment.createdAt,
          completedAt: assessment.completedAt,
          approvedAt: assessment.approvedAt,
        },
        snapshots: snapshots.map(s => ({
          id: s.id,
          date: s.snapshotDate,
          totalControls: s.totalControls,
          implemented: s.implemented,
          partial: s.partial,
          notImplemented: s.notImplemented,
          complianceRate: s.complianceRate,
          criticalFindings: s.criticalFindings,
          highFindings: s.highFindings,
          mediumFindings: s.mediumFindings,
          lowFindings: s.lowFindings,
          openRemediations: s.openRemediations,
        })),
        events: auditEvents.map(e => ({
          id: e.id,
          action: e.action,
          resourceType: e.resourceType,
          details: e.details,
          createdAt: e.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/assessments/:id/timeline/snapshot — Capture a compliance snapshot
  app.post("/api/v1/assessments/:id/timeline/snapshot", ...auth, async (req: Request, res: Response, next: NextFunction) => {
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

      const remediations = await db.select().from(remediationItems)
        .where(and(
          eq(remediationItems.assessmentId, assessment.id),
          eq(remediationItems.tenantId, tenantId),
        ));

      const totalControls = controls.length;
      const implemented = controls.filter(c => c.currentState === "implemented").length;
      const partial = controls.filter(c => c.currentState === "partial").length;
      const notImplemented = controls.filter(c => c.currentState === "not_implemented").length;
      const complianceRate = totalControls > 0 ? Math.round((implemented / totalControls) * 100) : 0;

      const [snapshot] = await db.insert(complianceSnapshots).values({
        assessmentId: assessment.id,
        tenantId,
        totalControls,
        implemented,
        partial,
        notImplemented,
        complianceRate,
        criticalFindings: controls.filter(c => c.riskLevel === "critical").length,
        highFindings: controls.filter(c => c.riskLevel === "high").length,
        mediumFindings: controls.filter(c => c.riskLevel === "medium").length,
        lowFindings: controls.filter(c => c.riskLevel === "low").length,
        openRemediations: remediations.filter(r => r.status === "open" || r.status === "in_progress").length,
        metadata: req.body.metadata || null,
      }).returning();

      await db.insert(assessmentAuditLog).values({
        assessmentId: assessment.id,
        tenantId,
        userId: user.id,
        action: "snapshot_captured",
        resourceType: "snapshot",
        resourceId: snapshot.id,
        details: { complianceRate, totalControls },
      });

      res.status(201).json({ snapshot });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/tenant/compliance-trend — Aggregate compliance trend across all assessments
  app.get("/api/v1/tenant/compliance-trend", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;

      const snapshots = await db.select().from(complianceSnapshots)
        .where(eq(complianceSnapshots.tenantId, tenantId))
        .orderBy(asc(complianceSnapshots.snapshotDate));

      const assessments = await db.select().from(riskAssessments)
        .where(eq(riskAssessments.tenantId, tenantId))
        .orderBy(desc(riskAssessments.createdAt));

      // Current posture from latest assessment controls
      const latestAssessment = assessments[0];
      let currentPosture = { complianceRate: 0, totalControls: 0, gaps: 0 };

      if (latestAssessment) {
        const controls = await db.select().from(assessmentControls)
          .where(and(
            eq(assessmentControls.assessmentId, latestAssessment.id),
            eq(assessmentControls.tenantId, tenantId),
          ));

        const implemented = controls.filter(c => c.currentState === "implemented").length;
        currentPosture = {
          complianceRate: controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0,
          totalControls: controls.length,
          gaps: controls.filter(c => c.currentState !== "implemented").length,
        };
      }

      res.json({
        currentPosture,
        totalAssessments: assessments.length,
        snapshots: snapshots.map(s => ({
          date: s.snapshotDate,
          complianceRate: s.complianceRate,
          criticalFindings: s.criticalFindings,
          highFindings: s.highFindings,
          openRemediations: s.openRemediations,
        })),
      });
    } catch (err) {
      next(err);
    }
  });
}
