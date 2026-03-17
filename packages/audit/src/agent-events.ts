/**
 * Canonical agent audit action and resource type constants.
 * Replaces apps/ducky/server/agent/audit-events.ts constants.
 */

// ── Agent Audit Actions ──────────────────────────────────────────────

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

export type AgentAuditAction = typeof AGENT_AUDIT_ACTIONS[keyof typeof AGENT_AUDIT_ACTIONS];

// ── Agent Resource Types ─────────────────────────────────────────────

export const AGENT_RESOURCE_TYPES = {
  PLAN: "agent_plan",
  STEP: "agent_plan_step",
  APPROVAL: "agent_action_approval",
} as const;

export type AgentResourceType = typeof AGENT_RESOURCE_TYPES[keyof typeof AGENT_RESOURCE_TYPES];

// ── General Audit Actions (non-agent) ────────────────────────────────

export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: "auth.login",
  LOGOUT: "auth.logout",
  TOKEN_REFRESH: "auth.token_refresh",

  // Data
  RECORD_CREATE: "data.create",
  RECORD_UPDATE: "data.update",
  RECORD_DELETE: "data.delete",

  // Admin
  USER_INVITE: "admin.user_invite",
  USER_DEACTIVATE: "admin.user_deactivate",
  ROLE_CHANGE: "admin.role_change",
  SETTINGS_UPDATE: "admin.settings_update",

  // Agent (re-export for convenience)
  ...AGENT_AUDIT_ACTIONS,
} as const;

// ── General Resource Types ───────────────────────────────────────────

export const RESOURCE_TYPES = {
  USER: "user",
  ORGANIZATION: "organization",
  SETTINGS: "settings",
  SESSION: "session",
  ...AGENT_RESOURCE_TYPES,
} as const;
