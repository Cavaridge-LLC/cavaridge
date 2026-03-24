# CVG-ASTRA — Astra Application Runbook
**Document:** CVG-ASTRA-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-ASTRA |
| **App Name** | Astra |
| **Purpose** | Microsoft 365 License & Usage Insights SaaS dashboard — OAuth-connected or CSV/XLSX-based M365 license optimization with AI-powered executive briefings |
| **IP Owner** | Cavaridge, LLC |
| **Status** | Live on Replit |
| **Repo** | `cavaridge/cvg-astra` (Private) |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.6.3 |
| Runtime | Node.js | 20.x |
| Frontend | React | 19.2.0 |
| Build | Vite | 7.1.9 |
| CSS | Tailwind CSS v4 | 4.1.14 |
| UI Components | shadcn/ui (Radix) | Various |
| Routing (client) | Wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.60.5 |
| Backend | Express.js | 5.0.1 |
| Database | PostgreSQL 16 | Replit-managed |
| ORM | Drizzle ORM | 0.39.3 |
| Auth (App) | Replit Auth (OIDC) | openid-client 6.8.2 |
| Auth (M365) | Microsoft OAuth2 (manual) | Raw fetch |
| AI | OpenRouter via OpenAI SDK | openai 6.25.0 |
| Excel Export | xlsx (SheetJS) | 0.18.5 |
| PDF/PNG Export | html2canvas + jsPDF | 1.4.1 / 4.2.0 |
| File Upload | multer | 2.0.2 |
| Charts | Recharts | 2.15.4 |
| Animations | Framer Motion | 12.23.24 |
| Fonts | Plus Jakarta Sans + Inter | Google Fonts CDN |

---

## 3. Cavaridge Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ❌ Absent | No `tenantId` or `organizationId` on data tables. Reports globally visible. |
| RBAC | ❌ Absent | All authenticated users have equal access. No admin/user distinction. |
| Light/Dark/System theme | ⚠️ Partial | Light mode only. `next-themes` installed but not wired. Dark CSS classes exist but no ThemeProvider. |
| No hardcoded client data | ⚠️ Partial | Duplicate `LICENSE_COSTS` (client) and `SKU_COST_MAP` (server) with potential drift. |
| IP hygiene | ✅ Compliant | No DIT references in code. |
| OpenRouter via Cavaridge key | ⚠️ Partial | Uses OpenAI SDK pointed at OpenRouter but may use direct keys. |
| No plaintext secrets | ⚠️ Partial | Microsoft tokens stored as plaintext in PostgreSQL. |
| llm.config.js routing | ❌ Absent | Model selection not centralized. |
| Rate limiting | ❌ Absent | No rate limiting on any endpoint. |
| CSRF protection | ❌ Absent | No CSRF tokens on state-mutating endpoints. |
| Automated tests | ❌ Absent | Zero tests. |

---

## 4. Core Features — Built

- Multi-tenant Microsoft OAuth sign-in via `/common` endpoint with token refresh
- Graph API sync: licensed users, mailbox usage, active user detail (30-day), tenant subscriptions
- CSV/XLSX file upload with smart preamble-skipping parser (alternative to OAuth)
- Strategy engine with 5 modes: Current, Maximize Security, Minimize Cost, Balanced, Custom Rules
- Per-user recommendation logic analyzing Exchange, Teams, SharePoint, OneDrive activity
- Custom rules panel with toggleable cleanup rules (redundant add-ons, dept-aware rightsizing)
- Combined user directory table with filtering (current vs. recommended licenses)
- KPI dashboard with billing period selector and tenant subscriptions panel
- License comparison guide: 19 licenses, 8 categories, 50+ features
- AI-powered executive briefing via SSE streaming with markdown rendering
- PDF/PNG/print export for executive briefing
- Excel export of user data with activity columns
- Reports CRUD with cascading delete
- Personalized greetings (login history tracking)
- Interactive tutorial system

---

## 5. Database Schema

| Table | Key Purpose |
|---|---|
| `users` | Replit Auth user storage (minimal) |
| `sessions` | Express session store |
| `reports` | Saved analysis reports — **no userId or tenantId scoping** |
| `report_summaries` | AI-generated executive summaries |
| `microsoft_tokens` | OAuth access/refresh tokens (plaintext) |
| `login_history` | Greeting personalization |

**Critical gap:** Reports table has no ownership column — all reports globally visible to any authenticated user.

---

## 6. Shared Components (Extractable to cvg-shared)

- Smart CSV/XLSX parser with preamble-skipping and column auto-detection
- Microsoft Graph OAuth module (multi-tenant, token refresh, JWT tenant extraction)
- License feature dataset (643 lines, 19 licenses, 8 categories)
- SSE streaming client wrapper for AI responses
- PDF/PNG export pipeline (html2canvas + jsPDF)

---

## 7. Known Gaps & Technical Debt

- **`dashboard.tsx` is 2,848 lines** — needs decomposition into strategy engine, table component, filter bar, KPI cards
- **Duplicate license cost data** in client and server with potential drift
- **No input sanitization** on CSV/XLSX parsing
- **No pagination** — user table loads all data at once, will degrade at 1,000+ users
- **No error boundaries** in React — component crash takes down entire app
- **OAuth state parameter** generated but not cryptographically validated
- **Microsoft tokens stored as plaintext** in PostgreSQL
- **Chat/Audio/Image integrations** — scaffold code exists under `replit_integrations/` but none wired to UI

---

## 8. Remediation Priorities

| Priority | Task | Effort |
|---|---|---|
| P1 | Add `userId` / `tenantId` to reports table, scope all queries | High |
| P1 | Implement multitenancy data model | High |
| P1 | Add RBAC roles (at minimum: Platform Owner, Tenant Admin, User, Viewer) | High |
| P1 | Encrypt Microsoft tokens at rest | Medium |
| P1 | Add rate limiting to all API endpoints | Medium |
| P1 | Add CSRF protection | Medium |
| P2 | Wire ThemeProvider with dark/system mode | Medium |
| P2 | Centralize model selection in llm.config.js | Low |
| P2 | Consolidate license cost data to single source of truth | Low |
| P2 | Add pagination to user table | Medium |
| P3 | Break up dashboard.tsx into sub-components | High |
| P3 | Add automated tests | High |
| P3 | Add error boundaries | Low |

---

## 9. DIT Tenant Boundary

- DIT is a tenant within Astra — never a co-owner
- No DIT names, logos, or references in source code — confirmed compliant
- All client customizations must go in tenant config records, not the codebase

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
