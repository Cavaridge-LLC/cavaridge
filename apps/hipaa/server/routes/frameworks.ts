import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { complianceFrameworks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../utils/errors";

export function registerFrameworkRoutes(app: Express, auth: any[]) {
  // v1 routes
  app.get("/api/v1/frameworks", ...auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const frameworks = await db.select({
        id: complianceFrameworks.id,
        frameworkId: complianceFrameworks.frameworkId,
        name: complianceFrameworks.name,
        version: complianceFrameworks.version,
        description: complianceFrameworks.description,
      }).from(complianceFrameworks);

      res.json({ frameworks });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/v1/frameworks/:frameworkId/controls", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [framework] = await db.select().from(complianceFrameworks)
        .where(eq(complianceFrameworks.frameworkId, req.params.frameworkId as string));

      if (!framework) throw new NotFoundError("Framework not found");

      res.json({ framework: { id: framework.id, frameworkId: framework.frameworkId, name: framework.name, version: framework.version }, controls: framework.controls });
    } catch (err) {
      next(err);
    }
  });

  // Backward-compatible
  app.get("/api/frameworks", ...auth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const frameworks = await db.select({
        id: complianceFrameworks.id,
        frameworkId: complianceFrameworks.frameworkId,
        name: complianceFrameworks.name,
        version: complianceFrameworks.version,
        description: complianceFrameworks.description,
      }).from(complianceFrameworks);

      res.json({ frameworks });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/frameworks/:frameworkId/controls", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [framework] = await db.select().from(complianceFrameworks)
        .where(eq(complianceFrameworks.frameworkId, req.params.frameworkId as string));

      if (!framework) throw new NotFoundError("Framework not found");

      res.json({ framework: { id: framework.id, frameworkId: framework.frameworkId, name: framework.name, version: framework.version }, controls: framework.controls });
    } catch (err) {
      next(err);
    }
  });
}
