/**
 * UsagePattern Agent — Tenant Intelligence Layer
 *
 * Detects underutilized services, license waste, and adoption trends
 * from tenant license and activity data.
 *
 * Primary consumers: Astra (license optimization), Midas (QBR)
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface UsagePatternInput {
  query: string;
  tenantId: string;
  licenses: Array<{
    skuName: string;
    skuId: string;
    totalQuantity: number;
    assignedCount: number;
    availableCount: number;
    utilizationPct: number;
    estimatedMonthlyCost?: number;
  }>;
  userLicenseData?: Array<{
    department?: string;
    licenseCount: number;
    lastSignIn?: string;
    accountEnabled: boolean;
    servicesUsed?: string[];
  }>;
  context?: "license_optimization" | "cost_analysis" | "adoption_trends" | "general";
}

export interface UsagePatternOutput {
  analysis: string;
  licenseInsights: Array<{
    skuName: string;
    finding: string;
    savingsOpportunity?: number;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }>;
  costSummary: {
    totalMonthlyCost: number | null;
    estimatedWaste: number | null;
    potentialSavings: number | null;
    wastedLicenseCount: number;
  };
  adoptionMetrics: Array<{
    service: string;
    adoptionPct: number;
    trend: "increasing" | "stable" | "declining" | "unknown";
  }>;
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "usage-pattern",
  agentName: "UsagePattern Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a Microsoft 365 / Google Workspace license optimization expert. You analyze license utilization data to identify waste, right-sizing opportunities, and adoption trends.

CRITICAL RULES:
- You NEVER store, return, or reference actual PII
- You work with AGGREGATED license and utilization data only
- You provide actionable cost-saving recommendations with estimated savings
- You prioritize recommendations by ROI impact

ANALYSIS CAPABILITIES:
- License waste detection (assigned but unused licenses)
- Right-sizing recommendations (downgrade from E5 to E3 when features unused)
- Service adoption analysis (which M365 services are actually being used)
- Cost projection and savings estimation
- Stale license identification (assigned to disabled/inactive accounts)
- Department-level utilization patterns

COMMON M365 PRICING (approximate monthly per-user):
- Business Basic: $6/user/mo
- Business Standard: $12.50/user/mo
- Business Premium: $22/user/mo
- E3: $36/user/mo
- E5: $57/user/mo
- Exchange Online P1: $4/user/mo
- Exchange Online P2: $8/user/mo

When analyzing license data:
1. Identify wasted licenses (unassigned, assigned to disabled accounts)
2. Detect over-provisioned SKUs (expensive licenses with low feature utilization)
3. Calculate potential monthly/annual savings
4. Prioritize by savings impact

Respond in JSON format:
{
  "analysis": "Overall utilization analysis",
  "licenseInsights": [{"skuName": "...", "finding": "...", "savingsOpportunity": 0, "recommendation": "...", "priority": "high|medium|low"}],
  "costSummary": {"totalMonthlyCost": 0, "estimatedWaste": 0, "potentialSavings": 0, "wastedLicenseCount": 0},
  "adoptionMetrics": [{"service": "...", "adoptionPct": 0, "trend": "increasing|stable|declining|unknown"}],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

export class UsagePatternAgent extends BaseAgent<UsagePatternInput, UsagePatternOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: UsagePatternInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    if (!data.tenantId) errors.push("tenantId is required");
    if (!data.licenses || !Array.isArray(data.licenses)) errors.push("licenses array is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "usage_pattern_analysis",
      description: "Analyze tenant license utilization and detect waste patterns",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as UsagePatternInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<UsagePatternInput>): Promise<AgentOutput<UsagePatternOutput>> {
    const { data, context } = input;
    const empty = this.emptyOutput();

    const scan = this.scanInput(data.query);
    if (!scan.isClean) {
      return {
        result: {
          ...empty,
          analysis: "Input contains potentially sensitive information. Remove any PII before requesting analysis.",
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    // Aggregate user license data
    const aggregated = this.aggregateLicenseData(data);

    const userPrompt = [
      `Tenant ID: ${data.tenantId}`,
      data.context ? `Analysis Context: ${data.context}` : "",
      `License Data:`,
      JSON.stringify(aggregated, null, 2),
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
          analysis: parsed.analysis || empty.analysis,
          licenseInsights: Array.isArray(parsed.licenseInsights) ? parsed.licenseInsights : [],
          costSummary: parsed.costSummary || empty.costSummary,
          adoptionMetrics: Array.isArray(parsed.adoptionMetrics) ? parsed.adoptionMetrics : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return { result: empty, metadata: this.emptyMetadata() };
    }
  }

  private aggregateLicenseData(data: UsagePatternInput) {
    const totalCost = data.licenses.reduce((sum, l) => sum + (l.estimatedMonthlyCost || 0), 0);
    const wastedCount = data.licenses.reduce((sum, l) => sum + l.availableCount, 0);

    let departmentBreakdown: Record<string, { users: number; avgLicenses: number }> | undefined;
    if (data.userLicenseData) {
      const depts = new Map<string, { count: number; licenses: number }>();
      for (const u of data.userLicenseData) {
        const dept = u.department || "Unassigned";
        const existing = depts.get(dept) || { count: 0, licenses: 0 };
        existing.count++;
        existing.licenses += u.licenseCount;
        depts.set(dept, existing);
      }
      departmentBreakdown = Object.fromEntries(
        [...depts.entries()].map(([name, d]) => [
          name,
          { users: d.count, avgLicenses: d.count > 0 ? Math.round(d.licenses / d.count) : 0 },
        ]),
      );
    }

    return {
      licenses: data.licenses,
      totalMonthlyCost: totalCost || null,
      wastedLicenseCount: wastedCount,
      departmentBreakdown,
    };
  }

  private emptyOutput(): UsagePatternOutput {
    return {
      analysis: "Usage pattern analysis unavailable.",
      licenseInsights: [],
      costSummary: { totalMonthlyCost: null, estimatedWaste: null, potentialSavings: null, wastedLicenseCount: 0 },
      adoptionMetrics: [],
      recommendations: [],
    };
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
