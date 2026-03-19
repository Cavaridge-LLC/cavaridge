import type { TaskType } from "@cavaridge/spaniel";

/** Maps Astra feature-level operations to Spaniel task types for model routing */
export const TASK_TYPE_MAP: Record<string, TaskType> = {
  summaryGeneration: "generation",
  licenseAnalysis: "analysis",
  dataExtraction: "extraction",
  conversation: "chat",
};
