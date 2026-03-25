/**
 * Integration tests for V1 Conversation API with mocked Spaniel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DUCKY_BRANDING } from "../server/ducky-state";

// Mock Spaniel
vi.mock("@cavaridge/spaniel", () => ({
  chatCompletion: vi.fn().mockResolvedValue({
    requestId: "req-test-123",
    status: "success",
    content: "Hello from Ducky!",
    modelsUsed: { primary: "claude-sonnet-4", secondary: null, tertiary: null },
    consensus: null,
    tokens: { input: 10, output: 15, total: 25 },
    cost: { amount: 0.0005, currency: "USD" },
    fallbackUsed: false,
    timestamp: new Date().toISOString(),
  }),
  chatCompletionStream: vi.fn(),
  hasAICapability: vi.fn().mockReturnValue(true),
  generateEmbedding: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  traceRequest: vi.fn(),
}));

// Mock security
vi.mock("@cavaridge/security", () => ({
  detectPromptInjection: vi.fn().mockReturnValue({ isInjection: false, score: 0, matchedPatterns: [] }),
  scanForPii: vi.fn().mockReturnValue({ hasPii: false, matches: [] }),
}));

describe("Ducky Branding", () => {
  it("has correct footer tagline", () => {
    expect(DUCKY_BRANDING.FOOTER_TAGLINE).toBe("Powered by Ducky Intelligence");
  });

  it("never uses 'Ducky AI'", () => {
    const values = Object.values(DUCKY_BRANDING);
    for (const val of values) {
      expect(val).not.toContain("Ducky AI");
    }
  });

  it("has correct brand name", () => {
    expect(DUCKY_BRANDING.BRAND_NAME).toBe("Ducky Intelligence");
  });

  it("has correct app code", () => {
    expect(DUCKY_BRANDING.APP_CODE).toBe("CVG-RESEARCH");
  });
});

describe("Ducky Animation States", () => {
  it("defines all 9 animation states in API_PHASE_TO_ANIMATION", async () => {
    const { API_PHASE_TO_ANIMATION } = await import("../server/ducky-state");

    const phases = Object.keys(API_PHASE_TO_ANIMATION);
    expect(phases).toContain("request_received");
    expect(phases).toContain("processing");
    expect(phases).toContain("calling_spaniel");
    expect(phases).toContain("streaming");
    expect(phases).toContain("rag_searching");
    expect(phases).toContain("generating_response");
    expect(phases).toContain("response_complete");
    expect(phases).toContain("response_error");
  });

  it("maps phases to valid animation states", async () => {
    const { API_PHASE_TO_ANIMATION } = await import("../server/ducky-state");

    const validStates = ["idle", "listening", "thinking", "searching", "found", "presenting", "error", "celebrating", "sleeping"];

    for (const state of Object.values(API_PHASE_TO_ANIMATION)) {
      expect(validStates).toContain(state);
    }
  });
});

describe("Prompt Template Interpolation", () => {
  it("works with app-query style variables", async () => {
    const { interpolateTemplate } = await import("../server/prompt-templates");

    const template =
      "You are the AI reasoning engine for {{app_code}}. " +
      "Perform a {{task_type}} task. Tenant: {{tenant_id}}.";

    const result = interpolateTemplate(template, {
      app_code: "CVG-HIPAA",
      task_type: "compliance_check",
      tenant_id: "tenant-dit-001",
    });

    expect(result).toContain("CVG-HIPAA");
    expect(result).toContain("compliance_check");
    expect(result).toContain("tenant-dit-001");
  });
});

describe("Spaniel Client", () => {
  it("creates client with default config", async () => {
    const { SpanielClient } = await import("../server/spaniel-client");

    const client = new SpanielClient({
      baseUrl: "http://localhost:4100",
      serviceToken: "test-token",
    });

    expect(client).toBeDefined();
  });

  it("hasSpanielClientCapability returns true in non-production", async () => {
    const { hasSpanielClientCapability } = await import("../server/spaniel-client");
    expect(hasSpanielClientCapability()).toBe(true);
  });
});
