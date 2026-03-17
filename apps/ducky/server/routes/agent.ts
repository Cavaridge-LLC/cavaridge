/**
 * Agent API Routes — plan creation, approval, execution, and status
 */

import type { Express } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { hasPermission } from "../permissions";
import { generatePlan, loadPlan, listPlans } from "../agent/planner";
import { executePlan } from "../agent/executor";
import { recordApprovalDecision } from "../agent/approval";
import { logAgentAudit, AGENT_AUDIT_ACTIONS, AGENT_RESOURCE_TYPES } from "../agent/audit-events";
import { db } from "../db";
import { agentPlans, agentPlanSteps } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../logger";
import { z } from "zod";

const createPlanSchema = z.object({
  query: z.string().min(1).max(5000),
});

const approveStepSchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(1000).optional(),
});

export function registerAgentRoutes(app: Express) {
  // ── Create Plan ──────────────────────────────────────────────────

  app.post("/api/agent/plan", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "agent_create_plan")) {
        return res.status(403).json({ message: "Insufficient permissions to create agent plans" });
      }

      const parsed = createPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const plan = await generatePlan(parsed.data.query, req.orgId!, req.user!.id);
      res.status(201).json(plan);
    } catch (error: any) {
      logger.error({ err: error }, "Failed to create agent plan");
      res.status(500).json({ message: error.message || "Failed to generate plan" });
    }
  });

  // ── List Plans ───────────────────────────────────────────────────

  app.get("/api/agent/plans", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "agent_view_plans")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const plans = await listPlans(req.orgId!, req.user!.id);
      res.json(plans);
    } catch (error) {
      logger.error({ err: error }, "Failed to list plans");
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // ── Get Plan with Steps ──────────────────────────────────────────

  app.get("/api/agent/plans/:id", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "agent_view_plans")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const plan = await loadPlan(req.params.id as string, req.orgId!);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      res.json(plan);
    } catch (error) {
      logger.error({ err: error }, "Failed to get plan");
      res.status(500).json({ message: "Failed to fetch plan" });
    }
  });

  // ── Approve Plan → Start Execution ───────────────────────────────

  app.post("/api/agent/plans/:id/approve", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "agent_approve_plan")) {
        return res.status(403).json({ message: "Insufficient permissions to approve plans" });
      }

      const plan = await loadPlan(req.params.id as string, req.orgId!);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      if (plan.status !== "pending_approval") {
        return res.status(400).json({ message: `Plan is already in ${plan.status} state` });
      }

      // Update status to approved
      await db.update(agentPlans)
        .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(agentPlans.id, plan.id));

      await logAgentAudit(
        req.orgId!,
        req.user!.id,
        AGENT_AUDIT_ACTIONS.PLAN_APPROVED,
        AGENT_RESOURCE_TYPES.PLAN,
        plan.id,
        { planId: plan.id },
      );

      // Respond immediately, then execute in background
      res.json({ planId: plan.id, status: "executing" });

      // Fire-and-forget execution
      executePlan(plan.id, req.orgId!, req.user!.id).catch((err) => {
        logger.error({ err, planId: plan.id }, "Background plan execution failed");
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to approve plan");
      res.status(500).json({ message: "Failed to approve plan" });
    }
  });

  // ── Reject Plan ──────────────────────────────────────────────────

  app.post("/api/agent/plans/:id/reject", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "agent_approve_plan")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const plan = await loadPlan(req.params.id as string, req.orgId!);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      if (plan.status !== "pending_approval") {
        return res.status(400).json({ message: `Cannot reject plan in ${plan.status} state` });
      }

      await db.update(agentPlans)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(agentPlans.id, plan.id));

      await logAgentAudit(
        req.orgId!,
        req.user!.id,
        AGENT_AUDIT_ACTIONS.PLAN_REJECTED,
        AGENT_RESOURCE_TYPES.PLAN,
        plan.id,
        { planId: plan.id },
      );

      res.json({ planId: plan.id, status: "cancelled" });
    } catch (error) {
      logger.error({ err: error }, "Failed to reject plan");
      res.status(500).json({ message: "Failed to reject plan" });
    }
  });

  // ── Approve/Reject Step ──────────────────────────────────────────

  app.post("/api/agent/plans/:id/steps/:stepId/approve", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "agent_approve_action")) {
        return res.status(403).json({ message: "Insufficient permissions to approve actions" });
      }

      const parsed = approveStepSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const planId = req.params.id as string;
      const stepId = req.params.stepId as string;

      // Verify plan belongs to tenant
      const plan = await loadPlan(planId, req.orgId!);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      const step = plan.steps.find((s) => s.id === stepId);
      if (!step) {
        return res.status(404).json({ message: "Step not found" });
      }

      // Record the decision
      await recordApprovalDecision({
        orgId: req.orgId!,
        planId,
        stepId,
        userId: req.user!.id,
        actionType: step.type === "delete" ? "delete" : step.type === "write" ? "write" : "read",
        actionPreview: { description: step.description },
        approved: parsed.data.approved,
        responseComment: parsed.data.comment,
      });

      if (parsed.data.approved) {
        // Mark step as running and resume execution
        await db.update(agentPlanSteps)
          .set({ status: "running", startedAt: new Date() })
          .where(eq(agentPlanSteps.id, stepId));

        res.json({ stepId, status: "approved", resuming: true });

        // Resume execution in background
        executePlan(planId, req.orgId!, req.user!.id).catch((err) => {
          logger.error({ err, planId, stepId }, "Failed to resume execution after step approval");
        });
      } else {
        await db.update(agentPlanSteps)
          .set({ status: "skipped", completedAt: new Date() })
          .where(eq(agentPlanSteps.id, stepId));

        res.json({ stepId, status: "skipped" });
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to approve step");
      res.status(500).json({ message: "Failed to process step approval" });
    }
  });

  // ── Get Plan Status (for polling) ────────────────────────────────

  app.get("/api/agent/plans/:id/status", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!hasPermission(req.user!, "agent_view_plans")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const plan = await loadPlan(req.params.id as string, req.orgId!);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Load step outputs for completed steps
      const stepsWithOutput = await db.select().from(agentPlanSteps)
        .where(eq(agentPlanSteps.planId, plan.id))
        .orderBy(agentPlanSteps.orderIndex);

      const awaitingStep = stepsWithOutput.find((s) => s.status === "pending" || s.status === "running");

      res.json({
        planId: plan.id,
        status: plan.status,
        query: plan.query,
        stepCount: plan.stepCount,
        steps: stepsWithOutput.map((s) => ({
          id: s.id,
          orderIndex: s.orderIndex,
          type: s.type,
          description: s.description,
          status: s.status,
          output: s.status === "completed" ? ((s.outputData as any)?.content || null) : null,
          confidence: s.confidence ? parseFloat(s.confidence) : null,
        })),
        awaitingStepId: awaitingStep?.id || null,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to get plan status");
      res.status(500).json({ message: "Failed to fetch plan status" });
    }
  });
}
