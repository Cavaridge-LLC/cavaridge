/**
 * Score Trend Analysis — analyzes historical score snapshots
 * for trend detection and significant change identification.
 */

import type { ScoreTrend, ScoreTrendPoint, AdjustedSecurityScoreReport } from "@shared/types/security-scoring";
import * as storage from "../../storage";

export async function getScoreTrend(
  orgId: string,
  clientId: string,
  limit = 12,
): Promise<ScoreTrend | null> {
  const history = await storage.getScoreHistory(orgId, clientId, limit);
  if (history.length < 2) return null;

  // History is ordered desc — reverse for chronological
  const chronological = [...history].reverse();

  const dataPoints: ScoreTrendPoint[] = chronological.map((h) => ({
    date: h.generatedAt.toISOString(),
    nativeScore: Number(h.nativeScore),
    adjustedScore: Number(h.adjustedScore),
  }));

  const trendDirection = detectTrendDirection(dataPoints);
  const significantChanges = identifySignificantChanges(chronological);

  return { dataPoints, trendDirection, significantChanges };
}

export function detectTrendDirection(
  dataPoints: ScoreTrendPoint[],
): "improving" | "stable" | "declining" {
  if (dataPoints.length < 2) return "stable";

  const first = dataPoints[0].adjustedScore;
  const last = dataPoints[dataPoints.length - 1].adjustedScore;
  const delta = last - first;

  if (delta > 3) return "improving";
  if (delta < -3) return "declining";
  return "stable";
}

function identifySignificantChanges(
  history: Array<{ adjustedScore: string; nativeScore: string; reportJson: unknown; generatedAt: Date }>,
): string[] {
  const changes: string[] = [];

  for (let i = 1; i < history.length; i++) {
    const prev = Number(history[i - 1].adjustedScore);
    const curr = Number(history[i].adjustedScore);
    const delta = curr - prev;

    if (Math.abs(delta) >= 5) {
      const date = history[i].generatedAt.toISOString().slice(0, 10);
      const direction = delta > 0 ? "improved" : "dropped";

      // Try to identify what changed by comparing gap counts
      const prevReport = history[i - 1].reportJson as AdjustedSecurityScoreReport | null;
      const currReport = history[i].reportJson as AdjustedSecurityScoreReport | null;

      let detail = "";
      if (prevReport && currReport) {
        const prevGaps = prevReport.realGaps?.length ?? 0;
        const currGaps = currReport.realGaps?.length ?? 0;
        const gapDelta = currGaps - prevGaps;

        if (gapDelta < 0) {
          detail = ` (${Math.abs(gapDelta)} gap${Math.abs(gapDelta) > 1 ? "s" : ""} resolved)`;
        } else if (gapDelta > 0) {
          detail = ` (${gapDelta} new gap${gapDelta > 1 ? "s" : ""} identified)`;
        }
      }

      changes.push(
        `Score ${direction} ${Math.abs(delta)} points on ${date}${detail}`,
      );
    }
  }

  return changes;
}
