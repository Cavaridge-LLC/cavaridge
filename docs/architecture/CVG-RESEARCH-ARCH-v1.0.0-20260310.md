# CVG-RESEARCH (Project Ducky) — Architecture Specification

**Document:** `CVG-RESEARCH-ARCH-v1.0.0-20260310`
**Codename:** Project Ducky
**Author:** Benjamin Posner, Cavaridge LLC
**Status:** APPROVED
**Supersedes:** N/A

---

## 1. Overview

Project Ducky is the flagship intelligence and research platform for the Cavaridge portfolio. It is a multitenant, user-facing application available on web (React), iOS, and Android (Expo/React Native). Ducky serves two roles: it is the primary user-facing research and reasoning interface, and it is the API gateway through which all other Cavaridge apps access AI reasoning and multi-source intelligence. Ducky is the sole consumer of Project Spaniel's (CVG-AI) API.

---

## 2. Position in Platform Architecture
```
Users (Web / iOS / Android)
         ↓
Other Cavaridge Apps (Meridian, Caelum, Midas, Vespar, Astra, HIPAA, Ceres)
         ↓
  Project Ducky API (CVG-RESEARCH)
         ↓
  Project Spaniel API (CVG-AI)
         ↓
     OpenRouter
         ↓
  Claude / ChatGPT / Gemini / Others
```

---

## 3. System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER ONE: USER INTERFACES                                      │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│ │   Web App    │  │  iOS App     │  │ Android App  │           │
│ │  (React)     │  │  (Expo/RN)   │  │  (Expo/RN)   │           │
│ └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│        └─────────────────┼─────────────────┘                    │
│                          │                                      │
│  Other Apps: Meridian, Caelum, Midas, Vespar, Astra,           │
│  HIPAA, Ceres (all consume Ducky API)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ LAYER TWO: PROJECT DUCKY (API Gateway + Core Backend)           │
│                                                                  │
│  Auth & RBAC Middleware → Request Router                        │
│         ↓                      ↓                    ↓           │
│  Conversation Engine   Connector Orchestrator  Context Optimizer│
│         ↓                      ↓                    ↓           │
│              Error & Fallback Handler                           │
│                      ↓                                          │
│               Audit Logger                                      │
└──────────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ LAYER THREE: PROJECT SPANIEL (CVG-AI)                           │
│  Task Detection → Model Routing → Consensus Engine → OpenRouter │
└──────────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ LAYER FOUR: DATA CONNECTORS                                     │
│  GitHub · GitLab · Jira · Slack · Notion                       │
│  Salesforce · HubSpot · Google Workspace · Microsoft 365 · Stripe│
└──────────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ LAYER FIVE: DATA PERSISTENCE                                    │
│  PostgreSQL via Supabase (RLS enforced on all tables)           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Backend Modules

### 4.1 Authentication & RBAC Middleware

Every request hits this first. Validates Supabase Auth token, extracts tenant context and user ID, enforces RBAC role checks, applies row-level security. Uses `@cavaridge/auth` and `@cavaridge/security` packages. No business logic executes without passing this layer.

### 4.2 Request Router

Routes validated requests to the appropriate backend module. Handles request schema validation. Coordinates between Conversation Engine, Connector Orchestrator, Context Optimizer, and Spaniel API calls.

### 4.3 Conversation Engine

Manages conversation threads, message history, and context branching. Creates conversation trees with parent-child thread relationships. Handles automatic branch detection via semantic similarity scoring (default threshold: 0.65). Handles manual branch creation. Stores full conversation state with audit trail in PostgreSQL.

### 4.4 Connector Orchestrator

Manages the ten data source connectors. Decides which connectors to activate based on query context. Retrieves encrypted credentials from Supabase Vault. Authenticates against external APIs. Returns normalized data objects to Context Optimizer regardless of source. Handles rate limiting, retries, and error states per connector.

### 4.5 Context Optimizer

Prepares the final payload for Spaniel. Pipeline:

1. **Gather** — collect conversation history and connector data
2. **Tokenize** — estimate token count per chunk against target model
3. **Rank** — semantic similarity score against user query
4. **Budget** — calculate available token budget
5. **Select** — pick top 3–4 ranked chunks within budget
6. **Compress** — deduplicate, remove redundancy, summarize lengthy chunks
7. **Package** — build final payload matching Spaniel `/reason` schema
8. **Verify (post-response)** — cross-check model claims against source connector data, flag unsupported claims as `unverified`

### 4.6 Error & Fallback Handler

Handles connector failures, Spaniel errors, and non-recoverable states. Implements retry logic for transient failures. Escalates non-recoverable errors to frontend with user-friendly messaging.

### 4.7 Audit Logger

Logs every request using `@cavaridge/audit` package. Captures: user, tenant, connectors accessed, models used via Spaniel, tokens consumed, cost, timestamp, and outcome. Required for compliance.

---

## 5. Base URL

`https://ducky.cavaridge.com/api/v1`

---

## 6. Authentication

Supabase Auth bearer tokens via `@cavaridge/auth`. Tenant context extracted from token claims. RBAC enforced at middleware layer before any business logic executes.

---

## 7. Conversation Endpoints

### POST /conversations

Creates a new conversation thread.

**Request:**
```json
{
  "title": "string (optional, auto-generated if null)",
  "initial_message": "string"
}
```

**Response:**
```json
{
  "conversation_id": "uuid",
  "thread_id": "uuid",
  "title": "string",
  "created_at": "ISO8601",
  "status": "active"
}
```

---

### POST /conversations/:conversation_id/messages

Sends a message. Triggers connector orchestration, context optimization, Spaniel reasoning, and source verification.

**Request:**
```json
{
  "content": "string",
  "attachments": [
    {
      "source": "github | salesforce | ...",
      "reference_id": "string",
      "content_type": "string"
    }
  ],
  "options": {
    "connectors": ["github", "salesforce"],
    "require_consensus": true,
    "branch_from_message_id": "uuid (optional)"
  }
}
```

**Response:**
```json
{
  "message_id": "uuid",
  "thread_id": "uuid",
  "conversation_id": "uuid",
  "content": "string",
  "sources_cited": [
    {
      "connector": "github",
      "reference": "repo/file#L42",
      "verification_status": "verified | unverified | divergent"
    }
  ],
  "consensus": {
    "aligned": true,
    "confidence_score": 0.97
  },
  "branch_created": false,
  "tokens_consumed": 5700,
  "cost": 0.0342,
  "timestamp": "ISO8601"
}
```

---

### GET /conversations

Lists conversations for authenticated user within their tenant.

### GET /conversations/:conversation_id

Returns full conversation tree including all branches and messages.

### POST /conversations/:conversation_id/branch

Manually creates a branch from a specific message.

**Request:**
```json
{
  "from_message_id": "uuid",
  "branch_title": "string (optional)"
}
```

### DELETE /conversations/:conversation_id

Soft delete. Marks as archived. Data retained per audit requirements.

---

## 8. Connector Endpoints

### GET /connectors

Lists available connectors and status for the authenticated user's tenant.

**Response:**
```json
{
  "connectors": [
    {
      "id": "github",
      "name": "GitHub",
      "status": "connected | disconnected | error",
      "access_level": "org | user",
      "enabled_by_admin": true,
      "user_connected": true,
      "last_sync": "ISO8601"
    }
  ]
}
```

### POST /connectors/:connector_id/connect

Initiates OAuth or API key connection.

**Request:**
```json
{
  "access_level": "org | user",
  "credentials": {
    "type": "oauth | api_key",
    "value": "string (encrypted in transit)"
  }
}
```

### DELETE /connectors/:connector_id/disconnect

Removes stored credentials and disconnects connector.

### GET /connectors/:connector_id/data

Fetches data from a connector. Available for user-initiated pulls.

**Request params:** `query`, `data_type`, `limit`, `offset`

---

## 9. Admin Endpoints

### GET /admin/tenants/:tenant_id/usage

Aggregated usage, cost, and audit data. Requires Tenant Admin or higher.

### POST /admin/connectors/:connector_id/enable

Enables connector at org level. Requires Tenant Admin. Once enabled, users can self-connect.

### POST /admin/connectors/:connector_id/disable

Disables connector at org level. Disconnects all user connections. Requires Tenant Admin.

---

## 10. External App Endpoints

### POST /apps/reason

Simplified reasoning endpoint consumed by all other Cavaridge apps.

**Request:**
```json
{
  "app_code": "CVG-MER",
  "query": "string",
  "context": {
    "app_specific_data": {},
    "connectors_requested": ["salesforce", "github"]
  },
  "options": {
    "require_consensus": true,
    "max_tokens_response": 4096
  }
}
```

**Response:**
```json
{
  "request_id": "uuid",
  "content": "string",
  "sources_cited": [],
  "consensus": {
    "aligned": true,
    "confidence_score": 0.95
  },
  "reliability_warning": false,
  "tokens_consumed": 3200,
  "cost": 0.0218
}
```

---

## 11. Database Schemas

### ducky.conversations

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| tenant_id | UUID NOT NULL | RLS enforced |
| user_id | UUID NOT NULL | |
| title | TEXT | |
| status | TEXT | active, archived, deleted |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | |

### ducky.threads

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| conversation_id | UUID | FK ducky.conversations |
| parent_thread_id | UUID | FK ducky.threads, null for root |
| branch_title | TEXT | |
| branch_trigger | TEXT | auto_detected, manual, system |
| created_at | TIMESTAMP | DEFAULT NOW() |

### ducky.messages

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| thread_id | UUID | FK ducky.threads |
| conversation_id | UUID | FK ducky.conversations |
| tenant_id | UUID NOT NULL | RLS enforced |
| user_id | UUID NOT NULL | |
| role | TEXT NOT NULL | user, assistant, system |
| content | TEXT NOT NULL | |
| sources_cited | JSONB | |
| consensus | JSONB | |
| tokens_consumed | INTEGER | |
| cost_usd | DECIMAL(10,6) | |
| created_at | TIMESTAMP | DEFAULT NOW() |

### ducky.connector_credentials

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| tenant_id | UUID NOT NULL | RLS enforced |
| user_id | UUID | null for org-level |
| connector_id | TEXT NOT NULL | |
| access_level | TEXT NOT NULL | org, user |
| credential_type | TEXT NOT NULL | oauth, api_key |
| encrypted_value | TEXT NOT NULL | AES-256 |
| status | TEXT | DEFAULT active |
| created_at | TIMESTAMP | DEFAULT NOW() |
| expires_at | TIMESTAMP | |

### ducky.connector_config

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| tenant_id | UUID NOT NULL | RLS enforced |
| connector_id | TEXT NOT NULL | |
| enabled | BOOLEAN | DEFAULT false |
| enabled_by | UUID | FK auth.users |
| enabled_at | TIMESTAMP | |
| settings | JSONB | |

### ducky.audit_log

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PRIMARY KEY |
| tenant_id | UUID NOT NULL | RLS enforced |
| user_id | UUID NOT NULL | |
| action | TEXT NOT NULL | |
| resource_type | TEXT NOT NULL | |
| resource_id | UUID | |
| metadata | JSONB | |
| ip_address | INET | |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

## 12. Connector Framework

### Interface
```typescript
interface Connector {
  id: string;
  name: string;
  authType: 'oauth' | 'api_key';
  accessLevels: ('org' | 'user')[];

  connect(credentials: EncryptedCredentials): Promise<ConnectionResult>;
  disconnect(tenantId: string, userId?: string): Promise<void>;
  fetchData(query: ConnectorQuery): Promise<NormalizedData[]>;
  healthCheck(): Promise<ConnectorHealth>;
  getRateLimitStatus(): Promise<RateLimitInfo>;
}
```

### Normalized Output
```typescript
interface NormalizedData {
  source: string;
  data_type: string;
  title: string;
  content: string;
  url: string;
  metadata: Record<string, unknown>;
  fetched_at: string;
  relevance_score?: number;
  token_count?: number;
}
```

### Adding a New Connector

1. Create `apps/ducky/src/connectors/[name].ts`
2. Implement `Connector` interface
3. Register in `apps/ducky/src/connectors/registry.ts`
4. Add database migration for connector-specific config
5. Add admin UI toggle in frontend
6. No changes to core orchestration logic required

### Initial Ten Connectors

| Connector | Auth Type | Access Levels | Data Types |
|-----------|-----------|---------------|------------|
| GitHub | OAuth | org, user | repos, issues, PRs, code, commits |
| GitLab | OAuth | org, user | projects, issues, MRs, code, pipelines |
| Jira | OAuth | org | issues, boards, sprints, epics |
| Slack | OAuth | org | messages, channels, threads, files |
| Notion | OAuth | org, user | pages, databases, blocks |
| Salesforce | OAuth | org | contacts, opportunities, accounts, reports |
| HubSpot | OAuth | org | contacts, deals, companies, tickets |
| Google Workspace | OAuth | org, user | drive files, docs, sheets, calendar |
| Microsoft 365 | OAuth | org, user | OneDrive, SharePoint, Outlook, Teams |
| Stripe | API Key | org | customers, invoices, subscriptions, payments |

---

## 13. Conversation Branching Logic

### Automatic Detection

Ducky monitors each message for topic divergence using semantic similarity scoring against the current thread's topic vector. When similarity drops below 0.65 (configurable), Ducky creates a new labeled sub-thread from the branch point. Original thread remains unchanged and accessible.

### Manual Branch

Via `POST /conversations/:id/branch` from any message. User-provided or auto-generated title.

### Branch Navigation

Frontend renders conversations as a tree. Users navigate between branches, view full tree structure, and optionally merge branches if topics reconverge.

---

## 14. Fallback Matrix

| Scenario | Action | User Notification |
|----------|--------|-------------------|
| Connector timeout | Skip connector, reason without it | "Unable to access [source] — reasoning without it" |
| Connector auth expired | Prompt re-authentication | "Your [source] connection needs reauthorization" |
| All connectors fail | Reason from conversation context only | "External sources unavailable — using conversation context" |
| Spaniel returns reliability_warning | Surface to user | "Results may include areas of uncertainty" |
| Spaniel returns error | Surface to user | "Capacity constraints — try again shortly" |

---

## 15. Security Architecture

### Tenant Isolation

Enforced at all layers: database (RLS), API (middleware), UI (conditional rendering), and in every Spaniel request via `tenant_id`. No cross-tenant data access is architecturally possible.

### Credential Storage

Connector credentials encrypted at rest using AES-256. Keys managed via Supabase Vault. No plaintext credentials stored. OAuth tokens auto-refreshed before expiration.

### Rate Limiting

Per-tenant rate limits enforced at API Gateway layer. Default: 1000 requests/hour (User), 5000/hour (Tenant Admin). Platform Owner can override.

---

## 16. Deployment

| Service | Railway Project | Auto-Deploy Branch |
|---------|-----------------|-------------------|
| Ducky Backend | cavaridge-ducky-api | main |
| Ducky Frontend (Web) | cavaridge-ducky-web | main |

Mobile: iOS and Android via Expo EAS Build. Distributed through Apple App Store and Google Play Store. OTA updates via Expo Updates for non-native changes.

Secrets managed via Doppler synced to Railway environment variables. No plaintext keys in repo. `.env` gitignored.

---

## 17. CLAUDE.md Updates Required

1. Add CVG-AI and CVG-RESEARCH to app registry
2. Update hosting from Vercel to Railway throughout
3. Update LLM Access section: "All LLM calls route through Project Spaniel (CVG-AI). Project Ducky (CVG-RESEARCH) is the sole consumer of Spaniel's API. All other apps consume Ducky's reasoning endpoints via POST /apps/reason."
4. Add @cavaridge/security and @cavaridge/audit to shared packages list
5. Add Spaniel service token rotation to secrets management section

---

## 18. Open Items

1. Confirm Supabase Auth deep linking for OAuth callback on iOS and Android via Expo
2. Register Cavaridge OAuth apps with each connector provider (GitHub, Salesforce, HubSpot, Google, Microsoft, Jira, Slack, Notion, GitLab)
3. Tune branch detection threshold (0.65) against real-world usage
4. Define cost alerting thresholds for tenants
5. Define offline/degraded mode behavior for mobile clients