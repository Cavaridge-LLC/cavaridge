/**
 * Remediation Recommender
 *
 * Combines HIPAA domain knowledge with risk scoring to suggest
 * prioritized remediation steps for specific controls.
 */

import { HipaaComplianceAgent } from "@cavaridge/domain-agents";
import { createHipaaContext } from "./context";

const hipaaAgent = new HipaaComplianceAgent();

export async function runRemediationRecommender(
  tenantId: string,
  userId: string,
  controlRef: string,
  controlName: string,
  currentState: string,
  findingDetail: string,
  riskScore: number,
) {
  const context = createHipaaContext(tenantId, userId, {
    agentId: "remediation-recommender",
    agentName: "Remediation Recommender",
  });

  const output = await hipaaAgent.runWithAudit({
    data: {
      query: `Provide prioritized remediation recommendations for control ${controlRef} (${controlName}). Current state: ${currentState}. Risk score: ${riskScore}/25. Finding: ${findingDetail}. What specific steps should the organization take to achieve compliance? Include estimated effort levels.`,
      controlRef,
      context: "security_rule",
      currentState,
      findingDetail,
    },
    context,
  });

  return output.result;
}
