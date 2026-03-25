/**
 * Stage 2: Draft Generation
 *
 * Produces actual content for each section, guided by the outline
 * and research from Stage 1.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import { APP_CODE } from "../../llm.config";
import type {
  PipelineState,
  ForgeBrief,
  ContentPayload,
  GeneratedSection,
  OutlineEntry,
  BrandVoiceConfig,
} from "@shared/models/pipeline";
import type { StageHandler } from "../engine";

const SYSTEM_PROMPT = `You are Forge's Content Generation Agent (powered by Ducky Intelligence). Write high-quality content for a specific section of a document.

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

function buildBrandVoiceInstructions(brandVoice?: BrandVoiceConfig): string {
  if (!brandVoice) return "";
  return `\nBrand Voice:
- Tone: ${brandVoice.tone}
- Use these terms when appropriate: ${brandVoice.vocabulary.join(", ")}
- Style: ${brandVoice.styleGuide}
- NEVER use: ${brandVoice.avoidTerms.join(", ")}`;
}

async function generateSection(
  section: OutlineEntry,
  state: PipelineState,
  brief: ForgeBrief,
  previousSections: GeneratedSection[],
  tenantId: string,
  userId: string,
  brandVoice?: BrandVoiceConfig,
): Promise<GeneratedSection> {
  const spec = state.projectSpec!;
  const research = state.researchPayload!;

  const previousContext = previousSections.length > 0
    ? `\nPrevious sections (for context/continuity):\n${previousSections.map((s) => `[${s.title}]: ${s.content.slice(0, 200)}...`).join("\n")}`
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
Target word count: ${section.wordCountTarget} words
Heading level: H${section.headingLevel}

Document context:
- Title: "${spec.title}"
- Content type: ${brief.contentType}
- Audience: ${spec.audience}
- Tone: ${spec.tone}

Relevant research:
${relevantFindings || "No specific findings"}

Key data points:
${relevantData || "None"}
${previousContext}
${buildBrandVoiceInstructions(brandVoice)}

Write the section content now. Output markdown-formatted text only.`;

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "generation",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    options: {
      maxTokens: Math.max(section.wordCountTarget * 2, 2048),
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

function flattenOutline(entries: OutlineEntry[]): OutlineEntry[] {
  const flat: OutlineEntry[] = [];
  for (const entry of entries) {
    flat.push(entry);
    if (entry.subsections) {
      flat.push(...flattenOutline(entry.subsections));
    }
  }
  return flat;
}

export const draftGenerationHandler: StageHandler = async (
  state: PipelineState,
  brief: ForgeBrief,
  tenantId: string,
  userId: string,
  brandVoice?: BrandVoiceConfig,
): Promise<PipelineState> => {
  if (!state.researchPayload || !state.projectSpec) {
    throw new Error("Research & Outline stage must complete before Draft Generation");
  }

  const allSections = flattenOutline(state.researchPayload.outline);
  const generatedSections: GeneratedSection[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Generate sections sequentially for coherence
  for (const section of allSections) {
    const generated = await generateSection(
      section,
      state,
      brief,
      generatedSections,
      tenantId,
      userId,
      brandVoice,
    );
    generatedSections.push(generated);
  }

  const totalWordCount = generatedSections.reduce((sum, s) => sum + s.wordCount, 0);

  const contentPayload: ContentPayload = {
    sections: generatedSections,
    metadata: {
      totalWordCount,
      generationModel: "claude-sonnet-4",
    },
  };

  // Update stage record
  const stageRecord = state.stages.find((s) => s.stage === "draft_generation");
  if (stageRecord) {
    stageRecord.inputTokens = totalInputTokens;
    stageRecord.outputTokens = totalOutputTokens;
  }

  return {
    ...state,
    contentPayload,
  };
};
