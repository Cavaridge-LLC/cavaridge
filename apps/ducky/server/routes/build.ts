/**
 * Build Plan API Routes — CVGBuilder v3 Plan Mode
 *
 * Structured planning for generating BuildPlan objects:
 * agent graph, tool definitions, schema template, UI wireframe, RBAC matrix, test scenarios.
 */

import type { Express } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { hasPermission } from "../permissions";
import { db } from "../db";
import { buildPlans } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../logger";
import { chatCompletion } from "@cavaridge/spaniel";
import { z } from "zod";

const createBuildPlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  agentGraph: z.record(z.unknown()).optional(),
  toolDefinitions: z.array(z.record(z.unknown())).optional(),
  schemaTemplate: z.record(z.unknown()).optional(),
  uiWireframe: z.record(z.unknown()).optional(),
  rbacMatrix: z.record(z.unknown()).optional(),
});

const updateBuildPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  agentGraph: z.record(z.unknown()).optional(),
  toolDefinitions: z.array(z.record(z.unknown())).optional(),
  schemaTemplate: z.record(z.unknown()).optional(),
  uiWireframe: z.record(z.unknown()).optional(),
  rbacMatrix: z.record(z.unknown()).optional(),
  testScenarios: z.array(z.record(z.unknown())).optional(),
});

const BUILD_PLAN_SYSTEM_PROMPT = `You are CVGBuilder v3, the build planning engine for the Cavaridge platform.
Given a build plan specification, you must expand it into a complete BuildPlan object.

Your output MUST be valid JSON with these fields:
- agentGraph: { nodes: [{id, type, description, dependsOn}], edges: [{from, to}] }
- toolDefinitions: [{id, name, type, description, config}]
- schemaTemplate: { tables: [{name, columns: [{name, type, nullable, references}]}] }
- uiWireframe: { pages: [{path, name, components: [string]}] }
- rbacMatrix: { roles: [{role, permissions: [string]}] }
- testScenarios: [{name, description, type, steps: [string], expectedOutcome}] — minimum 3 scenarios

Rules:
- Every schema table MUST include a tenant_id UUID NOT NULL column
- Agent graph must form a valid DAG (no cycles)
- RBAC must include at least: platform_admin, tenant_admin, user, viewer
- Test scenarios must include: 1 happy-path, 1 permission-boundary, 1 error-handling
- All LLM calls in the agent graph must route through Spaniel (note this in tool definitions)
- UI wireframe pages must include light/dark/system theme support notation`;

export function registerBuildRoutes(app: Express) {
  // ── Create Build Plan ─────────────────────────────────────────────

  app.post("/api/build/plan", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "build_create_plan")) {
        return res.status(403).json({ message: "Insufficient permissions to create build plans" });
      }

      const parsed = createBuildPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const { name, description, agentGraph, toolDefinitions, schemaTemplate, uiWireframe, rbacMatrix } = parsed.data;

      // Call Spaniel to expand the partial plan into a full BuildPlan
      const userPrompt = JSON.stringify({
        name,
        description: description || "",
        partialAgentGraph: agentGraph || {},
        partialTools: toolDefinitions || [],
        partialSchema: schemaTemplate || {},
        partialUI: uiWireframe || {},
        partialRBAC: rbacMatrix || {},
      });

      let expandedPlan: Record<string, unknown> = {};

      try {
        const spanielResponse = await chatCompletion({
          tenantId: req.tenantId!,
          userId: req.user!.id,
          appCode: "CVG-RESEARCH",
          taskType: "code_generation",
          system: BUILD_PLAN_SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Expand this build specification into a complete BuildPlan:\n\n${userPrompt}` }],
        });

        // Parse the LLM response as JSON
        const content = spanielResponse.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          expandedPlan = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        logger.warn({ err }, "Spaniel expansion failed, saving plan with user-provided fields only");
      }

      // Merge user-provided fields with LLM-expanded fields (user fields take precedence)
      const [inserted] = await db.insert(buildPlans).values({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        name,
        description: description || null,
        agentGraph: agentGraph || expandedPlan.agentGraph || {},
        toolDefinitions: toolDefinitions || expandedPlan.toolDefinitions || [],
        schemaTemplate: schemaTemplate || expandedPlan.schemaTemplate || {},
        uiWireframe: uiWireframe || expandedPlan.uiWireframe || {},
        rbacMatrix: rbacMatrix || expandedPlan.rbacMatrix || {},
        testScenarios: expandedPlan.testScenarios || [],
        status: "draft",
      }).returning();

      res.status(201).json(inserted);
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create build plan");
      res.status(500).json({ message: error.message || "Failed to create build plan" });
    }
  });

  // ── List Build Plans ──────────────────────────────────────────────

  app.get("/api/build/plans", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "build_view_plans")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const plans = await db.select().from(buildPlans)
        .where(eq(buildPlans.tenantId, req.tenantId!))
        .orderBy(desc(buildPlans.createdAt));

      res.json(plans);
    } catch (error) {
      logger.error({ err: error }, "Failed to list build plans");
      res.status(500).json({ message: "Failed to fetch build plans" });
    }
  });

  // ── Get Build Plan ────────────────────────────────────────────────

  app.get("/api/build/plans/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "build_view_plans")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const [plan] = await db.select().from(buildPlans)
        .where(and(
          eq(buildPlans.id, req.params.id as string),
          eq(buildPlans.tenantId, req.tenantId!),
        ));

      if (!plan) {
        return res.status(404).json({ message: "Build plan not found" });
      }

      res.json(plan);
    } catch (error) {
      logger.error({ err: error }, "Failed to get build plan");
      res.status(500).json({ message: "Failed to fetch build plan" });
    }
  });

  // ── Update Build Plan ─────────────────────────────────────────────

  app.patch("/api/build/plans/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "build_create_plan")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const parsed = updateBuildPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const [existing] = await db.select().from(buildPlans)
        .where(and(
          eq(buildPlans.id, req.params.id as string),
          eq(buildPlans.tenantId, req.tenantId!),
        ));

      if (!existing) {
        return res.status(404).json({ message: "Build plan not found" });
      }

      if (existing.status === "finalized") {
        return res.status(400).json({ message: "Cannot update a finalized build plan" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) updates[key] = value;
      }

      const [updated] = await db.update(buildPlans)
        .set(updates)
        .where(eq(buildPlans.id, req.params.id as string))
        .returning();

      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, "Failed to update build plan");
      res.status(500).json({ message: "Failed to update build plan" });
    }
  });

  // ── Finalize Build Plan ───────────────────────────────────────────

  app.post("/api/build/plans/:id/finalize", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "build_create_plan")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const [plan] = await db.select().from(buildPlans)
        .where(and(
          eq(buildPlans.id, req.params.id as string),
          eq(buildPlans.tenantId, req.tenantId!),
        ));

      if (!plan) {
        return res.status(404).json({ message: "Build plan not found" });
      }

      if (plan.status === "finalized") {
        return res.status(400).json({ message: "Build plan is already finalized" });
      }

      // Validate minimum requirements
      const scenarios = plan.testScenarios as unknown[];
      if (!Array.isArray(scenarios) || scenarios.length < 3) {
        return res.status(400).json({ message: "Build plan must have at least 3 test scenarios before finalizing" });
      }

      const [updated] = await db.update(buildPlans)
        .set({ status: "finalized", updatedAt: new Date() })
        .where(eq(buildPlans.id, plan.id))
        .returning();

      res.json(updated);
    } catch (error) {
      logger.error({ err: error }, "Failed to finalize build plan");
      res.status(500).json({ message: "Failed to finalize build plan" });
    }
  });
}
