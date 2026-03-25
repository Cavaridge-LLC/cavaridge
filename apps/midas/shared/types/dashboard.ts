/**
 * Dashboard Types — CVG-MIDAS
 *
 * MSP portfolio view: all clients, Adjusted Scores,
 * roadmap progress, upcoming QBR dates.
 */

// ── Client Summary (portfolio card) ─────────────────────────────────

export interface ClientDashboardSummary {
  clientId: string;
  clientName: string;
  industry: string | null;
  headcount: number | null;
  adjustedScore: number | null;
  adjustedScoreTrend: "improving" | "stable" | "declining" | null;
  nativeScore: number | null;
  scoreDelta: number | null;
  realGapCount: number | null;
  compensatedCount: number | null;
  roadmapProjectCount: number;
  roadmapCompletedCount: number;
  roadmapCompletionPct: number;
  nextQbrDate: string | null;
  nextQbrId: string | null;
  riskLevel: string | null;
  budgetUtilizationPct: number | null;
  lastScoreDate: string | null;
}

// ── Portfolio Overview ──────────────────────────────────────────────

export interface PortfolioOverview {
  tenantId: string;
  clientCount: number;
  avgAdjustedScore: number | null;
  avgNativeScore: number | null;
  totalRoadmapProjects: number;
  totalCompletedProjects: number;
  overallCompletionPct: number;
  clientsWithUpcomingQbr: number;
  clientsNeedingAttention: number;
  clients: ClientDashboardSummary[];
}

// ── Score Distribution ──────────────────────────────────────────────

export interface ScoreDistribution {
  range: string;
  count: number;
  clientIds: string[];
}

// ── Dashboard Filters ───────────────────────────────────────────────

export interface DashboardFilters {
  industry?: string;
  riskLevel?: string;
  scoreMin?: number;
  scoreMax?: number;
  hasUpcomingQbr?: boolean;
}
