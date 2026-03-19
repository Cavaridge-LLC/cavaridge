/**
 * SOC 2 Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for AICPA Trust Services Criteria (TSC) 2017.
 * Provides guidance on SOC 2 Type I and Type II audits.
 * Never provides legal or audit opinion advice.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface Soc2Input {
  query: string;
  criteriaRef?: string;
  context?: "security" | "availability" | "processing_integrity" | "confidentiality" | "privacy" | "general";
  currentState?: string;
  findingDetail?: string;
}

export interface Soc2Output {
  guidance: string;
  relevantCriteria: Array<{ ref: string; category: string; criteria: string }>;
  citations: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "soc2",
  agentName: "SOC 2 Agent",
  appCode: "CVG-AEGIS",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a SOC 2 knowledge expert. Your role is to provide guidance based ONLY on the AICPA Trust Services Criteria (TSC) 2017 framework.

CRITICAL RULES:
- You ONLY provide guidance based on AICPA TSC 2017 (SOC 2 framework)
- You NEVER provide audit opinions or legal advice — always recommend engaging a licensed CPA firm
- You NEVER store or return actual client confidential data
- You cite specific Trust Services Criteria (e.g., CC6.1, CC7.2, A1.2)
- You distinguish between SOC 2 Type I (design) and Type II (operating effectiveness)
- You reference the five Trust Services Categories when applicable

TRUST SERVICES CATEGORIES:
1. Security (Common Criteria CC1–CC9) — Required for all SOC 2 reports
2. Availability (A1) — System uptime and recovery
3. Processing Integrity (PI1) — Accurate, complete, timely processing
4. Confidentiality (C1) — Protection of confidential information
5. Privacy (P1–P8) — Personal information handling (GAPP-based)

COMMON CRITERIA SERIES:
CC1: Control Environment (COSO)
CC2: Communication and Information
CC3: Risk Assessment
CC4: Monitoring Activities
CC5: Control Activities
CC6: Logical and Physical Access Controls
CC7: System Operations
CC8: Change Management
CC9: Risk Mitigation

When analyzing a criterion:
1. Explain what the criterion requires
2. Describe what adequate controls look like
3. Identify common control gaps
4. Suggest evidence for Type II testing
5. Recommend remediation steps

Respond in JSON format:
{
  "guidance": "Detailed guidance text",
  "relevantCriteria": [{"ref": "CCX.Y", "category": "...", "criteria": "..."}],
  "citations": ["TSC 2017 CCX.Y"],
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class Soc2Agent extends BaseAgent<Soc2Input, Soc2Output> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: Soc2Input): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "soc2_guidance",
      description: "Get SOC 2 Trust Services Criteria guidance for a specific criterion or question",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as Soc2Input,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<Soc2Input>): Promise<AgentOutput<Soc2Output>> {
    const { data, context } = input;
    const empty: Soc2Output = {
      guidance: "SOC 2 guidance unavailable. Please consult a licensed CPA firm.",
      relevantCriteria: [],
      citations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any confidential data before requesting guidance.",
          relevantCriteria: [],
          citations: [],
          recommendations: ["Remove sensitive data from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.criteriaRef ? `Criteria Reference: ${data.criteriaRef}` : "",
      data.context ? `Category: ${data.context}` : "",
      data.currentState ? `Current State: ${data.currentState}` : "",
      data.findingDetail ? `Finding Detail: ${data.findingDetail}` : "",
      `Question: ${data.query}`,
    ].filter(Boolean).join("\n");

    const response = await this.callLlm(
      context, "analysis", SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      { maxTokens: 4096, temperature: 0.2 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        result: {
          guidance: parsed.guidance || empty.guidance,
          relevantCriteria: Array.isArray(parsed.relevantCriteria) ? parsed.relevantCriteria : [],
          citations: Array.isArray(parsed.citations) ? parsed.citations : [],
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
