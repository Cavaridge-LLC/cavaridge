/**
 * Meridian Report Agent Adapter
 *
 * Configures ReportGeneratorAgent for Meridian's M&A report
 * narrative generation (executive summaries, pillar narratives, etc.)
 */

import { ReportGeneratorAgent } from "@cavaridge/agents";
import type { ReportGeneratorOutput } from "@cavaridge/agents";
import { createMeridianContext } from "./context";

const agent = new ReportGeneratorAgent({ appCode: "CVG-MER" });

// ── Types (re-export for backward compatibility) ─────────────────────

export interface ConsolidatedFinding {
  title: string;
  severity: string;
  description: string;
  evidence_count: number;
  source_images: string[];
  business_impact: string;
  remediation: string;
  estimated_cost: string;
  original_finding_ids: string[];
}

export interface ConsolidationResult {
  consolidated_findings: ConsolidatedFinding[];
  total_original: number;
  total_consolidated: number;
}

export interface ExecutiveSummary {
  investment_verdict?: string;
  verdict_reasoning?: string;
  key_risk_findings?: string[];
  conditions_before_close?: string[];
  positive_observations?: string[];
  estimated_total_cost?: string;
  estimated_timeline?: string;
  overall_risk_level?: string;
  target_profile?: string;
  evidence_confidence_warning?: string;
  cost_timeline_snapshot?: string;
}

export interface PillarNarrative {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  assessment_summary?: string;
  remediation_priority?: string;
  evidence_confidence_note?: string;
}

// ── Agent-powered report functions ───────────────────────────────────

export async function consolidateFindingsViaAgent(
  findings: Record<string, unknown>[],
): Promise<ConsolidationResult | null> {
  if (!agent.hasAI() || !findings.length) return null;

  try {
    const context = createMeridianContext("system", "system", {
      agentId: "report-generator",
      agentName: "Finding Consolidator",
    });

    const output = await agent.runWithAudit({
      data: {
        taskType: "consolidation",
        systemPrompt: `You are an expert IT due diligence analyst consolidating findings for an investment committee report.

Group related findings together, merge duplicates, and create a consolidated register.

Respond with JSON only:
{
  "consolidated_findings": [{ "title": "...", "severity": "critical|high|medium|low", "description": "...", "evidence_count": 0, "source_images": [], "business_impact": "...", "remediation": "...", "estimated_cost": "...", "original_finding_ids": [] }],
  "total_original": 0,
  "total_consolidated": 0
}`,
        userPrompt: `Consolidate these ${findings.length} findings:\n\n${JSON.stringify(findings.slice(0, 30), null, 2)}`,
        maxTokens: 4096,
      },
      context,
    });

    return output.result.content as ConsolidationResult | null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[report-agent] Consolidation failed:", message);
    return null;
  }
}

export async function generateExecutiveSummaryViaAgent(
  deal: Record<string, unknown>,
  consolidatedFindings: ConsolidatedFinding[],
  pillars: Record<string, unknown>[],
  techStack: Record<string, unknown>[],
  comparisons: Record<string, unknown>[],
  phases: Record<string, unknown>[],
): Promise<ExecutiveSummary | null> {
  if (!agent.hasAI()) return null;

  try {
    const context = createMeridianContext("system", "system", {
      agentId: "report-generator",
      agentName: "Executive Summary Generator",
    });

    const pillarSummary = pillars.map((p: Record<string, unknown>) =>
      `${p.name}: ${p.score}/5.0 (${p.evidenceConfidence || "unknown"} confidence)`
    ).join("\n");
    const findingSummary = consolidatedFindings.slice(0, 10).map(f =>
      `[${f.severity.toUpperCase()}] ${f.title}`
    ).join("\n");
    const gapCount = comparisons.filter((c: Record<string, unknown>) =>
      c.gapSeverity === "critical" || c.gapSeverity === "high"
    ).length;

    const output = await agent.runWithAudit({
      data: {
        taskType: "executive_summary",
        systemPrompt: `You are a senior IT due diligence advisor writing an executive summary for an investment committee.

Respond with JSON only:
{
  "investment_verdict": "PROCEED|PROCEED WITH CONDITIONS|CAUTION|DO NOT PROCEED",
  "verdict_reasoning": "2-3 sentence justification",
  "key_risk_findings": ["finding 1", ...up to 7],
  "conditions_before_close": ["condition 1", "condition 2", "condition 3"],
  "positive_observations": ["observation 1", "observation 2"],
  "estimated_total_cost": "$X-Y range",
  "estimated_timeline": "X-Y months",
  "overall_risk_level": "Low|Medium|High|Critical"
}`,
        userPrompt: `Deal: ${deal.targetName} (${deal.industry})
Stage: ${deal.stage}
Facilities: ${deal.facilityCount || 0}, Users: ${deal.userCount || 0}

Pillar Scores:
${pillarSummary}

Key Findings (${consolidatedFindings.length} total):
${findingSummary}

Tech Stack: ${techStack.length} items detected
Baseline Gaps: ${gapCount} critical/high gaps
Integration Phases: ${phases.length} planned`,
        maxTokens: 2048,
      },
      context,
    });

    return output.result.content as ExecutiveSummary | null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[report-agent] Executive summary failed:", message);
    return null;
  }
}

export async function generatePillarNarrativeViaAgent(
  pillar: Record<string, unknown>,
  findings: Record<string, unknown>[],
  techStack: Record<string, unknown>[],
): Promise<PillarNarrative | null> {
  if (!agent.hasAI()) return null;

  try {
    const context = createMeridianContext("system", "system", {
      agentId: "report-generator",
      agentName: "Pillar Narrative Generator",
    });

    const pillarFindings = findings.filter((f: Record<string, unknown>) => f.pillar === pillar.name);
    const findingSummary = pillarFindings.slice(0, 8).map((f: Record<string, unknown>) =>
      `[${String(f.severity || "").toUpperCase()}] ${f.title}: ${String(f.description || "").slice(0, 200)}`
    ).join("\n");

    const output = await agent.runWithAudit({
      data: {
        taskType: "pillar_narrative",
        systemPrompt: `You are an IT due diligence analyst writing a pillar assessment narrative.

Respond with JSON only:
{
  "summary": "2-3 paragraph narrative assessment",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`,
        userPrompt: `Pillar: ${pillar.name}
Score: ${pillar.score}/5.0
Weight: ${pillar.weight}
Evidence Confidence: ${pillar.evidenceConfidence || "unknown"}

Findings (${pillarFindings.length}):
${findingSummary || "No findings recorded"}`,
        maxTokens: 1500,
      },
      context,
    });

    return output.result.content as PillarNarrative | null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[report-agent] Pillar narrative failed:", message);
    return null;
  }
}

export async function generateRecommendationsViaAgent(
  deal: Record<string, unknown>,
  findings: Record<string, unknown>[],
  pillars: Record<string, unknown>[],
  techStack: Record<string, unknown>[],
  comparisons: Record<string, unknown>[],
): Promise<string[] | null> {
  if (!agent.hasAI()) return null;

  try {
    const context = createMeridianContext("system", "system", {
      agentId: "report-generator",
      agentName: "Recommendations Generator",
    });

    const criticalFindings = findings
      .filter((f: Record<string, unknown>) => f.severity === "critical" || f.severity === "high")
      .slice(0, 5);
    const lowPillars = pillars
      .filter((p: Record<string, unknown>) => parseFloat(String(p.score)) < 3.0)
      .map((p: Record<string, unknown>) => p.name);
    const criticalGaps = comparisons
      .filter((c: Record<string, unknown>) => c.gapSeverity === "critical")
      .slice(0, 3);

    const output = await agent.runWithAudit({
      data: {
        taskType: "recommendations",
        systemPrompt: `You are a senior IT due diligence advisor providing actionable recommendations for an M&A deal.

Provide 5-8 prioritized recommendations.

Respond with JSON only:
{ "recommendations": ["recommendation 1", "recommendation 2", ...] }`,
        userPrompt: `Deal: ${deal.targetName}
Critical/High Findings: ${criticalFindings.map((f: Record<string, unknown>) => f.title).join(", ") || "None"}
Low-scoring Pillars: ${lowPillars.join(", ") || "None"}
Critical Baseline Gaps: ${criticalGaps.map((g: Record<string, unknown>) => g.category).join(", ") || "None"}
Tech Stack Size: ${techStack.length} items`,
        maxTokens: 1500,
      },
      context,
    });

    const content = output.result.content as Record<string, unknown> | null;
    return (content?.recommendations as string[]) ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[report-agent] Recommendations failed:", message);
    return null;
  }
}
