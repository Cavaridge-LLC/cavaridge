import OpenAI from "openai";

export function createLLMClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
  return new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
}

export type TaskType = "analysis" | "generation" | "summarization" | "extraction" | "chat";

const MODEL_ROUTING: Record<TaskType, string> = {
  analysis: "anthropic/claude-sonnet-4-20250514",
  generation: "anthropic/claude-sonnet-4-20250514",
  summarization: "anthropic/claude-haiku-4-5-20251001",
  extraction: "anthropic/claude-haiku-4-5-20251001",
  chat: "anthropic/claude-sonnet-4-20250514",
};

export function getModelForTask(task: TaskType): string {
  return MODEL_ROUTING[task];
}
