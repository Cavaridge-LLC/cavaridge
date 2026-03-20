/**
 * Spaniel LLM Gateway — Cost Calculation
 *
 * Calculates USD cost based on model, input tokens, and output tokens.
 * Loads pricing from model_catalog DB table, falls back to hardcoded defaults.
 */

import type { ModelPricing, CostInfo } from "./types.js";
import { hasDbCapability, getDb } from "./db.js";
import { modelCatalog } from "./schema.js";
import { eq } from "drizzle-orm";

/** Hardcoded fallback pricing (per 1M tokens) — updated 2026-03 */
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  "anthropic/claude-opus-4-6": { input: 15.0, output: 75.0 },
  "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
  "anthropic/claude-haiku-4.5": { input: 0.8, output: 4.0 },
  "openai/gpt-4o": { input: 2.5, output: 10.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "openai/text-embedding-3-small": { input: 0.02, output: 0 },
  "openai/text-embedding-3-large": { input: 0.13, output: 0 },
};

let pricingCache: Map<string, { input: number; output: number }> | null = null;
let pricingCacheTime = 0;
const PRICING_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function loadPricingFromDb(): Promise<Map<string, { input: number; output: number }>> {
  if (pricingCache && Date.now() - pricingCacheTime < PRICING_CACHE_TTL) {
    return pricingCache;
  }

  if (!hasDbCapability()) {
    return new Map(Object.entries(DEFAULT_PRICING));
  }

  try {
    const db = getDb();
    const rows = await db.select().from(modelCatalog).where(eq(modelCatalog.active, true));
    const map = new Map<string, { input: number; output: number }>();

    for (const row of rows) {
      map.set(row.modelId, {
        input: Number(row.costPerMInput) || 0,
        output: Number(row.costPerMOutput) || 0,
      });
    }

    // Merge defaults for any models not in DB
    for (const [model, pricing] of Object.entries(DEFAULT_PRICING)) {
      if (!map.has(model)) {
        map.set(model, pricing);
      }
    }

    pricingCache = map;
    pricingCacheTime = Date.now();
    return map;
  } catch {
    return new Map(Object.entries(DEFAULT_PRICING));
  }
}

export async function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<CostInfo> {
  const pricing = await loadPricingFromDb();
  const modelPricing = pricing.get(model) ?? { input: 5.0, output: 15.0 };

  const amount =
    (inputTokens / 1_000_000) * modelPricing.input +
    (outputTokens / 1_000_000) * modelPricing.output;

  return {
    amount: Math.round(amount * 1_000_000) / 1_000_000, // 6 decimal places
    currency: "USD",
  };
}
