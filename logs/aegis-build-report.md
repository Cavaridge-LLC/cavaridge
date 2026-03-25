# CVG-AEGIS Build Report

**Date:** 2026-03-24
**Version:** 0.2.0
**Status:** Build complete, all type checks pass, all 51 tests pass

---

## Summary

Built the AEGIS server-side Express 5 API to spec with 10 new route modules, 4 service modules, a Drizzle schema, and 3 test suites. All code is TypeScript 5.6+ strict mode compliant with zero type errors.

---

## What Was Built

### 1. Cavaridge Adjusted Score Engine (`server/services/adjusted-score.ts`)
- Composite 0-100 security posture metric with 6 weighted signals
- Default weights: MS Secure Score 25%, Browser Security 20%, Google Workspace 15%, Credential Hygiene 15%, DNS Filtering 10%, SaaS Shadow IT 15%
- Compensating Controls +5 max additive bonus
- Weight redistribution when signals are unconfigured
- Input validation for custom weight configurations

### 2. Compensating Controls Engine (`server/services/compensating-controls.ts`)
- 8 pre-defined control definitions: SentinelOne EDR, CrowdStrike Falcon, Duo MFA, Entra ID MFA, Proofpoint, Conditional Access, Datto BCDR, Mimecast
- Auto-detection + manual override evaluation logic
- Flag suppression/downgrade mapping per NIST 800-63B
- Bonus point calculation with configurable cap
- CRUD routes: `server/routes/compensating-controls.ts`

### 3. ConnectSecure Integration (`server/services/connectsecure.ts`, `server/routes/connectsecure.ts`)
- Full type definitions for ConnectSecure vulnerability and compliance scan data
- Mapping engine: ConnectSecure findings -> AEGIS internal risk model
- Remediation priority scoring (0-100) based on CVSS, severity, asset type, age
- Composite risk score calculation for Adjusted Score feed
- Framework mapping (NIST CSF, CIS Controls, SOC2)
- API: POST /ingest, GET /, GET /:id

### 4. Identity Access Review (IAR) Module (`server/services/iar-engine.ts`, `server/routes/iar.ts`)
- **Freemium tier:** Base severity flags only, no auth, no data retention (except lead capture)
  - POST /api/v1/iar/freemium (public)
- **Full tier:** 3-layer Contextual Intelligence Engine
  - Layer 1: Compensating Control Awareness (suppress/downgrade based on Duo, Entra MFA, etc.)
  - Layer 2: Business Context Modifiers (contractor-heavy, M&A-active, vendor density)
  - Layer 3: Report Tone Engine (never frames findings as MSP negligence)
- 8 deterministic risk flags per CLAUDE.md spec:
  - Blocked but Licensed (High)
  - External with License (High)
  - Inactive Licensed >180d (High)
  - No MFA Registered (High)
  - Inactive Licensed >90d (Medium)
  - Licensed No Activity Data (Medium)
  - Password Never Expires (Medium)
  - Stale External Guest (Low)
- Historical delta engine for full-tier reviews
- CSV field mapping for M365 Admin Center exports

### 5. Freemium Scan Landing Page API (`server/routes/scan.ts` — existing, verified)
- POST /api/v1/scan/public — no auth, runs DNS/TLS/port scan, captures prospect info

### 6. Security Posture Dashboard API (`server/routes/dashboard.ts`)
- GET /overview — MSP-level aggregate: scores, devices, scans, SaaS, IAR summary
- GET /client/:clientTenantId — client-level detail with all security dimensions
- GET /trends — time-series score trending with configurable window
- GET /peer-comparison — anonymized percentile benchmarking across all tenants

### 7. AEGIS Probe (`server/routes/probes.ts`)
- POST /register — Raspberry Pi probe registration via enrollment token
- POST /:id/heartbeat — probe keepalive with firmware/IP updates
- POST /:id/results — scan result ingestion from probe
- GET / — list probes for tenant
- GET /:id — probe detail with recent scan results
- POST /:id/scan — initiate scan from probe (MSP Admin)

### 8. Penetration Testing Tiers (`server/routes/pentest.ts`)
- Tier 1: "AEGIS Security Validation" (Nuclei automated)
- Tier 2: "AEGIS Red Team" (Horizon3.ai NodeZero)
- Authorization workflow: create -> authorize -> start -> complete
- Tier 2 requires explicit written authorization document URL
- API: POST /, GET /, GET /:id, POST /:id/authorize, POST /:id/start, POST /:id/complete

### 9. AI Analysis via Ducky (`server/services/ai-analysis.ts`, `server/routes/ai-analysis.ts`)
- All AI calls route through Ducky (app_code=CVG-AEGIS) via Spaniel HTTP client
- 4 analysis types: risk_narrative, executive_summary, remediation_priority, posture_report
- System prompts enforce AEGIS framing rules (never MSP negligence)
- Spaniel client: `server/lib/spaniel-client.ts` (retry, timeout, bearer auth)

### 10. Report Generation (`server/routes/reports.ts`)
- POST /generate — builds structured report payload from all AEGIS data sources
- Gathers: Adjusted Score, score history, SaaS discovery, IAR, compensating controls
- Optional AI narrative injection via Ducky
- Phase 1: JSON structure; Phase 2: DOCX/PDF via Caelum rendering engine

### 11. Tenant Profiles (`server/routes/tenant-profiles.ts`)
- Business context profiles for IAR Contextual Intelligence Engine
- Industry vertical, M&A status, multi-site, contractor model, vendor density
- GET/PUT per client tenant (MSP Admin)

### 12. Drizzle ORM Schema (`server/schema/index.ts`)
- 16 tables in `aegis` schema with full type inference
- All tables tenant-scoped via `tenant_id`
- Indexes on all foreign keys and common query patterns

---

## Files Created/Modified

### New Files (20)
- `server/schema/index.ts` — Drizzle ORM schema (16 tables)
- `server/services/adjusted-score.ts` — Score calculation engine
- `server/services/compensating-controls.ts` — Controls engine + catalog
- `server/services/iar-engine.ts` — IAR risk flag engine + contextual intelligence
- `server/services/ai-analysis.ts` — Ducky/Spaniel AI integration
- `server/services/connectsecure.ts` — ConnectSecure data mapping
- `server/lib/spaniel-client.ts` — HTTP client for Spaniel gateway
- `server/routes/iar.ts` — IAR routes (freemium + full)
- `server/routes/compensating-controls.ts` — Controls CRUD
- `server/routes/connectsecure.ts` — ConnectSecure ingestion
- `server/routes/probes.ts` — Probe management
- `server/routes/pentest.ts` — Pen test engagement workflow
- `server/routes/dashboard.ts` — Dashboard aggregation
- `server/routes/ai-analysis.ts` — AI analysis endpoints
- `server/routes/reports.ts` — Report generation
- `server/routes/tenant-profiles.ts` — Business context profiles
- `tests/adjusted-score.test.ts` — 13 tests
- `tests/compensating-controls.test.ts` — 14 tests
- `tests/iar-engine.test.ts` — 24 tests
- `vitest.config.ts` — Test configuration

### Modified Files (3)
- `server/index.ts` — Wired all new routes, updated to v0.2.0
- `server/routes/score.ts` — Imported DEFAULT_WEIGHTS from service
- `package.json` — Added vitest, check/test scripts, bumped to v0.2.0

---

## Test Results

```
Test Files   3 passed (3)
Tests        51 passed (51)
Duration     221ms
```

- `adjusted-score.test.ts` — 13 tests: score calculation, weight redistribution, compensating bonus, clamping, custom weights
- `compensating-controls.test.ts` — 14 tests: auto-detection, manual overrides, bonus calculation, flag suppressions, catalog
- `iar-engine.test.ts` — 24 tests: all 8 flag types, compensating control adjustments, business context modifiers, executive summary tone, MSP negligence prevention, freemium vs full tier

## Type Check

```
pnpm tsc --noEmit — 0 errors
```

---

## Architecture Notes

- All routes follow existing AEGIS patterns (raw SQL via db.execute with `{ sql, params }`)
- Auth: `@cavaridge/auth` — `requireAuth` + `requireRole(ROLES.MSP_TECH)` at mount level
- Public endpoints: enrollment, telemetry batch, scan public, IAR freemium, probe register/heartbeat/results
- AI: Spaniel HTTP client (same pattern as Ducky's `spaniel-client.ts`)
- Schema uses `aegis` Postgres schema namespace (consistent with existing SQL)
- No direct OpenRouter imports — all AI through Spaniel
- Tenant-scoped: every data query filters by `tenant_id`
- RBAC: MSP Tech+ for reads, MSP Admin for writes (enforced per route)

---

## Remaining Work (Future Phases)

- Phase 2: DOCX/PDF rendering via Caelum shared engine
- Phase 2: BullMQ queue-based scan processing (currently synchronous)
- Phase 2: Microsoft Graph API direct pull for IAR (zero-touch)
- Phase 3: Cloudflare Gateway DNS filtering integration
- Phase 3: HIBP credential breach monitoring
- Phase 4: Astra cross-sell integration (license optimization from IAR data)
- Phase 4: Cavalier Partners co-branded freemium packaging
