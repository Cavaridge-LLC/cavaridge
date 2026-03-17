// @cavaridge/agents — 7 Shared Functional Agents

// Document Analysis
export { DocumentAnalysisAgent } from "./document-analysis/agent.js";
export type {
  DocumentAnalysisInput,
  DocumentAnalysisOutput,
  DocumentAnalysisOptions,
  ClassificationResult,
  VisionResult,
  VisionFinding,
} from "./document-analysis/agent.js";

// Data Extractor
export { DataExtractorAgent } from "./data-extractor/agent.js";
export type {
  DataExtractorInput,
  DataExtractorOutput,
} from "./data-extractor/agent.js";

// Compliance Checker
export { ComplianceCheckerAgent } from "./compliance-checker/agent.js";
export type {
  ComplianceCheckInput,
  ComplianceCheckOutput,
  ComplianceGap,
} from "./compliance-checker/agent.js";

// Report Generator
export { ReportGeneratorAgent } from "./report-generator/agent.js";
export type {
  ReportGeneratorInput,
  ReportGeneratorOutput,
  ReportTaskType,
} from "./report-generator/agent.js";

// Research Agent
export { ResearchAgent } from "./research-agent/agent.js";
export type {
  ResearchInput,
  ResearchOutput,
} from "./research-agent/agent.js";

// Risk Scorer
export { RiskScorerAgent } from "./risk-scorer/agent.js";
export type {
  RiskScorerInput,
  RiskScorerOutput,
  ScoreBreakdown,
} from "./risk-scorer/agent.js";

// Cost Analyzer
export { CostAnalyzerAgent } from "./cost-analyzer/agent.js";
export type {
  CostAnalyzerInput,
  CostAnalyzerOutput,
  CostEstimate,
} from "./cost-analyzer/agent.js";
