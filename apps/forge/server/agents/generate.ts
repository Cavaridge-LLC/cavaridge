/**
 * GENERATE Agent — Stage 5
 *
 * Produces actual content for each section.
 * Model: claude-sonnet-4 (standard) or claude-opus-4 (premium)
 * Sections are generated sequentially for coherence.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type {
  ProjectSpec, ResearchPayload, StructurePlan,
  ContentPayload, GeneratedSection, PlannedSection,
} from "@shared/models/pipeline";
import { APP_CODE } from "../llm.config";

const SYSTEM_PROMPT = `You are Forge's Content Generation Agent. Your job is to write high-quality content for a specific section of a document.

Guidelines:
- Write in the specified tone and for the specified audience
- Use research findings and data points naturally
- Ensure smooth transitions between ideas
- Include specific examples and evidence where appropriate
- Match the target word count closely (within 10%)
- Use proper paragraph structure
- Do NOT include the section title in your output — just the body content
- Output plain text with markdown formatting (headers, bold, lists, etc.)

Output ONLY the section content as markdown text. No JSON wrapping.`;

async function generateSection(
  section: PlannedSection,
  spec: ProjectSpec,
  research: ResearchPayload,
  previousSections: GeneratedSection[],
  tenantId: string,
  userId: string,
): Promise<GeneratedSection> {
  const previousContext = previousSections.length > 0
    ? `\nPrevious sections written (for context/continuity):\n${previousSections.map((s) => `[${s.title}]: ${s.content.slice(0, 200)}...`).join("\n")}`
    : "";

  const relevantFindings = research.structuredFindings
    .filter((f) => f.relevance > 0.5)
    .map((f) => `- ${f.topic}: ${f.summary}`)
    .join("\n");

  const relevantData = research.dataPoints
    .map((d) => `- ${d.label}: ${d.value}`)
    .join("\n");

  const userMessage = `Write content for section: "${section.title}"

Section brief: ${section.brief}
Target word count: ${section.wordCount} words
Heading level: H${section.headingLevel}

Document context:
- Title: "${spec.title}"
- Audience: ${spec.audience}
- Tone: ${spec.tone}

Relevant research:
${relevantFindings || "No specific findings"}

Key data points:
${relevantData || "None"}
${previousContext}

Write the section content now. Output markdown-formatted text only.`;

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "generation",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    options: {
      maxTokens: Math.max(section.wordCount * 2, 2048),
      temperature: 0.6,
    },
  });

  const content = response.content.trim();
  const wordCount = content.split(/\s+/).length;

  return {
    id: section.id,
    title: section.title,
    content,
    headingLevel: section.headingLevel,
    order: section.order,
    wordCount,
  };
}

function flattenSections(sections: PlannedSection[]): PlannedSection[] {
  const flat: PlannedSection[] = [];
  for (const section of sections) {
    flat.push(section);
    if (section.subsections) {
      flat.push(...flattenSections(section.subsections));
    }
  }
  return flat;
}

export async function runGenerateAgent(
  spec: ProjectSpec,
  research: ResearchPayload,
  structure: StructurePlan,
  tenantId: string,
  userId: string,
): Promise<ContentPayload> {
  const allSections = flattenSections(structure.orderedSections);
  const generatedSections: GeneratedSection[] = [];

  // Generate sections sequentially for coherence
  for (const section of allSections) {
    const generated = await generateSection(
      section,
      spec,
      research,
      generatedSections,
      tenantId,
      userId,
    );
    generatedSections.push(generated);
  }

  const totalWordCount = generatedSections.reduce((sum, s) => sum + s.wordCount, 0);

  return {
    sections: generatedSections,
    metadata: {
      totalWordCount,
      generationModel: "claude-sonnet-4",
    },
  };
}
