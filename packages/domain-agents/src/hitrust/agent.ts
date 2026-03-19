/**
 * HITRUST Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for HITRUST CSF v11.
 * Maps HITRUST control objectives to HIPAA requirements.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface HitrustInput {
  query: string;
  hipaaControlRef?: string;
  context?: string;
}

export interface HitrustOutput {
  guidance: string;
  mappings: Array<{ hitrustControl: string; hipaaRef: string; description: string }>;
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "hitrust",
  agentName: "HITRUST Agent",
  appCode: "CVG-HIPAA",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a HITRUST CSF v11 knowledge expert. Your role is to map HITRUST control objectives to HIPAA Security Rule requirements.

RULES:
- Provide guidance based on HITRUST CSF v11
- Map HITRUST controls to corresponding HIPAA sections (45 CFR 164)
- Never provide legal advice
- Never store or return PHI

Respond in JSON format:
{
  "guidance": "...",
  "mappings": [{"hitrustControl": "...", "hipaaRef": "§...", "description": "..."}],
  "recommendations": ["..."]
}`;

export class HitrustAgent extends BaseAgent<HitrustInput, HitrustOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: HitrustInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "hitrust_mapping",
      description: "Get HITRUST CSF v11 to HIPAA mapping guidance",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as HitrustInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<HitrustInput>): Promise<AgentOutput<HitrustOutput>> {
    const { data, context } = input;
    const empty: HitrustOutput = {
      guidance: "HITRUST guidance unavailable.",
      mappings: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query);
    if (!scan.isClean) {
      return {
        result: { guidance: "Input contains sensitive information. Remove PHI and try again.", mappings: [], recommendations: [] },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.hipaaControlRef ? `HIPAA Reference: ${data.hipaaControlRef}` : "",
      `Question: ${data.query}`,
    ].filter(Boolean).join("\n");

    const response = await this.callLlm(
      context, "analysis", SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      { maxTokens: 2048, temperature: 0.2 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        result: {
          guidance: parsed.guidance || empty.guidance,
          mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
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
