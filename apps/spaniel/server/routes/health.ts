/**
 * GET /api/v1/health — Service health check
 *
 * Returns service status, OpenRouter connectivity, and DB availability.
 */

import type { Express, Request, Response } from "express";
import { hasAICapability, hasDbCapability } from "@cavaridge/spaniel";
import { logger } from "../logger.js";

export function registerHealthRoutes(app: Express): void {
  // Public health check (no auth required — excluded in auth middleware)
  app.get("/api/v1/health", async (_req: Request, res: Response) => {
    const aiReady = hasAICapability();
    const dbReady = hasDbCapability();

    const status = aiReady ? "healthy" : "degraded";

    const health = {
      status,
      service: "spaniel",
      version: "1.0.0",
      capabilities: {
        openrouter: aiReady,
        database: dbReady,
        consensus: aiReady, // consensus requires OpenRouter
        logging: dbReady ? "database" : "stdout",
      },
      timestamp: new Date().toISOString(),
    };

    const httpStatus = status === "healthy" ? 200 : 503;

    if (!aiReady) {
      logger.warn("Health check: OPENROUTER_API_KEY not configured");
    }

    return res.status(httpStatus).json(health);
  });

  // Simple liveness probe for Railway/k8s
  app.get("/healthz", (_req: Request, res: Response) => {
    return res.status(200).json({ ok: true });
  });
}
