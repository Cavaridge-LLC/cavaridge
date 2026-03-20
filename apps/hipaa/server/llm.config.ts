/**
 * HIPAA Risk Assessment — LLM Routing Configuration
 *
 * All AI calls route through @cavaridge/spaniel.
 * Task types map to specific model preferences + temperature.
 */

export const APP_CODE = "CVG-HIPAA";

export const TASK_TYPES = {
  ASSESSMENT_GUIDANCE: "analysis",
  GAP_ANALYSIS: "analysis",
  REMEDIATION_RECOMMENDATION: "generation",
  REPORT_GENERATION: "generation",
  CONTROL_ANALYSIS: "analysis",
} as const;

export const MODEL_ROSTER = {
  primary: "anthropic/claude-sonnet-4",
  secondary: "anthropic/claude-haiku-4.5",
  premium: "anthropic/claude-opus-4-20250514",
} as const;

export function getTaskConfig(taskType: keyof typeof TASK_TYPES) {
  const temperatureMap: Record<string, number> = {
    ASSESSMENT_GUIDANCE: 0.2,
    GAP_ANALYSIS: 0.3,
    REMEDIATION_RECOMMENDATION: 0.5,
    REPORT_GENERATION: 0.7,
    CONTROL_ANALYSIS: 0.2,
  };

  return {
    spanielTaskType: TASK_TYPES[taskType],
    temperature: temperatureMap[taskType] ?? 0.3,
    maxTokens: taskType === "REPORT_GENERATION" ? 8192 : 4096,
  };
}
