/**
 * Report AI — delegates to Report Generator Agent
 *
 * Re-exports agent-powered report generation for backward compatibility.
 */

import {
  consolidateFindingsViaAgent,
  generateExecutiveSummaryViaAgent,
  generatePillarNarrativeViaAgent,
  generateRecommendationsViaAgent,
  type ConsolidatedFinding,
  type ConsolidationResult,
  type ExecutiveSummary,
  type PillarNarrative,
} from "./agents/report-agent";

export type { ConsolidatedFinding, ConsolidationResult, ExecutiveSummary, PillarNarrative };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function consolidateFindings(findings: any[]): Promise<ConsolidationResult | null> {
  return consolidateFindingsViaAgent(findings);
}

export async function generateExecutiveSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal: any,
  consolidatedFindings: ConsolidatedFinding[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pillars: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  techStack: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comparisons: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phases: any[],
): Promise<ExecutiveSummary | null> {
  return generateExecutiveSummaryViaAgent(deal, consolidatedFindings, pillars, techStack, comparisons, phases);
}

export async function generatePillarNarrative(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pillar: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findings: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  techStack: any[],
): Promise<PillarNarrative | null> {
  return generatePillarNarrativeViaAgent(pillar, findings, techStack);
}

export async function generateRecommendations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findings: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pillars: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  techStack: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comparisons: any[],
): Promise<string[] | null> {
  return generateRecommendationsViaAgent(deal, findings, pillars, techStack, comparisons);
}
