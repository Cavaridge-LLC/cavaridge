import type { Express } from "express";
import type { Server } from "http";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../services/auth";
import { tenantScope } from "../middleware/tenantScope";
import { loadUserRole } from "../middleware/rbac";
import { registerAuthRoutes } from "./auth";
import { registerAssessmentRoutes } from "./assessments";
import { registerControlRoutes } from "./controls";
import { registerRemediationRoutes } from "./remediation";
import { registerReportRoutes } from "./reports";
import { registerFrameworkRoutes } from "./frameworks";
import { registerDashboardRoutes } from "./dashboard";
import { registerAuditRoutes } from "./audit";

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(server: Server, app: Express) {
  app.use("/api", apiLimiter);

  // Middleware chain for authenticated, tenant-scoped routes
  const auth = [requireAuth as any, tenantScope as any, loadUserRole as any];

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

  return server;
}
