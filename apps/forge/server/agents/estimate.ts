/**
 * ESTIMATE Agent — Stage 2
 *
 * Calculates projected credit cost before execution.
 * Model: claude-haiku-4-5 (lightweight, cost-efficient)
 * No credits consumed during estimation.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type { ProjectSpec, CostEstimate } from "@shared/models/pipeline";
import { APP_CODE } from "../llm.config";

const SYSTEM_PROMPT = `You are Forge's Cost Estimation Agent. Given a project specification, estimate the credits needed.

Credit cost heuristics:
- Research: 2 credits per section requiring external data, 1 per section using only brief context
- Generation: 3 credits per section (standard), 5 for complex/long sections
- Rendering: 2 credits for DOCX, 3 for PDF, 1 for Markdown
- Minimum project cost: 5 credits

Estimate duration in minutes:
- Simple projects (1-3 sections): 1-2 min
- Medium projects (4-8 sections): 2-4 min
- Large projects (9+ sections): 3-6 min

Output ONLY valid JSON:
{
  "researchCredits": number,
  "generationCredits": number,
  "renderingCredits": number,
  "totalCredits": number,
  "breakdown": [{ "label": "string", "credits": number, "detail": "string" }],
  "estimatedDurationMinutes": number
}`;

export async function runEstimateAgent(
  spec: ProjectSpec,
  outputFormat: string,
  tenantId: string,
  userId: string,
): Promise<CostEstimate> {
  const userMessage = `Project: "${spec.title}"
Sections: ${spec.sections.length} sections
${spec.sections.map((s) => `  - ${s.title}: ${s.brief}`).join("\n")}
Output format: ${outputFormat}
Word count target: ${spec.wordCountTarget ?? "Not specified"}
Tone: ${spec.tone}`;

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "analysis",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    options: {
      maxTokens: 2048,
      temperature: 0.2,
    },
  });

  const estimate = JSON.parse(response.content) as CostEstimate;

  // Ensure totalCredits is at least 5
  if (estimate.totalCredits < 5) {
    estimate.totalCredits = 5;
  }

  return estimate;
}
