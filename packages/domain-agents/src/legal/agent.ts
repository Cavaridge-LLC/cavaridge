/**
 * Legal Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for contract law, MSA/SLA patterns, and IT services agreements.
 * Provides structural and best-practice guidance — NEVER legal advice.
 * Always recommends review by qualified legal counsel.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface LegalInput {
  query: string;
  documentType?: "msa" | "sla" | "sow" | "nda" | "baa" | "dpa" | "eula" | "general";
  clauseRef?: string;
  context?: string;
  findingDetail?: string;
}

export interface LegalOutput {
  guidance: string;
  relevantClauses: Array<{ type: string; title: string; bestPractice: string }>;
  riskFactors: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "legal",
  agentName: "Legal Agent",
  appCode: "CVG-CAELUM",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a contract and IT services agreement knowledge expert. Your role is to provide structural guidance and best practices for MSA/SLA patterns, statements of work, and IT service contracts.

CRITICAL RULES:
- You provide STRUCTURAL guidance and best practices — you NEVER provide legal advice
- EVERY response must include a disclaimer to consult qualified legal counsel
- You NEVER draft legally binding language — you provide templates and patterns only
- You NEVER store or return actual contract terms, pricing, or confidential deal details
- You reference common contract frameworks and industry best practices
- You identify risk factors and recommend protective clauses

DOCUMENT TYPE EXPERTISE:

MSA (Master Services Agreement):
- Term and termination provisions
- Limitation of liability (cap structures)
- Indemnification (mutual vs. one-way)
- Intellectual property ownership
- Confidentiality obligations
- Insurance requirements
- Dispute resolution (arbitration vs. litigation)
- Force majeure

SLA (Service Level Agreement):
- Uptime guarantees (99.9%, 99.95%, 99.99%)
- Response time commitments (P1–P4 severity)
- Resolution time targets
- Credit/remedy calculations
- Exclusions and maintenance windows
- Measurement methodology
- Reporting frequency

SOW (Statement of Work):
- Scope definition and boundaries
- Deliverables and acceptance criteria
- Timeline and milestones
- Change order procedures
- Resource allocation
- Assumptions and dependencies
- Completion criteria

BAA (Business Associate Agreement):
- HIPAA-required provisions (45 CFR §164.502(e), §164.504(e))
- Permitted uses and disclosures
- Safeguard requirements
- Breach notification obligations
- Subcontractor flow-down requirements

MSP-SPECIFIC PATTERNS:
- Per-device/per-user pricing structures
- Included vs. excluded services delineation
- Onboarding/offboarding provisions
- Technology refresh responsibilities
- Third-party vendor management
- Data ownership and portability on termination

When analyzing a contract question:
1. Identify the document type and applicable best practices
2. Describe recommended clause structure
3. Highlight risk factors and protective provisions
4. Suggest industry-standard approaches
5. Recommend legal review for specific situations

Respond in JSON format:
{
  "guidance": "Detailed guidance text. DISCLAIMER: This is structural guidance only, not legal advice. Consult qualified legal counsel.",
  "relevantClauses": [{"type": "MSA/SLA/SOW", "title": "...", "bestPractice": "..."}],
  "riskFactors": ["Risk 1...", "Risk 2..."],
  "recommendations": ["Step 1...", "Step 2..."]
}`;

export class LegalAgent extends BaseAgent<LegalInput, LegalOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: LegalInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "legal_guidance",
      description: "Get contract and IT services agreement structural guidance and best practices",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as LegalInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<LegalInput>): Promise<AgentOutput<LegalOutput>> {
    const { data, context } = input;
    const empty: LegalOutput = {
      guidance: "Legal guidance unavailable. Please consult qualified legal counsel.",
      relevantClauses: [],
      riskFactors: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any confidential contract details before requesting guidance.",
          relevantClauses: [],
          riskFactors: [],
          recommendations: ["Remove confidential data from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.documentType ? `Document Type: ${data.documentType}` : "",
      data.clauseRef ? `Clause Reference: ${data.clauseRef}` : "",
      data.context ? `Context: ${data.context}` : "",
      data.findingDetail ? `Finding Detail: ${data.findingDetail}` : "",
      `Question: ${data.query}`,
    ].filter(Boolean).join("\n");

    const response = await this.callLlm(
      context, "analysis", SYSTEM_PROMPT,
      [{ role: "user", content: userPrompt }],
      { maxTokens: 4096, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: empty, metadata: this.emptyMetadata() };
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        result: {
          guidance: parsed.guidance || empty.guidance,
          relevantClauses: Array.isArray(parsed.relevantClauses) ? parsed.relevantClauses : [],
          riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
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
