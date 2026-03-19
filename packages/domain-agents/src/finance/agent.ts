/**
 * Finance Agent — Layer 1 Domain Specialist
 *
 * Knowledge expert for GAAP/IFRS accounting standards and MSP financial models.
 * Provides guidance on financial reporting, MSP metrics, and cost structures.
 * Never provides investment or tax advice.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface FinanceInput {
  query: string;
  standardRef?: string;
  context?: "gaap" | "ifrs" | "msp_financial" | "cost_analysis" | "revenue_recognition" | "general";
  financialData?: string;
  findingDetail?: string;
}

export interface FinanceOutput {
  guidance: string;
  relevantStandards: Array<{ ref: string; title: string; requirement: string }>;
  citations: string[];
  recommendations: string[];
  mspConsiderations?: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "finance",
  agentName: "Finance Agent",
  appCode: "CVG-MIDAS",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a finance and accounting knowledge expert specializing in GAAP, IFRS, and MSP financial models. Your role is to provide guidance based on established accounting standards and MSP industry financial best practices.

CRITICAL RULES:
- You provide guidance based on US GAAP (ASC codification), IFRS standards, and MSP industry financial models
- You NEVER provide investment advice, tax advice, or specific audit opinions
- You NEVER store or return actual financial account numbers, bank details, or proprietary financial data
- You cite specific standards (e.g., ASC 606, IFRS 15, ASC 842)
- You recommend consulting a CPA or financial advisor for specific situations

KEY KNOWLEDGE AREAS:

GAAP (US):
- ASC 606: Revenue Recognition (critical for SaaS/MSP recurring revenue)
- ASC 842: Leases
- ASC 350: Intangibles — Goodwill and Other (M&A relevant)
- ASC 985: Software (development cost capitalization)

IFRS:
- IFRS 15: Revenue from Contracts with Customers
- IFRS 16: Leases
- IFRS 3: Business Combinations

MSP FINANCIAL MODELS:
- MRR/ARR (Monthly/Annual Recurring Revenue) metrics
- EBITDA margins (target 15-25% for healthy MSPs)
- Per-endpoint/per-user pricing models
- Gross margin analysis (labor vs. tools vs. overhead)
- Client concentration risk (no single client >15-20% of revenue)
- Service mix profitability (managed services vs. project vs. break-fix)
- Technician utilization rates (target 65-75% billable)
- Cost per ticket / cost per endpoint metrics
- Valuation multiples (typically 0.8-1.5x revenue, 4-8x EBITDA for MSPs)

When analyzing a financial question:
1. Identify the applicable standard or framework
2. Explain the requirement or best practice
3. Provide practical implementation guidance
4. Identify common pitfalls or misapplications
5. Recommend next steps

Respond in JSON format:
{
  "guidance": "Detailed guidance text",
  "relevantStandards": [{"ref": "ASC XXX", "title": "...", "requirement": "..."}],
  "citations": ["ASC XXX-YY-ZZ", "IFRS X"],
  "recommendations": ["Step 1...", "Step 2..."],
  "mspConsiderations": ["Consideration 1...", "Consideration 2..."]
}`;

export class FinanceAgent extends BaseAgent<FinanceInput, FinanceOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: FinanceInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "finance_guidance",
      description: "Get GAAP/IFRS accounting guidance or MSP financial model advice",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as FinanceInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<FinanceInput>): Promise<AgentOutput<FinanceOutput>> {
    const { data, context } = input;
    const empty: FinanceOutput = {
      guidance: "Financial guidance unavailable. Please consult a licensed CPA or financial advisor.",
      relevantStandards: [],
      citations: [],
      recommendations: [],
    };

    const scan = this.scanInput(data.query + (data.findingDetail || "") + (data.financialData || ""));
    if (!scan.isClean) {
      return {
        result: {
          guidance: "Input contains potentially sensitive information. Remove any proprietary financial data before requesting guidance.",
          relevantStandards: [],
          citations: [],
          recommendations: ["Remove sensitive financial data from the query and try again"],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    const userPrompt = [
      data.standardRef ? `Standard Reference: ${data.standardRef}` : "",
      data.context ? `Context: ${data.context}` : "",
      data.financialData ? `Financial Context: ${data.financialData}` : "",
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
          relevantStandards: Array.isArray(parsed.relevantStandards) ? parsed.relevantStandards : [],
          citations: Array.isArray(parsed.citations) ? parsed.citations : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          mspConsiderations: Array.isArray(parsed.mspConsiderations) ? parsed.mspConsiderations : undefined,
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
