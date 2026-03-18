/**
 * Caelum LLM Configuration
 *
 * All LLM calls route through @cavaridge/spaniel (the platform LLM gateway).
 * Non-streaming calls use chatCompletion() with Spaniel TaskType routing.
 * Streaming calls use createSpanielClient() which returns an OpenAI-compatible
 * client pointed at OpenRouter with proper app headers.
 *
 * The MODEL_ROSTER below is used only for the client-side ensemble/direct
 * model selector UI and the local request classification logic.
 * Spaniel handles actual model routing, fallback, and cost tracking.
 */

import type { TaskType } from "@cavaridge/spaniel";

/** Maps Caelum features to Spaniel task types for non-streaming calls */
export const TASK_TYPE_MAP: Record<string, TaskType> = {
  sowGeneration: "generation",
  grammarCheck: "analysis",
  titleGeneration: "summarization",
  synthesis: "generation",
  research: "research",
  conversation: "conversation",
} as const;

/** Model roster for client-side ensemble mode and direct model selection */
export const MODEL_ROSTER = [
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", strengths: ["structured-output", "sow-generation", "risk-analysis", "contract-language"], maxTokens: 8192 },
  { id: "openai/gpt-5.1", label: "GPT 5.1", strengths: ["general", "summarization", "quick-answers", "brainstorming"], maxTokens: 4096 },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", strengths: ["analysis", "large-context", "document-review", "detail-extraction"], maxTokens: 8192 },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek v3.2", strengths: ["reasoning", "planning", "cost-estimation", "technical-analysis"], maxTokens: 8192 },
  { id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", strengths: ["general", "creative", "brainstorming", "alternative-perspectives"], maxTokens: 4096 },
] as const;

export type ModelId = typeof MODEL_ROSTER[number]["id"];
