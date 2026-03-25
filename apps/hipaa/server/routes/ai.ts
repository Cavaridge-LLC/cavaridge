import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  assessmentControls, riskAssessments, assessmentAuditLog,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "../utils/errors";

export function registerAiRoutes(app: Express, auth: any[]) {
  // POST /api/v1/assessments/:id/ai/recommendations — AI-powered remediation recommendations
  app.post("/api/v1/assessments/:id/ai/recommendations", ...auth, async (req: Request, res: Response, next: NextFunction) => {
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

      const nonCompliant = controls.filter(c => c.currentState !== "implemented");

      // Try AI-powered recommendations
      try {
        const recommendations: Array<{
          controlRef: string;
          controlName: string;
          recommendation: string;
        }> = [];

        // Get top 5 highest-risk items for AI recommendations
        const topRisks = nonCompliant
          .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
          .slice(0, 5);

        for (const control of topRisks) {
          const { runRemediationRecommender } = await import("../agents/remediation-recommender");
          const result = await runRemediationRecommender(
            tenantId,
            user.id,
            control.controlRef,
            control.controlName,
            control.currentState,
            control.findingDetail || "",
            control.riskScore || 0,
          );

          recommendations.push({
            controlRef: control.controlRef,
            controlName: control.controlName,
            recommendation: typeof result === "string" ? result : JSON.stringify(result),
          });
        }

        await db.insert(assessmentAuditLog).values({
          assessmentId: assessment.id,
          tenantId,
          userId: user.id,
          action: "ai_recommendations_generated",
          resourceType: "assessment",
          resourceId: assessment.id,
          details: { count: recommendations.length, aiPowered: true },
        });

        return res.json({ recommendations, aiPowered: true });
      } catch {
        // Fallback: return static recommendations based on control state
        const staticRecommendations = nonCompliant
          .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
          .slice(0, 10)
          .map(c => ({
            controlRef: c.controlRef,
            controlName: c.controlName,
            recommendation: c.currentState === "not_implemented"
              ? `Prioritize implementing ${c.controlName} (${c.controlRef}). This control is required by the HIPAA Security Rule and has a risk score of ${c.riskScore || "unscored"}. Begin by documenting the current gap, then create a project plan with milestones for implementation.`
              : `Complete the partial implementation of ${c.controlName} (${c.controlRef}). Review existing controls and identify remaining gaps. Risk score: ${c.riskScore || "unscored"}.`,
          }));

        await db.insert(assessmentAuditLog).values({
          assessmentId: assessment.id,
          tenantId,
          userId: user.id,
          action: "ai_recommendations_generated",
          resourceType: "assessment",
          resourceId: assessment.id,
          details: { count: staticRecommendations.length, aiPowered: false, fallback: true },
        });

        return res.json({ recommendations: staticRecommendations, aiPowered: false });
      }
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/assessments/:id/ai/policy-language — Generate policy language for a control
  app.post("/api/v1/assessments/:id/ai/policy-language", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { controlRef } = req.body;

      if (!controlRef) {
        return res.status(400).json({ error: "controlRef is required" });
      }

      const [control] = await db.select().from(assessmentControls)
        .where(and(
          eq(assessmentControls.controlRef, controlRef),
          eq(assessmentControls.assessmentId, req.params.id as string),
          eq(assessmentControls.tenantId, tenantId),
        ));

      if (!control) throw new NotFoundError("Control not found");

      // Try AI-powered policy language generation
      try {
        const { runAssessmentGuidance } = await import("../agents/assessment-guidance");
        const result = await runAssessmentGuidance(
          tenantId,
          user.id,
          control.controlRef,
          control.controlName,
          control.currentState,
          control.findingDetail || "",
        );

        return res.json({ policy: result, aiPowered: true });
      } catch {
        // Fallback
        return res.json({
          policy: {
            guidance: `Policy for ${control.controlName} (${control.controlRef}): Organizations must implement and maintain documentation for this HIPAA Security Rule safeguard. The policy should define scope, responsibilities, procedures, and review schedules.`,
            recommendations: [
              "Define the scope and applicability of this control",
              "Assign responsibility to a specific role or department",
              "Document procedures for implementation and maintenance",
              "Establish a review and update schedule (at least annually)",
              "Create mechanisms for monitoring and measuring compliance",
            ],
          },
          aiPowered: false,
        });
      }
    } catch (err) {
      next(err);
    }
  });
}
