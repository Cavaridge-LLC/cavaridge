// @cavaridge/onboarding — Shared onboarding primitives for all apps
//
// Tour: step-by-step guided walkthrough highlighting key UI areas
// Checklist: persistent floating card tracking first-time tasks

// Types
export type {
  TourStep,
  TourConfig,
  TourPlacement,
  ChecklistItem,
  ChecklistConfig,
  OnboardingState,
} from "./types";

// Tour
export { TourProvider, useTour } from "./tour-provider";
export { TourOverlay } from "./tour-overlay";
export { TourStepPopover } from "./tour-step";

// Checklist
export { ChecklistProvider, useChecklist } from "./checklist-provider";
export { Checklist } from "./checklist";

// Storage utilities
export {
  getOnboardingState,
  setOnboardingState,
  markTourComplete,
  markChecklistItem,
  dismissChecklist,
  resetOnboarding,
  isOnboardingComplete,
} from "./storage";
