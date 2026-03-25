/**
 * V1 API Routes — Registration entry point.
 *
 * All v1 endpoints are under /api/v1/
 */

import type { Express } from "express";
import { registerV1ConversationRoutes } from "./conversations.js";
import { registerV1QueryRoutes } from "./query.js";
import { registerV1AppQueryRoutes } from "./app-query.js";
import { registerV1TemplateRoutes } from "./templates.js";

export function registerV1Routes(app: Express): void {
  registerV1ConversationRoutes(app);
  registerV1QueryRoutes(app);
  registerV1AppQueryRoutes(app);
  registerV1TemplateRoutes(app);
}
