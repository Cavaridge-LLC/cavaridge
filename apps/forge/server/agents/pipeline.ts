/**
 * Forge Pipeline Orchestrator (Legacy)
 *
 * This is the original agent-based orchestrator that was superseded by the
 * 5-stage pipeline engine in server/pipeline/. It is retained for backward
 * compatibility and wraps the new engine.
 *
 * New code should import from server/pipeline/ directly.
 */

import { runContentPipeline } from "../pipeline";
import type { ForgeBrief, PipelineState, DuckyState, PipelineStage } from "@shared/models/pipeline";

export type ProgressCallback = (
  stage: PipelineStage,
  duckyState: DuckyState,
  progress: number,
  message: string,
) => void;

/**
 * Run the full Forge pipeline.
 * @deprecated Use runContentPipeline from server/pipeline instead.
 */
export async function runForgePipeline(
  contentId: string,
  brief: ForgeBrief,
  tenantId: string,
  userId: string,
  onProgress?: ProgressCallback,
): Promise<PipelineState> {
  return runContentPipeline(contentId, brief, tenantId, userId, undefined, onProgress);
}
