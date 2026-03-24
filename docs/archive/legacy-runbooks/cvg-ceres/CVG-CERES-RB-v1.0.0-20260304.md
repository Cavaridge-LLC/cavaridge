# CVG-CERES — Ceres Application Runbook
**Document:** CVG-CERES-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-CERES |
| **App Name** | Ceres |
| **Purpose** | Medicare 60-Day Visit Frequency Calculator for home health services — clinical staff plan and schedule patient visits within the 60-day certification period following CMS CY 2026 Guidelines and PDGM |
| **IP Owner** | Cavaridge, LLC |
| **Status** | Live on Replit |
| **Repo** | `cavaridge/cvg-ceres` (Private) |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.x |
| Language | TypeScript | 5.6.3 |
| Frontend | React | 19.2.0 |
| Build | Vite | 7.1.9 |
| CSS | Tailwind CSS v4 | 4.1.14 |
| UI Components | shadcn/ui (Radix) | Various |
| Routing (client) | Wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.60.5 |
| Backend | Express.js | 5.0.1 |
| Database | PostgreSQL 16 | Provisioned but **unused** |
| ORM | Drizzle ORM | 0.39.3 |
| Forms | React Hook Form + Zod | 7.66.0 / 3.25.76 |
| Date Utils | date-fns | 3.6.0 |
| Theming | next-themes | 0.4.6 |
| AI | OpenAI SDK (via OpenRouter) | 6.25.0 |
| Animations | Framer Motion | 12.23.24 |
| Mobile | Expo / React Native | 55.0.3 / 0.84.0 |

---

## 3. Cavaridge Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ❌ Absent | No tenant scoping. Application is client-side focused with no data persistence. |
| RBAC | ❌ Absent | No authentication or authorization. |
| Light/Dark/System theme | ✅ Compliant | Full three-way theme implemented via next-themes. |
| No hardcoded client data | ⚠️ Partial | CMS guidelines and PDGM parameters embedded as constants. Copyright text hardcoded. |
| IP hygiene | ✅ Compliant | No DIT references in code. |
| OpenRouter via Cavaridge key | ⚠️ Partial | OpenAI SDK dependency installed and pointed at OpenRouter. |
| No plaintext secrets | ⚠️ Partial | Minimal secrets — mostly environment config. |
| llm.config.js routing | ❌ Absent | Model selection not centralized. |
| Rate limiting | ❌ Absent | No rate limiting. |
| Automated tests | ❌ Absent | Zero tests. |

---

## 4. Core Features — Built

- Medicare 60-day episode calculator following CMS CY 2026 guidelines
- PDGM (Patient-Driven Groupings Model) visit frequency recommendations
- Interval scheduler: every-N-days and specific-weekdays scheduling modes
- Smart scheduler: clinically-optimized auto-scheduling algorithm
- Visual 60-day episode timeline with visit dots
- Plan comparison: side-by-side comparison with save capability
- Calendar export (.ics and CSV formats)
- Mobile app scaffold via Expo / React Native
- Full light/dark/system theme support
- Audio integration utilities (Replit integration scaffold)

---

## 5. Database Status

**PostgreSQL 16 is provisioned but unused.** The application currently operates entirely client-side with no server-side persistence. Drizzle ORM and schema files exist but no tables are actively used.

**Open registry issue:** Either implement persistence (save patient visit plans, user accounts, scheduling history) or remove the database dependency to reduce overhead.

---

## 6. Shared Components (Extractable to cvg-shared)

- Three-way theme implementation via next-themes (reference for other apps)
- Calendar export utilities (.ics generation, CSV scheduling export)
- Interval/frequency scheduling algorithms (potentially reusable for other healthcare or scheduling apps)

---

## 7. Known Gaps & Technical Debt

- **Unused PostgreSQL database** — provisioned but no tables in active use. Decision needed.
- **No authentication** — calculator is fully open/public.
- **No data persistence** — patient visit plans exist only in client memory during session.
- **CMS guidelines as constants** — PDGM parameters and visit frequency rules are embedded. Must be updateable when CMS publishes new guidelines.
- **Mobile app scaffold only** — Expo/React Native dependencies installed but mobile experience likely incomplete.
- **Audio integration scaffold** — Replit audio utilities exist but not wired to core functionality.
- **No HIPAA compliance considerations** — if patient data will ever be entered, HIPAA safeguards are required.

---

## 8. Remediation Priorities

| Priority | Task | Effort |
|---|---|---|
| P1 | Decide: implement DB persistence or remove PostgreSQL dependency | Low (decision) |
| P1 | Add authentication if any patient or user data will be stored | Medium |
| P2 | Add `tenantId` scoping if multi-org usage is planned | High |
| P2 | Implement RBAC if users will have different permission levels | High |
| P2 | Make CMS/PDGM parameters configurable (updateable without code change) | Medium |
| P2 | Centralize model selection in llm.config.js | Low |
| P2 | Add rate limiting to API endpoints | Medium |
| P3 | Complete mobile app (Expo/React Native) | High |
| P3 | Evaluate HIPAA compliance requirements for patient data handling | Medium |
| P3 | Add automated tests | High |

---

## 9. DIT Tenant Boundary

- DIT is a tenant within Ceres — never a co-owner
- No DIT names, logos, or references in source code — confirmed compliant
- If multitenancy is implemented, DIT gets a standard tenant record

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
