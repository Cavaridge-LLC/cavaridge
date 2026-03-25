/**
 * Stage 1: Research & Outline
 *
 * Analyzes the brief, gathers research findings, and produces
 * a structured outline for the content piece.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import { nanoid } from "nanoid";
import { APP_CODE } from "../../llm.config";
import type {
  PipelineState,
  ForgeBrief,
  ProjectSpec,
  ResearchPayload,
  BrandVoiceConfig,
} from "@shared/models/pipeline";
import type { StageHandler } from "../engine";

const SYSTEM_PROMPT = `You are Forge's Research & Outline Agent (powered by Ducky Intelligence). Your job is to:
1. Analyze the content brief to understand what needs to be created
2. Research the topic and gather relevant findings
3. Produce a structured outline with sections, word counts, and heading levels

Output ONLY valid JSON matching this schema:
{
  "projectSpec": {
    "title": "string",
    "sections": [{ "id": "string", "title": "string", "brief": "string", "order": number }],
    "audience": "string",
    "tone": "professional" | "casual" | "creative" | "technical" | "academic",
    "formatRequirements": ["string"],
    "constraints": ["string"],
    "wordCountTarget": number | null
  },
  "researchPayload": {
    "structuredFindings": [{ "topic": "string", "summary": "string", "relevance": 0.0-1.0 }],
    "sources": [{ "url": "string", "title": "string", "snippet": "string" }],
    "dataPoints": [{ "label": "string", "value": "string", "source": "string" | null }],
    "outline": [{
      "id": "string",
      "title": "string",
      "brief": "string (detailed, with research incorporated)",
      "headingLevel": 1 | 2 | 3,
      "order": number,
      "wordCountTarget": number,
      "subsections": [same structure] | null
    }]
  }
}

Guidelines:
- Generate unique short alphanumeric IDs for sections
- If tone is not specified, default to "professional"
- Match the content type expectations (blog posts are different from white papers)
- Include specific data points, statistics, and examples from research
- Word counts should be realistic for the content type
- Brief documents: 500-1500 words, standard: 1500-4000, comprehensive: 4000-8000`;

function buildBrandVoiceContext(brandVoice?: BrandVoiceConfig): string {
  if (!brandVoice) return "";
  return `\nBrand Voice Guidelines:
- Tone: ${brandVoice.tone}
- Preferred vocabulary: ${brandVoice.vocabulary.join(", ")}
- Style guide: ${brandVoice.styleGuide}
- Terms to avoid: ${brandVoice.avoidTerms.join(", ")}
- Example phrases: ${brandVoice.examplePhrases.join(" | ")}`;
}

export const researchOutlineHandler: StageHandler = async (
  state: PipelineState,
  brief: ForgeBrief,
  tenantId: string,
  userId: string,
  brandVoice?: BrandVoiceConfig,
): Promise<PipelineState> => {
  const userMessage = `Create a research summary and structured outline for:

Content Type: ${brief.contentType}
Description: ${brief.description}
Output Format: ${brief.outputFormat}
${brief.audience ? `Audience: ${brief.audience}` : ""}
${brief.tone ? `Tone: ${brief.tone}` : ""}
${brief.referenceNotes ? `Additional notes: ${brief.referenceNotes}` : ""}
${buildBrandVoiceContext(brandVoice)}`;

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "research",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    options: {
      maxTokens: 8192,
      temperature: 0.4,
    },
  });

  const parsed = JSON.parse(response.content) as {
    projectSpec: ProjectSpec;
    researchPayload: ResearchPayload;
  };

  // Ensure sections have IDs
  parsed.projectSpec.sections = parsed.projectSpec.sections.map((s, i) => ({
    ...s,
    id: s.id || nanoid(8),
    order: s.order ?? i + 1,
  }));

  parsed.researchPayload.outline = parsed.researchPayload.outline.map((o, i) => ({
    ...o,
    id: o.id || nanoid(8),
    order: o.order ?? i + 1,
  }));

  // Update stage record with token usage
  const stageRecord = state.stages.find((s) => s.stage === "research_outline");
  if (stageRecord) {
    stageRecord.inputTokens = response.tokens.input;
    stageRecord.outputTokens = response.tokens.output;
    stageRecord.intermediateOutput = parsed as unknown;
  }

  return {
    ...state,
    projectSpec: parsed.projectSpec,
    researchPayload: parsed.researchPayload,
  };
};
