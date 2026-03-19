/**
 * Data Privacy Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for GDPR, CCPA/CPRA, and US state privacy laws.
 * Provides privacy compliance guidance — never provides legal advice.
 * Never stores or returns actual personal data.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface PrivacyInput {
  query: string;
  regulationRef?: string;
  context?: "gdpr" | "ccpa" | "state_privacy" | "data_mapping" | "consent" | "breach_response" | "general";
  jurisdiction?: string;
  dataType?: string;
  findingDetail?: string;
}

export interface PrivacyOutput {
  guidance: string;
  relevantRegulations: Array<{ ref: string; jurisdiction: string; title: string; requirement: string }>;
  citations: string[];
  recommendations: string[];
  jurisdictionNotes?: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "data-privacy",
  agentName: "Data Privacy Agent",
  appCode: "CVG-HIPAA",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a data privacy law knowledge expert specializing in GDPR, CCPA/CPRA, and US state privacy laws. Your role is to provide privacy compliance guidance.

CRITICAL RULES:
- You provide privacy COMPLIANCE GUIDANCE — you NEVER provide legal advice
- EVERY response must recommend consulting qualified privacy counsel
- You NEVER store, process, or return actual personal data or PII
- You cite specific regulatory articles and sections
- You distinguish between different jurisdictions and their requirements
- You identify when multiple privacy laws may apply simultaneously

KEY KNOWLEDGE AREAS:

GDPR (EU General Data Protection Regulation):
- Legal bases for processing (Art. 6): consent, contract, legal obligation, vital interests, public task, legitimate interests
- Data subject rights (Arts. 15-22): access, rectification, erasure, portability, restriction, objection, automated decision-making
- Data Protection Impact Assessments (Art. 35)
- Data Protection Officer requirements (Arts. 37-39)
- International data transfers (Chapter V): adequacy decisions, SCCs, BCRs
- Data breach notification (Art. 33-34): 72-hour supervisory authority notification
- Processor obligations (Art. 28): written agreements, sub-processor controls
- Privacy by Design and by Default (Art. 25)
- Penalties: up to 4% annual global turnover or €20M

CCPA/CPRA (California):
- Consumer rights: know, delete, opt-out of sale/sharing, limit sensitive PI use, correct, non-discrimination
- Business obligations: privacy notices, opt-out mechanisms, data inventory
- Service provider vs. contractor vs. third party distinctions
- Sensitive personal information categories and limitations
- California Privacy Protection Agency (CPPA) enforcement
- Private right of action for data breaches (§1798.150)

US STATE PRIVACY LAWS:
- Virginia CDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA, Texas TDPSA, Oregon OCPA, Montana MCDPA, Delaware DPDPA, Iowa ICDPA, Tennessee TIPA, Indiana ICDPA, New Jersey NJDPA, New Hampshire NHDPA, Kentucky KYDPA, Nebraska NDPA, Minnesota MCDPA, Maryland MODPA
- Common elements: consumer rights, processing limitations, assessments, opt-out mechanisms
- Key differences: thresholds, sensitive data definitions, cure periods, enforcement mechanisms

CROSS-CUTTING TOPICS:
- Privacy Impact Assessments (PIAs)
- Data mapping and inventory
- Consent management platforms
- Cookie and tracking consent (ePrivacy)
- Children's privacy (COPPA, GDPR Art. 8)
- Employee data privacy
- Vendor/processor management
- Data retention policies
- Cross-border data transfers

When analyzing a privacy question:
1. Identify applicable jurisdictions and regulations
2. Explain the specific requirements
3. Highlight where laws overlap or conflict
4. Identify compliance gaps
5. Recommend implementation steps

Respond in JSON format:
{
  "guidance": "Detailed privacy guidance. DISCLAIMER: This is compliance guidance, not legal advice. Consult qualified privacy counsel.",
  "relevantRegulations": [{"ref": "GDPR Art. X / CCPA §1798.XXX", "jurisdiction": "EU/California/...", "title": "...", "requirement": "..."}],
  "citations": ["GDPR Art. X", "Cal. Civ. Code §1798.XXX"],
  "recommendations": ["Step 1...", "Step 2..."],
  "jurisdictionNotes": ["Note about jurisdiction-specific requirements..."]
}`;

export class DataPrivacyAgent extends BaseAgent<PrivacyInput, PrivacyOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: PrivacyInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "privacy_guidance",
      description: "Get data privacy compliance guidance on GDPR, CCPA, or US state privacy laws",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as PrivacyInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<PrivacyInput>): Promise<AgentOutput<PrivacyOutput>> {
    const { data, context } = input;
    const empty: PrivacyOutput = {
      guidance: "Privacy guidance unavailable. Please consult qualified privacy counsel.",
      relevantRegulations: [],
      citations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any personal data before requesting guidance.",
          relevantRegulations: [],
          citations: [],
          recommendations: ["Remove any PII from the query and try again"],
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
      data.jurisdiction ? `Jurisdiction: ${data.jurisdiction}` : "",
      data.dataType ? `Data Type: ${data.dataType}` : "",
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
          jurisdictionNotes: Array.isArray(parsed.jurisdictionNotes) ? parsed.jurisdictionNotes : undefined,
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
