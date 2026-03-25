/**
 * Spaniel HTTP Client — Service client that calls Spaniel's REST API.
 *
 * Used by Ducky to communicate with the Spaniel LLM gateway via HTTP.
 * Supports: POST /api/v1/chat, POST /api/v1/embed, GET /api/v1/models
 *
 * Features:
 * - Service token authentication (Bearer)
 * - Streaming SSE support
 * - Retry with exponential backoff
 * - Request timeout handling
 */

import { logger } from "./logger.js";

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

export interface SpanielEmbedRequest {
  tenantId: string;
  userId?: string;
  appCode: string;
  input: string | string[];
}

export interface SpanielEmbedResponse {
  status: string;
  embeddings: number[][];
  dimensions: number;
  count: number;
}

export interface SpanielModelsResponse {
  routing_matrix: Record<string, { primary: string; secondary: string; tertiary: string | null }>;
  source: string;
  default_routing: Record<string, { primary: string; secondary: string; tertiary: string | null }>;
}

export interface StreamEvent {
  type: "token" | "done" | "error";
  content?: string;
  message?: string;
  // done metadata
  requestId?: string;
  modelUsed?: string;
  tokens?: { input: number; output: number; total: number };
  cost?: { amount: number; currency: string };
  fallbackUsed?: boolean;
}

export interface SpanielClientConfig {
  baseUrl: string;
  serviceToken: string;
  timeoutMs?: number;
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

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

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = this.maxRetries,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) return response;

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < retries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
          logger.warn(
            { status: response.status, attempt, delay: Math.round(delay) },
            "Spaniel request failed, retrying",
          );
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

        if (attempt < retries && (lastError.name === "AbortError" || lastError.message.includes("ECONNREFUSED"))) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
          logger.warn({ err: lastError, attempt, delay: Math.round(delay) }, "Spaniel connection error, retrying");
          await sleep(delay);
          continue;
        }
      }
    }

    throw lastError ?? new Error("Spaniel request failed after retries");
  }

  /**
   * POST /api/v1/chat — Chat completion (non-streaming)
   */
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

  /**
   * POST /api/v1/chat — Chat completion with SSE streaming.
   * Yields StreamEvent objects as they arrive.
   */
  async *chatStream(req: SpanielChatRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.baseUrl}/api/v1/chat`;
    const body = {
      request_id: req.requestId,
      tenant_id: req.tenantId,
      user_id: req.userId,
      app_code: req.appCode,
      task_hint: req.taskType,
      stream: true,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs * 3);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Spaniel stream HTTP ${response.status}: ${errBody}`);
      }

      if (!response.body) {
        throw new Error("No response body for SSE stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              yield JSON.parse(data) as StreamEvent;
            } catch {
              logger.warn({ data }, "Failed to parse SSE event");
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * POST /api/v1/embed — Generate embeddings
   */
  async embed(req: SpanielEmbedRequest): Promise<SpanielEmbedResponse> {
    const url = `${this.baseUrl}/api/v1/embed`;
    const body = {
      tenant_id: req.tenantId,
      user_id: req.userId,
      app_code: req.appCode,
      input: req.input,
    };

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    return response.json() as Promise<SpanielEmbedResponse>;
  }

  /**
   * GET /api/v1/models — Get current routing matrix
   */
  async getModels(): Promise<SpanielModelsResponse> {
    const url = `${this.baseUrl}/api/v1/models`;

    const response = await this.fetchWithRetry(url, {
      method: "GET",
      headers: this.headers(),
    });

    return response.json() as Promise<SpanielModelsResponse>;
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _client: SpanielClient | null = null;

export function getSpanielClient(): SpanielClient {
  if (!_client) {
    const baseUrl = process.env.SPANIEL_URL || "http://localhost:4100";
    const serviceToken = process.env.SPANIEL_SERVICE_TOKEN || "";

    _client = new SpanielClient({
      baseUrl,
      serviceToken,
      timeoutMs: parseInt(process.env.SPANIEL_TIMEOUT_MS || "30000", 10),
      maxRetries: parseInt(process.env.SPANIEL_MAX_RETRIES || "3", 10),
    });
  }
  return _client;
}

/**
 * Check if the Spaniel HTTP client can be configured.
 * Returns true if SPANIEL_URL is set (or defaults to localhost).
 */
export function hasSpanielClientCapability(): boolean {
  return !!(process.env.SPANIEL_URL || process.env.NODE_ENV !== "production");
}
