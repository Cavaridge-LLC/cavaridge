/**
 * Cost Analyzer Agent — Layer 2 Functional Agent
 *
 * ROI, TCO, license math, labor estimates with LLM-powered cost narratives.
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

export interface CostAnalyzerInput {
  /** System prompt defining cost analysis framework */
  systemPrompt: string;
  /** User prompt with deal/project context */
  userPrompt: string;
  /** Max tokens for response */
  maxTokens?: number;
}

export interface CostEstimate {
  category: string;
  description: string;
  lowEstimate: number;
  highEstimate: number;
  confidence: string;
  timeframe?: string;
}

export interface CostAnalyzerOutput {
  /** Individual cost estimates */
  estimates: CostEstimate[];
  /** Total cost range */
  totalRange: { low: number; high: number };
  /** AI narrative explaining the cost analysis */
  narrative: string;
  /** Raw response for debugging */
  rawResponse: string;
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "cost-analyzer",
  agentName: "Cost Analyzer Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

export class CostAnalyzerAgent extends BaseAgent<CostAnalyzerInput, CostAnalyzerOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: CostAnalyzerInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.systemPrompt) errors.push("systemPrompt is required");
    if (!data.userPrompt) errors.push("userPrompt is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "analyze_costs",
      description: "Analyze costs with ROI/TCO calculations and labor estimates",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as CostAnalyzerInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<CostAnalyzerInput>): Promise<AgentOutput<CostAnalyzerOutput>> {
    const { data, context } = input;
    const empty: CostAnalyzerOutput = {
      estimates: [],
      totalRange: { low: 0, high: 0 },
      narrative: "Cost analysis unavailable",
      rawResponse: "",
    };

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const response = await this.callLlm(
      context,
      "analysis",
      data.systemPrompt,
      [{ role: "user", content: data.userPrompt }],
      { maxTokens: data.maxTokens ?? 2048, temperature: 0.5 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: { ...empty, rawResponse: response.content }, metadata: this.emptyMetadata() };

      const parsed = JSON.parse(jsonMatch[0]);
      const estimates: CostEstimate[] = Array.isArray(parsed.estimates)
        ? parsed.estimates.map((e: Record<string, unknown>) => ({
            category: String(e.category || ""),
            description: String(e.description || ""),
            lowEstimate: Number(e.lowEstimate || e.low_estimate || 0),
            highEstimate: Number(e.highEstimate || e.high_estimate || 0),
            confidence: String(e.confidence || "medium"),
            timeframe: e.timeframe ? String(e.timeframe) : undefined,
          }))
        : [];

      const totalLow = estimates.reduce((sum, e) => sum + e.lowEstimate, 0);
      const totalHigh = estimates.reduce((sum, e) => sum + e.highEstimate, 0);

      return {
        result: {
          estimates,
          totalRange: { low: totalLow, high: totalHigh },
          narrative: parsed.narrative || parsed.summary || "",
          rawResponse: response.content,
        },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return { result: { ...empty, rawResponse: response.content }, metadata: this.emptyMetadata() };
    }
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
