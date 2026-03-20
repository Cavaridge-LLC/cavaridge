/**
 * ConfigDrift Agent — Tenant Intelligence Layer
 *
 * Compares snapshots over time, flags security/config regressions,
 * and detects unauthorized configuration changes.
 *
 * Primary consumers: HIPAA, Midas (security), Meridian
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

export interface ConfigDriftInput {
  query: string;
  tenantId: string;
  delta: {
    fromDate: string;
    toDate: string;
    summary: {
      usersAdded: number;
      usersRemoved: number;
      usersModified: number;
      licensesChanged: number;
      securityScoreDelta: number | null;
      devicesAdded: number;
      devicesRemoved: number;
      policiesChanged: number;
      totalChanges: number;
    };
    changes: Array<{
      entity: string;
      changeType: string;
      entityName: string;
      field?: string;
      previousValue?: unknown;
      currentValue?: unknown;
    }>;
  };
  securityPosture?: {
    nativeScore: number;
    maxPossibleScore: number;
    scorePct: number;
    controlsImplemented: number;
    totalControls: number;
  };
  context?: "security_review" | "compliance_audit" | "change_management" | "general";
}

export interface ConfigDriftOutput {
  analysis: string;
  driftFindings: Array<{
    finding: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    category: "security" | "compliance" | "operational" | "licensing";
    recommendation: string;
    affectedEntities: number;
  }>;
  securityImpact: {
    scoreChange: number | null;
    newRisks: string[];
    resolvedRisks: string[];
    overallAssessment: "improved" | "degraded" | "stable" | "unknown";
  };
  complianceFlags: Array<{
    framework: string;
    control: string;
    impact: string;
  }>;
  recommendations: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "config-drift",
  agentName: "ConfigDrift Agent",
  appCode: "CVG-CORE",
  version: "0.1.0",
};

const SYSTEM_PROMPT = `You are a tenant configuration drift analysis expert. You compare snapshots of M365/Google Workspace tenant configuration over time to detect security regressions, unauthorized changes, and compliance impacts.

CRITICAL RULES:
- You NEVER store, return, or reference actual PII
- You analyze CHANGES between snapshots — focus on what drifted and why it matters
- You flag security regressions with appropriate severity levels
- You map findings to compliance frameworks (HIPAA, CIS, NIST CSF) when relevant
- You distinguish between benign operational changes and security-relevant drift

ANALYSIS CAPABILITIES:
- Security score regression detection
- MFA status changes (users losing MFA = critical)
- Admin role escalation detection
- Conditional Access policy modifications
- Device compliance state changes
- License assignment anomalies
- Stale account accumulation
- Unauthorized configuration changes

SEVERITY GUIDELINES:
- CRITICAL: MFA disabled for admins, security score dropped >10%, CA policies deleted
- HIGH: New global admins added, device compliance degradation, security controls regressed
- MEDIUM: License changes, department restructuring, new user provisioning patterns
- LOW: Minor config tweaks, expected operational changes
- INFO: Normal day-to-day changes, user additions within expected range

When analyzing drift:
1. Categorize each change by security impact
2. Identify patterns (gradual degradation vs. sudden changes)
3. Map security-relevant changes to compliance frameworks
4. Provide remediation priorities

Respond in JSON format:
{
  "analysis": "Overall drift analysis narrative",
  "driftFindings": [{"finding": "...", "severity": "critical|high|medium|low|info", "category": "security|compliance|operational|licensing", "recommendation": "...", "affectedEntities": 0}],
  "securityImpact": {"scoreChange": 0, "newRisks": [], "resolvedRisks": [], "overallAssessment": "improved|degraded|stable|unknown"},
  "complianceFlags": [{"framework": "HIPAA|CIS|NIST", "control": "...", "impact": "..."}],
  "recommendations": ["Priority 1...", "Priority 2..."]
}`;

export class ConfigDriftAgent extends BaseAgent<ConfigDriftInput, ConfigDriftOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: ConfigDriftInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.query) errors.push("query is required");
    if (!data.tenantId) errors.push("tenantId is required");
    if (!data.delta) errors.push("delta data is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [{
      name: "config_drift_analysis",
      description: "Analyze configuration drift between tenant snapshots",
      execute: async (params, ctx) => {
        const output = await this.execute({
          data: params as unknown as ConfigDriftInput,
          context: ctx,
        });
        return output.result;
      },
    }];
  }

  async execute(input: AgentInput<ConfigDriftInput>): Promise<AgentOutput<ConfigDriftOutput>> {
    const { data, context } = input;
    const empty = this.emptyOutput();

    const scan = this.scanInput(data.query);
    if (!scan.isClean) {
      return {
        result: {
          ...empty,
          analysis: "Input contains potentially sensitive information. Remove any PII before requesting analysis.",
          driftFindings: [{ finding: "PII detected in query", severity: "critical", category: "security", recommendation: "Remove sensitive data and try again", affectedEntities: 0 }],
        },
        metadata: this.emptyMetadata(),
      };
    }

    if (!this.hasAI()) {
      return { result: empty, metadata: this.emptyMetadata() };
    }

    // Summarize changes (limit to 50 most significant to avoid token overflow)
    const significantChanges = this.prioritizeChanges(data.delta.changes).slice(0, 50);

    const userPrompt = [
      `Tenant ID: ${data.tenantId}`,
      data.context ? `Analysis Context: ${data.context}` : "",
      `Period: ${data.delta.fromDate} to ${data.delta.toDate}`,
      `Change Summary: ${JSON.stringify(data.delta.summary)}`,
      data.securityPosture ? `Current Security Posture: ${JSON.stringify(data.securityPosture)}` : "",
      `Significant Changes (${significantChanges.length} of ${data.delta.changes.length} total):`,
      JSON.stringify(significantChanges, null, 2),
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
          driftFindings: Array.isArray(parsed.driftFindings) ? parsed.driftFindings : [],
          securityImpact: parsed.securityImpact || empty.securityImpact,
          complianceFlags: Array.isArray(parsed.complianceFlags) ? parsed.complianceFlags : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return { result: empty, metadata: this.emptyMetadata() };
    }
  }

  private prioritizeChanges(changes: ConfigDriftInput["delta"]["changes"]) {
    const severityOrder: Record<string, number> = {
      security_control: 0,
      conditional_access: 1,
      config: 2,
      user: 3,
      device: 4,
      license: 5,
    };

    return [...changes].sort((a, b) => {
      const aOrder = severityOrder[a.entity] ?? 99;
      const bOrder = severityOrder[b.entity] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Removals are more significant than additions
      if (a.changeType === "removed" && b.changeType !== "removed") return -1;
      if (b.changeType === "removed" && a.changeType !== "removed") return 1;
      return 0;
    });
  }

  private emptyOutput(): ConfigDriftOutput {
    return {
      analysis: "Config drift analysis unavailable.",
      driftFindings: [],
      securityImpact: { scoreChange: null, newRisks: [], resolvedRisks: [], overallAssessment: "unknown" },
      complianceFlags: [],
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
