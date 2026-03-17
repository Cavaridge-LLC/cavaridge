/**
 * Spaniel LLM Gateway — Fallback Cascade Logic
 *
 * Wraps an LLM call with automatic fallback to secondary/tertiary models
 * on rate limits, timeouts (>30s), or server errors (5xx).
 */

import OpenAI from "openai";
import { createSpanielClient } from "./client.js";

const TIMEOUT_MS = 30_000;

export interface FallbackResult<T> {
  result: T;
  modelUsed: string;
  fallbackUsed: boolean;
  tier: "primary" | "secondary" | "tertiary";
}

interface FallbackOptions {
  appCode: string;
  models: {
    primary: string;
    secondary: string;
    tertiary: string | null;
  };
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    // Rate limited (429), server error (5xx)
    return err.status === 429 || (err.status !== undefined && err.status >= 500);
  }
  // Timeout or network errors
  if (err instanceof Error) {
    return (
      err.message.includes("timeout") ||
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ECONNRESET") ||
      err.name === "AbortError"
    );
  }
  return false;
}

export async function withFallback<T>(
  callFn: (client: OpenAI, model: string, signal?: AbortSignal) => Promise<T>,
  opts: FallbackOptions
): Promise<FallbackResult<T>> {
  const tiers = [
    { model: opts.models.primary, tier: "primary" as const },
    { model: opts.models.secondary, tier: "secondary" as const },
    ...(opts.models.tertiary
      ? [{ model: opts.models.tertiary, tier: "tertiary" as const }]
      : []),
  ];

  let lastError: unknown;

  for (const { model, tier } of tiers) {
    try {
      const client = createSpanielClient(opts.appCode);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const result = await callFn(client, model, controller.signal);
        clearTimeout(timeoutId);

        return {
          result,
          modelUsed: model,
          fallbackUsed: tier !== "primary",
          tier,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err)) {
        // Non-retryable error (e.g., 400 bad request) — don't cascade
        throw err;
      }

      // Retryable — continue to next tier
      continue;
    }
  }

  // All tiers exhausted
  throw new Error(
    `All model tiers exhausted. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
