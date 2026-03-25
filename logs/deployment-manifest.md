# Cavaridge Platform — Deployment Manifest

**Generated:** 2026-03-25
**Railway Project:** endearing-spirit (`e6bcc145-4a60-4da0-9215-ad4a3aac68c0`)
**Railway Environment:** production
**Supabase Project:** cavaridge-platform (`rastlfqertdllarbciwv`, us-west-2)
**Redis:** Railway-hosted (`redis://default:***@redis.railway.internal:6379`)

---

## Infrastructure Status

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase PostgreSQL 17 | ACTIVE_HEALTHY | `rastlfqertdllarbciwv.supabase.co` |
| Redis (Railway) | PROVISIONED | Internal: `redis.railway.internal:6379` |
| Railway Project | ACTIVE | 14 services deployed, 1 pending first deploy (core) |

---

## Supabase Migration Status

**15 migration files** in `migrations/`:

| # | Migration | Status |
|---|-----------|--------|
| 000 | `000_platform_setup.sql` | Previously applied |
| 000b | `000b_tenants_bootstrap.sql` | Previously applied |
| 001 | `001_cavalier_partners.sql` | Previously applied |
| 002 | `002_role_grants.sql` | Previously applied |
| 003 | `003_spaniel_gateway.sql` | Previously applied |
| 004 | `004_meridian.sql` | Previously applied |
| 005 | `005_midas.sql` | Previously applied |
| 006 | `006_ducky.sql` | Previously applied |
| 007 | `007_caelum.sql` | Previously applied |
| 008 | `008_astra.sql` | Previously applied |
| 009 | `009_vespar.sql` | Previously applied |
| 010 | `010_data_import.sql` | Previously applied |
| 011 | `011_aegis.sql` | Previously applied |
| 012 | `012_fix_auth_foundation.sql` | Previously applied |
| 013 | `013_create_all_app_schemas.sql` | Previously applied |
| 014 | `014_utm_auth_alignment.sql` | NEEDS VERIFICATION |

**To verify/apply migration 014:**
```bash
node scripts/run-migration.mjs migrations/014_utm_auth_alignment.sql
```

**UTM Features in migration 014:**
- `tenant_type` enum: platform, msp, client, site, prospect
- `role` enum: platform_admin, msp_admin, msp_tech, client_admin, client_viewer, prospect
- `tenant_memberships` table with user-tenant-role junction
- RLS policies on tenants, profiles, tenant_memberships, invites
- Hierarchical access control (downward only)

---

## App Deployment Status

### Tier 1 — Infrastructure Services

| Service | Railway Name | Public URL | Internal URL | Health | Dockerfile |
|---------|-------------|------------|--------------|--------|------------|
| Spaniel (LLM Gateway) | spaniel-api | `spaniel-api-production.up.railway.app` | `spaniel-api.railway.internal` | 502 (crash — queue name fix applied, redeploy needed) | `Dockerfile.spaniel` |
| Redis | (Railway plugin) | N/A | `redis.railway.internal:6379` | OK | N/A |

**Spaniel required env vars:**
- `OPENROUTER_API_KEY` — SET
- `REDIS_URL` — SET
- `PORT` — SET (5100)
- `DATABASE_URL` — NOT SET (needs Supabase pooler URL)
- `SUPABASE_URL` — NOT SET
- `SUPABASE_SERVICE_ROLE_KEY` — NOT SET
- `SPANIEL_SERVICE_TOKENS` — NOT SET (generate and distribute to consuming services)

**Spaniel fix applied:** Queue name `spaniel:model-catalog-refresh` → `spaniel-model-catalog-refresh` (BullMQ rejects colons). Redeploy will pick this up.

### Tier 2 — AI Layer

| Service | Railway Name | Public URL | Internal URL | Health | Dockerfile |
|---------|-------------|------------|--------------|--------|------------|
| Ducky (Intelligence) | ducky | `ducky-production.up.railway.app` | `ducky.railway.internal` | 200 OK | `Dockerfile.ducky` |

**Ducky required env vars:**
- `DATABASE_URL` — SET
- `SUPABASE_URL` — SET
- `SUPABASE_ANON_KEY` — SET (via VITE_SUPABASE_ANON_KEY)
- `SUPABASE_SERVICE_ROLE_KEY` — SET
- `SPANIEL_URL` — NOT SET (set to `http://spaniel-api.railway.internal:5100`)
- `REDIS_URL` — NOT SET
- `LANGFUSE_PUBLIC_KEY` — NOT SET (optional)
- `LANGFUSE_SECRET_KEY` — NOT SET (optional)

### Tier 3 — Application Services

| Service | Railway Name | Public URL | Health | Dockerfile |
|---------|-------------|------------|--------|------------|
| Core (Governance) | core | `core-production-777b.up.railway.app` | PENDING (first deploy) | `Dockerfile.core` |
| Meridian (M&A Intel) | meridian | `meridian-production-0259.up.railway.app` | 200 OK | `Dockerfile.meridian` |
| Caelum (SoW Builder) | caelum | `caelum-production.up.railway.app` | 200 OK | `Dockerfile.caelum` |
| Forge (Content Creation) | forge | `forge-production-3152.up.railway.app` | 200 OK | `Dockerfile.forge` |
| HIPAA (Risk Assessment) | hipaa | `hipaa-production.up.railway.app` | 200 OK | `Dockerfile.hipaa` |
| AEGIS (Security) | aegis | `aegis-production-0a77.up.railway.app` | CRASH (missing `postgres` module — Dockerfile fix applied, redeploy needed) | `Dockerfile.aegis` |
| Midas (QBR/Roadmap) | midas | `midas-production-5780.up.railway.app` | 200 OK | `Dockerfile.midas` |
| Vespar (Cloud Migration) | vespar | `vespar-production.up.railway.app` | 200 OK | `Dockerfile.vespar` |
| Astra (M365 License) | astra | `astra.app.cavaridge.com` | 200 OK | `Dockerfile.astra` |
| Ceres (Medicare Calc) | ceres | `ceres-production.up.railway.app` | 200 OK | `Dockerfile.ceres` |
| Brain (Voice Capture) | brain | `brain-production-d70e.up.railway.app` | CRASH (missing `ws` module — Dockerfile fix applied, redeploy needed) | `Dockerfile.brain` |
| Cavalier (Channel GTM) | cavalier | `cavalier-production-66c7.up.railway.app` | TIMEOUT (missing externals — Dockerfile fix applied, redeploy needed) | `Dockerfile.cavalier` |

### Health Check Summary

| Status | Count | Services |
|--------|-------|----------|
| 200 OK | 8 | ducky, meridian, caelum, forge, hipaa, midas, vespar, astra, ceres |
| 502/CRASH | 3 | spaniel (queue name colon), aegis (missing postgres), brain (missing ws) |
| TIMEOUT | 1 | cavalier (missing externals) |
| PENDING | 1 | core (not yet deployed) |

---

## Required Env Vars Per Service

All services share these common variables (already set on most):
- `DATABASE_URL` — Supabase pooler connection string
- `SUPABASE_URL` — `https://rastlfqertdllarbciwv.supabase.co`
- `SUPABASE_ANON_KEY` — Supabase anon JWT
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role JWT
- `NODE_ENV` — `production`
- `NODE_OPTIONS` — `--dns-result-order=ipv4first`
- `RAILWAY_DOCKERFILE_PATH` — Set per service

**Service-specific vars:**

| Service | Additional Required Vars | Status |
|---------|-------------------------|--------|
| Spaniel | `OPENROUTER_API_KEY`, `REDIS_URL`, `PORT=5100`, `SPANIEL_SERVICE_TOKENS` | Partial (tokens missing) |
| Ducky | `SPANIEL_URL`, `REDIS_URL`, `LANGFUSE_*` (optional) | Missing SPANIEL_URL, REDIS_URL |
| Aegis | `REDIS_URL` | NOT SET |
| Astra | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | NOT SET (placeholder needed) |
| Core | All base vars | SET |
| All others | `DUCKY_URL` (optional) | NOT SET on most |

---

## Fixes Applied (Pending Redeploy)

1. **Spaniel** — `apps/spaniel/server/workers/model-catalog-refresh.ts`: Queue name `spaniel:model-catalog-refresh` → `spaniel-model-catalog-refresh` (BullMQ prohibits colons)
2. **Aegis** — `Dockerfile.aegis`: Added `RUN npm install --no-save postgres@3 bullmq@5 ioredis@5` in production stage
3. **Brain** — `Dockerfile.brain`: Added `RUN npm install --no-save ws@8 pg@8` in production stage
4. **Cavalier** — `Dockerfile.cavalier`: Added `RUN npm install --no-save postgres@3 bullmq@5 ioredis@5 openai@4` in production stage

---

## New Files Created

| File | Purpose |
|------|---------|
| `Dockerfile.core` | Multi-stage Docker build for core governance service |
| `apps/spaniel/railway.toml` | Railway deployment config for Spaniel |
| `apps/ducky/railway.toml` | Railway deployment config for Ducky |
| `apps/core/railway.toml` | Railway deployment config for Core |
| `apps/meridian/railway.toml` | Railway deployment config for Meridian |
| `apps/caelum/railway.toml` | Railway deployment config for Caelum |
| `apps/forge/railway.toml` | Railway deployment config for Forge |
| `apps/hipaa/railway.toml` | Railway deployment config for HIPAA |
| `apps/aegis/railway.toml` | Railway deployment config for AEGIS |
| `apps/midas/railway.toml` | Railway deployment config for Midas |
| `apps/vespar/railway.toml` | Railway deployment config for Vespar |
| `apps/astra/railway.toml` | Railway deployment config for Astra |
| `apps/ceres/railway.toml` | Railway deployment config for Ceres |
| `apps/brain/railway.toml` | Railway deployment config for Brain |
| `apps/cavalier/railway.toml` | Railway deployment config for Cavalier |
| `scripts/seed-platform.ts` | Idempotent seed script (platform + MSP tenants, admin users) |

---

## Seed Script

**File:** `scripts/seed-platform.ts`

Creates:
1. Platform tenant: "Cavaridge, LLC" (type: platform)
2. MSP tenant: "Dedicated IT" (type: msp, child of platform)
3. Platform Admin user: `bposner@cavaridge.com` (role: platform_admin)
4. MSP Admin user: `admin@dedicatedit.com` (role: msp_admin)

**Run with:**
```bash
SUPABASE_URL=https://rastlfqertdllarbciwv.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
pnpm tsx scripts/seed-platform.ts
```

---

## What Works End-to-End

| Capability | Status |
|------------|--------|
| 9 apps serving HTTP (ducky, meridian, caelum, forge, hipaa, midas, vespar, astra, ceres) | WORKING |
| Health endpoints responding | 9/14 (8 OK + ceres OK) |
| Supabase database | ACTIVE_HEALTHY |
| Redis cache | PROVISIONED |
| TypeScript compilation (25/25 workspace checks) | PASSING |
| Railway deployment pipeline | CONFIGURED |

## What Needs Action

| Action | Blocking |
|--------|----------|
| Approve Supabase MCP tools to verify/apply migration 014 | Migration verification |
| Push commit to trigger redeploy of spaniel, aegis, brain, cavalier | 4 services |
| Set `SPANIEL_URL=http://spaniel-api.railway.internal:5100` on Ducky | Ducky → Spaniel routing |
| Set `REDIS_URL` on Ducky and AEGIS | Caching, job queues |
| Set `SPANIEL_SERVICE_TOKENS` on Spaniel | Service auth |
| Set Microsoft Graph API credentials on Astra | M365 integration |
| Run `scripts/seed-platform.ts` | Platform bootstrap |
| First deploy of Core service | Core availability |

---

## Post-Deploy Verification Commands

```bash
# Test Spaniel model list
curl -X POST https://spaniel-api-production.up.railway.app/api/v1/models

# Test Ducky app query
curl -X POST https://ducky-production.up.railway.app/v1/app-query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'

# Test any app health
curl https://<app-domain>.up.railway.app/healthz
curl https://<app-domain>.up.railway.app/api/v1/health
```
