# Ducky (CVG-RESEARCH) Build Report

**Date:** 2026-03-24
**Status:** Complete
**App Code:** CVG-RESEARCH
**Build Order Position:** 2 (after Spaniel)

---

## What Was Built

### 1. Spaniel HTTP Client (`server/spaniel-client.ts`)
- `SpanielClient` class with service token auth (Bearer header)
- Methods: `chat()`, `chatStream()`, `embed()`, `getModels()`
- Calls Spaniel REST API: POST /api/v1/chat, POST /api/v1/embed, GET /api/v1/models
- Retry logic with exponential backoff (configurable max retries, base delay 500ms)
- Retries on: 429, 5xx, timeouts, ECONNREFUSED
- Non-retryable errors (400, 401) thrown immediately
- Streaming SSE support via async generator
- Singleton factory via `getSpanielClient()`
- Configurable via env: `SPANIEL_URL`, `SPANIEL_SERVICE_TOKEN`, `SPANIEL_TIMEOUT_MS`, `SPANIEL_MAX_RETRIES`

### 2. Conversation Engine (Enhanced)
- Multi-turn conversation management with Supabase storage
- System prompts and context injection via prompt template system
- Conversation auto-branching at 0.65 similarity threshold (pre-existing, preserved)
- RAG integration for knowledge-augmented responses
- Streaming SSE support for real-time responses
- Security: prompt injection detection + PII scanning on all inputs

### 3. User-Facing REST API (`server/routes/v1/`)
All endpoints tenant-scoped, role-gated via @cavaridge/auth:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/conversations` | POST | Create new conversation |
| `/api/v1/conversations` | GET | List user conversations (pagination, archive filter) |
| `/api/v1/conversations/:id` | GET | Get conversation with messages |
| `/api/v1/conversations/:id/messages` | POST | Send message (supports streaming) |
| `/api/v1/conversations/:id` | DELETE | Delete conversation + messages + threads |
| `/api/v1/query` | POST | One-shot query, no persistence |

### 4. App Integration Layer (`server/routes/v1/app-query.ts`)
- `POST /api/v1/app-query` — Other Cavaridge apps call Ducky for AI reasoning
- Accepts `app_code` (validated against 14 registered app codes), `task_type`, and `payload`
- Resolves prompt templates per app + task type automatically
- Adds Ducky identity and tenant context on top of raw Spaniel calls
- Langfuse tracing with app_code context

### 5. Prompt Template System (`server/prompt-templates.ts` + `server/routes/v1/templates.ts`)
- Stored prompt templates per app + task type in Supabase (`ducky.prompt_templates` table)
- `{{variable}}` interpolation syntax
- Variable auto-extraction from template strings
- In-memory cache (5-minute TTL) with invalidation on CRUD
- Resolution: tenant-specific custom templates preferred over defaults
- CRUD endpoints: GET/POST/PATCH/DELETE `/api/v1/templates` (MSP Admin+ only)
- New permissions: `manage_templates`, `app_query`

### 6. Ducky Animation Integration (`server/ducky-state.ts`)
- Server-side utility mapping API lifecycle phases to animation states
- 8 API phases mapped to Ducky's 9 Lottie animation states
- Re-exports from `@cavaridge/ducky-animations` (useDuckyState hook, types)
- Animation states included in SSE stream events for real-time mascot sync
- `DUCKY_BRANDING` constants exported for all consumers

### 7. Branding Enforcement
- `DUCKY_BRANDING.FOOTER_TAGLINE` = "Powered by Ducky Intelligence"
- Included in every API response as `branding` field
- `BRAND_NAME` = "Ducky Intelligence" (never "Ducky AI")
- Character name "Ducky" used standalone for mascot references
- Default system prompt uses Ducky identity

### 8. Observability
- Langfuse `traceRequest()` called on every Spaniel interaction
- Traces include: conversation_id, tenant_id, app_code, task_type
- Request logging via Pino with structured metadata

### 9. Schema Additions
- `ducky.prompt_templates` table with tenant_id, app_code, task_type, system_prompt, user_prompt_template, variables jsonb, is_default, is_active, created_by
- Indexed on tenant_id, app_code, task_type

---

## Files Created

| File | Purpose |
|------|---------|
| `server/spaniel-client.ts` | HTTP client for Spaniel REST API |
| `server/prompt-templates.ts` | Template engine with caching and interpolation |
| `server/ducky-state.ts` | Animation state mapping + branding constants |
| `server/routes/v1/index.ts` | V1 route registration |
| `server/routes/v1/conversations.ts` | Conversation CRUD + messaging |
| `server/routes/v1/query.ts` | One-shot query endpoint |
| `server/routes/v1/app-query.ts` | App integration layer |
| `server/routes/v1/templates.ts` | Prompt template CRUD |
| `tests/spaniel-client.test.ts` | SpanielClient unit tests (8 tests) |
| `tests/prompt-templates.test.ts` | Template interpolation tests (13 tests) |
| `tests/conversations.test.ts` | Integration tests with mocked Spaniel (9 tests) |

## Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | Added `promptTemplates` table definition |
| `server/routes/index.ts` | Registered V1 routes |
| `server/permissions.ts` | Added `manage_templates` and `app_query` permissions |
| `vitest.config.ts` | Added package aliases for test resolution |

---

## Test Results

```
Test Files:  4 passed (4)
Tests:       52 passed (52)
Duration:    ~1s
```

- `spaniel-client.test.ts` — 8 tests (HTTP client, retry, auth, streaming)
- `prompt-templates.test.ts` — 13 tests (interpolation, extraction, edge cases)
- `conversations.test.ts` — 9 tests (branding, animation states, integration)
- `agent/approval.test.ts` — 22 tests (pre-existing, still passing)

## Type Check

```
pnpm tsc --noEmit — Zero errors in Ducky code
(Pre-existing errors in packages/onboarding are unrelated)
```

---

## Architecture Compliance

- All LLM calls route through `@cavaridge/spaniel` (never direct to OpenRouter)
- All data tenant-scoped with `tenant_id` on every table
- No hardcoded tenant data (DIT is a tenant record, not embedded)
- RBAC enforced via `@cavaridge/auth` middleware on all endpoints
- Branding: "Ducky Intelligence" throughout, never "Ducky AI"
- Express 5 + TypeScript 5.6+ strict mode
- Drizzle ORM for all database access
- Supabase RLS-ready schema

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SPANIEL_URL` | Spaniel gateway URL | `http://localhost:4100` |
| `SPANIEL_SERVICE_TOKEN` | Bearer token for Spaniel auth | (empty, dev bypass) |
| `SPANIEL_TIMEOUT_MS` | Request timeout | 30000 |
| `SPANIEL_MAX_RETRIES` | Max retry attempts | 3 |
| `DATABASE_URL` | Supabase PostgreSQL connection | (required) |
| `REDIS_URL` | Redis for caching | (optional) |
