/**
 * Risk Scorer Agent — Layer 2 Functional Agent
 *
 * Deterministic scoring with configurable weights, enhanced with
 * LLM-powered risk narrative generation.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

// ── Types ────────────────────────────────────────────────────────────

export interface RiskScorerInput {
  /** Findings to score */
  findings: Array<{
    title: string;
    severity: string;
    pillar?: string;
    description?: string;
  }>;
  /** Pillar weights (pillar name → weight 0-1) */
  weights: Record<string, number>;
  /** Optional system prompt for narrative generation */
  systemPrompt?: string;
  /** Whether to generate an LLM narrative (default: false) */
  generateNarrative?: boolean;
}

export interface ScoreBreakdown {
  pillar: string;
  score: number;
  weight: number;
  weightedScore: number;
  findingCount: number;
}

export interface RiskScorerOutput {
  /** Composite score 0-100 */
  compositeScore: number;
  /** Per-pillar breakdown */
  breakdown: ScoreBreakdown[];
  /** Risk level classification */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** AI-generated narrative (if generateNarrative=true) */
  narrative?: string;
}

// ── Scoring logic ────────────────────────────────────────────────────

const SEVERITY_IMPACT: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

function calculatePillarScore(findings: RiskScorerInput["findings"], pillar: string): number {
  const pillarFindings = findings.filter(f => f.pillar === pillar);
  if (pillarFindings.length === 0) return 100; // No findings = perfect score

  let deduction = 0;
  for (const f of pillarFindings) {
    deduction += SEVERITY_IMPACT[f.severity] ?? 5;
  }
  return Math.max(0, 100 - deduction);
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "risk-scorer",
  agentName: "Risk Scorer Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

export class RiskScorerAgent extends BaseAgent<RiskScorerInput, RiskScorerOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: RiskScorerInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.weights || Object.keys(data.weights).length === 0) errors.push("weights are required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "score_risk",
      description: "Calculate risk scores with configurable weights and optional AI narrative",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as RiskScorerInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<RiskScorerInput>): Promise<AgentOutput<RiskScorerOutput>> {
    const { data, context } = input;

    // Deterministic scoring (no LLM needed)
    const breakdown: ScoreBreakdown[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const [pillar, weight] of Object.entries(data.weights)) {
      const score = calculatePillarScore(data.findings, pillar);
      const weightedScore = score * weight;
      totalWeightedScore += weightedScore;
      totalWeight += weight;

      breakdown.push({
        pillar,
        score,
        weight,
        weightedScore,
        findingCount: data.findings.filter(f => f.pillar === pillar).length,
      });
    }

    const compositeScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
    const riskLevel = compositeScore >= 80 ? "low"
      : compositeScore >= 60 ? "medium"
      : compositeScore >= 40 ? "high"
      : "critical";

    let narrative: string | undefined;
    if (data.generateNarrative && this.hasAI() && data.systemPrompt) {
      try {
        const response = await this.callLlm(
          context,
          "analysis",
          data.systemPrompt,
          [{
            role: "user",
            content: `Score: ${compositeScore}/100 (${riskLevel} risk)\n\nBreakdown:\n${breakdown.map(b => `${b.pillar}: ${b.score}/100 (${b.findingCount} findings, weight: ${b.weight})`).join("\n")}\n\nFindings:\n${data.findings.slice(0, 15).map(f => `[${f.severity.toUpperCase()}] ${f.title}`).join("\n")}`,
          }],
          { maxTokens: 1000, temperature: 0.7 },
        );
        narrative = response.content;
      } catch {
        // Narrative is optional — scoring still succeeds
      }
    }

    return {
      result: { compositeScore, breakdown, riskLevel, narrative },
      metadata: this.emptyMetadata(),
    };
  }

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
