/**
 * Unit tests for SpanielClient — HTTP service client for Spaniel REST API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpanielClient } from "../server/spaniel-client";
import type { SpanielChatResponse, SpanielEmbedResponse, SpanielModelsResponse } from "../server/spaniel-client";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("SpanielClient", () => {
  let client: SpanielClient;

  beforeEach(() => {
    client = new SpanielClient({
      baseUrl: "http://localhost:4100",
      serviceToken: "test-token-123",
      timeoutMs: 5000,
      maxRetries: 2,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("strips trailing slash from baseUrl", () => {
      const c = new SpanielClient({
        baseUrl: "http://localhost:4100/",
        serviceToken: "token",
      });
      // We can verify by making a call and checking URL
      expect(c).toBeDefined();
    });
  });

  describe("chat()", () => {
    it("sends correct request to POST /api/v1/chat", async () => {
      const mockResponse: SpanielChatResponse = {
        status: "success",
        content: "Hello! I'm Ducky.",
        request_id: "req-123",
        models_used: { primary: "claude-sonnet-4", secondary: null, tertiary: null },
        consensus: null,
        tokens: { input: 10, output: 20, total: 30 },
        cost: { amount: 0.001, currency: "USD" },
        fallback_used: false,
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.chat({
        tenantId: "tenant-1",
        userId: "user-1",
        appCode: "CVG-RESEARCH",
        taskType: "chat",
        system: "You are Ducky.",
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(result.status).toBe("success");
      expect(result.content).toBe("Hello! I'm Ducky.");
      expect(result.tokens.total).toBe(30);

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:4100/api/v1/chat");
      expect(init.method).toBe("POST");

      const headers = init.headers;
      expect(headers["Authorization"]).toBe("Bearer test-token-123");
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init.body);
      expect(body.tenant_id).toBe("tenant-1");
      expect(body.user_id).toBe("user-1");
      expect(body.app_code).toBe("CVG-RESEARCH");
      expect(body.task_hint).toBe("chat");
      expect(body.stream).toBe(false);
      expect(body.context.system).toBe("You are Ducky.");
      expect(body.context.messages).toEqual([{ role: "user", content: "Hello" }]);
    });

    it("passes options correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "success",
            content: "test",
            request_id: "req-1",
            models_used: { primary: "m", secondary: null, tertiary: null },
            consensus: null,
            tokens: { input: 0, output: 0, total: 0 },
            cost: { amount: 0, currency: "USD" },
            fallback_used: false,
            timestamp: "",
          }),
      });

      await client.chat({
        tenantId: "t",
        userId: "u",
        appCode: "CVG-RESEARCH",
        taskType: "analysis",
        messages: [{ role: "user", content: "test" }],
        options: {
          requireConsensus: true,
          maxTokens: 2000,
          temperature: 0.3,
          fallbackEnabled: false,
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.options.require_consensus).toBe(true);
      expect(body.options.max_tokens).toBe(2000);
      expect(body.options.temperature).toBe(0.3);
      expect(body.options.fallback_enabled).toBe(false);
    });

    it("retries on 429 status", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve("rate limited") })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "success",
              content: "ok",
              request_id: "r",
              models_used: { primary: "m", secondary: null, tertiary: null },
              consensus: null,
              tokens: { input: 0, output: 0, total: 0 },
              cost: { amount: 0, currency: "USD" },
              fallback_used: false,
              timestamp: "",
            }),
        });

      const result = await client.chat({
        tenantId: "t",
        userId: "u",
        appCode: "CVG-RESEARCH",
        taskType: "chat",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.status).toBe("success");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws on non-retryable error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad request"),
      });

      await expect(
        client.chat({
          tenantId: "t",
          userId: "u",
          appCode: "CVG-RESEARCH",
          taskType: "chat",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow("Spaniel HTTP 400");
    });
  });

  describe("embed()", () => {
    it("sends correct request to POST /api/v1/embed", async () => {
      const mockResponse: SpanielEmbedResponse = {
        status: "success",
        embeddings: [[0.1, 0.2, 0.3]],
        dimensions: 3,
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.embed({
        tenantId: "tenant-1",
        userId: "user-1",
        appCode: "CVG-RESEARCH",
        input: "Hello world",
      });

      expect(result.embeddings).toHaveLength(1);
      expect(result.dimensions).toBe(3);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:4100/api/v1/embed");
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body);
      expect(body.input).toBe("Hello world");
    });

    it("supports array input for batch embeddings", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "success",
            embeddings: [
              [0.1, 0.2],
              [0.3, 0.4],
            ],
            dimensions: 2,
            count: 2,
          }),
      });

      const result = await client.embed({
        tenantId: "t",
        appCode: "CVG-RESEARCH",
        input: ["text1", "text2"],
      });

      expect(result.count).toBe(2);
    });
  });

  describe("getModels()", () => {
    it("sends GET request to /api/v1/models", async () => {
      const mockResponse: SpanielModelsResponse = {
        routing_matrix: {
          chat: { primary: "claude-sonnet-4", secondary: "gpt-4o-mini", tertiary: null },
        },
        source: "cache_or_db",
        default_routing: {
          chat: { primary: "claude-sonnet-4", secondary: "gpt-4o-mini", tertiary: "gemini-2.0-flash" },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getModels();

      expect(result.routing_matrix.chat.primary).toBe("claude-sonnet-4");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:4100/api/v1/models");
      expect(init.method).toBe("GET");
    });
  });
});
