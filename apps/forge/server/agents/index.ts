/**
 * Forge Agents — re-exports
 *
 * The agent pipeline has been replaced by the 5-stage pipeline engine.
 * This file provides backward-compatible re-exports.
 *
 * New code should import from server/pipeline/ directly.
 */

export { runContentPipeline as runForgePipeline } from "../pipeline";
export type { ProgressCallback } from "../pipeline";
