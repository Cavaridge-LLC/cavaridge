import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useTour } from "./tour-provider";
import type { TourPlacement } from "./types";

/**
 * Radix-based popover anchored to the current tour step's target element.
 * Shows step title, description, navigation buttons, and a "Skip tour" link.
 */
export function TourStepPopover() {
  const { isActive, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, skipTour } = useTour();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const virtualRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () => new DOMRect(),
  });

  useEffect(() => {
    if (!isActive || !currentStep) {
      setAnchorEl(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    setAnchorEl(el);

    if (el) {
      // Scroll element into view
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      virtualRef.current = {
        getBoundingClientRect: () => el.getBoundingClientRect(),
      };
    }
  }, [isActive, currentStep]);

  if (!isActive || !currentStep || !anchorEl) return null;

  const placement = currentStep.placement ?? "bottom";
  const radixSide = mapPlacementToSide(placement);
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <Popover.Root open>
      <Popover.Anchor virtualRef={virtualRef} />
      <Popover.Portal>
        <Popover.Content
          side={radixSide}
          sideOffset={16}
          align="center"
          className="z-[9999] w-80 rounded-xl border bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Step counter */}
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">
            {currentStepIndex + 1} of {totalSteps}
          </p>

          {/* Title */}
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            {currentStep.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {currentStep.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={skipTour}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={nextStep}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {isLast ? "Finish" : "Next"}
              </button>
            </div>
          </div>

          <Popover.Arrow className="fill-white dark:fill-neutral-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function mapPlacementToSide(placement: TourPlacement): "top" | "bottom" | "left" | "right" {
  return placement;
}
