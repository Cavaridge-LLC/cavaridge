/**
 * Caelum SoW CRUD API Routes
 * Spec: SOW-MASTER-SPEC-v2_2.md (2026-03-24, LOCKED)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 *
 * Express 5 route handlers for standalone SoW documents, templates,
 * DOCX export, and Ducky-powered AI content generation.
 *
 * All endpoints are tenant-scoped and require MSP Admin or MSP Tech roles.
 */

import { Router } from "express";
import { requireAuth } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { sowStorage, sowTemplateStorage } from "./storage";
import { generateDocxV2 } from "../../sowDocxExportV2";
import { generateMarkdown } from "../../sowMarkdownExport";
import {
  normalizeSowJson,
  type SowDocumentV2,
} from "../../../shared/models/sow";
import { getTenantConfig } from "../../tenantConfigLoader";
import { ValidationError, NotFoundError } from "../../utils/errors";
import { generateFullSowDraft, generateSowSection, grammarCheckViaDucky } from "./ducky";
import { validateSowDocument, MANDATORY_PM_TASKS } from "./validation";

/** Safely extract a single string from Express 5 param (string | string[]). */
function paramStr(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const sowRouter = Router();

// All routes require auth + at minimum MSP Tech role
sowRouter.use(requireAuth);
sowRouter.use(requireRole(ROLES.MSP_TECH));

// ---------------------------------------------------------------------------
// SoW CRUD
// ---------------------------------------------------------------------------

/** POST /api/v1/sows — Create a new SoW */
sowRouter.post("/", async (req, res, next) => {
  try {
    const { title, sowDocument, templateId, conversationId } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      throw new ValidationError("Title is required.");
    }

    let doc: SowDocumentV2;
    if (sowDocument) {
      doc = normalizeSowJson(sowDocument, (await getTenantConfig(req.tenantId!)).vendorName);
    } else if (templateId) {
      // Create from template
      const template = await sowTemplateStorage.getTemplate(templateId, req.tenantId!);
      if (!template) throw new NotFoundError("Template not found.");
      doc = normalizeSowJson(template.sowDocument, (await getTenantConfig(req.tenantId!)).vendorName);
    } else {
      // Create blank SoW with defaults
      const tc = await getTenantConfig(req.tenantId!);
      doc = normalizeSowJson({ title: title.trim() }, tc.vendorName);
    }

    const sow = await sowStorage.createSow({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      title: title.trim(),
      sowDocument: doc,
      templateId: templateId ?? undefined,
      conversationId: conversationId ?? undefined,
    });

    res.status(201).json(sow);
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/sows — List SoWs (tenant-scoped) */
sowRouter.get("/", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const sows = await sowStorage.listSows(req.tenantId!, { status, limit, offset });
    res.json({ sows, count: sows.length });
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/sows/:id — Get a single SoW */
sowRouter.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    res.json(sow);
  } catch (error) {
    next(error);
  }
});

/** PUT /api/v1/sows/:id — Update a SoW */
sowRouter.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const { title, status, sowDocument } = req.body;

    // Validate status if provided
    const validStatuses = ["draft", "review", "approved", "archived"];
    if (status !== undefined && !validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }

    let normalizedDoc: SowDocumentV2 | undefined;
    if (sowDocument) {
      const tc = await getTenantConfig(req.tenantId!);
      normalizedDoc = normalizeSowJson(sowDocument, tc.vendorName);
    }

    const updated = await sowStorage.updateSow(id, req.tenantId!, req.user!.id, {
      title: title?.trim(),
      status,
      sowDocument: normalizedDoc,
    });

    if (!updated) throw new NotFoundError("SoW not found.");

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/v1/sows/:id — Delete a SoW (MSP Admin only) */
sowRouter.delete("/:id", requireRole(ROLES.MSP_ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    await sowStorage.deleteSow(id, req.tenantId!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Version History
// ---------------------------------------------------------------------------

/** GET /api/v1/sows/:id/versions — Get version history */
sowRouter.get("/:id/versions", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    const revisions = await sowStorage.getRevisions(id, req.tenantId!);
    res.json({ revisions });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/sows/:id/versions/:revisionId/restore — Restore a version */
sowRouter.post("/:id/versions/:revisionId/restore", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    const revisionId = parseInt(paramStr(req.params.revisionId), 10);
    if (isNaN(id) || isNaN(revisionId)) throw new ValidationError("Invalid ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    const revision = await sowStorage.getRevision(revisionId, req.tenantId!);
    if (!revision || revision.sowId !== id) throw new NotFoundError("Revision not found.");

    const updated = await sowStorage.updateSow(id, req.tenantId!, req.user!.id, {
      sowDocument: revision.sowDocument as SowDocumentV2,
    });

    res.json({ success: true, sow: updated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// DOCX Export
// ---------------------------------------------------------------------------

/** POST /api/v1/sows/:id/generate-docx — Export SoW as DOCX */
sowRouter.post("/:id/generate-docx", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    const tc = await getTenantConfig(req.tenantId!);
    const normalized = normalizeSowJson(sow.sowDocument, tc.vendorName);
    const docxBuffer = await generateDocxV2(normalized, tc);

    const slug = sow.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sow-export";

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.docx"`);
    res.send(docxBuffer);
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/sows/:id/generate-markdown — Export SoW as Markdown */
sowRouter.post("/:id/generate-markdown", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    const tc = await getTenantConfig(req.tenantId!);
    const normalized = normalizeSowJson(sow.sowDocument, tc.vendorName);
    const md = generateMarkdown(normalized);

    const slug = sow.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sow-export";

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.md"`);
    res.send(md);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// AI Content Generation (via Ducky)
// ---------------------------------------------------------------------------

/** POST /api/v1/sows/:id/generate-section — AI-generate a single section */
sowRouter.post("/:id/generate-section", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const { sectionName, projectContext, existingContent } = req.body;
    if (!sectionName || typeof sectionName !== "string") {
      throw new ValidationError("sectionName is required.");
    }

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    const tc = await getTenantConfig(req.tenantId!);

    const content = await generateSowSection({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      sectionName,
      projectContext: projectContext || sow.title,
      existingContent,
      vendorName: tc.vendorName,
    });

    res.json({ content, sectionName });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/sows/generate-draft — AI-generate a full SoW draft */
sowRouter.post("/generate-draft", async (req, res, next) => {
  try {
    const { projectBrief, title, templateId } = req.body;
    if (!projectBrief || typeof projectBrief !== "string") {
      throw new ValidationError("projectBrief is required.");
    }

    const tc = await getTenantConfig(req.tenantId!);

    let templateDoc: Partial<SowDocumentV2> | undefined;
    if (templateId) {
      const template = await sowTemplateStorage.getTemplate(templateId, req.tenantId!);
      if (template) {
        templateDoc = template.sowDocument as Partial<SowDocumentV2>;
      }
    }

    const rawContent = await generateFullSowDraft({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      projectBrief,
      vendorName: tc.vendorName,
      vendorAbbreviation: tc.vendorAbbreviation,
      templateDocument: templateDoc,
    });

    // Parse the JSON response from Ducky
    let sowJson: Record<string, unknown>;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      sowJson = JSON.parse(cleaned);
    } catch {
      // If Ducky returns non-JSON, wrap it as a summary
      sowJson = { title: title || "Generated SoW", summary: rawContent };
    }

    // Normalize into canonical v2.2 shape
    const normalized = normalizeSowJson(sowJson, tc.vendorName);

    // Create the SoW record
    const sow = await sowStorage.createSow({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      title: title || normalized.cover.projectName || "Generated SoW",
      sowDocument: normalized,
      templateId: templateId ?? undefined,
    });

    res.status(201).json(sow);
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/sows/:id/grammar-check — Grammar check via Ducky */
sowRouter.post("/:id/grammar-check", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    const tc = await getTenantConfig(req.tenantId!);
    const normalized = normalizeSowJson(sow.sowDocument, tc.vendorName);
    const textContent = buildTextForGrammarCheck(normalized);

    const suggestions = await grammarCheckViaDucky({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      content: textContent,
    });

    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/sows/:id/validate — Validate SoW against v2.2 spec */
sowRouter.post("/:id/validate", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid SoW ID.");

    const sow = await sowStorage.getSow(id, req.tenantId!);
    if (!sow) throw new NotFoundError("SoW not found.");

    const tc = await getTenantConfig(req.tenantId!);
    const normalized = normalizeSowJson(sow.sowDocument, tc.vendorName);
    const result = validateSowDocument(normalized);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Templates CRUD
// ---------------------------------------------------------------------------

/** POST /api/v1/sows/templates — Create a template */
sowRouter.post("/templates", requireRole(ROLES.MSP_ADMIN), async (req, res, next) => {
  try {
    const { name, description, projectType, sowDocument } = req.body;
    if (!name || !projectType) {
      throw new ValidationError("name and projectType are required.");
    }

    const template = await sowTemplateStorage.createTemplate({
      tenantId: req.tenantId!,
      name: name.trim(),
      description: description?.trim(),
      projectType: projectType.trim(),
      sowDocument: sowDocument || {},
      createdBy: req.user!.id,
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/sows/templates — List templates */
sowRouter.get("/templates", async (req, res, next) => {
  try {
    const projectType = typeof req.query.projectType === "string" ? req.query.projectType : undefined;
    const templates = await sowTemplateStorage.listTemplates(req.tenantId!, { projectType });
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/sows/templates/:id — Get a template */
sowRouter.get("/templates/:id", async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid template ID.");

    const template = await sowTemplateStorage.getTemplate(id, req.tenantId!);
    if (!template) throw new NotFoundError("Template not found.");

    res.json(template);
  } catch (error) {
    next(error);
  }
});

/** PUT /api/v1/sows/templates/:id — Update a template */
sowRouter.put("/templates/:id", requireRole(ROLES.MSP_ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid template ID.");

    const { name, description, projectType, sowDocument, isActive } = req.body;

    const updated = await sowTemplateStorage.updateTemplate(id, req.tenantId!, {
      name: name?.trim(),
      description: description?.trim(),
      projectType: projectType?.trim(),
      sowDocument,
      isActive,
    });

    if (!updated) throw new NotFoundError("Template not found.");

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/v1/sows/templates/:id — Delete a template */
sowRouter.delete("/templates/:id", requireRole(ROLES.MSP_ADMIN), async (req, res, next) => {
  try {
    const id = parseInt(paramStr(req.params.id), 10);
    if (isNaN(id)) throw new ValidationError("Invalid template ID.");

    const template = await sowTemplateStorage.getTemplate(id, req.tenantId!);
    if (!template) throw new NotFoundError("Template not found.");

    await sowTemplateStorage.deleteTemplate(id, req.tenantId!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTextForGrammarCheck(sow: SowDocumentV2): string {
  const parts: string[] = [];
  parts.push(`Summary: ${sow.summary}`);
  if (sow.summaryBoundaryNote) parts.push(sow.summaryBoundaryNote);
  parts.push(`Solution: ${sow.proposedSolution.overview}`);
  if (sow.proposedSolution.subsections) {
    for (const sub of sow.proposedSolution.subsections) {
      parts.push(`${sub.number} ${sub.title}: ${sub.narrative}`);
    }
  }
  for (const p of sow.prerequisites) parts.push(`Prerequisite: ${p}`);
  for (const phase of sow.phases) {
    parts.push(`Phase ${phase.number}: ${phase.title} — ${phase.objective}`);
    for (const t of phase.tasks) parts.push(`Task: ${t}`);
    for (const d of phase.deliverables) parts.push(`Deliverable: ${d}`);
  }
  for (const e of sow.caveatsRisks.exclusions) parts.push(`Exclusion: ${e}`);
  for (const a of sow.caveatsRisks.assumptions) parts.push(`Assumption: ${a}`);
  for (const r of sow.caveatsRisks.risks) {
    parts.push(`Risk: ${r.risk} — Impact: ${r.impact} — Mitigation: ${r.mitigation}`);
  }
  parts.push(`Change Control: ${sow.caveatsRisks.changeControl}`);
  for (const c of sow.completionCriteria) parts.push(`Completion: ${c}`);
  return parts.join("\n");
}
