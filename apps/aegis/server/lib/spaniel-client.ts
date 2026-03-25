/**
 * CVG-AEGIS — Spaniel HTTP Client
 *
 * Service client that calls Spaniel's REST API for AI operations.
 * Based on the pattern from Ducky's spaniel-client.ts.
 * All AI calls route through Spaniel — direct OpenRouter imports are forbidden.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpanielChatRequest {
  requestId?: string;
  tenantId: string;
  userId: string;
  appCode: string;
  taskType: string;
  system?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  stream?: boolean;
  options?: {
    requireConsensus?: boolean;
    maxTokens?: number;
    temperature?: number;
    fallbackEnabled?: boolean;
  };
}

export interface SpanielChatResponse {
  status: "success" | "degraded" | "error";
  content: string;
  request_id: string;
  models_used: { primary: string; secondary: string | null; tertiary: string | null };
  consensus: { aligned: boolean; confidenceScore: number; divergenceNotes: string | null } | null;
  tokens: { input: number; output: number; total: number };
  cost: { amount: number; currency: string };
  fallback_used: boolean;
  timestamp: string;
}

export interface SpanielClientConfig {
  baseUrl: string;
  serviceToken: string;
  timeoutMs?: number;
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SpanielClient {
  private baseUrl: string;
  private serviceToken: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(config: SpanielClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.serviceToken = config.serviceToken;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.serviceToken}`,
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) return response;

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
          await sleep(delay);
          continue;
        }

        const body = await response.text();
        throw new Error(`Spaniel HTTP ${response.status}: ${body}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (lastError.name === "AbortError") {
          lastError = new Error(`Spaniel request timed out after ${this.timeoutMs}ms`);
        }

        if (attempt < this.maxRetries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
          await sleep(delay);
          continue;
        }
      }
    }

    throw lastError ?? new Error("Spaniel request failed after retries");
  }

  async chat(req: SpanielChatRequest): Promise<SpanielChatResponse> {
    const url = `${this.baseUrl}/api/v1/chat`;
    const body = {
      request_id: req.requestId,
      tenant_id: req.tenantId,
      user_id: req.userId,
      app_code: req.appCode,
      task_hint: req.taskType,
      stream: false,
      context: {
        system: req.system,
        messages: req.messages,
      },
      options: req.options
        ? {
            require_consensus: req.options.requireConsensus,
            max_tokens: req.options.maxTokens,
            temperature: req.options.temperature,
            fallback_enabled: req.options.fallbackEnabled,
          }
        : undefined,
    };

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    return response.json() as Promise<SpanielChatResponse>;
  }
}
