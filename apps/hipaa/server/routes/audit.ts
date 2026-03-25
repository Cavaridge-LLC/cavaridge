import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { assessmentAuditLog } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export function registerAuditRoutes(app: Express, auth: any[]) {
  const auditHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const { limit = "50", offset = "0" } = req.query;

      const entries = await db.select().from(assessmentAuditLog)
        .where(and(
          eq(assessmentAuditLog.assessmentId, req.params.assessmentId as string),
          eq(assessmentAuditLog.tenantId, tenantId),
        ))
        .orderBy(desc(assessmentAuditLog.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json({ entries });
    } catch (err) {
      next(err);
    }
  };

  app.get("/api/v1/assessments/:assessmentId/audit-log", ...auth, auditHandler);
  app.get("/api/assessments/:assessmentId/audit-log", ...auth, auditHandler);
}
