export const LLM_ROUTES = {
  answerGeneration: "anthropic/claude-sonnet-4",
  questionClassification: "anthropic/claude-sonnet-4",
  knowledgeExtraction: "anthropic/claude-sonnet-4",
  summarization: "anthropic/claude-sonnet-4",
  embeddings: "openai/text-embedding-3-small",
} as const;

export type LLMTask = keyof typeof LLM_ROUTES;

export function getModel(taskType: LLMTask): string {
  return LLM_ROUTES[taskType];
}
