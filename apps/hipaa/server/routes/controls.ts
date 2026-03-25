import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { assessmentControls, riskAssessments, assessmentAuditLog, computeRiskLevel } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { ValidationError, NotFoundError } from "../utils/errors";

export function registerControlRoutes(app: Express, auth: any[]) {
  // List controls for an assessment (v1)
  app.get("/api/v1/assessments/:assessmentId/controls", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const controls = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.assessmentId, req.params.assessmentId as string),
          eq(assessmentControls.tenantId, tenantId),
        ));

      res.json({ controls });
    } catch (err) {
      next(err);
    }
  });

  // Update a control's findings (v1)
  app.put("/api/v1/assessments/:assessmentId/controls/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { currentState, findingDetail, likelihood, impact, riskTreatment, evidenceNotes } = req.body;

      // Compute risk score and level
      const lVal = likelihood ? Math.min(5, Math.max(1, parseInt(likelihood))) : undefined;
      const iVal = impact ? Math.min(5, Math.max(1, parseInt(impact))) : undefined;

      let riskScore: number | undefined;
      let riskLevel: string | undefined;
      if (lVal !== undefined && iVal !== undefined) {
        const computed = computeRiskLevel(lVal, iVal);
        riskScore = computed.score;
        riskLevel = computed.level;
      }

      const [control] = await db.update(assessmentControls)
        .set({
          ...(currentState && { currentState }),
          ...(findingDetail !== undefined && { findingDetail }),
          ...(lVal !== undefined && { likelihood: lVal }),
          ...(iVal !== undefined && { impact: iVal }),
          ...(riskScore !== undefined && { riskScore }),
          ...(riskLevel !== undefined && { riskLevel: riskLevel as any }),
          ...(riskTreatment && { riskTreatment }),
          ...(evidenceNotes !== undefined && { evidenceNotes }),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(
          eq(assessmentControls.id, req.params.id as string),
          eq(assessmentControls.assessmentId, req.params.assessmentId as string),
          eq(assessmentControls.tenantId, tenantId),
        ))
        .returning();

      if (!control) throw new NotFoundError("Control not found");

      await db.insert(assessmentAuditLog).values({
        assessmentId: req.params.assessmentId as string,
        tenantId,
        userId: user.id,
        action: "control_updated",
        resourceType: "control",
        resourceId: control.id,
        details: { controlRef: control.controlRef, currentState, riskScore, riskLevel },
      });

      res.json({ control });
    } catch (err) {
      next(err);
    }
  });

  // Request AI guidance for a control (v1)
  app.post("/api/v1/assessments/:assessmentId/controls/:id/guidance", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const [control] = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.id, req.params.id as string),
          eq(assessmentControls.tenantId, tenantId),
        ));

      if (!control) throw new NotFoundError("Control not found");

      try {
        const { runAssessmentGuidance } = await import("../agents/assessment-guidance");
        const guidance = await runAssessmentGuidance(
          tenantId, user.id,
          control.controlRef,
          control.controlName,
          control.currentState,
          control.findingDetail || "",
        );
        return res.json({ guidance });
      } catch {
        return res.json({
          guidance: {
            guidance: `Review your organization's implementation of ${control.controlName} (${control.controlRef}). Ensure documentation exists for current controls, identify any gaps between current state and HIPAA requirements, and document evidence of compliance.`,
            recommendations: [
              "Document current policies and procedures related to this control",
              "Identify gaps between current implementation and HIPAA requirements",
              "Create an action plan to address identified gaps",
              "Collect evidence of compliance (policies, screenshots, audit logs)",
            ],
          },
        });
      }
    } catch (err) {
      next(err);
    }
  });

  // ── Backward-compatible routes (no v1 prefix) ──

  app.get("/api/assessments/:assessmentId/controls", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const controls = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.assessmentId, req.params.assessmentId as string),
          eq(assessmentControls.tenantId, tenantId),
        ));

      res.json({ controls });
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/assessments/:assessmentId/controls/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { currentState, findingDetail, likelihood, impact, riskTreatment, evidenceNotes } = req.body;

      const lVal = likelihood ? Math.min(5, Math.max(1, parseInt(likelihood))) : undefined;
      const iVal = impact ? Math.min(5, Math.max(1, parseInt(impact))) : undefined;

      let riskScore: number | undefined;
      let riskLevel: string | undefined;
      if (lVal !== undefined && iVal !== undefined) {
        const computed = computeRiskLevel(lVal, iVal);
        riskScore = computed.score;
        riskLevel = computed.level;
      }

      const [control] = await db.update(assessmentControls)
        .set({
          ...(currentState && { currentState }),
          ...(findingDetail !== undefined && { findingDetail }),
          ...(lVal !== undefined && { likelihood: lVal }),
          ...(iVal !== undefined && { impact: iVal }),
          ...(riskScore !== undefined && { riskScore }),
          ...(riskLevel !== undefined && { riskLevel: riskLevel as any }),
          ...(riskTreatment && { riskTreatment }),
          ...(evidenceNotes !== undefined && { evidenceNotes }),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(
          eq(assessmentControls.id, req.params.id as string),
          eq(assessmentControls.assessmentId, req.params.assessmentId as string),
          eq(assessmentControls.tenantId, tenantId),
        ))
        .returning();

      if (!control) throw new NotFoundError("Control not found");

      await db.insert(assessmentAuditLog).values({
        assessmentId: req.params.assessmentId as string,
        tenantId,
        userId: user.id,
        action: "control_updated",
        resourceType: "control",
        resourceId: control.id,
        details: { controlRef: control.controlRef, currentState, riskScore, riskLevel },
      });

      res.json({ control });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/assessments/:assessmentId/controls/:id/guidance", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const [control] = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.id, req.params.id as string),
          eq(assessmentControls.tenantId, tenantId),
        ));

      if (!control) throw new NotFoundError("Control not found");

      try {
        const { runAssessmentGuidance } = await import("../agents/assessment-guidance");
        const guidance = await runAssessmentGuidance(
          tenantId, user.id,
          control.controlRef,
          control.controlName,
          control.currentState,
          control.findingDetail || "",
        );
        return res.json({ guidance });
      } catch {
        return res.json({
          guidance: {
            guidance: `Review your organization's implementation of ${control.controlName} (${control.controlRef}). Ensure documentation exists for current controls, identify any gaps between current state and HIPAA requirements, and document evidence of compliance.`,
            recommendations: [
              "Document current policies and procedures related to this control",
              "Identify gaps between current implementation and HIPAA requirements",
              "Create an action plan to address identified gaps",
              "Collect evidence of compliance (policies, screenshots, audit logs)",
            ],
          },
        });
      }
    } catch (err) {
      next(err);
    }
  });
}
