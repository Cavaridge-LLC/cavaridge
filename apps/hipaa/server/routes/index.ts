import type { Express } from "express";
import type { Server } from "http";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "@cavaridge/auth/server";
import { registerAuthRoutes } from "./auth";
import { registerAssessmentRoutes } from "./assessments";
import { registerControlRoutes } from "./controls";
import { registerRemediationRoutes } from "./remediation";
import { registerReportRoutes } from "./reports";
import { registerFrameworkRoutes } from "./frameworks";
import { registerDashboardRoutes } from "./dashboard";
import { registerAuditRoutes } from "./audit";
import { registerGapAnalysisRoutes } from "./gap-analysis";
import { registerTimelineRoutes } from "./timeline";
import { registerAiRoutes } from "./ai";

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(server: Server, app: Express) {
  app.use("/api", apiLimiter);

  // requireAuth is the only middleware needed — createAuthMiddleware (global)
  // already loads profile + tenant. No separate tenantScope or loadUserRole.
  const auth = [requireAuth as any];

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "hipaa", version: "1.0.0" });
  });

  // Register route modules
  registerAuthRoutes(app);
  registerAssessmentRoutes(app, auth);
  registerControlRoutes(app, auth);
  registerRemediationRoutes(app, auth);
  registerReportRoutes(app, auth);
  registerFrameworkRoutes(app, auth);
  registerDashboardRoutes(app, auth);
  registerAuditRoutes(app, auth);
  registerGapAnalysisRoutes(app, auth);
  registerTimelineRoutes(app, auth);
  registerAiRoutes(app, auth);

  return server;
}
