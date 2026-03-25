# CVG-CORE Build Report

**Date:** 2026-03-24
**App Code:** CVG-CORE
**Version:** 0.1.0
**Status:** BUILD COMPLETE

---

## Summary

Built the Core Platform Administration Control Plane — Express 5 API server providing full administrative control over the Cavaridge platform. All routes require Platform Admin role via `@cavaridge/auth`.

## API Endpoints

All routes under `/api/v1/admin/`:

### Tenant Management (`/api/v1/admin/tenants`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List tenants with filters (type, parent_id, status, search) |
| GET | `/tree` | Full 4-tier hierarchy tree |
| GET | `/stats/summary` | Tenant counts by type/status |
| GET | `/:id` | Single tenant with children |
| POST | `/` | Create tenant with hierarchy validation |
| PATCH | `/:id` | Update tenant |
| POST | `/:id/deactivate` | Deactivate tenant |
| POST | `/:id/activate` | Reactivate tenant |

### User Management (`/api/v1/admin/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List users with filters (tenant_id, role, status, search) |
| GET | `/stats/summary` | User counts by role/status |
| GET | `/:id` | Single user with recent activity |
| POST | `/` | Create/invite user |
| POST | `/bulk-invite` | Bulk invite (up to 100) |
| PATCH | `/:id` | Update user role/tenant/status |
| POST | `/:id/deactivate` | Deactivate user |
| POST | `/:id/activate` | Reactivate user |

### Role Management (`/api/v1/admin/roles`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all 6 RBAC role definitions |
| GET | `/distribution` | Role distribution by role and by tenant |
| GET | `/:role/users` | List users with specific role |
| POST | `/assign` | Assign role to user |
| GET | `/memberships/:userId` | Tenant memberships for user |

### App Registry (`/api/v1/admin/apps`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | All 14 apps with status |
| GET | `/:code/health` | Health check single app |
| GET | `/health/all` | Health check all apps |

### Platform Analytics (`/api/v1/admin/analytics`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Aggregate metrics (tenants, users, activity, storage) |
| GET | `/user-growth` | 30-day user growth (daily + cumulative) |
| GET | `/tenant-growth` | 30-day tenant growth by type |
| GET | `/activity-by-app` | Audit log breakdown by app |
| GET | `/llm-usage` | LLM usage by tenant (tokens, cost) |
| GET | `/active-sessions` | Currently active users (30-min window) |
| GET | `/api-volumes` | Hourly API request volumes |

### Configuration Management (`/api/v1/admin/settings`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Endpoints index |
| GET/PATCH | `/feature-flags` | Feature flag management |
| GET/PATCH | `/branding` | Platform branding config |
| GET | `/llm-config` | LLM model routing (reads from Spaniel) |
| GET/PATCH | `/rate-limits` | Rate limit configuration |
| GET/PATCH | `/maintenance` | Maintenance mode toggle |

### Audit Log Viewer (`/api/v1/admin/audit`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Query logs (tenant, user, action, date range) |
| GET | `/export` | CSV export (up to 10,000 rows) |
| GET | `/actions` | Distinct actions for filter dropdown |
| GET | `/resource-types` | Distinct resource types |
| GET | `/app-codes` | Distinct app codes |
| GET | `/stats` | Audit log statistics |

### Billing/Usage Tracking (`/api/v1/admin/billing`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/usage` | Per-tenant usage summary (API + LLM + storage) |
| GET | `/usage/:tenantId` | Single tenant usage detail |
| GET | `/report` | Billing report for month/year |

### Connector Marketplace (`/api/v1/admin/connectors`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/catalog` | Full 25-connector catalog |
| GET | `/configs` | Connector configs across tenants |
| GET | `/requests` | Tenant connector requests/votes |
| POST | `/requests` | Submit connector request |

### Database Health (`/api/v1/admin/database`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tables` | Table row counts and sizes |
| GET | `/rls` | RLS status and policies |
| GET | `/migrations` | Migration history |
| GET | `/extensions` | PostgreSQL extensions |
| GET | `/health` | Database health summary |

## Architecture Decisions

1. **All raw SQL via `pg.Pool`** — matches existing pattern; Drizzle used only for auth middleware connection
2. **Tenant hierarchy validation** — enforces UTM parent-child rules at API level (platform -> MSP -> client -> site/prospect)
3. **Graceful degradation** — analytics/billing routes return defaults when tables don't yet exist (e.g., `llm_usage`, `feature_flags`)
4. **CSV export** — audit log export capped at 10,000 rows with proper field escaping
5. **Route prefix** — all admin routes under `/api/v1/admin/` with Platform Admin guard

## Type Check

```
$ pnpm tsc --noEmit
(no errors)
```

## Tests

```
$ pnpm vitest run
 Test Files  2 passed (2)
      Tests  47 passed (47)
```

### Test Coverage
- **tenant-hierarchy.test.ts** (22 tests): Validates all legal/illegal parent-child combinations across the 4-tier UTM hierarchy
- **role-assignment.test.ts** (25 tests): Validates RBAC role constants, hierarchy ordering, `hasMinimumRole`, `isPlatformRole`, `isMspRole`, `isClientRole`, and role-tenant compatibility rules

## Files Created/Modified

### New Files
- `server/routes/roles.ts` — Role management routes
- `server/routes/analytics.ts` — Platform analytics routes
- `server/routes/billing.ts` — Billing/usage tracking routes
- `tests/tenant-hierarchy.test.ts` — Tenant hierarchy unit tests
- `tests/role-assignment.test.ts` — Role assignment unit tests
- `vitest.config.ts` — Test configuration

### Modified Files
- `server/index.ts` — Restructured to `/api/v1/admin/` prefix, added new route imports
- `server/auth.ts` — Fixed ESM import extensions
- `server/routes/tenants.ts` — Added hierarchy validation, activate endpoint
- `server/routes/users.ts` — Updated column names (`display_name`), added activate endpoint, activity view
- `server/routes/audit.ts` — Added CSV export endpoint
- `server/routes/settings.ts` — Added rate limits, maintenance mode endpoints
- `server/routes/apps.ts` — Fixed ESM import extensions
- `server/routes/connectors.ts` — Fixed ESM import extensions
- `server/routes/database.ts` — Fixed ESM import extensions
- `package.json` — Added vitest, check/test scripts
- `tsconfig.json` — Added tests directory to include
