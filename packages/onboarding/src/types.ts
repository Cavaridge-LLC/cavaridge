/** Placement options for a tour step popover */
export type TourPlacement = "top" | "bottom" | "left" | "right";

/** A single step in the onboarding tour */
export interface TourStep {
  /** Unique identifier for this step */
  id: string;
  /** CSS selector targeting the element to highlight (prefer data-onboarding="...") */
  targetSelector: string;
  /** Step title shown in the popover */
  title: string;
  /** Step description / body text */
  description: string;
  /** Which side of the target the popover appears on */
  placement?: TourPlacement;
}

/** Configuration passed to TourProvider */
export interface TourConfig {
  /** Short app identifier (e.g., "ducky", "meridian") used as localStorage namespace */
  appCode: string;
  /** Ordered list of tour steps */
  steps: TourStep[];
  /** Callback fired when the tour completes */
  onComplete?: () => void;
}

/** A single item in the onboarding checklist */
export interface ChecklistItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional longer description */
  description?: string;
  /** Optional route to navigate to when clicked */
  route?: string;
}

/** Configuration passed to ChecklistProvider */
export interface ChecklistConfig {
  /** Short app identifier (same as TourConfig.appCode) */
  appCode: string;
  /** Display name of the app shown in the checklist header */
  appDisplayName: string;
  /** Ordered list of checklist items */
  items: ChecklistItem[];
}

/** Persisted onboarding state (localStorage) */
export interface OnboardingState {
  /** Whether the guided tour has been completed */
  tourCompleted: boolean;
  /** Map of checklist item ID → completed boolean */
  checklistItems: Record<string, boolean>;
  /** Whether the checklist has been permanently dismissed */
  checklistDismissed: boolean;
}
