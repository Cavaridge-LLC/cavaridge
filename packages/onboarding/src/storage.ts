import type { OnboardingState } from "./types";

const STORAGE_PREFIX = "cavaridge_onboarding_";

function storageKey(appCode: string): string {
  return `${STORAGE_PREFIX}${appCode}`;
}

/** Default empty state */
function defaultState(): OnboardingState {
  return {
    tourCompleted: false,
    checklistItems: {},
    checklistDismissed: false,
  };
}

/** Read the onboarding state from localStorage */
export function getOnboardingState(appCode: string): OnboardingState {
  try {
    const raw = localStorage.getItem(storageKey(appCode));
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

/** Write the onboarding state to localStorage */
export function setOnboardingState(appCode: string, state: OnboardingState): void {
  try {
    localStorage.setItem(storageKey(appCode), JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (SSR, quota exceeded)
  }
}

/** Mark the guided tour as completed */
export function markTourComplete(appCode: string): void {
  const state = getOnboardingState(appCode);
  state.tourCompleted = true;
  setOnboardingState(appCode, state);
}

/** Mark a single checklist item as completed */
export function markChecklistItem(appCode: string, itemId: string): void {
  const state = getOnboardingState(appCode);
  state.checklistItems[itemId] = true;
  setOnboardingState(appCode, state);
}

/** Mark the checklist as dismissed */
export function dismissChecklist(appCode: string): void {
  const state = getOnboardingState(appCode);
  state.checklistDismissed = true;
  setOnboardingState(appCode, state);
}

/** Reset all onboarding state (tour + checklist) */
export function resetOnboarding(appCode: string): void {
  try {
    localStorage.removeItem(storageKey(appCode));
  } catch {
    // ignore
  }
}

/** Check if the full onboarding experience is complete */
export function isOnboardingComplete(appCode: string): boolean {
  const state = getOnboardingState(appCode);
  return state.tourCompleted && state.checklistDismissed;
}
