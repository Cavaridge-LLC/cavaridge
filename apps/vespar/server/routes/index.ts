import type { Express } from "express";
import type { Server } from "http";
import { registerProjectRoutes } from "./projects";
import { registerWorkloadRoutes } from "./workloads";
import { registerDependencyRoutes } from "./dependencies";
import { registerRiskRoutes } from "./risks";
import { registerCostRoutes } from "./costs";
import { registerRunbookRoutes } from "./runbooks";
import { registerAnalysisRoutes } from "./analysis";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerProjectRoutes(app);
  registerWorkloadRoutes(app);
  registerDependencyRoutes(app);
  registerRiskRoutes(app);
  registerCostRoutes(app);
  registerRunbookRoutes(app);
  registerAnalysisRoutes(app);

  return httpServer;
}
