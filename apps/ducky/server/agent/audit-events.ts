// Re-exports from @cavaridge/audit — constants now live in the shared package.
// The logAgentAudit helper stays here since it depends on Ducky's local logAudit.

import { logAudit } from "../auth.js";

export {
  AGENT_AUDIT_ACTIONS,
  AGENT_RESOURCE_TYPES,
  type AgentAuditAction,
} from "@cavaridge/audit/agent-events";

// Backward-compatible type alias
export type AgentAuditActionValue = import("@cavaridge/audit/agent-events").AgentAuditAction;

// ── Logging Helper ───────────────────────────────────────────────────

export async function logAgentAudit(
  orgId: string,
  userId: string,
  action: string,
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
