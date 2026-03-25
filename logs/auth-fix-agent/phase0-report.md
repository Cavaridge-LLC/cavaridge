# Phase 0 — Auth Package Audit Report

**Date:** 2026-03-24
**Scope:** `packages/auth/`, all apps in `apps/`, root TypeScript config, RLS policies

---

## 1. Directory Tree (2 levels deep)

### apps/
```
apps/
├── aegis/         (extension/, server/, client/)
├── astra/         (server/, client/)
├── brain/         (server/, client/ — placeholder)
├── caelum/        (server/, client/, shared/, script/)
├── cavalier/      (server/, client/)
├── ceres/         (server/, client/, mobile/)
├── core/          (server/, client/)
├── ducky/         (server/, client/, shared/, migrations/, tests/, scripts/)
├── forge/         (server/, client/, shared/, script/)
├── hipaa/         (server/, client/, shared/, tests/, script/)
├── meridian/      (server/, client/, shared/, tests/, scripts/, drizzle/)
├── midas/         (server/, client/, shared/, script/)
├── spaniel/       (server/)
└── vespar/        (server/, client/, shared/, script/)
```

### packages/
```
packages/
├── agent-core/
├── agent-runtime/
├── agent-test/
├── agents/
├── audit/
├── auth/            ← THIS AUDIT
├── blueprints/
├── config/
├── connector-core/
├── connector-sdk/
├── connectors/      (ninjaone/, halopsa/, guardz/, atera/, syncro/)
├── db/
├── domain-agents/
├── ducky-animations/
├── onboarding/
├── psa-core/
├── report-templates/
├── security/
├── spaniel/
├── tenant-intel/
├── types/
└── ui/
```

---

## 2. packages/auth/ — Current State

### 2.1 Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | RBAC constants (5-role hierarchy), `hasMinimumRole()`, `isPlatformRole()`, re-exports providers |
| `src/schema.ts` | Drizzle table definitions: `tenants`, `profiles`, `invites` + re-export of `auditLog` from `@cavaridge/audit` |
| `src/server.ts` | Express middleware: `createSupabaseServerClient`, `createSupabaseAdminClient`, `createAuthMiddleware`, `requireAuth`, `requirePlatformRole`, `createPermissionMiddleware`, `extractBearerToken` |
| `src/client.tsx` | React context: `SupabaseAuthProvider`, `useAuth`, `useSupabase`, `useAuthProps`, `AuthCallback`, `AuthRecoveryHandler` |
| `src/guards.ts` | Express guards: `requireRole`, `requirePlatformAdmin`, `requireMinRole`, `requireTenantAccess` |
| `src/routes.ts` | Route factory: `registerAuthRoutes` (setup-profile, /me, callback, logout) |
| `src/admin-routes.ts` | Platform admin API: tenant CRUD, user mgmt, invites, audit log |
| `src/functions.ts` | Auth functions: signIn/signUp/signOut, OAuth (Google, Microsoft), password reset |
| `src/providers.ts` | Provider registry: Azure (enabled), Google (enabled), Apple (disabled) |
| `src/middleware.ts` | Re-export barrel for server.ts + guards.ts |
| `src/rls.sql` | Reference RLS policies (not auto-applied) |

### 2.2 Tables / Schema Defined

| Table | Columns | Notes |
|-------|---------|-------|
| `tenants` | id, name, slug, type, parentId, ownerUserId, planTier, maxUsers, isActive, status, config, createdAt, updatedAt | 4-tier hierarchy: platform→msp→client→site/prospect |
| `profiles` | id (=auth.users.id), email, displayName, avatarUrl, role, organizationId, isPlatformUser, status, createdAt, updatedAt | 1:1 with Supabase auth.users |
| `invites` | id, email, tenantId, role, invitedBy, token, status, expiresAt, createdAt | Pending/accepted/expired invitations |
| `organizations` | (alias) | `= tenants` — deprecated backward-compat alias |
| `auditLog` | (re-exported) | From `@cavaridge/audit/schema` |

### 2.3 RLS Policies (rls.sql — reference only)

| Table | Policy | Rule |
|-------|--------|------|
| `profiles` | profiles_select_own | `auth.uid() = id` |
| `profiles` | profiles_update_own | `auth.uid() = id` |
| `profiles` | profiles_insert_own | `auth.uid() = id` |
| `organizations` | orgs_select_own | `id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())` |
| `organizations` | orgs_update_admin | Same subquery + role IN (platform_owner, platform_admin, tenant_admin) |
| `audit_log` | audit_select_own_org | `organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())` |

**Note:** `invites` table has NO RLS policies defined in rls.sql. Tenant-scoped data table template is provided but not applied.

### 2.4 RBAC Roles Defined

5-role hierarchy (highest to lowest privilege):

1. **platform_owner** — Full platform access (Cavaridge operators)
2. **platform_admin** — Full platform access (Cavaridge operators)
3. **tenant_admin** — Tenant-level admin
4. **user** — Standard user
5. **viewer** — Read-only

**Gap vs. CLAUDE.md spec:** CLAUDE.md defines 6 roles (Platform Admin, MSP Admin, MSP Tech, Client Admin, Client Viewer, Prospect). The implemented 5-role model doesn't match — missing MSP Admin, MSP Tech, Client Admin, Client Viewer, and Prospect roles. The current model is a simplified approximation.

### 2.5 Package Exports (package.json)

```json
{
  ".": "./src/index.ts",
  "./server": "./src/server.ts",
  "./client": "./src/client.tsx",
  "./middleware": "./src/middleware.ts",
  "./schema": "./src/schema.ts",
  "./routes": "./src/routes.ts",
  "./providers": "./src/providers.ts",
  "./functions": "./src/functions.ts",
  "./guards": "./src/guards.ts",
  "./admin-routes": "./src/admin-routes.ts"
}
```

Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `@cavaridge/audit`
Peer deps: `express ^5`, `react ^18||^19`, `drizzle-orm >=0.39`

---

## 3. Per-App Auth Integration

### Apps that import `@cavaridge/auth` (in package.json)

| App | Has Dep | Auth Pattern | Local `loadUser`? | Notes |
|-----|---------|-------------|-------------------|-------|
| **meridian** | Yes | `createAuthMiddleware(db, profiles, tenants)` | No — uses shared `createAuthMiddleware` | Clean delegation. Has app-specific `verifyDealAccess`, `requirePlatformOwner` |
| **ducky** | Yes | `createAuthMiddleware(db, profiles, tenants)` | No — uses shared `createAuthMiddleware` | Clean delegation. Uses `createPermissionMiddleware` |
| **vespar** | Yes | `createAuthMiddleware(db, profiles, organizations)` | No — uses shared `createAuthMiddleware` | Clean delegation. Has app-specific `requireProjectAccess` |
| **caelum** | Yes | Custom `loadUser()` | **YES** — full copy of auth middleware logic | Duplicates `createAuthMiddleware` logic inline |
| **astra** | Yes | Custom `loadUser()` | **YES** — full copy of auth middleware logic | Duplicates `createAuthMiddleware` logic inline |
| **midas** | Yes | Custom `loadUser()` | **YES** — full copy of auth middleware logic | Duplicates `createAuthMiddleware` logic inline |
| **hipaa** | Yes | Custom `loadUser()` | **YES** — full copy of auth middleware logic | Duplicates `createAuthMiddleware` logic inline |
| **forge** | Yes | Custom `loadUser()` | **YES** — full copy of auth middleware logic | Duplicates `createAuthMiddleware` logic inline |
| **brain** | Yes | Dep declared, no server auth files found | N/A | Placeholder / early scaffold |
| **spaniel** | No | Service-to-service Bearer token auth | N/A | Correct — Spaniel is not user-facing |
| **aegis** | No | No dep, no auth middleware | N/A | No `@cavaridge/auth` dep in package.json |
| **cavalier** | No | No dep, no auth middleware | N/A | No `@cavaridge/auth` dep in package.json |
| **ceres** | No | No dep, no auth middleware | N/A | No `@cavaridge/auth` dep in package.json |
| **core** | No | No dep, no auth middleware | N/A | No `@cavaridge/auth` dep in package.json |

### Key Finding: 5 Apps Duplicate Auth Middleware

**caelum, astra, midas, hipaa, forge** all have a local `loadUser()` function in `server/services/auth/middleware.ts` that is an exact copy of what `createAuthMiddleware` produces. These should use the shared function (like meridian, ducky, and vespar do).

The duplicated pattern:
1. Creates Supabase server client
2. Extracts Bearer token
3. Gets user from Supabase
4. Loads profile from DB
5. Loads tenant record (platform roles skip isActive check)
6. Sets req.user, req.tenant, req.org, req.tenantId, req.orgId

This is identical to `createAuthMiddleware` in `packages/auth/src/server.ts` with one difference: the shared version uses a conditional `isPlatformRole` check that only loads tenant if the role is platform, while the duplicated versions always load tenant for any user with an `organizationId`. **The shared version actually has a bug here** — non-platform users without `organizationId` get no tenant loaded, but the condition structure differs from the local copies.

---

## 4. TypeScript Error Counts

**Total errors (root `pnpm tsc --noEmit`):** 15,786

### Per App

| App | Errors |
|-----|--------|
| meridian | 3,898 |
| vespar | 1,865 |
| midas | 1,523 |
| astra | 1,503 |
| caelum | 1,443 |
| ceres | 1,348 |
| ducky | 888 |
| hipaa | 511 |
| cavalier | 507 |
| core | 506 |
| aegis | 486 |
| forge | 341 |
| brain | 245 |

### Per Package

| Package | Errors |
|---------|--------|
| ui | 476 |
| domain-agents | 76 |
| onboarding | 57 |
| ducky-animations | 41 |
| **auth** | **39** |
| tenant-intel | 24 |
| report-templates | 1 |

### Other

| Location | Errors |
|----------|--------|
| scripts/ | 8 |

**Note:** The vast majority of errors (15,000+) are in app client-side code (React components), likely due to missing/mismatched type definitions, not auth-specific issues. The 39 errors in `packages/auth` should be investigated directly.

---

## 5. Root TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@cavaridge/auth": ["./packages/auth/src"],
      "@cavaridge/audit": ["./packages/audit/src"],
      "@cavaridge/audit/*": ["./packages/audit/src/*"],
      ... (other package paths)
    }
  }
}
```

**Missing from paths:** `@cavaridge/auth/*` — subpath imports like `@cavaridge/auth/server` may not resolve correctly via root tsconfig paths (though they work via pnpm workspace resolution).

---

## 6. Summary of Issues

### Critical
1. **5 apps duplicate auth middleware** (caelum, astra, midas, hipaa, forge) instead of using `createAuthMiddleware` — creates maintenance risk and divergence potential.

### Important
2. **RBAC role mismatch** — Implemented 5-role model doesn't match CLAUDE.md's 6-role spec (MSP Admin, MSP Tech, Client Admin, Client Viewer, Prospect missing).
3. **`invites` table has no RLS policies** in `rls.sql`.
4. **4 apps missing `@cavaridge/auth` dependency** (aegis, cavalier, ceres, core) — some are early-stage but will need it.
5. **39 TypeScript errors in packages/auth** — needs investigation.
6. **Root tsconfig missing `@cavaridge/auth/*` path mapping** — subpath imports rely solely on pnpm workspace resolution.

### Informational
7. `organizations` alias kept for backward compat — `profiles.organizationId` column name still references "organization" not "tenant".
8. `rls.sql` is a reference file, not applied via migrations — actual RLS state depends on Supabase dashboard/migration history.
9. Spaniel correctly uses service-to-service auth (not `@cavaridge/auth`).
10. Meridian, Ducky, and Vespar are the cleanest auth consumers — they delegate properly to `createAuthMiddleware`.

---

*Report generated by Claude Code — Phase 0 audit, no source files modified.*
