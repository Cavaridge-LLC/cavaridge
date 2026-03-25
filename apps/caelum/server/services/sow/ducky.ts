/**
 * Caelum → Ducky Integration
 * Spec: SOW-MASTER-SPEC-v2_2.md (2026-03-24, LOCKED)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 *
 * All LLM calls go through Ducky's HTTP API (POST /v1/app-query).
 * Caelum never calls Spaniel/OpenRouter directly for content generation.
 * Ducky handles model routing, fallback, cost tracking, and observability.
 */

import type { SowDocumentV2 } from "../../../shared/models/sow";

const DUCKY_BASE_URL = process.env.DUCKY_API_URL || "http://localhost:4001";
const APP_CODE = "CVG-CAELUM";

interface DuckyAppQueryRequest {
  app_code: string;
  tenant_id: string;
  user_id: string;
  query: string;
  context?: Record<string, unknown>;
  task_type?: string;
}

interface DuckyAppQueryResponse {
  content: string;
  model_used?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Sends an app-query to Ducky's intelligence API.
 * Returns the raw content string from Ducky's response.
 */
async function queryDucky(params: DuckyAppQueryRequest): Promise<DuckyAppQueryResponse> {
  const url = `${DUCKY_BASE_URL}/v1/app-query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Service-to-service auth token — loaded from Doppler in prod
      ...(process.env.DUCKY_SERVICE_TOKEN
        ? { Authorization: `Bearer ${process.env.DUCKY_SERVICE_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ducky API error: ${response.status} ${response.statusText} — ${body}`);
  }

  return response.json() as Promise<DuckyAppQueryResponse>;
}

/**
 * Generates a full SoW section using Ducky intelligence.
 * Returns the generated content as a string.
 */
export async function generateSowSection(params: {
  tenantId: string;
  userId: string;
  sectionName: string;
  projectContext: string;
  existingContent?: string;
  vendorName?: string;
}): Promise<string> {
  const { tenantId, userId, sectionName, projectContext, existingContent, vendorName } = params;

  const query = buildSectionPrompt(sectionName, projectContext, existingContent, vendorName);

  const response = await queryDucky({
    app_code: APP_CODE,
    tenant_id: tenantId,
    user_id: userId,
    query,
    context: {
      feature: "sow-section-generation",
      section: sectionName,
    },
    task_type: "generation",
  });

  return response.content;
}

/**
 * Generates a complete SoW document draft from a project brief.
 * Returns raw JSON content that should be parsed into SowDocumentV2.
 */
export async function generateFullSowDraft(params: {
  tenantId: string;
  userId: string;
  projectBrief: string;
  vendorName: string;
  vendorAbbreviation: string;
  templateDocument?: Partial<SowDocumentV2>;
}): Promise<string> {
  const { tenantId, userId, projectBrief, vendorName, vendorAbbreviation, templateDocument } = params;

  let query = `You are an elite vCIO and SoW writer for ${vendorName} (${vendorAbbreviation}). Generate a complete Statement of Work JSON document following the SOW-MASTER-SPEC v2.2 format.

PROJECT BRIEF:
${projectBrief}

Generate a JSON object with this exact structure (SOW-MASTER-SPEC v2.2, 8 mandatory sections):

1. "cover" — client, facility (optional), projectName, provider ("${vendorName}"), billingModel, documentDate, version "1.0", classification "Confidential"
2. "summary" — 1-3 paragraph narrative
3. "proposedSolution" — overview narrative + numbered subsections + optional componentsTable, keyDeliverables, exclusionNotes
4. "prerequisites" — array of specific, verifiable prerequisite strings
5. "projectManagement" — siteAddress, contacts array, pmTasks array (MUST include these 3 mandatory tasks verbatim):
   - "Provide project plan with milestones (if applicable) and estimated time of completion."
   - "Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting."
   - "Remove old documentation references and update documentation to reflect new configurations."
6. "phases" — array of phase objects (number, title, objective, tasks[], deliverables[])
7. "caveatsRisks" — exclusions[], assumptions[], risks[] (each with risk, impact, mitigation), changeControl string
8. "completionCriteria" — array of measurable completion criteria
9. "laborHours" — format "v2.1", rows[] with role/scope/hoursRange (RANGES ONLY like "8 – 12", NO pricing), totalHoursRange, notes[]

IMPORTANT RULES:
- NO approval section unless explicitly requested
- Labor hours: Role | Scope | Hour RANGES ONLY — NO rates, NO pricing, NO dollar amounts
- Every SoW MUST include Project Manager hours
- Do NOT include estimated hours per phase in the outline
- Return ONLY the JSON object, no markdown wrapping`;

  if (templateDocument) {
    query += `\n\nUse this template as a starting point:\n${JSON.stringify(templateDocument, null, 2)}`;
  }

  const response = await queryDucky({
    app_code: APP_CODE,
    tenant_id: tenantId,
    user_id: userId,
    query,
    context: {
      feature: "sow-full-generation",
      vendorName,
    },
    task_type: "generation",
  });

  return response.content;
}

/**
 * Performs a grammar and quality check on SoW content via Ducky.
 */
export async function grammarCheckViaDucky(params: {
  tenantId: string;
  userId: string;
  content: string;
}): Promise<string[]> {
  const response = await queryDucky({
    app_code: APP_CODE,
    tenant_id: params.tenantId,
    user_id: params.userId,
    query: `You are a professional technical editor reviewing an IT Scope of Work document. Check for:
1. Spelling errors
2. Grammar issues
3. Awkward phrasing or unclear language
4. Inconsistent terminology
5. Missing articles or prepositions
6. Run-on sentences

Return a JSON array of strings, where each string is a specific, actionable suggestion. Include the exact text that needs fixing and the suggested correction. If no issues are found, return an empty array [].
Format: ["Section X: 'original text' should be 'corrected text' — reason", ...]
Return ONLY the JSON array, no markdown, no explanation.

DOCUMENT TO REVIEW:
${params.content}`,
    context: { feature: "grammar-check" },
    task_type: "analysis",
  });

  try {
    const cleaned = response.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const suggestions = JSON.parse(cleaned);
    return Array.isArray(suggestions) ? suggestions : [];
  } catch {
    return response.content.split("\n").filter((l: string) => l.trim().length > 0);
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSectionPrompt(
  sectionName: string,
  projectContext: string,
  existingContent?: string,
  vendorName?: string,
): string {
  const vendor = vendorName || "[Provider]";
  const base = `You are an elite vCIO and SoW writer for ${vendor}. Generate content for the "${sectionName}" section of a Statement of Work following SOW-MASTER-SPEC v2.2.

PROJECT CONTEXT:
${projectContext}`;

  if (existingContent) {
    return `${base}

EXISTING CONTENT TO IMPROVE:
${existingContent}

Improve the existing content. Make it more concise, professional, and contract-safe. Return only the improved content.`;
  }

  const sectionGuidance: Record<string, string> = {
    summary: "Write 1-3 paragraphs of plain narrative. State who the client is, what the business need is, and what the provider will do. If fixed-fee, state that work beyond this scope requires a separate SoW or change order.",
    proposedSolution: "Start with 1-2 paragraphs describing the overall approach and expected outcome. Then concise bullet points. Each bullet = one action, one sentence.",
    prerequisites: "List 5-10 specific, verifiable conditions that must be met before work begins. Each must be a clear, actionable requirement.",
    projectManagement: "Include the 3 mandatory PM tasks verbatim, then any additional project-specific management items.",
    phases: "Create a phased project outline. Each phase needs: number, title, one-line objective, 2-4 task bullets, 1-3 deliverables. Do NOT include hours per phase.",
    caveatsRisks: "Include scope exclusions, assumptions (5-8 max), risks with impact and mitigation, and a change control statement.",
    completionCriteria: "List specific, measurable conditions that define project completion. Map to deliverables.",
    laborHours: "List roles with scope of involvement and hour RANGES (e.g., '8 – 12'). Include Project Manager. NO rates, NO pricing.",
  };

  const guidance = sectionGuidance[sectionName] || "Generate appropriate content for this section.";

  return `${base}

SECTION GUIDANCE:
${guidance}

Write concise, professional content. Sound like a senior MSP architect. Short sentences. Practical bullets. Decisive verbs.
Return only the section content, no JSON wrapping.`;
}
