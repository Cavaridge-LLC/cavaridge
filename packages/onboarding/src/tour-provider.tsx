import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TourConfig, TourStep } from "./types";
import { getOnboardingState, markTourComplete } from "./storage";

interface TourContextValue {
  /** Whether the tour is currently running */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** The current step definition, or null if inactive */
  currentStep: TourStep | null;
  /** Total number of steps */
  totalSteps: number;
  /** Start the tour from step 0 */
  startTour: () => void;
  /** Advance to the next step (or complete if on last) */
  nextStep: () => void;
  /** Go back one step */
  prevStep: () => void;
  /** Skip / close the tour early */
  skipTour: () => void;
  /** Mark tour as completed and deactivate */
  completeTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({
  config,
  children,
}: {
  config: TourConfig;
  children: ReactNode;
}) {
  const { appCode, steps, onComplete } = config;
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Auto-start the tour on first mount if not previously completed
  useEffect(() => {
    const state = getOnboardingState(appCode);
    if (!state.tourCompleted && steps.length > 0) {
      // Small delay to let the page render so target elements exist
      const timer = setTimeout(() => setIsActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, [appCode, steps.length]);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setCurrentStepIndex(0);
    markTourComplete(appCode);
    onComplete?.();
  }, [appCode, onComplete]);

  const nextStep = useCallback(() => {
    if (currentStepIndex >= steps.length - 1) {
      completeTour();
    } else {
      setCurrentStepIndex((i) => i + 1);
    }
  }, [currentStepIndex, steps.length, completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setCurrentStepIndex(0);
    markTourComplete(appCode);
  }, [appCode]);

  const currentStep = isActive ? steps[currentStepIndex] ?? null : null;

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      currentStepIndex,
      currentStep,
      totalSteps: steps.length,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      completeTour,
    }),
    [isActive, currentStepIndex, currentStep, steps.length, startTour, nextStep, prevStep, skipTour, completeTour],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
