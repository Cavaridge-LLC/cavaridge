/**
 * INTAKE Agent — Stage 1
 *
 * Parses natural language brief into a typed ProjectSpec.
 * Model: claude-sonnet-4 (fast structured extraction)
 */

import { chatCompletion } from "@cavaridge/spaniel";
import { nanoid } from "nanoid";
import type { ForgeBrief, ProjectSpec } from "@shared/models/pipeline";
import { APP_CODE } from "../llm.config";

const SYSTEM_PROMPT = `You are Forge's Intake Agent. Your job is to analyze a user's content creation brief and extract a structured project specification.

Given a natural language description, extract:
1. A clear, concise title for the project
2. An ordered list of sections the output should contain
3. The intended audience
4. The appropriate tone
5. Format-specific requirements
6. Any constraints mentioned

Output ONLY valid JSON matching this schema:
{
  "title": "string",
  "sections": [{ "id": "string", "title": "string", "brief": "string", "order": number }],
  "audience": "string",
  "tone": "professional" | "casual" | "creative" | "technical" | "academic",
  "formatRequirements": ["string"],
  "constraints": ["string"],
  "wordCountTarget": number | null
}

If the user doesn't specify tone, default to "professional".
If sections are unclear, infer a reasonable structure based on the content type.
Generate unique IDs for sections using short alphanumeric strings.`;

export async function runIntakeAgent(brief: ForgeBrief, tenantId: string, userId: string): Promise<ProjectSpec> {
  const userMessage = `Brief: ${brief.description}
Output format: ${brief.outputFormat}
${brief.audience ? `Audience: ${brief.audience}` : ""}
${brief.tone ? `Tone: ${brief.tone}` : ""}
${brief.referenceNotes ? `Additional notes: ${brief.referenceNotes}` : ""}`;

  const response = await chatCompletion({
    appCode: APP_CODE,
    taskType: "extraction",
    tenantId,
    userId,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    options: {
      maxTokens: 4096,
      temperature: 0.3,
    },
  });

  const parsed = JSON.parse(response.content) as ProjectSpec;

  // Ensure sections have IDs and proper ordering
  parsed.sections = parsed.sections.map((s, i) => ({
    ...s,
    id: s.id || nanoid(8),
    order: s.order ?? i + 1,
  }));

  return parsed;
}
