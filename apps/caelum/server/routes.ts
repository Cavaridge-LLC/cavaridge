import type { Express } from "express";
import { type Server } from "http";
import { registerAuthRoutes, requireAuth } from "./services/auth";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { randomBytes, createHmac } from "crypto";
import { extractFileContent } from "./fileExtractor";
import { chatStorage } from "./services/chat/storage";
import { generatePdf, generateDocx } from "./sowExport";
import { generateDocxV2 } from "./sowDocxExportV2";
import { generateMarkdown } from "./sowMarkdownExport";
import { normalizeSowJson, sowToDuckyPayload } from "../shared/models/sow";
import { getTenantConfig, buildRateCardStringFromConfig, buildRoleEnumFromConfig, buildRateDescriptionFromConfig, type TenantConfig } from "./tenantConfigLoader";
import { ValidationError, NotFoundError, ForbiddenError, InternalError } from "./utils/errors";
import { MODEL_ROSTER } from "./llm.config";
import { tenantScope } from "./middleware/tenantScope";
import { loadUserRole, requireRole, ROLE_NAMES } from "./middleware/rbac";
import { chatCompletion, createSpanielClient } from "@cavaridge/spaniel";
import type { TaskType } from "@cavaridge/spaniel";

const APP_CODE = "CVG-CAELUM";

/** Spaniel client for streaming calls (OpenAI-compatible via OpenRouter) */
const spanielClient = createSpanielClient(APP_CODE);

const upload = multer({ dest: "/tmp/uploads/", limits: { fileSize: 20 * 1024 * 1024 } });

function classifyRequest(lastMessage: string): string[] {
  const lower = lastMessage.toLowerCase();
  const tags: string[] = [];
  if (/generate|build it|write the sow|create.*sow|produce.*scope/i.test(lower)) tags.push("sow-generation", "structured-output", "contract-language");
  if (/risk|threat|vulnerabilit|impact|likelihood/i.test(lower)) tags.push("risk-analysis");
  if (/cost|budget|estimate|hours|rate|price/i.test(lower)) tags.push("cost-estimation");
  if (/plan|phase|timeline|milestone|schedule/i.test(lower)) tags.push("planning");
  if (/review|analyze|check|audit|assess/i.test(lower)) tags.push("analysis", "document-review");
  if (/summar|brief|overview|recap/i.test(lower)) tags.push("summarization");
  if (/idea|suggest|option|alternative|brainstorm/i.test(lower)) tags.push("brainstorming", "alternative-perspectives", "creative");
  if (/detail|extract|specific|break.*down/i.test(lower)) tags.push("detail-extraction");
  if (/technical|architect|design|infrastructure|network|server/i.test(lower)) tags.push("technical-analysis");
  if (tags.length === 0) tags.push("general", "quick-answers");
  return tags;
}

function pickBestModel(tags: string[]): typeof MODEL_ROSTER[number] {
  let bestScore = -1;
  let best = MODEL_ROSTER[0];
  for (const model of MODEL_ROSTER) {
    const score = model.strengths.filter((s: string) => tags.includes(s)).length;
    if (score > bestScore) { bestScore = score; best = model; }
  }
  return best;
}

function pickEnsembleModels(tags: string[]): typeof MODEL_ROSTER[number][] {
  const scored = MODEL_ROSTER.map((m) => ({
    model: m,
    score: m.strengths.filter((s: string) => tags.includes(s)).length,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.model);
}

async function callModel(modelId: string, messages: any[], maxTokens: number): Promise<string> {
  const response = await spanielClient.chat.completions.create({
    model: modelId,
    messages,
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content || "";
}

async function generateTitle(userMessage: string, assistantMessage: string, tenantId: string, userId: string): Promise<string> {
  try {
    const resp = await chatCompletion({
      tenantId,
      userId,
      appCode: APP_CODE,
      taskType: "summarization",
      system: "Generate a short, descriptive title (5-8 words max) for this IT scope conversation. Return ONLY the title text, no quotes, no punctuation at the end. Examples: 'Meraki Network Deployment - Dallas Office', 'Server Migration to Azure', 'Endpoint Rollout for Compass Health'.",
      messages: [
        { role: "user", content: `User said: ${userMessage.substring(0, 500)}\n\nAssistant responded: ${assistantMessage.substring(0, 500)}` },
      ],
      options: { maxTokens: 30, temperature: 0.3 },
    });
    const title = resp.content?.trim().replace(/^["']|["']$/g, "") || "";
    return title || "New Scope";
  } catch {
    return userMessage.substring(0, 80).replace(/\n/g, " ").trim() || "New Scope";
  }
}

const SYNTHESIS_PROMPT = `You are a synthesis expert. You've been given responses from multiple AI models to the same SoW-building question. Your job:

1. Read all responses carefully
2. Extract the strongest elements from each — the best analysis, the most thorough risks, the clearest language, the most practical recommendations
3. Combine them into a single, cohesive response that is better than any individual one
4. If any model produced a SoW JSON block (wrapped in <<<SOW_START>>> / <<<SOW_END>>>), merge the best elements into ONE unified SoW JSON block using the same markers
5. Preserve the voice and style: sound like a senior MSP architect, not a chatbot
6. Do NOT mention that multiple models were consulted — present the answer as one unified response
7. Keep the same <<<SOW_START>>> / <<<SOW_END>>> marker format if a SoW was generated

Respond with the synthesized answer only.`;

function buildSystemPrompt(tc: TenantConfig): string {
  const V = tc.vendorName;
  const VA = tc.vendorAbbreviation;
  const pmTasksJson = JSON.stringify(tc.mandatoryPmTasks);
  const scopeAddOns = tc.scopeTypeAddOns.map((s) => `- ${s}`).join("\n");

  return `You are an elite vCIO + Principal Architect + contract-hardened SoW writer for ${V} (${VA}) / ${tc.parentCompany} (an MSP/MSSP). You work conversationally with the user (Ben or a project lead) to build client-ready Scope of Work documents.

YOUR ROLE HAS TWO MODES:

MODE 1: CONVERSATION (default)
When the user pastes messy notes or asks questions, you:
1. Extract Known Inputs (facts only)
2. Identify the Scope Type: Network Deployment / Onboarding & Stabilization / Endpoint Deployment / Server Virtualization & Recovery / Other
3. Identify gaps — things you need to know to write a complete SoW
4. Ask targeted follow-up questions (grouped, not one-at-a-time) to fill those gaps
5. Suggest improvements, flag risks you see, recommend optional add-ons
6. When the user asks you to generate or says they have enough info, switch to Mode 2

When files are attached, the user will include their extracted content in their message. Read and analyze these files carefully — they may contain meeting notes, existing documents, network diagrams (as text), spreadsheets, or reference material. Incorporate relevant information into your understanding and ask follow-up questions about anything unclear.

In conversation mode, respond in plain text. Be direct, practical, helpful. Sound like a senior architect talking to a peer — not a chatbot. Short paragraphs, bullets when useful.

MODE 2: GENERATE SOW
When the user says "generate", "build it", "write the SoW", or similar — OR when you have enough information and the user confirms — output the final SoW as a JSON block wrapped in <<<SOW_START>>> and <<<SOW_END>>> markers.

The JSON must follow this exact schema (SOW-MASTER-SPEC v2.1):

<<<SOW_START>>>
{
  "title": "string - Project title (Client / Site / Project)",
  "subtitle": "string - What the project is",
  "scopeType": "string - Network Deployment | Onboarding & Stabilization | Endpoint Deployment | Server Virtualization & Recovery | Other",
  "summary": "string - 1-3 paragraphs of plain narrative. State who the client is, what the business need is, and what ${V} will do. If fixed-fee, state that work beyond this scope requires a separate SoW or change order. Use '${VA}' after first mention of '${V}'.",
  "solution": "string - Narrative-first. Begin with 1-2 paragraphs describing the overall approach and expected outcome. Then concise bullet points (use \\\\n\\\\n for line breaks). Each bullet is one concise action sentence.",
  "accessPrerequisites": ["array of strings - 3-5 short bullets covering access and readiness items the client must have ready"],
  "responsibilityMatrix": [
    {
      "area": "string - Responsibility area name",
      "client": "string - One sentence: what the client does for this area",
      "vendor": "string - One sentence: what ${VA} does for this area"
    }
  ],
  "prerequisites": ["array of strings - Numbered conditions that must be satisfied before work begins. Each must be specific and verifiable. 5-10 items."],
  "projectManagement": {
    "siteAddress": "string",
    "contacts": [
      {
        "role": "string - e.g. Client Point of Contact, GC Point of Contact, ISP Broker",
        "name": "string",
        "email": "string or [TBD]",
        "phone": "string or [TBD]"
      }
    ],
    "pm_tasks": ${pmTasksJson}
  },
  "outline": [
    {
      "phase": "Phase N: Name",
      "objective": "string - One sentence: what this phase achieves",
      "tasks": ["array of strings - 2-4 concise task bullets per phase"],
      "deliverables": ["array of strings - 1-3 key deliverables"]
    }
  ],
  "caveatsAndRisks": {
    "exclusions": ["array of strings - What is NOT included in this scope. Be explicit."],
    "assumptions": ["array of strings - Conditions assumed to be true. 5-8 max."],
    "risks": [
      {
        "risk": "string - What could go wrong",
        "impact": "string - What happens if it does",
        "mitigation": "string - Combined mitigation strategy"
      }
    ]
  },
  "completionCriteria": ["array of strings - Specific, measurable conditions that define done. Map to deliverables."],
  "labor_hours": {
    "rows": [
      {
        "role": "string - Generic role: Project Manager | Senior Engineer | Field Technician | Knowledge Transfer | etc.",
        "scope": "string - Description of what this role does across the entire engagement",
        "hours_range": "string - ALWAYS a range like '16 – 24'. NEVER a fixed number."
      }
    ],
    "total_hours_range": "string - Sum of all role ranges, e.g. '56 – 80'",
    "notes": ["array of strings - Contextual notes about the estimate (e.g. travel, after-hours, prerequisites impact)"]
  }
}
<<<SOW_END>>>

IMPORTANT RULES:
- You can include text before or after the SOW markers to explain what you built
- The 3 PM tasks are mandatory and must be included verbatim every time
- No floating TBDs. Convert unknowns into assumptions or risks
- Responsibilities must be crystal clear: Client vs ${V} vs Third Parties
- Every risk needs impact and mitigation — never just a warning
- Completion criteria must be objective and verifiable
- ALWAYS include labor_hours. Assign appropriate generic roles. Estimate hours as RANGES (e.g., "8 – 12"), NEVER fixed numbers. Do NOT include rates, pricing, or dollar amounts of any kind.
- Every SoW MUST include Project Manager hours (minimum "1 – 2" for simple scopes, typically "2 – 4" for standard, "5 – 10" for complex). This is mandatory.
- Do NOT include estimated hours per phase in the outline. Hours appear ONLY in the labor_hours section.
- Do NOT include an approval section unless the user explicitly requests signatures/approval.
- ALWAYS include accessPrerequisites (3-5 short bullets) and responsibilityMatrix (5-8 area rows)
- Exclusions go in caveatsAndRisks.exclusions (not a separate outOfScope field)

SCOPE TYPE ADD-ONS (include when applicable):
${scopeAddOns}

CONCISENESS — THIS IS CRITICAL:
- Write like you're presenting to a client exec — tight, scannable, no filler.
- Summary: 1-3 paragraphs. Use "${VA}" after first mention of "${V}".
- Solution: Narrative-first (1-2 paragraphs), then concise bullet points. Each bullet = one action, one sentence.
- Phases: 2-4 short task bullets per phase. One-line objectives. Deliverables are required.
- Risks: Keep structured but write concisely. One sentence per field.
- Assumptions: 5-8 max. Merge related ones.

STYLE:
- Short sentences. Practical bullets.
- Confident, no fluff. Contract-safe but not legalese.
- Decisive verbs: Configure, Validate, Stage, Cutover, Harden, Document, Handoff.
- Don't blame the client — define responsibility and decision points.
- Sound like Ben (a senior MSP architect), not AI.`;
}

import type { Response } from "express";

async function finishStream(res: Response, isNew: boolean, convoId: number, userMsg: string, assistantMsg: string, tenantId: string, userId: string) {
  if (isNew) {
    const title = await generateTitle(userMsg, assistantMsg, tenantId, userId);
    await chatStorage.updateConversationTitle(convoId, title, tenantId);
    res.write(`data: ${JSON.stringify({ titleUpdate: title })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(60);
    res.status(429).json({ error: "Rate limit exceeded", retryAfter });
  },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(60);
    res.status(429).json({ error: "Rate limit exceeded", retryAfter });
  },
});

const csrfSecret = process.env.CSRF_SECRET || process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const CSRF_COOKIE = "x-csrf-token";
const isProduction = process.env.NODE_ENV === "production";

function generateCsrfToken(): string {
  const nonce = randomBytes(32).toString("hex");
  const sig = createHmac("sha256", csrfSecret).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

function validateCsrfToken(token: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [nonce, sig] = token.split(".");
  const expected = createHmac("sha256", csrfSecret).update(nonce).digest("hex");
  return sig === expected;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app);

  app.use("/api", defaultLimiter);

  app.get("/api/csrf-token", (_req, res) => {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
    });
    res.json({ csrfToken: token });
  });

  app.use("/api", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }
    if (req.path === "/login" || req.path === "/callback" || req.path === "/logout") {
      return next();
    }
    const headerToken = req.headers["x-csrf-token"] as string;
    const cookieToken = req.cookies?.[CSRF_COOKIE] as string;
    if (!headerToken || !cookieToken) {
      return res.status(403).json({ error: "Missing CSRF token" });
    }
    if (headerToken !== cookieToken) {
      return res.status(403).json({ error: "CSRF token mismatch" });
    }
    if (!validateCsrfToken(headerToken)) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
    next();
  });

  app.get("/api/auth/role", requireAuth, tenantScope, loadUserRole, (req, res) => {
    res.json({ role: req.userRole, permissions: req.userPermissions });
  });

  /** Tenant branding config — returns vendor name, abbreviation, etc. for the current tenant */
  app.get("/api/tenant-config", requireAuth, tenantScope, async (req, res, next) => {
    try {
      const tc = await getTenantConfig(req.tenantId!);
      res.json({
        vendorName: tc.vendorName,
        vendorAbbreviation: tc.vendorAbbreviation,
        appName: tc.appName,
        parentCompany: tc.parentCompany,
        tenantType: req.tenantType,
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/auth/profile", requireAuth, tenantScope, async (req: any, res, next) => {
    try {
      const userId = req.user!.id;
      const { displayName, email } = req.body;
      const { profiles } = await import("@shared/models/auth");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const updates: any = { updatedAt: new Date() };
      if (displayName !== undefined) updates.displayName = displayName;
      if (email !== undefined) updates.email = email;
      await db.update(profiles).set(updates).where(eq(profiles.id, userId));
      const [updated] = await db.select().from(profiles).where(eq(profiles.id, userId));
      res.json(updated);
    } catch (error: any) {
      next(new InternalError("Failed to update profile"));
    }
  });

  app.post("/api/upload", requireAuth, tenantScope, upload.array("files", 10), async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new ValidationError("No files uploaded.");
      }

      const results = await Promise.all(
        files.map(async (f) => ({
          name: f.originalname,
          content: await extractFileContent(f.path, f.originalname),
          size: f.size,
        }))
      );

      res.json({ files: results });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/conversations", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.VIEWER), async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const convos = await chatStorage.getConversationsByUser(userId, req.tenantId!);
      res.json(convos);
    } catch (error: any) {
      next(new InternalError("Failed to load conversations."));
    }
  });

  app.get("/api/conversations/:id", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.VIEWER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      const msgs = await chatStorage.getMessagesByConversation(id, req.tenantId!);
      res.json({ conversation: convo, messages: msgs });
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/conversations/:id", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.TENANT_ADMIN), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      await chatStorage.deleteConversation(id, req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/conversations/:id/title", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      const { title } = req.body;
      if (!title || typeof title !== "string" || !title.trim()) {
        throw new ValidationError("Title is required.");
      }
      await chatStorage.updateConversationTitle(id, title.trim(), req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/conversations/:id/flag", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      const flagged = await chatStorage.toggleFlag(id, req.tenantId!);
      res.json({ success: true, flagged });
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/messages/:id", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.TENANT_ADMIN), async (req, res, next) => {
    try {
      const msgId = parseInt(req.params.id);
      const userId = req.user!.id;
      const msg = await chatStorage.getMessageById(msgId, req.tenantId!);
      if (!msg) throw new NotFoundError("Message not found.");
      const convo = await chatStorage.getConversation(msg.conversationId, req.tenantId!);
      if (!convo || convo.userId !== userId) throw new NotFoundError("Conversation not found.");
      await chatStorage.deleteMessage(msgId, req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/conversations/:id/messages-after/:messageId", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const convoId = parseInt(req.params.id);
      const messageId = parseInt(req.params.messageId);
      const userId = req.user!.id;
      const convo = await chatStorage.getConversation(convoId, req.tenantId!);
      if (!convo || convo.userId !== userId) throw new NotFoundError("Conversation not found.");
      const msg = await chatStorage.getMessageById(messageId, req.tenantId!);
      if (!msg || msg.conversationId !== convoId) throw new ValidationError("Message does not belong to this conversation.");
      await chatStorage.deleteMessagesFrom(convoId, messageId, req.tenantId!);
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/conversations/:id/branch", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const convoId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { upToMessageId } = req.body;
      if (!upToMessageId) throw new ValidationError("upToMessageId is required.");
      const convo = await chatStorage.getConversation(convoId, req.tenantId!);
      if (!convo || convo.userId !== userId) throw new NotFoundError("Conversation not found.");
      const msg = await chatStorage.getMessageById(upToMessageId, req.tenantId!);
      if (!msg || msg.conversationId !== convoId) throw new ValidationError("Message does not belong to this conversation.");
      const title = `Branch of ${convo.title.substring(0, 60)}`;
      const result = await chatStorage.branchConversation(convoId, upToMessageId, userId, title, req.tenantId!);
      res.json(result);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/conversations/:id/sow", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      const { sowJson, label } = req.body;
      await chatStorage.updateConversationSow(id, sowJson, req.tenantId!);
      const version = await chatStorage.createSowVersion(id, sowJson, req.tenantId!, label).catch(() => null);
      res.json({ success: true, version });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/conversations/:id/versions", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.VIEWER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      const versions = await chatStorage.getSowVersions(id, req.tenantId!);
      res.json(versions);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/conversations/:id/versions/:versionId/restore", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const versionId = parseInt(req.params.versionId);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      const version = await chatStorage.getSowVersion(versionId, req.tenantId!);
      if (!version || version.conversationId !== id) {
        throw new NotFoundError("Version not found.");
      }
      await chatStorage.updateConversationSow(id, version.sowJson, req.tenantId!);
      const restored = await chatStorage.createSowVersion(id, version.sowJson, req.tenantId!, `Restored from v${version.version}`);
      res.json({ success: true, sowJson: version.sowJson, version: restored });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/grammar-check", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const { sowJson } = req.body;
      if (!sowJson) throw new ValidationError("No SoW data provided");

      const textParts: string[] = [];
      if (sowJson.summary) textParts.push(`Summary: ${sowJson.summary}`);
      // v2.1: proposed_solution / solution
      const sol = sowJson.proposed_solution?.overview || sowJson.solution;
      if (sol) textParts.push(`Solution: ${sol}`);
      if (sowJson.changeControl) textParts.push(`Change Control: ${sowJson.changeControl}`);
      if (typeof sowJson.approval === "string" && sowJson.approval) textParts.push(`Approval: ${sowJson.approval}`);
      // v2.1: outline phases
      (sowJson.outline || []).forEach((p: any) => {
        if (p.objective) textParts.push(`Phase objective: ${p.objective}`);
        (p.tasks || []).forEach((t: string) => textParts.push(`Task: ${t}`));
        (p.deliverables || []).forEach((d: string) => textParts.push(`Deliverable: ${d}`));
      });
      // v2.1: caveats_and_risks / caveatsAndRisks — risks with simplified mitigation field
      const caveats = sowJson.caveats_and_risks || sowJson.caveatsAndRisks;
      (caveats?.risks || []).forEach((r: any) => {
        if (r.risk) textParts.push(`Risk: ${r.risk}`);
        if (r.impact) textParts.push(`Impact: ${r.impact}`);
        if (r.mitigation) textParts.push(`Mitigation: ${r.mitigation}`);
        // Legacy v2.0 fields
        if (r.mitigationDIT) textParts.push(`Mitigation (Vendor): ${r.mitigationDIT}`);
        if (r.mitigationClient) textParts.push(`Mitigation (Client): ${r.mitigationClient}`);
        if (r.decision) textParts.push(`Decision: ${r.decision}`);
      });
      (caveats?.exclusions || []).forEach((e: string) => textParts.push(`Exclusion: ${e}`));
      (caveats?.assumptions || []).forEach((a: string) => textParts.push(`Assumption: ${a}`));
      // v2.1: prerequisites as flat array or legacy object
      if (Array.isArray(sowJson.prerequisites)) {
        sowJson.prerequisites.forEach((p: string) => textParts.push(`Prerequisite: ${p}`));
      } else if (sowJson.prerequisites) {
        (sowJson.prerequisites.clientResponsibilities || []).forEach((r: string) => textParts.push(`Client resp: ${r}`));
        (sowJson.prerequisites.vendorResponsibilities || []).forEach((r: string) => textParts.push(`Vendor resp: ${r}`));
        (sowJson.prerequisites.thirdPartyResponsibilities || []).forEach((r: string) => textParts.push(`3rd party resp: ${r}`));
      }
      (sowJson.completionCriteria || sowJson.completion_criteria || []).forEach((c: string) => textParts.push(`Completion: ${c}`));
      // Legacy v2.0 fields
      (sowJson.dependencies || []).forEach((d: string) => textParts.push(`Dependency: ${d}`));
      (sowJson.outOfScope || []).forEach((o: string) => textParts.push(`Out of scope: ${o}`));

      const fullText = textParts.join("\n");

      const grammarResp = await chatCompletion({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        appCode: APP_CODE,
        taskType: "analysis",
        system: `You are a professional technical editor reviewing an IT Scope of Work document. Check for:
1. Spelling errors
2. Grammar issues
3. Awkward phrasing or unclear language
4. Inconsistent terminology
5. Missing articles or prepositions
6. Run-on sentences

Return a JSON array of strings, where each string is a specific, actionable suggestion. Include the exact text that needs fixing and the suggested correction. If no issues are found, return an empty array [].
Format: ["Section X: 'original text' should be 'corrected text' — reason", ...]
Return ONLY the JSON array, no markdown, no explanation.`,
        messages: [{ role: "user", content: fullText }],
        options: { maxTokens: 2000, temperature: 0.2 },
      });

      const content = grammarResp.content || "[]";
      let suggestions: string[];
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        suggestions = JSON.parse(cleaned);
        if (!Array.isArray(suggestions)) suggestions = [];
      } catch {
        suggestions = content.split("\n").filter((l: string) => l.trim().length > 0);
      }

      res.json({ suggestions });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/conversations/:id/export/:format", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.VIEWER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const format = req.params.format;
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      if (!convo.sowJson) {
        throw new ValidationError("No SoW to export.");
      }
      const slug = (convo.sowJson as any).title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sow-export";
      const exportConfig = await getTenantConfig(req.tenantId!);

      if (format === "pdf") {
        const pdfBuffer = await generatePdf(convo.sowJson, exportConfig);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.pdf"`);
        res.send(pdfBuffer);
      } else if (format === "docx" || format === "docx-detailed") {
        // v2.1: normalize to canonical shape, then generate via v2.1 DOCX generator
        const normalized = normalizeSowJson(convo.sowJson, exportConfig.vendorName);
        const docxBuffer = await generateDocxV2(normalized, exportConfig);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.docx"`);
        res.send(docxBuffer);
      } else if (format === "docx-legacy") {
        // Legacy DOCX renderer (pre-v2.1)
        const style = "detailed";
        const docxBuffer = await generateDocx(convo.sowJson, style, exportConfig);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}-legacy.docx"`);
        res.send(docxBuffer);
      } else if (format === "md" || format === "markdown") {
        // v2.1 Markdown export
        const normalized = normalizeSowJson(convo.sowJson, exportConfig.vendorName);
        const md = generateMarkdown(normalized);
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.md"`);
        res.send(md);
      } else {
        throw new ValidationError("Invalid format. Use 'pdf', 'docx', 'docx-legacy', or 'md'.");
      }
    } catch (error: any) {
      next(error);
    }
  });

  // Ducky integration stub: builds the knowledge payload without calling Ducky's API
  app.post("/api/conversations/:id/push-to-ducky", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const convo = await chatStorage.getConversation(id, req.tenantId!);
      if (!convo || convo.userId !== req.user!.id) {
        throw new NotFoundError("Conversation not found.");
      }
      if (!convo.sowJson) {
        throw new ValidationError("No SoW to push.");
      }
      const exportConfig = await getTenantConfig(req.tenantId!);
      const normalized = normalizeSowJson(convo.sowJson, exportConfig.vendorName);
      const payload = sowToDuckyPayload(normalized, id, req.tenantId!);
      // When Ducky integration goes live, this will POST to Ducky's /api/knowledge endpoint
      res.json({ duckyPayload: payload, status: "ready" });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/models", requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.VIEWER), (_req, res) => {
    res.json(MODEL_ROSTER.map((m) => ({ id: m.id, label: m.label, strengths: [...m.strengths] })));
  });

  app.post("/api/chat", chatLimiter, requireAuth, tenantScope, loadUserRole, requireRole(ROLE_NAMES.USER), async (req, res, next) => {
    try {
      const { messages, conversationId, aiMode } = req.body;
      const userId = req.user!.id;
      const tenantId = req.tenantId!;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new ValidationError("Messages are required.");
      }

      let convoId = conversationId;
      let isNewConversation = false;

      if (convoId) {
        const existingConvo = await chatStorage.getConversation(convoId, tenantId);
        if (!existingConvo || existingConvo.userId !== userId) {
          throw new NotFoundError("Conversation not found.");
        }
      } else {
        const convo = await chatStorage.createConversation(userId, "New Scope", tenantId);
        convoId = convo.id;
        isNewConversation = true;
      }

      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === "user") {
        await chatStorage.createMessage(convoId, "user", lastUserMsg.content, tenantId);
      }

      const tenantCfg = await getTenantConfig(tenantId);
      const systemPrompt = buildSystemPrompt(tenantCfg);

      const chatMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`);

      const lastContent = lastUserMsg?.content || "";
      const tags = classifyRequest(lastContent);
      const mode = aiMode || "auto";
      const validModes = ["auto", "ensemble", ...MODEL_ROSTER.map((m) => m.id)];
      if (!validModes.includes(mode)) {
        res.write(`data: ${JSON.stringify({ error: "Invalid AI mode. Use auto, ensemble, or a valid model ID." })}\n\n`);
        res.end();
        return;
      }

      if (mode === "ensemble") {
        const ensembleModels = pickEnsembleModels(tags);
        const modelLabels = ensembleModels.map((m) => m.label);
        res.write(`data: ${JSON.stringify({ modelsUsed: modelLabels, mode: "ensemble" })}\n\n`);
        res.write(`data: ${JSON.stringify({ status: `Consulting ${modelLabels.join(", ")}...` })}\n\n`);

        const results = await Promise.allSettled(
          ensembleModels.map((m) => callModel(m.id, chatMessages, m.maxTokens))
        );

        const responses: { model: string; content: string }[] = [];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === "fulfilled" && r.value) {
            responses.push({ model: ensembleModels[i].label, content: r.value });
          }
        }

        if (responses.length === 0) {
          res.write(`data: ${JSON.stringify({ error: "All models failed in ensemble mode. Please try again or switch to Auto mode." })}\n\n`);
          res.end();
          return;
        }

        res.write(`data: ${JSON.stringify({ status: `Synthesizing ${responses.length} responses...` })}\n\n`);

        if (responses.length === 1) {
          const content = responses[0].content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          await chatStorage.createMessage(convoId, "assistant", content, tenantId);
          await chatStorage.touchConversation(convoId, tenantId).catch(() => {});
          await finishStream(res, isNewConversation, convoId, lastContent, content, tenantId, userId);
          return;
        }

        const synthesisMessages = [
          { role: "system" as const, content: SYNTHESIS_PROMPT + "\n\n" + systemPrompt },
          ...messages.slice(0, -1).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user" as const, content: lastContent + "\n\n---\n\nBelow are responses from multiple AI models. Synthesize the best answer:\n\n" +
            responses.map((r) => `=== ${r.model} ===\n${r.content}`).join("\n\n") },
        ];

        try {
          const stream = await spanielClient.chat.completions.create({
            model: "anthropic/claude-opus-4.6",
            messages: synthesisMessages,
            stream: true,
            max_tokens: 8192,
            temperature: 0.2,
          });

          let fullContent = "";
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          }

          await chatStorage.createMessage(convoId, "assistant", fullContent, tenantId);
          await chatStorage.touchConversation(convoId, tenantId).catch(() => {});
          await finishStream(res, isNewConversation, convoId, lastContent, fullContent, tenantId, userId);
        } catch (synthError: any) {
          console.error("Synthesis error:", synthError);
          const fallbackContent = responses[0].content;
          res.write(`data: ${JSON.stringify({ content: fallbackContent })}\n\n`);
          await chatStorage.createMessage(convoId, "assistant", fallbackContent, tenantId);
          await chatStorage.touchConversation(convoId, tenantId).catch(() => {});
          await finishStream(res, isNewConversation, convoId, lastContent, fallbackContent, tenantId, userId);
        }
      } else {
        let selectedModel = MODEL_ROSTER[0];
        if (mode === "auto") {
          selectedModel = pickBestModel(tags);
        } else {
          const found = MODEL_ROSTER.find((m) => m.id === mode);
          if (found) selectedModel = found;
        }

        res.write(`data: ${JSON.stringify({ modelsUsed: [selectedModel.label], mode: mode === "auto" ? "auto" : "direct" })}\n\n`);

        const stream = await spanielClient.chat.completions.create({
          model: selectedModel.id,
          messages: chatMessages,
          stream: true,
          max_tokens: selectedModel.maxTokens,
          temperature: 0.3,
        });

        let fullContent = "";
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        await chatStorage.createMessage(convoId, "assistant", fullContent, tenantId);
        await chatStorage.touchConversation(convoId, tenantId).catch(() => {});
        await finishStream(res, isNewConversation, convoId, lastContent, fullContent, tenantId, userId);
      }
    } catch (error: any) {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Something went wrong. Please try again." })}\n\n`);
        res.end();
      } else {
        next(error);
      }
    }
  });

  return httpServer;
}
