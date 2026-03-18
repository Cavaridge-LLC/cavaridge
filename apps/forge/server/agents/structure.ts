/**
 * STRUCTURE Agent — Stage 4
 *
 * Plans output structure: sections, layout, heading hierarchy, word counts.
 * Model: claude-sonnet-4 (reliable planning)
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type { ProjectSpec, ResearchPayload, StructurePlan } from "@shared/models/pipeline";
import { APP_CODE } from "../llm.config";

const SYSTEM_PROMPT = `You are Forge's Structure Agent. Given a project specification and research findings, plan the detailed structure of the output document.

For each section, determine:
1. Final title and heading level (1=H1, 2=H2, 3=H3)
2. Detailed brief incorporating research findings
3. Target word count
4. Ordering
5. Any subsections needed

Guidelines:
- H1 for major sections, H2 for subsections, H3 for sub-subsections
- Word counts should be realistic for the content type
- Total word count should match the target (if specified) or be appropriate for the document type
- Brief documents: 500-1500 words
- Standard reports: 1500-4000 words
- Comprehensive documents: 4000-8000 words

Output ONLY valid JSON:
{
  "orderedSections": [{
    "id": "string",
    "title": "string",
    "brief": "string (detailed, incorporating research)",
    "headingLevel": 1 | 2 | 3,
    "wordCount": number,
    "order": number,
    "subsections": [same structure] | null
  }],
  "totalWordCount": number,
  "pageEstimate": number
}

Page estimate: ~300 words per page for standard documents.`;

export async function runStructureAgent(
  spec: ProjectSpec,
  research: ResearchPayload,
  tenantId: string,
  userId: string,
): Promise<StructurePlan> {
  const researchSummary = research.structuredFindings
    .map((f) => `[${f.topic}] ${f.summary}`)
    .join("\n");

  const dataPointsSummary = research.dataPoints
    .map((d) => `${d.label}: ${d.value}`)
    .join("\n");

  const userMessage = `Plan the document structure:

Project: "${spec.title}"
Audience: ${spec.audience}
Tone: ${spec.tone}
Word count target: ${spec.wordCountTarget ?? "Appropriate for content type"}

Sections from brief:
${spec.sections.map((s) => `${s.order}. ${s.title} — ${s.brief}`).join("\n")}

Research findings:
${researchSummary}

Key data points:
${dataPointsSummary}

Format requirements: ${spec.formatRequirements.join(", ") || "Standard document"}`;

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "analysis",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    options: {
      maxTokens: 4096,
      temperature: 0.3,
    },
  });

  return JSON.parse(response.content) as StructurePlan;
}
