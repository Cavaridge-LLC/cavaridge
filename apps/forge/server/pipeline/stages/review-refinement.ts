/**
 * Stage 3: Review & Refinement
 *
 * Scores content quality against the original brief, catches
 * issues, and auto-refines sections that fall below threshold.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import { APP_CODE, QC_THRESHOLD, MAX_AUTO_REVISIONS } from "../../llm.config";
import type {
  PipelineState,
  ForgeBrief,
  ContentPayload,
  QualityReport,
  GeneratedSection,
  BrandVoiceConfig,
} from "@shared/models/pipeline";
import type { StageHandler } from "../engine";

const REVIEW_SYSTEM_PROMPT = `You are Ducky, the Quality Control agent for Forge. Review generated content against the original brief.

Evaluate each section on:
1. Relevance — Does the content address what was requested?
2. Accuracy — Are facts and claims reasonable? Any potential hallucinations?
3. Completeness — Are all requested aspects covered?
4. Tone — Does it match the requested tone and audience?
5. Structure — Is it well-organized with clear flow?
6. Word Count — Is it close to the target?

Scoring:
- 0.0-0.49: Major issues
- 0.50-0.74: Needs improvement
- 0.75-0.89: Good quality
- 0.90-1.0: Excellent

Output ONLY valid JSON:
{
  "overallScore": 0.0-1.0,
  "sectionScores": [{ "sectionId": "string", "sectionTitle": "string", "score": 0.0-1.0, "feedback": "string" }],
  "issues": [{ "sectionId": "string" | null, "severity": "critical" | "warning" | "info", "description": "string", "suggestion": "string" }],
  "recommendations": ["string"],
  "passesThreshold": boolean
}

The threshold for passing is ${QC_THRESHOLD}.`;

const REFINE_SYSTEM_PROMPT = `You are Forge's Refinement Agent. Fix specific issues in generated content based on quality review feedback.

Rules:
- Only modify sections that have issues flagged
- Preserve the overall structure and tone
- Address each issue specifically
- Maintain word count targets
- Output the revised content as markdown text only (no JSON wrapper)`;

async function reviewContent(
  state: PipelineState,
  tenantId: string,
  userId: string,
): Promise<QualityReport> {
  const spec = state.projectSpec!;
  const content = state.contentPayload!;

  const sectionReview = content.sections
    .map((s) => `## ${s.title} (${s.wordCount} words)\n${s.content}`)
    .join("\n\n---\n\n");

  const sectionBriefs = spec.sections
    .map((s) => `- ${s.title}: ${s.brief}`)
    .join("\n");

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "analysis",
    tenantId,
    userId,
    system: REVIEW_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Review this content against the original brief:

ORIGINAL BRIEF:
Title: "${spec.title}"
Audience: ${spec.audience}
Tone: ${spec.tone}
Requested sections:
${sectionBriefs}
Constraints: ${spec.constraints.join(", ") || "None"}

GENERATED CONTENT (${content.metadata.totalWordCount} total words):
${sectionReview}`,
    }],
    options: { maxTokens: 4096, temperature: 0.2 },
  });

  const report = JSON.parse(response.content) as QualityReport;
  report.passesThreshold = report.overallScore >= QC_THRESHOLD;
  return report;
}

async function refineSection(
  section: GeneratedSection,
  qualityReport: QualityReport,
  tenantId: string,
  userId: string,
): Promise<GeneratedSection> {
  const sectionIssues = qualityReport.issues.filter((i) => i.sectionId === section.id);
  const sectionScore = qualityReport.sectionScores.find((s) => s.sectionId === section.id);

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "generation",
    tenantId,
    userId,
    system: REFINE_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Revise this section to address the following issues:

SECTION: "${section.title}"
CURRENT CONTENT:
${section.content}

ISSUES:
${sectionIssues.map((i) => `- [${i.severity}] ${i.description} → ${i.suggestion}`).join("\n") || "General quality improvement needed"}

QC FEEDBACK: ${sectionScore?.feedback ?? "Improve overall quality"}
CURRENT SCORE: ${sectionScore?.score ?? "N/A"}

Write the improved section content. Output markdown text only.`,
    }],
    options: {
      maxTokens: Math.max(section.wordCount * 2, 2048),
      temperature: 0.4,
    },
  });

  const revisedContent = response.content.trim();
  return {
    ...section,
    content: revisedContent,
    wordCount: revisedContent.split(/\s+/).length,
  };
}

export const reviewRefinementHandler: StageHandler = async (
  state: PipelineState,
  _brief: ForgeBrief,
  tenantId: string,
  userId: string,
  _brandVoice?: BrandVoiceConfig,
): Promise<PipelineState> => {
  if (!state.contentPayload || !state.projectSpec) {
    throw new Error("Draft Generation stage must complete before Review & Refinement");
  }

  let currentContent = state.contentPayload;
  let qualityReport: QualityReport | undefined;

  for (let attempt = 0; attempt <= MAX_AUTO_REVISIONS; attempt++) {
    qualityReport = await reviewContent(
      { ...state, contentPayload: currentContent },
      tenantId,
      userId,
    );

    if (qualityReport.passesThreshold || attempt === MAX_AUTO_REVISIONS) {
      break;
    }

    // Auto-refine low-scoring sections
    const lowScoreSections = new Set([
      ...qualityReport.sectionScores
        .filter((s) => s.score < QC_THRESHOLD)
        .map((s) => s.sectionId),
      ...qualityReport.issues
        .filter((i) => i.sectionId && i.severity === "critical")
        .map((i) => i.sectionId!),
    ]);

    const revisedSections: GeneratedSection[] = [];
    for (const section of currentContent.sections) {
      if (lowScoreSections.has(section.id)) {
        revisedSections.push(await refineSection(section, qualityReport, tenantId, userId));
      } else {
        revisedSections.push(section);
      }
    }

    const totalWordCount = revisedSections.reduce((sum, s) => sum + s.wordCount, 0);
    currentContent = {
      sections: revisedSections,
      metadata: { ...currentContent.metadata, totalWordCount },
    };

    state.revisionCount++;
  }

  return {
    ...state,
    contentPayload: currentContent,
    qualityReport,
  };
};
