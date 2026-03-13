import { logAudit } from "../auth.js";

// ── Agent Audit Action Constants ─────────────────────────────────────

export const AGENT_AUDIT_ACTIONS = {
  PLAN_CREATED: "plan.created",
  PLAN_APPROVED: "plan.approved",
  PLAN_REJECTED: "plan.rejected",
  PLAN_CANCELLED: "plan.cancelled",
  PLAN_EXECUTING: "plan.executing",
  PLAN_COMPLETED: "plan.completed",
  PLAN_FAILED: "plan.failed",

  STEP_STARTED: "step.started",
  STEP_COMPLETED: "step.completed",
  STEP_FAILED: "step.failed",
  STEP_SKIPPED: "step.skipped",

  ACTION_PREVIEWED: "action.previewed",
  ACTION_APPROVED: "action.approved",
  ACTION_REJECTED: "action.rejected",
  ACTION_EXECUTED: "action.executed",
  ACTION_FAILED: "action.failed",
} as const;

export type AgentAuditActionValue = typeof AGENT_AUDIT_ACTIONS[keyof typeof AGENT_AUDIT_ACTIONS];

// ── Resource Type Constants ──────────────────────────────────────────

export const AGENT_RESOURCE_TYPES = {
  PLAN: "agent_plan",
  STEP: "agent_plan_step",
  APPROVAL: "agent_action_approval",
} as const;

// ── Logging Helper ───────────────────────────────────────────────────

export async function logAgentAudit(
  orgId: string,
  userId: string,
  action: AgentAuditActionValue,
  resourceType: string,
  resourceId: string,
  details: {
    planId: string;
    stepId?: string;
    metadata?: Record<string, unknown>;
  },
  ipAddress?: string,
): Promise<void> {
  await logAudit(
    orgId,
    userId,
    action,
    resourceType,
    resourceId,
    {
      planId: details.planId,
      stepId: details.stepId || null,
      ...details.metadata,
    },
    ipAddress,
  );
}
