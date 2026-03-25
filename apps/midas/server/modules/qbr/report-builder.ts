/**
 * QBR Report Builder — compiles all data sections into
 * a structured QbrReportData object.
 *
 * Extended from the original generator to include:
 * - AEGIS integration data
 * - License optimization
 * - Infrastructure health
 * - Roadmap progress
 * - Budget summary
 * - AI recommendations
 */

import type {
  QbrReportData,
  InfrastructureHealthSection,
  LicenseOptimizationSection,
  RoadmapProgressSection,
  QbrRecommendation,
} from "@shared/types/qbr";
import type { QbrSecuritySection, AdjustedSecurityScoreReport } from "@shared/types/security-scoring";
import type { AegisQbrData } from "@shared/types/aegis-integration";
import type { TenantIntelSnapshot } from "@shared/types/tenant-intel-integration";
import type { QuarterlyRollup } from "@shared/types/budget";
import type { ProjectRecord, Client } from "@shared/schema";
import type { AgentContext } from "@cavaridge/agent-core";

import * as storage from "../../storage";
import { SecurityAdvisorAgent } from "../../agents/security-advisor";
import { RecommendationAgent, type RecommendationInput } from "../../agents/recommendation/agent";
import { calculateQuarterlyRollup } from "../budget/calculator";

/**
 * Build a full QBR report data object.
 */
export async function buildQbrReportData(
  orgId: string,
  clientId: string,
  userId: string,
  quarter: string,
  fiscalYear: number,
  agentContext: AgentContext,
  options?: {
    aegisData?: AegisQbrData;
    tenantIntel?: TenantIntelSnapshot;
  },
): Promise<QbrReportData> {
  // Fetch client
  const client = await storage.getClient(orgId, clientId);
  if (!client) throw new Error("Client not found");

  // Fetch data in parallel
  const [latestScore, scoreHistory, projectRecords, budgetItemRecords, snapshot] = await Promise.all([
    storage.getLatestScore(orgId, clientId),
    storage.getScoreHistory(orgId, clientId, 12),
    storage.getProjects(orgId, undefined, clientId),
    storage.getBudgetItems(orgId, clientId, fiscalYear),
    storage.getSnapshot(orgId, clientId),
  ]);

  // Build security section
  let security: QbrSecuritySection | null = null;
  if (latestScore) {
    const report = latestScore.reportJson as AdjustedSecurityScoreReport;
    const advisor = new SecurityAdvisorAgent();
    try {
      const advisorOutput = await advisor.execute({
        data: {
          tenantId: orgId,
          clientId,
          scoreReport: report,
        },
        context: agentContext,
      });
      security = {
        headlineNative: report.nativeScore,
        headlineAdjusted: report.adjustedScore,
        headlineDelta: report.scoreDelta,
        categories: report.categories,
        topGaps: advisorOutput.result.prioritizedGaps.slice(0, 5),
        trend: report.trend,
        talkingPoints: advisorOutput.result.talkingPoints,
        whatIfScenarios: advisorOutput.result.whatIfScenarios,
      };
    } catch {
      security = {
        headlineNative: report.nativeScore,
        headlineAdjusted: report.adjustedScore,
        headlineDelta: report.scoreDelta,
        categories: report.categories,
        topGaps: [],
        trend: report.trend,
        talkingPoints: [
          `Your Cavaridge Adjusted Score is ${report.adjustedScore}/100 (native: ${report.nativeScore}).`,
          `${report.compensatedControls.length} controls covered by third-party tools.`,
          `${report.realGaps.length} gaps identified for remediation.`,
        ],
        whatIfScenarios: [],
      };
    }
  }

  // Build infrastructure section
  const infrastructure: InfrastructureHealthSection | null = options?.tenantIntel
    ? {
        userMetrics: options.tenantIntel.users,
        securityConfig: options.tenantIntel.security,
        highlights: buildInfraHighlights(options.tenantIntel),
      }
    : null;

  // Build license optimization section
  const licenseOptimization: LicenseOptimizationSection | null = options?.tenantIntel?.licenses
    ? {
        summary: options.tenantIntel.licenses,
        savingsOpportunity: options.tenantIntel.licenses.wastedMonthlyCost,
        recommendations: buildLicenseRecommendations(options.tenantIntel.licenses),
      }
    : null;

  // Build roadmap progress
  const roadmapProgress = buildRoadmapProgress(projectRecords);

  // Build budget summary for this quarter
  const budgetSummary: QuarterlyRollup | null = budgetItemRecords.length > 0
    ? calculateQuarterlyRollup(budgetItemRecords, quarter, fiscalYear)
    : null;

  // Generate AI recommendations
  const recommendations = await generateRecommendations(
    client,
    security,
    options?.tenantIntel ?? null,
    projectRecords,
    agentContext,
  );

  // Build executive summary
  const executiveSummary = buildExecutiveSummary(
    client.name,
    security,
    roadmapProgress,
    recommendations,
  );

  return {
    clientId,
    clientName: client.name,
    quarter,
    fiscalYear,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    security,
    aegis: options?.aegisData ?? null,
    infrastructure,
    licenseOptimization,
    roadmapProgress,
    budgetSummary,
    recommendations,
    nextSteps: buildNextSteps(security, recommendations),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildRoadmapProgress(projectRecords: ProjectRecord[]): RoadmapProgressSection {
  const totalProjects = projectRecords.length;
  const completedProjects = projectRecords.filter((p) => p.status === "completed").length;
  const inProgressProjects = projectRecords.filter((p) => p.status === "in_progress").length;
  const completionPct = totalProjects > 0
    ? Math.round((completedProjects / totalProjects) * 100)
    : 0;

  return {
    totalProjects,
    completedProjects,
    inProgressProjects,
    completionPct,
    items: projectRecords.map((p) => ({
      title: p.title,
      status: p.status,
      priority: p.priority,
      quarter: p.startDate ? `Q${Math.ceil((new Date(p.startDate).getMonth() + 1) / 3)} ${new Date(p.startDate).getFullYear()}` : "TBD",
      source: p.source,
    })),
  };
}

function buildInfraHighlights(intel: TenantIntelSnapshot): string[] {
  const highlights: string[] = [];
  const { users, security } = intel;

  if (users) {
    highlights.push(`${users.totalUsers} total users (${users.activeUsers} active)`);
    highlights.push(`MFA adoption: ${users.mfaEnabledPct}%`);
    if (users.adminCount > 0) {
      highlights.push(`${users.adminCount} admin account${users.adminCount > 1 ? "s" : ""}`);
    }
  }

  if (security) {
    highlights.push(`Device compliance: ${security.deviceCompliancePct}%`);
    highlights.push(`${security.conditionalAccessPolicyCount} Conditional Access policies`);
  }

  return highlights;
}

function buildLicenseRecommendations(licenses: TenantIntelSnapshot["licenses"]): string[] {
  const recs: string[] = [];

  if (licenses.wastedLicenseCount > 0) {
    recs.push(`Reclaim ${licenses.wastedLicenseCount} unused license${licenses.wastedLicenseCount > 1 ? "s" : ""} to reduce spend.`);
  }

  if (licenses.utilizationPct < 80) {
    recs.push(`Overall license utilization is ${licenses.utilizationPct}%. Review SKU assignments for optimization.`);
  }

  for (const sku of licenses.topSkus) {
    if (sku.utilizationPct < 50 && sku.totalQuantity > 5) {
      recs.push(`${sku.skuName}: only ${sku.utilizationPct}% utilized (${sku.assignedCount}/${sku.totalQuantity}).`);
    }
  }

  return recs;
}

async function generateRecommendations(
  client: Client,
  security: QbrSecuritySection | null,
  tenantIntel: TenantIntelSnapshot | null,
  projectRecords: ProjectRecord[],
  agentContext: AgentContext,
): Promise<QbrRecommendation[]> {
  const agent = new RecommendationAgent();
  const completedCount = projectRecords.filter((p) => p.status === "completed").length;

  const input: RecommendationInput = {
    tenantId: client.tenantId,
    clientId: client.id,
    clientName: client.name,
    adjustedScore: security?.headlineAdjusted ?? null,
    nativeScore: security?.headlineNative ?? null,
    gapCount: security?.topGaps.length ?? 0,
    compensatedCount: 0,
    licenseUtilizationPct: tenantIntel?.licenses.utilizationPct ?? null,
    wastedLicenseCount: tenantIntel?.licenses.wastedLicenseCount ?? null,
    mfaEnabledPct: tenantIntel?.users.mfaEnabledPct ?? null,
    deviceCompliancePct: tenantIntel?.security.deviceCompliancePct ?? null,
    roadmapCompletionPct: projectRecords.length > 0
      ? Math.round((completedCount / projectRecords.length) * 100)
      : 0,
    projectCount: projectRecords.length,
    completedProjectCount: completedCount,
  };

  try {
    const output = await agent.execute({
      data: input,
      context: agentContext,
    });
    return output.result.recommendations;
  } catch {
    return agent["buildFallbackRecommendations"](input);
  }
}

function buildExecutiveSummary(
  clientName: string,
  security: QbrSecuritySection | null,
  roadmapProgress: RoadmapProgressSection,
  recommendations: QbrRecommendation[],
): string {
  const parts: string[] = [];

  if (security) {
    parts.push(`${clientName}'s Cavaridge Adjusted Security Score is ${security.headlineAdjusted}/100 (native: ${security.headlineNative}).`);
    if (security.topGaps.length > 0) {
      parts.push(`${security.topGaps.length} priority gaps identified for remediation.`);
    }
  } else {
    parts.push(`${clientName} has no security assessment data available.`);
  }

  parts.push(`Roadmap progress: ${roadmapProgress.completionPct}% complete (${roadmapProgress.completedProjects}/${roadmapProgress.totalProjects} projects).`);

  const criticalRecs = recommendations.filter((r) => r.priority === "critical");
  if (criticalRecs.length > 0) {
    parts.push(`${criticalRecs.length} critical recommendation${criticalRecs.length > 1 ? "s" : ""} require immediate attention.`);
  }

  return parts.join(" ");
}

function buildNextSteps(
  security: QbrSecuritySection | null,
  recommendations: QbrRecommendation[],
): string[] {
  const steps: string[] = [];

  const criticalRecs = recommendations.filter((r) => r.priority === "critical" || r.priority === "high");
  for (const rec of criticalRecs.slice(0, 3)) {
    steps.push(rec.title);
  }

  if (security && security.topGaps.length > 0) {
    steps.push("Review and prioritize security gap remediation plan.");
  }

  steps.push("Schedule follow-up to review progress on action items.");

  return steps;
}
