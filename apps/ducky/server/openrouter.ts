import OpenAI from "openai";
import type { LLMTask } from "./llm-config";
import { getModel } from "./llm-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const APP_REFERER = "https://ducky.cavaridge.com";
const APP_TITLE = "CVG-DUCKY";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY environment variable is required for AI features");
  }
  return key;
}

export function hasAICapability(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export function getOpenRouterClient(): OpenAI {
  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: getApiKey(),
    defaultHeaders: {
      "HTTP-Referer": APP_REFERER,
      "X-Title": APP_TITLE,
    },
  });
}

export function getEmbeddingClient(): OpenAI {
  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: getApiKey(),
    defaultHeaders: {
      "HTTP-Referer": APP_REFERER,
      "X-Title": APP_TITLE,
    },
  });
}

export interface ChatOptions {
  task: LLMTask;
  system?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string | any[] }>;
  maxTokens?: number;
  tenantId?: string;
  temperature?: number;
}

export async function chatCompletion(opts: ChatOptions): Promise<string> {
  const client = getOpenRouterClient();
  const model = getModel(opts.task);

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (opts.system) {
    allMessages.push({ role: "system", content: opts.system });
  }

  for (const msg of opts.messages) {
    allMessages.push({ role: msg.role, content: msg.content } as OpenAI.Chat.ChatCompletionMessageParam);
  }

  const metadata: Record<string, string> = { app_code: "CVG-DUCKY" };
  if (opts.tenantId) {
    metadata.tenant_id = opts.tenantId;
  }

  const body: any = {
    model,
    messages: allMessages,
    max_tokens: opts.maxTokens || 2048,
    metadata,
  };

  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }

  const response = await client.chat.completions.create(body);
  return response.choices[0]?.message?.content || "";
}

export async function generateEmbedding(input: string | string[]): Promise<number[][]> {
  const client = getEmbeddingClient();
  const model = getModel("embeddings");

  const response = await client.embeddings.create({
    model,
    input,
  });

  return response.data.map(d => d.embedding);
}
