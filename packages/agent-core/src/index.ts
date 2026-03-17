// @cavaridge/agent-core — Shared agent types, base class, and errors

// Types
export type {
  AgentConfig,
  AgentContext,
  AgentInput,
  AgentOutput,
  AgentMetadata,
  AgentToolDefinition,
  AgentExecutionStatus,
  AuditLogFn,
} from "./types.js";

// Re-exported types from dependencies
export type {
  SecurityScanResult,
  TaskType,
  TokenUsage,
  SpanielResponse,
} from "./types.js";

// Base agent
export { BaseAgent } from "./base-agent.js";

// Errors
export {
  AgentError,
  AgentValidationError,
  AgentSecurityError,
  AgentLlmError,
} from "./errors.js";
