/**
 * Recommendation Agent — Layer 3 Product Agent
 *
 * AI-powered recommendations based on security posture,
 * license utilization, and infrastructure data.
 *
 * All LLM calls route through BaseAgent.callLlm() → Spaniel → OpenRouter.
 */

import {
  BaseAgent,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type AgentMetadata,
  type AgentToolDefinition,
} from "@cavaridge/agent-core";

import type { QbrRecommendation } from "@shared/types/qbr";
import { RECOMMENDATION_SYSTEM_PROMPT } from "./prompts";

// ── Input/Output Types ──────────────────────────────────────────────

export interface RecommendationInput {
  tenantId: string;
  clientId: string;
  clientName: string;
  adjustedScore: number | null;
  nativeScore: number | null;
  gapCount: number;
  compensatedCount: number;
  licenseUtilizationPct: number | null;
  wastedLicenseCount: number | null;
  mfaEnabledPct: number | null;
  deviceCompliancePct: number | null;
  roadmapCompletionPct: number;
  projectCount: number;
  completedProjectCount: number;
}

export interface RecommendationOutput {
  recommendations: QbrRecommendation[];
}

// ── Agent Config ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: AgentConfig = {
  agentId: "midas-recommendation",
  agentName: "RecommendationEngine",
  appCode: "CVG-MIDAS",
  version: "1.0.0",
};

// ── Agent Implementation ─────────────────────────────────────────────

export class RecommendationAgent extends BaseAgent<RecommendationInput, RecommendationOutput> {
  constructor(config?: Partial<AgentConfig>) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  async validate(data: RecommendationInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!data.tenantId) errors.push("tenantId is required");
    if (!data.clientId) errors.push("clientId is required");
    return { valid: errors.length === 0, errors };
  }

  getTools(): AgentToolDefinition[] {
    return [
      {
        name: "generate_recommendations",
        description: "Generate AI-powered recommendations based on client posture data",
        execute: async (params, ctx) => {
          const output = await this.execute({
            data: params as unknown as RecommendationInput,
            context: ctx,
          });
          return output.result;
        },
      },
    ];
  }

  async execute(input: AgentInput<RecommendationInput>): Promise<AgentOutput<RecommendationOutput>> {
    const { data, context } = input;

    // Build deterministic fallback recommendations
    const fallbackRecs = this.buildFallbackRecommendations(data);

    if (!this.hasAI()) {
      return {
        result: { recommendations: fallbackRecs },
        metadata: this.emptyMetadata(),
      };
    }

    try {
      const userPrompt = this.buildUserPrompt(data);

      const response = await this.callLlm(
        context,
        "analysis",
        RECOMMENDATION_SYSTEM_PROMPT,
        [{ role: "user", content: userPrompt }],
        { maxTokens: 2048, temperature: 0.4 },
      );

      const parsed = parseJson<{
        recommendations: Array<{
          title: string;
          description: string;
          category: string;
          priority: string;
          estimatedCost: string;
          estimatedTimeline: string;
        }>;
      }>(response.content);

      if (!parsed?.recommendations || parsed.recommendations.length === 0) {
        return {
          result: { recommendations: fallbackRecs },
          metadata: this.emptyMetadata(),
        };
      }

      const recommendations: QbrRecommendation[] = parsed.recommendations.map((r) => ({
        title: r.title,
        description: r.description,
        category: r.category,
        priority: normalizeRecPriority(r.priority),
        estimatedCost: r.estimatedCost ?? null,
        estimatedTimeline: r.estimatedTimeline ?? null,
        source: "ai" as const,
      }));

      return {
        result: { recommendations },
        metadata: this.emptyMetadata(),
      };
    } catch {
      return {
        result: { recommendations: fallbackRecs },
        metadata: this.emptyMetadata(),
      };
    }
  }

  private buildUserPrompt(data: RecommendationInput): string {
    const lines: string[] = [
      `Client: ${data.clientName}`,
      `Security Adjusted Score: ${data.adjustedScore ?? "N/A"}/100 (native: ${data.nativeScore ?? "N/A"})`,
      `Security Gaps: ${data.gapCount}`,
      `Compensated Controls: ${data.compensatedCount}`,
      `License Utilization: ${data.licenseUtilizationPct ?? "N/A"}%`,
      `Wasted Licenses: ${data.wastedLicenseCount ?? "N/A"}`,
      `MFA Adoption: ${data.mfaEnabledPct ?? "N/A"}%`,
      `Device Compliance: ${data.deviceCompliancePct ?? "N/A"}%`,
      `Roadmap Progress: ${data.roadmapCompletionPct}% (${data.completedProjectCount}/${data.projectCount} projects)`,
    ];
    return lines.join("\n");
  }

  private buildFallbackRecommendations(data: RecommendationInput): QbrRecommendation[] {
    const recs: QbrRecommendation[] = [];

    if (data.adjustedScore !== null && data.adjustedScore < 70) {
      recs.push({
        title: "Improve security posture to target score of 80+",
        description: `Current Adjusted Score is ${data.adjustedScore}/100 with ${data.gapCount} unaddressed gaps. Prioritize closing the highest-impact security gaps to improve overall posture.`,
        category: "security",
        priority: data.adjustedScore < 50 ? "critical" : "high",
        estimatedCost: null,
        estimatedTimeline: "1-3 months",
        source: "security",
      });
    }

    if (data.mfaEnabledPct !== null && data.mfaEnabledPct < 90) {
      recs.push({
        title: "Enforce multi-factor authentication across all user accounts",
        description: `Only ${data.mfaEnabledPct}% of users have MFA enabled. Enforcing MFA is the single highest-impact security control available.`,
        category: "security",
        priority: "critical",
        estimatedCost: "< $1k",
        estimatedTimeline: "1-2 weeks",
        source: "security",
      });
    }

    if (data.wastedLicenseCount !== null && data.wastedLicenseCount > 0) {
      recs.push({
        title: "Reclaim unused software licenses",
        description: `${data.wastedLicenseCount} licenses are assigned but not in use. Reclaiming these reduces monthly spend with zero operational impact.`,
        category: "license",
        priority: "medium",
        estimatedCost: null,
        estimatedTimeline: "1-2 weeks",
        source: "license",
      });
    }

    if (data.deviceCompliancePct !== null && data.deviceCompliancePct < 80) {
      recs.push({
        title: "Address non-compliant devices",
        description: `Device compliance is at ${data.deviceCompliancePct}%. Non-compliant devices represent an uncontrolled access vector. Review and remediate compliance gaps.`,
        category: "infrastructure",
        priority: "high",
        estimatedCost: "$2k-$5k",
        estimatedTimeline: "2-4 weeks",
        source: "infrastructure",
      });
    }

    if (recs.length === 0) {
      recs.push({
        title: "Continue current security and infrastructure maintenance cadence",
        description: "No critical gaps identified. Maintain quarterly review cycle and monitor for drift.",
        category: "compliance",
        priority: "low",
        estimatedCost: null,
        estimatedTimeline: "Ongoing",
        source: "ai",
      });
    }

    return recs;
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

function parseJson<T>(raw: string): T | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

function normalizeRecPriority(p: string): "critical" | "high" | "medium" | "low" {
  const lower = p.toLowerCase();
  if (lower === "critical") return "critical";
  if (lower === "high") return "high";
  if (lower === "medium") return "medium";
  return "low";
}
