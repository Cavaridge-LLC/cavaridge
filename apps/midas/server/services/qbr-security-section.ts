/**
 * CVG-MIDAS — QBR Security Section Generator
 *
 * Transforms AEGIS security data into a structured QBR section
 * that can be rendered in reports (PDF/DOCX/PPTX).
 *
 * Cross-app integration: AEGIS -> Midas QBR
 *
 * Generates:
 *  - Score trend (current vs previous quarter)
 *  - Top gaps with remediation recommendations
 *  - Compensating controls status
 *  - Budget recommendations for security improvements
 */

import type {
  QbrSecurityData,
  SecurityFinding,
  CompensatingControlSummary,
} from "./aegis-integration";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QbrSection {
  sectionId: string;
  title: string;
  order: number;
  subsections: QbrSubsection[];
  metadata: {
    dataSource: string;
    generatedAt: Date;
    dataFreshness: "current" | "stale" | "unavailable";
    aegisScoreAvailable: boolean;
  };
}

export interface QbrSubsection {
  subsectionId: string;
  title: string;
  order: number;
  content: QbrContentBlock[];
}

export type QbrContentBlock =
  | ScoreCardBlock
  | ScoreTrendBlock
  | FindingsTableBlock
  | CompensatingControlsBlock
  | BudgetRecommendationBlock
  | TextBlock
  | MetricCardBlock;

interface BaseBlock {
  type: string;
  order: number;
}

export interface ScoreCardBlock extends BaseBlock {
  type: "score_card";
  score: number;
  grade: string;
  label: string;
  description: string;
  colorClass: string;
}

export interface ScoreTrendBlock extends BaseBlock {
  type: "score_trend";
  currentScore: number;
  currentGrade: string;
  previousScore: number | null;
  previousGrade: string | null;
  delta: number | null;
  trend: "improving" | "declining" | "stable" | "new";
  trendNarrative: string;
}

export interface FindingsTableBlock extends BaseBlock {
  type: "findings_table";
  findings: FindingRow[];
  totalFindingsCount: number;
  narrative: string;
}

export interface FindingRow {
  severity: string;
  severityColor: string;
  title: string;
  description: string;
  remediation: string;
  estimatedEffort: string;
  cisControl: string | null;
}

export interface CompensatingControlsBlock extends BaseBlock {
  type: "compensating_controls";
  controls: CompensatingControlRow[];
  totalBonusPoints: number;
  narrative: string;
}

export interface CompensatingControlRow {
  name: string;
  vendor: string;
  bonusPoints: number;
  detectionMethod: string;
  status: string;
}

export interface BudgetRecommendationBlock extends BaseBlock {
  type: "budget_recommendations";
  recommendations: BudgetRecommendation[];
  totalEstimatedInvestment: EstimatedRange;
  narrative: string;
}

export interface BudgetRecommendation {
  priority: number;
  title: string;
  description: string;
  estimatedCost: EstimatedRange;
  expectedScoreImpact: string;
  timeframe: string;
  category: "tool" | "process" | "training" | "assessment";
}

export interface EstimatedRange {
  low: number;
  high: number;
  period: "one-time" | "monthly" | "annual";
}

export interface TextBlock extends BaseBlock {
  type: "text";
  heading?: string;
  body: string;
}

export interface MetricCardBlock extends BaseBlock {
  type: "metric_card";
  metrics: Array<{
    label: string;
    value: string;
    trend?: "up" | "down" | "flat";
    trendIsPositive?: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate the security portion of a QBR document from AEGIS data.
 *
 * Produces a structured QbrSection with subsections for:
 *  1. Security Posture Overview (score card + trend)
 *  2. Key Findings & Gaps (top findings with remediation)
 *  3. Security Controls Status (compensating controls + coverage)
 *  4. Recommended Investments (budget recommendations)
 */
export function generateSecuritySection(data: QbrSecurityData): QbrSection {
  const now = new Date();
  const scoreFreshness = getDataFreshness(data.adjustedScore.calculatedAt, now);

  return {
    sectionId: "security-posture",
    title: "Security Posture & Risk Assessment",
    order: 3, // Typically section 3 in a QBR
    subsections: [
      buildPostureOverview(data, 1),
      buildKeyFindings(data, 2),
      buildControlsStatus(data, 3),
      buildBudgetRecommendations(data, 4),
    ],
    metadata: {
      dataSource: "CVG-AEGIS Cavaridge Adjusted Score",
      generatedAt: now,
      dataFreshness: scoreFreshness,
      aegisScoreAvailable: data.adjustedScore.totalScore > 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Subsection 1: Security Posture Overview
// ---------------------------------------------------------------------------

function buildPostureOverview(data: QbrSecurityData, order: number): QbrSubsection {
  const { adjustedScore, previousQuarterScore, summaryMetrics } = data;

  // Score card
  const scoreCard: ScoreCardBlock = {
    type: "score_card",
    order: 1,
    score: adjustedScore.totalScore,
    grade: adjustedScore.grade,
    label: "Cavaridge Adjusted Score",
    description: buildScoreDescription(adjustedScore.totalScore, adjustedScore.grade),
    colorClass: gradeToColorClass(adjustedScore.grade),
  };

  // Trend
  const trend: ScoreTrendBlock = {
    type: "score_trend",
    order: 2,
    currentScore: adjustedScore.totalScore,
    currentGrade: adjustedScore.grade,
    previousScore: previousQuarterScore?.totalScore ?? null,
    previousGrade: previousQuarterScore?.grade ?? null,
    delta: previousQuarterScore?.delta ?? null,
    trend: previousQuarterScore?.trend ?? "new",
    trendNarrative: buildTrendNarrative(adjustedScore, previousQuarterScore),
  };

  // Key metrics
  const metrics: MetricCardBlock = {
    type: "metric_card",
    order: 3,
    metrics: [
      {
        label: "MFA Adoption",
        value: summaryMetrics.mfaAdoptionPct !== null
          ? `${summaryMetrics.mfaAdoptionPct}%`
          : "N/A",
        trend: summaryMetrics.mfaAdoptionPct !== null && summaryMetrics.mfaAdoptionPct >= 90 ? "up" : "down",
        trendIsPositive: summaryMetrics.mfaAdoptionPct !== null && summaryMetrics.mfaAdoptionPct >= 90,
      },
      {
        label: "Extension Coverage",
        value: `${summaryMetrics.extensionCoveragePct}%`,
        trend: summaryMetrics.extensionCoveragePct >= 80 ? "up" : "down",
        trendIsPositive: summaryMetrics.extensionCoveragePct >= 80,
      },
      {
        label: "Shadow IT Apps",
        value: String(data.sasShadowItAppCount),
        trend: data.sasShadowItAppCount > 10 ? "up" : data.sasShadowItAppCount > 0 ? "flat" : "down",
        trendIsPositive: data.sasShadowItAppCount <= 5,
      },
      {
        label: "Open Findings",
        value: String(summaryMetrics.totalSecurityFindings),
        trend: summaryMetrics.criticalFindings > 0 ? "up" : "flat",
        trendIsPositive: summaryMetrics.criticalFindings === 0 && summaryMetrics.highFindings === 0,
      },
    ],
  };

  return {
    subsectionId: "posture-overview",
    title: "Security Posture Overview",
    order,
    content: [scoreCard, trend, metrics],
  };
}

// ---------------------------------------------------------------------------
// Subsection 2: Key Findings & Gaps
// ---------------------------------------------------------------------------

function buildKeyFindings(data: QbrSecurityData, order: number): QbrSubsection {
  const { topFindings, summaryMetrics } = data;
  const content: QbrContentBlock[] = [];

  if (topFindings.length === 0) {
    content.push({
      type: "text",
      order: 1,
      heading: "No Open Findings",
      body: "No unresolved security findings were identified during this review period. The environment meets current security baseline requirements.",
    });
  } else {
    const findingsTable: FindingsTableBlock = {
      type: "findings_table",
      order: 1,
      findings: topFindings.map(f => ({
        severity: f.severity,
        severityColor: severityToColor(f.severity),
        title: f.title,
        description: f.description,
        remediation: f.remediationRecommendation,
        estimatedEffort: f.estimatedEffort,
        cisControl: f.cisControl ?? null,
      })),
      totalFindingsCount: summaryMetrics.totalSecurityFindings,
      narrative: buildFindingsNarrative(topFindings, summaryMetrics),
    };
    content.push(findingsTable);

    // Signal breakdown context
    const configuredSignals = data.adjustedScore.signalBreakdown.filter(
      s => s.status === "active",
    );
    const unconfiguredSignals = data.adjustedScore.signalBreakdown.filter(
      s => s.status === "not_configured",
    );

    if (unconfiguredSignals.length > 0) {
      content.push({
        type: "text",
        order: 2,
        heading: "Coverage Gaps",
        body: `${unconfiguredSignals.length} security signal(s) are not yet configured: ${unconfiguredSignals.map(s => s.signal.replace(/_/g, " ")).join(", ")}. Enabling these signals will provide a more complete security posture assessment and may improve the overall score.`,
      });
    }
  }

  return {
    subsectionId: "key-findings",
    title: "Key Security Findings",
    order,
    content,
  };
}

// ---------------------------------------------------------------------------
// Subsection 3: Compensating Controls Status
// ---------------------------------------------------------------------------

function buildControlsStatus(data: QbrSecurityData, order: number): QbrSubsection {
  const { compensatingControls } = data;
  const content: QbrContentBlock[] = [];

  if (compensatingControls.length === 0) {
    content.push({
      type: "text",
      order: 1,
      heading: "Compensating Controls",
      body: "No compensating controls are currently detected or configured. Deploying tools such as MFA providers (Duo, Entra ID MFA), endpoint detection (SentinelOne, CrowdStrike), or email security (Proofpoint, Mimecast) can improve the Cavaridge Adjusted Score by up to 5 bonus points and offset certain risk flags.",
    });
  } else {
    const totalBonus = compensatingControls.reduce((sum, c) => sum + c.bonusPoints, 0);
    const cappedBonus = Math.min(5, totalBonus);

    const controlsBlock: CompensatingControlsBlock = {
      type: "compensating_controls",
      order: 1,
      controls: compensatingControls.map(c => ({
        name: c.name,
        vendor: c.vendor,
        bonusPoints: c.bonusPoints,
        detectionMethod: c.detectionMethod,
        status: "active",
      })),
      totalBonusPoints: cappedBonus,
      narrative: `${compensatingControls.length} compensating control(s) are active, contributing ${cappedBonus.toFixed(1)} bonus point(s) to the Cavaridge Adjusted Score (max 5). ${compensatingControls.filter(c => c.detectionMethod === "auto").length} were auto-detected from tenant configuration data.`,
    };
    content.push(controlsBlock);
  }

  return {
    subsectionId: "controls-status",
    title: "Security Controls & Compensating Measures",
    order,
    content,
  };
}

// ---------------------------------------------------------------------------
// Subsection 4: Budget Recommendations
// ---------------------------------------------------------------------------

function buildBudgetRecommendations(data: QbrSecurityData, order: number): QbrSubsection {
  const recommendations: BudgetRecommendation[] = [];
  let priority = 1;

  const {
    adjustedScore,
    summaryMetrics,
    compensatingControls,
    sasShadowItAppCount,
    browserSecurityCompliancePct,
    credentialHygieneScore,
  } = data;

  const activeControlTypes = new Set(compensatingControls.map(c => c.controlType));

  // Recommend MFA if adoption is low
  if (summaryMetrics.mfaAdoptionPct !== null && summaryMetrics.mfaAdoptionPct < 90) {
    recommendations.push({
      priority: priority++,
      title: "MFA Enforcement",
      description: `Current MFA adoption is ${summaryMetrics.mfaAdoptionPct}%. Industry best practice and most compliance frameworks require 100% MFA coverage for all user accounts.`,
      estimatedCost: { low: 0, high: 6000, period: "annual" },
      expectedScoreImpact: "+10-15 points (Credential Hygiene signal)",
      timeframe: "1-2 weeks",
      category: "process",
    });
  }

  // Recommend endpoint protection if not detected
  if (!activeControlTypes.has("sentinelone_edr") && !activeControlTypes.has("crowdstrike_edr")) {
    recommendations.push({
      priority: priority++,
      title: "Endpoint Detection & Response (EDR)",
      description: "No EDR solution detected. Deploying SentinelOne or CrowdStrike provides advanced threat detection, automated response, and contributes up to 1.5 compensating control bonus points.",
      estimatedCost: { low: 3, high: 8, period: "monthly" },
      expectedScoreImpact: "+1.5 compensating control bonus",
      timeframe: "2-4 weeks deployment",
      category: "tool",
    });
  }

  // Recommend email security if not detected
  if (!activeControlTypes.has("proofpoint_email") && !activeControlTypes.has("mimecast_email")) {
    recommendations.push({
      priority: priority++,
      title: "Advanced Email Security",
      description: "No third-party email security gateway detected. Proofpoint or Mimecast provides phishing prevention, attachment sandboxing, and URL rewriting beyond native Exchange Online Protection.",
      estimatedCost: { low: 2, high: 5, period: "monthly" },
      expectedScoreImpact: "+1.0 compensating control bonus",
      timeframe: "1-2 weeks deployment",
      category: "tool",
    });
  }

  // Recommend browser extension rollout if coverage is low
  if (summaryMetrics.extensionCoveragePct < 80) {
    recommendations.push({
      priority: priority++,
      title: "AEGIS Browser Extension Deployment",
      description: `Browser extension coverage is ${summaryMetrics.extensionCoveragePct}%. Full deployment provides real-time phishing detection, SaaS shadow IT discovery, and credential monitoring. Force-deploy via RMM (Intune/NinjaOne/Datto).`,
      estimatedCost: { low: 2.5, high: 7, period: "monthly" },
      expectedScoreImpact: "+5-15 points (Browser Security signal)",
      timeframe: "1-2 weeks rollout via RMM",
      category: "tool",
    });
  }

  // Recommend DNS filtering if not configured
  if (!data.adjustedScore.signalBreakdown.some(s => s.signal === "dns_filtering" && s.status === "active")) {
    recommendations.push({
      priority: priority++,
      title: "DNS Filtering (Cloudflare Gateway)",
      description: "DNS filtering is not configured. Cloudflare Gateway provides category-based blocking, malware domain prevention, and DNS-level visibility. Free tier covers up to 50 seats.",
      estimatedCost: { low: 0, high: 3, period: "monthly" },
      expectedScoreImpact: "+5-10 points (DNS Filtering signal)",
      timeframe: "1-2 days for DoH config, 1 week for full WARP deployment",
      category: "tool",
    });
  }

  // Recommend SaaS audit if shadow IT count is high
  if (sasShadowItAppCount > 10) {
    recommendations.push({
      priority: priority++,
      title: "SaaS Shadow IT Remediation",
      description: `${sasShadowItAppCount} unsanctioned or unclassified SaaS applications detected. Conduct a SaaS audit to classify, sanction approved apps, and block unauthorized services.`,
      estimatedCost: { low: 2000, high: 5000, period: "one-time" },
      expectedScoreImpact: "+3-8 points (SaaS Shadow IT signal)",
      timeframe: "2-4 weeks audit + remediation",
      category: "assessment",
    });
  }

  // Recommend security awareness training if multiple findings
  if (summaryMetrics.totalSecurityFindings > 5) {
    recommendations.push({
      priority: priority++,
      title: "Security Awareness Training",
      description: "Multiple security findings suggest opportunity for improved security hygiene through structured awareness training. Recommend quarterly phishing simulations and annual security training.",
      estimatedCost: { low: 1500, high: 5000, period: "annual" },
      expectedScoreImpact: "Indirect — reduces credential and phishing incidents",
      timeframe: "Ongoing quarterly",
      category: "training",
    });
  }

  // Calculate total estimated investment
  const totalLow = recommendations.reduce((sum, r) => {
    if (r.estimatedCost.period === "monthly") return sum + r.estimatedCost.low * 12;
    return sum + r.estimatedCost.low;
  }, 0);

  const totalHigh = recommendations.reduce((sum, r) => {
    if (r.estimatedCost.period === "monthly") return sum + r.estimatedCost.high * 12;
    return sum + r.estimatedCost.high;
  }, 0);

  const budgetBlock: BudgetRecommendationBlock = {
    type: "budget_recommendations",
    order: 1,
    recommendations,
    totalEstimatedInvestment: { low: totalLow, high: totalHigh, period: "annual" },
    narrative: recommendations.length > 0
      ? `${recommendations.length} security investment recommendation(s) identified. Estimated annual investment range: $${formatCurrency(totalLow)} - $${formatCurrency(totalHigh)}. Prioritized by expected impact on the Cavaridge Adjusted Score and overall risk reduction.`
      : "Current security tooling and processes are well-aligned with best practices. No immediate budget recommendations at this time.",
  };

  return {
    subsectionId: "budget-recommendations",
    title: "Security Investment Recommendations",
    order,
    content: [budgetBlock],
  };
}

// ---------------------------------------------------------------------------
// Narrative builders
// ---------------------------------------------------------------------------

function buildScoreDescription(score: number, grade: string): string {
  if (score >= 90) {
    return `Score: ${score}/100 (Grade ${grade}). Excellent security posture. The environment exceeds baseline security requirements across most signal categories.`;
  }
  if (score >= 80) {
    return `Score: ${score}/100 (Grade ${grade}). Strong security posture with minor improvement opportunities. Core security controls are well-implemented.`;
  }
  if (score >= 70) {
    return `Score: ${score}/100 (Grade ${grade}). Adequate security posture with several areas for improvement. Key controls are in place but coverage gaps exist.`;
  }
  if (score >= 60) {
    return `Score: ${score}/100 (Grade ${grade}). Below-average security posture. Multiple gaps in security coverage require attention to meet industry baselines.`;
  }
  return `Score: ${score}/100 (Grade ${grade}). Security posture requires immediate attention. Significant gaps exist across multiple security domains.`;
}

function buildTrendNarrative(
  current: { totalScore: number; grade: string },
  previous: { totalScore: number; grade: string; delta: number; trend: string } | null,
): string {
  if (!previous) {
    return `This is the first quarter with Cavaridge Adjusted Score data. Current score: ${current.totalScore}/100 (Grade ${current.grade}). Future QBRs will include quarter-over-quarter trend analysis.`;
  }

  const absDelta = Math.abs(previous.delta);
  const direction = previous.delta > 0 ? "improved" : previous.delta < 0 ? "declined" : "remained stable";

  if (previous.trend === "improving") {
    return `Security posture has ${direction} by ${absDelta.toFixed(1)} points since last quarter (${previous.totalScore} -> ${current.totalScore}). This improvement reflects progress in addressing identified gaps and strengthening security controls.`;
  }
  if (previous.trend === "declining") {
    return `Security posture has ${direction} by ${absDelta.toFixed(1)} points since last quarter (${previous.totalScore} -> ${current.totalScore}). This shift may reflect new findings, expired controls, or environmental changes that should be reviewed.`;
  }
  return `Security posture has ${direction} since last quarter (${previous.totalScore} -> ${current.totalScore}, delta: ${previous.delta > 0 ? "+" : ""}${previous.delta.toFixed(1)}). Consistent posture indicates stable security operations.`;
}

function buildFindingsNarrative(findings: SecurityFinding[], metrics: { totalSecurityFindings: number; criticalFindings: number; highFindings: number }): string {
  const showing = findings.length;
  const total = metrics.totalSecurityFindings;

  let narrative = `Showing top ${showing} of ${total} open finding(s). `;

  if (metrics.criticalFindings > 0) {
    narrative += `${metrics.criticalFindings} critical finding(s) require immediate remediation. `;
  }
  if (metrics.highFindings > 0) {
    narrative += `${metrics.highFindings} high-priority finding(s) should be addressed within the current quarter. `;
  }

  return narrative.trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDataFreshness(calculatedAt: Date, now: Date): "current" | "stale" | "unavailable" {
  const ageMs = now.getTime() - calculatedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return "current";
  if (ageDays <= 30) return "stale";
  return "unavailable";
}

function gradeToColorClass(grade: string): string {
  switch (grade) {
    case "A": return "text-green-600 bg-green-50";
    case "B": return "text-blue-600 bg-blue-50";
    case "C": return "text-yellow-600 bg-yellow-50";
    case "D": return "text-orange-600 bg-orange-50";
    case "F": return "text-red-600 bg-red-50";
    default: return "text-gray-600 bg-gray-50";
  }
}

function severityToColor(severity: string): string {
  switch (severity) {
    case "critical": return "#DC2626";
    case "high": return "#EA580C";
    case "medium": return "#CA8A04";
    case "low": return "#16A34A";
    case "info": return "#6B7280";
    default: return "#6B7280";
  }
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`;
  }
  return amount.toFixed(0);
}
