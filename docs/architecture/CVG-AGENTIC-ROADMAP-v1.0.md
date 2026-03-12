# Cavaridge Agentic Evolution Roadmap

**Version:** 1.0  
**Date:** 2026-03-12  
**Author:** Benjamin Posner, Principal & vCIO, Cavaridge LLC  
**Status:** Draft  
**Location:** `docs/architecture/CVG-AGENTIC-ROADMAP-v1.0.md`  
**Related:** `docs/architecture/CVG-RESEARCH-AGENTIC-ARCHITECTURE-v1.0.md`

---

## Summary

This roadmap defines the phased evolution of Project Ducky (CVG-RESEARCH) and Project Spaniel (CVG-AI) from their current request/response architecture into an agentic intelligence layer for the entire Cavaridge platform. Three phases, sequenced by value and dependency.

---

## Current State (Baseline)

**Spaniel (CVG-AI):**
- Stateless LLM gateway routing through OpenRouter
- Task type detection → model selection → parallel dual-model execution → confidence-scored response
- Weekly routing matrix updates based on OpenRouter model availability
- No UI. Only Ducky calls Spaniel.

**Ducky (CVG-RESEARCH):**
- User-facing research/reasoning platform (web, iOS, Android)
- 10 external data connectors (GitHub, GitLab, Jira, Slack, Notion, Salesforce, HubSpot, Google Workspace, M365, Stripe)
- Context optimization before Spaniel handoff
- Conversation threads with auto-branching on topic divergence
- Source verification of model outputs before returning to user
- Cross-app API: all other Cavaridge apps use Ducky for AI reasoning

---

## Phase 1: Agentic Ducky

**Goal:** Ducky autonomously plans and executes multi-step research workflows across its 10 connectors, with user approval for any write actions.

**Duration:** 6–8 weeks  
**Priority:** Highest — this is where the product differentiation lives

### Milestone 1.1 — Foundation (Weeks 1–2)

| Task | Package/Location | Notes |
|---|---|---|
| Define agent type definitions | `packages/types/src/agent.ts` | ResearchPlan, PlanStep, ConnectorType, AgentAuditEvent |
| Create agent database tables | `packages/db/drizzle/migrations/` | agent_plans, agent_plan_steps, agent_action_approvals |
| Add agent audit event types | `packages/audit/src/events/agent.ts` | Plan lifecycle + action lifecycle events |
| Build Approval Gateway | `apps/ducky/src/agent/approval.ts` | Permission tier enforcement (read/write/delete) |

**Exit Criteria:** Types compile, migration runs, approval gateway passes unit tests with all three permission tiers.

### Milestone 1.2 — Planner (Weeks 2–3)

| Task | Package/Location | Notes |
|---|---|---|
| Build Planner module | `apps/ducky/src/agent/planner.ts` | Takes user query → produces DAG of PlanSteps |
| Integrate with Spaniel for intent analysis | `apps/ducky/src/agent/planner.ts` | Send query to Spaniel with task type 'plan_generation' |
| Plan validation logic | `apps/ducky/src/agent/planner.ts` | Validate DAG (no cycles, valid connectors, step limit) |
| Plan API endpoints | `apps/ducky/src/routes/agent.ts` | POST /plan, GET /plan/:id |
| Plan approval endpoint | `apps/ducky/src/routes/agent.ts` | POST /plan/:id/approve |

**Exit Criteria:** Given a natural language query, Planner produces a valid research plan with correct connector assignments and dependency ordering. Plans persist to database. Approval flow works end-to-end.

### Milestone 1.3 — Executor (Weeks 3–5)

| Task | Package/Location | Notes |
|---|---|---|
| Build Executor module | `apps/ducky/src/agent/executor.ts` | Runs approved plans step-by-step with parallelism |
| Connector adapter layer | `apps/ducky/src/agent/connectors/` | Standardized interface for all 10 connectors to receive step inputs and return structured outputs |
| Iterative context passing | `apps/ducky/src/agent/executor.ts` | Output from step N flows as input context to step N+1 |
| Progress streaming via WebSocket | `apps/ducky/src/agent/executor.ts` | Real-time step status updates to UI |
| Error handling and partial results | `apps/ducky/src/agent/executor.ts` | Failed steps → skip dependents → present partial results |
| Audit trail integration | `apps/ducky/src/agent/executor.ts` | Emit events for every step state change |

**Exit Criteria:** A multi-step read-only plan executes end-to-end across at least 3 different connectors. Progress streams to client. Partial results returned on step failure. All events logged to audit trail.

### Milestone 1.4 — Action Engine (Weeks 5–6)

| Task | Package/Location | Notes |
|---|---|---|
| Build Action Engine | `apps/ducky/src/agent/actions.ts` | Handles write operations with preview → approve → execute flow |
| Action preview generation | `apps/ducky/src/agent/actions.ts` | Generate human-readable preview of what will be written |
| Action execution per connector | `apps/ducky/src/agent/connectors/` | Implement write methods for initial action set (see architecture spec Section 2.2.3) |
| Double approval enforcement | `apps/ducky/src/agent/actions.ts` | Plan-level approval + action-level approval. Non-negotiable. |

**Exit Criteria:** User can approve a plan containing write steps. Each write step presents a preview. User can edit preview before approving. Action executes and returns confirmation with link to created resource. Approval records exist in database for every executed action.

### Milestone 1.5 — UI (Weeks 6–8)

| Task | Package/Location | Notes |
|---|---|---|
| Task Monitor panel | `apps/ducky/src/components/agent/TaskMonitor.tsx` | Collapsible panel showing active plan progress |
| Action Approval Card | `apps/ducky/src/components/agent/ActionApproval.tsx` | Inline approval widget in chat thread |
| Plan Visualization | `apps/ducky/src/components/agent/PlanView.tsx` | DAG visualization with status color coding |
| Integration into existing chat UI | `apps/ducky/src/components/Chat.tsx` | Plans triggered from chat. Results injected into thread. |

**Exit Criteria:** Full agentic flow works through the UI: user types query → sees plan → approves → watches execution → reviews results → approves actions → sees confirmations. All in the existing chat interface.

### Phase 1 Definition of Done

- [ ] User can initiate a multi-step research workflow from chat
- [ ] Ducky autonomously queries multiple connectors in dependency order
- [ ] Read-only plans execute without manual step-by-step approval (configurable)
- [ ] Write actions always require preview + approval
- [ ] All agent activity is logged to audit trail
- [ ] Existing non-agentic chat functionality is unaffected (agent is additive)
- [ ] Unit tests for Planner, Executor, Approval Gateway, Action Engine
- [ ] Integration tests for multi-connector execution
- [ ] End-to-end test for full agentic flow

---

## Phase 2: Smarter Spaniel

**Goal:** Spaniel becomes a more capable execution engine — task decomposition, automatic retry-with-reroute, and continuous model evaluation — without becoming an agent.

**Duration:** 3–4 weeks  
**Priority:** Medium — improves quality of every Ducky interaction but not user-facing  
**Dependency:** Can run in parallel with Phase 1 Milestones 1.4–1.5

### Milestone 2.1 — Task Decomposition (Weeks 1–2)

| Task | Package/Location | Notes |
|---|---|---|
| Add `decomposable` task type to Spaniel API | `apps/spaniel/src/routes/` | New request field: `type: 'simple' | 'decomposable'` |
| Decomposition logic | `apps/spaniel/src/decomposer.ts` | Split complex prompts into sub-tasks based on structure |
| Sub-task routing | `apps/spaniel/src/router.ts` | Route each sub-task to optimal model independently |
| Response assembly | `apps/spaniel/src/assembler.ts` | Merge sub-task results into coherent response |
| Updated response schema | `packages/types/src/spaniel.ts` | Include decomposition details in response |

**Exit Criteria:** A complex multi-part question sent with `type: 'decomposable'` is split into sub-tasks, each routed to the best model, and results are merged into a single coherent response with per-sub-task confidence scores.

### Milestone 2.2 — Retry-with-Reroute (Week 2)

| Task | Package/Location | Notes |
|---|---|---|
| Confidence threshold config | `apps/spaniel/src/config.ts` | Default 0.7, configurable per task type |
| Automatic reroute on low confidence | `apps/spaniel/src/router.ts` | If model A returns < threshold, try model B without returning to Ducky |
| Max retry limit | `apps/spaniel/src/router.ts` | Max 2 reroutes per request to bound latency |
| Reroute logging | `apps/spaniel/src/metrics.ts` | Track reroute frequency per model for evaluation |

**Exit Criteria:** Low-confidence responses trigger automatic reroute. Response includes which models were tried and why. Total latency stays within acceptable bounds (< 15s for simple, < 30s for decomposable).

### Milestone 2.3 — Continuous Model Evaluation (Weeks 3–4)

| Task | Package/Location | Notes |
|---|---|---|
| Per-request metric recording | `apps/spaniel/src/metrics.ts` | Log confidence, latency, error rate, cost per model per request |
| Real-time routing matrix updates | `apps/spaniel/src/router.ts` | Adjust model scores on every request using exponential moving average |
| Model metrics database table | `packages/db/drizzle/migrations/` | agent_model_metrics table |
| Weekly batch reconciliation | `apps/spaniel/src/evaluation/weekly.ts` | Full evaluation pass retained as sanity check against real-time drift |
| OpenRouter availability monitoring | `apps/spaniel/src/evaluation/availability.ts` | Detect when models are added/removed/degraded on OpenRouter |

**Exit Criteria:** Spaniel's routing decisions improve over time based on observed performance. A model that starts returning lower confidence or higher latency is automatically deprioritized within hours, not days. Weekly batch confirms real-time metrics are accurate.

### Phase 2 Definition of Done

- [ ] Complex requests are decomposed and routed to multiple models
- [ ] Low-confidence responses automatically reroute without Ducky intervention
- [ ] Model evaluation is continuous with weekly batch reconciliation
- [ ] All metrics are persisted and queryable
- [ ] Spaniel remains stateless per-request (no persistent state between requests)
- [ ] No breaking changes to existing Spaniel API (v2 fields are additive)

---

## Phase 3: Cross-App Agent Mesh

**Goal:** Every Cavaridge app can request agentic workflows through Ducky's API, enabling autonomous multi-system intelligence across the portfolio.

**Duration:** 4–6 weeks  
**Priority:** Lower — depends on Phase 1 completion and at least 2 other Cavaridge apps being in production  
**Dependency:** Phase 1 complete. Phase 2 recommended but not required.

### Milestone 3.1 — Cross-App API (Weeks 1–2)

| Task | Package/Location | Notes |
|---|---|---|
| App authentication for Ducky API | `apps/ducky/src/middleware/appAuth.ts` | Service-to-service auth. Each Cavaridge app gets a signed JWT for Ducky API calls. |
| `requestingApp` field in plan creation | `apps/ducky/src/routes/agent.ts` | Track which app initiated each plan for audit and billing |
| Convenience endpoint for read-only plans | `apps/ducky/src/routes/agent.ts` | POST /api/v2/agent/execute — create + auto-approve in one call |
| Per-app rate limiting | `apps/ducky/src/middleware/rateLimit.ts` | Configurable per app to prevent runaway automation |

**Exit Criteria:** A Cavaridge app can authenticate to Ducky's API, submit a research plan, and receive results — all programmatically without user interaction for read-only plans.

### Milestone 3.2 — App-Specific Prompt Templates (Weeks 2–3)

| Task | Package/Location | Notes |
|---|---|---|
| Prompt template registry | `apps/ducky/src/agent/templates/` | Pre-built research plan templates per app |
| Meridian templates | `apps/ducky/src/agent/templates/meridian.ts` | Due diligence research, competitive analysis, financial summary |
| Caelum templates | `apps/ducky/src/agent/templates/caelum.ts` | Historical SoW retrieval, scope comparison, template population |
| Midas templates | `apps/ducky/src/agent/templates/midas.ts` | QBR data aggregation, trend analysis, ticket summarization |
| Template API | `apps/ducky/src/routes/agent.ts` | GET /api/v2/agent/templates — list available templates for requesting app |

**Exit Criteria:** Each integrated app has at least 3 pre-built templates that produce well-structured, reliable results. Templates are versioned and tenant-configurable.

### Milestone 3.3 — Async Plans and Notifications (Weeks 3–5)

| Task | Package/Location | Notes |
|---|---|---|
| Async plan execution mode | `apps/ducky/src/agent/executor.ts` | Plans that run in background and notify on completion |
| Notification system | `packages/notifications/` | New shared package for push notifications, email, Slack webhooks |
| Webhook delivery for cross-app results | `apps/ducky/src/agent/webhooks.ts` | When a cross-app plan completes, POST results to requesting app's webhook URL |
| Plan status polling endpoint | `apps/ducky/src/routes/agent.ts` | For apps that prefer polling over webhooks |

**Exit Criteria:** An app can submit a long-running research plan and receive results via webhook when complete. Users can view async plan status in Ducky's UI.

### Milestone 3.4 — Agent Dashboard (Weeks 5–6)

| Task | Package/Location | Notes |
|---|---|---|
| Admin dashboard for agent activity | `apps/ducky/src/components/admin/AgentDashboard.tsx` | View all plans, steps, actions across the tenant |
| Cost tracking per plan | `apps/ducky/src/agent/cost.ts` | Aggregate LLM costs from Spaniel responses per plan |
| Usage analytics | `apps/ducky/src/components/admin/AgentAnalytics.tsx` | Plans per day, avg steps, completion rate, most-used connectors, cost trends |
| Cross-app usage breakdown | `apps/ducky/src/components/admin/AgentAnalytics.tsx` | Which apps are generating the most agent activity |

**Exit Criteria:** Tenant admins can see all agent activity, costs, and usage patterns in a single dashboard. Data is accurate and real-time.

### Phase 3 Definition of Done

- [ ] At least 3 Cavaridge apps can submit agentic workflows to Ducky via API
- [ ] Read-only cross-app plans execute without user interaction
- [ ] Write actions from cross-app requests still require user approval in Ducky
- [ ] Async execution works with webhook delivery
- [ ] Admin dashboard shows full agent activity, costs, and usage
- [ ] Service-to-service auth is secure (signed JWTs, no shared secrets)
- [ ] Per-app rate limiting prevents runaway automation

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Competing orchestration between Ducky agent and Spaniel decomposer | High | Ducky is the only orchestrator. Spaniel decomposes within a single reasoning request only — never across connectors or external systems. |
| Runaway agent execution (cost/rate) | High | Per-tenant rate limits, per-plan step limits, per-day action limits. All configurable. Hard ceiling defaults. |
| Write action executed without proper approval | Critical | Double approval is enforced in code and validated in database. Integration tests verify no write action can execute without two approval records. |
| Connector OAuth token expiry mid-plan | Medium | Executor checks token validity before each step. If expired, pause plan and notify user to re-authenticate. |
| Model degradation during plan execution | Medium | Spaniel retry-with-reroute (Phase 2) handles this transparently. If Phase 2 isn't complete, Executor retries the Spaniel call up to 3 times. |
| Cross-tenant data leakage via agent plans | Critical | Tenant ID is validated on every connector call, every database query, and every API response. Integration tests with multi-tenant fixtures. |
| Plan complexity explosion (too many steps) | Medium | Configurable step limit per plan (default: 10). Planner rejects plans that exceed limit and suggests simplification. |
| User confusion about agent capabilities | Low | Onboarding flow explains what Ducky can do autonomously vs. what requires approval. Clear labeling in UI. |

---

## CLAUDE.md Updates

When this roadmap is adopted, update the root `CLAUDE.md` with:

```markdown
## Agent Architecture

- Ducky (CVG-RESEARCH) is the ONLY agentic orchestrator in the Cavaridge platform
- Spaniel (CVG-AI) is a stateless execution engine — it does NOT maintain agent state
- All write actions require double approval (plan-level + action-level) — this is non-negotiable
- Agent types are defined in `packages/types/src/agent.ts`
- Agent database tables are in `packages/db/drizzle/migrations/`
- Agent audit events are in `packages/audit/src/events/agent.ts`
- Agent source code lives in `apps/ducky/src/agent/`
- Cross-app agent API is at `/api/v2/agent/` — see docs/architecture/CVG-RESEARCH-AGENTIC-ARCHITECTURE-v1.0.md
```

---

## Versioning

This document follows Cavaridge runbook versioning: `CVG-AGENTIC-ROADMAP-v[Major].[Minor].[Patch]-[YYYYMMDD]`.

- **v1.0** — 2026-03-12 — Initial roadmap covering Phases 1–3
