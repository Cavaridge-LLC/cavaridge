/**
 * @cavaridge/agent-core — Core type definitions for the agent framework.
 *
 * All agents in the platform share these types.
 */

import type {
  SpanielResponse,
  TaskType,
  TokenUsage,
} from "@cavaridge/spaniel";
import type { SecurityScanResult } from "@cavaridge/security";

// ── Agent Configuration ──────────────────────────────────────────────

export interface AgentConfig {
  /** Unique identifier for this agent type (e.g. "document-analysis") */
  agentId: string;
  /** Human-readable name */
  agentName: string;
  /** Cavaridge app code that owns this agent (e.g. "CVG-MER") */
  appCode: string;
  /** Semantic version */
  version: string;
}

// ── Agent Context (passed per-execution) ─────────────────────────────

export interface AgentContext {
  tenantId: string;
  userId: string;
  config: AgentConfig;
  /** Optional correlation ID for distributed tracing */
  correlationId?: string;
  /** Optional audit logger — if not provided, audit logging is skipped */
  auditLog?: AuditLogFn;
}

/** Matches the signature of createAuditLogger return type */
export type AuditLogFn = (params: {
  organizationId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  appCode?: string;
  correlationId?: string;
}) => Promise<void>;

// ── Agent Input / Output ─────────────────────────────────────────────

export interface AgentInput<T> {
  data: T;
  context: AgentContext;
  options?: Record<string, unknown>;
}

export interface AgentOutput<T> {
  result: T;
  metadata: AgentMetadata;
}

export interface AgentMetadata {
  requestId: string;
  agentId: string;
  executionTimeMs: number;
  tokensUsed: TokenUsage;
  costUsd: number;
  modelsUsed: string[];
  /** Accumulated Spaniel responses for transparency */
  spanielResponses?: SpanielResponse[];
}

// ── Agent Tools ──────────────────────────────────────────────────────

export interface AgentToolDefinition {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}

// ── Execution Status ─────────────────────────────────────────────────

export type AgentExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// ── Security Scan Result (re-export for convenience) ─────────────────

export type { SecurityScanResult, TaskType, TokenUsage, SpanielResponse };
