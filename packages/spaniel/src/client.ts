/**
 * Spaniel LLM Gateway — OpenRouter Client Factory
 *
 * Creates OpenAI-compatible clients pointed at OpenRouter.
 * All apps use this instead of instantiating their own clients.
 */

import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required. " +
        "Set it in .env or via Doppler."
    );
  }
  return key;
}

export function hasAICapability(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export function createSpanielClient(appCode: string): OpenAI {
  const referer = `https://${appCode.toLowerCase().replace("cvg-", "")}.cavaridge.com`;

  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: getApiKey(),
    defaultHeaders: {
      "HTTP-Referer": referer,
      "X-Title": appCode,
    },
  });
}
