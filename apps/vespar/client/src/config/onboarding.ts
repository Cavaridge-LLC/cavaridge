import type { TourConfig, ChecklistConfig } from "@cavaridge/onboarding";

export const vesparTourConfig: Omit<TourConfig, "onComplete"> = {
  appCode: "vespar",
  steps: [
    {
      id: "welcome",
      targetSelector: '[data-onboarding="welcome"]',
      title: "Welcome to Vespar!",
      description: "Your cloud migration planning tool. Let's get you started.",
      placement: "bottom",
    },
    {
      id: "migration-wizard",
      targetSelector: '[data-onboarding="migration-wizard"]',
      title: "Migration Wizard",
      description: "Start a new migration plan with the step-by-step wizard.",
      placement: "bottom",
    },
    {
      id: "source-dest",
      targetSelector: '[data-onboarding="source-dest"]',
      title: "Source & Destination",
      description: "Select your current platform and target cloud environment.",
      placement: "right",
    },
    {
      id: "view-blueprint",
      targetSelector: '[data-onboarding="view-blueprint"]',
      title: "View Blueprint",
      description: "Review the AI-generated migration blueprint with risk analysis and timeline.",
      placement: "bottom",
    },
  ],
};

export const vesparChecklistConfig: ChecklistConfig = {
  appCode: "vespar",
  appDisplayName: "Vespar",
  items: [
    {
      id: "start-plan",
      label: "Start a migration plan",
      description: "Create your first cloud migration plan",
      route: "/",
    },
    {
      id: "select-platforms",
      label: "Select source & destination",
      description: "Choose current and target platforms",
      route: "/",
    },
    {
      id: "review-blueprint",
      label: "Review the migration blueprint",
      description: "Check the generated plan and risk analysis",
      route: "/",
    },
  ],
};
