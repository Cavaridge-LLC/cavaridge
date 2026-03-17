/**
 * Compliance Checker Agent — Layer 2 Functional Agent
 *
 * Evaluates current state against standards/baselines and identifies gaps.
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

export interface ComplianceCheckInput {
  /** The standard or baseline to check against */
  standardName: string;
  /** Current state data (tech stack, configs, etc.) */
  currentState: Record<string, unknown>[];
  /** Findings from risk assessment */
  findings?: Record<string, unknown>[];
  /** System prompt defining the compliance framework */
  systemPrompt: string;
  /** User prompt with context */
  userPrompt: string;
}

export interface ComplianceGap {
  category: string;
  currentState: string;
  expectedState: string;
  gapSeverity: string;
  remediationNotes: string;
  estimatedEffort?: string;
}

export interface ComplianceCheckOutput {
  gaps: ComplianceGap[];
  summary: string;
  overallCompliance: number;
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "compliance-checker",
  agentName: "Compliance Checker Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

export class ComplianceCheckerAgent extends BaseAgent<ComplianceCheckInput, ComplianceCheckOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: ComplianceCheckInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.standardName) errors.push("standardName is required");
    if (!data.currentState || data.currentState.length === 0) errors.push("currentState is required");
    if (!data.systemPrompt) errors.push("systemPrompt is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "check_compliance",
      description: "Check compliance against a standard or baseline",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as ComplianceCheckInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<ComplianceCheckInput>): Promise<AgentOutput<ComplianceCheckOutput>> {
    const { data, context } = input;
    const empty: ComplianceCheckOutput = { gaps: [], summary: "Compliance check unavailable", overallCompliance: 0 };

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const response = await this.callLlm(
      context,
      "analysis",
      data.systemPrompt,
      [{ role: "user", content: data.userPrompt }],
      { maxTokens: 4096, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };

      const parsed = JSON.parse(jsonMatch[0]);
      const gaps: ComplianceGap[] = Array.isArray(parsed.gaps)
        ? parsed.gaps.map((g: Record<string, string>) => ({
            category: g.category || "Unknown",
            currentState: g.currentState || g.current_state || "",
            expectedState: g.expectedState || g.expected_state || "",
            gapSeverity: g.gapSeverity || g.gap_severity || "medium",
            remediationNotes: g.remediationNotes || g.remediation_notes || "",
            estimatedEffort: g.estimatedEffort || g.estimated_effort,
          }))
        : [];

      return {
        result: {
          gaps,
          summary: parsed.summary || `Found ${gaps.length} compliance gaps`,
          overallCompliance: typeof parsed.overallCompliance === "number" ? parsed.overallCompliance : 0,
        },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return { result: empty, metadata: this.emptyMetadata() };
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
