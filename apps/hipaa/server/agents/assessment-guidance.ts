/**
 * Assessment Guidance Agent
 *
 * Wraps HipaaComplianceAgent for the assessment wizard.
 * Provides control-specific regulatory guidance during evaluation.
 */

import { HipaaComplianceAgent } from "@cavaridge/domain-agents";
import { createHipaaContext } from "./context";

const hipaaAgent = new HipaaComplianceAgent();

export async function runAssessmentGuidance(
  tenantId: string,
  userId: string,
  controlRef: string,
  controlName: string,
  currentState: string,
  findingDetail: string,
) {
  const context = createHipaaContext(tenantId, userId, {
    agentId: "assessment-guidance",
    agentName: "Assessment Guidance Agent",
  });

  const output = await hipaaAgent.runWithAudit({
    data: {
      query: `Provide assessment guidance for control ${controlRef} (${controlName}). What does full compliance look like? What are common gaps? What evidence should be collected?`,
      controlRef,
      context: "security_rule",
      currentState,
      findingDetail,
    },
    context,
  });

  return output.result;
}
