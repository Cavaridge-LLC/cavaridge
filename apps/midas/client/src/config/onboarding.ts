import type { TourConfig, ChecklistConfig } from "@cavaridge/onboarding";

export const midasTourConfig: Omit<TourConfig, "onComplete"> = {
  appCode: "midas",
  steps: [
    {
      id: "welcome",
      targetSelector: '[data-onboarding="welcome"]',
      title: "Welcome to Midas!",
      description: "Your IT Roadmap and QBR platform. Let's walk through the key features.",
      placement: "bottom",
    },
    {
      id: "add-client",
      targetSelector: '[data-onboarding="add-client"]',
      title: "Add a Client",
      description: "Start by adding a client to track their IT initiatives and roadmap.",
      placement: "bottom",
    },
    {
      id: "create-initiative",
      targetSelector: '[data-onboarding="create-initiative"]',
      title: "Create an Initiative",
      description: "Define IT initiatives with timelines, owners, and status tracking.",
      placement: "right",
    },
    {
      id: "take-snapshot",
      targetSelector: '[data-onboarding="take-snapshot"]',
      title: "Take a Snapshot",
      description: "Capture a point-in-time view of all initiatives for QBR reporting.",
      placement: "bottom",
    },
    {
      id: "export-qbr",
      targetSelector: '[data-onboarding="export-qbr"]',
      title: "Export QBR",
      description: "Generate a polished Quarterly Business Review document to share with clients.",
      placement: "right",
    },
  ],
};

export const midasChecklistConfig: ChecklistConfig = {
  appCode: "midas",
  appDisplayName: "Midas",
  items: [
    {
      id: "add-client",
      label: "Add a client",
      description: "Create your first client record",
      route: "/",
    },
    {
      id: "create-initiative",
      label: "Create an initiative",
      description: "Add an IT initiative to track",
      route: "/",
    },
    {
      id: "take-snapshot",
      label: "Take a snapshot",
      description: "Capture current state for reporting",
      route: "/",
    },
    {
      id: "export-qbr",
      label: "Export a QBR",
      description: "Generate a client-ready report",
      route: "/",
    },
  ],
};
