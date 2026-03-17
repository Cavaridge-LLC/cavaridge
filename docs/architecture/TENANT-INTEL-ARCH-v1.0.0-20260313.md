# @cavaridge/tenant-intel — Architecture Specification

**Version:** 1.0.0  
**Date:** 2026-03-13  
**Author:** Benjamin Posner  
**Status:** DRAFT  
**IP Owner:** Cavaridge, LLC (D-U-N-S: 138750552)

---

## 1. Purpose

`@cavaridge/tenant-intel` is a shared monorepo package that provides unified tenant data ingestion, normalization, and intelligence for Microsoft 365 and Google Workspace environments. It is not a standalone application — it is foundational infrastructure consumed by any Cavaridge application that requires tenant awareness.

### 1.1 Problem Statement

Multiple Cavaridge applications require visibility into client tenant environments:

- **CVG-MER (Meridian):** Point-in-time environment assessment for M&A due diligence
- **CVG-MIDAS (Midas):** Ongoing IT roadmap generation and QBR data
- **CVG-ASTRA (Astra):** License optimization analysis
- **CVG-HIPAA:** Compliance posture evaluation
- **CVG-RESEARCH (Ducky):** Conversational queries against tenant state

Without a shared layer, each application would implement its own connector logic, normalization, and caching — duplicating effort and creating inconsistency.

### 1.2 Design Principle

**Ingest once, serve many.** All tenant data flows through `tenant-intel`. Applications consume normalized, queryable data — they never call Microsoft Graph or Google Workspace APIs directly for tenant intelligence.

---

## 2. Scope

### 2.1 In Scope

- Microsoft 365 tenant data ingestion via Microsoft Graph API
- Google Workspace tenant data ingestion via Admin SDK + Workspace APIs
- Data normalization into a vendor-neutral schema
- Tenant state snapshots and change tracking (delta detection)
- Vectorized storage for semantic queries (pgvector/Supabase)
- Structured storage for relational queries (Drizzle ORM/Supabase)
- Row-level security (RLS) enforced per tenant
- Shared agent interfaces for the platform agent stack
- Rate limiting, retry logic, and Graph API pagination handling

### 2.2 Out of Scope

- Application-specific business logic (stays in consuming apps)
- UI/UX (consuming apps own their own presentation)
- Email/document content ingestion (Phase 2+ — compliance implications; see §7)
- Direct end-user API exposure (apps proxy through their own APIs)

---

## 3. Architecture

### 3.1 Package Location

```
packages/
  tenant-intel/
    src/
      connectors/
        microsoft/
          graph-client.ts        # Authenticated Graph SDK wrapper
          users.ts               # User/license enumeration
          mail-activity.ts       # Mail flow metadata (not content)
          calendar-activity.ts   # Meeting density & patterns
          sharepoint.ts          # Site/library structure & usage
          teams.ts               # Teams/channel activity metrics
          security.ts            # Secure Score, alerts, CA policies
          devices.ts             # Intune/device compliance
          applications.ts        # App registrations & enterprise apps
          licensing.ts           # SKU assignment & utilization
        google/
          workspace-client.ts    # Authenticated Admin SDK wrapper
          users.ts
          drive-activity.ts
          calendar-activity.ts
          security.ts            # Security health, 2SV status
          licensing.ts
          chrome.ts              # Chrome device/browser management
        shared/
          types.ts               # Vendor-neutral normalized types
          normalizer.ts          # M365/GWS → neutral schema transforms
      storage/
        schema.ts                # Drizzle schema definitions
        vector-store.ts          # pgvector embedding storage
        snapshot.ts              # Point-in-time state capture
        delta.ts                 # Change detection between snapshots
      agents/
        tenant-graph-agent.ts    # Utilization & collaboration patterns
        usage-pattern-agent.ts   # Activity trend analysis
        config-drift-agent.ts    # Detects config changes between snapshots
      pipeline/
        ingest.ts                # Orchestrates full tenant ingestion
        scheduler.ts             # BullMQ job definitions for recurring ingestion
        incremental.ts           # Delta/webhook-driven partial updates
      index.ts                   # Public API surface
    package.json
    tsconfig.json
    README.md
```

### 3.2 Data Flow

```
┌──────────────────┐     ┌──────────────────┐
│  Microsoft Graph  │     │  Google Workspace │
│       API         │     │   Admin SDK       │
└────────┬─────────┘     └────────┬──────────┘
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────────┐
│            Connector Layer                   │
│  (auth, pagination, rate-limit, retry)       │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│           Normalizer                         │
│  (vendor-neutral schema transform)           │
└────────────────────┬────────────────────────┘
                     │
            ┌────────┴────────┐
            ▼                 ▼
┌───────────────────┐ ┌───────────────────────┐
│  Relational Store │ │   Vector Store         │
│  (Drizzle/Supa)   │ │   (pgvector/Supa)      │
│  - Structured     │ │   - Semantic queries   │
│  - Snapshots      │ │   - Agent consumption  │
│  - Deltas         │ │   - Ducky conversation │
└───────────────────┘ └───────────────────────┘
            │                 │
            └────────┬────────┘
                     │
    ┌────────────────┼────────────────────┐
    ▼                ▼                    ▼
┌────────┐    ┌──────────┐    ┌───────────────┐
│Meridian│    │  Midas   │    │ Astra / HIPAA │
│(M&A)   │    │(QBR/Road)│    │ / Ducky / ... │
└────────┘    └──────────┘    └───────────────┘
```

### 3.3 Vendor-Neutral Schema

All connector data normalizes to a shared type system. Consuming applications never deal with Graph-specific or Google-specific shapes.

```typescript
// Core normalized types (illustrative, not exhaustive)

interface TenantUser {
  id: string;
  tenantId: string;
  sourceVendor: 'microsoft' | 'google';
  sourceId: string;              // Graph userId or Google directoryId
  displayName: string;
  email: string;
  department?: string;
  jobTitle?: string;
  accountEnabled: boolean;
  licenses: NormalizedLicense[];
  lastSignIn?: Date;
  mfaEnabled: boolean;
  mfaMethod?: string;            // 'entra-native' | 'duo' | 'okta' | etc.
  createdAt: Date;
  updatedAt: Date;
}

interface NormalizedLicense {
  skuName: string;               // e.g., 'Microsoft 365 Business Premium'
  skuId: string;
  assignedDate: Date;
  lastActiveDate?: Date;         // From usage reports
  utilizationScore: number;      // 0-100 based on service usage
  services: ServiceUtilization[];
}

interface ServiceUtilization {
  serviceName: string;           // e.g., 'Exchange', 'SharePoint', 'Teams'
  isProvisioned: boolean;
  lastActivityDate?: Date;
  activityMetrics: Record<string, number>;  // Service-specific counters
}

interface SecurityPosture {
  tenantId: string;
  sourceVendor: 'microsoft' | 'google';
  nativeScore: number;           // Raw score from vendor
  maxPossibleScore: number;
  controls: SecurityControl[];
  capturedAt: Date;
}

interface SecurityControl {
  controlId: string;             // Vendor control identifier
  controlName: string;
  category: string;              // 'Identity' | 'Data' | 'Device' | 'App' | 'Infrastructure'
  nativeStatus: 'implemented' | 'partial' | 'not_implemented' | 'not_applicable';
  pointsAchieved: number;
  maxPoints: number;
  vendorRecommendation: string;
  compensatingControl?: CompensatingControl;  // Populated by Midas scoring module
}

interface TenantSnapshot {
  id: string;
  tenantId: string;
  capturedAt: Date;
  trigger: 'scheduled' | 'manual' | 'webhook' | 'assessment';
  userCount: number;
  licenseCount: number;
  securityScore: number;
  dataHash: string;              // For fast delta comparison
}
```

### 3.4 Authentication & Consent

**Microsoft 365:**
- OAuth 2.0 client credentials flow (app-only) for tenant-wide reads
- Required Graph permissions (application-level):
  - `User.Read.All`, `Organization.Read.All`
  - `Reports.Read.All` (usage analytics)
  - `SecurityEvents.Read.All`, `SecurityActions.Read.All`
  - `DeviceManagementManagedDevices.Read.All` (Intune)
  - `Directory.Read.All`
  - `Sites.Read.All` (SharePoint)
  - `TeamSettings.Read.All`
  - `Policy.Read.All` (Conditional Access)
- App registration managed per MSP tenant (multi-tenant app or per-client registrations)

**Google Workspace:**
- Service account with domain-wide delegation
- Required OAuth scopes:
  - `admin.directory.user.readonly`
  - `admin.directory.device.chromeos.readonly`
  - `admin.reports.audit.readonly`
  - `admin.reports.usage.readonly`

**Credential storage:** All OAuth tokens and service account keys stored in Doppler (staging/prod). Never in env files or repo.

### 3.5 Tenant Isolation

Consistent with the universal Cavaridge build standard:

- **Database:** Supabase RLS policies enforce `tenant_id` filtering on every table
- **API middleware:** `tenant-intel` export functions always require `tenantId` parameter; no global queries permitted
- **Agent context:** Every agent invocation receives `tenantId` in its context; agent-core validates before execution
- **Snapshot isolation:** Snapshots are scoped to a single tenant; cross-tenant analysis is never supported

---

## 4. Ingestion Pipeline

### 4.1 Full Ingestion

A complete tenant scan executed on first onboarding and periodically thereafter (configurable, default weekly).

**Pipeline steps:**
1. Authenticate to tenant (Graph/Workspace)
2. Enumerate users and group memberships
3. Pull license assignment and usage reports
4. Pull security score and control profiles
5. Pull device compliance state
6. Pull SharePoint/Drive site structure and activity
7. Pull Teams/Chat activity metadata
8. Pull Conditional Access / security policies
9. Normalize all data to vendor-neutral schema
10. Store in relational tables (Drizzle)
11. Generate embeddings and store in pgvector
12. Capture snapshot record with data hash
13. Run delta detection against previous snapshot
14. Emit events for consuming applications (changed controls, new users, license changes)

**Orchestration:** BullMQ job queue with Redis. Each tenant ingestion is a single job with sub-tasks. Failed sub-tasks retry independently without restarting the full pipeline.

### 4.2 Incremental Updates

For tenants where webhook subscriptions are available (Graph change notifications), `tenant-intel` supports partial updates:

- User created/modified/deleted
- License assignment changes
- Security alert triggers
- Device compliance state changes

Incremental updates patch the existing relational state and re-embed affected records.

### 4.3 Rate Limiting

Microsoft Graph enforces per-tenant and per-app throttling. `tenant-intel` implements:

- Exponential backoff with jitter on 429 responses
- Request batching ($batch endpoint) for bulk reads
- Concurrent request caps per tenant (configurable, default 4)
- Usage report data cached for 24h (reports are themselves delayed by 24-48h)

---

## 5. Agent Integration

### 5.1 New Agents

`tenant-intel` introduces agents that join the shared platform agent pool:

| Agent | Purpose | Primary Consumers |
|-------|---------|-------------------|
| **TenantGraph** | Maps user collaboration patterns, identifies silos, measures cross-department interaction | Midas (roadmap), Ducky (queries) |
| **UsagePattern** | Detects underutilized services, license waste, adoption trends | Astra (license), Midas (QBR) |
| **ConfigDrift** | Compares snapshots, flags security/config regressions, detects unauthorized changes | HIPAA, Midas (security), Meridian |

### 5.2 Existing Agent Consumption

Existing shared agents gain tenant awareness:

- **DataExtract:** Can now pull structured data from tenant-intel store instead of requiring document uploads
- **CostAnalysis:** License utilization data feeds directly into cost modeling
- **Compliance:** Security posture data feeds HIPAA gap analysis
- **RiskScore:** Tenant security metrics become risk scoring inputs for Meridian

### 5.3 Ducky Integration

Ducky (CVG-RESEARCH) is the primary conversational interface to tenant-intel data. Example queries the pipeline enables:

- "What changed in the Acme Corp tenant since last month?"
- "Which users have a Business Premium license but haven't used Teams in 90 days?"
- "Show me the security posture trend for this client over the last 6 months."
- "What would happen to the security score if we disabled legacy authentication?"

All queries route through Ducky → Spaniel → appropriate agent → tenant-intel store.

---

## 6. Consuming Application Interfaces

### 6.1 Public API Surface

```typescript
// packages/tenant-intel/src/index.ts (illustrative)

// Ingestion
export function ingestTenant(tenantId: string, options?: IngestOptions): Promise<IngestResult>;
export function scheduleIngestion(tenantId: string, cron: string): Promise<void>;

// Queries
export function getUsers(tenantId: string, filters?: UserFilter): Promise<TenantUser[]>;
export function getLicenseUtilization(tenantId: string): Promise<LicenseUtilizationReport>;
export function getSecurityPosture(tenantId: string): Promise<SecurityPosture>;
export function getActivityMetrics(tenantId: string, period: DateRange): Promise<ActivityReport>;

// Snapshots & Deltas
export function getLatestSnapshot(tenantId: string): Promise<TenantSnapshot>;
export function getSnapshotDelta(tenantId: string, fromId: string, toId: string): Promise<DeltaReport>;
export function compareSnapshots(snapshotIds: string[]): Promise<ComparisonReport>;

// Vector/Semantic
export function queryTenantContext(tenantId: string, query: string): Promise<EmbeddingResult[]>;

// Security (consumed by Midas scoring module)
export function getSecurityControls(tenantId: string): Promise<SecurityControl[]>;
export function getNativeSecurityScore(tenantId: string): Promise<SecurityScoreDetail>;
```

### 6.2 Consumption Patterns by App

| Application | Primary Data Consumed | Cadence |
|-------------|----------------------|---------|
| **Meridian** | Full snapshot, security posture, license state | On-demand (assessment trigger) |
| **Midas** | Security controls, utilization trends, deltas, adjusted score | Recurring (QBR prep) + on-demand |
| **Astra** | License utilization, user-service mapping | Recurring (weekly) |
| **HIPAA** | Security posture, CA policies, device compliance | On-demand (assessment) |
| **Ducky** | Vector store (semantic), any structured data via agents | Real-time (conversation) |

---

## 7. Content Ingestion — Phase 2 (Future)

Full content ingestion (email bodies, document contents, chat messages) is explicitly **deferred** to a future phase due to:

- **Compliance complexity:** HIPAA, SOC 2, and client data handling agreements must be in place before ingesting PII/PHI-adjacent content
- **Storage scale:** Content ingestion dramatically increases storage and embedding costs
- **Consent model:** Content access requires delegated (user-consented) permissions, not app-only; different auth flow entirely

Phase 1 (this spec) focuses on **metadata, configuration, usage analytics, and security posture** — none of which contain email/document content.

When Phase 2 is scoped, it will be a separate architecture addendum with its own compliance review.

---

## 8. Infrastructure

| Component | Service | Notes |
|-----------|---------|-------|
| Runtime | Railway (Express 5 / Node 20) | Shared with platform services |
| Database | Supabase (Postgres + pgvector) | RLS-enforced, shared Supabase project |
| Job Queue | BullMQ + Redis | Existing platform Redis instance |
| Secrets | Doppler | OAuth tokens, service account keys |
| Observability | Langfuse | Agent execution tracing |
| Source | github.com/Cavaridge-LLC/cavaridge | Monorepo package |

---

## 9. Build Order & Dependencies

`@cavaridge/tenant-intel` depends on:

- `@cavaridge/agent-core` (agent interfaces)
- `@cavaridge/agent-runtime` (execution environment)
- `@cavaridge/security` (auth helpers, token management)
- `@cavaridge/audit` (ingestion event logging)

**Build sequence within the approved order:**

1. ~~Spaniel (CVG-AI)~~ — prerequisite (LLM gateway)
2. ~~Ducky (CVG-RESEARCH)~~ — prerequisite (conversation state)
3. **`@cavaridge/tenant-intel`** — builds after security/audit packages, before Midas
4. **Midas (CVG-MIDAS)** — first full consumer (includes security scoring module)
5. Remaining apps gain tenant-intel integration incrementally

---

## 10. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | Per-client app registration vs. multi-tenant app for Graph API? | Auth architecture, onboarding flow |
| 2 | Snapshot retention policy — how many snapshots per tenant? | Storage cost |
| 3 | Should Astra be absorbed into Midas given the shared data layer, or remain standalone? | App registry, product positioning |
| 4 | Webhook subscription management — who owns renewal? | Operational burden |
| 5 | Google Workspace priority — is M365-first acceptable for MVP? | Build scope |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-13 | Benjamin Posner | Initial draft |
