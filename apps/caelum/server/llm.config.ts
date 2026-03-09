export const LLM_ROUTES = {
  reportGeneration: "anthropic/claude-opus-4.6",
  sowGeneration: "anthropic/claude-opus-4.6",
  grammarCheck: "anthropic/claude-opus-4.6",
  lightweightUI: "openai/gpt-5.1",
  synthesisExpert: "anthropic/claude-opus-4.6",
  titleGeneration: "openai/gpt-5.1",
};

export const MODEL_ROSTER = [
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", strengths: ["structured-output", "sow-generation", "risk-analysis", "contract-language"], maxTokens: 8192 },
  { id: "openai/gpt-5.1", label: "GPT 5.1", strengths: ["general", "summarization", "quick-answers", "brainstorming"], maxTokens: 4096 },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", strengths: ["analysis", "large-context", "document-review", "detail-extraction"], maxTokens: 8192 },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek v3.2", strengths: ["reasoning", "planning", "cost-estimation", "technical-analysis"], maxTokens: 8192 },
  { id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", strengths: ["general", "creative", "brainstorming", "alternative-perspectives"], maxTokens: 4096 },
] as const;

export type ModelId = typeof MODEL_ROSTER[number]["id"];
