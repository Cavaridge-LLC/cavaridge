/**
 * VALIDATE Agent — Stage 6 (Ducky QC)
 *
 * Scores output quality against original brief.
 * Catches hallucinations, gaps, and formatting issues.
 *
 * Score >= 0.75 → proceed to RENDER
 * Score < 0.75 AND revisionCount < 2 → AUTO-REVISE
 * Score < 0.5 after 2 revisions → surface to user
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type { ProjectSpec, ContentPayload, QualityReport } from "@shared/models/pipeline";
import { APP_CODE, QC_THRESHOLD } from "../llm.config";

const SYSTEM_PROMPT = `You are Ducky, the Quality Control agent for Forge. You review generated content against the original brief to ensure quality.

Evaluate each section on:
1. Relevance — Does the content address what was requested?
2. Accuracy — Are facts and claims reasonable? Any potential hallucinations?
3. Completeness — Are all requested aspects covered?
4. Tone — Does it match the requested tone and audience?
5. Structure — Is it well-organized with clear flow?
6. Word Count — Is it close to the target?

Scoring:
- 0.0-0.49: Major issues (missing sections, wrong topic, hallucinated content)
- 0.50-0.74: Needs improvement (gaps, weak areas, tone mismatches)
- 0.75-0.89: Good quality (minor improvements possible)
- 0.90-1.0: Excellent (ready for delivery)

Output ONLY valid JSON:
{
  "overallScore": 0.0-1.0,
  "sectionScores": [{ "sectionId": "string", "sectionTitle": "string", "score": 0.0-1.0, "feedback": "string" }],
  "issues": [{ "sectionId": "string" | null, "severity": "critical" | "warning" | "info", "description": "string", "suggestion": "string" }],
  "recommendations": ["string"],
  "passesThreshold": boolean
}

Be thorough but fair. The threshold for passing is ${QC_THRESHOLD}.`;

export async function runValidateAgent(
  spec: ProjectSpec,
  content: ContentPayload,
  tenantId: string,
  userId: string,
): Promise<QualityReport> {
  const sectionReview = content.sections
    .map((s) => `## ${s.title} (${s.wordCount} words)\n${s.content}`)
    .join("\n\n---\n\n");

  const sectionBriefs = spec.sections
    .map((s) => `- ${s.title}: ${s.brief}`)
    .join("\n");

  const userMessage = `Review this content against the original brief:

ORIGINAL BRIEF:
Title: "${spec.title}"
Audience: ${spec.audience}
Tone: ${spec.tone}
Requested sections:
${sectionBriefs}
Constraints: ${spec.constraints.join(", ") || "None"}

GENERATED CONTENT (${content.metadata.totalWordCount} total words):
${sectionReview}

Evaluate quality and provide your assessment.`;

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "analysis",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    options: {
      maxTokens: 4096,
      temperature: 0.2,
    },
  });

  const report = JSON.parse(response.content) as QualityReport;
  report.passesThreshold = report.overallScore >= QC_THRESHOLD;

  return report;
}
