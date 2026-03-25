/**
 * Ducky Animation State — Server-side utility for mapping API call lifecycle
 * to Ducky mascot animation states.
 *
 * The 9 Lottie animation states:
 *   idle, listening, thinking, searching, found, presenting, error, celebrating, sleeping
 *
 * This module provides a server-side state mapping that other apps import
 * to sync Ducky mascot state to API call lifecycle events.
 */

import type { DuckyAnimationState, AgentStatus } from "@cavaridge/ducky-animations";
import { AGENT_STATUS_TO_ANIMATION } from "@cavaridge/ducky-animations";

// Re-export types for consumers
export type { DuckyAnimationState, AgentStatus };
export { AGENT_STATUS_TO_ANIMATION };

/**
 * API call lifecycle phases mapped to animation states.
 */
export type ApiLifecyclePhase =
  | "request_received"
  | "processing"
  | "calling_spaniel"
  | "streaming"
  | "rag_searching"
  | "generating_response"
  | "response_complete"
  | "response_error";

/**
 * Maps API lifecycle phases to Ducky animation states.
 */
export const API_PHASE_TO_ANIMATION: Record<ApiLifecyclePhase, DuckyAnimationState> = {
  request_received: "listening",
  processing: "thinking",
  calling_spaniel: "thinking",
  streaming: "presenting",
  rag_searching: "searching",
  generating_response: "thinking",
  response_complete: "found",
  response_error: "error",
};

/**
 * Get the animation state for a given API lifecycle phase.
 */
export function getAnimationForPhase(phase: ApiLifecyclePhase): DuckyAnimationState {
  return API_PHASE_TO_ANIMATION[phase];
}

/**
 * Get the animation state for an agent status.
 */
export function getAnimationForAgentStatus(status: AgentStatus): DuckyAnimationState {
  return AGENT_STATUS_TO_ANIMATION[status];
}

/**
 * Branding constants — enforced across all Ducky responses.
 */
export const DUCKY_BRANDING = {
  /** Footer tagline for all responses and UI */
  FOOTER_TAGLINE: "Powered by Ducky Intelligence",
  /** Product brand name — NEVER use "Ducky AI" */
  BRAND_NAME: "Ducky Intelligence",
  /** Full brand with parent */
  BRAND_FULL: "Ducky Intelligence by Cavaridge",
  /** Character name (standalone) */
  CHARACTER_NAME: "Ducky",
  /** App code */
  APP_CODE: "CVG-RESEARCH",
  /** Domain */
  DOMAIN: "ducky.cavaridge.com",
} as const;
