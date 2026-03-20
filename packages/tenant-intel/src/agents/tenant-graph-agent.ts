/**
 * TenantGraph Agent — Tenant Intelligence Layer
 *
 * Maps user collaboration patterns, identifies organizational silos,
 * and measures cross-department interaction from tenant directory data.
 *
 * Primary consumers: Midas (roadmap), Ducky (queries)
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface TenantGraphInput {
  query: string;
  tenantId: string;
  users: Array<{
    displayName: string;
    email: string;
    department?: string;
    jobTitle?: string;
    isAdmin: boolean;
    accountEnabled: boolean;
    mfaEnabled: boolean;
    lastSignIn?: string;
    licenses: Array<{ skuName: string }>;
  }>;
  context?: "org_structure" | "collaboration" | "access_review" | "general";
}

export interface TenantGraphOutput {
  analysis: string;
  departments: Array<{
    name: string;
    userCount: number;
    adminCount: number;
    mfaPct: number;
    avgLicenseCount: number;
  }>;
  insights: string[];
  risks: Array<{ risk: string; severity: "high" | "medium" | "low"; recommendation: string }>;
  orgMetrics: {
    totalUsers: number;
    activeUsers: number;
    adminCount: number;
    mfaAdoptionPct: number;
    departmentCount: number;
    usersWithoutDepartment: number;
  };
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "tenant-graph",
  agentName: "TenantGraph Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a tenant organizational analysis expert. You analyze M365/Google Workspace tenant directory data to map organizational structure, identify collaboration patterns, and surface governance risks.

CRITICAL RULES:
- You NEVER store, return, or reference actual PII (names, emails, SSNs, etc.)
- You work with AGGREGATED data only — summarize patterns, don't list individuals
- You identify structural risks (orphaned admins, MFA gaps, shadow IT indicators)
- You provide actionable recommendations for MSP technicians and client admins

ANALYSIS CAPABILITIES:
- Organizational hierarchy mapping from department/jobTitle data
- Admin role distribution and over-privileged account detection
- MFA adoption gaps by department
- License utilization patterns across organizational units
- Stale account detection (inactive sign-ins)
- Cross-department collaboration indicators

When analyzing tenant data:
1. Summarize organizational structure
2. Identify security hygiene gaps (MFA, stale accounts, admin sprawl)
3. Highlight license optimization opportunities
4. Provide risk-scored findings with remediation steps

Respond in JSON format:
{
  "analysis": "Overall organizational analysis narrative",
  "departments": [{"name": "...", "userCount": 0, "adminCount": 0, "mfaPct": 0, "avgLicenseCount": 0}],
  "insights": ["Key insight 1", "Key insight 2"],
  "risks": [{"risk": "...", "severity": "high|medium|low", "recommendation": "..."}],
  "orgMetrics": {"totalUsers": 0, "activeUsers": 0, "adminCount": 0, "mfaAdoptionPct": 0, "departmentCount": 0, "usersWithoutDepartment": 0}
}`;

export class TenantGraphAgent extends BaseAgent<TenantGraphInput, TenantGraphOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: TenantGraphInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    if (!data.tenantId) errors.push("tenantId is required");
    if (!data.users || !Array.isArray(data.users)) errors.push("users array is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "tenant_graph_analysis",
      description: "Analyze tenant organizational structure and collaboration patterns",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as TenantGraphInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<TenantGraphInput>): Promise<AgentOutput<TenantGraphOutput>> {
    const { data, context } = input;
    const empty = this.emptyOutput();

    const scan = this.scanInput(data.query);
    if (!scan.isClean) {
      return {
        result: {
          ...empty,
          analysis: "Input contains potentially sensitive information. Remove any PII before requesting analysis.",
          risks: [{ risk: "PII detected in query", severity: "high", recommendation: "Remove sensitive data from the query and try again" }],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    // Build aggregated summary (never send raw PII to LLM)
    const aggregated = this.aggregateUserData(data.users);

    const userPrompt = [
      `Tenant ID: ${data.tenantId}`,
      data.context ? `Analysis Context: ${data.context}` : "",
      `Aggregated Tenant Data:`,
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
          departments: Array.isArray(parsed.departments) ? parsed.departments : [],
          insights: Array.isArray(parsed.insights) ? parsed.insights : [],
          risks: Array.isArray(parsed.risks) ? parsed.risks : [],
          orgMetrics: parsed.orgMetrics || empty.orgMetrics,
        },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return { result: empty, metadata: this.emptyMetadata() };
    }
  }

  private aggregateUserData(users: TenantGraphInput["users"]) {
    const departments = new Map<string, { count: number; admins: number; mfa: number; licenses: number }>();

    let totalAdmins = 0;
    let totalMfa = 0;
    let activeUsers = 0;
    let usersWithoutDept = 0;

    for (const user of users) {
      if (user.accountEnabled) activeUsers++;
      if (user.isAdmin) totalAdmins++;
      if (user.mfaEnabled) totalMfa++;

      const dept = user.department || "Unassigned";
      if (!user.department) usersWithoutDept++;

      const existing = departments.get(dept) || { count: 0, admins: 0, mfa: 0, licenses: 0 };
      existing.count++;
      if (user.isAdmin) existing.admins++;
      if (user.mfaEnabled) existing.mfa++;
      existing.licenses += user.licenses.length;
      departments.set(dept, existing);
    }

    return {
      totalUsers: users.length,
      activeUsers,
      totalAdmins,
      mfaAdoptionPct: users.length > 0 ? Math.round((totalMfa / users.length) * 100) : 0,
      usersWithoutDepartment: usersWithoutDept,
      departments: Object.fromEntries(
        [...departments.entries()].map(([name, data]) => [
          name,
          {
            userCount: data.count,
            adminCount: data.admins,
            mfaPct: data.count > 0 ? Math.round((data.mfa / data.count) * 100) : 0,
            avgLicenseCount: data.count > 0 ? Math.round(data.licenses / data.count) : 0,
          },
        ]),
      ),
    };
  }

  private emptyOutput(): TenantGraphOutput {
    return {
      analysis: "Tenant graph analysis unavailable.",
      departments: [],
      insights: [],
      risks: [],
      orgMetrics: { totalUsers: 0, activeUsers: 0, adminCount: 0, mfaAdoptionPct: 0, departmentCount: 0, usersWithoutDepartment: 0 },
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
