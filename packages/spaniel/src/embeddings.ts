/**
 * Spaniel LLM Gateway — Embedding Generation
 *
 * Generates vector embeddings for RAG/search.
 * Uses routing config for model selection, with fallback cascade.
 */

import { randomUUID } from "node:crypto";
import type { EmbeddingOptions } from "./types.js";
import { getRoutingForTask } from "./routing.js";
import { withFallback } from "./fallback.js";
import { calculateCost } from "./cost.js";
import { logRequest } from "./logger.js";

export async function generateEmbedding(
  input: string | string[],
  opts?: EmbeddingOptions
): Promise<number[][]> {
  const requestId = randomUUID();
  const routing = await getRoutingForTask("embeddings");
  const appCode = opts?.appCode ?? "CVG-PLATFORM";

  const result = await withFallback(
    async (client, model) => {
      return client.embeddings.create({ model, input });
    },
    {
      appCode,
      models: {
        primary: routing.primary,
        secondary: routing.secondary,
        tertiary: routing.tertiary,
      },
    }
  );

  const embeddings = result.result.data.map((d) => d.embedding);
  const inputTokens = result.result.usage?.prompt_tokens ?? 0;
  const cost = await calculateCost(result.modelUsed, inputTokens, 0);

  logRequest({
    requestId,
    tenantId: opts?.tenantId ?? "system",
    userId: opts?.userId ?? "system",
    appCode,
    taskType: "embeddings",
    primaryModel: routing.primary,
    secondaryModel: routing.secondary,
    tertiaryModel: routing.tertiary,
    modelUsed: result.modelUsed,
    fallbackUsed: result.fallbackUsed,
    consensusAligned: null,
    confidenceScore: null,
    tokensInput: inputTokens,
    tokensOutput: 0,
    costUsd: cost.amount,
    status: result.fallbackUsed ? "degraded" : "success",
  });

  return embeddings;
}
