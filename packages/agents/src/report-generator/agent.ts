/**
 * Report Generator Agent — Layer 2 Functional Agent
 *
 * Generates AI narratives for reports: executive summaries, pillar narratives,
 * finding consolidation, and recommendations.
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

export type ReportTaskType =
  | "executive_summary"
  | "pillar_narrative"
  | "consolidation"
  | "recommendations";

export interface ReportGeneratorInput {
  /** What type of report content to generate */
  taskType: ReportTaskType;
  /** System prompt */
  systemPrompt: string;
  /** User prompt with context data */
  userPrompt: string;
  /** Max tokens for response */
  maxTokens?: number;
}

export interface ReportGeneratorOutput {
  /** Parsed JSON result (type depends on taskType) */
  content: unknown;
  /** Raw LLM response */
  rawResponse: string;
}

// ── Agent ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "report-generator",
  agentName: "Report Generator Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

export class ReportGeneratorAgent extends BaseAgent<ReportGeneratorInput, ReportGeneratorOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: ReportGeneratorInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.taskType) errors.push("taskType is required");
    if (!data.systemPrompt) errors.push("systemPrompt is required");
    if (!data.userPrompt) errors.push("userPrompt is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "generate_report_content",
      description: "Generate AI-written report content (summaries, narratives, recommendations)",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as ReportGeneratorInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<ReportGeneratorInput>): Promise<AgentOutput<ReportGeneratorOutput>> {
    const { data, context } = input;

    if (!this.hasAI()) {
      return {
        result: { content: null, rawResponse: "" },
        metadata: this.emptyMetadata(),
      };
    }

    const response = await this.callLlm(
      context,
      "generation",
      data.systemPrompt,
      [{ role: "user", content: data.userPrompt }],
      { maxTokens: data.maxTokens ?? 2048, temperature: 0.7 },
    );

    let content: unknown = null;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Return raw content if JSON parse fails
      content = response.content;
    }

    return {
      result: { content, rawResponse: response.content },
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
