/**
 * SecurityAdvisor Product Agent — Layer 3
 *
 * Composes gap prioritization, what-if analysis, trend narrative,
 * QBR talking points, and executive summary for the Midas platform.
 *
 * All LLM calls route through BaseAgent.callLlm() → Spaniel → OpenRouter.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

import type {
  SecurityAdvisorInput,
  SecurityAdvisorOutput,
  PrioritizedGap,
  WhatIfScenario,
} from "@shared/types/security-scoring";

import { calculateWhatIfScore } from "../../modules/security-scoring/adjusted-score";

import {
  GAP_PRIORITIZATION_SYSTEM,
  WHAT_IF_NARRATIVE_SYSTEM,
  TREND_NARRATIVE_SYSTEM,
  TALKING_POINTS_SYSTEM,
  EXECUTIVE_SUMMARY_SYSTEM,
} from "./prompts";

// ── Agent Config ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "midas-security-advisor",
  agentName: "SecurityAdvisor",
  appCode: "CVG-MIDAS",
  version: "1.0.0",
};

// ── Agent Implementation ─────────────────────────────────────────────

export class SecurityAdvisorAgent extends BaseAgent<SecurityAdvisorInput, SecurityAdvisorOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: SecurityAdvisorInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.tenantId) errors.push("tenantId is required");
    if (!data.clientId) errors.push("clientId is required");
    if (!data.scoreReport) errors.push("scoreReport is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [
      {
        name: "analyze_security_posture",
        description: "Analyze security posture with gap prioritization, what-if scenarios, and QBR talking points",
        execute: async (params, ctx) => {
          const output = await this.execute({
            data: params as unknown as SecurityAdvisorInput,
            context: ctx,
          });
          return output.result;
        },
      },
    ];
  }

  async execute(input: AgentInput<SecurityAdvisorInput>): Promise<AgentOutput<SecurityAdvisorOutput>> {
    const { data, context } = input;
    const { scoreReport, clientContext, focus } = data;

    // Filter gaps by focus categories if specified
    const relevantGaps = focus
      ? scoreReport.realGaps.filter((g) => focus.includes(g.category))
      : scoreReport.realGaps;

    // Scan inputs for security
    if (clientContext) {
      await this.scanInput(clientContext);
    }

    // ── Step 1-3: Parallel LLM calls ─────────────────────────────

    const [prioritizedGaps, whatIfScenarios, qoqNarrative] = await Promise.all([
      this.prioritizeGaps(context, relevantGaps, clientContext),
      this.generateWhatIfScenarios(context, scoreReport, relevantGaps),
      this.generateTrendNarrative(context, scoreReport),
    ]);

    // ── Step 4-5: Sequential (depends on 1-3 output) ─────────────

    const talkingPoints = await this.generateTalkingPoints(
      context,
      scoreReport,
      prioritizedGaps,
      whatIfScenarios,
    );

    const executiveSummary = await this.generateExecutiveSummary(
      context,
      scoreReport,
      prioritizedGaps,
      qoqNarrative,
    );

    return {
      result: {
        executiveSummary,
        prioritizedGaps,
        whatIfScenarios,
        quarterOverQuarterNarrative: qoqNarrative,
        talkingPoints,
      },
      metadata: this.emptyMetadata(),
    };
  }

  // ── Step 1: Gap Prioritization ─────────────────────────────────────

  private async prioritizeGaps(
    context: AgentInput<SecurityAdvisorInput>["context"],
    gaps: SecurityAdvisorInput["scoreReport"]["realGaps"],
    clientContext?: string,
  ): Promise<PrioritizedGap[]> {
    if (gaps.length === 0) return [];
    if (!this.hasAI()) return gaps.map((g, i) => ({ ...g, rank: i + 1, reasoning: "Ranked by points at stake", estimatedCostLow: 0, estimatedCostHigh: 0, estimatedTimeframe: "TBD" }));

    const userPrompt = `Analyze and prioritize these ${gaps.length} security gaps:\n\n${gaps.map((g) => `- ${g.controlName} (${g.category}): ${g.pointsAtStake} points at stake. Vendor says: "${g.vendorRecommendation}". Effort: ${g.estimatedEffort}`).join("\n")}${clientContext ? `\n\nClient context: ${clientContext}` : ""}`;

    try {
      const response = await this.callLlm(
        context,
        "analysis",
        GAP_PRIORITIZATION_SYSTEM,
        [{ role: "user", content: userPrompt }],
        { maxTokens: 2048, temperature: 0.3 },
      );

      const parsed = parseJson<{ prioritizedGaps: Array<{ controlId: string; rank: number; reasoning: string; estimatedCostLow: number; estimatedCostHigh: number; estimatedTimeframe: string }> }>(response.content);

      if (!parsed?.prioritizedGaps) return gaps.map((g, i) => ({ ...g, rank: i + 1, reasoning: "Unable to generate AI prioritization", estimatedCostLow: 0, estimatedCostHigh: 0, estimatedTimeframe: "TBD" }));

      return gaps.map((gap) => {
        const aiGap = parsed.prioritizedGaps.find((p) => p.controlId === gap.controlId);
        return {
          ...gap,
          rank: aiGap?.rank ?? gap.roadmapPriority,
          reasoning: aiGap?.reasoning ?? "Ranked by points at stake",
          estimatedCostLow: aiGap?.estimatedCostLow ?? 0,
          estimatedCostHigh: aiGap?.estimatedCostHigh ?? 0,
          estimatedTimeframe: aiGap?.estimatedTimeframe ?? "TBD",
        };
      }).sort((a, b) => a.rank - b.rank);
    } catch {
      return gaps.map((g, i) => ({ ...g, rank: i + 1, reasoning: "Ranked by points at stake", estimatedCostLow: 0, estimatedCostHigh: 0, estimatedTimeframe: "TBD" }));
    }
  }

  // ── Step 2: What-If Scenarios ──────────────────────────────────────

  private async generateWhatIfScenarios(
    context: AgentInput<SecurityAdvisorInput>["context"],
    report: SecurityAdvisorInput["scoreReport"],
    gaps: SecurityAdvisorInput["scoreReport"]["realGaps"],
  ): Promise<WhatIfScenario[]> {
    if (gaps.length === 0) return [];

    const scenarios: WhatIfScenario[] = [];

    // Scenario 1: Resolve top gap
    if (gaps.length >= 1) {
      const top1 = [gaps[0].controlId];
      const { projectedScore, scoreDelta } = calculateWhatIfScore(report, top1);
      scenarios.push({
        gapsResolved: top1,
        currentScore: report.adjustedScore,
        projectedScore,
        scoreDelta,
        narrative: "",
      });
    }

    // Scenario 2: Resolve top 3 gaps
    if (gaps.length >= 3) {
      const top3 = gaps.slice(0, 3).map((g) => g.controlId);
      const { projectedScore, scoreDelta } = calculateWhatIfScore(report, top3);
      scenarios.push({
        gapsResolved: top3,
        currentScore: report.adjustedScore,
        projectedScore,
        scoreDelta,
        narrative: "",
      });
    }

    // Scenario 3: Resolve all gaps
    if (gaps.length > 3) {
      const all = gaps.map((g) => g.controlId);
      const { projectedScore, scoreDelta } = calculateWhatIfScore(report, all);
      scenarios.push({
        gapsResolved: all,
        currentScore: report.adjustedScore,
        projectedScore,
        scoreDelta,
        narrative: "",
      });
    }

    // Generate narratives via LLM
    if (this.hasAI()) {
      for (const scenario of scenarios) {
        try {
          const gapNames = scenario.gapsResolved
            .map((id) => gaps.find((g) => g.controlId === id)?.controlName ?? id)
            .join(", ");

          const response = await this.callLlm(
            context,
            "generation",
            WHAT_IF_NARRATIVE_SYSTEM,
            [{
              role: "user",
              content: `If we resolve these gaps: ${gapNames}\nCurrent score: ${scenario.currentScore}\nProjected score: ${scenario.projectedScore}\nScore improvement: +${scenario.scoreDelta} points`,
            }],
            { maxTokens: 512, temperature: 0.5 },
          );

          const parsed = parseJson<{ narrative: string }>(response.content);
          scenario.narrative = parsed?.narrative ?? `Resolving ${scenario.gapsResolved.length} gap(s) would improve the score by ${scenario.scoreDelta} points.`;
        } catch {
          scenario.narrative = `Resolving ${scenario.gapsResolved.length} gap(s) would improve the score by ${scenario.scoreDelta} points.`;
        }
      }
    } else {
      for (const scenario of scenarios) {
        scenario.narrative = `Resolving ${scenario.gapsResolved.length} gap(s) would improve the score from ${scenario.currentScore} to ${scenario.projectedScore} (+${scenario.scoreDelta} points).`;
      }
    }

    return scenarios;
  }

  // ── Step 3: Trend Narrative ────────────────────────────────────────

  private async generateTrendNarrative(
    context: AgentInput<SecurityAdvisorInput>["context"],
    report: SecurityAdvisorInput["scoreReport"],
  ): Promise<string> {
    if (!report.trend || report.trend.dataPoints.length < 2) {
      return "Insufficient historical data for trend analysis. This is the first or second assessment for this client.";
    }

    if (!this.hasAI()) {
      return `Score trend is ${report.trend.trendDirection}. ${report.trend.significantChanges.join(". ")}`;
    }

    try {
      const response = await this.callLlm(
        context,
        "generation",
        TREND_NARRATIVE_SYSTEM,
        [{
          role: "user",
          content: `Trend direction: ${report.trend.trendDirection}\nData points: ${JSON.stringify(report.trend.dataPoints.slice(-6))}\nSignificant changes: ${report.trend.significantChanges.join("; ") || "None detected"}`,
        }],
        { maxTokens: 512, temperature: 0.5 },
      );

      const parsed = parseJson<{ narrative: string }>(response.content);
      return parsed?.narrative ?? `Score trend is ${report.trend.trendDirection}.`;
    } catch {
      return `Score trend is ${report.trend.trendDirection}. ${report.trend.significantChanges.join(". ")}`;
    }
  }

  // ── Step 4: Talking Points ─────────────────────────────────────────

  private async generateTalkingPoints(
    context: AgentInput<SecurityAdvisorInput>["context"],
    report: SecurityAdvisorInput["scoreReport"],
    prioritizedGaps: PrioritizedGap[],
    whatIfScenarios: WhatIfScenario[],
  ): Promise<string[]> {
    const defaultPoints = [
      `Your Cavaridge Adjusted Score is ${report.adjustedScore}/100 (Microsoft reports ${report.nativeScore}).`,
      `${report.compensatedControls.length} controls are covered by third-party security tools.`,
      `${report.realGaps.length} real gap${report.realGaps.length !== 1 ? "s" : ""} identified for remediation.`,
    ];

    if (!this.hasAI()) return defaultPoints;

    try {
      const response = await this.callLlm(
        context,
        "generation",
        TALKING_POINTS_SYSTEM,
        [{
          role: "user",
          content: `Adjusted Score: ${report.adjustedScore}/100 (native: ${report.nativeScore}, delta: +${report.scoreDelta})\nCompensated controls: ${report.compensatedControls.length}\nReal gaps: ${report.realGaps.length}\nTop gaps: ${prioritizedGaps.slice(0, 3).map((g) => `${g.controlName} (${g.category}, rank #${g.rank})`).join("; ")}\nBest what-if: ${whatIfScenarios.length > 0 ? `+${whatIfScenarios[whatIfScenarios.length - 1]?.scoreDelta ?? 0} points if all gaps resolved` : "N/A"}\nTrend: ${report.trend?.trendDirection ?? "first assessment"}`,
        }],
        { maxTokens: 1024, temperature: 0.5 },
      );

      const parsed = parseJson<{ talkingPoints: string[] }>(response.content);
      return parsed?.talkingPoints ?? defaultPoints;
    } catch {
      return defaultPoints;
    }
  }

  // ── Step 5: Executive Summary ──────────────────────────────────────

  private async generateExecutiveSummary(
    context: AgentInput<SecurityAdvisorInput>["context"],
    report: SecurityAdvisorInput["scoreReport"],
    prioritizedGaps: PrioritizedGap[],
    trendNarrative: string,
  ): Promise<string> {
    const fallback = `Your Cavaridge Adjusted Security Score is ${report.adjustedScore}/100, which accounts for ${report.compensatedControls.length} third-party security tools not reflected in Microsoft's native score of ${report.nativeScore}. ${report.realGaps.length > 0 ? `There are ${report.realGaps.length} real gaps requiring attention.` : "No unaddressed security gaps were identified."}`;

    if (!this.hasAI()) return fallback;

    try {
      const response = await this.callLlm(
        context,
        "generation",
        EXECUTIVE_SUMMARY_SYSTEM,
        [{
          role: "user",
          content: `Adjusted Score: ${report.adjustedScore}/100\nNative Score: ${report.nativeScore}/100\nDelta: +${report.scoreDelta}\nCompensated: ${report.compensatedControls.length} controls\nGaps: ${report.realGaps.length}\nTop gap: ${prioritizedGaps[0]?.controlName ?? "None"}\nTrend: ${trendNarrative}`,
        }],
        { maxTokens: 512, temperature: 0.5 },
      );

      const parsed = parseJson<{ executiveSummary: string }>(response.content);
      return parsed?.executiveSummary ?? fallback;
    } catch {
      return fallback;
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────

  private emptyMetadata(): AgentMetadata {
    return {
      requestId: crypto.randomUUID(),
      agentId: this.config.agentId,
      executionTimeMs: 0,
      tokensUsed: { input: 0, output: 0, total: 0 },
      costUsd: 0,
      modelsUsed: [],
    };
  }
}

function parseJson<T>(raw: string): T | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}
