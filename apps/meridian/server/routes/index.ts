import type { Express } from "express";
import { type Server } from "http";
import { registerObjectStorageRoutes } from "../replit_integrations/object_storage";
import { registerAuthRoutes } from "./auth";
import { registerOrgRoutes } from "./org";
import { registerSystemRoutes } from "./system";
import { registerDealRoutes } from "./deals";
import { registerDocumentRoutes } from "./documents";
import { registerReportRoutes } from "./reports";
import { registerInfraRoutes } from "./infra";
import { registerPortfolioRoutes } from "./portfolio";
import { registerDealAccessRoutes } from "./deal-access";
import { registerPlatformRoutes } from "./platform";
import { registerQaRoutes } from "./qa";

export { recalculateDealScores } from "./_helpers";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerObjectStorageRoutes(app);
  registerSystemRoutes(app);
  registerAuthRoutes(app);
  registerOrgRoutes(app);
  registerDealRoutes(app);
  registerDocumentRoutes(app);
  registerReportRoutes(app);
  registerInfraRoutes(app);
  registerPortfolioRoutes(app);
  registerDealAccessRoutes(app);
  registerPlatformRoutes(app);
  registerQaRoutes(app);

  return httpServer;
}
