/**
 * CVG-AEGIS — AI Analysis Service
 *
 * All AI calls route through Ducky (app_code=CVG-AEGIS) via Spaniel.
 * Provides: risk narratives, executive summaries, remediation prioritization.
 */

import {
  SpanielClient,
  type SpanielClientConfig,
  type SpanielChatResponse,
} from "../lib/spaniel-client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiAnalysisRequest {
  tenantId: string;
  userId: string;
  analysisType: "risk_narrative" | "executive_summary" | "remediation_priority" | "posture_report";
  context: Record<string, unknown>;
}

export interface AiAnalysisResult {
  content: string;
  modelUsed: string | null;
  tokensUsed: number;
  cost: number;
}

// ---------------------------------------------------------------------------
// Spaniel Client Singleton
// ---------------------------------------------------------------------------

let _client: SpanielClient | null = null;

function getSpanielClient(): SpanielClient {
  if (!_client) {
    const config: SpanielClientConfig = {
      baseUrl: process.env.SPANIEL_URL || "http://localhost:5100",
      serviceToken: process.env.SPANIEL_SERVICE_TOKEN || "",
      timeoutMs: parseInt(process.env.SPANIEL_TIMEOUT_MS || "60000", 10),
      maxRetries: 2,
    };
    _client = new SpanielClient(config);
  }
  return _client;
}

// ---------------------------------------------------------------------------
// System Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<string, string> = {
  risk_narrative: `You are Ducky Intelligence, the AI analysis engine for AEGIS Security Posture Platform by Cavaridge.
Generate a clear, professional risk narrative based on the provided security findings.
Use direct, actionable language. Frame findings as remediation opportunities.
NEVER frame findings in a way that suggests MSP negligence or mismanagement.
Evidence tagging: use OBSERVED for scan-confirmed data, REPRESENTED for self-reported data.
Risk color-coding: Critical (red), High (orange), Medium (yellow), Low (green).`,

  executive_summary: `You are Ducky Intelligence, the AI analysis engine for AEGIS Security Posture Platform by Cavaridge.
Generate a concise executive summary suitable for a QBR or board presentation.
Lead with the overall posture score and trend, then highlight top 3 priorities.
Use professional, non-technical language accessible to business stakeholders.
NEVER frame findings as MSP negligence. Frame as improvement opportunities.`,

  remediation_priority: `You are Ducky Intelligence, the AI analysis engine for AEGIS Security Posture Platform by Cavaridge.
Analyze the provided findings and generate a prioritized remediation plan.
Order by: (1) business impact, (2) effort required, (3) compliance frameworks addressed.
Provide estimated effort (hours), recommended role, and compliance mapping for each item.
NEVER frame findings as MSP negligence.`,

  posture_report: `You are Ducky Intelligence, the AI analysis engine for AEGIS Security Posture Platform by Cavaridge.
Generate a comprehensive security posture report section based on the data provided.
Include: current state assessment, trend analysis, peer comparison context, and recommendations.
Use structured format with headers, bullet points, and tables where appropriate.
NEVER frame findings as MSP negligence.`,
};

// ---------------------------------------------------------------------------
// Analysis Functions
// ---------------------------------------------------------------------------

/**
 * Run an AI analysis via Ducky/Spaniel.
 * Returns the analysis content or throws on failure.
 */
export async function runAiAnalysis(req: AiAnalysisRequest): Promise<AiAnalysisResult> {
  const client = getSpanielClient();
  const systemPrompt = SYSTEM_PROMPTS[req.analysisType] ?? SYSTEM_PROMPTS["risk_narrative"];

  const response: SpanielChatResponse = await client.chat({
    tenantId: req.tenantId,
    userId: req.userId,
    appCode: "CVG-AEGIS",
    taskType: `aegis_${req.analysisType}`,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: JSON.stringify(req.context),
      },
    ],
    options: {
      temperature: 0.3,
      maxTokens: 4096,
    },
  });

  return {
    content: response.content,
    modelUsed: response.models_used?.primary ?? null,
    tokensUsed: response.tokens?.total ?? 0,
    cost: response.cost?.amount ?? 0,
  };
}

/**
 * Check if AI analysis capability is available.
 */
export function hasAiCapability(): boolean {
  return !!(process.env.SPANIEL_URL || process.env.NODE_ENV !== "production");
}
