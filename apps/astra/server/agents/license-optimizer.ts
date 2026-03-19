/**
 * M365 License Optimizer — Layer 3 Product Agent (CVG-ASTRA)
 *
 * Composes Cost Analyzer (Layer 2) + Data Extractor (Layer 2) to produce
 * per-user license right-sizing recommendations with cost impact analysis.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";
import { CostAnalyzerAgent } from "@cavaridge/agents/cost-analyzer/agent";
import { DataExtractorAgent } from "@cavaridge/agents/data-extractor/agent";
import { executeAgent } from "@cavaridge/agent-runtime";

// ── Types ────────────────────────────────────────────────────────────

export interface LicenseUser {
  displayName: string;
  upn?: string;
  department?: string;
  licenses: string[];
  cost: number;
  usageGB?: number;
  maxGB?: number;
  status?: string;
  activity?: {
    exchangeActive: boolean;
    teamsActive: boolean;
    sharePointActive: boolean;
    oneDriveActive: boolean;
    activeServiceCount: number;
    totalServiceCount: number;
    daysSinceLastActivity: number | null;
  };
}

export interface LicenseOptimizerInput {
  users: LicenseUser[];
  costCurrent: number;
  costSecurity: number;
  costSaving: number;
  costBalanced: number;
  costCustom?: number;
  commitment: "monthly" | "annual";
  strategy?: string;
}

export interface LicenseRecommendation {
  displayName: string;
  currentLicenses: string[];
  recommendedLicenses: string[];
  currentCost: number;
  recommendedCost: number;
  monthlySavings: number;
  rationale: string;
}

export interface LicenseOptimizerOutput {
  recommendations: LicenseRecommendation[];
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  narrative: string;
  rawResponse: string;
}

// ── Agent ────────────────────────────────────────────────────────────

const AGENT_CONFIG: AgentConfig = {
  agentId: "m365-license-optimizer",
  agentName: "M365 License Optimizer",
  appCode: "CVG-ASTRA",
  version: "1.0.0",
};

export class LicenseOptimizerAgent extends BaseAgent<LicenseOptimizerInput, LicenseOptimizerOutput> {
  private costAnalyzer: CostAnalyzerAgent;
  private dataExtractor: DataExtractorAgent;

  constructor(config?: Partial<AgentConfig>) {
    super({ ...AGENT_CONFIG, ...config });
    this.costAnalyzer = new CostAnalyzerAgent({ appCode: "CVG-ASTRA" });
    this.dataExtractor = new DataExtractorAgent({ appCode: "CVG-ASTRA" });
  }

  async validate(data: LicenseOptimizerInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.users || data.users.length === 0) errors.push("users array is required and must not be empty");
    if (typeof data.costCurrent !== "number") errors.push("costCurrent is required");
    if (!data.commitment) errors.push("commitment is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "optimize_licenses",
      description: "Analyze M365 license assignments and recommend right-sizing changes",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as LicenseOptimizerInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<LicenseOptimizerInput>): Promise<AgentOutput<LicenseOptimizerOutput>> {
    const { data, context } = input;
    const empty: LicenseOptimizerOutput = {
      recommendations: [],
      totalMonthlySavings: 0,
      totalAnnualSavings: 0,
      narrative: "License optimization analysis unavailable.",
      rawResponse: "",
    };

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    // Step 1: Extract usage patterns via Data Extractor
    const usagePatterns = await this.extractUsagePatterns(input);

    // Step 2: Run cost analysis via Cost Analyzer
    const costAnalysis = await this.analyzeCosts(input, usagePatterns);

    // Step 3: Generate comprehensive right-sizing recommendations
    const systemPrompt = `You are an expert M365 licensing strategist. Analyze the provided user license data,
usage patterns, and cost analysis to produce specific per-user license right-sizing recommendations.

Output valid JSON with this structure:
{
  "recommendations": [
    {
      "displayName": "User Name",
      "currentLicenses": ["E5"],
      "recommendedLicenses": ["E3"],
      "currentCost": 57,
      "recommendedCost": 36,
      "monthlySavings": 21,
      "rationale": "Only uses Exchange and Teams (2/5 services active). E3 covers both."
    }
  ],
  "totalMonthlySavings": 0,
  "totalAnnualSavings": 0,
  "narrative": "Summary paragraph"
}

Rules:
- Only recommend changes where activity data supports the downgrade
- Never downgrade users actively using advanced features (eDiscovery, DLP, etc.)
- Flag inactive users (0 services in 30 days) for immediate review
- Consider F3 + Exchange Online Plan 1 as cost-effective alternative to E3 for email-only users`;

    const userPrompt = this.buildAnalysisPrompt(data, usagePatterns, costAnalysis);

    const response = await this.callLlm(
      context,
      "analysis",
      systemPrompt,
      [{ role: "user", content: userPrompt }],
      { maxTokens: 4096, temperature: 0.3 },
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { result: { ...empty, rawResponse: response.content }, metadata: this.emptyMetadata() };

      const parsed = JSON.parse(jsonMatch[0]);
      const recommendations: LicenseRecommendation[] = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((r: Record<string, unknown>) => ({
            displayName: String(r.displayName || ""),
            currentLicenses: Array.isArray(r.currentLicenses) ? r.currentLicenses.map(String) : [],
            recommendedLicenses: Array.isArray(r.recommendedLicenses) ? r.recommendedLicenses.map(String) : [],
            currentCost: Number(r.currentCost || 0),
            recommendedCost: Number(r.recommendedCost || 0),
            monthlySavings: Number(r.monthlySavings || 0),
            rationale: String(r.rationale || ""),
          }))
        : [];

      const totalMonthlySavings = recommendations.reduce((sum, r) => sum + r.monthlySavings, 0);

      return {
        result: {
          recommendations,
          totalMonthlySavings,
          totalAnnualSavings: totalMonthlySavings * 12,
          narrative: String(parsed.narrative || ""),
          rawResponse: response.content,
        },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return { result: { ...empty, rawResponse: response.content }, metadata: this.emptyMetadata() };
    }
  }

  private async extractUsagePatterns(input: AgentInput<LicenseOptimizerInput>): Promise<string> {
    const usersWithActivity = input.data.users.filter(u => u.activity);
    if (usersWithActivity.length === 0) return "No activity data available.";

    try {
      const result = await executeAgent(this.dataExtractor, {
        data: {
          text: JSON.stringify(usersWithActivity.map(u => ({
            name: u.displayName,
            licenses: u.licenses,
            cost: u.cost,
            services: u.activity,
          }))),
          extractionType: "usage-patterns",
          systemPrompt: "Extract M365 usage patterns. For each user, identify: active services, inactive services, license tier vs actual usage level. Return a JSON array.",
        },
        context: input.context,
      });
      return JSON.stringify(result.result.items);
    } catch {
      return "Usage pattern extraction failed — proceeding with raw data.";
    }
  }

  private async analyzeCosts(input: AgentInput<LicenseOptimizerInput>, usagePatterns: string): Promise<string> {
    const { data } = input;
    try {
      const result = await executeAgent(this.costAnalyzer, {
        data: {
          systemPrompt: "You are an M365 licensing cost analyst. Analyze the cost data and produce a cost optimization summary with specific dollar amounts. Return JSON with estimates array and narrative.",
          userPrompt: `Current monthly spend: $${data.costCurrent.toFixed(2)}
Security strategy cost: $${data.costSecurity.toFixed(2)}
Cost-saving strategy cost: $${data.costSaving.toFixed(2)}
Balanced strategy cost: $${data.costBalanced.toFixed(2)}
Users: ${data.users.length}
Usage patterns: ${usagePatterns}`,
        },
        context: input.context,
      });
      return result.result.narrative || JSON.stringify(result.result.estimates);
    } catch {
      return "Cost analysis unavailable — proceeding with raw cost data.";
    }
  }

  private buildAnalysisPrompt(data: LicenseOptimizerInput, usagePatterns: string, costAnalysis: string): string {
    const commitmentLabel = data.commitment === "annual" ? "Annual" : "Monthly";
    const userSummaries = data.users.map(u => {
      const base = `${u.displayName} | ${u.department || "N/A"} | ${u.licenses.join(", ")} | $${u.cost}/mo`;
      if (u.activity) {
        return `${base} | Active: ${u.activity.activeServiceCount}/${u.activity.totalServiceCount} services | Days since activity: ${u.activity.daysSinceLastActivity ?? "unknown"}`;
      }
      return `${base} | No activity data`;
    }).join("\n");

    return `TENANT: ${data.users.length} users | $${data.costCurrent.toFixed(2)}/mo | ${commitmentLabel} billing

USER DIRECTORY:
${userSummaries}

USAGE PATTERNS:
${usagePatterns}

COST ANALYSIS:
${costAnalysis}

Produce per-user right-sizing recommendations with cost impact.`;
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
