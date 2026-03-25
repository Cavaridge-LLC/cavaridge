/**
 * Stage 4: Formatting & Polish
 *
 * Applies final formatting, consistency checks, and brand voice
 * polish to the reviewed content.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import { APP_CODE } from "../../llm.config";
import type {
  PipelineState,
  ForgeBrief,
  PolishedPayload,
  BrandVoiceConfig,
} from "@shared/models/pipeline";
import type { StageHandler } from "../engine";

const SYSTEM_PROMPT = `You are Forge's Formatting & Polish Agent (powered by Ducky Intelligence). Apply final formatting and consistency improvements to content.

Your job:
1. Ensure consistent formatting throughout (headings, lists, bold/italic)
2. Fix any grammatical or spelling issues
3. Ensure smooth transitions between sections
4. Apply brand voice guidelines if provided
5. Verify word count consistency
6. Add proper markdown formatting for the target output

Output ONLY valid JSON:
{
  "sections": [{
    "id": "string",
    "title": "string",
    "content": "string (polished markdown)",
    "headingLevel": 1 | 2 | 3,
    "order": number,
    "wordCount": number
  }],
  "polishNotes": ["string — changes made"]
}

Make minimal changes — preserve the author's voice and intent. Focus on polish, not rewrites.`;

function buildBrandVoiceInstructions(brandVoice?: BrandVoiceConfig): string {
  if (!brandVoice) return "";
  return `

Brand Voice Guidelines to enforce:
- Tone: ${brandVoice.tone}
- Preferred terms: ${brandVoice.vocabulary.join(", ")}
- Style: ${brandVoice.styleGuide}
- Terms to avoid (replace with preferred alternatives): ${brandVoice.avoidTerms.join(", ")}
- Example on-brand phrases: ${brandVoice.examplePhrases.join(" | ")}`;
}

export const formattingPolishHandler: StageHandler = async (
  state: PipelineState,
  brief: ForgeBrief,
  tenantId: string,
  userId: string,
  brandVoice?: BrandVoiceConfig,
): Promise<PipelineState> => {
  if (!state.contentPayload || !state.projectSpec) {
    throw new Error("Review & Refinement stage must complete before Formatting & Polish");
  }

  const content = state.contentPayload;
  const spec = state.projectSpec;

  const sectionContent = content.sections
    .map((s) => `### Section: "${s.title}" (H${s.headingLevel}, order ${s.order})\n\n${s.content}`)
    .join("\n\n---\n\n");

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "generation",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Polish and format this content:

Document: "${spec.title}"
Content type: ${brief.contentType}
Output format: ${brief.outputFormat}
Tone: ${spec.tone}
Audience: ${spec.audience}

SECTIONS:
${sectionContent}
${buildBrandVoiceInstructions(brandVoice)}`,
    }],
    options: {
      maxTokens: 8192,
      temperature: 0.3,
    },
  });

  const parsed = JSON.parse(response.content) as {
    sections: Array<{
      id: string;
      title: string;
      content: string;
      headingLevel: 1 | 2 | 3;
      order: number;
      wordCount: number;
    }>;
    polishNotes: string[];
  };

  const totalWordCount = parsed.sections.reduce((sum, s) => sum + s.wordCount, 0);

  const polishedPayload: PolishedPayload = {
    sections: parsed.sections,
    metadata: {
      totalWordCount,
      generationModel: content.metadata.generationModel,
      polishNotes: parsed.polishNotes,
    },
  };

  // Update stage record
  const stageRecord = state.stages.find((s) => s.stage === "formatting_polish");
  if (stageRecord) {
    stageRecord.inputTokens = response.tokens.input;
    stageRecord.outputTokens = response.tokens.output;
  }

  return {
    ...state,
    polishedPayload,
  };
};
