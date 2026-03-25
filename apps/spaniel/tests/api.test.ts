/**
 * Integration tests for Spaniel API endpoints.
 *
 * Tests the Express routes with mocked OpenRouter responses.
 * Verifies request validation, auth, rate limiting, and response format.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer, type Server } from "http";

// ---- Mocks ----

// Mock the @cavaridge/auth/server module
vi.mock("@cavaridge/auth/server", () => ({
  extractBearerToken: (req: { headers: { authorization?: string } }) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }
    return null;
  },
}));

// Mock the @cavaridge/spaniel module
vi.mock("@cavaridge/spaniel", () => ({
  hasAICapability: () => true,
  hasDbCapability: () => false,
  hasRedisCapability: () => false,
  getDefaultRouting: () => ({
    chat: {
      primary: "anthropic/claude-sonnet-4",
      secondary: "openai/gpt-4o-mini",
      tertiary: "google/gemini-2.0-flash",
    },
  }),
  getRoutingForTask: async (taskType: string) => ({
    taskType,
    primary: "anthropic/claude-sonnet-4",
    secondary: "openai/gpt-4o-mini",
    tertiary: "google/gemini-2.0-flash",
  }),
  chatCompletion: async (opts: Record<string, unknown>) => ({
    requestId: (opts.requestId as string) || "test-request-id",
    status: "success",
    content: "This is a test response from the mocked LLM.",
    modelsUsed: {
      primary: "anthropic/claude-sonnet-4",
      secondary: null,
      tertiary: null,
    },
    consensus: null,
    tokens: { input: 100, output: 50, total: 150 },
    cost: { amount: 0.001, currency: "USD" },
    fallbackUsed: false,
    timestamp: new Date().toISOString(),
  }),
  chatCompletionStream: async (
    _opts: Record<string, unknown>,
    callbacks: { onToken: (t: string) => void; onDone: (m: Record<string, unknown>) => void }
  ) => {
    callbacks.onToken("Hello");
    callbacks.onToken(" world");
    callbacks.onDone({
      requestId: "stream-test-id",
      modelUsed: "anthropic/claude-sonnet-4",
      tokens: { input: 50, output: 20, total: 70 },
      cost: { amount: 0.0005, currency: "USD" },
      fallbackUsed: false,
    });
  },
  generateEmbedding: async () => [[0.1, 0.2, 0.3, 0.4, 0.5]],
  getRedis: () => {
    throw new Error("No Redis");
  },
}));

vi.mock("@cavaridge/spaniel/schema", () => ({
  routingMatrix: {},
  requestLog: {},
  modelCatalog: {},
}));

// Set env vars before importing server modules
process.env.SPANIEL_SERVICE_TOKENS = "test-token-1,test-token-2";

// Import server modules after mocks
const { serviceAuth } = await import("../server/middleware/auth.js");
const { registerRoutes } = await import("../server/routes/index.js");

// ---- Test Server Setup ----

let app: express.Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use("/api/v1", serviceAuth);
  registerRoutes(app);

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

// ---- Helpers ----

function authHeaders() {
  return { Authorization: "Bearer test-token-1", "Content-Type": "application/json" };
}

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const body = await res.json();
  return { status: res.status, body };
}

// ---- Tests ----

describe("GET /api/v1/health", () => {
  it("should return health status without auth", async () => {
    const { status, body } = await fetchJson("/api/v1/health");
    expect(status).toBe(200);
    expect(body.service).toBe("spaniel");
    expect(body.status).toBe("healthy");
    expect(body.capabilities).toBeDefined();
    expect(body.capabilities.openrouter).toBe(true);
  });
});

describe("Authentication", () => {
  it("should reject requests without auth token", async () => {
    const { status, body } = await fetchJson("/api/v1/models");
    expect(status).toBe(401);
    expect(body.error).toMatch(/Missing/i);
  });

  it("should reject requests with invalid token", async () => {
    const { status, body } = await fetchJson("/api/v1/models", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(status).toBe(403);
    expect(body.error).toMatch(/Invalid/i);
  });

  it("should accept requests with valid token", async () => {
    const { status } = await fetchJson("/api/v1/models", {
      headers: authHeaders(),
    });
    expect(status).toBe(200);
  });
});

describe("GET /api/v1/models", () => {
  it("should return routing matrix", async () => {
    const { status, body } = await fetchJson("/api/v1/models", {
      headers: authHeaders(),
    });
    expect(status).toBe(200);
    expect(body.routing_matrix).toBeDefined();
    expect(body.default_routing).toBeDefined();
  });
});

describe("POST /api/v1/chat", () => {
  it("should return LLM response for valid request", async () => {
    const { status, body } = await fetchJson("/api/v1/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        user_id: "user-456",
        app_code: "CVG-RESEARCH",
        context: {
          messages: [{ role: "user", content: "Hello" }],
        },
      }),
    });

    expect(status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.content).toBeTruthy();
    expect(body.tokens).toBeDefined();
    expect(body.cost).toBeDefined();
    expect(body.models_used).toBeDefined();
  });

  it("should reject request without tenant_id", async () => {
    const { status, body } = await fetchJson("/api/v1/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        user_id: "user-456",
        app_code: "CVG-RESEARCH",
        context: { messages: [{ role: "user", content: "Hello" }] },
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid/i);
  });

  it("should reject request without messages", async () => {
    const { status, body } = await fetchJson("/api/v1/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        user_id: "user-456",
        app_code: "CVG-RESEARCH",
        context: {},
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid/i);
  });

  it("should accept task_hint parameter", async () => {
    const { status, body } = await fetchJson("/api/v1/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        user_id: "user-456",
        app_code: "CVG-RESEARCH",
        task_hint: "analysis",
        context: {
          messages: [{ role: "user", content: "Analyze this data" }],
        },
      }),
    });

    expect(status).toBe(200);
    expect(body.status).toBe("success");
  });

  it("should accept options parameter", async () => {
    const { status, body } = await fetchJson("/api/v1/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        user_id: "user-456",
        app_code: "CVG-RESEARCH",
        context: {
          system: "You are a helpful assistant.",
          messages: [{ role: "user", content: "Hello" }],
        },
        options: {
          max_tokens: 2048,
          temperature: 0.5,
          require_consensus: false,
        },
      }),
    });

    expect(status).toBe(200);
    expect(body.status).toBe("success");
  });

  it("should handle streaming request", async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        user_id: "user-456",
        app_code: "CVG-RESEARCH",
        stream: true,
        context: {
          messages: [{ role: "user", content: "Hello" }],
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).toContain('"type":"token"');
    expect(text).toContain('"type":"done"');
  });
});

describe("POST /api/v1/reason (legacy)", () => {
  it("should return LLM response (backward compatibility)", async () => {
    const { status, body } = await fetchJson("/api/v1/reason", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        user_id: "user-456",
        app_code: "CVG-RESEARCH",
        context: {
          messages: [{ role: "user", content: "Hello" }],
        },
      }),
    });

    expect(status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.content).toBeTruthy();
  });
});

describe("POST /api/v1/embed", () => {
  it("should return embeddings for valid request", async () => {
    const { status, body } = await fetchJson("/api/v1/embed", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        app_code: "CVG-RESEARCH",
        input: "Hello world",
      }),
    });

    expect(status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.embeddings).toBeDefined();
    expect(Array.isArray(body.embeddings)).toBe(true);
    expect(body.dimensions).toBeGreaterThan(0);
  });

  it("should accept array input for batch embeddings", async () => {
    const { status, body } = await fetchJson("/api/v1/embed", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        app_code: "CVG-RESEARCH",
        input: ["Hello", "World"],
      }),
    });

    expect(status).toBe(200);
    expect(body.status).toBe("success");
  });

  it("should reject request without app_code", async () => {
    const { status, body } = await fetchJson("/api/v1/embed", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-123",
        input: "Hello",
      }),
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid/i);
  });
});

describe("GET /healthz", () => {
  it("should return liveness probe", async () => {
    const { status, body } = await fetchJson("/healthz");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
