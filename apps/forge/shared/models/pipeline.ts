/**
 * Forge Pipeline Types — canonical shapes for the 5-stage content pipeline.
 *
 * Stage 1: Research & Outline
 * Stage 2: Draft Generation
 * Stage 3: Review & Refinement
 * Stage 4: Formatting & Polish
 * Stage 5: Export
 */

// ── Pipeline Stage Enum ──

export type PipelineStage =
  | "research_outline"
  | "draft_generation"
  | "review_refinement"
  | "formatting_polish"
  | "export"
  | "complete"
  | "failed";

export type PipelineStageStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type DuckyState =
  | "idle"
  | "thinking"
  | "planning"
  | "building"
  | "reviewing"
  | "celebrating"
  | "concerned"
  | "apologetic"
  | "determined";

// ── Content Types ──

export type ContentType =
  | "blog_post"
  | "case_study"
  | "white_paper"
  | "email_campaign"
  | "social_media_series"
  | "proposal"
  | "one_pager"
  | "custom";

export type OutputFormat = "docx" | "pdf" | "html";

// ── Stage 1: Research & Outline ──

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

export interface ResearchPayload {
  structuredFindings: ResearchFinding[];
  sources: ResearchSource[];
  dataPoints: DataPoint[];
  outline: OutlineEntry[];
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

export interface OutlineEntry {
  id: string;
  title: string;
  brief: string;
  headingLevel: 1 | 2 | 3;
  order: number;
  wordCountTarget: number;
  subsections?: OutlineEntry[];
}

// ── Structure Plan (produced by Structure Agent) ──

export interface PlannedSection {
  id: string;
  title: string;
  brief: string;
  headingLevel: 1 | 2 | 3;
  wordCount: number;
  order: number;
  subsections?: PlannedSection[];
}

export interface StructurePlan {
  orderedSections: PlannedSection[];
  totalWordCount: number;
  pageEstimate: number;
}

// ── Stage 2: Draft Generation ──

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

// ── Stage 3: Review & Refinement ──

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

// ── Stage 4: Formatting & Polish ──

export interface PolishedPayload {
  sections: GeneratedSection[];
  metadata: {
    totalWordCount: number;
    generationModel: string;
    polishNotes: string[];
  };
}

// ── Stage 5: Export ──

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  format: OutputFormat;
}

// ── Pipeline State ──

export interface StageRecord {
  stage: PipelineStage;
  status: PipelineStageStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  intermediateOutput?: unknown;
  error?: string;
}

export interface PipelineState {
  contentId: string;
  currentStage: PipelineStage;
  duckyState: DuckyState;
  stages: StageRecord[];
  projectSpec?: ProjectSpec;
  researchPayload?: ResearchPayload;
  contentPayload?: ContentPayload;
  qualityReport?: QualityReport;
  polishedPayload?: PolishedPayload;
  exportResult?: Omit<ExportResult, "buffer">;
  error?: string;
  revisionCount: number;
}

// ── Brief input (from user) ──

export interface ForgeBrief {
  description: string;
  outputFormat: OutputFormat;
  contentType: ContentType;
  audience?: string;
  tone?: ProjectSpec["tone"];
  referenceNotes?: string;
  templateId?: string;
  brandVoiceId?: string;
}

// ── Brand Voice ──

export interface BrandVoiceConfig {
  tone: string;
  vocabulary: string[];
  styleGuide: string;
  avoidTerms: string[];
  examplePhrases: string[];
}

// ── Cost Estimate ──

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

// ── Template ──

export interface TemplateData {
  contentType: ContentType;
  sections: SectionSpec[];
  defaultTone: ProjectSpec["tone"];
  defaultAudience: string;
  wordCountRange: { min: number; max: number };
  outputFormats: OutputFormat[];
  description: string;
}

// ── Batch ──

export interface BatchRequest {
  topic: string;
  contentTypes: ContentType[];
  outputFormat: OutputFormat;
  audience?: string;
  tone?: ProjectSpec["tone"];
  brandVoiceId?: string;
  sharedResearch: boolean;
}
