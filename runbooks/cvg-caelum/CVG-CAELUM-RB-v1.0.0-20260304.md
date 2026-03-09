# CVG-CAELUM — Caelum Application Runbook
**Document:** CVG-CAELUM-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-CAELUM |
| **App Name** | Caelum |
| **Purpose** | Conversational SoW (Statement of Work) builder — users chat with multi-model AI, paste notes, attach files, and generate structured client-ready SoW documents |
| **IP Owner** | Cavaridge, LLC (confirmed 2026-03-03). DIT is tenant only. |
| **Status** | Live on Replit |
| **Repo** | `cavaridge/cvg-caelum` (Private) |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.x |
| Language | TypeScript | 5.6.3 |
| Frontend | React | 19.2.0 |
| Build | Vite / esbuild | 7.1.9 / 0.25.0 |
| CSS | Tailwind CSS v4 | 4.1.14 |
| UI Components | shadcn/ui (Radix) | Various |
| Routing (client) | Wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.60.5 |
| Backend | Express.js | 5.0.1 |
| Database | PostgreSQL 16 | Replit-managed |
| ORM | Drizzle ORM | 0.39.3 |
| Auth | Replit Auth (OIDC) | openid-client 6.8.2 |
| Session Store | connect-pg-simple | 10.0.0 |
| AI Client | OpenAI SDK → OpenRouter | 6.25.0 |
| PDF Generation | PDFKit | 0.17.2 |
| DOCX Generation | docx | 9.6.0 |
| File Parsing | pdf-parse, mammoth, xlsx | Various |
| Charts | Recharts | 2.15.4 |
| Animations | Framer Motion | 12.23.24 |

---

## 3. Cavaridge Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ⚠️ Partial | User-scoped only via `userId` on conversations. No org/tenant isolation. |
| RBAC | ⚠️ Partial | Replit Auth provides authentication but no role-based access control. All users equal. |
| Light/Dark/System theme | ⚠️ Partial | Light + Dark toggle implemented. No system-preference auto-detection (`prefers-color-scheme`). |
| No hardcoded client data | ❌ Non-compliant | DIT-specific rate card ($185 PM, $225 SA, etc.) hardcoded in AI system prompt. "Dedicated IT" branding in codebase. |
| IP hygiene | ❌ Non-compliant | DIT references exist in code — highest priority remediation item. |
| OpenRouter via Cavaridge key | ⚠️ Partial | Uses OpenAI SDK pointed at OpenRouter. Env var named `OPENAI_API_KEY` instead of `OPENROUTER_API_KEY`. |
| No plaintext secrets | ✅ Compliant | Secrets in Replit Secrets. |
| llm.config.js routing | ❌ Absent | Model selection not centralized. |
| Rate limiting | ❌ Absent | No rate limiting — especially critical on `/api/chat` which calls OpenRouter. |
| CSRF protection | ❌ Absent | Express sessions without CSRF tokens. |
| Automated tests | ❌ Absent | Zero tests. PDF/DOCX verification is entirely manual. |

---

## 4. Core Features — Built

- Conversational SoW generation via multi-model AI chat interface with SSE streaming
- 12-section structured SoW output stored as JSONB (`sow_json`)
- PDF export via PDFKit (cover page, styled tables, accent bars, professional formatting)
- DOCX export via `docx` package (Calibri, Unicode-correct, summary and detailed formats)
- Role-based workload estimation with rate card in system prompt
- Multi-phase implementation plans with tasks and deliverables per phase
- Risk mitigation with severity levels and vendor/client mitigation layout
- Prerequisites split into client, vendor, and third-party responsibilities
- Responsibility matrix (RACI-style)
- Completion criteria, out-of-scope, sign-off, and terms sections
- Conversation management: CRUD, search, flag, branch
- SoW inline editing with undo/redo
- Version history with compare and restore
- File upload and text extraction (PDF, DOCX, XLSX)
- Dashboard with metrics

**In Progress:**
- Project Manager role addition ($185/hr) to system prompt
- jsPDF → PDFKit migration (prompt written, deployment status unconfirmed)

---

## 5. Database Schema

| Table | Key Purpose |
|---|---|
| `users` | Replit Auth managed — id, email, name, profile image |
| `sessions` | Express session store via connect-pg-simple |
| `conversations` | Core data — userId scopes ownership, sowJson (JSONB), flagged status |
| `messages` | Chat messages (user/assistant/system) linked to conversation |
| `sow_versions` | SoW version snapshots for history/restore |

---

## 6. Shared Components (Extractable to cvg-shared)

- **PDFKit helpers** (post-migration): `ensureSpace()`, `renderStyledTable()`, `renderCoverPage()`, `addHeaderBar()`, `addFooters()`, `renderSectionHeader()`, `renderBulletList()`, `renderBodyText()`, `LAYOUT` constants
- DOCX export patterns (table builders, heading styles, bullet renderers)
- SSE streaming AI client wrapper
- File parsing pipeline (PDF, DOCX, XLSX text extraction)

---

## 7. Known Gaps & Technical Debt

- **`home.tsx` is ~2,900 lines** — chat, sidebar, SoW viewer, dashboard, exports all in one file. Must split.
- **DIT hardcoding is the #1 remediation priority:** rate card, branding, service descriptions are all embedded in the AI system prompt and code. Must be moved to tenant config.
- **Hardcoded rate card** in AI system prompt string in `routes.ts` — changing any rate requires code change and redeployment. Must be externalized to database/config.
- **No system-preference dark mode detection** — manual toggle only.
- **Error handling is generic** `console.error` + 500 — no structured error types.
- **No input sanitization** on SoW JSON fields — stored JSONB trusted from AI output.
- **DOCX/PDF parity gap** — DOCX uses Calibri, PDF uses Helvetica. Visual differences between formats.
- **SoW JSON schema undocumented** — field names not formally specified.
- **Replit Agent reliability risk** — documented scope drift pattern. All prompts now include explicit scope-locking.
- **Copyright year hardcoded to 2026.**
- **Session secret not rotated.**

---

## 8. Remediation Priorities

| Priority | Task | Effort |
|---|---|---|
| P1 | Abstract ALL DIT hardcoding into tenant config (rate card, branding, system prompt) | High |
| P1 | Rename `OPENAI_API_KEY` → `OPENROUTER_API_KEY` | Low |
| P1 | Add rate limiting to all API endpoints (especially `/api/chat`) | Medium |
| P1 | Add CSRF protection | Medium |
| P2 | Implement org/tenant-level multitenancy (beyond user-scoping) | High |
| P2 | Add RBAC roles (Platform Owner, Tenant Admin, User, Viewer minimum) | High |
| P2 | Add system-preference theme detection | Low |
| P2 | Centralize model selection in llm.config.js | Low |
| P2 | Externalize rate card to database table | Medium |
| P3 | Break up home.tsx into sub-components | High |
| P3 | Extract PDFKit helpers to cvg-shared | Medium |
| P3 | Add automated tests | High |
| P3 | Document SoW JSON schema formally | Low |

---

## 9. DIT Tenant Boundary

**⚠️ CRITICAL:** Caelum currently has DIT-specific values hardcoded in the codebase. This is the highest priority remediation item across the portfolio.

Items requiring abstraction:
- Rate card (PM $185, SA $225, Sr Eng $200, Eng $165, Support $125) — in AI system prompt
- "Dedicated IT" branding references
- Service delivery model assumptions in SoW templates
- DIT-specific SOW language and formatting

**Target state:** All of these must live in tenant configuration records, not in source code. DIT gets a tenant account with its own rate card, branding, and templates — identical treatment to any other MSP client.

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
