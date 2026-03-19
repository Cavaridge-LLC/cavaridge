/**
 * HIPAA Agent Context Factory
 *
 * Creates AgentContext instances scoped to the HIPAA app.
 */

import type { AgentContext, AgentConfig } from "@cavaridge/agent-core";

const HIPAA_CONFIG: AgentConfig = {
  agentId: "hipaa",
  agentName: "HIPAA Risk Assessment",
  appCode: "CVG-HIPAA",
  version: "1.0.0",
};

export function createHipaaContext(
  tenantId: string,
  userId: string,
  overrides?: Partial<AgentConfig>,
): AgentContext {
  return {
    tenantId,
    userId,
    config: { ...HIPAA_CONFIG, ...overrides },
    correlationId: crypto.randomUUID(),
  };
}
