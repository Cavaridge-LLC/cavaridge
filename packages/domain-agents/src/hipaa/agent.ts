/**
 * HIPAA Compliance Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for 45 CFR Parts 160 and 164.
 * Provides regulatory guidance — never stores or returns actual PHI.
 * Never provides legal advice.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface HipaaKnowledgeInput {
  query: string;
  controlRef?: string;
  context: "security_rule" | "privacy_rule" | "breach_notification";
  currentState?: string;
  findingDetail?: string;
}

export interface HipaaKnowledgeOutput {
  guidance: string;
  relevantControls: Array<{ ref: string; title: string; requirement: string }>;
  citations: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "hipaa-compliance",
  agentName: "HIPAA Compliance Agent",
  appCode: "CVG-HIPAA",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a HIPAA compliance knowledge expert. Your role is to provide guidance based ONLY on 45 CFR Parts 160 and 164 (HIPAA Administrative Simplification).

CRITICAL RULES:
- You ONLY provide guidance based on 45 CFR Parts 160 and 164
- You NEVER provide legal advice — always recommend consulting qualified legal counsel
- You NEVER store, process, or return actual Protected Health Information (PHI)
- You cite specific regulatory sections (e.g., §164.308(a)(1)(ii)(A))
- You distinguish between Required (R) and Addressable (A) implementation specifications
- For Addressable specifications, explain the assess-and-implement-or-document-why-not requirement

When analyzing a control:
1. Explain what the regulation requires
2. Describe what "fully implemented" looks like in practice
3. Identify common gaps organizations face
4. Suggest evidence that would demonstrate compliance
5. Recommend concrete next steps for remediation

Respond in JSON format:
{
  "guidance": "Detailed guidance text",
  "relevantControls": [{"ref": "§...", "title": "...", "requirement": "..."}],
  "citations": ["45 CFR §..."],
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class HipaaComplianceAgent extends BaseAgent<HipaaKnowledgeInput, HipaaKnowledgeOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: HipaaKnowledgeInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    if (!data.context) errors.push("context is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "hipaa_guidance",
      description: "Get HIPAA regulatory guidance for a specific control or question",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as HipaaKnowledgeInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<HipaaKnowledgeInput>): Promise<AgentOutput<HipaaKnowledgeOutput>> {
    const { data, context } = input;
    const empty: HipaaKnowledgeOutput = {
      guidance: "HIPAA guidance unavailable. Please consult a qualified compliance professional.",
      relevantControls: [],
      citations: [],
      recommendations: [],
    };

    // Security scan
    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Please remove any PHI before requesting guidance.",
          relevantControls: [],
          citations: [],
          recommendations: ["Remove any PHI from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      `Control Reference: ${data.controlRef || "General"}`,
      `Context: ${data.context}`,
      `Current State: ${data.currentState || "Unknown"}`,
      data.findingDetail ? `Finding Detail: ${data.findingDetail}` : "",
      `Question: ${data.query}`,
    ].filter(Boolean).join("\n");

    const response = await this.callLlm(
      context,
      "analysis",
      SYSTEM_PROMPT,
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
          relevantControls: Array.isArray(parsed.relevantControls) ? parsed.relevantControls : [],
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
