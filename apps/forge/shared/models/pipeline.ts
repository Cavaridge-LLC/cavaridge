/**
 * Forge Pipeline Types — canonical shapes for the 5-stage agent pipeline.
 *
 * Brief → ProjectSpec → CostEstimate → ResearchPayload → StructurePlan → ContentPayload → QualityReport
 */

// ── Stage 1: INTAKE output ──

export interface ProjectSpec {
  title: string;
  sections: SectionSpec[];
  audience: string;
  tone: "professional" | "casual" | "creative" | "technical" | "academic";
  formatRequirements: string[];
  constraints: string[];
  wordCountTarget?: number;
}

export interface SectionSpec {
  id: string;
  title: string;
  brief: string;
  order: number;
}

// ── Stage 2: ESTIMATE output ──

export interface CostEstimate {
  researchCredits: number;
  generationCredits: number;
  renderingCredits: number;
  totalCredits: number;
  breakdown: CostBreakdownItem[];
  estimatedDurationMinutes: number;
}

export interface CostBreakdownItem {
  label: string;
  credits: number;
  detail: string;
}

// ── Stage 3: RESEARCH output ──

export interface ResearchPayload {
  structuredFindings: ResearchFinding[];
  sources: ResearchSource[];
  dataPoints: DataPoint[];
  templateMatches: TemplateMatch[];
}

export interface ResearchFinding {
  topic: string;
  summary: string;
  relevance: number;
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
}

export interface DataPoint {
  label: string;
  value: string;
  source?: string;
}

export interface TemplateMatch {
  templateId: string;
  name: string;
  similarity: number;
}

// ── Stage 4: STRUCTURE output ──

export interface StructurePlan {
  orderedSections: PlannedSection[];
  totalWordCount: number;
  pageEstimate: number;
}

export interface PlannedSection {
  id: string;
  title: string;
  brief: string;
  headingLevel: 1 | 2 | 3;
  wordCount: number;
  order: number;
  subsections?: PlannedSection[];
}

// ── Stage 5: GENERATE output ──

export interface ContentPayload {
  sections: GeneratedSection[];
  metadata: {
    totalWordCount: number;
    generationModel: string;
  };
}

export interface GeneratedSection {
  id: string;
  title: string;
  content: string;
  headingLevel: 1 | 2 | 3;
  order: number;
  wordCount: number;
}

// ── Stage 6: VALIDATE output ──

export interface QualityReport {
  overallScore: number;
  sectionScores: SectionScore[];
  issues: QualityIssue[];
  recommendations: string[];
  passesThreshold: boolean;
}

export interface SectionScore {
  sectionId: string;
  sectionTitle: string;
  score: number;
  feedback: string;
}

export interface QualityIssue {
  sectionId?: string;
  severity: "critical" | "warning" | "info";
  description: string;
  suggestion: string;
}

// ── Pipeline State (LangGraph) ──

export type PipelineStage = "intake" | "estimate" | "research" | "structure" | "generate" | "validate" | "render" | "complete" | "failed";

export type DuckyState = "idle" | "thinking" | "planning" | "building" | "reviewing" | "celebrating" | "concerned" | "apologetic" | "determined";

export interface PipelineState {
  projectId: string;
  stage: PipelineStage;
  duckyState: DuckyState;
  projectSpec?: ProjectSpec;
  costEstimate?: CostEstimate;
  researchPayload?: ResearchPayload;
  structurePlan?: StructurePlan;
  contentPayload?: ContentPayload;
  qualityReport?: QualityReport;
  outputUrl?: string;
  error?: string;
  revisionCount: number;
}

// ── Brief input (from user) ──

export interface ForgeBrief {
  description: string;
  outputFormat: "docx" | "pdf" | "markdown";
  audience?: string;
  tone?: ProjectSpec["tone"];
  referenceNotes?: string;
}
