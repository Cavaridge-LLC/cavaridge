/**
 * @cavaridge/tenant-intel — M365/GWS Tenant Intelligence Layer
 *
 * Shared monorepo package for unified tenant data ingestion,
 * normalization, and intelligence. Phase 1: Microsoft Graph API only.
 *
 * NOT content (email/doc bodies) — that's Phase 2 behind compliance gate.
 *
 * Consumed by: Meridian, Midas, Astra, HIPAA, AEGIS, Ducky.
 */

// ── Vendor-neutral types ────────────────────────────────────────────

export type {
  SourceVendor,
  TenantUser,
  NormalizedLicense,
  ServiceUtilization,
  LicenseSummary,
  SecurityPosture,
  SecurityControl,
  SecurityControlCategory,
  CompensatingControl,
  ConditionalAccessPolicy,
  ManagedDevice,
  TenantSnapshot,
  SnapshotTrigger,
  DeltaReport,
  DeltaChange,
  DeltaSummary,
  IngestOptions,
  IngestModule,
  IngestResult,
  IngestModuleResult,
  ActivityReport,
  ServiceActivitySummary,
  UserFilter,
  DateRange,
  LicenseUtilizationReport,
  M365Credentials,
  TenantIntelConfig,
} from "./shared/types.js";

// ── Schema (Drizzle tables) ─────────────────────────────────────────

export {
  tenantSnapshots,
  userDirectory,
  licenseAssignments,
  securityScores,
  configSnapshots,
  managedDevices,
  ingestionJobs,
  tenantIntelTables,
} from "./storage/schema.js";

// ── Microsoft Graph Connector ───────────────────────────────────────

export { GraphClient } from "./connectors/microsoft/graph-client.js";
export { fetchUsers } from "./connectors/microsoft/users.js";
export { fetchLicenses, fetchServiceUtilization } from "./connectors/microsoft/licensing.js";
export { fetchSecurityPosture, fetchConditionalAccessPolicies } from "./connectors/microsoft/security.js";
export { fetchDevices } from "./connectors/microsoft/devices.js";

// ── Storage ─────────────────────────────────────────────────────────

export { buildSnapshot, type SnapshotInput } from "./storage/snapshot.js";
export { computeDelta, type DeltaInput } from "./storage/delta.js";
export { generateTenantEmbeddings, type EmbeddingRecord } from "./storage/vector-store.js";

// ── Pipeline ────────────────────────────────────────────────────────

export {
  ingestTenant,
  computeSnapshotDelta,
} from "./pipeline/ingest.js";
export {
  TENANT_INTEL_QUEUE_NAME,
  createIngestionQueue,
  createIngestionWorker,
  scheduleIngestion,
  triggerManualIngestion,
  type IngestionJobData,
} from "./pipeline/scheduler.js";

// ── Agents ──────────────────────────────────────────────────────────

export {
  TenantGraphAgent,
  type TenantGraphInput,
  type TenantGraphOutput,
} from "./agents/tenant-graph-agent.js";
export {
  UsagePatternAgent,
  type UsagePatternInput,
  type UsagePatternOutput,
} from "./agents/usage-pattern-agent.js";
export {
  ConfigDriftAgent,
  type ConfigDriftInput,
  type ConfigDriftOutput,
} from "./agents/config-drift-agent.js";

// ── TenantIntelClient (convenience API for consuming apps) ──────────

export { TenantIntelClient } from "./client.js";
