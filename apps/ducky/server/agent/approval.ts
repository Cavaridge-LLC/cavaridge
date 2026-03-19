import type { ApprovalTier, ApprovalDecision, TenantAgentConfig, PlanStepType } from "@cavaridge/types";
import type { Profile as User } from "@cavaridge/auth/schema";
import { agentActionApprovals } from "@shared/schema";
import { hasPermission } from "../permissions.js";
import { db } from "../db.js";
import { logAgentAudit, AGENT_AUDIT_ACTIONS, AGENT_RESOURCE_TYPES } from "./audit-events.js";

// ── Default Tenant Agent Config ──────────────────────────────────────

export const DEFAULT_AGENT_CONFIG: TenantAgentConfig = {
  autoApproveReads: true,
  maxStepsPerPlan: 10,
  maxPlansPerHour: 50,
  maxActionsPerDay: 25,
};

// ── Step Type → Approval Tier ────────────────────────────────────────

export function getApprovalTier(stepType: PlanStepType): ApprovalTier {
  switch (stepType) {
    case "read":
    case "reason":
      return "read";
    case "write":
      return "write";
    case "delete":
      return "delete";
  }
}

// ── Core Approval Gateway ────────────────────────────────────────────

export interface ApprovalGatewayParams {
  user: User;
  orgId: string;
  planId: string;
  stepId: string;
  stepType: PlanStepType;
  actionPreview: Record<string, unknown>;
  tenantConfig?: Partial<TenantAgentConfig>;
}

export async function evaluateApproval(
  params: ApprovalGatewayParams,
): Promise<ApprovalDecision> {
  const config = { ...DEFAULT_AGENT_CONFIG, ...params.tenantConfig };
  const tier = getApprovalTier(params.stepType);

  // Write/delete tiers require agent_approve_action permission
  if (tier === "write" || tier === "delete") {
    if (!hasPermission(params.user, "agent_approve_action")) {
      return {
        tier,
        autoApproved: false,
        requiresUserApproval: true,
        reason: "User role does not have agent_approve_action permission",
      };
    }
  }

  switch (tier) {
    case "read": {
      if (config.autoApproveReads) {
        const [approval] = await db.insert(agentActionApprovals).values({
          planId: params.planId,
          stepId: params.stepId,
          userId: params.user.id,
          actionType: "read",
          actionPreview: params.actionPreview,
          approved: true,
          responseComment: "Auto-approved (read tier)",
        }).returning();

        await logAgentAudit(
          params.orgId,
          params.user.id,
          AGENT_AUDIT_ACTIONS.ACTION_APPROVED,
          AGENT_RESOURCE_TYPES.APPROVAL,
          approval.id,
          { planId: params.planId, stepId: params.stepId, metadata: { autoApproved: true } },
        );

        return {
          tier: "read",
          autoApproved: true,
          requiresUserApproval: false,
          approvalId: approval.id,
          reason: "Read tier auto-approved per tenant config",
        };
      }

      return {
        tier: "read",
        autoApproved: false,
        requiresUserApproval: true,
        reason: "Tenant config requires manual approval for read operations",
      };
    }

    case "write": {
      return {
        tier: "write",
        autoApproved: false,
        requiresUserApproval: true,
        reason: "Write operations always require explicit user approval",
      };
    }

    case "delete": {
      return {
        tier: "delete",
        autoApproved: false,
        requiresUserApproval: true,
        reason: "Delete operations require explicit confirmation with impact summary",
      };
    }
  }
}

// ── Record Approval Decision ─────────────────────────────────────────

export interface RecordApprovalParams {
  orgId: string;
  planId: string;
  stepId: string;
  userId: string;
  actionType: ApprovalTier;
  actionPreview: Record<string, unknown>;
  approved: boolean;
  responseComment?: string;
}

export async function recordApprovalDecision(
  params: RecordApprovalParams,
): Promise<string> {
  const [approval] = await db.insert(agentActionApprovals).values({
    planId: params.planId,
    stepId: params.stepId,
    userId: params.userId,
    actionType: params.actionType,
    actionPreview: params.actionPreview,
    approved: params.approved,
    responseComment: params.responseComment || null,
  }).returning();

  const auditAction = params.approved
    ? AGENT_AUDIT_ACTIONS.ACTION_APPROVED
    : AGENT_AUDIT_ACTIONS.ACTION_REJECTED;

  await logAgentAudit(
    params.orgId,
    params.userId,
    auditAction,
    AGENT_RESOURCE_TYPES.APPROVAL,
    approval.id,
    {
      planId: params.planId,
      stepId: params.stepId,
      metadata: { approved: params.approved, comment: params.responseComment },
    },
  );

  return approval.id;
}
