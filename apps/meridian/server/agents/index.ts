// Meridian Agent Adapters — barrel export

export { createMeridianContext } from "./context";
export {
  classifyDocumentAI,
  analyzeImageViaAgent,
} from "./document-agent";
export {
  buildMeridianQAPrompt,
  executeQAQuery,
} from "./qa-agent";
export {
  extractTechStackViaAgent,
  extractTopologyViaAgent,
  compareBaselineViaAgent,
  generatePlaybookViaAgent,
} from "./infra-agent";
export {
  consolidateFindingsViaAgent,
  generateExecutiveSummaryViaAgent,
  generatePillarNarrativeViaAgent,
  generateRecommendationsViaAgent,
} from "./report-agent";
export {
  generateSingleEmbedding,
  generateEmbeddingsBatch,
  hasAICapability,
} from "./embedding-agent";
