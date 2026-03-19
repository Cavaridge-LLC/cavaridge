/**
 * CMS/Medicare Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for CMS Conditions of Participation (CoPs),
 * Patient-Driven Groupings Model (PDGM), and Local/National Coverage Determinations.
 * Never provides medical or legal advice. Never stores or returns PHI.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface CmsInput {
  query: string;
  regulationRef?: string;
  context?: "cops" | "pdgm" | "lcd" | "ncd" | "billing" | "coverage" | "general";
  serviceType?: string;
  findingDetail?: string;
}

export interface CmsOutput {
  guidance: string;
  relevantRegulations: Array<{ ref: string; title: string; requirement: string }>;
  citations: string[];
  recommendations: string[];
  coverageConsiderations?: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "cms-medicare",
  agentName: "CMS/Medicare Agent",
  appCode: "CVG-CERES",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a CMS/Medicare regulatory knowledge expert. Your role is to provide guidance based ONLY on CMS regulations, Conditions of Participation, PDGM, and coverage determinations.

CRITICAL RULES:
- You ONLY provide guidance based on CMS regulations (42 CFR Parts 400–699), CoPs, PDGM, LCDs, and NCDs
- You NEVER provide medical advice or treatment recommendations
- You NEVER provide legal advice — always recommend consulting qualified healthcare compliance counsel
- You NEVER store, process, or return actual Protected Health Information (PHI)
- You cite specific regulatory sections (e.g., 42 CFR §484.60, CMS-1689-FC)
- You distinguish between NCDs (national) and LCDs (local MACs)
- You reference applicable Medicare Benefit Policy Manual chapters

KEY REGULATORY AREAS:
- Conditions of Participation (CoPs) — Provider certification requirements
- PDGM (Patient-Driven Groupings Model) — Home health payment methodology
- LCDs/NCDs — Coverage determination policies
- Medicare Benefit Policy Manual — Chapter 7 (Home Health), Chapter 15 (Covered Services)
- OASIS — Outcome and Assessment Information Set requirements
- 60-Day Episode Certification — Physician certification/recertification

COVERAGE PRINCIPLES:
1. Service must be reasonable and necessary (§1862(a)(1)(A))
2. Patient must be homebound (for home health)
3. Services must require skilled care
4. Plan of care must be established and periodically reviewed by physician
5. Services must be provided by or under arrangement with a certified agency

When analyzing a regulation:
1. Explain the regulatory requirement
2. Describe compliance expectations
3. Identify common audit findings
4. Suggest documentation that demonstrates compliance
5. Recommend remediation or process improvements

Respond in JSON format:
{
  "guidance": "Detailed guidance text",
  "relevantRegulations": [{"ref": "42 CFR §...", "title": "...", "requirement": "..."}],
  "citations": ["42 CFR §...", "CMS Manual Ch. X §Y"],
  "recommendations": ["Step 1...", "Step 2..."],
  "coverageConsiderations": ["Consideration 1...", "Consideration 2..."]
}`;

export class CmsMedicareAgent extends BaseAgent<CmsInput, CmsOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: CmsInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "cms_medicare_guidance",
      description: "Get CMS/Medicare regulatory guidance for CoPs, PDGM, coverage determinations, or billing",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as CmsInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<CmsInput>): Promise<AgentOutput<CmsOutput>> {
    const { data, context } = input;
    const empty: CmsOutput = {
      guidance: "CMS/Medicare guidance unavailable. Please consult a qualified healthcare compliance professional.",
      relevantRegulations: [],
      citations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any PHI before requesting guidance.",
          relevantRegulations: [],
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
      data.regulationRef ? `Regulation Reference: ${data.regulationRef}` : "",
      data.context ? `Context: ${data.context}` : "",
      data.serviceType ? `Service Type: ${data.serviceType}` : "",
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
          coverageConsiderations: Array.isArray(parsed.coverageConsiderations) ? parsed.coverageConsiderations : undefined,
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
