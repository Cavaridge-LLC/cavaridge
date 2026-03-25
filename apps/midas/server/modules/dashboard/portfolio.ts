/**
 * Dashboard Portfolio Builder — aggregates client data
 * for the MSP portfolio view.
 */

import type { Client, RoadmapRecord, ProjectRecord, QbrReportRecord, ScoreHistory } from "@shared/schema";
import type { ClientDashboardSummary, PortfolioOverview } from "@shared/types/dashboard";
import type { AdjustedSecurityScoreReport } from "@shared/types/security-scoring";
import { detectTrendDirection } from "../security-scoring/trend";

/**
 * Build a single client dashboard summary.
 */
export function buildClientSummary(
  client: Client,
  latestScore: ScoreHistory | null,
  scoreHistory: ScoreHistory[],
  projectRecords: ProjectRecord[],
  qbrRecords: QbrReportRecord[],
  snapshot: { riskLevel?: string; budgetTotal?: number; adoptionPercent?: number } | null,
): ClientDashboardSummary {
  // Score data
  let adjustedScore: number | null = null;
  let nativeScore: number | null = null;
  let scoreDelta: number | null = null;
  let realGapCount: number | null = null;
  let compensatedCount: number | null = null;
  let adjustedScoreTrend: "improving" | "stable" | "declining" | null = null;
  let lastScoreDate: string | null = null;

  if (latestScore) {
    adjustedScore = Number(latestScore.adjustedScore);
    nativeScore = Number(latestScore.nativeScore);
    scoreDelta = adjustedScore - nativeScore;
    realGapCount = latestScore.realGapCount;
    compensatedCount = latestScore.compensatedCount;
    lastScoreDate = latestScore.generatedAt.toISOString();

    if (scoreHistory.length >= 2) {
      const chronological = [...scoreHistory].reverse();
      const trendPoints = chronological.map((h) => ({
        date: h.generatedAt.toISOString(),
        nativeScore: Number(h.nativeScore),
        adjustedScore: Number(h.adjustedScore),
      }));
      adjustedScoreTrend = detectTrendDirection(trendPoints);
    }
  }

  // Project progress
  const roadmapProjectCount = projectRecords.length;
  const roadmapCompletedCount = projectRecords.filter((p) => p.status === "completed").length;
  const roadmapCompletionPct = roadmapProjectCount > 0
    ? Math.round((roadmapCompletedCount / roadmapProjectCount) * 100)
    : 0;

  // Next QBR
  const upcomingQbrs = qbrRecords
    .filter((q) => q.status === "draft" || q.status === "generated")
    .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  const nextQbr = upcomingQbrs[0];

  return {
    clientId: client.id,
    clientName: client.name,
    industry: client.industry,
    headcount: client.headcount,
    adjustedScore,
    adjustedScoreTrend,
    nativeScore,
    scoreDelta,
    realGapCount,
    compensatedCount,
    roadmapProjectCount,
    roadmapCompletedCount,
    roadmapCompletionPct,
    nextQbrDate: nextQbr?.generatedAt?.toISOString() ?? null,
    nextQbrId: nextQbr?.id ?? null,
    riskLevel: snapshot?.riskLevel ?? null,
    budgetUtilizationPct: snapshot?.adoptionPercent ?? null,
    lastScoreDate,
  };
}

/**
 * Build the full portfolio overview from an array of client summaries.
 */
export function buildPortfolioOverview(
  tenantId: string,
  summaries: ClientDashboardSummary[],
): PortfolioOverview {
  const clientCount = summaries.length;

  const scoredClients = summaries.filter((s) => s.adjustedScore !== null);
  const avgAdjustedScore = scoredClients.length > 0
    ? Math.round(scoredClients.reduce((sum, s) => sum + (s.adjustedScore ?? 0), 0) / scoredClients.length)
    : null;
  const avgNativeScore = scoredClients.length > 0
    ? Math.round(scoredClients.reduce((sum, s) => sum + (s.nativeScore ?? 0), 0) / scoredClients.length)
    : null;

  const totalRoadmapProjects = summaries.reduce((sum, s) => sum + s.roadmapProjectCount, 0);
  const totalCompletedProjects = summaries.reduce((sum, s) => sum + s.roadmapCompletedCount, 0);
  const overallCompletionPct = totalRoadmapProjects > 0
    ? Math.round((totalCompletedProjects / totalRoadmapProjects) * 100)
    : 0;

  const clientsWithUpcomingQbr = summaries.filter((s) => s.nextQbrDate !== null).length;
  const clientsNeedingAttention = summaries.filter(
    (s) => (s.adjustedScore !== null && s.adjustedScore < 50) || s.riskLevel === "Critical" || s.riskLevel === "Elevated",
  ).length;

  return {
    tenantId,
    clientCount,
    avgAdjustedScore,
    avgNativeScore,
    totalRoadmapProjects,
    totalCompletedProjects,
    overallCompletionPct,
    clientsWithUpcomingQbr,
    clientsNeedingAttention,
    clients: summaries,
  };
}
