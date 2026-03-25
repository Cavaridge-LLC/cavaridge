/**
 * V1 Prompt Templates API — CRUD for stored prompt templates.
 *
 * Templates are per-app + per-task-type. Support variable interpolation.
 * Stored in Supabase, cached in memory.
 *
 * CRUD endpoints for MSP Admin+.
 */

import type { Express, Response } from "express";
import { z } from "zod";
import { db } from "../../db.js";
import { promptTemplates } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requirePermissionMiddleware, type AuthenticatedRequest } from "../../auth.js";
import { invalidateTemplateCache, extractVariables } from "../../prompt-templates.js";
import { logger } from "../../logger.js";

const requireManageTemplates = requirePermissionMiddleware("manage_templates");

const createTemplateSchema = z.object({
  appCode: z.string().min(1).max(64),
  taskType: z.string().min(1).max(64),
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().min(1).max(20000),
  userPromptTemplate: z.string().max(10000).optional(),
  isDefault: z.boolean().optional().default(false),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().min(1).max(20000).optional(),
  userPromptTemplate: z.string().max(10000).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export function registerV1TemplateRoutes(app: Express): void {
  // GET /api/v1/templates — List templates for tenant
  app.get(
    "/api/v1/templates",
    requireAuth as any,
    requireManageTemplates as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const appCode = req.query.app_code as string | undefined;
        const taskType = req.query.task_type as string | undefined;

        const conditions = [eq(promptTemplates.tenantId, req.tenantId!)];
        if (appCode) conditions.push(eq(promptTemplates.appCode, appCode));
        if (taskType) conditions.push(eq(promptTemplates.taskType, taskType));

        const templates = await db
          .select()
          .from(promptTemplates)
          .where(and(...conditions))
          .orderBy(desc(promptTemplates.updatedAt));

        return res.json({ templates, count: templates.length });
      } catch (err) {
        logger.error({ err }, "Failed to list templates");
        return res.status(500).json({ error: "Failed to list templates" });
      }
    },
  );

  // GET /api/v1/templates/:id — Get single template
  app.get(
    "/api/v1/templates/:id",
    requireAuth as any,
    requireManageTemplates as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const [template] = await db
          .select()
          .from(promptTemplates)
          .where(
            and(
              eq(promptTemplates.id, req.params.id as string),
              eq(promptTemplates.tenantId, req.tenantId!),
            ),
          );

        if (!template) {
          return res.status(404).json({ error: "Template not found" });
        }

        // Extract variable names from templates
        const systemVars = extractVariables(template.systemPrompt);
        const userVars = template.userPromptTemplate
          ? extractVariables(template.userPromptTemplate)
          : [];

        return res.json({
          template,
          extractedVariables: Array.from(new Set(systemVars.concat(userVars))),
        });
      } catch (err) {
        logger.error({ err }, "Failed to get template");
        return res.status(500).json({ error: "Failed to get template" });
      }
    },
  );

  // POST /api/v1/templates — Create template
  app.post(
    "/api/v1/templates",
    requireAuth as any,
    requireManageTemplates as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = createTemplateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
        }

        const { appCode, taskType, name, description, systemPrompt, userPromptTemplate, isDefault } = parsed.data;

        // Extract variable names
        const systemVars = extractVariables(systemPrompt);
        const userVars = userPromptTemplate ? extractVariables(userPromptTemplate) : [];
        const variables = Array.from(new Set(systemVars.concat(userVars)));

        const [template] = await db
          .insert(promptTemplates)
          .values({
            tenantId: req.tenantId!,
            appCode,
            taskType,
            name,
            description,
            systemPrompt,
            userPromptTemplate,
            variables,
            isDefault,
            createdBy: req.user!.id,
          })
          .returning();

        // Invalidate cache
        invalidateTemplateCache(req.tenantId!, appCode, taskType);

        return res.status(201).json({ template, extractedVariables: variables });
      } catch (err) {
        logger.error({ err }, "Failed to create template");
        return res.status(500).json({ error: "Failed to create template" });
      }
    },
  );

  // PATCH /api/v1/templates/:id — Update template
  app.patch(
    "/api/v1/templates/:id",
    requireAuth as any,
    requireManageTemplates as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = updateTemplateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
        }

        const [existing] = await db
          .select()
          .from(promptTemplates)
          .where(
            and(
              eq(promptTemplates.id, req.params.id as string),
              eq(promptTemplates.tenantId, req.tenantId!),
            ),
          );

        if (!existing) {
          return res.status(404).json({ error: "Template not found" });
        }

        const updateData: Record<string, unknown> = {
          ...parsed.data,
          updatedAt: new Date(),
        };

        // Recalculate variables if prompts changed
        const systemPrompt = (parsed.data.systemPrompt ?? existing.systemPrompt) as string;
        const userPromptTemplate =
          parsed.data.userPromptTemplate !== undefined
            ? parsed.data.userPromptTemplate
            : existing.userPromptTemplate;

        const systemVars = extractVariables(systemPrompt);
        const userVars = userPromptTemplate ? extractVariables(userPromptTemplate) : [];
        updateData.variables = Array.from(new Set(systemVars.concat(userVars)));

        const [updated] = await db
          .update(promptTemplates)
          .set(updateData)
          .where(eq(promptTemplates.id, existing.id))
          .returning();

        // Invalidate cache
        invalidateTemplateCache(req.tenantId!, existing.appCode, existing.taskType);

        return res.json({ template: updated });
      } catch (err) {
        logger.error({ err }, "Failed to update template");
        return res.status(500).json({ error: "Failed to update template" });
      }
    },
  );

  // DELETE /api/v1/templates/:id — Delete template
  app.delete(
    "/api/v1/templates/:id",
    requireAuth as any,
    requireManageTemplates as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const [existing] = await db
          .select()
          .from(promptTemplates)
          .where(
            and(
              eq(promptTemplates.id, req.params.id as string),
              eq(promptTemplates.tenantId, req.tenantId!),
            ),
          );

        if (!existing) {
          return res.status(404).json({ error: "Template not found" });
        }

        await db.delete(promptTemplates).where(eq(promptTemplates.id, existing.id));

        // Invalidate cache
        invalidateTemplateCache(req.tenantId!, existing.appCode, existing.taskType);

        return res.json({ deleted: true, id: existing.id });
      } catch (err) {
        logger.error({ err }, "Failed to delete template");
        return res.status(500).json({ error: "Failed to delete template" });
      }
    },
  );
}
