/**
 * Agent Planner — generates structured research plans from user queries
 *
 * Uses Spaniel's chatCompletion to produce a JSON plan, validates it,
 * persists to DB, and returns a ResearchPlan ready for approval.
 */

import { chatCompletion } from "@cavaridge/spaniel";
import type { ChatMessage } from "@cavaridge/spaniel";
import { detectPromptInjection } from "@cavaridge/security";
import type { PlanStepType, PlanStatus, StepStatus, TenantAgentConfig } from "@cavaridge/types";
import { db } from "../db.js";
import { agentPlans, agentPlanSteps } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAgentAudit, AGENT_AUDIT_ACTIONS, AGENT_RESOURCE_TYPES } from "./audit-events.js";
import { DEFAULT_AGENT_CONFIG } from "./approval.js";
import { logger } from "../logger.js";

// ── Types ────────────────────────────────────────────────────────────

interface RawPlanStep {
  type: string;
  description: string;
  dependsOn?: number[];
}

export interface GeneratedPlan {
  id: string;
  tenantId: string;
  userId: string;
  query: string;
  status: PlanStatus;
  steps: GeneratedPlanStep[];
  stepCount: number;
  createdAt: Date;
}

export interface GeneratedPlanStep {
  id: string;
  planId: string;
  orderIndex: number;
  type: PlanStepType;
  connector: string;
  description: string;
  dependsOn: string[];
  status: StepStatus;
}

// ── System Prompt ────────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are Ducky's research planner. Given a user's question, generate a structured research plan as a JSON array of steps.

Each step must have:
- "type": one of "read" or "reason" (Phase 1 only supports these)
- "description": a clear, actionable description of what this step does
- "dependsOn": array of step indices (0-based) this step depends on. Use [] for steps with no dependencies.

Guidelines:
- Use "read" for gathering information, extracting data, or looking up facts
- Use "reason" for analysis, comparison, synthesis, or drawing conclusions
- Keep plans between 2 and 10 steps
- Structure steps as a DAG — later steps can depend on earlier ones
- The final step should always be a "reason" step that synthesizes all findings
- Be specific in descriptions — each step should have a clear deliverable

Respond with ONLY a JSON array, no markdown fencing, no explanation. Example:
[
  {"type": "read", "description": "Research the key features and pricing of option A", "dependsOn": []},
  {"type": "read", "description": "Research the key features and pricing of option B", "dependsOn": []},
  {"type": "reason", "description": "Compare options A and B across cost, features, and scalability", "dependsOn": [0, 1]}
]`;

// ── Plan Generation ──────────────────────────────────────────────────

export async function generatePlan(
  query: string,
  tenantId: string,
  userId: string,
  tenantConfig?: Partial<TenantAgentConfig>,
): Promise<GeneratedPlan> {
  const config = { ...DEFAULT_AGENT_CONFIG, ...tenantConfig };

  // Security: scan query for prompt injection
  const injectionResult = detectPromptInjection(query);
  if (injectionResult.isInjection) {
    logger.warn({ tenantId, score: injectionResult.score, patterns: injectionResult.matchedPatterns }, "Prompt injection detected in agent query");
    throw new Error("Input flagged for safety review. Please rephrase your question.");
  }

  const messages: ChatMessage[] = [
    { role: "user", content: query },
  ];

  const response = await chatCompletion({
    tenantId,
    userId,
    appCode: "CVG-RESEARCH",
    taskType: "analysis",
    system: PLANNER_SYSTEM_PROMPT,
    messages,
    options: { temperature: 0.3 },
  });

  // Parse the LLM response as JSON
  let rawSteps: RawPlanStep[];
  try {
    const cleaned = response.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    rawSteps = JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, content: response.content }, "Failed to parse plan JSON from LLM");
    throw new Error("Failed to generate a valid research plan. Please try rephrasing your question.");
  }

  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    throw new Error("Plan generation returned empty or invalid result.");
  }

  // Enforce max steps
  if (rawSteps.length > config.maxStepsPerPlan) {
    rawSteps = rawSteps.slice(0, config.maxStepsPerPlan);
  }

  // Validate and normalize steps
  const validTypes: PlanStepType[] = ["read", "reason"];
  const normalizedSteps = rawSteps.map((step, i) => {
    const type = validTypes.includes(step.type as PlanStepType)
      ? (step.type as PlanStepType)
      : "reason";

    const deps = Array.isArray(step.dependsOn)
      ? step.dependsOn.filter((d) => typeof d === "number" && d >= 0 && d < i)
      : [];

    return { type, description: step.description || `Step ${i + 1}`, dependsOn: deps };
  });

  // Persist plan
  const [plan] = await db.insert(agentPlans).values({
    tenantId,
    userId,
    requestingApp: "CVG-RESEARCH",
    query,
    status: "pending_approval",
    stepCount: normalizedSteps.length,
  }).returning();

  // Persist steps
  const insertedSteps: (typeof agentPlanSteps.$inferSelect)[] = [];
  for (let i = 0; i < normalizedSteps.length; i++) {
    const step = normalizedSteps[i];
    const [inserted] = await db.insert(agentPlanSteps).values({
      planId: plan.id,
      orderIndex: i,
      type: step.type,
      connector: "spaniel",
      description: step.description,
      dependsOn: step.dependsOn,
      inputData: {},
      status: "pending",
    }).returning();
    insertedSteps.push(inserted);
  }

  // Resolve dependsOn from indices to UUIDs
  const stepsWithResolvedDeps: GeneratedPlanStep[] = insertedSteps.map((s, i) => {
    const rawDeps = normalizedSteps[i].dependsOn;
    const resolvedDeps = rawDeps.map((depIdx) => insertedSteps[depIdx].id);

    return {
      id: s.id,
      planId: plan.id,
      orderIndex: s.orderIndex,
      type: s.type as PlanStepType,
      connector: s.connector,
      description: s.description,
      dependsOn: resolvedDeps,
      status: s.status as StepStatus,
    };
  });

  // Update dependsOn in DB with resolved UUIDs
  for (let i = 0; i < stepsWithResolvedDeps.length; i++) {
    if (stepsWithResolvedDeps[i].dependsOn.length > 0) {
      await db.update(agentPlanSteps)
        .set({ dependsOn: stepsWithResolvedDeps[i].dependsOn })
        .where(eq(agentPlanSteps.id, stepsWithResolvedDeps[i].id));
    }
  }

  // Audit log
  await logAgentAudit(
    tenantId,
    userId,
    AGENT_AUDIT_ACTIONS.PLAN_CREATED,
    AGENT_RESOURCE_TYPES.PLAN,
    plan.id,
    { planId: plan.id, metadata: { stepCount: normalizedSteps.length, query } },
  );

  return {
    id: plan.id,
    tenantId: plan.tenantId,
    userId: plan.userId,
    query: plan.query,
    status: plan.status as PlanStatus,
    steps: stepsWithResolvedDeps,
    stepCount: normalizedSteps.length,
    createdAt: plan.createdAt!,
  };
}

// ── Load Plan from DB ────────────────────────────────────────────────

export async function loadPlan(planId: string, tenantId: string): Promise<GeneratedPlan | null> {
  const [plan] = await db.select().from(agentPlans)
    .where(and(eq(agentPlans.id, planId), eq(agentPlans.tenantId, tenantId)));

  if (!plan) return null;

  const steps = await db.select().from(agentPlanSteps)
    .where(eq(agentPlanSteps.planId, planId))
    .orderBy(agentPlanSteps.orderIndex);

  return {
    id: plan.id,
    tenantId: plan.tenantId,
    userId: plan.userId,
    query: plan.query,
    status: plan.status as PlanStatus,
    steps: steps.map((s) => ({
      id: s.id,
      planId: s.planId,
      orderIndex: s.orderIndex,
      type: s.type as PlanStepType,
      connector: s.connector,
      description: s.description,
      dependsOn: (s.dependsOn as string[]) || [],
      status: s.status as StepStatus,
    })),
    stepCount: plan.stepCount || steps.length,
    createdAt: plan.createdAt!,
  };
}

// ── List Plans ───────────────────────────────────────────────────────

export async function listPlans(
  tenantId: string,
  userId: string,
  limit = 20,
): Promise<Array<{ id: string; query: string; status: string; stepCount: number; createdAt: Date }>> {
  const plans = await db.select({
    id: agentPlans.id,
    query: agentPlans.query,
    status: agentPlans.status,
    stepCount: agentPlans.stepCount,
    createdAt: agentPlans.createdAt,
  }).from(agentPlans)
    .where(and(eq(agentPlans.tenantId, tenantId), eq(agentPlans.userId, userId)))
    .orderBy(desc(agentPlans.createdAt))
    .limit(limit);

  return plans.map((p) => ({
    id: p.id,
    query: p.query,
    status: p.status,
    stepCount: p.stepCount || 0,
    createdAt: p.createdAt!,
  }));
}
