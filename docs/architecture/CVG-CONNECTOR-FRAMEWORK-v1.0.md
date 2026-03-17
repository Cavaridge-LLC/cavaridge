# CVG-CONNECTOR-FRAMEWORK-v1.0 — Connector Framework Specification

**Version:** 1.0  
**Date:** 2026-03-15  
**Status:** Approved  
**Owner:** Benjamin Posner, Principal — Cavaridge, LLC  

---

## 1. Overview

The Cavaridge Connector Framework provides a standardized abstraction for integrating external platforms (RMM, PSA, security, documentation, identity, accounting) into the Cavaridge ecosystem. All connectors implement a common interface, register with a central registry, and report health metrics — enabling the platform to treat all external data sources uniformly regardless of the underlying platform.

## 2. Connector Types

| Type | Interface | Purpose | Phase 1 Targets |
|------|-----------|---------|-----------------|
| `rmm` | `IRmmConnector` | Device inventory, alerts, patch status, script execution | NinjaOne, Atera, Syncro |
| `psa` | `IPsaConnector` | Ticket sync, contract sync, time entry sync | HaloPSA |
| `security` | `ISecurityConnector` | Threat detections, posture scores, compliance data | Guardz, SentinelOne, Huntress |
| `documentation` | `IDocumentationConnector` | Knowledge articles, runbooks, password vaults | IT Glue, Hudu |
| `identity` | `IIdentityConnector` | User/group inventory, conditional access, MFA status | Entra ID, JumpCloud |
| `backup` | `IBackupConnector` | Backup job status, recovery point monitoring | Datto BCDR, Veeam, Acronis |
| `accounting` | `IAccountingConnector` | Invoice sync, expense tracking | QuickBooks, Xero |
| `communication` | `ICommunicationConnector` | Notification routing, message ingestion | M365/Teams, Slack, Gmail |

## 3. Base Connector Interface

Every connector implements `IBaseConnector`:

```typescript
interface IBaseConnector {
  // Identity
  readonly id: string;              // e.g., 'ninjaone', 'halopsa', 'guardz'
  readonly name: string;            // Human-readable name
  readonly type: ConnectorType;     // 'rmm' | 'psa' | 'security' | etc.
  readonly version: string;         // Connector version (semver)
  readonly platformVersion: string; // Minimum supported platform API version

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

  // Webhooks (if supported)
  supportsWebhooks(): boolean;
  registerWebhook(eventType: string, callbackUrl: string): Promise<WebhookRegistration>;
  handleWebhookPayload(headers: Record<string, string>, body: unknown): Promise<WebhookEvent>;
  validateWebhookSignature(headers: Record<string, string>, body: string): boolean;
}
```

## 4. Type-Specific Interfaces

### 4.1 IRmmConnector (extends IBaseConnector)

```typescript
interface IRmmConnector extends IBaseConnector {
  type: 'rmm';

  // Devices
  listDevices(filters?: DeviceFilters): Promise<PaginatedResult<NormalizedDevice>>;
  getDevice(externalId: string): Promise<NormalizedDevice>;
  getDeviceAlerts(externalId: string): Promise<NormalizedAlert[]>;

  // Alerts
  listAlerts(filters?: AlertFilters): Promise<PaginatedResult<NormalizedAlert>>;
  acknowledgeAlert(externalId: string): Promise<void>;
  resolveAlert(externalId: string, notes?: string): Promise<void>;

  // Patches
  getPatchStatus(deviceId: string): Promise<PatchStatus>;
  listPendingPatches(filters?: PatchFilters): Promise<NormalizedPatch[]>;

  // Scripting (if supported)
  supportsScripting(): boolean;
  executeScript(deviceId: string, script: ScriptPayload): Promise<ScriptResult>;
  getScriptResult(jobId: string): Promise<ScriptResult>;
}
```

### 4.2 IPsaConnector (extends IBaseConnector)

```typescript
interface IPsaConnector extends IBaseConnector {
  type: 'psa';

  // Tickets
  listTickets(filters?: TicketFilters): Promise<PaginatedResult<NormalizedTicket>>;
  getTicket(externalId: string): Promise<NormalizedTicket>;
  createTicket(ticket: CreateTicketPayload): Promise<NormalizedTicket>;
  updateTicket(externalId: string, updates: UpdateTicketPayload): Promise<NormalizedTicket>;

  // Time Entries
  listTimeEntries(filters?: TimeEntryFilters): Promise<PaginatedResult<NormalizedTimeEntry>>;
  createTimeEntry(entry: CreateTimeEntryPayload): Promise<NormalizedTimeEntry>;

  // Contracts
  listContracts(filters?: ContractFilters): Promise<PaginatedResult<NormalizedContract>>;
  getContract(externalId: string): Promise<NormalizedContract>;
}
```

### 4.3 ISecurityConnector (extends IBaseConnector)

```typescript
interface ISecurityConnector extends IBaseConnector {
  type: 'security';

  // Posture
  getPostureScore(clientId: string): Promise<PostureScore>;
  getPostureDetails(clientId: string): Promise<PostureDetail[]>;

  // Threats
  listThreats(filters?: ThreatFilters): Promise<PaginatedResult<NormalizedThreat>>;
  getThreat(externalId: string): Promise<NormalizedThreat>;
  acknowledgeThreat(externalId: string): Promise<void>;
  remediateThreat(externalId: string, action: RemediationAction): Promise<RemediationResult>;

  // Compliance
  getComplianceStatus(clientId: string, framework?: string): Promise<ComplianceStatus>;

  // Scanning
  triggerScan(clientId: string, scanType: ScanType): Promise<ScanJob>;
  getScanResults(jobId: string): Promise<ScanResult>;
}
```

## 5. Normalized Data Models

All connectors map platform-specific data to normalized Cavaridge models. This ensures consuming apps never depend on platform-specific schemas.

### NormalizedDevice
```typescript
interface NormalizedDevice {
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
  rawData: Record<string, unknown>; // Original platform data for debugging
}
```

### NormalizedAlert
```typescript
interface NormalizedAlert {
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
```

### NormalizedThreat
```typescript
interface NormalizedThreat {
  externalId: string;
  connectorId: string;
  threatType: 'malware' | 'phishing' | 'ransomware' | 'identity' | 'data_leak' | 'vulnerability' | 'policy_violation' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'contained' | 'remediated' | 'false_positive';
  title: string;
  description: string;
  affectedEntities: AffectedEntity[];
  detectedAt: Date;
  recommendedActions: string[];
  rawData: Record<string, unknown>;
}
```

### PostureScore
```typescript
interface PostureScore {
  connectorId: string;
  clientExternalId: string;
  overallScore: number;   // 0-100
  gradeLabel: string;     // A, B, C, D, F
  categories: PostureCategory[];
  lastAssessedAt: Date;
  rawData: Record<string, unknown>;
}

interface PostureCategory {
  name: string;           // e.g., "Identity", "Email", "Endpoint", "Cloud"
  score: number;          // 0-100
  issueCount: number;
  criticalCount: number;
}
```

## 6. Connector Registry

The connector registry is a runtime service that manages all active connector instances for a tenant.

```typescript
class ConnectorRegistry {
  // Registration
  register(connector: IBaseConnector): void;
  unregister(connectorId: string): void;

  // Discovery
  getConnector<T extends IBaseConnector>(id: string): T | null;
  getConnectorsByType(type: ConnectorType): IBaseConnector[];
  getAllConnectors(): IBaseConnector[];

  // Health
  getHealth(): Map<string, ConnectorHealth>;
  getHealthForConnector(id: string): ConnectorHealth | null;

  // Tenant scoping
  getRegistryForTenant(tenantId: string): TenantConnectorRegistry;
}
```

## 7. Sync Engine

The sync engine orchestrates data synchronization between external platforms and Cavaridge:

- **Full sync:** Pulls all records from the external platform, diffs against local state, and upserts. Runs daily or on-demand.
- **Incremental sync:** Uses a cursor (timestamp, offset, or token) to pull only changed records since the last sync. Runs every 5 minutes via BullMQ.
- **Webhook sync:** Processes real-time push events from external platforms. Runs instantly on webhook receipt.

### Sync Queue Definitions

| Queue | Schedule | Description |
|-------|----------|-------------|
| `connector:full-sync:{connectorId}` | Daily at tenant-configured time | Full data pull and reconciliation |
| `connector:incremental-sync:{connectorId}` | Every 5 minutes | Delta changes since last cursor |
| `connector:webhook-process` | On webhook receipt | Process real-time platform events |
| `connector:health-check` | Every 2 minutes | Check all connector health metrics |

### Sync Logging

Every sync operation is logged to the `connector_sync_logs` table:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| tenant_id | uuid | FK tenants |
| connector_id | text | e.g., 'ninjaone' |
| sync_type | enum | full, incremental, webhook |
| entity_type | text | e.g., 'devices', 'alerts', 'tickets' |
| status | enum | started, completed, failed, partial |
| records_processed | integer | |
| records_created | integer | |
| records_updated | integer | |
| records_deleted | integer | |
| errors | jsonb | Array of error objects |
| cursor_before | text | Sync cursor at start |
| cursor_after | text | Sync cursor at end |
| duration_ms | integer | |
| started_at | timestamptz | |
| completed_at | timestamptz | |

## 8. Credential Management

Connector credentials are managed per-tenant and stored securely:

- **Development:** Encrypted in Supabase `connector_configs.credentials_encrypted` column (AES-256-GCM, key from env)
- **Staging/Production:** Stored in Doppler under `CONNECTOR_{ID}_{TENANT_ID}_CREDENTIALS`
- **OAuth flows:** Handled by `connector-core/auth` module with callback URLs routed through CVG-CORE

### connector_configs Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| tenant_id | uuid | FK tenants |
| connector_id | text | e.g., 'ninjaone' |
| status | enum | unconfigured, configuring, connected, active, error, disabled |
| config | jsonb | Non-sensitive config (base URL, sync interval, entity mappings) |
| credentials_encrypted | text | Encrypted OAuth tokens / API keys (dev only) |
| last_health_check | timestamptz | |
| health_status | enum | healthy, degraded, unhealthy, unknown |
| health_details | jsonb | Latest health check metrics |
| enabled | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**UNIQUE constraint:** (tenant_id, connector_id) — one config per connector per tenant.

## 9. Platform-Specific Notes

### NinjaOne
- **Auth:** OAuth 2.0 Authorization Code (client_id, client_secret, redirect_uri)
- **Base URL:** `https://app.ninjarmm.com/v2` (varies by region: EU, OC)
- **Rate limits:** 100 requests/minute (with burst allowance)
- **Webhooks:** Supported via webhook channel configuration. HMAC-SHA256 signature validation.
- **Key entities:** Organizations, Devices, Alerts, Activities, Patch Status, Software Inventory
- **Cursor strategy:** `lastModified` timestamp on devices; activity ID for alerts

### HaloPSA
- **Auth:** OAuth 2.0 Client Credentials or Authorization Code
- **Base URL:** `https://{tenant}.halopsa.com/api` (cloud) or self-hosted
- **Rate limits:** Configurable per instance
- **Webhooks:** Supported via automation rules (HTTP POST actions)
- **Key entities:** Tickets, Actions (comments), Clients, Contracts, Timesheets, Invoices, Assets
- **Cursor strategy:** `lastUpdate` datetime filter

### Guardz
- **Auth:** API key (limited availability) or partner integration program
- **Base URL:** TBD — partner API access requires enrollment
- **Rate limits:** TBD
- **Webhooks:** Real-time alerts supported via notification configuration
- **Key entities:** Clients, Users, Issues (threats), Posture Scores, Scan Results, Training Status
- **Cursor strategy:** TBD — pending API access
- **Note:** Public API not yet generally available. Initial implementation may use webhook-only ingestion or partner API program. Validate with Guardz partner team before development.

### Atera
- **Auth:** API key (header-based)
- **Base URL:** `https://app.atera.com/api/v3`
- **Rate limits:** 500 requests per 5 minutes
- **Webhooks:** Limited — polling-based sync recommended
- **Key entities:** Customers, Agents, Alerts, Tickets, Knowledge Base
- **Cursor strategy:** Modified date range queries

### Syncro
- **Auth:** API key (header-based)
- **Base URL:** `https://{subdomain}.syncromsp.com/api/v1`
- **Rate limits:** 180 requests per minute
- **Webhooks:** Supported via notification center
- **Key entities:** Customers, Assets, Tickets, Invoices, Estimates, Leads
- **Cursor strategy:** `updated_at` parameter
