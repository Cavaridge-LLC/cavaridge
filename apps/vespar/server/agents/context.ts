/**
 * Vespar Agent Context Factory
 *
 * Creates AgentContext instances pre-configured for Vespar (CVG-VESPAR).
 * Follows Meridian's pattern — Layer 3 product agent context.
 */

import type { AgentContext, AgentConfig } from "@cavaridge/agent-core";
import { createAuditLogger } from "@cavaridge/audit";
import { db } from "../db";

const VESPAR_CONFIG: AgentConfig = {
  agentId: "vespar-migration-planner",
  agentName: "Vespar Migration Planner",
  appCode: "CVG-VESPAR",
  version: "1.0.0",
};

/**
 * Build an AgentContext for Vespar Migration Planner operations.
 */
export function createVesparContext(
  tenantId: string,
  userId: string,
  overrides?: Partial<AgentConfig>,
): AgentContext {
  return {
    tenantId,
    userId,
    config: { ...VESPAR_CONFIG, ...overrides },
    correlationId: crypto.randomUUID(),
    auditLog: createAuditLogger(db as never, { appCode: "CVG-VESPAR" }),
  };
}

export { VESPAR_CONFIG };
