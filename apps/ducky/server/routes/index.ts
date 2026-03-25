import type { Express } from "express";
import { type Server } from "http";
import { registerAuthRoutes } from "./auth";
import { registerSystemRoutes } from "./system";
import { registerQuestionRoutes } from "./questions";
import { registerKnowledgeRoutes } from "./knowledge";
import { registerAdminRoutes } from "./admin";
import { registerAgentRoutes } from "./agent";
import { registerBuildRoutes } from "./build";
import { registerV1Routes } from "./v1";

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

  // V1 versioned API — conversation engine, one-shot query, app integration, templates
  registerV1Routes(app);

  return httpServer;
}
