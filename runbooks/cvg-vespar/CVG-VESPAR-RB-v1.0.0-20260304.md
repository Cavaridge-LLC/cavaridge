# CVG-VESPAR — Vespar Application Runbook
**Document:** CVG-VESPAR-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-VESPAR |
| **App Name** | Vespar (formerly "SkyShift" and "Vesper" — both consolidated under CVG-VESPAR as of 2026-03-04) |
| **Purpose** | Cloud migration planning, Azure assessment, and SOW generator — step-by-step migration scoping with labor cost calculations, phased timelines, and downloadable SOW/runbook documents |
| **IP Owner** | Cavaridge, LLC (not yet assigned in codebase — action required) |
| **Status** | Live on Replit |
| **Repo** | `cavaridge/cvg-vespar` (Private) |

---

## 2. Tech Stack

**Note:** Vespar has two codebases — a full-stack version (SkyShift) and a single-file React version (Vesper). The canonical going-forward stack is the full-stack version.

### Full-Stack Version (Primary)

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.6.3 |
| Frontend | React | 19.2.0 |
| Build | Vite | 7.1.9 |
| CSS | Tailwind CSS v4 | 4.1.14 |
| UI Components | shadcn/ui (Radix), Framer Motion | Various |
| Routing (client) | Wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.60.5 |
| Backend | Express.js | 5.0.1 |
| Database | PostgreSQL | Replit-managed |
| ORM | Drizzle ORM | 0.39.3 |
| Validation | Zod + drizzle-zod | 3.25.76 / 0.7.0 |

### Single-File Version (Vesper — Legacy Reference)

| Layer | Technology | Notes |
|---|---|---|
| Framework | React (single .jsx file) | No build pipeline beyond Replit default |
| Persistence | localStorage | `vesper_assessments`, `vesper_theme` |
| Theming | Inline styles + Tailwind | Three-way theme (light/dark/system) with `prefers-color-scheme` |
| Document output | In-app markdown generation | SOW and runbook as downloadable .md |
| External dependencies | None at runtime | All pricing/templates embedded as constants |

---

## 3. Cavaridge Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ❌ Absent | Single-tenant, no user scoping. All migration plans visible to all visitors. |
| RBAC | ❌ Absent | No authentication. No session management. Fully open/unauthenticated. |
| Light/Dark/System theme | ⚠️ Partial | Full-stack: light mode active, dark CSS partially defined, no toggle. Vesper: full 3-way theme implemented. |
| No hardcoded client data | ⚠️ Partial | Source/destination/resource lists as static arrays. Blueprint heuristics use fixed thresholds. Copyright text hardcoded. |
| IP hygiene | ✅ Compliant | No DIT references. But legal entity not yet assigned in codebase. |
| OpenRouter via Cavaridge key | ❌ Absent | No AI features in current build. |
| No plaintext secrets | ⚠️ Partial | Minimal secrets exposure — DB credentials in Replit Secrets. |
| llm.config.js routing | N/A | No AI features. |
| Rate limiting | ❌ Absent | All routes publicly accessible. |
| Automated tests | ❌ Absent | Zero tests. |

---

## 4. Core Features — Built

**Full-Stack (SkyShift):**
- Migration plan creation wizard (source, destination, resource selection)
- Server-side blueprint generation with timeline, downtime, complexity, and risk estimates
- Migration plan history with list and detail views
- Landing page with hero section

**Vesper (Single-File):**
- 6-step assessment wizard (client info, environment, workloads, users, compliance, review)
- Labor cost calculator with 5-role rate card (PM, SA, Sr Eng, Eng, Support)
- Complexity scoring based on workload count, user count, compliance requirements
- Auto-generated phased timeline with task breakdown
- SOW document generation (markdown) with executive summary, scope, cost tables, assumptions, exclusions
- Engineering runbook generation with Azure CLI commands, pre/post checklists, validation gates
- Assessment save/load via localStorage
- Full light/dark/system theme

---

## 5. Database Schema (Full-Stack)

| Table | Key Columns |
|---|---|
| `users` | id (UUID), username (unique), password — not yet used |
| `migration_plans` | id (UUID), source, destination, resources (text[]), timeline_estimate, downtime_estimate, complexity, risk_level, steps (JSONB), created_at |

---

## 6. Known Gaps & Technical Debt

- **App still branded as "SkyShift"** in UI, meta tags, and OG images — must be renamed to "Vespar"
- **Legal entity not assigned** in codebase — must add Cavaridge, LLC ownership
- **No authentication** — all plans public and unscoped
- **No plan editing or deletion** — create and view only
- **Non-functional nav links** — "How it works", "Security", "Pricing" all point to `#`
- **Non-functional buttons** — "Watch Demo" has no action
- **Duplicate data definitions** — source/destination/resource arrays in both frontend and backend
- **No PDF export** — "Download Full PDF Plan" button was removed in backend conversion
- **Blueprint heuristics use fixed thresholds** — timeline, downtime, complexity calculations not configurable
- **Vesper labor rates hardcoded** — PM $175, SA $225, Sr Eng $200, Eng $165, Support $125 (embedded as constants)

---

## 7. Open Registry Issues

| Issue | Action Required |
|---|---|
| App still branded "SkyShift" | Rename to "Vespar" in UI, meta tags, OG images, documentation |
| Legal entity not assigned | Add Cavaridge, LLC as owner. Add LICENSE file. |
| Two codebases exist | Decide: merge Vesper assessment features into full-stack, or maintain separately |

---

## 8. Remediation Priorities

| Priority | Task | Effort |
|---|---|---|
| P1 | Rename all "SkyShift" references to "Vespar" | Low |
| P1 | Add LICENSE file asserting Cavaridge, LLC ownership | Low |
| P1 | Add authentication | Medium |
| P1 | Guard all API routes — remove public access | Medium |
| P1 | Add `tenantId` to migration_plans, scope all queries | High |
| P2 | Implement RBAC (Platform Owner, Tenant Admin, User, Viewer) | High |
| P2 | Wire dark/system theme toggle (full-stack version) | Medium |
| P2 | Merge Vesper assessment/SOW features into full-stack version | High |
| P2 | Externalize labor rates, heuristic thresholds to config/DB | Medium |
| P2 | Add rate limiting | Medium |
| P3 | Add PDF export for migration plans | Medium |
| P3 | Fix non-functional nav links and buttons | Low |
| P3 | Add automated tests | High |

---

## 9. DIT Tenant Boundary

- DIT is a tenant within Vespar — never a co-owner
- No DIT names, logos, or references in source code — confirmed compliant
- Labor rates in Vesper version are generic (not DIT-branded) but should still be tenant-configurable
- Provider identity (branding, legal name, contact info) must be configurable per tenant

---

## 10. Runbook Maintenance

**Regenerate this runbook on:** any Major or Minor version increment, new module addition, or architecture change.

**Claude Project Runbook Prompt:**
> "Generate a project state summary in markdown covering: (1) Project name and purpose, (2) Legal entity owner, (3) Tech stack and key dependencies, (4) Core features built or in progress, (5) Shared utilities or components that could apply to other apps, (6) Hardcoded values or assumptions that need to be made configurable, (7) Current RBAC and multitenancy status, (8) UI/UX standards in use (theming, component library, etc.), (9) Known gaps or technical debt, (10) Any Dedicated IT or client-specific references that need to be abstracted out."

**Replit Runbook Prompt:**
> "Generate a technical state summary in markdown covering: (1) Project name and primary purpose, (2) Current tech stack — framework, language, runtime, key libraries and versions, (3) Folder and file structure — full tree with a one-line description of each key file or folder, (4) Environment variables currently in use — names only no values, (5) Authentication and authorization implementation — what exists what is missing, (6) Multitenancy status — implemented partial or absent, (7) UI theming — light/dark/system mode status, (8) Database schema or data model summary, (9) API endpoints or routes currently defined, (10) Third-party integrations — APIs SDKs services connected, (11) Hardcoded values that should be configurable — flag anything client-specific, (12) Known bugs incomplete features or technical debt, (13) What is production-ready vs. prototype/draft, (14) Deployment status — where hosted what is the deployment process."

---

*This document is governed by CVG-CORE. Any deviation requires explicit approval documented in the CVG-CORE project before implementation.*
*Classification: Cavaridge LLC — Internal Confidential*
