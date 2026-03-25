# Spaniel (CVG-AI) Build Report

**Date:** 2026-03-24
**Status:** Functional
**Type Errors:** 0 (spaniel-specific)
**Tests:** 27/27 passing

---

## What Was Built

### Package: `@cavaridge/spaniel` (packages/spaniel/)

The shared LLM gateway library consumed by all Cavaridge apps.

**Pre-existing (already implemented):**
- Task-type routing with DB-backed config + in-memory cache (5-min TTL) + hardcoded defaults
- OpenRouter integration via `openai` SDK (OpenAI-compatible client pointed at OpenRouter)
- Multi-model consensus engine with 3-tier threshold logic (>0.9 aligned, 0.7-0.9 divergent, <0.7 tiebreaker)
- Three-tier fallback cascade (primary → secondary → tertiary) on rate limits, timeouts, 5xx errors
- Cost calculation with per-model pricing (DB + defaults)
- Fire-and-forget request logging to Supabase + stdout fallback
- Drizzle schema: `spaniel.routing_matrix`, `spaniel.request_log`, `spaniel.model_catalog`
- Embedding generation via OpenRouter

**New additions:**
1. **`src/redis.ts`** — Lazy-initialized Redis client (ioredis) for caching and BullMQ
2. **`src/langfuse.ts`** — Langfuse observability wrapper. Traces every LLM call with model, tenant_id, app_code, task_type, tokens, cost, latency. Graceful no-op when Langfuse is not configured.
3. **`src/stream.ts`** — Streaming chat completion. Sends SSE tokens as they arrive from OpenRouter. Supports fallback cascade. Logs and traces after stream completes.
4. **Langfuse tracing wired into `chat.ts`** — Every chatCompletion call is traced via Langfuse after response.

### Service: `@cavaridge/spaniel-service` (apps/spaniel/)

The Express 5 REST API that other Cavaridge apps call.

**Pre-existing endpoints:**
- `GET /api/v1/health` — Service health check (public, no auth)
- `GET /healthz` — Liveness probe
- `POST /api/v1/reason` — LLM chat completion (legacy name)
- `POST /api/v1/embed` — Embedding generation
- `GET /api/v1/models` — Routing matrix introspection
- `POST /api/v1/models/refresh` — Force routing cache refresh
- `GET /api/v1/usage` — Per-tenant usage statistics
- `POST /api/v1/migrate` — One-time DB migration

**New endpoints:**
1. **`POST /api/v1/chat`** — Canonical LLM chat completion endpoint per architecture spec. Supports both JSON responses and SSE streaming (`stream: true`).
2. **`POST /api/v1/models/refresh-catalog`** — Manually trigger OpenRouter model catalog refresh.

**New middleware:**
1. **`server/middleware/tenant-rate-limit.ts`** — Per-tenant rate limiting via Redis sliding window. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Graceful pass-through when Redis is unavailable.

**New workers:**
1. **`server/workers/model-catalog-refresh.ts`** — BullMQ worker that pulls models from OpenRouter catalog API and upserts into `spaniel.model_catalog`. Scheduled weekly (Sunday 3 AM UTC, configurable via `CATALOG_REFRESH_CRON`).

**Infrastructure:**
- Graceful shutdown handler (flushes Langfuse, closes Redis, stops BullMQ workers)
- Tenant rate limiting applied to `/api/v1/chat`, `/api/v1/reason`, `/api/v1/embed`

---

## Architecture Compliance

| Spec Requirement | Status |
|-----------------|--------|
| Task-type routing config | ✅ 10 task types, DB + cache + defaults |
| OpenRouter integration | ✅ Single master key, OpenAI-compatible SDK |
| Multi-model consensus | ✅ 3-tier threshold (0.9/0.7), tertiary tiebreaker |
| Model catalog refresh | ✅ BullMQ weekly job + manual trigger |
| REST API endpoints | ✅ POST /chat, POST /embed, GET /models, GET /health |
| Service-to-service auth | ✅ Bearer token, comma-separated SPANIEL_SERVICE_TOKENS |
| Tenant-scoped requests | ✅ tenant_id required on all LLM endpoints |
| Per-tenant rate limiting | ✅ Redis sliding window counter |
| Langfuse observability | ✅ Traces model, tokens, cost, latency, tenant |
| Streaming support | ✅ SSE via `stream: true` |
| Fallback cascade | ✅ Primary → secondary → tertiary on 429/5xx/timeout |
| Cost tracking | ✅ Per-model pricing, 6 decimal places |
| Request audit logging | ✅ DB + stdout fallback |
| Express 5 + TypeScript 5.6+ | ✅ |
| Zero type errors | ✅ (0 spaniel-specific errors) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Cavaridge LLC master OpenRouter key |
| `SPANIEL_SERVICE_TOKENS` | Yes (prod) | Comma-separated service tokens |
| `DATABASE_URL` / `SPANIEL_DATABASE_URL` | No | Supabase connection string (for logging/routing DB) |
| `REDIS_URL` | No | Redis connection (for tenant rate limiting + BullMQ) |
| `LANGFUSE_SECRET_KEY` | No | Langfuse secret key (for observability) |
| `LANGFUSE_PUBLIC_KEY` | No | Langfuse public key |
| `LANGFUSE_BASE_URL` | No | Langfuse URL (defaults to cloud.langfuse.com) |
| `CATALOG_REFRESH_CRON` | No | Cron expression for model refresh (default: weekly Sunday 3 AM) |
| `PORT` | No | Service port (default: 5100) |

---

## Test Results

```
 ✓ tests/api.test.ts (16 tests)
 ✓ tests/routing.test.ts (11 tests)

 Test Files  2 passed (2)
      Tests  27 passed (27)
```

### Test Coverage Summary

**Routing tests (11):**
- Default routing for all 10 task types
- Anthropic primary model selection
- OpenAI embedding model selection
- Claude-opus for high-stakes tasks
- Haiku for extraction
- Unknown task type fallback to chat
- Caching consistency
- Model ID format validation (provider/model)
- Three-tier fallback presence

**API integration tests (16):**
- Health endpoint (no auth required)
- Auth: reject missing token, reject invalid token, accept valid token
- GET /api/v1/models returns routing matrix
- POST /api/v1/chat: valid request, missing tenant_id, missing messages, task_hint, options, streaming
- POST /api/v1/reason: backward compatibility
- POST /api/v1/embed: valid request, array input, missing app_code
- GET /healthz liveness probe

---

## Files Changed

### New files:
- `packages/spaniel/src/redis.ts`
- `packages/spaniel/src/langfuse.ts`
- `packages/spaniel/src/stream.ts`
- `apps/spaniel/server/middleware/tenant-rate-limit.ts`
- `apps/spaniel/server/routes/chat.ts`
- `apps/spaniel/server/workers/model-catalog-refresh.ts`
- `apps/spaniel/tests/routing.test.ts`
- `apps/spaniel/tests/api.test.ts`
- `apps/spaniel/vitest.config.ts`
- `logs/spaniel-build-report.md`

### Modified files:
- `packages/spaniel/src/index.ts` — Added exports for redis, langfuse, stream, cost, consensus, fallback
- `packages/spaniel/src/chat.ts` — Added Langfuse tracing after completion
- `packages/spaniel/package.json` — Added ioredis, bullmq, langfuse deps
- `apps/spaniel/package.json` — Added ioredis, bullmq, langfuse deps + test script
- `apps/spaniel/server/index.ts` — Added BullMQ worker startup + graceful shutdown
- `apps/spaniel/server/routes/index.ts` — Registered chat routes
- `apps/spaniel/server/routes/reason.ts` — Added tenant rate limiting
- `apps/spaniel/server/routes/models.ts` — Added catalog refresh endpoint
