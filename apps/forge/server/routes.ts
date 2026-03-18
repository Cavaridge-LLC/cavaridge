/**
 * Forge API Routes
 *
 * All routes are tenant-scoped and RBAC-enforced.
 * Projects, templates, usage, and health endpoints.
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "./services/auth";
import { tenantScope } from "./middleware/tenantScope";
import { loadUserRole, requireRole, ROLE_NAMES } from "./middleware/rbac";
import { db } from "./db";
import {
  forgeProjects, forgeAgentRuns, forgeTemplates, forgeTenantCredits,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ValidationError, NotFoundError } from "./utils/errors";
import { runIntakeAgent } from "./agents/intake";
import { runEstimateAgent } from "./agents/estimate";
import { runForgePipeline } from "./agents/pipeline";
import { getCreditBalance, hasCredits, consumeCredits, getUsageSummary } from "./services/credits";
import type { ForgeBrief } from "@shared/models/pipeline";

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

export async function registerRoutes(server: Server, app: Express) {
  // Apply rate limiting to all API routes
  app.use("/api", apiLimiter);

  // Middleware chain for authenticated routes
  const auth = [requireAuth as any, tenantScope as any, loadUserRole as any];

  // ── Health ──

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "forge", version: "1.0.0" });
  });

  // ── Projects ──

  app.post("/api/forge/projects", ...auth, pipelineLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { description, outputFormat, audience, tone, referenceNotes } = req.body;

      if (!description || !outputFormat) {
        throw new ValidationError("description and outputFormat are required");
      }

      if (!["docx", "pdf", "markdown"].includes(outputFormat)) {
        throw new ValidationError("outputFormat must be docx, pdf, or markdown");
      }

      const user = req.user as any;
      const tenantId = req.tenantId!;

      const brief: ForgeBrief = {
        description,
        outputFormat,
        audience,
        tone,
        referenceNotes,
      };

      // Run intake + estimate (no credits consumed)
      const projectSpec = await runIntakeAgent(brief, tenantId, user.id);
      const costEstimate = await runEstimateAgent(projectSpec, outputFormat, tenantId, user.id);

      // Create project in draft status
      const [project] = await db.insert(forgeProjects).values({
        tenantId,
        createdBy: user.id,
        title: projectSpec.title,
        brief: brief as any,
        estimatedCredits: costEstimate.totalCredits,
        status: "estimating",
        outputFormat: outputFormat as any,
        metadata: {
          projectSpec,
          costEstimate,
        },
      }).returning();

      res.status(201).json({
        project,
        costEstimate,
        projectSpec,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forge/projects", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const projects = await db
        .select()
        .from(forgeProjects)
        .where(eq(forgeProjects.tenantId, tenantId))
        .orderBy(desc(forgeProjects.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(forgeProjects)
        .where(eq(forgeProjects.tenantId, tenantId));

      res.json({ projects, total: Number(count), limit, offset });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forge/projects/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const [project] = await db
        .select()
        .from(forgeProjects)
        .where(and(eq(forgeProjects.id, req.params.id), eq(forgeProjects.tenantId, tenantId)));

      if (!project) throw new NotFoundError("Project not found");

      // Get agent runs for this project
      const runs = await db
        .select()
        .from(forgeAgentRuns)
        .where(eq(forgeAgentRuns.projectId, project.id))
        .orderBy(forgeAgentRuns.createdAt);

      res.json({ project, agentRuns: runs });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forge/projects/:id/approve", ...auth, pipelineLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;

      const [project] = await db
        .select()
        .from(forgeProjects)
        .where(and(eq(forgeProjects.id, req.params.id), eq(forgeProjects.tenantId, tenantId)));

      if (!project) throw new NotFoundError("Project not found");
      if (project.status !== "estimating") {
        throw new ValidationError(`Cannot approve project in '${project.status}' status`);
      }

      const estimatedCredits = project.estimatedCredits ?? 0;
      if (!await hasCredits(tenantId, estimatedCredits)) {
        throw new ValidationError(`Insufficient credits. Need ${estimatedCredits}.`);
      }

      // Consume credits
      await consumeCredits(tenantId, user.id, project.id, estimatedCredits, "production");

      // Update status
      await db.update(forgeProjects).set({
        status: "queued",
        updatedAt: new Date(),
      }).where(eq(forgeProjects.id, project.id));

      // Run pipeline asynchronously
      const brief = project.brief as ForgeBrief;
      runForgePipeline(project.id, brief, tenantId, user.id).catch((err) => {
        console.error(`Pipeline failed for project ${project.id}:`, err);
      });

      res.json({ executionStarted: true, projectId: project.id });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/forge/projects/:id/revise", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const user = req.user as any;
      const { feedback } = req.body;

      if (!feedback) throw new ValidationError("feedback is required");

      const [project] = await db
        .select()
        .from(forgeProjects)
        .where(and(eq(forgeProjects.id, req.params.id), eq(forgeProjects.tenantId, tenantId)));

      if (!project) throw new NotFoundError("Project not found");
      if (project.status !== "completed") {
        throw new ValidationError("Can only revise completed projects");
      }

      const isFreeRevision = project.revisionCount < project.maxFreeRevisions;
      const creditType = isFreeRevision ? "free_revision" as const : "revision" as const;

      if (!isFreeRevision) {
        const revisionCost = Math.ceil((project.estimatedCredits ?? 0) * 0.2);
        if (!await hasCredits(tenantId, revisionCost)) {
          throw new ValidationError(`Insufficient credits for paid revision. Need ${revisionCost}.`);
        }
        await consumeCredits(tenantId, user.id, project.id, revisionCost, creditType);
      }

      await db.update(forgeProjects).set({
        status: "revised",
        revisionCount: sql`${forgeProjects.revisionCount} + 1`,
        updatedAt: new Date(),
      }).where(eq(forgeProjects.id, project.id));

      // Re-run pipeline with revision feedback
      const brief = project.brief as ForgeBrief;
      brief.referenceNotes = `REVISION REQUEST: ${feedback}\n\n${brief.referenceNotes ?? ""}`;

      runForgePipeline(project.id, brief, tenantId, user.id).catch((err) => {
        console.error(`Revision pipeline failed for project ${project.id}:`, err);
      });

      res.json({ revisionQueued: true, isChargeable: !isFreeRevision });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forge/projects/:id/download", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const [project] = await db
        .select()
        .from(forgeProjects)
        .where(and(eq(forgeProjects.id, req.params.id), eq(forgeProjects.tenantId, tenantId)));

      if (!project) throw new NotFoundError("Project not found");
      if (!project.outputUrl) throw new NotFoundError("No output available");

      res.json({
        downloadUrl: project.outputUrl,
        filename: (project.metadata as any)?.filename ?? "output",
        format: project.outputFormat,
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/forge/projects/:id", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const [project] = await db
        .select()
        .from(forgeProjects)
        .where(and(eq(forgeProjects.id, req.params.id), eq(forgeProjects.tenantId, tenantId)));

      if (!project) throw new NotFoundError("Project not found");
      if (project.status === "running") {
        throw new ValidationError("Cannot delete a running project");
      }

      await db.delete(forgeProjects).where(eq(forgeProjects.id, project.id));
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  });

  // ── Templates ──

  app.get("/api/forge/templates", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const templates = await db
        .select()
        .from(forgeTemplates)
        .where(
          sql`(${forgeTemplates.tenantId} = ${tenantId} OR ${forgeTemplates.tenantId} IS NULL) AND ${forgeTemplates.isActive} = true`
        )
        .orderBy(desc(forgeTemplates.usageCount));

      res.json({ templates });
    } catch (error) {
      next(error);
    }
  });

  // ── Usage / Credits ──

  app.get("/api/forge/credits", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const balance = await getCreditBalance(req.tenantId!);
      res.json(balance);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/forge/usage", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getUsageSummary(req.tenantId!);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  // ── Tenant Config ──

  app.get("/api/tenant-config", ...auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!;
      const [tenant] = await db.select().from(
        sql`tenants`
      ).where(sql`id = ${tenantId}`);

      res.json({
        tenantId,
        tenantType: req.tenantType,
        config: (tenant as any)?.config_json ?? {},
      });
    } catch (error) {
      next(error);
    }
  });
}
