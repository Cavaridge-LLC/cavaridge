/**
 * Unit tests for Spaniel routing configuration.
 *
 * Tests the default routing matrix, task-type resolution,
 * and cache behavior without requiring DB or Redis.
 */

import { describe, it, expect, vi } from "vitest";

// Mock the DB module so routing uses defaults
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({}),
}));

vi.mock("postgres", () => ({
  default: () => ({}),
}));

// Set no DB URL so hasDbCapability returns false
delete process.env.SPANIEL_DATABASE_URL;
delete process.env.DATABASE_URL;

// Import directly from the workspace package
const { getRoutingForTask, getDefaultRouting } = await import("@cavaridge/spaniel");

describe("Routing Configuration", () => {
  describe("getDefaultRouting", () => {
    it("should return routing for all 10 task types", () => {
      const defaults = getDefaultRouting();
      const taskTypes = [
        "analysis",
        "generation",
        "summarization",
        "extraction",
        "chat",
        "code_generation",
        "research",
        "conversation",
        "embeddings",
        "vision",
      ];

      for (const taskType of taskTypes) {
        expect(defaults).toHaveProperty(taskType);
        expect(defaults[taskType as keyof typeof defaults]).toHaveProperty("primary");
        expect(defaults[taskType as keyof typeof defaults]).toHaveProperty("secondary");
        expect(defaults[taskType as keyof typeof defaults]).toHaveProperty("tertiary");
      }
    });

    it("should use Anthropic models as primary for most task types", () => {
      const defaults = getDefaultRouting();
      const anthropicPrimary = [
        "analysis",
        "generation",
        "summarization",
        "chat",
        "code_generation",
        "research",
        "conversation",
        "vision",
      ];

      for (const taskType of anthropicPrimary) {
        expect(
          defaults[taskType as keyof typeof defaults].primary
        ).toMatch(/^anthropic\//);
      }
    });

    it("should use OpenAI models for embeddings", () => {
      const defaults = getDefaultRouting();
      expect(defaults.embeddings.primary).toBe("openai/text-embedding-3-small");
      expect(defaults.embeddings.secondary).toBe("openai/text-embedding-3-large");
      expect(defaults.embeddings.tertiary).toBeNull();
    });

    it("should use claude-opus for analysis and research tasks", () => {
      const defaults = getDefaultRouting();
      expect(defaults.analysis.primary).toBe("anthropic/claude-opus-4-6");
      expect(defaults.research.primary).toBe("anthropic/claude-opus-4-6");
    });

    it("should use faster models for extraction", () => {
      const defaults = getDefaultRouting();
      expect(defaults.extraction.primary).toBe("anthropic/claude-haiku-4.5");
    });
  });

  describe("getRoutingForTask", () => {
    it("should return routing entry with taskType field", async () => {
      const entry = await getRoutingForTask("chat");
      expect(entry.taskType).toBe("chat");
      expect(entry.primary).toBeDefined();
      expect(entry.secondary).toBeDefined();
    });

    it("should return chat routing for unknown task types", async () => {
      const entry = await getRoutingForTask("nonexistent_task" as any);
      const defaults = getDefaultRouting();
      expect(entry.primary).toBe(defaults.chat.primary);
      expect(entry.secondary).toBe(defaults.chat.secondary);
    });

    it("should return consistent results on repeated calls (caching)", async () => {
      const first = await getRoutingForTask("analysis");
      const second = await getRoutingForTask("analysis");
      expect(first).toEqual(second);
    });

    it("every routing entry should have at least primary and secondary models", async () => {
      const taskTypes = [
        "analysis",
        "generation",
        "summarization",
        "extraction",
        "chat",
        "code_generation",
        "research",
        "conversation",
        "embeddings",
        "vision",
      ] as const;

      for (const taskType of taskTypes) {
        const entry = await getRoutingForTask(taskType);
        expect(entry.primary).toBeTruthy();
        expect(entry.secondary).toBeTruthy();
      }
    });
  });

  describe("Routing model format", () => {
    it("all model IDs should follow provider/model format", () => {
      const defaults = getDefaultRouting();
      for (const [_taskType, routing] of Object.entries(defaults)) {
        expect(routing.primary).toMatch(/^[a-z]+\//);
        expect(routing.secondary).toMatch(/^[a-z]+\//);
        if (routing.tertiary) {
          expect(routing.tertiary).toMatch(/^[a-z]+\//);
        }
      }
    });

    it("should have three-tier fallback for non-embedding tasks", () => {
      const defaults = getDefaultRouting();
      const nonEmbedding = [
        "analysis",
        "generation",
        "summarization",
        "extraction",
        "chat",
        "code_generation",
        "research",
        "conversation",
        "vision",
      ];

      for (const taskType of nonEmbedding) {
        const routing = defaults[taskType as keyof typeof defaults];
        expect(routing.tertiary).not.toBeNull();
      }
    });
  });
});
