# AUTH-FIX-RUNBOOK.md

**Document Code:** CVG-AUTH-RB-v1.0.0-20260324  
**Scope:** Fix all auth systems across the Cavaridge monorepo; wire shared auth into every app; verify all apps build and start.  
**Audience:** Claude Code CLI (builder/executor)  
**Governance:** CLAUDE.md v2.9 is authoritative. This runbook supplements — never overrides — CLAUDE.md.

---

## How to Use This Runbook

Execute **one phase at a time**. Do not skip phases. Commit to GitHub between phases so each session starts from clean state.

**Build order (locked):** Spaniel → Ducky → Caelum → Meridian → HIPAA → AEGIS → Midas → Vespar → Ceres → Astra → Brain → Forge → Cavalier → Core

**Exception — CVG-CERES:** Free public toolkit. No login, no tenant gating, no RBAC, no backend. Skip all auth wiring for Ceres. Only verify it builds and has no type errors.

---

## Phase 0 — Orientation

> **Run this first, every time you start a new session.** Do NOT write any code in this phase.

### Tasks

1. Read the following files in order:
   - `CLAUDE.md` (repo root) — governance rules, app registry, build standards
   - `packages/auth/` — entire directory, every file
   - `docs/architecture/` — all `.md` files
   - `pnpm-workspace.yaml`
   - `tsconfig.base.json` (or root `tsconfig.json`)

2. List every directory in `apps/` and `packages/` — show a tree 2 levels deep.

3. Produce a status summary covering:
   - Current state of `packages/auth/` (UTM schema, RLS policies, RBAC roles, exports)
   - Which apps import from `@cavaridge/auth` and how
   - Which apps have local/inline auth logic that should be using the shared package instead
   - Any TypeScript errors visible from a dry `pnpm tsc --noEmit` across the entire workspace

4. **Output:** A text summary. No code changes. No commits.

---

## Phase 1 — Fix `packages/auth/`

> **Goal:** Make `packages/auth/` the single source of truth for authentication, authorization, tenant hierarchy, and RBAC across the entire platform.

### UTM Spec Requirements

| Requirement | Detail |
|---|---|
| Tenant hierarchy | 4-tier, self-referencing: Platform → MSP → Client → Site/Prospect |
| Tenants table | Single `tenants` table with `parent_id` self-reference |
| RBAC roles | 6 standard roles: Platform Admin, MSP Admin, MSP Tech, Client Admin, Client Viewer, Prospect |
| RLS | Supabase Row Level Security on **every** table — no table without RLS |
| ORM | Drizzle ORM schema definitions |
| Hardcoded data | None. No hardcoded client or tenant data anywhere. |

### Tasks

1. **Audit** the current Drizzle schema in `packages/auth/` against the UTM spec above. Document every gap.

2. **Fix schema gaps.** Update Drizzle schema definitions so they match the UTM spec exactly.

3. **Generate migration SQL.** Produce Supabase-compatible migration SQL for any schema changes. Place in the appropriate migrations directory.

4. **RLS policies.** Verify RLS policies exist for every table and enforce tenant isolation. Create or fix any missing policies.

5. **Export TypeScript types:**
   - `Tenant` (with `parent_id`, `tier` enum, metadata)
   - `User`
   - `Role` (enum of the 6 standard roles)
   - `Permission`
   - Any supporting types needed by consuming apps

6. **Export Express middleware:**
   - `requireAuth` — validates session/token, attaches user + tenant to request context
   - `requireRole(role: Role)` — rejects if user lacks the specified role
   - `requireTenant(tenantId: string)` — rejects if user's tenant hierarchy doesn't include the target tenant

7. **Export helper functions:**
   - `getTenantHierarchy(tenantId: string)` — resolves the full parent chain up to Platform
   - `getUserRoleForTenant(userId: string, tenantId: string)` — returns the user's effective role for a given tenant
   - Any other helpers needed for downstream consumption

8. **Type check.** Run `pnpm tsc --noEmit` scoped to `packages/auth/`. Fix all errors. Zero errors required.

9. **Commit:** `fix(auth): align packages/auth with UTM spec`

---

## Phase 2 — Wire Auth Into Each App

> **Goal:** Every app (except Ceres) uses `@cavaridge/auth` exclusively. No local auth logic.

### Run this section once per app, in build order.

**Current app:** `[APP_CODE]` in `apps/[app-dir]`

### Tasks

1. **Remove local auth logic.** Search for any inline authentication, authorization, session handling, or role checking that does not come from `@cavaridge/auth`. Remove it. All auth must flow through the shared package.

2. **Wire `requireAuth` middleware.** Add to all API routes (Express router-level or per-route, as appropriate for the app's architecture).

3. **Wire `requireRole()` guards.** Determine the correct access model for this app based on CLAUDE.md and architecture docs, then apply role guards:
   - Platform-level apps (Core): Platform Admin only
   - MSP-level apps (Meridian, Midas, Astra, AEGIS, Caelum, Forge, Cavalier, Brain, Vespar): MSP Admin + MSP Tech minimum; specific routes may require Platform Admin
   - Client-facing features: Client Admin + Client Viewer as appropriate
   - Spaniel (LLM gateway): Service-to-service auth — only authenticated Cavaridge apps may call it
   - Ducky (user-facing intelligence): All authenticated roles

4. **Tenant-scope all queries.** Ensure every Supabase/Drizzle query is scoped by `tenant_id` derived from the authenticated request context. No unscoped queries.

5. **Theme support.** If the app has any UI, verify light/dark/system theme support exists. If missing, add CSS custom properties or Tailwind `dark:` classes.

6. **Type check.** Run `pnpm tsc --noEmit --project apps/[app-dir]`. Fix all errors. Zero errors required.

7. **Startup verification.** Attempt to start the app (or build it if it's a library). Document:
   - Whether it starts without crashing
   - Any missing environment variables (check for `process.env.*` references, `.env.example`, Doppler config refs)
   - Any runtime errors on startup

8. **Commit:** `fix([app-code]): wire shared auth, fix types, verify startup`

### App-Specific Notes

| App Code | App Name | Special Considerations |
|---|---|---|
| CVG-AI | Spaniel | LLM gateway. Service-to-service auth only. No end-user sessions. All LLM calls route through OpenRouter — verify the routing config references Doppler for the master key. |
| CVG-RESEARCH | Ducky | User-facing. Sole consumer of Spaniel. Expo (web + iOS + Android). Verify mobile auth flow. |
| CVG-CAELUM | Caelum | SoW generation. Must respect SoW Spec v2.2. Verify `SowDocumentV2` interface still aligns. |
| CVG-MER | Meridian | Consumes `@cavaridge/tenant-intel`. Verify tenant-intel integration after auth changes. |
| CVG-HIPAA | HIPAA | Compliance-sensitive. RLS enforcement is critical — double-check every query is tenant-scoped. |
| CVG-AEGIS | AEGIS | Security platform. IAR module has freemium + full tiers — verify tier gating works with RBAC. Contextual Intelligence Engine (full tier only). |
| CVG-MIDAS | Midas | Cavaridge Adjusted Score. Consumes `@cavaridge/tenant-intel`. Verify score calculation still works post-auth changes. |
| CVG-VESPAR | Vespar | Check CLAUDE.md for current scope. Wire standard auth. |
| CVG-CERES | Ceres | **SKIP AUTH WIRING.** Free public toolkit. No login, no tenant gating, no RBAC, no backend. Only verify it builds (`pnpm build`) and has zero type errors. Verify all tools are mobile-responsive and each tool has its own bookmarkable URL. |
| CVG-ASTRA | Astra | vCIO reporting. Cross-references AEGIS IAR data. Verify integration points survive auth changes. |
| CVG-BRAIN | Brain | Voice-first knowledge capture. 11 connectors in integration layer. Verify connector auth flows. |
| CVG-FORGE | Forge | Content creation. LangGraph.js pipeline. Verify pipeline auth context passes through all 5 stages. |
| CVG-CAVALIER | Cavalier Partners | Channel GTM. Uses shared Supabase project `cavaridge-platform`. Verify RLS policies on all 16 tables and 9 roles. |
| CVG-CORE | Core | Platform administration. Platform Admin only. This is the control plane — extra care on auth. |

---

## Phase 3 — Integration Smoke Test

> **Goal:** Every app in the workspace builds cleanly, has zero type errors, and has auth properly wired (except Ceres).

### Tasks

1. Run `pnpm build` from the workspace root (or per-app if workspace build isn't configured). Fix any build failures.

2. Run `pnpm tsc --noEmit` across the entire workspace. Zero errors required.

3. For every app, list all environment variables it expects. Sources to check:
   - `process.env.*` references in code
   - `.env.example` files
   - Doppler config references
   - Any hardcoded fallback values (flag these as violations)

4. **Produce a summary table:**

| App Code | Build Status | Type Errors | Missing Env Vars | Auth Wired | Theme Support | Notes |
|---|---|---|---|---|---|---|
| CVG-AI | ✅/❌ | count | list | ✅/❌ | ✅/❌/N/A | |
| CVG-RESEARCH | ✅/❌ | count | list | ✅/❌ | ✅/❌ | |
| ... | | | | | | |

5. **Commit:** `chore: workspace-wide build verification`

---

## Phase 4 — Shared Packages Audit (Optional)

> **Run if Phase 0 revealed issues in other shared packages.**

For each package in `packages/`:

1. Verify it exports clean TypeScript types with no `any` escapes.
2. Verify it has no circular dependencies.
3. Run `pnpm tsc --noEmit` — zero errors.
4. Verify consuming apps import from the package name (`@cavaridge/[pkg]`), not relative paths.
5. Commit per-package: `fix([pkg-name]): clean exports, fix types`

### Known shared packages to audit:

- `packages/auth/` (covered in Phase 1)
- `packages/tenant-intel/` (consumed by Meridian, Midas, Astra, HIPAA, Ducky)
- `packages/agent-core/`
- `packages/agent-runtime/`
- `packages/agents/`
- `packages/ducky-animations/`
- `packages/security/`
- `packages/audit/`

---

## Rules (Always in Effect)

- **Cavaridge LLC is the sole IP owner.** DIT is a client/tenant — never a co-owner. No DIT-specific values in any Cavaridge app.
- **All LLM calls** route through OpenRouter under the Cavaridge LLC master key. No app-level LLM API keys.
- **Secrets** go through Doppler (staging/prod). No plaintext keys in any repo. `.env` files are gitignored.
- **Ducky branding:** Never use "Ducky AI." Use "Ducky Intelligence" or "Ducky Intelligence by Cavaridge."
- **No hardcoded client data.** Ever. Anywhere. For any reason.
- **RLS on every table.** No exceptions.
- **Express 5 + TypeScript 5.6+.** Drizzle ORM. BullMQ + Redis. Supabase (PostgreSQL + RLS).

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-03-24 | Initial runbook |
