/**
 * @cavaridge/connector-core — Base interfaces
 *
 * All connectors implement these interfaces. Consuming apps depend
 * only on these types, never on platform-specific APIs.
 */

// ─── Connector Identity & Config ─────────────────────────────────────

export type ConnectorType =
  | 'rmm' | 'psa' | 'security' | 'documentation'
  | 'identity' | 'backup' | 'accounting' | 'communication';

export interface ConnectorConfig {
  tenantId: string;
  connectorId: string;
  baseUrl?: string;
  credentials: Record<string, string>; // OAuth tokens, API keys, etc.
  settings: Record<string, unknown>;   // Platform-specific config
}

export interface ConnectorHealth {
  connectorId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  syncLagSeconds: number;
  recordsSynced: number;
  errorRate: number; // Rolling 1-hour percentage
  details: Record<string, unknown>;
  checkedAt: Date;
}

export interface AuthResult {
  authenticated: boolean;
  expiresAt?: Date;
  error?: string;
}

// ─── Sync Types ──────────────────────────────────────────────────────

export type SyncMode = 'full_sync' | 'incremental_sync' | 'webhook' | 'on_demand';

export interface SyncResult {
  mode: SyncMode;
  entityType: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errors: SyncError[];
  cursor: string | null; // For next incremental sync
  durationMs: number;
}

export interface SyncError {
  recordId?: string;
  message: string;
  code?: string;
  retryable: boolean;
}

// ─── Webhook Types ───────────────────────────────────────────────────

export interface WebhookRegistration {
  id: string;
  eventType: string;
  callbackUrl: string;
  secret?: string;
  createdAt: Date;
}

export interface WebhookEvent {
  connectorId: string;
  eventType: string;
  externalId: string;
  payload: unknown;
  receivedAt: Date;
}

// ─── Pagination ──────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  cursor?: string;
}

// ─── Base Connector Interface ────────────────────────────────────────

export interface IBaseConnector {
  readonly id: string;
  readonly name: string;
  readonly type: ConnectorType;
  readonly version: string;
  readonly platformVersion: string;

  // Lifecycle
  initialize(config: ConnectorConfig): Promise<void>;
  healthCheck(): Promise<ConnectorHealth>;
  shutdown(): Promise<void>;

  // Authentication
  authenticate(): Promise<AuthResult>;
  refreshAuth(): Promise<AuthResult>;
  isAuthenticated(): boolean;

  // Sync
  fullSync(entityType: string): Promise<SyncResult>;
  incrementalSync(entityType: string, cursor: string): Promise<SyncResult>;
  getLastSyncCursor(entityType: string): Promise<string | null>;

  // Webhooks
  supportsWebhooks(): boolean;
  registerWebhook?(eventType: string, callbackUrl: string): Promise<WebhookRegistration>;
  handleWebhookPayload?(headers: Record<string, string>, body: unknown): Promise<WebhookEvent>;
  validateWebhookSignature?(headers: Record<string, string>, body: string): boolean;
}

// ─── Normalized Data Models ──────────────────────────────────────────

export interface NormalizedDevice {
  externalId: string;
  connectorId: string;
  hostname: string;
  fqdn?: string;
  osName: string;
  osVersion: string;
  osType: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'network' | 'other';
  lastSeen: Date;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  ipAddresses: string[];
  macAddresses: string[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  assignedUser?: string;
  clientExternalId?: string;
  siteExternalId?: string;
  tags: string[];
  patchStatus?: 'current' | 'pending' | 'overdue' | 'unknown';
  antivirusStatus?: 'active' | 'outdated' | 'disabled' | 'unknown';
  rawData: Record<string, unknown>;
}

export interface NormalizedAlert {
  externalId: string;
  connectorId: string;
  deviceExternalId?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  category: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  rawData: Record<string, unknown>;
}

export interface NormalizedTicket {
  externalId: string;
  connectorId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category?: string;
  assignedTo?: string;
  requestedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  rawData: Record<string, unknown>;
}

export interface NormalizedTimeEntry {
  externalId: string;
  connectorId: string;
  ticketExternalId?: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  durationMins: number;
  billable: boolean;
  notes?: string;
  rawData: Record<string, unknown>;
}

export interface NormalizedContract {
  externalId: string;
  connectorId: string;
  clientExternalId: string;
  name: string;
  type: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  monthlyAmount?: number;
  rawData: Record<string, unknown>;
}

export interface NormalizedThreat {
  externalId: string;
  connectorId: string;
  threatType: 'malware' | 'phishing' | 'ransomware' | 'identity' | 'data_leak' | 'vulnerability' | 'policy_violation' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'contained' | 'remediated' | 'false_positive';
  title: string;
  description: string;
  affectedEntities: Array<{ type: string; id: string; name: string }>;
  detectedAt: Date;
  recommendedActions: string[];
  rawData: Record<string, unknown>;
}

export interface PostureScore {
  connectorId: string;
  clientExternalId: string;
  overallScore: number;
  gradeLabel: string;
  categories: Array<{
    name: string;
    score: number;
    issueCount: number;
    criticalCount: number;
  }>;
  lastAssessedAt: Date;
  rawData: Record<string, unknown>;
}

export interface ComplianceStatus {
  connectorId: string;
  clientExternalId: string;
  framework: string;
  overallStatus: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
  controlsPassed: number;
  controlsFailed: number;
  controlsTotal: number;
  lastAssessedAt: Date;
  rawData: Record<string, unknown>;
}

// ─── Type-Specific Connector Interfaces ──────────────────────────────

export interface DeviceFilters {
  clientExternalId?: string;
  status?: string;
  osType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AlertFilters {
  deviceExternalId?: string;
  severity?: string;
  status?: string;
  since?: Date;
  page?: number;
  pageSize?: number;
}

export interface ThreatFilters {
  clientExternalId?: string;
  severity?: string;
  status?: string;
  threatType?: string;
  since?: Date;
  page?: number;
  pageSize?: number;
}

export interface ScriptPayload {
  language: 'powershell' | 'bash' | 'python' | 'cmd';
  body: string;
  parameters?: Record<string, string>;
  timeout?: number;
}

export interface ScriptResult {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export interface PatchStatus {
  deviceExternalId: string;
  totalPatches: number;
  installedPatches: number;
  pendingPatches: number;
  failedPatches: number;
  lastPatchedAt?: Date;
}

export interface IRmmConnector extends IBaseConnector {
  type: 'rmm';
  listDevices(filters?: DeviceFilters): Promise<PaginatedResult<NormalizedDevice>>;
  getDevice(externalId: string): Promise<NormalizedDevice>;
  getDeviceAlerts(externalId: string): Promise<NormalizedAlert[]>;
  listAlerts(filters?: AlertFilters): Promise<PaginatedResult<NormalizedAlert>>;
  acknowledgeAlert(externalId: string): Promise<void>;
  resolveAlert(externalId: string, notes?: string): Promise<void>;
  getPatchStatus(deviceId: string): Promise<PatchStatus>;
  supportsScripting(): boolean;
  executeScript?(deviceId: string, script: ScriptPayload): Promise<ScriptResult>;
  getScriptResult?(jobId: string): Promise<ScriptResult>;
}

export interface IPsaConnector extends IBaseConnector {
  type: 'psa';
  listTickets(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedTicket>>;
  getTicket(externalId: string): Promise<NormalizedTicket>;
  createTicket(ticket: Record<string, unknown>): Promise<NormalizedTicket>;
  updateTicket(externalId: string, updates: Record<string, unknown>): Promise<NormalizedTicket>;
  listTimeEntries(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedTimeEntry>>;
  createTimeEntry(entry: Record<string, unknown>): Promise<NormalizedTimeEntry>;
  listContracts(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedContract>>;
  getContract(externalId: string): Promise<NormalizedContract>;
}

export interface ISecurityConnector extends IBaseConnector {
  type: 'security';
  getPostureScore(clientId: string): Promise<PostureScore>;
  getPostureDetails(clientId: string): Promise<Array<Record<string, unknown>>>;
  listThreats(filters?: ThreatFilters): Promise<PaginatedResult<NormalizedThreat>>;
  getThreat(externalId: string): Promise<NormalizedThreat>;
  acknowledgeThreat(externalId: string): Promise<void>;
  getComplianceStatus(clientId: string, framework?: string): Promise<ComplianceStatus>;
}
