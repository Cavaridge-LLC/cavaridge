/**
 * Recommendations API — /api/v1/recommendations
 *
 * AI-powered recommendations via Ducky (app_code=CVG-MIDAS).
 */

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../services/auth";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import * as storage from "../../storage";
import { RecommendationAgent, type RecommendationInput } from "../../agents/recommendation/agent";
import type { AdjustedSecurityScoreReport } from "@shared/types/security-scoring";
import type { AgentContext } from "@cavaridge/agent-core";

const router = Router();

function param(req: AuthenticatedRequest, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function getOrgId(req: AuthenticatedRequest): string {
  return req.tenantId ?? req.user!.tenantId ?? req.user!.id;
}

function agentContext(req: AuthenticatedRequest): AgentContext {
  return {
    tenantId: getOrgId(req),
    userId: req.user!.id,
    config: {
      agentId: "midas-recommendation",
      agentName: "RecommendationEngine",
      appCode: "CVG-MIDAS",
      version: "1.0.0",
    },
    correlationId: crypto.randomUUID(),
  };
}

router.post("/clients/:clientId/generate", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const orgId = getOrgId(req);
  const clientId = param(req, "clientId");

  const client = await storage.getClient(orgId, clientId);
  if (!client) return res.status(404).json({ message: "Client not found" });

  const [latestScore, projectRecords] = await Promise.all([
    storage.getLatestScore(orgId, clientId),
    storage.getProjects(orgId, undefined, clientId),
  ]);

  let adjustedScore: number | null = null;
  let nativeScore: number | null = null;
  let gapCount = 0;
  let compensatedCount = 0;

  if (latestScore) {
    const report = latestScore.reportJson as AdjustedSecurityScoreReport;
    adjustedScore = report.adjustedScore;
    nativeScore = report.nativeScore;
    gapCount = report.realGaps.length;
    compensatedCount = report.compensatedControls.length;
  }

  const completedCount = projectRecords.filter((p) => p.status === "completed").length;

  const input: RecommendationInput = {
    tenantId: orgId,
    clientId,
    clientName: client.name,
    adjustedScore,
    nativeScore,
    gapCount,
    compensatedCount,
    licenseUtilizationPct: req.body.licenseUtilizationPct ?? null,
    wastedLicenseCount: req.body.wastedLicenseCount ?? null,
    mfaEnabledPct: req.body.mfaEnabledPct ?? null,
    deviceCompliancePct: req.body.deviceCompliancePct ?? null,
    roadmapCompletionPct: projectRecords.length > 0
      ? Math.round((completedCount / projectRecords.length) * 100)
      : 0,
    projectCount: projectRecords.length,
    completedProjectCount: completedCount,
  };

  const agent = new RecommendationAgent();
  const ctx = agentContext(req);

  const output = await agent.runWithAudit({
    data: input,
    context: ctx,
  });

  res.json(output.result);
});

export { router as recommendationRouter };
