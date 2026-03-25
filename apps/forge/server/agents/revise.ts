/**
 * REVISION Agent
 *
 * Targeted content fixes based on QC feedback or user revision requests.
 * Free revisions: up to 3 per project.
 * Auto-revisions (internal QC loops) never charge credits.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type { ContentPayload, QualityReport, GeneratedSection } from "@shared/models/pipeline";
import { APP_CODE } from "../llm.config";

const SYSTEM_PROMPT = `You are Forge's Revision Agent. Your job is to fix specific issues in generated content based on quality review feedback.

Rules:
- Only modify sections that have issues flagged
- Preserve the overall structure and tone
- Address each issue specifically
- Maintain word count targets
- Output the revised content as markdown text only (no JSON wrapper)`;

export async function runRevisionAgent(
  content: ContentPayload,
  qualityReport: QualityReport,
  tenantId: string,
  userId: string,
): Promise<ContentPayload> {
  const issuesBySectionId = new Map<string, typeof qualityReport.issues>();
  for (const issue of qualityReport.issues) {
    if (issue.sectionId) {
      const existing = issuesBySectionId.get(issue.sectionId) ?? [];
      existing.push(issue);
      issuesBySectionId.set(issue.sectionId, existing);
    }
  }

  const lowScoreSections = qualityReport.sectionScores
    .filter((s) => s.score < 0.75)
    .map((s) => s.sectionId);

  const sectionsToRevise = new Set([
    ...Array.from(issuesBySectionId.keys()),
    ...lowScoreSections,
  ]);

  const revisedSections: GeneratedSection[] = [];

  for (const section of content.sections) {
    if (!sectionsToRevise.has(section.id)) {
      revisedSections.push(section);
      continue;
    }

    const sectionIssues = issuesBySectionId.get(section.id) ?? [];
    const sectionScore = qualityReport.sectionScores.find((s) => s.sectionId === section.id);

    const userMessage = `Revise this section to address the following issues:

SECTION: "${section.title}"
CURRENT CONTENT:
${section.content}

ISSUES:
${sectionIssues.map((i) => `- [${i.severity}] ${i.description} → ${i.suggestion}`).join("\n") || "General quality improvement needed"}

QC FEEDBACK: ${sectionScore?.feedback ?? "Improve overall quality"}
CURRENT SCORE: ${sectionScore?.score ?? "N/A"}

Write the improved section content. Output markdown text only.`;

    const response = await chatCompletion({
      appCode: APP_CODE,
      taskType: "generation",
      tenantId,
      userId,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      options: {
        maxTokens: Math.max(section.wordCount * 2, 2048),
        temperature: 0.4,
      },
    });

    const revisedContent = response.content.trim();

    revisedSections.push({
      ...section,
      content: revisedContent,
      wordCount: revisedContent.split(/\s+/).length,
    });
  }

  const totalWordCount = revisedSections.reduce((sum, s) => sum + s.wordCount, 0);

  return {
    sections: revisedSections,
    metadata: {
      totalWordCount,
      generationModel: content.metadata.generationModel,
    },
  };
}
