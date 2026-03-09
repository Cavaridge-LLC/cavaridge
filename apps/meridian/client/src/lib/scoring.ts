import type { Pillar, Finding } from "@shared/schema";

export type ConfidenceLabel = "insufficient" | "low" | "moderate" | "high";

export const CONFIDENCE_TIERS: Record<ConfidenceLabel, {
  label: string;
  color: string;
  badgeBg: string;
}> = {
  insufficient: { label: "Not Assessed", color: "#6B7280", badgeBg: "rgba(107,114,128,0.12)" },
  low: { label: "Limited Evidence", color: "#F59E0B", badgeBg: "rgba(245,158,11,0.12)" },
  moderate: { label: "Partial Coverage", color: "#3B82F6", badgeBg: "rgba(59,130,246,0.12)" },
  high: { label: "Well Documented", color: "#10B981", badgeBg: "rgba(16,185,129,0.12)" },
};

export function computeCompositeScore(pillars: Pillar[], findings: Finding[]): number {
  if (pillars.length === 0) return 0;

  const weightedSum = pillars.reduce((sum, p) => {
    const score = Number(p.score) || 0;
    const weight = Number(p.weight) || 0;
    return sum + score * weight;
  }, 0);

  const criticalCount = findings.filter(
    (f) => f.severity === "critical" && f.status === "open"
  ).length;

  const penaltyFactor = Math.max(0.70, 1.0 - 0.05 * criticalCount);

  const raw = weightedSum * penaltyFactor;
  return Math.round(raw * 10) / 10;
}

export function compositeToPercent(composite: number): number {
  return Math.min(100, Math.max(0, Math.round((composite / 5) * 100)));
}

export function getScoreColor(score: number, scale: "pillar" | "composite" = "composite"): string {
  if (scale === "pillar") {
    if (score >= 4.0) return "#10B981";
    if (score >= 3.0) return "#F59E0B";
    return "#EF4444";
  }
  if (score >= 4.0) return "#10B981";
  if (score >= 3.0) return "#F59E0B";
  return "#EF4444";
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#EF4444";
    case "high": return "#F59E0B";
    case "medium": return "#8B5CF6";
    case "low": return "#10B981";
    default: return "var(--text-disabled)";
  }
}

export function getSeverityOrder(severity: string): number {
  switch (severity) {
    case "critical": return 0;
    case "high": return 1;
    case "medium": return 2;
    case "low": return 3;
    default: return 4;
  }
}

export function getConfidenceTier(label: string | null | undefined): typeof CONFIDENCE_TIERS[ConfidenceLabel] {
  const key = (label || "insufficient") as ConfidenceLabel;
  return CONFIDENCE_TIERS[key] || CONFIDENCE_TIERS.insufficient;
}

export function getOverallConfidenceLabel(label: string | null | undefined): string {
  switch (label) {
    case "high": return "High Confidence";
    case "moderate": return "Moderate Confidence";
    case "low": return "Low Confidence";
    default: return "Insufficient Evidence";
  }
}
