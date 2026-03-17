// @cavaridge/audit — Immutable append-only audit logging

// Types
export type {
  AuditLogParams,
  AuditLoggerOptions,
  AuditQueryOptions,
  AuditQueryResult,
} from "./types.js";

// Schema
export { auditLog } from "./schema.js";
export type { AuditEntry, NewAuditEntry } from "./schema.js";

// Logger
export { createAuditLogger, createLegacyAuditLogger } from "./logger.js";

// Agent events
export {
  AGENT_AUDIT_ACTIONS,
  AGENT_RESOURCE_TYPES,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} from "./agent-events.js";
export type { AgentAuditAction, AgentResourceType } from "./agent-events.js";

// Query
export { createAuditQuerier } from "./query.js";
