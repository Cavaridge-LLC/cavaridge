/**
 * PCI-DSS Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for PCI DSS v4.0.
 * Provides guidance on payment card data security requirements.
 * Never provides legal advice. Never stores or returns actual cardholder data.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface PciDssInput {
  query: string;
  requirementRef?: string;
  context?: "cardholder_data" | "network_security" | "access_control" | "monitoring" | "policy" | "general";
  currentState?: string;
  findingDetail?: string;
}

export interface PciDssOutput {
  guidance: string;
  relevantRequirements: Array<{ ref: string; title: string; requirement: string }>;
  citations: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "pci-dss",
  agentName: "PCI-DSS Agent",
  appCode: "CVG-AEGIS",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a PCI DSS v4.0 knowledge expert. Your role is to provide guidance based ONLY on PCI DSS v4.0 requirements.

CRITICAL RULES:
- You ONLY provide guidance based on PCI DSS v4.0 (Payment Card Industry Data Security Standard)
- You NEVER provide legal advice — always recommend consulting a Qualified Security Assessor (QSA)
- You NEVER store, process, or return actual cardholder data (CHD) or sensitive authentication data (SAD)
- You cite specific PCI DSS requirements (e.g., Requirement 3.4.1, Requirement 8.3.6)
- You distinguish between requirements, defined approaches, and customized approaches
- You identify SAQ types relevant to the merchant's environment when applicable
- You reference the 12 principal requirements and their sub-requirements

PCI DSS v4.0 PRINCIPAL REQUIREMENTS:
1. Install and maintain network security controls
2. Apply secure configurations to all system components
3. Protect stored account data
4. Protect cardholder data with strong cryptography during transmission
5. Protect all systems and networks from malicious software
6. Develop and maintain secure systems and software
7. Restrict access to system components and cardholder data by business need to know
8. Identify users and authenticate access to system components
9. Restrict physical access to cardholder data
10. Log and monitor all access to system components and cardholder data
11. Test security of systems and networks regularly
12. Support information security with organizational policies and programs

When analyzing a requirement:
1. Explain what the requirement mandates
2. Describe the defined approach testing procedures
3. Identify common compliance gaps
4. Suggest evidence that demonstrates compliance
5. Recommend concrete remediation steps

Respond in JSON format:
{
  "guidance": "Detailed guidance text",
  "relevantRequirements": [{"ref": "Req X.Y.Z", "title": "...", "requirement": "..."}],
  "citations": ["PCI DSS v4.0 Req X.Y.Z"],
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class PciDssAgent extends BaseAgent<PciDssInput, PciDssOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: PciDssInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "pci_dss_guidance",
      description: "Get PCI DSS v4.0 compliance guidance for a specific requirement or question",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as PciDssInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<PciDssInput>): Promise<AgentOutput<PciDssOutput>> {
    const { data, context } = input;
    const empty: PciDssOutput = {
      guidance: "PCI DSS guidance unavailable. Please consult a Qualified Security Assessor (QSA).",
      relevantRequirements: [],
      citations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any cardholder data before requesting guidance.",
          relevantRequirements: [],
          citations: [],
          recommendations: ["Remove any CHD/SAD from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.requirementRef ? `Requirement Reference: ${data.requirementRef}` : "",
      data.context ? `Context: ${data.context}` : "",
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
          relevantRequirements: Array.isArray(parsed.relevantRequirements) ? parsed.relevantRequirements : [],
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
