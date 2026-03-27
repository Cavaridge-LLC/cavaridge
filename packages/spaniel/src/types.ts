/**
 * Spaniel LLM Gateway — Core Types
 *
 * All type definitions for the @cavaridge/spaniel package.
 */

export type TaskType =
  | "analysis"
  | "generation"
  | "summarization"
  | "extraction"
  | "chat"
  | "code_generation"
  | "research"
  | "conversation"
  | "embeddings"
  | "vision";

export type ModelTier = "primary" | "secondary" | "tertiary";

export interface RoutingEntry {
  taskType: TaskType;
  primary: string;
  secondary: string;
  tertiary: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<Record<string, unknown>>;
}

export interface SpanielRequest {
  requestId?: string;
  tenantId: string;
  userId: string;
  appCode: string;
  taskType: TaskType;
  system?: string;
  messages: ChatMessage[];
  options?: SpanielRequestOptions;
}

export interface SpanielRequestOptions {
  requireConsensus?: boolean;
  maxTokens?: number;
  temperature?: number;
  fallbackEnabled?: boolean;
  skipCache?: boolean;
  stream?: boolean;
}

export interface ConsensusResult {
  aligned: boolean;
  confidenceScore: number;
  divergenceNotes: string | null;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface CostInfo {
  amount: number;
  currency: "USD";
  model?: string;
  cached?: boolean;
}

export interface ModelsUsed {
  primary: string;
  secondary: string | null;
  tertiary: string | null;
}

export interface SpanielResponse {
  requestId: string;
  status: "success" | "degraded" | "error";
  content: string;
  modelsUsed: ModelsUsed;
  consensus: ConsensusResult | null;
  tokens: TokenUsage;
  cost: CostInfo;
  fallbackUsed: boolean;
  timestamp: string;
}

export interface EmbeddingOptions {
  tenantId?: string;
  userId?: string;
  appCode?: string;
}

export interface RequestLogEntry {
  requestId: string;
  tenantId: string;
  userId: string;
  appCode: string;
  taskType: TaskType;
  primaryModel: string;
  secondaryModel: string | null;
  tertiaryModel: string | null;
  modelUsed: string;
  fallbackUsed: boolean;
  consensusAligned: boolean | null;
  confidenceScore: number | null;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  status: "success" | "degraded" | "error";
}

export interface ModelPricing {
  modelId: string;
  costPerMInput: number;
  costPerMOutput: number;
}
