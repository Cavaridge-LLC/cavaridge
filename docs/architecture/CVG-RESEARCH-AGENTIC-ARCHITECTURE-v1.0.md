# CVG-RESEARCH (Project Ducky) — Agentic Architecture Specification

**Version:** 1.0  
**Date:** 2026-03-12  
**Author:** Benjamin Posner, Principal & vCIO, Cavaridge LLC  
**Status:** Draft  
**Location:** `docs/architecture/CVG-RESEARCH-AGENTIC-ARCHITECTURE-v1.0.md`

---

## 1. Overview

Project Ducky (CVG-RESEARCH) evolves from a user-facing research and reasoning platform into a **fully agentic intelligence layer** for the Cavaridge portfolio. This specification defines the architecture for agentic capabilities layered on top of Ducky's existing foundation: 10 external data connectors, Spaniel (CVG-AI) LLM gateway integration, conversation management with auto-branching, and source-verified outputs.

### 1.1 Design Principles

- **User-in-the-loop by default.** Ducky suggests, the user approves, Ducky executes. No autonomous write/delete actions without explicit confirmation.
- **Stateless Spaniel contract preserved.** Ducky owns all agent state. Spaniel remains a stateless execution engine. No competing orchestration layers.
- **OpenRouter-exclusive LLM access.** All model calls route through Spaniel → OpenRouter under the Cavaridge LLC master key. No direct model calls from Ducky.
- **Multitenancy first.** Agent state, permissions, and action logs are tenant-scoped. No cross-tenant data leakage.
- **RBAC at every layer.** Agent capabilities are gated by user role, tenant config, and action type.

### 1.2 What Changes

| Capability | Current (v1) | Agentic (v2) |
|---|---|---|
| Data retrieval | User-initiated, single-source per query | Autonomous multi-source research plans |
| Context assembly | Pull from connectors, optimize, send to Spaniel | Iterative retrieval — results from source A inform queries to source B |
| Output | Answer with citations | Answer + suggested actions + executable tasks |
| Cross-app access | Other apps call Ducky API for reasoning | Other apps can request agentic workflows via Ducky API |
| Conversation model | Linear threads with auto-branching | Threads + task trees (research plans with parallel/sequential steps) |

---

## 2. Architecture

### 2.1 System Layers

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                         │
│              (Web / iOS / Android)                        │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Chat UI  │  │ Task Monitor │  │ Action Approval UI│  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                   AGENT LAYER (NEW)                       │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Planner  │  │  Executor    │  │ Action Engine     │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│        │              │                   │               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Approval Gateway                      │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                 EXISTING FOUNDATION                       │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │Connector │  │ Context      │  │ Conversation      │  │
│  │ Layer    │  │ Optimizer    │  │ Manager           │  │
│  │(10 srcs) │  │              │  │                   │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────┤
│               SPANIEL (CVG-AI)                           │
│         Stateless LLM Gateway → OpenRouter               │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Agent Layer Components

#### 2.2.1 Planner

The Planner receives a user query (or an API request from another Cavaridge app) and produces a **research plan** — a directed acyclic graph (DAG) of tasks.

**Responsibilities:**

- Analyze the user's intent and decompose it into discrete research/action steps
- Determine which connectors are needed and in what order
- Identify dependencies between steps (e.g., "search GitHub first, then use repo names to query Jira")
- Estimate complexity and flag if the plan exceeds a configurable step limit (default: 10 steps)
- Present the plan to the user for approval before execution (configurable — can be auto-approved for read-only plans per tenant config)

**Plan Schema:**

```typescript
interface ResearchPlan {
  id: string;
  tenantId: string;
  userId: string;
  query: string;                    // Original user query
  steps: PlanStep[];
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
  estimatedSteps: number;
  actualSteps: number;
  createdAt: string;                // ISO 8601
  approvedAt: string | null;
  completedAt: string | null;
}

interface PlanStep {
  id: string;
  planId: string;
  order: number;
  type: 'read' | 'reason' | 'write' | 'delete';
  connector: ConnectorType | 'spaniel';
  description: string;              // Human-readable description of what this step does
  dependsOn: string[];              // IDs of steps that must complete first
  input: Record<string, unknown>;   // Parameters for execution
  output: Record<string, unknown> | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  confidenceScore: number | null;   // 0-1, set after execution
  startedAt: string | null;
  completedAt: string | null;
}

type ConnectorType =
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'slack'
  | 'notion'
  | 'salesforce'
  | 'hubspot'
  | 'google_workspace'
  | 'microsoft_365'
  | 'stripe';
```

#### 2.2.2 Executor

The Executor takes an approved plan and runs it, managing parallelism, error handling, and iterative refinement.

**Responsibilities:**

- Execute plan steps in dependency order, parallelizing independent steps
- Pass outputs from completed steps as inputs to dependent steps
- Send reasoning tasks to Spaniel via the existing CVG-AI API
- Handle connector failures with configurable retry logic (max 3 retries per step, exponential backoff)
- Dynamically adjust the plan if intermediate results reveal the original plan is insufficient (e.g., add a step). Plan modifications require user approval if they add write/delete steps.
- Stream progress updates to the UI via WebSocket

**Execution Rules:**

- Maximum concurrent steps per plan: 5 (configurable per tenant)
- Step timeout: 30 seconds for connector calls, 60 seconds for Spaniel calls
- If a step fails after retries, mark it failed, skip dependent steps, and present partial results to the user with an explanation of what couldn't be completed
- All step inputs and outputs are logged to the audit trail (`@cavaridge/audit` package)

#### 2.2.3 Action Engine

The Action Engine handles **write operations** — actions that modify external systems on the user's behalf.

**Supported Actions (initial set):**

| Action | Connector | Permission Tier |
|---|---|---|
| Create GitHub issue | github | write |
| Create GitHub PR comment | github | write |
| Create Jira ticket | jira | write |
| Update Jira ticket status | jira | write |
| Send Slack message | slack | write |
| Create Notion page | notion | write |
| Create Google Doc | google_workspace | write |
| Draft email (Gmail/Outlook) | google_workspace / microsoft_365 | write |
| Update Salesforce record | salesforce | write |
| Create HubSpot contact/deal | hubspot | write |

**Action Execution Flow:**

```
User query → Planner identifies write steps → Plan presented to user
  → User approves plan → Executor runs read steps → Executor reaches write step
    → Action Engine generates preview of the action (draft message, ticket body, etc.)
      → Preview presented to user → User approves/edits → Action executed
        → Confirmation returned to user with link to created resource
```

Write actions always require two approvals: plan-level and action-level. This is non-negotiable and cannot be overridden by tenant config.

#### 2.2.4 Approval Gateway

Centralized approval logic that enforces the permission tier model.

**Permission Tiers:**

| Tier | Actions | Default Behavior | Configurable? |
|---|---|---|---|
| `read` | Query any connector, send to Spaniel | Auto-approve | Yes — tenant can require manual approval |
| `write` | Create/update external resources | Require user approval | No — always requires approval |
| `delete` | Delete/archive external resources | Require explicit confirmation with impact summary | No — always requires confirmation |

**Approval Persistence:**

- Approvals are logged with timestamp, user ID, action description, and outcome
- Approval logs are tenant-scoped and immutable (append-only)
- Stored via `@cavaridge/audit` package

---

## 3. Spaniel (CVG-AI) Enhancements

Spaniel does **not** become an agent. It remains stateless. The following enhancements support Ducky's agentic workflows:

### 3.1 Task Decomposition

When Ducky sends a complex reasoning request, Spaniel can decompose it into sub-tasks and route each to the optimal model.

```typescript
interface SpanielRequest {
  taskId: string;
  tenantId: string;
  type: 'simple' | 'decomposable';  // NEW: hints to Spaniel
  content: string;
  context: string;                    // Optimized context from Ducky
  constraints?: {
    maxModels?: number;               // Max models to use for decomposition
    preferredModels?: string[];       // Hint — Spaniel can override based on routing matrix
    maxLatencyMs?: number;            // Timeout for the full response
  };
}

interface SpanielResponse {
  taskId: string;
  result: string;
  confidenceScore: number;            // 0-1
  modelUsed: string[];                // Which models contributed
  decomposition?: {                   // Present if task was decomposed
    subTasks: Array<{
      description: string;
      model: string;
      confidenceScore: number;
      latencyMs: number;
    }>;
  };
  verificationResult: {
    consensus: boolean;               // Did parallel models agree?
    divergenceDetails?: string;       // Where they disagreed
  };
}
```

### 3.2 Retry-with-Reroute

If a model returns a confidence score below a configurable threshold (default: 0.7), Spaniel automatically retries with a different model without requiring Ducky to handle the retry.

### 3.3 Continuous Model Evaluation

Move from weekly to continuous evaluation. Spaniel tracks per-model metrics (latency, confidence, error rate, cost) on every request and updates its routing matrix in real time. Weekly full evaluation is retained as a batch reconciliation pass.

---

## 4. Cross-App Agent API

Other Cavaridge apps access Ducky's agentic capabilities via the existing Ducky API, extended with new endpoints.

### 4.1 New API Endpoints

```
POST   /api/v2/agent/plan          Create a research plan
GET    /api/v2/agent/plan/:id      Get plan status and results
POST   /api/v2/agent/plan/:id/approve   Approve a plan
DELETE /api/v2/agent/plan/:id      Cancel a plan
POST   /api/v2/agent/execute       Create and auto-approve a read-only plan (convenience endpoint)
GET    /api/v2/agent/actions       List available actions for a tenant
```

### 4.2 Cross-App Usage Examples

**Meridian (CVG-MER) — M&A Due Diligence:**
```json
{
  "query": "Research acquisition target: Tampa Bay Surgery Center. Pull public financials, check our Jira for related due diligence tasks, search Slack for any prior discussions, and draft an initial assessment summary.",
  "requestingApp": "CVG-MER",
  "tenantId": "compass-surgical",
  "autoApproveReads": true
}
```

**Caelum (CVG-CAELUM) — SoW Builder:**
```json
{
  "query": "Find the last 3 SoWs we delivered for ASC greenfield deployments. Extract common scope items, labor estimates, and prerequisites. Return structured data I can use to pre-populate a new SoW.",
  "requestingApp": "CVG-CAELUM",
  "tenantId": "dedicated-it",
  "autoApproveReads": true
}
```

**Midas (CVG-MIDAS) — QBR Platform:**
```json
{
  "query": "Pull this client's last 90 days of support tickets from Jira, M365 license usage from Google Workspace admin, and Meraki network health from our monitoring. Summarize trends for a QBR deck.",
  "requestingApp": "CVG-MIDAS",
  "tenantId": "dedicated-it",
  "autoApproveReads": true
}
```

---

## 5. Data Model Additions

### 5.1 New Database Tables

All tables are tenant-scoped. Schema managed via Drizzle ORM in `@cavaridge/db`.

```
agent_plans
  id              UUID PRIMARY KEY
  tenant_id       UUID NOT NULL REFERENCES tenants(id)
  user_id         UUID NOT NULL REFERENCES users(id)
  requesting_app  TEXT           -- NULL if user-initiated, app code if cross-app
  query           TEXT NOT NULL
  status          TEXT NOT NULL  -- draft | approved | executing | completed | failed | cancelled
  step_count      INTEGER
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  approved_at     TIMESTAMPTZ
  completed_at    TIMESTAMPTZ

agent_plan_steps
  id              UUID PRIMARY KEY
  plan_id         UUID NOT NULL REFERENCES agent_plans(id)
  order_index     INTEGER NOT NULL
  type            TEXT NOT NULL  -- read | reason | write | delete
  connector       TEXT NOT NULL
  description     TEXT NOT NULL
  depends_on      UUID[]        -- Array of step IDs
  input_data      JSONB
  output_data     JSONB
  status          TEXT NOT NULL  -- pending | running | completed | failed | skipped
  confidence      DECIMAL(3,2)
  started_at      TIMESTAMPTZ
  completed_at    TIMESTAMPTZ

agent_action_approvals
  id              UUID PRIMARY KEY
  plan_id         UUID NOT NULL REFERENCES agent_plans(id)
  step_id         UUID NOT NULL REFERENCES agent_plan_steps(id)
  user_id         UUID NOT NULL REFERENCES users(id)
  action_preview  JSONB NOT NULL  -- What the user saw before approving
  approved        BOOLEAN NOT NULL
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT now()

agent_model_metrics
  id              UUID PRIMARY KEY
  model_id        TEXT NOT NULL
  task_type       TEXT NOT NULL
  confidence      DECIMAL(3,2)
  latency_ms      INTEGER
  error           BOOLEAN DEFAULT false
  cost_usd        DECIMAL(10,6)
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 5.2 Audit Trail Integration

All agent actions (plan creation, approval, step execution, action execution) emit events to `@cavaridge/audit`. Event schema:

```typescript
interface AgentAuditEvent {
  eventType: 'plan.created' | 'plan.approved' | 'plan.cancelled'
    | 'step.started' | 'step.completed' | 'step.failed'
    | 'action.previewed' | 'action.approved' | 'action.rejected' | 'action.executed';
  tenantId: string;
  userId: string;
  planId: string;
  stepId?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}
```

---

## 6. Security Considerations

- **No stored credentials in Ducky.** Connector OAuth tokens are managed by `@cavaridge/auth` and retrieved at execution time. Tokens are never written to plan step data.
- **Tenant isolation is absolute.** A plan cannot query connectors configured for a different tenant, even if the requesting user has cross-tenant roles.
- **Action previews are sanitized.** Before presenting write action previews to the user, strip any sensitive data that shouldn't be displayed (API keys, tokens, internal IDs from external systems).
- **Rate limiting per tenant.** Configurable limits on plans per hour, steps per plan, and actions per day. Defaults: 50 plans/hour, 10 steps/plan, 25 actions/day.
- **LLM content filtering.** All Spaniel responses pass through the existing output verification layer before being returned to the user or used in subsequent steps.

---

## 7. UI Components (New)

### 7.1 Task Monitor

A real-time view of active research plans showing step-by-step progress, current status, and intermediate results. Accessible from the main chat interface as a collapsible panel.

### 7.2 Action Approval Card

An inline UI component within the chat thread that presents:
- What action Ducky wants to take
- A preview of the content (draft message, ticket body, etc.)
- Edit capability (user can modify before approving)
- Approve / Reject buttons
- "Always approve this action type" toggle (per-user, per-connector — sets auto-approve for read-equivalent actions only)

### 7.3 Plan Visualization

A DAG visualization showing the research plan's steps, dependencies, and current execution state. Color-coded by status (pending/running/completed/failed/skipped). Accessible by clicking into any active or completed plan.

---

## 8. Implementation Notes for Claude Code

### 8.1 Package Dependencies

- Agent layer lives in `apps/ducky/src/agent/` — new directory
- Planner: `apps/ducky/src/agent/planner.ts`
- Executor: `apps/ducky/src/agent/executor.ts`
- Action Engine: `apps/ducky/src/agent/actions.ts`
- Approval Gateway: `apps/ducky/src/agent/approval.ts`
- Plan types: `packages/types/src/agent.ts`
- Database migrations: `packages/db/drizzle/migrations/` — new migration for agent tables
- Audit events: `packages/audit/src/events/agent.ts`

### 8.2 Build Order

1. `packages/types` — Add agent type definitions (ResearchPlan, PlanStep, etc.)
2. `packages/db` — Add agent table schemas and migration
3. `packages/audit` — Add agent event types and emitters
4. `apps/ducky/src/agent/approval.ts` — Approval gateway (no external deps beyond auth)
5. `apps/ducky/src/agent/planner.ts` — Planner (depends on types, Spaniel client)
6. `apps/ducky/src/agent/executor.ts` — Executor (depends on planner, connectors, Spaniel client, audit)
7. `apps/ducky/src/agent/actions.ts` — Action engine (depends on executor, approval, connectors, audit)
8. `apps/ducky/src/routes/agent.ts` — API routes for the agent endpoints
9. UI components — Task Monitor, Action Approval Card, Plan Visualization

### 8.3 Testing Strategy

- Unit tests for Planner (given a query, does it produce a valid DAG?)
- Unit tests for Approval Gateway (permission tier enforcement)
- Integration tests for Executor with mocked connectors
- End-to-end tests for the full flow: query → plan → approve → execute → result
- Action Engine tests must verify that write actions NEVER execute without approval records in the database

### 8.4 Environment Variables

No new secrets required. Agent layer uses existing connector OAuth tokens via `@cavaridge/auth` and Spaniel endpoint via existing `SPANIEL_API_URL` env var.

---

## 9. Open Questions

- [ ] Should cross-app requests (e.g., Meridian calling Ducky) bypass plan approval for read-only plans? Current spec says yes via `autoApproveReads` flag. Confirm.
- [ ] Maximum plan depth — should we allow plans that spawn sub-plans? Current spec is flat (single-level DAG). Nested plans add significant complexity.
- [ ] Conversation integration — when a plan completes, should the results be injected into the active conversation thread, or presented as a separate artifact?
- [ ] Offline/async plans — should users be able to kick off a long-running plan and get notified when it completes? This requires a notification system.
- [ ] Cost tracking — should per-plan LLM costs be surfaced to the user or just logged for admin review?
