/**
 * RESEARCH Agent — Stage 3
 *
 * Gathers context and source material relevant to the brief.
 * Reuses ResearchAgent from @cavaridge/agents when available;
 * falls back to direct Spaniel call for MVP.
 *
 * Model: claude-sonnet-4 (good reasoning)
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type { ProjectSpec, ResearchPayload } from "@shared/models/pipeline";
import { APP_CODE } from "../llm.config";

const SYSTEM_PROMPT = `You are Forge's Research Agent. Given a project specification, gather and synthesize relevant information to support content creation.

For each section in the project, identify:
1. Key facts and data points needed
2. Industry context or background information
3. Best practices or recommended approaches
4. Relevant terminology and definitions

Output ONLY valid JSON:
{
  "structuredFindings": [{ "topic": "string", "summary": "string", "relevance": 0.0-1.0 }],
  "sources": [{ "url": "string", "title": "string", "snippet": "string" }],
  "dataPoints": [{ "label": "string", "value": "string", "source": "string" | null }],
  "templateMatches": []
}

Focus on accuracy and relevance. Include specific data points, statistics, and examples.
If the topic is specialized, provide domain-specific context.
Sources should be plausible references (note: you cannot browse the web, so provide authoritative source suggestions).`;

export async function runResearchAgent(
  spec: ProjectSpec,
  tenantId: string,
  userId: string,
): Promise<ResearchPayload> {
  const sectionBriefs = spec.sections
    .map((s) => `${s.title}: ${s.brief}`)
    .join("\n");

  const userMessage = `Research the following project to support content generation:

Title: "${spec.title}"
Audience: ${spec.audience}
Tone: ${spec.tone}

Sections to research:
${sectionBriefs}

Constraints: ${spec.constraints.join(", ") || "None"}
Format requirements: ${spec.formatRequirements.join(", ") || "None"}`;

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

  return JSON.parse(response.content) as ResearchPayload;
}
