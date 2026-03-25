/**
 * Forge LLM Configuration — task-type model routing via Spaniel.
 *
 * All LLM calls route through @cavaridge/spaniel. This file defines
 * model routing hints and the local MODEL_ROSTER for request classification.
 */

export const APP_CODE = "CVG-FORGE";

/** Forge pipeline stages mapped to Spaniel task routing */
export const TASK_TYPE_MAP = {
  research_outline: "research",
  draft_generation: "generation",
  review_refinement: "analysis",
  formatting_polish: "generation",
  export: "generation",
  estimate: "analysis",
} as const;

export type ForgeTaskType = keyof typeof TASK_TYPE_MAP;

/** Model roster — used for local classification; Spaniel handles actual routing */
export const MODEL_ROSTER = [
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    strengths: ["structured-output", "content-generation", "research", "quality-validation"],
    maxTokens: 8192,
    tasks: ["research_outline", "draft_generation", "review_refinement", "formatting_polish"] as ForgeTaskType[],
  },
  {
    id: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    strengths: ["cost-estimation", "classification", "lightweight-tasks"],
    maxTokens: 4096,
    tasks: ["estimate"] as ForgeTaskType[],
  },
  {
    id: "anthropic/claude-opus-4",
    label: "Claude Opus 4",
    strengths: ["long-form-generation", "complex-reasoning", "premium-content"],
    maxTokens: 16384,
    tasks: ["draft_generation"] as ForgeTaskType[], // gated by project tier
  },
] as const;

/** Pick the best model for a given Forge task type */
export function pickModelForTask(taskType: ForgeTaskType, premium = false): typeof MODEL_ROSTER[number] {
  if (taskType === "draft_generation" && premium) {
    return MODEL_ROSTER[2]; // Opus for premium
  }
  const match = MODEL_ROSTER.find((m) => m.tasks.includes(taskType));
  return match ?? MODEL_ROSTER[0]; // Default to Sonnet
}

/** QC threshold — content scoring below this triggers auto-revision */
export const QC_THRESHOLD = 0.75;

/** Max auto-revision attempts before surfacing to user */
export const MAX_AUTO_REVISIONS = 2;

/** Max free revisions per content piece */
export const MAX_FREE_REVISIONS = 3;
