# Vespar (CVG-VESPAR) Build Report

**Date:** 2026-03-24
**Command:** `pnpm tsc --noEmit`
**Result:** PASS (0 errors)

## Errors Fixed

### 1. Onboarding package errors (8 errors)
- Same `@cavaridge/onboarding` missing `@types/react` issue as Midas.
- **Fix:** Shared fix — added `@types/react` and `@types/react-dom` to `packages/onboarding/package.json` devDependencies.

### 2. tsconfig.json cleanup
- Added `"target": "ES2022"` (was missing, matching HIPAA pattern).
- `"**/* 2.ts"` and `"**/* 2.tsx"` exclude patterns were already present.

### 3. Duplicate files
The following duplicate files exist in `server/routes/` (excluded from compilation by tsconfig):
- `analysis 2.ts`, `costs 2.ts`, `dependencies 2.ts`, `index 2.ts`, `projects 2.ts`, `risks 2.ts`, `runbooks 2.ts`, `workloads 2.ts`

These are safely excluded by the `"**/* 2.ts"` pattern in tsconfig.json but should be deleted in a future cleanup pass.

## Route Coverage

### v1 API Routes
| Route Group | File | Status |
|-------------|------|--------|
| Assessments | `server/routes/v1/assessments.ts` | Present |
| Workloads | `server/routes/v1/workloads.ts` | Present |
| Waves | `server/routes/v1/waves.ts` | Present |
| Cost Models | `server/routes/v1/cost-models.ts` | Present |
| Reports | `server/routes/v1/reports.ts` | Present |

### Legacy Routes (backward compat)
| Route Group | File | Status |
|-------------|------|--------|
| Projects | `server/routes/projects.ts` | Present |
| Workloads | `server/routes/workloads.ts` | Present |
| Dependencies | `server/routes/dependencies.ts` | Present |
| Risks | `server/routes/risks.ts` | Present |
| Costs | `server/routes/costs.ts` | Present |
| Runbooks | `server/routes/runbooks.ts` | Present |
| Analysis | `server/routes/analysis.ts` | Present |

All expected Vespar API routes are present per spec (migration assessments, workloads, waves, cost models).
