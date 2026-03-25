/**
 * Dashboard API — /api/v1/dashboard
 *
 * MSP portfolio-level views: all tenants, total spend, savings, optimization status.
 */

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../services/auth/index.js";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import {
  getPortfolioSummary,
  getAuditHistory,
  getSavingsTrend,
} from "../services/dashboard.js";

const router = Router();

// Portfolio summary — all tenant connections, total spend, savings
router.get("/portfolio",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    try {
      const summary = await getPortfolioSummary(req.tenantId!);
      res.json(summary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Failed to load portfolio: ${message}` });
    }
  },
);

// Audit history for a connection
router.get("/audit-history/:connectionId",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    try {
      const history = await getAuditHistory(
        req.tenantId!,
        Number(req.params.connectionId),
        limit,
      );
      res.json({ history });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Failed to load audit history: ${message}` });
    }
  },
);

// Savings trend data for charting
router.get("/savings-trend",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const connectionId = req.query.connectionId
      ? Number(req.query.connectionId)
      : undefined;
    try {
      const trend = await getSavingsTrend(req.tenantId!, connectionId);
      res.json({ trend });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Failed to load savings trend: ${message}` });
    }
  },
);

export { router as dashboardRouter };
