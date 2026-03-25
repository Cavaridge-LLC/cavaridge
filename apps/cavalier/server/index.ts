/**
 * CVG-CAVALIER — Cavalier Partners Channel GTM Platform
 *
 * Express 5 API server providing:
 * - Ticket management with SLA tracking
 * - Connector management (NinjaOne, HaloPSA)
 * - Channel partner management (tiers, status lifecycle)
 * - Deal registration with conflict detection
 * - Commission engine (structures, earned/pending/paid tracking)
 * - Marketing asset library (tier-gated access)
 * - Lead distribution (weighted round-robin)
 * - Performance dashboard & scorecards
 * - AI partner matching via Ducky Intelligence
 * - Partner portal (onboarding, tier management)
 * - Billing (invoices, contracts, time entries)
 *
 * All routes enforce tenant isolation via @cavaridge/auth.
 */
import "./types";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { loadUser, requireAuth, requireMspTech, registerAuthRoutes } from "./services/auth";
import { ticketRouter } from "./routes/tickets";
import { connectorRouter } from "./routes/connectors";
import { partnerRouter } from "./routes/partners";
import { billingRouter } from "./routes/billing";
import { dispatchRouter } from "./routes/dispatch";
import { enrichmentRouter } from "./routes/enrichment";
import { channelPartnerRouter } from "./routes/channel-partners";
import { dealRouter } from "./routes/deals";
import { commissionRouter } from "./routes/commissions";
import { marketingAssetRouter } from "./routes/marketing-assets";
import { leadDistributionRouter } from "./routes/lead-distribution";
import { performanceRouter } from "./routes/performance";
import { aiMatchingRouter } from "./routes/ai-matching";
import { errorHandler } from "./middleware/error-handler";

const app = express();
const httpServer = createServer(app);

app.use(cookieParser());

// Health checks — before auth so Railway probes work without JWT
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "healthy", service: "cavalier", version: "0.2.0" });
});

// Shared auth middleware — loads user profile + tenant from Supabase JWT
app.use(loadUser as any);

// Set userId for backward compat with route handlers
app.use((req, _res, next) => {
  if ((req as any).user) {
    (req as any).userId = (req as any).user.id;
  }
  next();
});

app.use(express.json());

(async () => {
  // Register auth routes (setup-profile, /me, callback, logout)
  registerAuthRoutes(app);

  // Require auth + MSP Tech minimum + tenant context on all /api/v1 routes
  app.use("/api/v1", requireAuth as any, requireMspTech as any, (req, res, next) => {
    if (!req.tenantId) {
      return res.status(403).json({ error: "Tenant context required" });
    }
    next();
  });

  // ─── PSA-lite routes (existing) ───────────────────────────────────────
  app.use("/api/v1/tickets", ticketRouter);
  app.use("/api/v1/connectors", connectorRouter);
  app.use("/api/v1/partners", partnerRouter);
  app.use("/api/v1/billing", billingRouter);
  app.use("/api/v1/dispatch", dispatchRouter);
  app.use("/api/v1/enrichment", enrichmentRouter);

  // ─── Channel Partner GTM routes (new) ─────────────────────────────────
  app.use("/api/v1/channel-partners", channelPartnerRouter);
  app.use("/api/v1/deals", dealRouter);
  app.use("/api/v1/commissions", commissionRouter);
  app.use("/api/v1/marketing-assets", marketingAssetRouter);
  app.use("/api/v1/leads", leadDistributionRouter);
  app.use("/api/v1/performance", performanceRouter);
  app.use("/api/v1/ai", aiMatchingRouter);

  // Error handler
  app.use(errorHandler);

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    console.log(`${new Date().toLocaleTimeString()} [cavalier] serving on port ${port}`);
  });
})();
