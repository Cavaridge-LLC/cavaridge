# Phase 1 Report — Fix `packages/auth/`

**Date:** 2026-03-24
**Runbook:** CVG-AUTH-RB-v1.0.0-20260324
**Status:** COMPLETE

---

## Summary

Aligned `packages/auth/` with the Universal Tenant Model (UTM) spec from CLAUDE.md v2.9. The package is now the single source of truth for authentication, authorization, tenant hierarchy, and RBAC across the Cavaridge platform.

## Changes Made

### 1. RBAC Roles — Old → New

| Old Role | New Role | Notes |
|---|---|---|
| platform_owner | platform_admin | Merged — single top-level role |
| platform_admin | platform_admin | Unchanged |
| tenant_admin | msp_admin | Renamed to match UTM tier |
| user | client_viewer | Mapped to lowest authenticated role |
| viewer | client_viewer | Merged with user → client_viewer |
| *(new)* | msp_tech | Operational access, no billing/user mgmt |
| *(new)* | client_admin | Manage own users, view reports |
| *(new)* | prospect | Freemium scan results only |

**6 standard roles:** platform_admin, msp_admin, msp_tech, client_admin, client_viewer, prospect

### 2. Schema Changes (`schema.ts`)

| Change | Detail |
|---|---|
| `tenantTypeEnum` | New pg enum: platform, msp, client, site, prospect |
| `roleEnum` | New pg enum: 6 UTM roles |
| `tenants.type` | Changed from varchar to `tenantTypeEnum` |
| `profiles.tenantId` | New column (replaces `organizationId` over time) |
| `profiles.role` | Changed from varchar to `roleEnum` |
| `tenantMemberships` | New table — per-tenant role assignment with unique (user_id, tenant_id) |
| `invites.role` | Changed from varchar to `roleEnum` |
| Removed | `organizations` alias (was just pointing to `tenants`) |

### 3. New Exports

| Export | Path | Description |
|---|---|---|
| `Role` | `@cavaridge/auth` | Union type of 6 UTM roles |
| `TenantType` | `@cavaridge/auth` | Union type of 5 tenant tiers |
| `Permission` | `@cavaridge/auth` | Union type of 12 standard permissions |
| `ROLE_PERMISSIONS` | `@cavaridge/auth` | Default permission sets per role |
| `User` | `@cavaridge/auth/schema` | Alias for Profile type |
| `Tenant` | `@cavaridge/auth/schema` | Inferred tenant type |
| `TenantMembership` | `@cavaridge/auth/schema` | Inferred membership type |
| `requireAuth` | `@cavaridge/auth/middleware` | Validates session, rejects 401 |
| `requireRole(role)` | `@cavaridge/auth/middleware` | Rejects if user lacks minimum role |
| `requireTenant(param)` | `@cavaridge/auth/middleware` | Rejects if user can't access target tenant |
| `getTenantHierarchy(db, id)` | `@cavaridge/auth/helpers` | Resolves full parent chain to Platform root |
| `getUserRoleForTenant(db, uid, tid)` | `@cavaridge/auth/helpers` | Returns effective role (direct or inherited) |
| `getAccessibleTenantIds(db, uid)` | `@cavaridge/auth/helpers` | All tenant IDs user can access |

### 4. Migration SQL

**File:** `migrations/014_utm_auth_alignment.sql`

- Creates `tenant_type` and `role` enums
- Migrates `tenants.type` from varchar to enum
- Adds `profiles.tenant_id` column, backfills from `organization_id`
- Migrates `profiles.role` and `invites.role` from varchar to enum
- Creates `tenant_memberships` table with backfill from existing profiles
- Maps old roles: platform_owner/platform_admin → platform_admin, tenant_admin → msp_admin, user/viewer → client_viewer

### 5. RLS Policies

RLS enabled on all 4 auth tables:

| Table | Policies |
|---|---|
| `tenants` | Platform Admin full access; users see own hierarchy via memberships |
| `profiles` | Platform Admin full access; users see own profile + same-tenant profiles |
| `tenant_memberships` | Platform Admin full access; users see own; MSP/Client Admins manage their tenant |
| `invites` | Platform Admin full access; MSP/Client Admins manage their tenant's invites |

### 6. Type Check

```
$ npx tsc --noEmit --project packages/auth/tsconfig.json
(zero errors)
```

### 7. Files Modified

- `packages/auth/src/index.ts` — Rewritten: 6 roles, TenantType, Permission
- `packages/auth/src/schema.ts` — Rewritten: enums, tenant_memberships, new types
- `packages/auth/src/server.ts` — Updated: new role model, accessibleTenantIds
- `packages/auth/src/guards.ts` — Updated: requireTenant, new role checks
- `packages/auth/src/middleware.ts` — Updated: re-exports requireTenant
- `packages/auth/src/routes.ts` — Updated: tenantId field, new default roles
- `packages/auth/src/admin-routes.ts` — Updated: tenantId field support
- `packages/auth/src/helpers.ts` — New: getTenantHierarchy, getUserRoleForTenant, getAccessibleTenantIds
- `packages/auth/package.json` — v0.3.0, added helpers export
- `packages/auth/tsconfig.json` — New
- `migrations/014_utm_auth_alignment.sql` — New

### 8. Files Removed

- `packages/auth/src/functions 2.ts` (duplicate)
- `packages/auth/src/admin-routes 2.ts` (duplicate)
- `packages/auth/src/providers 2.ts` (duplicate)
- `packages/auth/src/guards 2.ts` (duplicate)

---

## Known Impact on Downstream Apps

Apps currently importing from `@cavaridge/auth` will need updates in Phase 2:

1. **Role strings changed** — any hardcoded `"tenant_admin"`, `"user"`, `"viewer"` must be updated to new UTM roles
2. **`organizationId` → `tenantId`** — profiles field renamed; backward compat maintained but apps should migrate
3. **`requireTenantAccess` → `requireTenant`** — old name still exported as alias
4. **`organizations` alias removed** — use `tenants` directly

## Next Step

Phase 2: Wire auth into each app per build order.
