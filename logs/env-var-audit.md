# Cavaridge Platform — Environment Variable Audit

**Generated:** 2026-03-25
**Railway Project:** endearing-spirit (`e6bcc145-4a60-4da0-9215-ad4a3aac68c0`)
**Railway Environment:** production
**Method:** Source code grep (`process.env`, `import.meta.env`) + Railway CLI `railway variables -s <service>`

---

## CRITICAL FINDINGS

### 1. SPANIEL_SERVICE_TOKENS naming mismatch (WILL CAUSE 503 IN PRODUCTION)

- **Spaniel auth middleware** (`apps/spaniel/server/middleware/auth.ts:29`) reads `SPANIEL_SERVICE_TOKENS` (plural, comma-separated)
- **Railway has** `SPANIEL_SERVICE_TOKEN` (singular) set on Spaniel
- **Result:** Spaniel finds zero tokens → rejects ALL requests in production with 503 "Service misconfigured"
- **Fix:** Rename Railway var on Spaniel from `SPANIEL_SERVICE_TOKEN` → `SPANIEL_SERVICE_TOKENS`

### 2. DUCKY_URL vs DUCKY_API_URL naming mismatch (2 apps affected)

- **Caelum** code reads `DUCKY_API_URL` (`apps/caelum/server/services/sow/ducky.ts:13`) → Railway has `DUCKY_URL` → **will fall back to localhost:4001**
- **Vespar** code reads `DUCKY_API_URL` (`apps/vespar/server/ducky-client.ts:8`) → Railway has `DUCKY_URL` → **will fall back to localhost:5200**
- **Meridian** code reads `DUCKY_URL` → Railway has `DUCKY_URL` → OK
- **Fix:** Either rename Railway vars to `DUCKY_API_URL` on Caelum/Vespar, or update code to use `DUCKY_URL` consistently

### 3. Meridian RESEND_API_KEY and SENTRY_DSN have wrong values

- `RESEND_API_KEY` = `bposner@cavaridge.com` — should be a Resend API key (format: `re_...`)
- `SENTRY_DSN` = `bposner@cavaridge.com` — should be a Sentry DSN URL (format: `https://...@sentry.io/...`)
- These are clearly placeholder values that were never replaced with real credentials

### 4. VITE_ prefixed vars missing from ALL Railway services

No Railway service has `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` set. These are required at Vite build time for client-side Supabase auth. Without them, `import.meta.env.VITE_SUPABASE_URL` resolves to `undefined` in the browser.

**Affected apps (all with Vite client builds):** Ducky, Core, Meridian, Caelum, Forge, HIPAA, AEGIS, Midas, Vespar, Astra, Brain, Cavalier

**Fix:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to every service with a client-side build, OR update Vite configs to define these from non-prefixed vars.

### 5. AEGIS missing REDIS_URL

- Code uses Redis for BullMQ queues (`apps/aegis/server/queues.ts`)
- Railway does NOT have `REDIS_URL` set on AEGIS
- Code degrades gracefully (logs warning) but queues won't function

### 6. OPENROUTER_API_KEY on 10 services that don't need it

Per architecture: all LLM calls route through Spaniel. Only Spaniel should have `OPENROUTER_API_KEY`. Currently set on: Meridian, Caelum, Forge, HIPAA, AEGIS, Midas, Vespar, Astra, Brain, Cavalier. This is a **security risk** — the master OpenRouter key is exposed to services that should never use it directly.

---

## Per-Service Audit

### 1. Spaniel (LLM Gateway) — Railway service: `spaniel-api`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL (Supabase pooler) for cost tracking, request logs |
| `OPENROUTER_API_KEY` | Required | SET | Master OpenRouter key for LLM routing |
| `REDIS_URL` | Required | SET | Redis for caching, rate limiting, BullMQ |
| `PORT` | Optional (default: 5100) | SET (5100) | HTTP server port |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `SUPABASE_URL` | Optional | SET | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | SET | Supabase admin operations |
| `SPANIEL_SERVICE_TOKENS` | Required (prod) | **WRONG NAME** | See Critical Finding #1 — Railway has `SPANIEL_SERVICE_TOKEN` (singular) |
| `SPANIEL_DATABASE_URL` | Optional | MISSING | Spaniel-specific DB URL (falls back to DATABASE_URL) |
| `SUPABASE_ANON_KEY` | Not used | MISSING | Not referenced in Spaniel code |
| `LOG_LEVEL` | Optional (default: info) | MISSING | Pino log level |
| `LANGFUSE_SECRET_KEY` | Optional | MISSING | Observability (graceful degradation) |
| `LANGFUSE_PUBLIC_KEY` | Optional | MISSING | Observability (graceful degradation) |
| `LANGFUSE_BASE_URL` | Optional (default: cloud) | MISSING | Langfuse endpoint |
| `CATALOG_REFRESH_CRON` | Optional (default: Sun 3AM) | MISSING | Model catalog refresh schedule |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `SPANIEL_SERVICE_TOKEN` (singular) should be `SPANIEL_SERVICE_TOKENS` (plural) — **CRITICAL**
- `PLATFORM_ADMIN_EMAIL` set but not referenced in Spaniel code
- `LANGFUSE_*` not set (observability disabled)

---

### 2. Ducky (Intelligence Platform) — Railway service: `ducky`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for conversations, state |
| `SPANIEL_URL` | Required (prod) | SET | `http://spaniel-api.railway.internal:5100` — correct internal URL |
| `SPANIEL_SERVICE_TOKEN` | Required (prod) | SET | Token matching Spaniel's expected value |
| `REDIS_URL` | Optional | SET | Caching and job queues |
| `SUPABASE_URL` | Required | SET | Supabase project URL |
| `SUPABASE_ANON_KEY` | Required | SET | Public auth key |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `LANGFUSE_PUBLIC_KEY` | Optional | SET | Observability enabled |
| `LANGFUSE_SECRET_KEY` | Optional | SET | Observability enabled |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `PORT` | Optional (default: 5000) | MISSING | Uses default 5000 |
| `SPANIEL_TIMEOUT_MS` | Optional (default: 30000) | MISSING | Spaniel request timeout |
| `SPANIEL_MAX_RETRIES` | Optional (default: 3) | MISSING | Spaniel retry count |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side Supabase anon key |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` missing — client-side auth broken
- `SPANIEL_SERVICE_TOKEN` matches Spaniel's Railway value, but Spaniel code reads `SPANIEL_SERVICE_TOKENS` (plural) — auth will fail until Spaniel's var is renamed

---

### 3. Core (Governance) — Railway service: `core`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL connection |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `PORT` | Optional (default: 5010) | SET (5000) | Server port — **value differs from code default (5010)** |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `DUCKY_URL` | Not used in code | SET | **Waste — not referenced in Core source** |
| `REDIS_URL` | Not used in code | SET | **Waste — not referenced in Core source** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side Supabase anon key |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `DUCKY_URL`, `REDIS_URL`, `PLATFORM_ADMIN_EMAIL` set but not used in Core code
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` missing
- `OPENROUTER_API_KEY` NOT on Railway (correct — Core doesn't need it)

---

### 4. Meridian (M&A Intelligence) — Railway service: `meridian`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for M&A data |
| `OPENROUTER_API_KEY` | Required | SET | AI status endpoint check — **should route through Ducky** |
| `DUCKY_URL` | Optional (default: localhost:5001) | SET | `http://ducky.railway.internal:5000` — correct internal URL |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `SENTRY_DSN` | Optional | SET | **WRONG VALUE** — `bposner@cavaridge.com` (not a Sentry DSN) |
| `RESEND_API_KEY` | Optional | SET | **WRONG VALUE** — `bposner@cavaridge.com` (not a Resend key) |
| `DUCKY_SERVICE_TOKEN` | Optional | **MISSING** | Auth token for Ducky calls |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Required | **MISSING** | GCS object search — **will throw at runtime** |
| `PRIVATE_OBJECT_DIR` | Required | **MISSING** | GCS private uploads — **will throw at runtime** |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `SENTRY_DSN` and `RESEND_API_KEY` have incorrect placeholder values
- `PUBLIC_OBJECT_SEARCH_PATHS` and `PRIVATE_OBJECT_DIR` missing — runtime errors on object storage
- `OPENROUTER_API_KEY` set but per architecture should use Ducky, not direct OpenRouter
- `DUCKY_SERVICE_TOKEN` missing — Ducky calls will be unauthenticated

---

### 5. Caelum (SoW Builder) — Railway service: `caelum`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for SoW data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `SESSION_SECRET` | Optional | SET | CSRF/session signing |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `DUCKY_API_URL` | Optional | **WRONG NAME** | Railway has `DUCKY_URL`, code reads `DUCKY_API_URL` — **falls back to localhost** |
| `DUCKY_SERVICE_TOKEN` | Optional | **MISSING** | Auth token for Ducky calls |
| `CSRF_SECRET` | Optional | MISSING | Falls back to SESSION_SECRET (OK) |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `DUCKY_URL` set but code reads `DUCKY_API_URL` — Ducky integration broken in production
- `OPENROUTER_API_KEY` set but not used in Caelum code
- Missing VITE_ vars for client-side auth

---

### 6. Forge (Content Creation) — Railway service: `forge`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for content data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `PORT` | Optional (default: 5007) | MISSING | Uses default |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `DUCKY_URL` | Not used in code | SET | **Waste — Forge has no Ducky integration yet** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `OPENROUTER_API_KEY` and `DUCKY_URL` set but not referenced in Forge code
- Missing VITE_ vars for client-side auth

---

### 7. HIPAA (Risk Assessment) — Railway service: `hipaa`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for assessments |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `PORT` | Optional (default: 5008) | MISSING | Uses default |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `DUCKY_URL` | Not used in code | SET | **Waste — HIPAA has no Ducky integration yet** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `OPENROUTER_API_KEY`, `DUCKY_URL` set but not used
- Missing VITE_ vars for client-side auth

---

### 8. AEGIS (Security Platform) — Railway service: `aegis`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for security data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `CLOUDFLARE_API_TOKEN` | Future use | SET | Cloudflare Gateway integration (not yet in code) |
| `REDIS_URL` | Optional | **MISSING** | BullMQ queues — queues disabled without it |
| `SPANIEL_URL` | Optional (default: localhost:5100) | **MISSING** | AI analysis — **falls back to localhost** |
| `SPANIEL_SERVICE_TOKEN` | Optional | **MISSING** | Spaniel auth |
| `SPANIEL_TIMEOUT_MS` | Optional (default: 60000) | MISSING | Spaniel request timeout |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `DUCKY_URL` | Not used in code | SET | **Waste — AEGIS talks to Spaniel directly, not Ducky** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `REDIS_URL` missing — BullMQ queues won't function
- `SPANIEL_URL` missing — AI analysis falls back to localhost (broken in production)
- `SPANIEL_SERVICE_TOKEN` missing — even if SPANIEL_URL were set, auth would fail
- `OPENROUTER_API_KEY`, `DUCKY_URL` set but not used
- `CLOUDFLARE_API_TOKEN` set but not yet referenced in code (premature, minor)

---

### 9. Midas (QBR/Roadmap) — Railway service: `midas`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for roadmap data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `APP_URL` | Optional | MISSING | OpenGraph meta tags (non-critical) |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `DUCKY_URL` | Not used in code | SET | **Waste — Midas has no Ducky integration yet** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `OPENROUTER_API_KEY`, `DUCKY_URL` set but not used
- Missing VITE_ vars for client-side auth

---

### 10. Vespar (Cloud Migration) — Railway service: `vespar`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for migration data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `DUCKY_API_URL` | Optional | **WRONG NAME** | Railway has `DUCKY_URL`, code reads `DUCKY_API_URL` — **falls back to localhost** |
| `DUCKY_SERVICE_TOKEN` | Optional | **MISSING** | Auth token for Ducky calls |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `APP_URL` | Optional | MISSING | OpenGraph meta tags (non-critical) |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `DUCKY_URL` set but code reads `DUCKY_API_URL` — Ducky integration broken
- `OPENROUTER_API_KEY` set but not used
- Missing VITE_ vars for client-side auth

---

### 11. Astra (M365 License Optimization) — Railway service: `astra`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for license data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `MICROSOFT_CLIENT_ID` | Required | SET | Microsoft OAuth app client ID |
| `MICROSOFT_CLIENT_SECRET` | Required | SET | Microsoft OAuth secret |
| `MICROSOFT_TENANT_ID` | Optional (default: common) | SET | Microsoft tenant ID |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `OPENROUTER_API_KEY` | Optional | SET | AI-powered recommendations (graceful fallback) |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `DUCKY_URL` | Not used in code | SET | **Waste — Astra doesn't reference DUCKY_URL** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `DUCKY_URL` set but not used in Astra code
- `OPENROUTER_API_KEY` is actually used here for optional AI features — acceptable
- Missing VITE_ vars for client-side auth

---

### 12. Ceres (Medicare Calculator) — Railway service: `ceres`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `OPENROUTER_API_KEY` | Optional | **MISSING** | Optional AI EMR scanner (graceful fallback) |
| `DATABASE_URL` | Not used in code | **MISSING** | In .env but **not referenced in source** |
| `SUPABASE_URL` | Not used in code | **MISSING** | In .env but **not referenced in source** |
| `SUPABASE_ANON_KEY` | Not used in code | **MISSING** | In .env but **not referenced in source** |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Notes:**
- Ceres is effectively stateless — no database, no Supabase auth in code
- Correctly minimal Railway config (only needs NODE_ENV/NODE_OPTIONS)
- `PLATFORM_ADMIN_EMAIL` is unnecessary waste

---

### 13. Brain (Voice Capture) — Railway service: `brain`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for voice/knowledge data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `PORT` | Optional (default: 5004) | MISSING | Uses default |
| `CLIENT_ORIGIN` | Optional | MISSING | CORS origin (defaults to localhost) — **broken for production** |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `DUCKY_URL` | Not used in code | SET | **Waste — Brain doesn't reference DUCKY_URL** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `CLIENT_ORIGIN` missing — CORS will block production requests (defaults to `http://localhost:5173`)
- `OPENROUTER_API_KEY`, `DUCKY_URL` set but not used
- Missing VITE_ vars for client-side auth

---

### 14. Cavalier (Channel GTM) — Railway service: `cavalier`

| Variable | Required | Railway Status | Purpose |
|----------|----------|---------------|---------|
| `DATABASE_URL` | Required | SET | PostgreSQL for partner/PSA data |
| `SUPABASE_URL` | Required | SET | Auth middleware |
| `SUPABASE_ANON_KEY` | Required | SET | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET | Admin operations |
| `NODE_ENV` | Optional | SET (production) | Environment mode |
| `NODE_OPTIONS` | Optional | SET | DNS resolution order |
| `PORT` | Optional (default: 5000) | MISSING | Uses default |
| `OPENROUTER_API_KEY` | Not used in code | SET | **Waste/security risk — remove** |
| `DUCKY_URL` | Not used in code | SET | **Waste — Cavalier doesn't reference DUCKY_URL** |
| `VITE_SUPABASE_URL` | Required (client) | **MISSING** | Client-side auth |
| `VITE_SUPABASE_ANON_KEY` | Required (client) | **MISSING** | Client-side auth |
| `PLATFORM_ADMIN_EMAIL` | Not used in code | SET | **Waste — remove** |

**Issues:**
- `OPENROUTER_API_KEY`, `DUCKY_URL` set but not used
- Missing VITE_ vars for client-side auth

---

## Summary Tables

### Variables SET but NOT USED (waste/security risk)

| Variable | Services | Action |
|----------|----------|--------|
| `OPENROUTER_API_KEY` | Meridian, Caelum, Forge, HIPAA, AEGIS, Midas, Vespar, Brain, Cavalier | **Remove from all except Spaniel and Astra** |
| `PLATFORM_ADMIN_EMAIL` | All 14 services | **Remove from all** (not referenced in any app code) |
| `DUCKY_URL` | Core, Forge, HIPAA, Midas, Astra, Brain, Cavalier | **Remove from services that don't use it** |
| `REDIS_URL` | Core | **Remove** (Core doesn't use Redis) |

### Variables USED but NOT SET (will cause errors or degraded behavior)

| Variable | Services | Severity | Action |
|----------|----------|----------|--------|
| `SPANIEL_SERVICE_TOKENS` | Spaniel | **CRITICAL** | Rename `SPANIEL_SERVICE_TOKEN` → `SPANIEL_SERVICE_TOKENS` |
| `VITE_SUPABASE_URL` | All 12 Vite apps | **HIGH** | Add to all services with client builds |
| `VITE_SUPABASE_ANON_KEY` | All 12 Vite apps | **HIGH** | Add to all services with client builds |
| `REDIS_URL` | AEGIS | **MEDIUM** | Add Redis URL for BullMQ queues |
| `SPANIEL_URL` | AEGIS | **MEDIUM** | Add `http://spaniel-api.railway.internal:5100` |
| `SPANIEL_SERVICE_TOKEN` | AEGIS | **MEDIUM** | Add matching token for Spaniel auth |
| `CLIENT_ORIGIN` | Brain | **MEDIUM** | Set to `https://brain-production-d70e.up.railway.app` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Meridian | **MEDIUM** | Configure GCS paths |
| `PRIVATE_OBJECT_DIR` | Meridian | **MEDIUM** | Configure GCS private dir |
| `DUCKY_SERVICE_TOKEN` | Meridian, Caelum, Vespar | **LOW** | Add for authenticated Ducky calls |

### Variables with WRONG VALUES

| Variable | Service | Current Value | Expected |
|----------|---------|---------------|----------|
| `SPANIEL_SERVICE_TOKEN` | Spaniel | SET (correct value) | Var name should be `SPANIEL_SERVICE_TOKENS` (plural) |
| `DUCKY_URL` | Caelum | `http://ducky.railway.internal:5000` | Code reads `DUCKY_API_URL` — rename var or update code |
| `DUCKY_URL` | Vespar | `http://ducky.railway.internal:5000` | Code reads `DUCKY_API_URL` — rename var or update code |
| `RESEND_API_KEY` | Meridian | `bposner@cavaridge.com` | Should be Resend API key (`re_...`) |
| `SENTRY_DSN` | Meridian | `bposner@cavaridge.com` | Should be Sentry DSN URL |

---

## Recommended Fix Priority

1. **IMMEDIATE** — Rename Spaniel's `SPANIEL_SERVICE_TOKEN` → `SPANIEL_SERVICE_TOKENS` (blocks all Spaniel auth)
2. **IMMEDIATE** — Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to all 12 Vite-based services (blocks client-side auth)
3. **HIGH** — Fix `DUCKY_API_URL` naming on Caelum and Vespar (or update code to read `DUCKY_URL`)
4. **HIGH** — Fix Meridian's `RESEND_API_KEY` and `SENTRY_DSN` placeholder values
5. **HIGH** — Add `REDIS_URL`, `SPANIEL_URL`, `SPANIEL_SERVICE_TOKEN` to AEGIS
6. **HIGH** — Add `CLIENT_ORIGIN` to Brain with correct production URL
7. **MEDIUM** — Remove `OPENROUTER_API_KEY` from 9 services that don't need it (security hygiene)
8. **MEDIUM** — Remove `PLATFORM_ADMIN_EMAIL` from all services (unused)
9. **MEDIUM** — Add `PUBLIC_OBJECT_SEARCH_PATHS` and `PRIVATE_OBJECT_DIR` to Meridian
10. **LOW** — Remove unused `DUCKY_URL` from 7 services that don't reference it
11. **LOW** — Add `LANGFUSE_*` keys to Spaniel for observability
12. **LOW** — Add `DUCKY_SERVICE_TOKEN` to Meridian, Caelum, Vespar for authenticated Ducky calls

---

## Internal URL Reference (Railway Private DNS)

For service-to-service communication, always use internal URLs:

| Service | Internal URL |
|---------|-------------|
| Spaniel | `http://spaniel-api.railway.internal:5100` |
| Ducky | `http://ducky.railway.internal:5000` |
| Core | `http://core.railway.internal:5010` |
| Redis | `redis://default:***@redis.railway.internal:6379` |

---

*This audit is read-only. No environment variables were modified.*
