import type { Express } from "express";
import { registerReasonRoutes } from "./reason.js";
import { registerChatRoutes } from "./chat.js";
import { registerModelRoutes } from "./models.js";
import { registerHealthRoutes } from "./health.js";
import { registerUsageRoutes } from "./usage.js";

export function registerRoutes(app: Express): void {
  registerHealthRoutes(app);
  registerChatRoutes(app);
  registerReasonRoutes(app);
  registerModelRoutes(app);
  registerUsageRoutes(app);
}
