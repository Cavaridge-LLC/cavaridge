/**
 * Dashboard API — /api/v1/dashboard
 *
 * MSP portfolio view: all clients, Adjusted Scores,
 * roadmap progress, upcoming QBR dates.
 */

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../services/auth";
import * as storage from "../../storage";
import { buildClientSummary, buildPortfolioOverview } from "../../modules/dashboard";
import type { ClientDashboardSummary } from "@shared/types/dashboard";

const router = Router();

function getOrgId(req: AuthenticatedRequest): string {
  return req.tenantId ?? req.user!.tenantId ?? req.user!.id;
}

// ── Portfolio Overview ──────────────────────────────────────────────

router.get("/portfolio", requireAuth, async (req: AuthenticatedRequest, res) => {
  const orgId = getOrgId(req);
  const clients = await storage.getClients(orgId);

  const summaries: ClientDashboardSummary[] = [];

  for (const client of clients) {
    const [latestScore, scoreHistory, projectRecords, qbrRecords, snapshot] = await Promise.all([
      storage.getLatestScore(orgId, client.id),
      storage.getScoreHistory(orgId, client.id, 12),
      storage.getProjects(orgId, undefined, client.id),
      storage.getQbrReports(orgId, client.id),
      storage.getSnapshot(orgId, client.id),
    ]);

    summaries.push(
      buildClientSummary(
        client,
        latestScore ?? null,
        scoreHistory,
        projectRecords,
        qbrRecords,
        snapshot ? {
          riskLevel: snapshot.riskLevel,
          budgetTotal: snapshot.budgetTotal,
          adoptionPercent: snapshot.adoptionPercent,
        } : null,
      ),
    );
  }

  const overview = buildPortfolioOverview(orgId, summaries);
  res.json(overview);
});

// ── Client Detail ───────────────────────────────────────────────────

router.get("/clients/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const orgId = getOrgId(req);
  const clientId = Array.isArray(req.params.clientId) ? req.params.clientId[0] : (req.params.clientId ?? "");

  const client = await storage.getClient(orgId, clientId);
  if (!client) return res.status(404).json({ message: "Client not found" });

  const [latestScore, scoreHistory, projectRecords, qbrRecords, snapshot] = await Promise.all([
    storage.getLatestScore(orgId, clientId),
    storage.getScoreHistory(orgId, clientId, 12),
    storage.getProjects(orgId, undefined, clientId),
    storage.getQbrReports(orgId, clientId),
    storage.getSnapshot(orgId, clientId),
  ]);

  const summary = buildClientSummary(
    client,
    latestScore ?? null,
    scoreHistory,
    projectRecords,
    qbrRecords,
    snapshot ? {
      riskLevel: snapshot.riskLevel,
      budgetTotal: snapshot.budgetTotal,
      adoptionPercent: snapshot.adoptionPercent,
    } : null,
  );

  res.json(summary);
});

export { router as dashboardRouter };
