# CVG-APOGEE — Apogee Application Runbook
**Document:** CVG-APOGEE-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-APOGEE |
| **App Name** | Apogee |
| **Purpose** | AI-powered client lifecycle platform for MSPs — full post-contract journey from onboarding through discovery, documentation, stabilization, standardization, optimization, and ongoing strategic engagement |
| **IP Owner** | Cavaridge, LLC |
| **Status** | Pre-Build / Architecture Phase |
| **Companion Product** | Meridian (M&A IT Due Diligence) — closed deals can feed into Apogee, seeding client records |
| **Repo** | `cavaridge/cvg-apogee` (Private) |

---

## 2. Architecture Decision

**Option C confirmed:** Apogee is the primary, daily-use product. Meridian is a premium sibling module that feeds closed deals into Apogee. Both share foundational infrastructure but serve different lifecycles — Meridian is evaluative and finite (deal assessment), Apogee is operational and ongoing (client management).

**Branding:** "Apogee" stands alone. Cavaridge is the parent company, not part of the product name. Astronomy naming family: *Meridian assesses the landscape. Apogee elevates the operation.*

---

## 3. Tech Stack (Inherited from Meridian)

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript | Shared with Meridian |
| Frontend | React | Version TBD — Meridian uses 18.3.1 |
| Build | Vite | Shared |
| CSS | Tailwind CSS | Shared |
| UI Components | shadcn/ui (Radix) | Shared |
| Icons | Lucide React | Shared |
| Typography | DM Sans (UI) + JetBrains Mono (data) | Shared design system |
| Backend | Express.js | Shared |
| Database | PostgreSQL + pgvector | Shared infrastructure |
| ORM | Drizzle ORM | Shared |
| Data Fetching | TanStack React Query | Shared |
| AI | TBD — must route through OpenRouter | Must use llm.config.js |

---

## 4. Cavaridge Standards Compliance (Target)

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ✅ Inherited | Meridian's org-scoped model carries directly. Must be preserved. |
| RBAC | ⚠️ Needs Extension | Meridian's 7-tier model is internal-only. Apogee needs client-facing portal roles. |
| Light/Dark/System theme | ✅ Inherited | Meridian's ThemeProvider with system detection carries directly. |
| No hardcoded client data | ⚠️ Needs Work | Meridian has hardcoded pillars, categories, scoring that must become configurable. |
| IP hygiene | ✅ Target | No DIT or client references in code from day one. |
| OpenRouter via Cavaridge key | ❌ Must Build | Must be implemented from the start via llm.config.js. |
| No plaintext secrets | ⚠️ Inherited | Same session secret concern from Meridian. |
| llm.config.js routing | ❌ Must Build | Must be implemented before any AI feature. |
| Rate limiting | ❌ Must Build | Required from day one. |
| CSRF protection | ❌ Must Build | Required from day one. |
| Automated tests | ❌ Must Build | Target: baseline tests before production. |

---

## 5. Planned Features

**Client Lifecycle Management:**
- Post-contract onboarding workflow with configurable phases and gates
- Discovery documentation and tech stack capture
- Stabilization tracking with health scoring
- Standardization roadmaps against MSP-defined baselines
- Optimization planning and strategic engagement
- Ongoing QBR and reporting integration

**Client Portal (New — Not in Meridian):**
- Client-facing read-only portal for environment documentation, roadmaps, issue status
- Scoped visibility — clients see only their own data
- Requires new RBAC tier not present in Meridian

**Meridian Integration:**
- Import closed deals as new client records
- Seed tech stack, topology, documents, and findings from Meridian assessments
- Product-aware AI persona ("Ask Meridian" vs "Ask Apogee")

**AI-Powered Features:**
- Health scoring and risk detection
- Automated documentation generation
- Initiative recommendations
- All routed through OpenRouter via llm.config.js

---

## 6. RBAC Extension Requirements

Meridian's 7-tier internal role model needs these additions for Apogee:

| New Role/Capability | Purpose |
|---|---|
| **Client Portal User** | Read-only access to own environment documentation, roadmaps, issue status |
| **Onboarding-specific permissions** | Phase advancement gates, checklist sign-off authority, health score visibility, SLA editing |
| **Cross-product roles** | Users operating in both Meridian and Apogee need unified identity with product-scoped permissions |

**Gap:** No client-facing access tier exists in Meridian. A new tier (or separate permission dimension) is required.

---

## 7. Hardcoded Values Requiring Configuration

Values inherited from Meridian that must become configurable for Apogee:

| Value | Current State | Required Change |
|---|---|---|
| 6 assessment pillars | Hardcoded M&A risk categories | Configurable operational domains per MSP |
| 12 tech stack categories | Fixed extraction taxonomy | Extensible per MSP |
| 15 document classification categories | Fixed taxonomy | Configurable per organization |
| 7-tier role hierarchy | Fixed role definitions | Extended with client portal access |
| "Ask MERIDIAN" AI persona | Product-specific branding | Product-aware (Apogee vs Meridian) |
| Scoring algorithms | M&A risk tuned | Separate models for operational health |
| Report templates | M&A-focused | New template set for onboarding/operations |
| Baseline comparison standards | Acquirer's standards (single set) | Each MSP tenant defines own standards |

---

## 8. Build Sequence (Pre-Build Checklist)

- [ ] App registered in CVG-CORE registry ✅
- [ ] Claude project created with system prompt and this runbook attached
- [ ] Architecture spec fully defined in Claude before Replit opens
- [ ] GitHub private repo created with LICENSE and .gitignore
- [ ] Doppler project created with dev/staging/prd environments
- [ ] Multitenancy scaffold in place before any feature work
- [ ] RBAC roles defined (including client portal tier) before any UI
- [ ] Light/dark/system theme wired on day one
- [ ] llm.config.js scaffolded before any AI feature
- [ ] Rate limiting middleware applied from first route
- [ ] CSRF protection enabled from day one
- [ ] Error boundaries in React client
- [ ] Initial runbook generated at v1.0.0 after first build session

---

## 9. DIT Tenant Boundary

- DIT is a tenant within Apogee — never a co-owner
- No DIT names, logos, or references in source code from day one
- DIT gets a standard tenant record with its own onboarding phases, baselines, and branding
- All DIT customizations in tenant config — never in codebase

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
