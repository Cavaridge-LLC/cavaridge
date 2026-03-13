import type { TourConfig, ChecklistConfig } from "@cavaridge/onboarding";

export const caelumTourConfig: Omit<TourConfig, "onComplete"> = {
  appCode: "caelum",
  steps: [
    {
      id: "welcome",
      targetSelector: '[data-onboarding="welcome"]',
      title: "Welcome to Caelum!",
      description: "The AI-powered Scope of Work builder. Let's walk through the key features.",
      placement: "bottom",
    },
    {
      id: "create-sow",
      targetSelector: '[data-onboarding="create-sow"]',
      title: "Create a SoW",
      description: "Start a new Scope of Work from raw notes, meeting minutes, or a blank template.",
      placement: "bottom",
    },
    {
      id: "ai-refine",
      targetSelector: '[data-onboarding="ai-refine"]',
      title: "AI-Assisted Scope",
      description: "Chat with AI to fill gaps, refine language, and ensure scope protection.",
      placement: "right",
    },
    {
      id: "review-export",
      targetSelector: '[data-onboarding="review-export"]',
      title: "Review & Export",
      description: "Review the structured output and export as a client-ready document.",
      placement: "bottom",
    },
  ],
};

export const caelumChecklistConfig: ChecklistConfig = {
  appCode: "caelum",
  appDisplayName: "Caelum",
  items: [
    {
      id: "create-sow",
      label: "Create a Scope of Work",
      description: "Start from notes or a blank template",
      route: "/",
    },
    {
      id: "use-ai",
      label: "Use AI to refine scope",
      description: "Chat with AI to fill gaps and improve language",
      route: "/",
    },
    {
      id: "export-sow",
      label: "Export a SoW",
      description: "Download a client-ready document",
      route: "/",
    },
  ],
};
