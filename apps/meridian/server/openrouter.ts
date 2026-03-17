/**
 * Meridian LLM Gateway — Spaniel Shim
 *
 * Delegates all LLM calls to @cavaridge/spaniel while preserving
 * the same function signatures that Meridian's processors use.
 * This shim will be removed once all processors are migrated to
 * use the agent layer directly.
 */

import {
  chatCompletion as spanielChat,
  generateEmbedding as spanielEmbedding,
  createSpanielClient,
  hasAICapability as spanielHasAI,
} from "@cavaridge/spaniel";
import type { TaskType, ChatMessage, SpanielRequestOptions } from "@cavaridge/spaniel";
import type { LLMTask } from "./llm-config";

// ── Task type mapping ────────────────────────────────────────────────

const TASK_MAP: Record<LLMTask, TaskType> = {
  reportGeneration: "generation",
  riskClassification: "analysis",
  documentClassification: "extraction",
  documentAnalysis: "analysis",
  qaEngine: "analysis",
  infraExtraction: "extraction",
  codeGeneration: "code_generation",
  embeddings: "embeddings",
  vision: "vision",
  visionFallback: "vision",
  findingExtraction: "extraction",
};

// ── Public API (same signatures as before) ───────────────────────────

export function hasAICapability(): boolean {
  return spanielHasAI();
}

export function getOpenRouterClient() {
  return createSpanielClient("CVG-MER");
}

export function getEmbeddingClient() {
  return createSpanielClient("CVG-MER");
}

export interface ChatOptions {
  task: LLMTask;
  system?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Array<{ role: "user" | "assistant" | "system"; content: string | any[] }>;
  maxTokens?: number;
  tenantId?: string;
  temperature?: number;
}

export async function chatCompletion(opts: ChatOptions): Promise<string> {
  const taskType = TASK_MAP[opts.task] || "analysis";

  const messages: ChatMessage[] = opts.messages.map((msg) => ({
    role: msg.role,
    content: msg.content as string | Array<Record<string, unknown>>,
  }));

  const options: SpanielRequestOptions = {
    maxTokens: opts.maxTokens || 2048,
    fallbackEnabled: true,
  };
  if (opts.temperature !== undefined) {
    options.temperature = opts.temperature;
  }

  const response = await spanielChat({
    tenantId: opts.tenantId || "system",
    userId: "system",
    appCode: "CVG-MER",
    taskType,
    system: opts.system,
    messages,
    options,
  });

  return response.content;
}

export async function generateEmbedding(input: string | string[]): Promise<number[][]> {
  return spanielEmbedding(input, {
    tenantId: "system",
    userId: "system",
    appCode: "CVG-MER",
  });
}
