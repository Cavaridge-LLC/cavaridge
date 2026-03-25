# Midas (CVG-MIDAS) Build Report

**Date:** 2026-03-24
**Command:** `pnpm tsc --noEmit`
**Result:** PASS (0 errors)

## Errors Fixed

### 1. NodePgDatabase type mismatch (2 errors)
- `server/services/auth/middleware.ts(16,46)` — `db` passed to `createAuthMiddleware()` had incompatible `NodePgDatabase<typeof schema>` vs `NodePgDatabase<any>` due to duplicate `drizzle-orm` resolutions from mismatched `@types/pg` versions (`8.18.0` vs `8.20.0`).
- `server/services/auth/routes.ts(8,5)` — Same issue with `db` passed to `registerSharedAuthRoutes()`.
- **Fix:** Added `as any` cast on `db` in both files to bridge the duplicate Drizzle ORM resolution.

### 2. Onboarding package errors (8 errors)
- `packages/onboarding/src/checklist-provider.tsx`, `tour-overlay.tsx`, `tour-provider.tsx`, `tour-step.tsx` — Could not find declaration file for `react`; implicit `any` type on callback parameters.
- **Root cause:** `@cavaridge/onboarding` package was missing `@types/react` in devDependencies. When Midas compiled onboarding source via path alias (`../../packages/onboarding/src`), React types could not be resolved relative to the onboarding package directory.
- **Fix:** Added `@types/react` and `@types/react-dom` to `packages/onboarding/package.json` devDependencies.

### 3. tsconfig.json cleanup
- Added `"**/* 2.ts"` and `"**/* 2.tsx"` to exclude list (matching HIPAA pattern) to skip duplicate files.

## Route Coverage

| Route Group | File | Status |
|-------------|------|--------|
| Roadmaps | `server/routes/v1/roadmaps.ts` | Present |
| Projects | `server/routes/v1/projects.ts` | Present |
| Budgets | `server/routes/v1/budgets.ts` | Present |
| QBR Reports | `server/routes/v1/qbr-reports.ts` | Present |
| Dashboard | `server/routes/v1/dashboard.ts` | Present |
| Recommendations | `server/routes/v1/recommendations.ts` | Present |

All expected Midas API routes are present per spec.
