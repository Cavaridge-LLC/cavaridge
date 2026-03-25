/**
 * Forge Pipeline — wires up the 5-stage engine with handlers
 */

import { PipelineEngine, STAGE_ORDER } from "./engine";
import { researchOutlineHandler } from "./stages/research-outline";
import { draftGenerationHandler } from "./stages/draft-generation";
import { reviewRefinementHandler } from "./stages/review-refinement";
import { formattingPolishHandler } from "./stages/formatting-polish";
import { exportHandler } from "./stages/export";
import type { ProgressCallback } from "./engine";
import type { ForgeBrief, BrandVoiceConfig, PipelineState } from "@shared/models/pipeline";

export { PipelineEngine, STAGE_ORDER } from "./engine";
export type { ProgressCallback, StageHandler } from "./engine";

let cachedEngine: PipelineEngine | null = null;

/** Returns a configured pipeline engine (singleton) */
export function getPipelineEngine(): PipelineEngine {
  if (!cachedEngine) {
    cachedEngine = new PipelineEngine();
    cachedEngine.registerStage("research_outline", researchOutlineHandler);
    cachedEngine.registerStage("draft_generation", draftGenerationHandler);
    cachedEngine.registerStage("review_refinement", reviewRefinementHandler);
    cachedEngine.registerStage("formatting_polish", formattingPolishHandler);
    cachedEngine.registerStage("export", exportHandler);
  }
  return cachedEngine;
}

/** Convenience: run the full pipeline */
export async function runContentPipeline(
  contentId: string,
  brief: ForgeBrief,
  tenantId: string,
  userId: string,
  brandVoice?: BrandVoiceConfig,
  onProgress?: ProgressCallback,
): Promise<PipelineState> {
  const engine = getPipelineEngine();
  return engine.run(contentId, brief, tenantId, userId, brandVoice, onProgress);
}
