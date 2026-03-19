/**
 * Adjusted Score Calculator — deterministic scoring engine.
 *
 * Formula: (Native Implemented + Fully Compensated + Partial * 0.5) / Max Possible * 100
 *
 * No LLM calls — pure math. Produces the full AdjustedSecurityScoreReport.
 */

import type {
  NativeControl,
  MatchResult,
  AdjustedSecurityScoreReport,
  CategoryScore,
  ScoredControl,
  RealGap,
  CompensatedDetail,
  SecurityCategory,
} from "@shared/types/security-scoring";
import * as storage from "../../storage";
import { getScoreTrend } from "./trend";

// ── Score Calculation ────────────────────────────────────────────────

export interface ScoreCalculationResult {
  nativeScore: number;
  nativeMaxScore: number;
  adjustedScore: number;
  adjustedMaxScore: number;
  scoreDelta: number;
  categories: CategoryScore[];
  controls: ScoredControl[];
  realGaps: RealGap[];
  compensatedControls: CompensatedDetail[];
}

export function calculateAdjustedScore(
  nativeControls: NativeControl[],
  matchResults: MatchResult[],
): ScoreCalculationResult {
  const matchMap = new Map(matchResults.map((m) => [m.controlId, m]));

  let totalNativeScore = 0;
  let totalNativeMax = 0;
  let totalAdjustedScore = 0;
  let totalAdjustedMax = 0;

  const categoryMap = new Map<SecurityCategory, {
    nativeScore: number;
    adjustedScore: number;
    maxScore: number;
    gapCount: number;
    compensatedCount: number;
  }>();

  const controls: ScoredControl[] = [];
  const realGaps: RealGap[] = [];
  const compensatedControls: CompensatedDetail[] = [];

  for (const control of nativeControls) {
    const match = matchMap.get(control.controlId);
    if (!match) continue;

    if (match.status === "not_applicable") continue;

    // Accumulate native scores
    totalNativeScore += control.currentScore;
    totalNativeMax += control.maxScore;

    // Accumulate adjusted scores
    totalAdjustedScore += match.awardedScore;
    totalAdjustedMax += control.maxScore;

    // Category rollup
    const cat = categoryMap.get(control.category) ?? {
      nativeScore: 0,
      adjustedScore: 0,
      maxScore: 0,
      gapCount: 0,
      compensatedCount: 0,
    };
    cat.nativeScore += control.currentScore;
    cat.adjustedScore += match.awardedScore;
    cat.maxScore += control.maxScore;
    if (match.status === "real_gap") cat.gapCount++;
    if (match.status === "compensated" || match.status === "partial") cat.compensatedCount++;
    categoryMap.set(control.category, cat);

    // Individual control detail
    controls.push({
      controlId: control.controlId,
      controlName: control.controlName,
      category: control.category,
      vendor: control.vendor,
      maxScore: control.maxScore,
      nativeScore: control.currentScore,
      adjustedScore: match.awardedScore,
      status: match.status,
      compensatingProduct: match.thirdPartyProduct,
      confidence: match.confidence,
    });

    // Collect real gaps
    if (match.status === "real_gap") {
      realGaps.push({
        controlId: control.controlId,
        controlName: control.controlName,
        category: control.category,
        pointsAtStake: control.maxScore,
        vendorRecommendation: control.vendorRecommendation ?? `Implement ${control.controlName}`,
        estimatedEffort: estimateEffort(control.category),
        roadmapPriority: 0, // Ranked after sorting
      });
    }

    // Collect compensated controls
    if ((match.status === "compensated" || match.status === "partial") && match.thirdPartyProduct) {
      compensatedControls.push({
        controlId: control.controlId,
        controlName: control.controlName,
        category: control.category,
        thirdPartyProduct: match.thirdPartyProduct,
        compensationLevel: match.compensationLevel!,
        confidence: match.confidence,
        pointsAwarded: match.awardedScore,
      });
    }
  }

  // Rank gaps by points at stake (descending)
  realGaps.sort((a, b) => b.pointsAtStake - a.pointsAtStake);
  realGaps.forEach((g, idx) => (g.roadmapPriority = idx + 1));

  const nativeScorePercent = totalNativeMax > 0
    ? Math.round((totalNativeScore / totalNativeMax) * 100)
    : 0;
  const adjustedScorePercent = totalAdjustedMax > 0
    ? Math.round((totalAdjustedScore / totalAdjustedMax) * 100)
    : 0;

  const categories: CategoryScore[] = Array.from(categoryMap.entries()).map(
    ([category, data]) => ({
      category,
      nativeScore: data.maxScore > 0 ? Math.round((data.nativeScore / data.maxScore) * 100) : 0,
      adjustedScore: data.maxScore > 0 ? Math.round((data.adjustedScore / data.maxScore) * 100) : 0,
      maxScore: 100,
      gapCount: data.gapCount,
      compensatedCount: data.compensatedCount,
    }),
  );

  return {
    nativeScore: nativeScorePercent,
    nativeMaxScore: 100,
    adjustedScore: adjustedScorePercent,
    adjustedMaxScore: 100,
    scoreDelta: adjustedScorePercent - nativeScorePercent,
    categories,
    controls,
    realGaps,
    compensatedControls,
  };
}

// ── Full Report Generation ───────────────────────────────────────────

export async function generateScoreReport(
  orgId: string,
  clientId: string,
  vendor: "microsoft" | "google",
  nativeControls: NativeControl[],
  matchResults: MatchResult[],
): Promise<AdjustedSecurityScoreReport> {
  const calc = calculateAdjustedScore(nativeControls, matchResults);
  const trend = await getScoreTrend(orgId, clientId);

  const report: AdjustedSecurityScoreReport = {
    tenantId: orgId,
    clientId,
    generatedAt: new Date().toISOString(),
    vendor,
    ...calc,
    trend: trend ?? undefined,
  };

  // Persist to history
  await storage.saveScoreSnapshot({
    tenantId: orgId,
    clientId,
    vendor,
    nativeScore: String(calc.nativeScore),
    nativeMaxScore: String(calc.nativeMaxScore),
    adjustedScore: String(calc.adjustedScore),
    adjustedMaxScore: String(calc.adjustedMaxScore),
    realGapCount: calc.realGaps.length,
    compensatedCount: calc.compensatedControls.length,
    reportJson: report,
  });

  return report;
}

// ── What-If Score Projection ─────────────────────────────────────────

export function calculateWhatIfScore(
  currentReport: AdjustedSecurityScoreReport,
  resolvedGapIds: string[],
): { projectedScore: number; scoreDelta: number } {
  const resolvedSet = new Set(resolvedGapIds);

  let totalAdjusted = 0;
  let totalMax = 0;

  for (const control of currentReport.controls) {
    if (control.status === "not_applicable") continue;
    totalMax += control.maxScore;

    if (resolvedSet.has(control.controlId)) {
      totalAdjusted += control.maxScore; // Assume full implementation
    } else {
      totalAdjusted += control.adjustedScore;
    }
  }

  const projectedScore = totalMax > 0 ? Math.round((totalAdjusted / totalMax) * 100) : 0;
  return {
    projectedScore,
    scoreDelta: projectedScore - currentReport.adjustedScore,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function estimateEffort(category: SecurityCategory): "low" | "medium" | "high" {
  const effortMap: Record<SecurityCategory, "low" | "medium" | "high"> = {
    identity_mfa: "medium",
    identity_access: "medium",
    email_protection: "low",
    endpoint_protection: "medium",
    data_protection: "high",
    backup_recovery: "medium",
    device_management: "high",
    network_security: "high",
    application_security: "high",
    logging_monitoring: "medium",
  };
  return effortMap[category] ?? "medium";
}
