/**
 * QBR Package Generator — compiles security scores, roadmap items,
 * and AI-generated narratives into a structured QBR package.
 */

import type {
  QbrPackage,
  QbrSecuritySection,
  AdjustedSecurityScoreReport,
} from "@shared/types/security-scoring";
import * as storage from "../../storage";
import { SecurityAdvisorAgent } from "../../agents/security-advisor";
import type { AgentContext } from "@cavaridge/agent-core";

export async function generateQbrPackage(
  orgId: string,
  clientId: string,
  userId: string,
  agentContext: AgentContext,
): Promise<QbrPackage> {
  // Fetch client
  const client = await storage.getClient(orgId, clientId);
  if (!client) throw new Error("Client not found");

  // Fetch latest score
  const latestScore = await storage.getLatestScore(orgId, clientId);

  // Fetch roadmap items
  const initiatives = await storage.getInitiatives(orgId, clientId);

  // Build security section if score data exists
  let security: QbrSecuritySection | undefined;

  if (latestScore) {
    const report = latestScore.reportJson as AdjustedSecurityScoreReport;

    // Run SecurityAdvisor for talking points and what-if
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
      // Fall back to score data without AI narratives
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

  return {
    clientId,
    clientName: client.name,
    generatedAt: new Date().toISOString(),
    security,
    executiveSummary: security
      ? `Security posture stands at ${security.headlineAdjusted}/100 with ${security.topGaps.length} priority gaps identified.`
      : "No security assessment data available yet.",
    roadmapItems: initiatives.map((i) => ({
      title: i.title,
      status: i.status,
      priority: i.priority,
      quarter: i.quarter,
      source: i.source,
    })),
    nextSteps: [],
  };
}
