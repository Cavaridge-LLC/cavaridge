/**
 * Forge Pipeline Engine — State Machine
 *
 * 5-stage content pipeline:
 *   Stage 1: Research & Outline
 *   Stage 2: Draft Generation
 *   Stage 3: Review & Refinement
 *   Stage 4: Formatting & Polish
 *   Stage 5: Export
 *
 * Each stage has defined inputs/outputs. Pipeline tracks state
 * and persists progress to the database.
 */

import { db } from "../db";
import { forgeContent, forgeStageRuns } from "@shared/schema";
import { eq } from "drizzle-orm";
import type {
  PipelineStage,
  PipelineState,
  StageRecord,
  DuckyState,
  ForgeBrief,
  BrandVoiceConfig,
} from "@shared/models/pipeline";

export type StageHandler = (state: PipelineState, brief: ForgeBrief, tenantId: string, userId: string, brandVoice?: BrandVoiceConfig) => Promise<PipelineState>;

export type ProgressCallback = (
  stage: PipelineStage,
  duckyState: DuckyState,
  progress: number,
  message: string,
) => void;

/** Stage ordering */
export const STAGE_ORDER: PipelineStage[] = [
  "research_outline",
  "draft_generation",
  "review_refinement",
  "formatting_polish",
  "export",
];

/** Stage progress percentages */
const STAGE_PROGRESS: Record<PipelineStage, number> = {
  research_outline: 0.1,
  draft_generation: 0.35,
  review_refinement: 0.6,
  formatting_polish: 0.8,
  export: 0.95,
  complete: 1.0,
  failed: 0,
};

/** Stage-to-Ducky-state mapping */
const STAGE_DUCKY: Record<PipelineStage, DuckyState> = {
  research_outline: "thinking",
  draft_generation: "building",
  review_refinement: "reviewing",
  formatting_polish: "determined",
  export: "building",
  complete: "celebrating",
  failed: "apologetic",
};

/** Stage display messages */
const STAGE_MESSAGES: Record<PipelineStage, string> = {
  research_outline: "Researching your topic and building an outline...",
  draft_generation: "Writing your content...",
  review_refinement: "Reviewing and refining quality...",
  formatting_polish: "Polishing formatting and style...",
  export: "Exporting your document...",
  complete: "Your content is ready!",
  failed: "Something went wrong.",
};

export class PipelineEngine {
  private handlers: Map<PipelineStage, StageHandler> = new Map();

  registerStage(stage: PipelineStage, handler: StageHandler): void {
    this.handlers.set(stage, handler);
  }

  async run(
    contentId: string,
    brief: ForgeBrief,
    tenantId: string,
    userId: string,
    brandVoice?: BrandVoiceConfig,
    onProgress?: ProgressCallback,
  ): Promise<PipelineState> {
    const state: PipelineState = {
      contentId,
      currentStage: "research_outline",
      duckyState: "thinking",
      stages: STAGE_ORDER.map((stage) => ({
        stage,
        status: "pending" as const,
      })),
      revisionCount: 0,
    };

    // Update content status to running
    await db
      .update(forgeContent)
      .set({ status: "research_outline", updatedAt: new Date() })
      .where(eq(forgeContent.id, contentId));

    try {
      for (const stage of STAGE_ORDER) {
        const handler = this.handlers.get(stage);
        if (!handler) {
          throw new Error(`No handler registered for stage: ${stage}`);
        }

        // Update state
        state.currentStage = stage;
        state.duckyState = STAGE_DUCKY[stage];

        // Emit progress
        onProgress?.(
          stage,
          STAGE_DUCKY[stage],
          STAGE_PROGRESS[stage],
          STAGE_MESSAGES[stage],
        );

        // Update stage record
        const stageRecord = state.stages.find((s) => s.stage === stage);
        if (stageRecord) {
          stageRecord.status = "running";
          stageRecord.startedAt = new Date();
        }

        // Update content status in DB
        await db
          .update(forgeContent)
          .set({
            status: stage as typeof forgeContent.$inferSelect["status"],
            pipelineState: state as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(forgeContent.id, contentId));

        // Run the stage handler
        const startTime = Date.now();
        try {
          const updatedState = await handler(state, brief, tenantId, userId, brandVoice);
          Object.assign(state, updatedState);

          const durationMs = Date.now() - startTime;

          if (stageRecord) {
            stageRecord.status = "completed";
            stageRecord.completedAt = new Date();
            stageRecord.durationMs = durationMs;
          }

          // Log stage run to DB
          await logStageRun(contentId, stage, "completed", durationMs, stageRecord);
        } catch (stageError) {
          const durationMs = Date.now() - startTime;
          const errorMessage = stageError instanceof Error ? stageError.message : "Unknown error";

          if (stageRecord) {
            stageRecord.status = "failed";
            stageRecord.completedAt = new Date();
            stageRecord.durationMs = durationMs;
            stageRecord.error = errorMessage;
          }

          await logStageRun(contentId, stage, "failed", durationMs, stageRecord, errorMessage);

          throw stageError;
        }
      }

      // Pipeline complete
      state.currentStage = "complete";
      state.duckyState = "celebrating";

      await db
        .update(forgeContent)
        .set({
          status: "completed",
          pipelineState: state as unknown as Record<string, unknown>,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(forgeContent.id, contentId));

      onProgress?.("complete", "celebrating", 1.0, "Your content is ready!");

      return state;
    } catch (error) {
      state.currentStage = "failed";
      state.duckyState = "apologetic";
      state.error = error instanceof Error ? error.message : "Unknown error";

      await db
        .update(forgeContent)
        .set({
          status: "failed",
          pipelineState: state as unknown as Record<string, unknown>,
          metadata: { error: state.error },
          updatedAt: new Date(),
        })
        .where(eq(forgeContent.id, contentId));

      onProgress?.("failed", "apologetic", 0, `Something went wrong: ${state.error}`);

      return state;
    }
  }
}

async function logStageRun(
  contentId: string,
  stage: string,
  status: "completed" | "failed",
  durationMs: number,
  stageRecord?: StageRecord,
  error?: string,
): Promise<void> {
  await db.insert(forgeStageRuns).values({
    contentId,
    stage,
    agentName: `${stage}Handler`,
    status,
    durationMs,
    inputTokens: stageRecord?.inputTokens ?? 0,
    outputTokens: stageRecord?.outputTokens ?? 0,
    intermediateOutput: stageRecord?.intermediateOutput as Record<string, unknown> | undefined,
    error: error ? ({ message: error } as Record<string, unknown>) : undefined,
    startedAt: stageRecord?.startedAt ?? new Date(),
    completedAt: new Date(),
  });
}

/** Creates and configures the default pipeline engine */
export function createDefaultPipeline(): PipelineEngine {
  // Import handlers lazily to avoid circular deps
  const engine = new PipelineEngine();
  return engine;
}
