import type { Express } from "express";
import { type Server } from "http";
import { registerAuthRoutes } from "./auth";
import { registerSystemRoutes } from "./system";
import { registerQuestionRoutes } from "./questions";
import { registerKnowledgeRoutes } from "./knowledge";
import { registerAdminRoutes } from "./admin";
import { registerAgentRoutes } from "./agent";
import { registerBuildRoutes } from "./build";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerSystemRoutes(app);
  registerAuthRoutes(app);
  registerQuestionRoutes(app);
  registerKnowledgeRoutes(app);
  registerAdminRoutes(app);
  registerAgentRoutes(app);
  registerBuildRoutes(app);

  return httpServer;
}
