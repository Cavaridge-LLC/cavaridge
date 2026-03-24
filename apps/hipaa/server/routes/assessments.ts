import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  riskAssessments, assessmentControls, complianceFrameworks,
  insertRiskAssessmentSchema, computeRiskLevel, assessmentAuditLog,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { ValidationError, NotFoundError, ForbiddenError } from "../utils/errors";
import { ROLES, hasMinimumRole } from "@cavaridge/auth";
import { flattenControls } from "../data/hipaa-security-controls";

export function registerAssessmentRoutes(app: Express, auth: any[]) {
  // List assessments for tenant
  app.get("/api/assessments", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const { status, framework, limit = "50", offset = "0" } = req.query;

      let query = db.select().from(riskAssessments)
        .where(eq(riskAssessments.tenantId, tenantId))
        .orderBy(desc(riskAssessments.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      if (status) {
        query = db.select().from(riskAssessments)
          .where(and(eq(riskAssessments.tenantId, tenantId), eq(riskAssessments.status, status as any)))
          .orderBy(desc(riskAssessments.createdAt))
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string));
      }

      const assessments = await query;
      res.json({ assessments });
    } catch (err) {
      next(err);
    }
  });

  // Create new assessment
  app.post("/api/assessments", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const parsed = insertRiskAssessmentSchema.safeParse({
        ...req.body,
        tenantId,
        createdBy: user.id,
      });

      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
      }

      const [assessment] = await db.insert(riskAssessments).values(parsed.data).returning();

      // Auto-populate controls from framework library
      const [framework] = await db.select().from(complianceFrameworks)
        .where(eq(complianceFrameworks.frameworkId,
          assessment.framework === "hipaa_security" ? "hipaa_security_rule" : assessment.framework));

      if (framework) {
        const controls = flattenControls();
        const controlRows = controls.map(c => ({
          assessmentId: assessment.id,
          controlRef: c.ref,
          controlName: c.name,
          category: c.category as any,
          safeguardType: c.parentRef ? "implementation_specification" : "standard",
          tenantId,
        }));

        if (controlRows.length > 0) {
          await db.insert(assessmentControls).values(controlRows);
        }
      }

      // Audit log
      await db.insert(assessmentAuditLog).values({
        assessmentId: assessment.id,
        tenantId,
        userId: user.id,
        action: "assessment_created",
        resourceType: "assessment",
        resourceId: assessment.id,
        details: { title: assessment.title, framework: assessment.framework },
      });

      res.status(201).json({ assessment });
    } catch (err) {
      next(err);
    }
  });

  // Get assessment detail
  app.get("/api/assessments/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const [assessment] = await db.select().from(riskAssessments)
        .where(and(eq(riskAssessments.id, req.params.id as string), eq(riskAssessments.tenantId, tenantId)));

      if (!assessment) throw new NotFoundError("Assessment not found");

      const controls = await db.select().from(assessmentControls)
        .where(eq(assessmentControls.assessmentId, assessment.id));

      res.json({ assessment, controls });
    } catch (err) {
      next(err);
    }
  });

  // Update assessment
  app.patch("/api/assessments/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { title, status, assignedTo, metadata } = req.body;

      const [assessment] = await db.update(riskAssessments)
        .set({
          ...(title && { title }),
          ...(status && { status }),
          ...(assignedTo !== undefined && { assignedTo }),
          ...(metadata && { metadata }),
          updatedAt: sql`CURRENT_TIMESTAMP`,
          ...(status === "completed" && { completedAt: sql`CURRENT_TIMESTAMP` }),
        })
        .where(and(eq(riskAssessments.id, req.params.id as string), eq(riskAssessments.tenantId, tenantId)))
        .returning();

      if (!assessment) throw new NotFoundError("Assessment not found");

      await db.insert(assessmentAuditLog).values({
        assessmentId: assessment.id,
        tenantId,
        userId: user.id,
        action: "assessment_updated",
        resourceType: "assessment",
        resourceId: assessment.id,
        details: { changes: req.body },
      });

      res.json({ assessment });
    } catch (err) {
      next(err);
    }
  });

  // Approve assessment (compliance_officer+ only)
  app.post("/api/assessments/:id/approve", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const userRole = user?.role || ROLES.CLIENT_VIEWER;

      // MSP Admin+ or Client Admin can approve assessments
      if (!hasMinimumRole(userRole, ROLES.CLIENT_ADMIN)) {
        throw new ForbiddenError("Only Client Admins or higher can approve assessments.");
      }

      const [assessment] = await db.update(riskAssessments)
        .set({
          status: "approved",
          approvedBy: user.id,
          approvedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(
          eq(riskAssessments.id, req.params.id as string),
          eq(riskAssessments.tenantId, tenantId),
          eq(riskAssessments.status, "completed"),
        ))
        .returning();

      if (!assessment) throw new NotFoundError("Assessment not found or not in completed status");

      await db.insert(assessmentAuditLog).values({
        assessmentId: assessment.id,
        tenantId,
        userId: user.id,
        action: "assessment_approved",
        resourceType: "assessment",
        resourceId: assessment.id,
      });

      res.json({ assessment });
    } catch (err) {
      next(err);
    }
  });
}
