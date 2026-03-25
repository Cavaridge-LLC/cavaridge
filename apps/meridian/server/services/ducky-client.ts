/**
 * Meridian — Ducky Intelligence Client
 *
 * Integrates with Ducky (CVG-RESEARCH) for AI-powered M&A analysis.
 * All AI calls route through Ducky's HTTP API which in turn routes
 * through Spaniel (CVG-AI). No direct OpenRouter calls.
 */

import { logger } from "../logger";

const DUCKY_BASE_URL = process.env.DUCKY_URL || "http://localhost:5001";

export interface DuckyAnalysisRequest {
  app_code: string;
  query: string;
  context?: Record<string, unknown>;
  conversation_id?: string;
}

export interface DuckyAnalysisResponse {
  answer: string;
  sources?: Array<{
    title: string;
    relevance: number;
  }>;
  confidence: number;
  conversation_id?: string;
}

/**
 * Send an analysis query to Ducky for AI-powered M&A intelligence.
 * Uses the /v1/app-query endpoint with app_code=CVG-MER.
 */
export async function queryDucky(
  query: string,
  context?: Record<string, unknown>,
  conversationId?: string
): Promise<DuckyAnalysisResponse> {
  const payload: DuckyAnalysisRequest = {
    app_code: "CVG-MER",
    query,
    context,
    conversation_id: conversationId,
  };

  try {
    const response = await fetch(`${DUCKY_BASE_URL}/v1/app-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.DUCKY_SERVICE_TOKEN
          ? { Authorization: `Bearer ${process.env.DUCKY_SERVICE_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn({ status: response.status, error: errorText }, "Ducky query failed");
      return {
        answer: "AI analysis is temporarily unavailable. Please try again later.",
        confidence: 0,
      };
    }

    const data = await response.json() as DuckyAnalysisResponse;
    return data;
  } catch (error) {
    logger.warn({ error }, "Ducky service unreachable");
    return {
      answer: "AI analysis service is not available. Ducky may be offline.",
      confidence: 0,
    };
  }
}

/**
 * Analyze assessment findings using Ducky Intelligence.
 * Provides risk analysis, remediation suggestions, and cost estimates.
 */
export async function analyzeFindings(
  dealName: string,
  industry: string,
  findings: Array<{ title: string; severity: string; description?: string | null }>
): Promise<DuckyAnalysisResponse> {
  const findingSummary = findings.map(f =>
    `- [${f.severity.toUpperCase()}] ${f.title}${f.description ? `: ${f.description}` : ""}`
  ).join("\n");

  const query = `Analyze the following IT due diligence findings for "${dealName}" (${industry} industry).
Provide:
1. Risk prioritization and remediation recommendations
2. Estimated CapEx for remediation per finding
3. Integration timeline impact assessment
4. Key risk themes and patterns

Findings:
${findingSummary}`;

  return queryDucky(query, {
    dealName,
    industry,
    findingCount: findings.length,
  });
}

/**
 * Generate an AI-powered section narrative for an assessment section.
 */
export async function generateSectionNarrative(
  sectionName: string,
  dealName: string,
  evidenceSummaries: string[],
  existingFindings: string[]
): Promise<DuckyAnalysisResponse> {
  const query = `Generate a professional IT due diligence narrative for the "${sectionName}" section of the assessment for "${dealName}".

Evidence collected:
${evidenceSummaries.map(e => `- ${e}`).join("\n") || "No evidence collected yet."}

Related findings:
${existingFindings.map(f => `- ${f}`).join("\n") || "No findings recorded yet."}

Write a concise, professional assessment narrative. Tag evidence confidence levels as OBSERVED (directly verified), REPRESENTED (stated by target), or UNVERIFIED (not yet confirmed).`;

  return queryDucky(query, {
    sectionName,
    dealName,
  });
}
