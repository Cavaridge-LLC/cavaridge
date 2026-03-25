import type { Express } from "express";
import type { Server } from "http";
import { registerProjectRoutes } from "./projects";
import { registerWorkloadRoutes } from "./workloads";
import { registerDependencyRoutes } from "./dependencies";
import { registerRiskRoutes } from "./risks";
import { registerCostRoutes } from "./costs";
import { registerRunbookRoutes } from "./runbooks";
import { registerAnalysisRoutes } from "./analysis";
import { v1Router } from "./v1/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Legacy routes (backward compat)
  registerProjectRoutes(app);
  registerWorkloadRoutes(app);
  registerDependencyRoutes(app);
  registerRiskRoutes(app);
  registerCostRoutes(app);
  registerRunbookRoutes(app);
  registerAnalysisRoutes(app);

  // v1 API routes
  app.use("/api/v1", v1Router);

  return httpServer;
}
