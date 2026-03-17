# Universal Tenant Model — Conformance Specification

**Document:** CVG-UTM-CONFORMANCE-v1.0.0-20260315.md
**Status:** APPROVED
**Author:** Claude (Architect) / Benjamin Posner (Principal, Cavaridge LLC)
**Date:** 2026-03-15
**Cavaridge IP:** All code, documentation, and intellectual property are owned exclusively by Cavaridge, LLC (D-U-N-S: 138750552)

---

## 1. Purpose

This document defines the Universal Tenant Model (UTM) and specifies exactly what must change in every existing Cavaridge application and shared package to conform to it. Claude Code should treat this as the authoritative migration checklist.

The UTM was codified in `CLAUDE.md` v2.2 (2026-03-14) after originating in the CVG-AEGIS architecture spec. It is now the **governing tenant data model** for the entire platform.

---

## 2. The Model

### 2.1 Hierarchy

```
Cavaridge (Platform Owner)          ← type: platform
└── MSP Tenant (e.g., Dedicated IT) ← type: msp
    ├── Client A (e.g., Compass SP) ← type: client
    │   ├── Site: Main Office       ← type: site
    │   └── Site: Tampa ASC         ← type: site
    ├── Client B                    ← type: client
    └── Prospect X (pre-contract)   ← type: prospect
```

### 2.2 Schema (Single Source of Truth: `packages/auth/`)

```sql
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('platform','msp','client','site','prospect')),
  parent_id     UUID REFERENCES tenants(id),
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenants_parent ON tenants(parent_id);
CREATE INDEX idx_tenants_type ON tenants(type);
```

### 2.3 Standard RBAC Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| Platform Admin | Platform | Full access, MSP provisioning, platform config |
| MSP Admin | MSP | Full access to MSP + all children (clients, sites, prospects) |
| MSP Tech | MSP | Read/write on assigned clients, no MSP-level config |
| Client Admin | Client | Full access within own client tenant, no MSP visibility |
| Client Viewer | Client | Read-only within own client tenant |
| Prospect | Prospect | Read-only on own data (freemium) |

### 2.4 RLS Policy Pattern

Every app table that stores tenant-scoped data must:

1. Include a `tenant_id UUID REFERENCES tenants(id) NOT NULL` column
2. Have an RLS policy that filters on the authenticated user's tenant chain
3. Support hierarchy traversal: MSP Admin sees all Client/Site/Prospect data within their MSP

Standard RLS function (defined once in `packages/auth/`):

```sql
CREATE OR REPLACE FUNCTION auth.tenant_visible(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    WITH RECURSIVE tenant_chain AS (
      SELECT id, parent_id FROM tenants WHERE id = check_tenant_id
      UNION ALL
      SELECT t.id, t.parent_id FROM tenants t
      JOIN tenant_chain tc ON t.id = tc.parent_id
    )
    SELECT 1 FROM tenant_chain
    WHERE id = auth.uid_tenant()  -- user's home tenant
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### 2.5 API Middleware Pattern

Every Express route must:

1. Extract `tenant_id` from the authenticated session
2. Validate the requested resource's `tenant_id` is within the user's visible tenant chain
3. Return 403 for any cross-tenant access attempt

Standard middleware (defined once in `packages/auth/`):

```typescript
// packages/auth/src/middleware/tenant-guard.ts
export function tenantGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userTenantId = req.auth.tenantId;
    const resourceTenantId = req.params.tenantId || req.body.tenantId;
    if (!await isVisibleTenant(userTenantId, resourceTenantId)) {
      return res.status(403).json({ error: 'Tenant access denied' });
    }
    next();
  };
}
```

### 2.6 UI Tenant Context

Every app UI must:

1. Include a tenant context provider wrapping the app
2. Support a tenant switcher component (MSP Admins can switch between clients)
3. Scope all data queries to the active tenant context
4. Never expose data from outside the active tenant's visible chain

---

## 3. Package Conformance: `packages/auth/`

This is the single source of truth. All other apps import from here.

### Current State (Estimated)

- Supabase auth client exists
- Basic RBAC exists
- Tenant table may be defined but not standardized

### Required Changes

| Item | Action |
|------|--------|
| `tenants` table schema | Conform to §2.2 — add `type` enum, `parent_id` self-reference, `config` JSONB |
| `tenant_visible()` function | Add recursive CTE function per §2.4 |
| RLS policies | Define reusable policy templates for consuming apps |
| `tenantGuard` middleware | Add Express middleware per §2.5 |
| `isVisibleTenant()` utility | Add DB query helper that resolves tenant chain visibility |
| `getTenantChain()` utility | Returns the full chain from a given tenant up to platform root |
| `getChildTenants()` utility | Returns all descendants of a given tenant |
| Role constants | Export `ROLES` enum with the 6 standard roles |
| Tenant context React hook | `useTenant()` — returns current tenant, switcher function, visible tenants |
| Tenant switcher component | Dropdown/selector for MSP Admins to switch active client context |
| Drizzle schema | Define `tenants` table in Drizzle ORM (exported for use in app schemas) |
| Seed data | Platform root tenant (Cavaridge) auto-created on first migration |
| Types | Export `Tenant`, `TenantType`, `Role`, `TenantConfig` TypeScript types |

---

## 4. Per-App Conformance

### 4.1 CVG-AI — Spaniel (`apps/spaniel/`)

**Architecture doc:** `docs/architecture/CVG-AI-ARCH-v1.0.0-20260310.md`

**Tenant model in Spaniel:** Spaniel is stateless — it does not own tenant data. However, it must:

| Item | Action |
|------|--------|
| `X-Tenant-ID` header | Already specified in arch doc — validate against `packages/auth/` |
| Request scoping | Log and track LLM usage per tenant for cost allocation |
| No local tenant table | Spaniel does NOT have its own `tenants` table — it trusts the header from Ducky |
| Arch doc update | Add reference: "Tenant isolation per Universal Tenant Model (CLAUDE.md §Universal Build Standards). Tenant context passed via X-Tenant-ID header, validated by Ducky before reaching Spaniel." |

**Arch doc change required:** Minimal — add UTM reference to multi-tenancy section.

---

### 4.2 CVG-RESEARCH — Ducky (`apps/ducky/`)

**Architecture doc:** `docs/architecture/CVG-RESEARCH-ARCH-v1.0.0-20260310.md`

**Tenant model in Ducky:** Ducky is the primary consumer of `packages/auth/`. All conversation state, connector data, and user sessions are tenant-scoped.

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware, `useTenant()` hook |
| Conversation scoping | All conversations stored with `tenant_id` FK |
| Connector scoping | Each connector instance (M365, Google, Slack, etc.) tied to a specific tenant |
| User sessions | User's visible tenant chain determines what data Ducky exposes |
| Tenant switcher | MSP Admin can ask Ducky about any client within their MSP |
| Arch doc update | Replace any custom tenant references with: "Multi-tenancy per Universal Tenant Model (CLAUDE.md). Implemented via packages/auth/ shared schema, RLS, and middleware." |

**Arch doc change required:** Update §Multi-Tenancy to reference UTM. Remove any standalone tenant table definition.

---

### 4.3 CVG-CAELUM — Caelum (`apps/caelum/`)

**Architecture doc:** `docs/architecture/SOW-MASTER-SPEC-v2_1.md` (SoW spec, not full arch)

**Tenant model in Caelum:** SoWs are generated in the context of an MSP tenant, scoped to a specific Client and optionally a Site.

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware |
| `sow` table | Add `tenant_id` FK (Client level — the SoW recipient) |
| `sow.msp_tenant_id` | Add FK to MSP tenant (the generator) |
| `sow.site_id` | Optional FK to site-level tenant for site-scoped SoWs |
| Template config | SoW templates stored per MSP tenant in `config` JSONB (branding, defaults) |
| Tenant switcher | MSP Admin selects Client → generates SoW for that client |
| DIT boundary | DIT SoW formatting (v2.1 spec) applied via DIT's MSP tenant config, not hardcoded |

**Arch doc change required:** Create a lightweight Caelum architecture addendum or add UTM conformance section to existing docs.

---

### 4.4 CVG-MER — Meridian (`apps/meridian/`)

**Architecture doc:** Pending (no standalone arch doc found; referenced in platform architecture)

**Tenant model in Meridian:** M&A due diligence is performed by an MSP tenant on behalf of a Client (acquisition target), scoped to Site (facility).

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware |
| `diligence_reports` table | Add `tenant_id` FK (Client = acquisition target) |
| `diligence_reports.msp_tenant_id` | FK to MSP tenant running the due diligence |
| Site scoping | DD findings can be scoped to specific Sites (e.g., individual ASCs) |
| Prospect usage | Acquisition targets that aren't yet clients can be `type: prospect` |
| AEGIS integration | Meridian can pull AEGIS posture scores for targets — both query same `tenants` table |
| Tenant-intel consumption | `@cavaridge/tenant-intel` feeds M365/GWS data per UTM tenant scoping |

**Arch doc change required:** Create Meridian architecture doc referencing UTM, or add UTM conformance section.

---

### 4.5 CVG-MIDAS — Midas (`apps/midas/`)

**Architecture doc:** `docs/architecture/CVG-MIDAS-SECURITY-SCORING-ADDENDUM-v1.0.0-20260313.md`

**Tenant model in Midas:** QBR roadmaps and IT strategy are built per Client, with portfolio-level rollup per MSP.

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware |
| `roadmap_items` table | Add `tenant_id` FK (Client level) |
| `qbr_reports` table | Add `tenant_id` FK (Client level); MSP-level rollup via `getChildTenants()` |
| Security scoring | Compensating controls catalog scoped per MSP tenant (shared across their clients) |
| AEGIS integration | Risk findings from AEGIS create roadmap items — both reference same `tenant_id` |
| Portfolio dashboard | MSP Admin sees all clients' roadmaps; Client Admin sees only their own |
| Tenant-intel consumption | License, security score, and config data pulled per UTM tenant |

**Arch doc change required:** Update Midas security scoring addendum to reference UTM for tenant scoping.

---

### 4.6 CVG-VESPAR — Vespar (`apps/vespar/`)

**Architecture doc:** None found

**Tenant model in Vespar:** Cloud migration planning is scoped to Client → Site.

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware |
| `migration_plans` table | Add `tenant_id` FK (Client level) |
| `migration_plans.site_id` | Optional FK to site-level tenant |
| Workload inventory | Scoped per Client; MSP Admin has cross-client visibility |

**Arch doc change required:** Create Vespar architecture doc with UTM conformance built in.

---

### 4.7 CVG-ASTRA — Astra (`apps/astra/`)

**Architecture doc:** None found

**Tenant model in Astra:** M365 license optimization is per Client (M365 tenant maps 1:1 to a Client or Site tenant).

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware |
| `license_snapshots` table | Add `tenant_id` FK (Client level) |
| M365 tenant mapping | Client's M365 tenant ID stored in `tenants.config` JSONB |
| Tenant-intel consumption | License utilization data pulled from `@cavaridge/tenant-intel` per UTM |
| Cross-client rollup | MSP Admin sees license optimization across all clients |

**Arch doc change required:** Create Astra architecture doc with UTM conformance built in.

---

### 4.8 CVG-HIPAA — HIPAA Toolkit (`apps/hipaa/`)

**Architecture doc:** Referenced in platform arch but no standalone found

**Tenant model in HIPAA:** Compliance assessments scoped to Client (healthcare org) → Site (ASC, practice, facility).

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware |
| `risk_assessments` table | Add `tenant_id` FK (Client level) |
| `risk_assessments.site_id` | Optional FK to site-level tenant (per-facility assessments) |
| Control state | HIPAA control findings scoped per Client; roll-up per MSP |
| AEGIS integration | Shared compliance mapper — both apps reference same `tenant_id` in shared `compliance_maps` table |
| Evidence storage | Evidence timestamped and scoped to Client + Site |

**Arch doc change required:** Create HIPAA architecture doc with UTM conformance built in.

---

### 4.9 CVG-CERES — Ceres (`apps/ceres/`)

**Architecture doc:** None (standalone calculator tool)

**Tenant model in Ceres:** Medicare 60-day frequency calculator. Minimal tenant needs — may be a public tool or scoped to MSP → Client (home health agency).

| Item | Action |
|------|--------|
| Evaluate need | If Ceres remains a simple public calculator, UTM may not apply |
| If tenant-scoped | Import `packages/auth/`, add `tenant_id` to saved calculation history |
| Recommendation | Add UTM import but keep it lightweight — tenant context optional for anonymous use |

**Arch doc change required:** None unless Ceres grows beyond a simple calculator.

---

### 4.10 CVG-BRAIN — Brain (`apps/brain/`)

**Architecture doc:** Exists (CVG-BRAIN architecture with Addendum A for connectors)

**Tenant model in Brain:** Voice-first knowledge capture. Knowledge items are tenant-scoped (users capture knowledge within their tenant context).

| Item | Action |
|------|--------|
| Import `packages/auth/` | Use shared `tenants` table, `tenantGuard` middleware |
| `knowledge_items` table | Add `tenant_id` FK — knowledge scoped to Client or MSP depending on capture context |
| Connector scoping | Brain's 11 connectors (per Addendum A) each tied to a tenant |
| Voice sessions | Scoped to authenticated user's tenant chain |

**Arch doc change required:** Update Brain architecture doc to reference UTM.

---

### 4.11 CVG-AEGIS — Aegis (`apps/aegis/`)

**Architecture doc:** `docs/architecture/CVG-AEGIS-ARCH-v1.0.0-20260314.md`

**Status: Already conforms.** AEGIS was the origin of the UTM. The arch doc has been updated to reference the universal model and `packages/auth/`.

No further changes required.

---

## 5. Shared Package Conformance

### 5.1 `@cavaridge/tenant-intel`

**Architecture doc:** `docs/architecture/TENANT-INTEL-ARCH-v1.0.0-20260313.md`

| Item | Action |
|------|--------|
| Tenant scoping | All ingested data stored with `tenant_id` FK |
| M365 tenant mapping | Graph API credentials and tenant IDs stored in `tenants.config` |
| Snapshot history | Scoped per Client tenant; MSP Admin has cross-client query access |
| Agent scoping | TenantGraph, UsagePattern, ConfigDrift agents all respect UTM RLS |

**Arch doc change required:** Update to reference UTM as the governing tenant model for all data scoping.

---

### 5.2 `@cavaridge/agent-core` / `@cavaridge/agent-runtime` / `@cavaridge/agents`

| Item | Action |
|------|--------|
| Agent context | Every agent invocation receives `tenantId` in its context object |
| Data access | Agents query data through Drizzle ORM with tenant-scoped filters |
| Langfuse traces | Tagged with `tenant_id` for per-tenant observability |

---

## 6. Migration Order

This migration should happen in dependency order:

```
1. packages/auth/         ← Define UTM schema, RLS, middleware, hooks, types
2. packages/agent-core/   ← Add tenant context to agent invocation interface
3. apps/spaniel/          ← Minimal: validate X-Tenant-ID header logging
4. apps/ducky/            ← Primary UTM consumer: conversations, connectors, sessions
5. apps/caelum/           ← SoW scoping to Client/Site
6. apps/meridian/         ← DD reports scoped to Client/Site
7. apps/hipaa/            ← Risk assessments scoped to Client/Site
8. apps/aegis/            ← Already conforms (verify)
9. apps/midas/            ← Roadmap/QBR scoped to Client, portfolio rollup to MSP
10. apps/astra/           ← License snapshots scoped to Client
11. apps/vespar/          ← Migration plans scoped to Client/Site
12. apps/brain/           ← Knowledge items scoped to tenant chain
13. apps/ceres/           ← Lightweight: optional tenant context
14. packages/tenant-intel/ ← Ingested data scoped per Client tenant
```

Steps 1-2 are prerequisites. Steps 3-13 can proceed in build order or as apps come online. Step 14 follows whenever tenant-intel is built.

---

## 7. Verification Checklist (Per App)

For each app, Claude Code should verify:

- [ ] App imports `@cavaridge/auth` — not its own tenant definition
- [ ] All data tables include `tenant_id UUID REFERENCES tenants(id) NOT NULL`
- [ ] RLS policies use `auth.tenant_visible()` function from `packages/auth/`
- [ ] Express routes use `tenantGuard()` middleware from `packages/auth/`
- [ ] UI wraps app in `TenantProvider` from `packages/auth/`
- [ ] UI includes tenant switcher for MSP Admin role
- [ ] No hardcoded client data — all client-specific config in `tenants.config` JSONB
- [ ] DIT is configured as an MSP tenant record, not embedded in code
- [ ] Drizzle schema references shared `tenants` table, not a local copy
- [ ] Supabase migration files create RLS policies on every tenant-scoped table

---

## 8. Architecture Doc Updates Required

| Document | Path | Change |
|----------|------|--------|
| CVG-AI (Spaniel) | `docs/architecture/CVG-AI-ARCH-v1.0.0-20260310.md` | Add UTM reference to multi-tenancy section |
| CVG-RESEARCH (Ducky) | `docs/architecture/CVG-RESEARCH-ARCH-v1.0.0-20260310.md` | Replace custom tenant model with UTM reference |
| CVG-AEGIS | `docs/architecture/CVG-AEGIS-ARCH-v1.0.0-20260314.md` | Already updated — verify |
| Tenant-Intel | `docs/architecture/TENANT-INTEL-ARCH-v1.0.0-20260313.md` | Add UTM reference for all data scoping |
| Midas Security Scoring | `docs/architecture/CVG-MIDAS-SECURITY-SCORING-ADDENDUM-v1.0.0-20260313.md` | Add UTM reference for tenant scoping |
| CVG-BRAIN | `docs/architecture/CVG-BRAIN-ARCH-*.md` | Add UTM reference |
| **NEW: CVG-CAELUM** | `docs/architecture/CVG-CAELUM-ARCH-v1.0.0-20260315.md` | Create — SoW scoping, DIT tenant config, UTM conformance |
| **NEW: CVG-MER** | `docs/architecture/CVG-MER-ARCH-v1.0.0-20260315.md` | Create — DD scoping, target-as-prospect, UTM conformance |
| **NEW: CVG-HIPAA** | `docs/architecture/CVG-HIPAA-ARCH-v1.0.0-20260315.md` | Create — compliance scoping, site-level assessments, AEGIS shared mapper |
| **NEW: CVG-MIDAS** | `docs/architecture/CVG-MIDAS-ARCH-v1.0.0-20260315.md` | Create — roadmap/QBR scoping, portfolio rollup, security scoring ref |
| **NEW: CVG-ASTRA** | `docs/architecture/CVG-ASTRA-ARCH-v1.0.0-20260315.md` | Create — license optimization scoping, M365 tenant mapping |
| **NEW: CVG-VESPAR** | `docs/architecture/CVG-VESPAR-ARCH-v1.0.0-20260315.md` | Create — migration plan scoping, site-level workloads |

---

*End of document. This conformance specification is the property of Cavaridge, LLC.*
