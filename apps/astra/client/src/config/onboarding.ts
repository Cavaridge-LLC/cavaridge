import type { TourConfig, ChecklistConfig } from "@cavaridge/onboarding";

export const astraTourConfig: Omit<TourConfig, "onComplete"> = {
  appCode: "astra",
  steps: [
    {
      id: "welcome",
      targetSelector: '[data-onboarding="welcome"]',
      title: "Welcome to Astra!",
      description: "Your M365 license optimization platform. Let's get you oriented.",
      placement: "bottom",
    },
    {
      id: "connect-m365",
      targetSelector: '[data-onboarding="connect-m365"]',
      title: "Connect Microsoft 365",
      description: "Link your M365 tenant to pull license and usage data automatically.",
      placement: "bottom",
    },
    {
      id: "license-analysis",
      targetSelector: '[data-onboarding="license-analysis"]',
      title: "License Analysis",
      description: "Review license utilization, identify waste, and see cost-saving opportunities.",
      placement: "right",
    },
    {
      id: "recommendations",
      targetSelector: '[data-onboarding="recommendations"]',
      title: "Recommendations",
      description: "Get AI-powered recommendations for rightsizing your M365 subscriptions.",
      placement: "right",
    },
  ],
};

export const astraChecklistConfig: ChecklistConfig = {
  appCode: "astra",
  appDisplayName: "Astra",
  items: [
    {
      id: "connect-tenant",
      label: "Connect your M365 tenant",
      description: "Authorize access to pull license data",
      route: "/",
    },
    {
      id: "review-licenses",
      label: "Review license utilization",
      description: "See how licenses are being used",
      route: "/",
    },
    {
      id: "explore-recommendations",
      label: "Explore recommendations",
      description: "View cost-saving and optimization suggestions",
      route: "/",
    },
  ],
};
