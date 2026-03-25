/**
 * CVG-ASTRA Route Registration
 *
 * Mounts all v1 API routes and the legacy routes from the existing app.
 */

import type { Express } from "express";
import { tenantConnectionsRouter } from "./tenant-connections.js";
import { auditsRouter } from "./audits.js";
import { recommendationsRouter } from "./recommendations.js";
import { optimizationPlansRouter } from "./optimization-plans.js";
import { dashboardRouter } from "./dashboard.js";
import { reportsRouter } from "./reports.js";

export function registerV1Routes(app: Express): void {
  app.use("/api/v1/tenant-connections", tenantConnectionsRouter);
  app.use("/api/v1/audits", auditsRouter);
  app.use("/api/v1/recommendations", recommendationsRouter);
  app.use("/api/v1/optimization-plans", optimizationPlansRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/reports", reportsRouter);
}
