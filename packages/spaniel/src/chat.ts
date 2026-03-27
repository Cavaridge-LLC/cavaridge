/**
 * Spaniel LLM Gateway — Primary Chat Completion API
 *
 * This is the main entry point for all LLM calls in the Cavaridge platform.
 * Handles routing, consensus, fallback, cost tracking, and audit logging.
 */

import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import type { SpanielRequest, SpanielResponse } from "./types.js";
import { getRoutingForTask } from "./routing.js";
import { runConsensus } from "./consensus.js";
import { withFallback } from "./fallback.js";
import { calculateCost } from "./cost.js";
import { logRequest } from "./logger.js";
import { traceRequest } from "./langfuse.js";
import { createSpanielClient } from "./client.js";
import { getCached, setCached } from "./cache.js";

export async function chatCompletion(opts: SpanielRequest): Promise<SpanielResponse> {
  const requestId = opts.requestId ?? randomUUID();
  const routing = await getRoutingForTask(opts.taskType);
  const requireConsensus = opts.options?.requireConsensus ?? false;
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  // Check semantic cache (skip for streaming, consensus, ZDR)
  const cacheOpts = {
    tenantId: opts.tenantId,
    taskType: opts.taskType,
    model: routing.primary,
    prompt: opts.messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'),
    system: opts.system,
    skipCache: opts.options?.skipCache,
    isStreaming: opts.options?.stream,
    isConsensus: requireConsensus,
  };

  const cached = await getCached(cacheOpts);
  if (cached) {
    return {
      requestId,
      status: "success",
      content: cached.content,
      modelsUsed: { primary: cached.model, secondary: null, tertiary: null },
      consensus: null,
      tokens: { input: cached.tokensInput, output: cached.tokensOutput, total: cached.tokensInput + cached.tokensOutput },
      cost: { amount: 0, currency: "USD", model: cached.model, cached: true },
      fallbackUsed: false,
      timestamp,
    };
  }

  try {
    let response: SpanielResponse;
    if (requireConsensus) {
      response = await handleConsensus(requestId, opts, routing, timestamp);
    } else {
      response = await handleSingleModel(requestId, opts, routing, timestamp);
    }

    traceRequest({
      requestId,
      tenantId: opts.tenantId,
      userId: opts.userId,
      appCode: opts.appCode,
      taskType: opts.taskType,
      model: response.modelsUsed.primary,
      inputTokens: response.tokens.input,
      outputTokens: response.tokens.output,
      costUsd: response.cost.amount,
      latencyMs: Date.now() - startTime,
      status: response.status,
      fallbackUsed: response.fallbackUsed,
      consensusAligned: response.consensus?.aligned ?? null,
    });

    // Store in cache on success
    if (response.status === "success") {
      await setCached(cacheOpts, {
        content: response.content,
        model: response.modelsUsed.primary,
        tokensInput: response.tokens.input,
        tokensOutput: response.tokens.output,
        cachedAt: new Date().toISOString(),
      });
    }

    return response;
  } catch (err) {
    logRequest({
      requestId,
      tenantId: opts.tenantId,
      userId: opts.userId,
      appCode: opts.appCode,
      taskType: opts.taskType,
      primaryModel: routing.primary,
      secondaryModel: routing.secondary,
      tertiaryModel: routing.tertiary,
      modelUsed: routing.primary,
      fallbackUsed: false,
      consensusAligned: null,
      confidenceScore: null,
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      status: "error",
    });

    throw err;
  }
}

async function handleConsensus(
  requestId: string,
  opts: SpanielRequest,
  routing: { primary: string; secondary: string; tertiary: string | null },
  timestamp: string
): Promise<SpanielResponse> {
  const result = await runConsensus({
    appCode: opts.appCode,
    system: opts.system,
    messages: opts.messages,
    options: opts.options,
    primaryModel: routing.primary,
    secondaryModel: routing.secondary,
    tertiaryModel: routing.tertiary,
  });

  const cost = await calculateCost(
    result.modelUsed,
    result.totalInputTokens,
    result.totalOutputTokens
  );

  logRequest({
    requestId,
    tenantId: opts.tenantId,
    userId: opts.userId,
    appCode: opts.appCode,
    taskType: opts.taskType,
    primaryModel: routing.primary,
    secondaryModel: routing.secondary,
    tertiaryModel: routing.tertiary,
    modelUsed: result.modelUsed,
    fallbackUsed: false,
    consensusAligned: result.consensus.aligned,
    confidenceScore: result.consensus.confidenceScore,
    tokensInput: result.totalInputTokens,
    tokensOutput: result.totalOutputTokens,
    costUsd: cost.amount,
    status: result.consensus.aligned ? "success" : "degraded",
  });

  return {
    requestId,
    status: result.consensus.aligned ? "success" : "degraded",
    content: result.content,
    modelsUsed: {
      primary: routing.primary,
      secondary: routing.secondary,
      tertiary: result.allResults.tertiary ? routing.tertiary : null,
    },
    consensus: result.consensus,
    tokens: {
      input: result.totalInputTokens,
      output: result.totalOutputTokens,
      total: result.totalInputTokens + result.totalOutputTokens,
    },
    cost,
    fallbackUsed: false,
    timestamp,
  };
}

async function handleSingleModel(
  requestId: string,
  opts: SpanielRequest,
  routing: { primary: string; secondary: string; tertiary: string | null },
  timestamp: string
): Promise<SpanielResponse> {
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

  let modelUsed: string;
  let fallbackUsed: boolean;
  let response: OpenAI.Chat.Completions.ChatCompletion;

  if (fallbackEnabled) {
    const result = await withFallback(
      async (client, model, signal) => {
        return client.chat.completions.create({
          model,
          messages: buildMessages(),
          max_tokens: opts.options?.maxTokens ?? 4096,
          temperature: opts.options?.temperature ?? 0.7,
        }, { signal });
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
    response = result.result;
    modelUsed = result.modelUsed;
    fallbackUsed = result.fallbackUsed;
  } else {
    const client = createSpanielClient(opts.appCode);

    response = await client.chat.completions.create({
      model: routing.primary,
      messages: buildMessages(),
      max_tokens: opts.options?.maxTokens ?? 4096,
      temperature: opts.options?.temperature ?? 0.7,
    });

    modelUsed = routing.primary;
    fallbackUsed = false;
  }

  const content = response.choices[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const emptyResponse = content.length === 0;

  const cost = await calculateCost(modelUsed, inputTokens, outputTokens);

  const status: "success" | "degraded" | "error" =
    emptyResponse ? "degraded" : fallbackUsed ? "degraded" : "success";

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
    status,
  });

  return {
    requestId,
    status,
    content,
    modelsUsed: {
      primary: routing.primary,
      secondary: fallbackUsed ? routing.secondary : null,
      tertiary: null,
    },
    consensus: null,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    },
    cost,
    fallbackUsed,
    timestamp,
  };
}
