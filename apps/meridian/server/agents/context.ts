/**
 * Meridian Agent Context Factory
 *
 * Creates AgentContext instances pre-configured for Meridian (CVG-MER).
 */

import type { AgentContext, AgentConfig } from "@cavaridge/agent-core";
import { createAuditLogger, AGENT_AUDIT_ACTIONS, AGENT_RESOURCE_TYPES } from "@cavaridge/audit";
import { db } from "../db";

const MERIDIAN_CONFIG: AgentConfig = {
  agentId: "meridian",
  agentName: "Meridian Platform",
  appCode: "CVG-MER",
  version: "1.0.0",
};

const auditLog = createAuditLogger(db as never, { appCode: "CVG-MER" });

/**
 * Build an AgentContext for Meridian operations.
 */
export function createMeridianContext(
  tenantId: string,
  userId: string,
  overrides?: Partial<AgentConfig>,
): AgentContext {
  return {
    tenantId,
    userId,
    config: { ...MERIDIAN_CONFIG, ...overrides },
    correlationId: crypto.randomUUID(),
    auditLog,
  };
}

export { MERIDIAN_CONFIG, AGENT_AUDIT_ACTIONS, AGENT_RESOURCE_TYPES };
