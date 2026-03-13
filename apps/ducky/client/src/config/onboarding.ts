import type { TourConfig, ChecklistConfig } from "@cavaridge/onboarding";

export const duckyTourConfig: Omit<TourConfig, "onComplete"> = {
  appCode: "ducky",
  steps: [
    {
      id: "welcome",
      targetSelector: '[data-onboarding="welcome"]',
      title: "Welcome to Ducky!",
      description: "Your AI-powered answer engine. Let's take a quick tour of the key features.",
      placement: "bottom",
    },
    {
      id: "ask-question",
      targetSelector: '[data-onboarding="ask-question"]',
      title: "Ask a Question",
      description: "Type any question here and Ducky will search your knowledge base for the best answer.",
      placement: "bottom",
    },
    {
      id: "knowledge-sources",
      targetSelector: '[data-onboarding="knowledge-sources"]',
      title: "Knowledge Sources",
      description: "Manage the documents and data sources that Ducky draws answers from.",
      placement: "right",
    },
    {
      id: "saved-answers",
      targetSelector: '[data-onboarding="saved-answers"]',
      title: "Save & Share Answers",
      description: "Bookmark useful answers to build a personal knowledge collection you can share with your team.",
      placement: "right",
    },
    {
      id: "analytics",
      targetSelector: '[data-onboarding="analytics"]',
      title: "Analytics",
      description: "Track question trends, popular topics, and knowledge gaps across your organization.",
      placement: "right",
    },
  ],
};

export const duckyChecklistConfig: ChecklistConfig = {
  appCode: "ducky",
  appDisplayName: "Ducky",
  items: [
    {
      id: "ask-first-question",
      label: "Ask your first question",
      description: "Try asking Ducky anything",
      route: "/ask",
    },
    {
      id: "add-knowledge-source",
      label: "Add a knowledge source",
      description: "Upload a document or connect a data source",
      route: "/knowledge",
    },
    {
      id: "save-answer",
      label: "Save an answer",
      description: "Bookmark a useful answer for later",
      route: "/ask",
    },
    {
      id: "view-analytics",
      label: "View analytics",
      description: "Check out question trends and insights",
      route: "/analytics",
    },
  ],
};
