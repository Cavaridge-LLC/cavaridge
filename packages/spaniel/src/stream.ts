/**
 * Spaniel LLM Gateway — Streaming Chat Completion
 *
 * Streams LLM responses as SSE (Server-Sent Events).
 * Supports fallback cascade but not consensus (consensus requires full responses).
 */

import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import type { SpanielRequest } from "./types.js";
import { getRoutingForTask } from "./routing.js";
import { withFallback } from "./fallback.js";
import { calculateCost } from "./cost.js";
import { logRequest } from "./logger.js";
import { traceRequest } from "./langfuse.js";
import { createSpanielClient } from "./client.js";

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (metadata: {
    requestId: string;
    modelUsed: string;
    tokens: { input: number; output: number; total: number };
    cost: { amount: number; currency: string };
    fallbackUsed: boolean;
  }) => void;
  onError: (error: Error) => void;
}

export async function chatCompletionStream(
  opts: SpanielRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const requestId = opts.requestId ?? randomUUID();
  const routing = await getRoutingForTask(opts.taskType);
  const startTime = Date.now();
  const fallbackEnabled = opts.options?.fallbackEnabled ?? true;

  const buildMessages = (): OpenAI.Chat.ChatCompletionMessageParam[] => {
    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (opts.system) {
      allMessages.push({ role: "system", content: opts.system });
    }
    for (const msg of opts.messages) {
      allMessages.push({
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      } as OpenAI.Chat.ChatCompletionMessageParam);
    }
    return allMessages;
  };

  try {
    let modelUsed: string;
    let fallbackUsed: boolean;
    let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    if (fallbackEnabled) {
      const result = await withFallback(
        async (client, model) => {
          return client.chat.completions.create({
            model,
            messages: buildMessages(),
            max_tokens: opts.options?.maxTokens ?? 4096,
            temperature: opts.options?.temperature ?? 0.7,
            stream: true,
          });
        },
        {
          appCode: opts.appCode,
          models: {
            primary: routing.primary,
            secondary: routing.secondary,
            tertiary: routing.tertiary,
          },
        }
      );
      stream = result.result;
      modelUsed = result.modelUsed;
      fallbackUsed = result.fallbackUsed;
    } else {
      const client = createSpanielClient(opts.appCode);
      stream = await client.chat.completions.create({
        model: routing.primary,
        messages: buildMessages(),
        max_tokens: opts.options?.maxTokens ?? 4096,
        temperature: opts.options?.temperature ?? 0.7,
        stream: true,
      });
      modelUsed = routing.primary;
      fallbackUsed = false;
    }

    let fullContent = "";
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        callbacks.onToken(delta);
      }
      // Capture usage from final chunk if available
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    // Estimate tokens if not provided by API
    if (inputTokens === 0) {
      inputTokens = Math.ceil(JSON.stringify(buildMessages()).length / 4);
    }
    if (outputTokens === 0) {
      outputTokens = Math.ceil(fullContent.length / 4);
    }

    const cost = await calculateCost(modelUsed, inputTokens, outputTokens);
    const latencyMs = Date.now() - startTime;

    logRequest({
      requestId,
      tenantId: opts.tenantId,
      userId: opts.userId,
      appCode: opts.appCode,
      taskType: opts.taskType,
      primaryModel: routing.primary,
      secondaryModel: routing.secondary,
      tertiaryModel: routing.tertiary,
      modelUsed,
      fallbackUsed,
      consensusAligned: null,
      confidenceScore: null,
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      costUsd: cost.amount,
      status: fallbackUsed ? "degraded" : "success",
    });

    traceRequest({
      requestId,
      tenantId: opts.tenantId,
      userId: opts.userId,
      appCode: opts.appCode,
      taskType: opts.taskType,
      model: modelUsed,
      inputTokens,
      outputTokens,
      costUsd: cost.amount,
      latencyMs,
      status: fallbackUsed ? "degraded" : "success",
      fallbackUsed,
    });

    callbacks.onDone({
      requestId,
      modelUsed,
      tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
      cost: { amount: cost.amount, currency: cost.currency },
      fallbackUsed,
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
