// ── Connector & Step Enums ───────────────────────────────────────────

export type ConnectorType =
  | "github"
  | "gitlab"
  | "jira"
  | "slack"
  | "notion"
  | "salesforce"
  | "hubspot"
  | "google_workspace"
  | "microsoft_365"
  | "stripe";

export type PlanStepType = "read" | "reason" | "write" | "delete";

export type PlanStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type ApprovalTier = "read" | "write" | "delete";

// ── Core Interfaces ──────────────────────────────────────────────────

export interface PlanStep {
  id: string;
  planId: string;
  orderIndex: number;
  type: PlanStepType;
  connector: ConnectorType | "spaniel";
  description: string;
  dependsOn: string[];
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: StepStatus;
  confidence: number | null;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ResearchPlan {
  id: string;
  tenantId: string;
  userId: string;
  requestingApp?: string;
  query: string;
  status: PlanStatus;
  steps: PlanStep[];
  stepCount: number;
  errorMessage?: string;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface AgentActionApproval {
  id: string;
  planId: string;
  stepId: string;
  userId: string;
  actionType: ApprovalTier;
  actionPreview: Record<string, unknown>;
  approved: boolean;
  responseComment?: string;
  createdAt: string;
}

// ── Audit Event Types ────────────────────────────────────────────────

export type AgentAuditAction =
  | "plan.created"
  | "plan.approved"
  | "plan.rejected"
  | "plan.cancelled"
  | "plan.executing"
  | "plan.completed"
  | "plan.failed"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "step.skipped"
  | "action.previewed"
  | "action.approved"
  | "action.rejected"
  | "action.executed"
  | "action.failed";

export interface AgentAuditEvent {
  action: AgentAuditAction;
  tenantId: string;
  userId: string;
  planId: string;
  stepId?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ── Approval Gateway Types ───────────────────────────────────────────

export interface ApprovalDecision {
  tier: ApprovalTier;
  autoApproved: boolean;
  requiresUserApproval: boolean;
  approvalId?: string;
  reason: string;
}

export interface TenantAgentConfig {
  autoApproveReads: boolean;
  maxStepsPerPlan: number;
  maxPlansPerHour: number;
  maxActionsPerDay: number;
}
