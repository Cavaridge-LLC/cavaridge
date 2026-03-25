/**
 * Pipeline Engine — Unit Tests
 *
 * Tests stage transitions, state management, and error handling
 * without requiring actual LLM calls or database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipelineEngine, STAGE_ORDER } from "../server/pipeline/engine";
import type { PipelineState, ForgeBrief } from "../shared/models/pipeline";
import type { StageHandler } from "../server/pipeline/engine";

// Mock the database module
vi.mock("../server/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

vi.mock("@shared/schema", () => ({
  forgeContent: { id: "id" },
  forgeStageRuns: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

const defaultBrief: ForgeBrief = {
  description: "Test blog post about TypeScript",
  outputFormat: "docx",
  contentType: "blog_post",
  audience: "developers",
  tone: "technical",
};

function createMockHandler(stageName: string): StageHandler {
  return async (state) => ({
    ...state,
    [`${stageName}_completed`]: true,
  } as PipelineState);
}

function createFailingHandler(errorMessage: string): StageHandler {
  return async () => {
    throw new Error(errorMessage);
  };
}

describe("PipelineEngine", () => {
  let engine: PipelineEngine;

  beforeEach(() => {
    engine = new PipelineEngine();
  });

  describe("stage registration", () => {
    it("should register stage handlers", () => {
      const handler = createMockHandler("test");
      engine.registerStage("research_outline", handler);
      // No error means success
      expect(true).toBe(true);
    });

    it("should allow registering all 5 stages", () => {
      for (const stage of STAGE_ORDER) {
        engine.registerStage(stage, createMockHandler(stage));
      }
      expect(STAGE_ORDER).toHaveLength(5);
    });
  });

  describe("STAGE_ORDER", () => {
    it("should have exactly 5 stages in correct order", () => {
      expect(STAGE_ORDER).toEqual([
        "research_outline",
        "draft_generation",
        "review_refinement",
        "formatting_polish",
        "export",
      ]);
    });
  });

  describe("pipeline execution", () => {
    it("should execute all stages in order", async () => {
      const executionOrder: string[] = [];

      for (const stage of STAGE_ORDER) {
        engine.registerStage(stage, async (state) => {
          executionOrder.push(stage);
          return { ...state };
        });
      }

      const result = await engine.run("test-id", defaultBrief, "tenant-1", "user-1");

      expect(executionOrder).toEqual(STAGE_ORDER);
      expect(result.currentStage).toBe("complete");
      expect(result.duckyState).toBe("celebrating");
    });

    it("should stop on first stage failure", async () => {
      const executionOrder: string[] = [];

      engine.registerStage("research_outline", async (state) => {
        executionOrder.push("research_outline");
        return { ...state };
      });

      engine.registerStage("draft_generation", createFailingHandler("Draft failed"));

      // Register remaining stages
      engine.registerStage("review_refinement", createMockHandler("review_refinement"));
      engine.registerStage("formatting_polish", createMockHandler("formatting_polish"));
      engine.registerStage("export", createMockHandler("export"));

      const result = await engine.run("test-id", defaultBrief, "tenant-1", "user-1");

      expect(result.currentStage).toBe("failed");
      expect(result.duckyState).toBe("apologetic");
      expect(result.error).toBe("Draft failed");
      expect(executionOrder).toEqual(["research_outline"]);
    });

    it("should throw when a stage has no handler", async () => {
      // Only register first stage
      engine.registerStage("research_outline", createMockHandler("research_outline"));

      const result = await engine.run("test-id", defaultBrief, "tenant-1", "user-1");

      expect(result.currentStage).toBe("failed");
      expect(result.error).toContain("No handler registered for stage: draft_generation");
    });

    it("should initialize pipeline state correctly", async () => {
      let capturedState: PipelineState | null = null;

      for (const stage of STAGE_ORDER) {
        engine.registerStage(stage, async (state) => {
          if (stage === "research_outline") {
            capturedState = { ...state };
          }
          return { ...state };
        });
      }

      await engine.run("test-content-id", defaultBrief, "tenant-1", "user-1");

      expect(capturedState).not.toBeNull();
      expect(capturedState!.contentId).toBe("test-content-id");
      expect(capturedState!.revisionCount).toBe(0);
      expect(capturedState!.stages).toHaveLength(5);
      expect(capturedState!.stages.every((s) => s.status === "pending" || s.status === "running")).toBe(true);
    });

    it("should call progress callback for each stage", async () => {
      const progressCalls: Array<{ stage: string; progress: number }> = [];

      for (const stage of STAGE_ORDER) {
        engine.registerStage(stage, createMockHandler(stage));
      }

      await engine.run("test-id", defaultBrief, "tenant-1", "user-1", undefined, (stage, _ducky, progress) => {
        progressCalls.push({ stage, progress });
      });

      // 5 stage progress calls + 1 completion call
      expect(progressCalls.length).toBeGreaterThanOrEqual(5);
      expect(progressCalls[0].stage).toBe("research_outline");
      expect(progressCalls[progressCalls.length - 1].stage).toBe("complete");
      expect(progressCalls[progressCalls.length - 1].progress).toBe(1.0);
    });

    it("should pass state between stages", async () => {
      engine.registerStage("research_outline", async (state) => ({
        ...state,
        projectSpec: {
          title: "Test",
          sections: [],
          audience: "devs",
          tone: "technical" as const,
          formatRequirements: [],
          constraints: [],
        },
      }));

      engine.registerStage("draft_generation", async (state) => {
        // Should see projectSpec from previous stage
        expect(state.projectSpec).toBeDefined();
        expect(state.projectSpec!.title).toBe("Test");
        return { ...state };
      });

      engine.registerStage("review_refinement", createMockHandler("review"));
      engine.registerStage("formatting_polish", createMockHandler("polish"));
      engine.registerStage("export", createMockHandler("export"));

      await engine.run("test-id", defaultBrief, "tenant-1", "user-1");
    });
  });
});
