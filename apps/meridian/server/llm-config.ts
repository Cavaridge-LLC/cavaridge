export const LLM_ROUTES = {
  reportGeneration: "anthropic/claude-sonnet-4",
  riskClassification: "anthropic/claude-sonnet-4",
  documentClassification: "anthropic/claude-sonnet-4",
  documentAnalysis: "anthropic/claude-sonnet-4",
  qaEngine: "anthropic/claude-sonnet-4",
  infraExtraction: "anthropic/claude-sonnet-4",
  codeGeneration: "anthropic/claude-sonnet-4",
  embeddings: "openai/text-embedding-3-small",
  vision: "anthropic/claude-sonnet-4",
  visionFallback: "openai/gpt-4o",
  findingExtraction: "anthropic/claude-sonnet-4",
} as const;

export type LLMTask = keyof typeof LLM_ROUTES;

export function getModel(taskType: LLMTask): string {
  return LLM_ROUTES[taskType];
}
