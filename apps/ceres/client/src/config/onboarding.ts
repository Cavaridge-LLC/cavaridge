import type { TourConfig, ChecklistConfig } from "@cavaridge/onboarding";

export const ceresTourConfig: Omit<TourConfig, "onComplete"> = {
  appCode: "ceres",
  steps: [
    {
      id: "welcome",
      targetSelector: '[data-onboarding="welcome"]',
      title: "Welcome to Ceres!",
      description: "Your home health schedule analyzer. Let's walk through the key features.",
      placement: "bottom",
    },
    {
      id: "upload-image",
      targetSelector: '[data-onboarding="upload-image"]',
      title: "Upload a Schedule",
      description: "Upload a photo or screenshot of a home health visit schedule for analysis.",
      placement: "bottom",
    },
    {
      id: "review-visits",
      targetSelector: '[data-onboarding="review-visits"]',
      title: "Review Extracted Visits",
      description: "Check the AI-extracted visit data for accuracy and completeness.",
      placement: "right",
    },
    {
      id: "compliance-check",
      targetSelector: '[data-onboarding="compliance-check"]',
      title: "Compliance Metrics",
      description: "View compliance indicators and flag any scheduling concerns.",
      placement: "bottom",
    },
  ],
};

export const ceresChecklistConfig: ChecklistConfig = {
  appCode: "ceres",
  appDisplayName: "Ceres",
  items: [
    {
      id: "upload-schedule",
      label: "Upload a schedule image",
      description: "Take a photo or screenshot of a visit schedule",
      route: "/",
    },
    {
      id: "review-visits",
      label: "Review extracted visits",
      description: "Check AI-parsed visit data",
      route: "/",
    },
    {
      id: "run-compliance",
      label: "Run a compliance check",
      description: "View scheduling compliance metrics",
      route: "/",
    },
  ],
};
