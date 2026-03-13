import type { TourConfig, ChecklistConfig } from "@cavaridge/onboarding";

export const meridianTourConfig: Omit<TourConfig, "onComplete"> = {
  appCode: "meridian",
  steps: [
    {
      id: "welcome",
      targetSelector: '[data-onboarding="welcome"]',
      title: "Welcome to MERIDIAN!",
      description: "Your M&A IT intelligence platform. Let's walk through the key areas.",
      placement: "bottom",
    },
    {
      id: "deal-pipeline",
      targetSelector: '[data-onboarding="deal-pipeline"]',
      title: "Deal Pipeline",
      description: "Track every deal from LOI through close. Manage phases, milestones, and team assignments.",
      placement: "right",
    },
    {
      id: "upload-docs",
      targetSelector: '[data-onboarding="upload-docs"]',
      title: "Upload Documents",
      description: "Upload diligence documents and let AI surface critical risks and compliance gaps.",
      placement: "bottom",
    },
    {
      id: "risk-assessment",
      targetSelector: '[data-onboarding="risk-assessment"]',
      title: "Risk Assessment",
      description: "Review AI-identified risks with severity levels and actionable mitigations.",
      placement: "right",
    },
    {
      id: "playbooks",
      targetSelector: '[data-onboarding="playbooks"]',
      title: "Playbooks & Simulator",
      description: "Run integration playbooks and simulate Day 1 readiness scenarios.",
      placement: "right",
    },
  ],
};

export const meridianChecklistConfig: ChecklistConfig = {
  appCode: "meridian",
  appDisplayName: "MERIDIAN",
  items: [
    {
      id: "create-deal",
      label: "Create your first deal",
      description: "Add a deal to the pipeline",
      route: "/",
    },
    {
      id: "upload-docs",
      label: "Upload diligence documents",
      description: "Add documents for AI analysis",
      route: "/",
    },
    {
      id: "run-analysis",
      label: "Run AI risk analysis",
      description: "Let AI surface critical risks",
      route: "/risk",
    },
    {
      id: "review-risks",
      label: "Review identified risks",
      description: "Check severity levels and mitigations",
      route: "/risk",
    },
    {
      id: "explore-playbooks",
      label: "Explore playbooks",
      description: "Browse integration templates",
      route: "/playbook",
    },
  ],
};
