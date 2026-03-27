/**
 * Forge API Routes
 *
 * All routes are tenant-scoped and RBAC-enforced via @cavaridge/auth.
 * Content CRUD, templates, brand voice, batches, pipeline status.
 */

import type { Express, Response, NextFunction } from "express";
import type { Server } from "http";
import { rateLimit } from "express-rate-limit";
import { requireAuth, requirePermission, requireContentAccess, type AuthenticatedRequest } from "./auth";
import { db } from "./db";
import {
  forgeContent, forgeStageRuns, forgeTemplates, forgeBrandVoices, forgeBatches,
} from "@shared/schema";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { ValidationError, NotFoundError } from "./utils/errors";
import { runContentPipeline } from "./pipeline";
import { resolveBrandVoice } from "./services/brand-voice";
import { getCreditBalance, hasCredits, consumeCredits, getUsageSummary } from "./services/credits";
import { getTemplatesForTenant, getTemplateById, incrementTemplateUsage } from "./services/templates";
import { createBatch, getBatchStatus } from "./services/batch";
import { creditCheck } from "./middleware/credit-check";
import {
  estimateCreditCost,
  deductCredits,
  refundCredits,
} from "./services/credit-engine";
import creditsRouter from "./routes/credits";
import type { ForgeBrief, ContentType, OutputFormat, BatchRequest } from "@shared/models/pipeline";

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const pipelineLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many pipeline requests. Please wait.",
});

const VALID_OUTPUT_FORMATS: OutputFormat[] = ["docx", "pdf", "html"];
const VALID_CONTENT_TYPES: ContentType[] = [
  "blog_post", "case_study", "white_paper", "email_campaign",
  "social_media_series", "proposal", "one_pager", "custom",
];

export async function registerRoutes(server: Server, app: Express) {
  // Apply rate limiting to all API routes
  app.use("/api", apiLimiter);

  // Middleware chain for authenticated routes
  const auth = [requireAuth as any]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const canCreate = [requireAuth as any, requirePermission("create_projects") as any];
  const canEdit = [requireAuth as any, requirePermission("edit_projects") as any];
  const canDelete = [requireAuth as any, requirePermission("delete_projects") as any];
  const canView = [requireAuth as any, requirePermission("view_projects") as any];

  // ── Health ──

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "forge", version: "1.0.0" });
  });

  // ══════════════════════════════════════════════════════
  // Credits — /api/v1/credits (new credit-engine routes)
  // ══════════════════════════════════════════════════════

  app.use("/api/v1/credits", creditsRouter);

  // ══════════════════════════════════════════════════════
  // Content CRUD — /api/v1/content
  // ══════════════════════════════════════════════════════

  /** POST /api/v1/content — Create content with type, topic, params */
  app.post("/api/v1/content", ...canCreate, pipelineLimiter, creditCheck as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        description, outputFormat, contentType, audience, tone,
        referenceNotes, templateId, brandVoiceId, autoStart,
      } = req.body;

      if (!description || !outputFormat) {
        throw new ValidationError("description and outputFormat are required");
      }
      if (!VALID_OUTPUT_FORMATS.includes(outputFormat)) {
        throw new ValidationError(`outputFormat must be one of: ${VALID_OUTPUT_FORMATS.join(", ")}`);
      }
      if (contentType && !VALID_CONTENT_TYPES.includes(contentType)) {
        throw new ValidationError(`contentType must be one of: ${VALID_CONTENT_TYPES.join(", ")}`);
      }

      const user = req.user!;
      const tenantId = req.tenantId!;

      const brief: ForgeBrief = {
        description,
        outputFormat,
        contentType: contentType ?? "custom",
        audience,
        tone,
        referenceNotes,
        templateId,
        brandVoiceId,
      };

      // If using a template, increment usage
      if (templateId) {
        const template = await getTemplateById(templateId);
        if (template) {
          await incrementTemplateUsage(templateId);
        }
      }

      // Create content record
      const [content] = await db.insert(forgeContent).values({
        tenantId,
        createdBy: user.id,
        title: description.slice(0, 100),
        brief: brief as unknown as Record<string, unknown>,
        contentType: (brief.contentType) as typeof forgeContent.$inferInsert["contentType"],
        outputFormat: outputFormat as typeof forgeContent.$inferInsert["outputFormat"],
        templateId: templateId ?? null,
        brandVoiceId: brandVoiceId ?? null,
        status: autoStart ? "queued" : "draft",
      }).returning();

      // Auto-start pipeline if requested
      if (autoStart) {
        const brandVoice = await resolveBrandVoice(brandVoiceId, tenantId);
        void runContentPipeline(content.id, brief, tenantId, user.id, brandVoice).catch((err) => {
          console.error(`Pipeline failed for content ${content.id}:`, err);
        });
      }

      res.status(201).json({ content });
    } catch (error) {
      next(error);
    }
  });

  /** GET /api/v1/content — List content (tenant-scoped) */
  app.get("/api/v1/content", ...canView, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;
      const contentType = req.query.contentType as string | undefined;

      let query = db
        .select()
        .from(forgeContent)
        .where(eq(forgeContent.tenantId, tenantId))
        .orderBy(desc(forgeContent.createdAt))
        .limit(limit)
        .offset(offset);

      const contentItems = await query;

      // Filter in application layer for simplicity (status/contentType)
      let filtered = contentItems;
      if (status) {
        filtered = filtered.filter((c) => c.status === status);
      }
      if (contentType) {
        filtered = filtered.filter((c) => c.contentType === contentType);
      }

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(forgeContent)
        .where(eq(forgeContent.tenantId, tenantId));

      res.json({ content: filtered, total: Number(count), limit, offset });
    } catch (error) {
      next(error);
    }
  });

  /** GET /api/v1/content/:id — Get single content piece */
  app.get("/api/v1/content/:id", ...canView, requireContentAccess as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const contentId = req.params.id as string;
      const [content] = await db
        .select()
        .from(forgeContent)
        .where(and(eq(forgeContent.id, contentId), eq(forgeContent.tenantId, tenantId)));

      if (!content) throw new NotFoundError("Content not found");

      // Get stage runs for this content
      const stageRuns = await db
        .select()
        .from(forgeStageRuns)
        .where(eq(forgeStageRuns.contentId, content.id))
        .orderBy(forgeStageRuns.createdAt);

      res.json({ content, stageRuns });
    } catch (error) {
      next(error);
    }
  });

  /** PUT /api/v1/content/:id — Update content (draft only) */
  app.put("/api/v1/content/:id", ...canEdit, requireContentAccess as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const contentId = req.params.id as string;

      const [content] = await db
        .select()
        .from(forgeContent)
        .where(and(eq(forgeContent.id, contentId), eq(forgeContent.tenantId, tenantId)));

      if (!content) throw new NotFoundError("Content not found");
      if (content.status !== "draft") {
        throw new ValidationError("Can only update content in draft status");
      }

      const { description, outputFormat, contentType, audience, tone, referenceNotes, templateId, brandVoiceId } = req.body;

      const updatedBrief: Partial<ForgeBrief> = {};
      if (description !== undefined) updatedBrief.description = description;
      if (outputFormat !== undefined) {
        if (!VALID_OUTPUT_FORMATS.includes(outputFormat)) {
          throw new ValidationError(`outputFormat must be one of: ${VALID_OUTPUT_FORMATS.join(", ")}`);
        }
        updatedBrief.outputFormat = outputFormat;
      }
      if (contentType !== undefined) updatedBrief.contentType = contentType;
      if (audience !== undefined) updatedBrief.audience = audience;
      if (tone !== undefined) updatedBrief.tone = tone;
      if (referenceNotes !== undefined) updatedBrief.referenceNotes = referenceNotes;
      if (templateId !== undefined) updatedBrief.templateId = templateId;
      if (brandVoiceId !== undefined) updatedBrief.brandVoiceId = brandVoiceId;

      const existingBrief = content.brief as unknown as ForgeBrief;
      const mergedBrief = { ...existingBrief, ...updatedBrief };

      const updateData: Record<string, unknown> = {
        brief: mergedBrief as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      };

      if (description) updateData.title = description.slice(0, 100);
      if (outputFormat) updateData.outputFormat = outputFormat;
      if (contentType) updateData.contentType = contentType;
      if (templateId !== undefined) updateData.templateId = templateId;
      if (brandVoiceId !== undefined) updateData.brandVoiceId = brandVoiceId;

      const [updated] = await db
        .update(forgeContent)
        .set(updateData)
        .where(eq(forgeContent.id, contentId))
        .returning();

      res.json({ content: updated });
    } catch (error) {
      next(error);
    }
  });

  /** DELETE /api/v1/content/:id — Delete content */
  app.delete("/api/v1/content/:id", ...canDelete, requireContentAccess as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const contentId = req.params.id as string;

      const [content] = await db
        .select()
        .from(forgeContent)
        .where(and(eq(forgeContent.id, contentId), eq(forgeContent.tenantId, tenantId)));

      if (!content) throw new NotFoundError("Content not found");
      if (["research_outline", "draft_generation", "review_refinement", "formatting_polish", "export"].includes(content.status)) {
        throw new ValidationError("Cannot delete content while pipeline is running");
      }

      await db.delete(forgeContent).where(eq(forgeContent.id, content.id));
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  });

  /** POST /api/v1/content/:id/regenerate — Re-run pipeline */
  app.post("/api/v1/content/:id/regenerate", ...canEdit, pipelineLimiter, requireContentAccess as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user!;
      const contentId = req.params.id as string;
      const { feedback } = req.body;

      const [content] = await db
        .select()
        .from(forgeContent)
        .where(and(eq(forgeContent.id, contentId), eq(forgeContent.tenantId, tenantId)));

      if (!content) throw new NotFoundError("Content not found");
      if (!["completed", "failed", "draft"].includes(content.status)) {
        throw new ValidationError("Can only regenerate completed, failed, or draft content");
      }

      const brief = content.brief as unknown as ForgeBrief;
      if (feedback) {
        brief.referenceNotes = `REVISION REQUEST: ${feedback}\n\n${brief.referenceNotes ?? ""}`;
      }

      // Reset status
      await db.update(forgeContent).set({
        status: "queued",
        revisionCount: sql`${forgeContent.revisionCount} + 1`,
        updatedAt: new Date(),
      }).where(eq(forgeContent.id, content.id));

      const brandVoice = await resolveBrandVoice(brief.brandVoiceId, tenantId);
      void runContentPipeline(content.id, brief, tenantId, user.id, brandVoice).catch((err) => {
        console.error(`Regeneration pipeline failed for content ${content.id}:`, err);
      });

      res.json({ regenerationStarted: true, contentId: content.id });
    } catch (error) {
      next(error);
    }
  });

  /** GET /api/v1/content/:id/status — Pipeline progress */
  app.get("/api/v1/content/:id/status", ...canView, requireContentAccess as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const contentId = req.params.id as string;

      const [content] = await db
        .select()
        .from(forgeContent)
        .where(and(eq(forgeContent.id, contentId), eq(forgeContent.tenantId, tenantId)));

      if (!content) throw new NotFoundError("Content not found");

      // Get stage runs for observability
      const stageRuns = await db
        .select()
        .from(forgeStageRuns)
        .where(eq(forgeStageRuns.contentId, content.id))
        .orderBy(forgeStageRuns.createdAt);

      const totalDurationMs = stageRuns.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);
      const totalInputTokens = stageRuns.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
      const totalOutputTokens = stageRuns.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);

      res.json({
        contentId: content.id,
        status: content.status,
        qualityScore: content.qualityScore,
        pipelineState: content.pipelineState,
        stageRuns: stageRuns.map((r) => ({
          stage: r.stage,
          status: r.status,
          durationMs: r.durationMs,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
        })),
        totals: {
          durationMs: totalDurationMs,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ══════════════════════════════════════════════════════
  // Templates — /api/v1/templates
  // ══════════════════════════════════════════════════════

  app.get("/api/v1/templates", ...canView, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const templates = await getTemplatesForTenant(req.tenantId!);
      res.json({ templates });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/templates/:id", ...canView, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const template = await getTemplateById(req.params.id as string);
      if (!template) throw new NotFoundError("Template not found");
      res.json({ template });
    } catch (error) {
      next(error);
    }
  });

  // ══════════════════════════════════════════════════════
  // Brand Voice — /api/v1/brand-voice
  // ══════════════════════════════════════════════════════

  app.get("/api/v1/brand-voice", ...canView, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const voices = await db
        .select()
        .from(forgeBrandVoices)
        .where(eq(forgeBrandVoices.tenantId, req.tenantId!));
      res.json({ brandVoices: voices });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/brand-voice", ...canCreate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { name, tone, vocabulary, styleGuide, avoidTerms, examplePhrases, isDefault } = req.body;
      if (!name || !tone) {
        throw new ValidationError("name and tone are required");
      }

      const tenantId = req.tenantId!;

      // If setting as default, unset existing default
      if (isDefault) {
        await db.update(forgeBrandVoices)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(forgeBrandVoices.tenantId, tenantId), eq(forgeBrandVoices.isDefault, true)));
      }

      const [voice] = await db.insert(forgeBrandVoices).values({
        tenantId,
        name,
        tone,
        vocabulary: vocabulary ?? [],
        styleGuide: styleGuide ?? "",
        avoidTerms: avoidTerms ?? [],
        examplePhrases: examplePhrases ?? [],
        isDefault: isDefault ?? false,
      }).returning();

      res.status(201).json({ brandVoice: voice });
    } catch (error) {
      next(error);
    }
  });

  // ══════════════════════════════════════════════════════
  // Batch Generation — /api/v1/batch
  // ══════════════════════════════════════════════════════

  app.post("/api/v1/batch", ...canCreate, pipelineLimiter, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { topic, contentTypes, outputFormat, audience, tone, brandVoiceId, sharedResearch } = req.body;

      if (!topic || !contentTypes || !Array.isArray(contentTypes) || contentTypes.length === 0) {
        throw new ValidationError("topic and contentTypes (non-empty array) are required");
      }
      if (!outputFormat || !VALID_OUTPUT_FORMATS.includes(outputFormat)) {
        throw new ValidationError(`outputFormat must be one of: ${VALID_OUTPUT_FORMATS.join(", ")}`);
      }
      for (const ct of contentTypes) {
        if (!VALID_CONTENT_TYPES.includes(ct)) {
          throw new ValidationError(`Invalid contentType: ${ct}`);
        }
      }

      const request: BatchRequest = {
        topic,
        contentTypes,
        outputFormat,
        audience,
        tone,
        brandVoiceId,
        sharedResearch: sharedResearch ?? true,
      };

      const result = await createBatch(request, req.tenantId!, req.user!.id);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/batch/:id", ...canView, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await getBatchStatus(req.params.id as string, req.tenantId!);
      if (!result) throw new NotFoundError("Batch not found");
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // ══════════════════════════════════════════════════════
  // Usage / Credits — /api/v1/credits, /api/v1/usage
  // ══════════════════════════════════════════════════════

  app.get("/api/v1/credits", ...auth, requirePermission("view_credits") as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const balance = await getCreditBalance(req.tenantId!);
      res.json(balance);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/usage", ...auth, requirePermission("view_usage") as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const summary = await getUsageSummary(req.tenantId!);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  // ── Tenant Config ──

  app.get("/api/tenant-config", ...auth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const tenant = req.tenant;

      res.json({
        tenantId,
        tenantType: tenant?.type ?? null,
        config: (tenant as any)?.config ?? {},
      });
    } catch (error) {
      next(error);
    }
  });
}
