/**
 * Agent Executor — runs approved plans step-by-step
 *
 * Executes steps in DAG topological order, respects approval gateway,
 * and synthesizes a final answer from all step outputs.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type { ChatMessage } from "@cavaridge/spaniel";
import type { PlanStepType, StepStatus } from "@cavaridge/types";
import { db } from "../db.js";
import { agentPlans, agentPlanSteps } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { evaluateApproval, type ApprovalGatewayParams } from "./approval.js";
import { logAgentAudit, AGENT_AUDIT_ACTIONS, AGENT_RESOURCE_TYPES } from "./audit-events.js";
import { logger } from "../logger.js";
import type { GeneratedPlanStep } from "./planner.js";

// ── Types ────────────────────────────────────────────────────────────

export interface StepOutput {
  stepId: string;
  content: string;
  confidence: number;
}

export interface ExecutionResult {
  planId: string;
  status: "completed" | "executing" | "failed" | "awaiting_approval";
  answer: string | null;
  steps: Array<{
    id: string;
    orderIndex: number;
    type: string;
    description: string;
    status: string;
    output: string | null;
  }>;
  awaitingStepId?: string;
}

// ── Topological Sort ─────────────────────────────────────────────────

function topologicalSort(steps: GeneratedPlanStep[]): GeneratedPlanStep[] {
  const idToStep = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const sorted: GeneratedPlanStep[] = [];

  function visit(step: GeneratedPlanStep) {
    if (visited.has(step.id)) return;
    visited.add(step.id);
    for (const depId of step.dependsOn) {
      const dep = idToStep.get(depId);
      if (dep) visit(dep);
    }
    sorted.push(step);
  }

  for (const step of steps) {
    visit(step);
  }

  return sorted;
}

// ── Execute Single Step ──────────────────────────────────────────────

async function executeStep(
  step: GeneratedPlanStep,
  priorOutputs: StepOutput[],
  tenantId: string,
  userId: string,
): Promise<StepOutput> {
  // Build context from prior step outputs
  const contextParts = priorOutputs
    .filter((o) => step.dependsOn.includes(o.stepId))
    .map((o, i) => `[Prior Finding ${i + 1}]\n${o.content}`);

  const context = contextParts.length > 0
    ? `\n\nContext from prior research steps:\n${contextParts.join("\n\n")}`
    : "";

  const taskType = step.type === "read" ? "extraction" as const : "analysis" as const;

  const systemPrompt = step.type === "read"
    ? "You are a research assistant. Extract and organize relevant information for the given task. Be thorough and factual."
    : "You are an analytical assistant. Analyze the provided context and produce insights. Be specific and cite your reasoning.";

  const messages: ChatMessage[] = [
    { role: "user", content: `${step.description}${context}` },
  ];

  const response = await chatCompletion({
    tenantId,
    userId,
    appCode: "CVG-DUCKY",
    taskType,
    system: systemPrompt,
    messages,
    options: { temperature: 0.4 },
  });

  // Extract confidence from the response metadata if available
  const confidence = response.consensus?.confidenceScore ?? 0.8;

  return {
    stepId: step.id,
    content: response.content,
    confidence,
  };
}

// ── Synthesize Final Answer ──────────────────────────────────────────

async function synthesizeAnswer(
  query: string,
  stepOutputs: StepOutput[],
  steps: GeneratedPlanStep[],
  tenantId: string,
  userId: string,
): Promise<string> {
  const stepIdToStep = new Map(steps.map((s) => [s.id, s]));

  const findingsBlock = stepOutputs
    .map((o, i) => {
      const step = stepIdToStep.get(o.stepId);
      return `[Step ${i + 1}: ${step?.description || "Unknown"}]\n${o.content}`;
    })
    .join("\n\n---\n\n");

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Original question: ${query}\n\nResearch findings:\n\n${findingsBlock}\n\nPlease synthesize all findings into a comprehensive, well-structured answer to the original question. Use markdown formatting. Cite which research steps support each point.`,
    },
  ];

  const response = await chatCompletion({
    tenantId,
    userId,
    appCode: "CVG-DUCKY",
    taskType: "analysis",
    system: "You are Ducky, Cavaridge's AI answer engine. Synthesize research findings into a clear, comprehensive answer. Use markdown formatting with headers, bullet points, and emphasis where appropriate.",
    messages,
    options: { temperature: 0.3 },
  });

  return response.content;
}

// ── Main Executor ────────────────────────────────────────────────────

export async function executePlan(
  planId: string,
  tenantId: string,
  userId: string,
): Promise<ExecutionResult> {
  // Load plan
  const [plan] = await db.select().from(agentPlans)
    .where(and(eq(agentPlans.id, planId), eq(agentPlans.tenantId, tenantId)));

  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "approved" && plan.status !== "executing") {
    throw new Error(`Plan is in ${plan.status} state, cannot execute`);
  }

  // Update status to executing
  if (plan.status === "approved") {
    await db.update(agentPlans)
      .set({ status: "executing", updatedAt: new Date() })
      .where(eq(agentPlans.id, planId));

    await logAgentAudit(
      tenantId, userId,
      AGENT_AUDIT_ACTIONS.PLAN_EXECUTING,
      AGENT_RESOURCE_TYPES.PLAN,
      planId,
      { planId },
    );
  }

  // Load steps
  const rawSteps = await db.select().from(agentPlanSteps)
    .where(eq(agentPlanSteps.planId, planId))
    .orderBy(agentPlanSteps.orderIndex);

  const steps: GeneratedPlanStep[] = rawSteps.map((s) => ({
    id: s.id,
    planId: s.planId,
    orderIndex: s.orderIndex,
    type: s.type as PlanStepType,
    connector: s.connector,
    description: s.description,
    dependsOn: (s.dependsOn as string[]) || [],
    status: s.status as StepStatus,
  }));

  // Topological order
  const sortedSteps = topologicalSort(steps);
  const stepOutputs: StepOutput[] = [];

  // Execute each step
  for (const step of sortedSteps) {
    // Skip already completed steps (for resumption after approval pause)
    if (step.status === "completed") {
      const existing = rawSteps.find((s) => s.id === step.id);
      if (existing?.outputData) {
        const data = existing.outputData as Record<string, unknown>;
        stepOutputs.push({
          stepId: step.id,
          content: (data.content as string) || "",
          confidence: (data.confidence as number) || 0.8,
        });
      }
      continue;
    }

    if (step.status === "skipped" || step.status === "failed") continue;

    // Check dependencies are complete
    const depsComplete = step.dependsOn.every((depId) => {
      const dep = steps.find((s) => s.id === depId);
      return dep?.status === "completed" || stepOutputs.some((o) => o.stepId === depId);
    });

    if (!depsComplete) {
      logger.warn({ stepId: step.id, planId }, "Skipping step — dependencies not met");
      continue;
    }

    // Check approval
    const approval = await evaluateApproval({
      user: { id: userId, role: "user" } as any,
      orgId: tenantId,
      planId,
      stepId: step.id,
      stepType: step.type,
      actionPreview: { description: step.description, connector: step.connector },
    });

    if (approval.requiresUserApproval) {
      // Pause execution — return partial result
      await db.update(agentPlanSteps)
        .set({ status: "pending" })
        .where(eq(agentPlanSteps.id, step.id));

      return buildResult(planId, "awaiting_approval", null, rawSteps, stepOutputs, step.id);
    }

    // Execute step
    await db.update(agentPlanSteps)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(agentPlanSteps.id, step.id));

    await logAgentAudit(
      tenantId, userId,
      AGENT_AUDIT_ACTIONS.STEP_STARTED,
      AGENT_RESOURCE_TYPES.STEP,
      step.id,
      { planId, stepId: step.id },
    );

    try {
      const output = await executeStep(step, stepOutputs, tenantId, userId);
      stepOutputs.push(output);

      await db.update(agentPlanSteps)
        .set({
          status: "completed",
          outputData: { content: output.content, confidence: output.confidence },
          confidence: output.confidence.toString(),
          completedAt: new Date(),
        })
        .where(eq(agentPlanSteps.id, step.id));

      // Update in-memory step status for dependency checks
      step.status = "completed";

      await logAgentAudit(
        tenantId, userId,
        AGENT_AUDIT_ACTIONS.STEP_COMPLETED,
        AGENT_RESOURCE_TYPES.STEP,
        step.id,
        { planId, stepId: step.id, metadata: { confidence: output.confidence } },
      );
    } catch (err) {
      logger.error({ err, stepId: step.id, planId }, "Step execution failed");

      await db.update(agentPlanSteps)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(agentPlanSteps.id, step.id));

      await logAgentAudit(
        tenantId, userId,
        AGENT_AUDIT_ACTIONS.STEP_FAILED,
        AGENT_RESOURCE_TYPES.STEP,
        step.id,
        { planId, stepId: step.id, metadata: { error: err instanceof Error ? err.message : "Unknown" } },
      );

      // Continue with other steps that don't depend on this one
      step.status = "failed";
    }
  }

  // All steps done — synthesize answer
  if (stepOutputs.length === 0) {
    await db.update(agentPlans)
      .set({ status: "failed", errorMessage: "No steps completed successfully", updatedAt: new Date() })
      .where(eq(agentPlans.id, planId));

    await logAgentAudit(
      tenantId, userId,
      AGENT_AUDIT_ACTIONS.PLAN_FAILED,
      AGENT_RESOURCE_TYPES.PLAN,
      planId,
      { planId, metadata: { reason: "no_steps_completed" } },
    );

    return buildResult(planId, "failed", null, rawSteps, stepOutputs);
  }

  const answer = await synthesizeAnswer(plan.query, stepOutputs, steps, tenantId, userId);

  await db.update(agentPlans)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(agentPlans.id, planId));

  await logAgentAudit(
    tenantId, userId,
    AGENT_AUDIT_ACTIONS.PLAN_COMPLETED,
    AGENT_RESOURCE_TYPES.PLAN,
    planId,
    { planId, metadata: { stepsCompleted: stepOutputs.length } },
  );

  // Reload steps to get latest status
  const finalSteps = await db.select().from(agentPlanSteps)
    .where(eq(agentPlanSteps.planId, planId))
    .orderBy(agentPlanSteps.orderIndex);

  return buildResult(planId, "completed", answer, finalSteps, stepOutputs);
}

// ── Helper ───────────────────────────────────────────────────────────

function buildResult(
  planId: string,
  status: ExecutionResult["status"],
  answer: string | null,
  dbSteps: Array<{ id: string; orderIndex: number; type: string; description: string; status: string; outputData: unknown }>,
  outputs: StepOutput[],
  awaitingStepId?: string,
): ExecutionResult {
  const outputMap = new Map(outputs.map((o) => [o.stepId, o.content]));

  return {
    planId,
    status,
    answer,
    steps: dbSteps.map((s) => ({
      id: s.id,
      orderIndex: s.orderIndex,
      type: s.type,
      description: s.description,
      status: s.status,
      output: outputMap.get(s.id) || ((s.outputData as any)?.content as string) || null,
    })),
    awaitingStepId,
  };
}
