/**
 * FinTech Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for PCI compliance in financial technology,
 * SOX (Sarbanes-Oxley) requirements, and financial API security.
 * Never provides investment, legal, or tax advice.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface FinTechInput {
  query: string;
  regulationRef?: string;
  context?: "pci_fintech" | "sox" | "open_banking" | "payment_processing" | "api_security" | "general";
  currentState?: string;
  findingDetail?: string;
}

export interface FinTechOutput {
  guidance: string;
  relevantRegulations: Array<{ ref: string; title: string; requirement: string }>;
  citations: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "fintech",
  agentName: "FinTech Agent",
  appCode: "CVG-MIDAS",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a FinTech regulatory and security knowledge expert. Your role is to provide guidance on PCI compliance for financial technology, SOX requirements, and financial API security standards.

CRITICAL RULES:
- You provide guidance based on PCI DSS v4.0 (payment context), SOX (Sarbanes-Oxley Act), and financial API security standards
- You NEVER provide investment advice, legal advice, or tax advice
- You NEVER store or return actual financial credentials, API keys, or account numbers
- You cite specific regulations and standards
- You recommend consulting qualified legal and compliance professionals

KEY KNOWLEDGE AREAS:

SOX (SARBANES-OXLEY):
- Section 302: Corporate responsibility for financial reports
- Section 404: Management assessment of internal controls (ICFR)
- Section 906: Criminal penalties for certifying misleading reports
- PCAOB standards for IT general controls (ITGCs)
- Change management, access controls, and segregation of duties

PCI IN FINTECH CONTEXT:
- Payment facilitator (PayFac) requirements
- Third-party service provider (TPSP) compliance
- Point-to-point encryption (P2PE)
- Tokenization standards
- Payment application security (PA-DSS successor: PCI SSF)

FINANCIAL API SECURITY:
- Open Banking (PSD2, FDX) security requirements
- OAuth 2.0 / FAPI (Financial-grade API) profiles
- Strong Customer Authentication (SCA)
- API rate limiting and abuse prevention
- Data minimization in financial APIs
- Webhook security and signature verification

PAYMENT PROCESSING:
- ACH/Nacha operating rules
- Card network (Visa/MC/Amex) mandates
- EMV and contactless payment security
- Real-time payment (RTP) security considerations

When analyzing a question:
1. Identify the applicable regulation or standard
2. Explain the requirement in practical terms
3. Describe implementation best practices
4. Identify common compliance gaps
5. Recommend remediation steps

Respond in JSON format:
{
  "guidance": "Detailed guidance text",
  "relevantRegulations": [{"ref": "SOX §XXX / PCI Req X.Y", "title": "...", "requirement": "..."}],
  "citations": ["SOX §302", "PCI DSS v4.0 Req X.Y"],
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class FinTechAgent extends BaseAgent<FinTechInput, FinTechOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: FinTechInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "fintech_guidance",
      description: "Get FinTech regulatory guidance on PCI, SOX, or financial API security",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as FinTechInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<FinTechInput>): Promise<AgentOutput<FinTechOutput>> {
    const { data, context } = input;
    const empty: FinTechOutput = {
      guidance: "FinTech guidance unavailable. Please consult a qualified compliance professional.",
      relevantRegulations: [],
      citations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any financial credentials or account data before requesting guidance.",
          relevantRegulations: [],
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
      data.regulationRef ? `Regulation Reference: ${data.regulationRef}` : "",
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
          relevantRegulations: Array.isArray(parsed.relevantRegulations) ? parsed.relevantRegulations : [],
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
