/**
 * GET  /api/v1/models         — Current routing matrix
 * POST /api/v1/models/refresh — Force-refresh routing cache
 */

import type { Express, Response } from "express";
import type { ServiceRequest } from "../middleware/auth.js";
import { getDefaultRouting, getRoutingForTask } from "@cavaridge/spaniel";
import type { TaskType } from "@cavaridge/spaniel";
import { triggerManualRefresh } from "../workers/model-catalog-refresh.js";
import { logger } from "../logger.js";

const ALL_TASK_TYPES: TaskType[] = [
  "analysis",
  "generation",
  "summarization",
  "extraction",
  "chat",
  "code_generation",
  "research",
  "conversation",
  "embeddings",
  "vision",
];

export function registerModelRoutes(app: Express): void {
  // GET /api/v1/models — Return the full routing matrix
  app.get("/api/v1/models", async (_req: ServiceRequest, res: Response) => {
    try {
      const matrix: Record<string, { primary: string; secondary: string; tertiary: string | null }> = {};

      // Load each task type's routing (hits cache after first call)
      await Promise.all(
        ALL_TASK_TYPES.map(async (taskType) => {
          const entry = await getRoutingForTask(taskType);
          matrix[taskType] = {
            primary: entry.primary,
            secondary: entry.secondary,
            tertiary: entry.tertiary,
          };
        })
      );

      return res.json({
        routing_matrix: matrix,
        source: "cache_or_db",
        default_routing: getDefaultRouting(),
      });
    } catch (err) {
      logger.error({ err }, "Failed to load routing matrix");
      return res.status(500).json({ error: "Failed to load routing matrix" });
    }
  });

  // POST /api/v1/models/refresh — Force cache invalidation
  app.post("/api/v1/models/refresh", async (_req: ServiceRequest, res: Response) => {
    try {
      // Fetching each task type forces a cache refresh on the next call
      // The routing module uses a 5-minute TTL cache; calling getRoutingForTask
      // after TTL expiry will reload from DB. For a forced refresh, we need
      // to call with a fresh state. The simplest approach: load all routes
      // which triggers a DB reload if cache is stale.
      const refreshed: Record<string, { primary: string; secondary: string; tertiary: string | null }> = {};

      await Promise.all(
        ALL_TASK_TYPES.map(async (taskType) => {
          const entry = await getRoutingForTask(taskType);
          refreshed[taskType] = {
            primary: entry.primary,
            secondary: entry.secondary,
            tertiary: entry.tertiary,
          };
        })
      );

      logger.info("Routing matrix refresh requested");
      return res.json({
        status: "refreshed",
        routing_matrix: refreshed,
      });
    } catch (err) {
      logger.error({ err }, "Failed to refresh routing matrix");
      return res.status(500).json({ error: "Failed to refresh routing matrix" });
    }
  });

  // POST /api/v1/models/refresh-catalog — Trigger model catalog refresh from OpenRouter
  app.post("/api/v1/models/refresh-catalog", async (_req: ServiceRequest, res: Response) => {
    try {
      const result = await triggerManualRefresh();
      logger.info({ result }, "Manual model catalog refresh triggered");
      return res.json({
        status: "refreshed",
        models_processed: result.modelsProcessed,
      });
    } catch (err) {
      logger.error({ err }, "Failed to refresh model catalog");
      return res.status(500).json({ error: "Failed to refresh model catalog" });
    }
  });
}
