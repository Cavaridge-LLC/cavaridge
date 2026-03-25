import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  remediationItems, insertRemediationItemSchema, assessmentAuditLog,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ValidationError, NotFoundError, ForbiddenError } from "../utils/errors";
import { ROLES, hasMinimumRole } from "@cavaridge/auth";

export function registerRemediationRoutes(app: Express, auth: any[]) {
  // ── v1 routes ──

  // List remediation items for an assessment
  app.get("/api/v1/assessments/:assessmentId/remediation", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const items = await db.select().from(remediationItems)
        .where(and(
          eq(remediationItems.assessmentId, req.params.assessmentId as string),
          eq(remediationItems.tenantId, tenantId),
        ))
        .orderBy(desc(remediationItems.priority));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // Create remediation item
  app.post("/api/v1/assessments/:assessmentId/remediation", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const parsed = insertRemediationItemSchema.safeParse({
        ...req.body,
        assessmentId: req.params.assessmentId as string,
        tenantId,
      });

      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
      }

      const [item] = await db.insert(remediationItems).values(parsed.data).returning();

      await db.insert(assessmentAuditLog).values({
        assessmentId: req.params.assessmentId as string,
        tenantId,
        userId: user.id,
        action: "remediation_created",
        resourceType: "remediation",
        resourceId: item.id,
        details: { title: item.title, priority: item.priority },
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  // Update remediation item status lifecycle: Identified → In Progress → Remediated → Verified
  app.patch("/api/v1/remediation/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { status, assignedTo, dueDate, notes, priority } = req.body;

      const [item] = await db.update(remediationItems)
        .set({
          ...(status && { status }),
          ...(assignedTo !== undefined && { assignedTo }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(notes !== undefined && { notes }),
          ...(priority !== undefined && { priority }),
          ...(status === "completed" && { completedAt: sql`CURRENT_TIMESTAMP` }),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(eq(remediationItems.id, req.params.id as string), eq(remediationItems.tenantId, tenantId)))
        .returning();

      if (!item) throw new NotFoundError("Remediation item not found");

      await db.insert(assessmentAuditLog).values({
        assessmentId: item.assessmentId,
        tenantId,
        userId: user.id,
        action: "remediation_updated",
        resourceType: "remediation",
        resourceId: item.id,
        details: { status, assignedTo },
      });

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  // Verify remediation (MSP Admin+ only)
  app.post("/api/v1/remediation/:id/verify", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const userRole = user?.role || ROLES.CLIENT_VIEWER;

      if (!hasMinimumRole(userRole, ROLES.MSP_ADMIN)) {
        throw new ForbiddenError("Only MSP Admins or higher can verify remediation items.");
      }

      const [item] = await db.update(remediationItems)
        .set({
          status: "verified",
          verifiedBy: user.id,
          verifiedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(
          eq(remediationItems.id, req.params.id as string),
          eq(remediationItems.tenantId, tenantId),
          eq(remediationItems.status, "completed"),
        ))
        .returning();

      if (!item) throw new NotFoundError("Item not found or not in completed status");

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  // Remediation dashboard stats
  app.get("/api/v1/remediation/dashboard", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const items = await db.select().from(remediationItems)
        .where(eq(remediationItems.tenantId, tenantId));

      const now = new Date();
      const stats = {
        total: items.length,
        open: items.filter(i => i.status === "open").length,
        inProgress: items.filter(i => i.status === "in_progress").length,
        completed: items.filter(i => i.status === "completed").length,
        verified: items.filter(i => i.status === "verified").length,
        overdue: items.filter(i => i.dueDate && new Date(i.dueDate) < now && i.status !== "completed" && i.status !== "verified").length,
        byPriority: {
          critical: items.filter(i => i.priority === 5).length,
          high: items.filter(i => i.priority === 4).length,
          medium: items.filter(i => i.priority === 3).length,
          low: items.filter(i => i.priority <= 2).length,
        },
      };

      res.json({ stats });
    } catch (err) {
      next(err);
    }
  });

  // ── Backward-compatible routes (no v1 prefix) ──

  app.get("/api/assessments/:assessmentId/remediation", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const items = await db.select().from(remediationItems)
        .where(and(
          eq(remediationItems.assessmentId, req.params.assessmentId as string),
          eq(remediationItems.tenantId, tenantId),
        ))
        .orderBy(desc(remediationItems.priority));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/assessments/:assessmentId/remediation", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const parsed = insertRemediationItemSchema.safeParse({
        ...req.body,
        assessmentId: req.params.assessmentId as string,
        tenantId,
      });

      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
      }

      const [item] = await db.insert(remediationItems).values(parsed.data).returning();

      await db.insert(assessmentAuditLog).values({
        assessmentId: req.params.assessmentId as string,
        tenantId,
        userId: user.id,
        action: "remediation_created",
        resourceType: "remediation",
        resourceId: item.id,
        details: { title: item.title, priority: item.priority },
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/remediation/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { status, assignedTo, dueDate, notes, priority } = req.body;

      const [item] = await db.update(remediationItems)
        .set({
          ...(status && { status }),
          ...(assignedTo !== undefined && { assignedTo }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(notes !== undefined && { notes }),
          ...(priority !== undefined && { priority }),
          ...(status === "completed" && { completedAt: sql`CURRENT_TIMESTAMP` }),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(eq(remediationItems.id, req.params.id as string), eq(remediationItems.tenantId, tenantId)))
        .returning();

      if (!item) throw new NotFoundError("Remediation item not found");

      await db.insert(assessmentAuditLog).values({
        assessmentId: item.assessmentId,
        tenantId,
        userId: user.id,
        action: "remediation_updated",
        resourceType: "remediation",
        resourceId: item.id,
        details: { status, assignedTo },
      });

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/remediation/:id/verify", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const userRole = user?.role || ROLES.CLIENT_VIEWER;

      if (!hasMinimumRole(userRole, ROLES.MSP_ADMIN)) {
        throw new ForbiddenError("Only MSP Admins or higher can verify remediation items.");
      }

      const [item] = await db.update(remediationItems)
        .set({
          status: "verified",
          verifiedBy: user.id,
          verifiedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(
          eq(remediationItems.id, req.params.id as string),
          eq(remediationItems.tenantId, tenantId),
          eq(remediationItems.status, "completed"),
        ))
        .returning();

      if (!item) throw new NotFoundError("Item not found or not in completed status");

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/remediation/dashboard", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const items = await db.select().from(remediationItems)
        .where(eq(remediationItems.tenantId, tenantId));

      const now = new Date();
      const stats = {
        total: items.length,
        open: items.filter(i => i.status === "open").length,
        inProgress: items.filter(i => i.status === "in_progress").length,
        completed: items.filter(i => i.status === "completed").length,
        verified: items.filter(i => i.status === "verified").length,
        overdue: items.filter(i => i.dueDate && new Date(i.dueDate) < now && i.status !== "completed" && i.status !== "verified").length,
        byPriority: {
          critical: items.filter(i => i.priority === 5).length,
          high: items.filter(i => i.priority === 4).length,
          medium: items.filter(i => i.priority === 3).length,
          low: items.filter(i => i.priority <= 2).length,
        },
      };

      res.json({ stats });
    } catch (err) {
      next(err);
    }
  });
}
