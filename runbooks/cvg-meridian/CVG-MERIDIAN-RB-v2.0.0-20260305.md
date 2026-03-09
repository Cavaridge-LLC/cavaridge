# CVG-MERIDIAN — Meridian Application Runbook
**Document:** CVG-MERIDIAN-RB-v2.0.0-20260305
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303
**Supersedes:** CVG-MERIDIAN-RB-v1.0.0-20260304

---

## Changelog from v1.0.0

| Change | Detail |
|---|---|
| Report format changed | PDFKit (PDF) replaced entirely by `docx` library (DOCX output). All report exports now produce `.docx` files. Route paths still reference `/export/pdf` for backward compatibility but serve DOCX — semantic mismatch flagged as technical debt. |
| RBAC hierarchy restructured | `org_owner` role removed. `deal_lead` inserted at tier 4. New hierarchy: platform_owner > platform_admin > org_admin > deal_lead > analyst > contributor > viewer. |
| Database expanded | 24 → 30 tables. New: `chat_messages` (deprecated, retained for data), `processing_queue`, `usage_tracking`, `account_requests`, `finding_cross_references`. |
| New server modules | report-ai.ts, report-branding.ts, plan-limits.ts, processing-pipeline.ts, finding-matcher.ts, sterilize-production.ts |
| Platform versioning added | version.json + bump-version.js script. Platform version now tracked as 2.2.0+0. `/api/version` endpoint added. |
| Plan tier enforcement | plan-limits.ts enforces usage limits per org plan. plan-limit-modal.tsx added to frontend. |
| Sterilization tool | Production data cleanup script added. Platform admin UI includes sterilization preview and execution. |
| Account request flow | Public account request form + admin approve/reject flow fully implemented. |
| Auto-finding extraction | extractFindingsFromText() added to ingestion.ts but not yet wired into processExtractedFile(). Code exists, not active. |
| Finding cross-references | finding_cross_references table and finding-matcher.ts added. Limited usage in production currently. |
| Document deduplication | SHA-256 deduplication added to ingestion pipeline. |

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-MERIDIAN |
| **App Name** | Meridian |
| **Platform Version** | 2.2.0+0 |
| **Purpose** | M&A IT Intelligence Platform for private equity firms and investment committees — deal pipeline, risk assessment, AI document analysis, infrastructure intelligence, integration playbooks, Monte Carlo simulation, portfolio analytics, and IC-grade DOCX report generation |
| **IP Owner** | Cavaridge, LLC |
| **Status** | In Development — most mature app in the portfolio |
| **Repo** | `cavaridge/cvg-meridian` (Private) |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.x (NixOS module) |
| Language | TypeScript | 5.x |
| Frontend | React | 18.3.1 |
| Build | Vite | latest via @vitejs/plugin-react |
| CSS | Tailwind CSS | 3.4.17 |
| UI Components | shadcn/ui (Radix) | Various |
| Routing (client) | Wouter | 3.3.x |
| Data Fetching | TanStack React Query | 5.60.x |
| Forms | react-hook-form + Zod | 7.55 / 3.24 |
| Backend | Express.js | 5.0.1 |
| Database | PostgreSQL 16 + pgvector | NixOS module |
| ORM | Drizzle ORM | 0.39.x |
| Schema Validation | drizzle-zod | 0.7.x |
| Session Store | connect-pg-simple | 10.0.0 |
| File Storage | Replit Object Storage | Integration v2.0.0 |
| DOCX Generation | docx | 9.6.x |
| Excel Generation | ExcelJS | 4.4.x |
| PDF Text Extraction | pdf-parse | 1.1.x |
| DOCX Text Extraction | mammoth | 1.11.x |
| Email Parsing | mailparser | 3.9.x |
| Image Processing | Sharp | 0.34.x |
| ZIP Extraction | adm-zip | 0.5.x |
| AI (Primary LLM) | Anthropic Claude | claude-sonnet-4-20250514, SDK 0.78 |
| AI (Embeddings) | OpenAI | text-embedding-3-small, SDK 6.22 |
| AI (Vision Fallback 1) | OpenAI GPT-4o | via openai SDK |
| AI (Vision Fallback 2) | Google Gemini | via google-auth-library |
| Password Hashing | bcryptjs | 3.0.3 |
| Validation | Zod | 3.24.2 |
| Charts | Recharts | 2.15.2 |
| Animations | Framer Motion | 11.13.1 |

**Note:** PDFKit is no longer in the stack. All report output is DOCX via the `docx` library. No PDF generation dependency remains.

---

## 3. Cavaridge Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ✅ Compliant | Org-scoped data isolation, `organizationId` on all tables, query scoping enforced in storage.ts |
| RBAC | ✅ Compliant | 7-tier role hierarchy (restructured — see Section 5), 15+ granular permissions, deal-level access control |
| Light/Dark/System theme | ✅ Compliant | ThemeProvider with localStorage persistence, system mode via `prefers-color-scheme` |
| No hardcoded client data | ⚠️ Partial | Assessment pillars, tech stack categories, and scoring algorithms hardcoded. Copyright notices in 5 report locations. Login/request-access footers hardcoded to v2.0. See Section 11 for full inventory. |
| IP hygiene | ✅ Compliant | No DIT references in codebase |
| OpenRouter via Cavaridge key | ❌ Absent | Uses direct ANTHROPIC_API_KEY, OPENAI_API_KEY, and GEMINI_API_KEY — not routed through OpenRouter |
| No plaintext secrets | ⚠️ Partial | Hardcoded fallback session secret when SESSION_SECRET not set. Seed credentials in seed.ts. |
| llm.config.js routing | ❌ Absent | Model selection scattered across route files — no central config |
| Rate limiting | ❌ Absent | No rate limiting on any API endpoints (~100+ routes unthrottled) |
| CSRF protection | ❌ Absent | Relies on sameSite cookies only — no CSRF tokens |
| Automated tests | ❌ Absent | Zero automated tests |

---

## 4. Database Schema

**PostgreSQL 16 + pgvector. 30 tables across 5 domains.**

| Table | Purpose |
|---|---|
| `organizations` | Tenant organizations — name, plan tier, limits, settings |
| `users` | User accounts — email, password hash, role, org membership |
| `deals` | M&A deals — target, industry, stage, scores, lifecycle |
| `deal_access` | Per-deal user access grants (lead, contributor, reviewer, observer) |
| `invitations` | Token-based user invitation records with expiry |
| `account_requests` | Public account request submissions — admin approve/reject |
| `audit_log` | User action audit trail |
| `platform_settings` | Global platform configuration |
| `organization_branding` | Report branding settings per org (logo, colors, footer) |
| `score_snapshots` | Historical risk score snapshots for trend analysis |
| `usage_tracking` | Plan tier usage counters per org |
| `processing_queue` | Background document processing queue |
| `pillars` | Risk assessment pillars per deal (6 pillars) |
| `findings` | Risk findings — severity, pillar, remediation, cost |
| `finding_cross_references` | Cross-referenced findings between deals/pillars |
| `documents` | Uploaded documents — file metadata, extracted text, classification, SHA-256 hash |
| `document_chunks` | Text chunks for RAG retrieval (vector 1536 dimensions) |
| `document_classifications` | Classification taxonomy reference data |
| `chat_messages` | Deprecated legacy chat — retained for historical data |
| `qa_conversations` | Ask MERIDIAN conversation threads |
| `qa_messages` | Individual Q&A messages within conversations |
| `qa_saved_answers` | Saved/cached Q&A answers with embeddings |
| `baseline_profiles` | Org-level acquirer technology baseline templates |
| `tech_stack_items` | Detected technology stack items per deal |
| `baseline_comparisons` | Acquirer vs. target tech gap analysis |
| `topology_nodes` | Network topology nodes (AI-extracted) |
| `topology_connections` | Network topology connections (AI-extracted) |
| `playbook_phases` | Integration playbook phases |
| `playbook_tasks` | Integration playbook tasks within phases |

**Vector support:** pgvector extension enabled. Embeddings stored as 1536-dimension vectors in `document_chunks` and `qa_saved_answers`.

**Schema management:** Uses `drizzle push` — no versioned migrations, no rollback path. This is flagged as technical debt.

---

## 5. Authentication & Authorization

### Implemented

- Session-based auth via `express-session` + PostgreSQL session store (connect-pg-simple)
- Passport.js local strategy (email + bcrypt, 10 salt rounds)
- **7-tier role hierarchy (restructured from v1.0.0):**

| Tier | Role | Scope |
|---|---|---|
| 1 | `platform_owner` | Global — full platform control |
| 2 | `platform_admin` | Global — manage orgs, impersonate, no billing |
| 3 | `org_admin` | Tenant — full control within org |
| 4 | `deal_lead` | Tenant — lead-level deal access (NEW — replaces org_owner) |
| 5 | `analyst` | Tenant — create, read, update within org |
| 6 | `contributor` | Tenant — limited create/update |
| 7 | `viewer` | Tenant — read-only |

- 15+ granular permissions: create_deals, add_findings, delete_documents, invite_users, change_roles, manage_org_settings, use_chat, view_audit_log, and others (server/permissions.ts)
- Deal-level access control via `deal_access` table
- Platform admin org-switching (impersonation)
- Token-based invitation flow with role assignment and expiry
- Account request flow — public submission, admin approve/reject
- Audit logging via `audit_log` table

### Missing

- No password reset / forgot password
- No email delivery — invitations and account requests are in-app only
- No MFA / 2FA
- No OAuth / SSO (Google, Microsoft, SAML)
- No login rate limiting / brute-force protection
- No account lockout after failed attempts
- No CSRF tokens
- No session timeout configuration (express-session defaults)
- Hardcoded fallback session secret when SESSION_SECRET env var not set

---

## 6. Multitenancy Status

**Fully implemented.**

- `organizations` table with UUID primary keys
- Every user belongs to exactly one `organizationId`
- All data tables scoped via `organizationId` through the `deals` table
- `server/storage.ts` filters all queries by `tenantId` derived from authenticated user's `organizationId`
- Platform admins can view and manage all organizations via `/platform-admin`
- Org-level settings: branding, baseline profiles, plan tier limits
- `deal_access` table provides per-deal permission granularity within an org

---

## 7. UI Theming

**Light, dark, and system modes — fully implemented.**

- Theme provider at `client/src/lib/theme.tsx`
- Three modes: `light`, `dark`, `system` (follows OS preference via `prefers-color-scheme`)
- Default: `dark`
- Persisted in `localStorage` under key `meridian-theme`
- CSS variables in `client/src/index.css` under `:root` and `.dark` selectors
- Color palette: dark navy backgrounds, blue primary, green/amber/red status indicators, purple for AI features, cyan for data
- Fonts: DM Sans (UI text), JetBrains Mono (data/numbers) — aligns with Cavaridge design system standard
- Theme toggle in sidebar footer

---

## 8. Core Features

### Production-Ready

- Deal pipeline management with lifecycle stages and deal codes
- 6-pillar risk assessment with evidence-confidence weighted scoring
- Document ingestion pipeline (PDF, DOCX, XLSX, email, images, ZIP) with SHA-256 deduplication
- Text chunking and vector embedding generation
- Semantic search (pgvector with three-tier fallback)
- AI document classification
- DOCX report generation — Intelligence Report and Executive Summary (docx library)
- Excel export (ExcelJS, 5 worksheets) and CSV export
- Per-org report branding (logo, colors, footer text)
- Plan-based usage limit enforcement (plan-limits.ts)
- Platform administration with org management and sterilization tool
- 7-tier RBAC with deal-level access control
- Full multitenancy with org isolation
- Theme system (light/dark/system)
- Audit logging
- Score snapshots for trend analysis
- Account request flow

### Production-Grade but AI-Dependent

- AI-powered document classification (document-classifier.ts)
- AI infrastructure extraction — tech stack, topology, baseline (infra-extraction.ts)
- AI integration playbook generation
- AI report content consolidation, summaries, and narratives (report-ai.ts)
- RAG-powered Q&A — Ask MERIDIAN (qa-engine.ts)
- AI image and vision analysis with multi-provider fallback (Claude → GPT-4o → Gemini)
- Monte Carlo financial simulation (functional, simplified cost model)

### Prototype / Not Yet Wired

- **Auto-finding extraction** — `extractFindingsFromText()` exists in ingestion.ts but is not called from `processExtractedFile()`. Findings are not auto-extracted during document upload.
- **Finding cross-references** — table and finding-matcher.ts exist, limited active usage
- **Portfolio analytics** — functional but limited to basic KPIs and charts
- **Sterilization tool** — works but references hardcoded org names (see Section 11)

---

## 9. Server Modules

| File | Purpose |
|---|---|
| `server/index.ts` | Express app creation, middleware stack, server listen |
| `server/routes.ts` | All API route definitions (~3000 lines — split flagged as debt) |
| `server/storage.ts` | IStorage interface + PostgreSQL implementation (all CRUD, monolithic) |
| `server/db.ts` | Drizzle ORM + pg pool initialization |
| `server/auth.ts` | Passport.js local strategy, session config |
| `server/permissions.ts` | 7-tier RBAC permission checks |
| `server/plan-limits.ts` | Plan tier usage limit enforcement |
| `server/seed.ts` | Database seeding — demo org, users, deals, findings |
| `server/ingestion.ts` | Document text extraction pipeline (PDF, DOCX, XLSX, email, images) |
| `server/processing-pipeline.ts` | Background document processing queue |
| `server/document-classifier.ts` | AI content-based document classification |
| `server/embeddings.ts` | OpenAI embeddings + pgvector storage + semantic search |
| `server/qa-engine.ts` | RAG Q&A engine — retrieval, Claude generation, citations |
| `server/vision.ts` | AI vision analysis — Claude → GPT-4o → Gemini fallback |
| `server/infra-extraction.ts` | AI infrastructure extraction — tech stack, topology, baseline, playbook |
| `server/finding-matcher.ts` | Cross-reference finding matching |
| `server/report-export.ts` | DOCX report generation (~1740 lines) |
| `server/report-ai.ts` | AI-powered report content — consolidation, summaries, narratives |
| `server/report-branding.ts` | Organization branding application to reports |
| `server/excel-export.ts` | Excel (XLSX) export with 5 worksheets |
| `server/preview.ts` | Document preview rendering |
| `server/static.ts` | Static file serving for production builds |
| `server/vite.ts` | Vite dev server middleware integration |
| `scripts/bump-version.js` | Platform version bumping utility |
| `scripts/sterilize-production.ts` | Production data cleanup script |
| `version.json` | Platform version — currently 2.2.0+0 |

---

## 10. API Surface (Summary)

~100+ routes across these domains. See Replit technical summary for full endpoint listing.

| Domain | Route Prefix | Notes |
|---|---|---|
| Authentication | `/api/auth/` | register, login, logout, me |
| Organization | `/api/org/` | info, settings, members, roles, deal-access, audit-log, baseline-profiles |
| Branding | `/api/settings/branding` | get, update, logo upload |
| Invitations | `/api/invitations/` | create, list, lookup, accept |
| Deals | `/api/deals/` | CRUD, pillars, findings, scores, lifecycle, access |
| Documents | `/api/documents/`, `/api/deals/:id/documents` | list, delete, preview, classify, embed, search, image analysis |
| Reports & Exports | `/api/deals/:id/export/` | DOCX intelligence report, DOCX executive summary, CSV, Excel, SSE streams |
| Infrastructure | `/api/deals/:id/` | tech-stack, topology, baseline-comparison, infra-analysis |
| Playbook | `/api/deals/:id/playbook` | get, generate |
| Simulator | `/api/deals/:id/simulate/monte-carlo` | Monte Carlo simulation |
| Portfolio | `/api/portfolio/` | risk-trend, pillar-matrix |
| Q&A | `/api/deals/:dealId/qa/` | ask, conversations, save-answer |
| Platform Admin | `/api/platform/` | orgs, users, settings, account-requests, stats, sterilize |
| System | `/api/version`, `/api/system-status`, `/api/pipeline-stats`, `/api/ai/status` | Health and version endpoints |

**Note:** `/api/deals/:id/export/pdf` and `/api/deals/:id/export/executive-pdf` serve DOCX files despite the path names. Semantic mismatch — backward-compatible but should be resolved.

---

## 11. Hardcoded Values — Full Inventory

| Location | Value | Recommended Fix |
|---|---|---|
| `server/seed.ts:68` | `"Cavaridge, LLC"` | Acceptable in seed only — never in production |
| `server/seed.ts:91` | `"Meridian2026!"` | Acceptable in seed only — never in production |
| `server/seed.ts:98` | `"ben@cavaridge.com"` | Acceptable in seed only — never in production |
| `server/report-export.ts:380,1240,1312,1408,1553` | `"© 2026 Cavaridge, LLC"` (5 instances) | Pull from org branding or platform_settings |
| `client/src/pages/login.tsx:123` | `"MERIDIAN v2.0 © 2026 Cavaridge, LLC"` | Read version from `/api/version`; copyright from platform_settings |
| `client/src/pages/request-access.tsx:281` | `"MERIDIAN v2.0 © 2026 Cavaridge, LLC"` | Same as login.tsx fix |
| `client/src/pages/platform-admin.tsx:662` | `"Cavaridge, LLC"` in sterilization UI | Read from platform owner org name |
| `client/src/pages/settings.tsx:1915,1937` | `"Cavaridge Holdings"` / `"Cavaridge"` in sterilization warnings | Read from platform owner org name |
| Assessment pillars (6) | Hardcoded in scoring logic | Make configurable per org — P2 remediation |
| Tech stack categories (12) | Hardcoded in extraction logic | Make configurable per org — P2 remediation |

---

## 12. Known Bugs & Technical Debt

### Active Bugs

- **Audit log FK error on startup** — `audit_log_user_id_fkey` violation for `user_id = 'system'` on version deploy log. System user does not exist in `users` table. Non-blocking but logs error on every restart.
- **Login page shows hardcoded version** — `v2.0` displayed instead of reading from `/api/version`.

### Incomplete Features

- **Auto-finding extraction** — `extractFindingsFromText()` in ingestion.ts not wired into `processExtractedFile()`. Documents are ingested but findings are not auto-extracted.
- **Password reset** — Not implemented.
- **Email delivery** — No email service configured. Invitations and account approvals are in-app only.
- **Document re-processing** — No UI to re-extract text from a previously processed document.
- **API key auth** — Enterprise plan advertises API Access but no implementation exists.

### Technical Debt

- `server/routes.ts` is ~3000 lines — must be split into domain route modules (auth, deals, documents, reports, platform)
- `server/storage.ts` is monolithic — all storage methods in one class
- `server/report-export.ts` is ~1740 lines — candidate for decomposition
- `chat_messages` table is deprecated — migrate data to `qa_messages` and drop
- API route paths `/export/pdf` serve DOCX — semantic mismatch should be resolved
- Schema uses `drizzle push` with no versioned migrations — no rollback path
- No request validation middleware — validation is inline per route handler
- No rate limiting on any endpoint
- No CSRF tokens
- No structured logging — uses console.log / console.error
- No automated tests
- No CI/CD pipeline
- Some shadcn/ui components installed but unused

---

## 13. Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing key (fallback hardcoded if absent — must be set) |
| `OPENAI_API_KEY` | OpenAI API — embeddings (text-embedding-3-small) + GPT-4o vision |
| `ANTHROPIC_API_KEY` | Anthropic API — Claude primary LLM |
| `GEMINI_API_KEY` | Google Gemini API — vision fallback |
| `GOOGLE_API_KEY` | Google API — some Gemini auth flows |
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | development / production |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Replit Object Storage public paths (auto-set) |
| `PRIVATE_OBJECT_DIR` | Replit Object Storage private directory (auto-set) |

**Standards gap:** These should be replaced with a single `OPENROUTER_API_KEY` routed through the Cavaridge OpenRouter account with a `llm.config.js` managing model selection. Currently non-compliant with Cavaridge LLM access standard.

---

## 14. Deployment Status

| Field | Value |
|---|---|
| Platform | Replit |
| Deployment target | Autoscale |
| Status | Live — checkpoint 2252d917 deployed |
| Platform version | 2.2.0+0 |
| Last deploy | 2026-03-04 |
| Port | 5000 internal → 80 external |

**Build process:**
1. `npm run build` → executes `tsx script/build.ts`
2. Backend bundled via esbuild → `dist/index.cjs`
3. Frontend built via Vite → `dist/public/`
4. Production start: `node ./dist/index.cjs`

**Infrastructure:**
- Database: Replit-managed PostgreSQL 16
- File storage: Replit Object Storage (auto-provisioned, GCS-backed)

**Lock-in note:** File storage uses Replit Object Storage exclusively. Migration to S3 or Azure Blob requires replacing the ObjectStorageService layer. No Dockerfile or containerization exists.

---

## 15. Shared Components (Extractable to cvg-shared)

| Component | File | Priority |
|---|---|---|
| 7-tier RBAC middleware | server/permissions.ts | P2 — reference implementation for portfolio |
| Org-scoped multitenancy middleware | server/storage.ts | P2 — only full implementation in portfolio |
| ThemeProvider with system preference detection | client/src/lib/theme.tsx | P2 |
| DOCX report generation patterns | server/report-export.ts | P3 |
| Vector search pipeline (embeddings + pgvector) | server/embeddings.ts | P3 |
| Audit logging middleware | server/audit_log (in routes) | P3 |
| Per-org branding system | server/report-branding.ts | P3 |
| Document ingestion pipeline | server/ingestion.ts | P3 — needed by CVG-APOGEE |
| Plan limit enforcement | server/plan-limits.ts | P3 |

---

## 16. Remediation Priorities

| Priority | Task | Effort | Change from v1.0.0 |
|---|---|---|---|
| P1 | Set SESSION_SECRET as required env var — remove hardcoded fallback | Low | Unchanged |
| P1 | Route all AI calls through OpenRouter — create llm.config.js | Medium | Unchanged |
| P1 | Add rate limiting to all API endpoints | Medium | Unchanged |
| P1 | Add CSRF protection | Medium | Unchanged |
| P1 | Wire auto-finding extraction into processExtractedFile() | Low | NEW |
| P1 | Fix audit log FK error for system user on startup | Low | NEW |
| P1 | Fix login page version to read from /api/version | Low | NEW |
| P2 | Make assessment pillars and tech stack categories configurable per org | High | Unchanged |
| P2 | Implement versioned Drizzle migrations | Medium | Unchanged |
| P2 | Split routes.ts into domain modules | High | NEW |
| P2 | Fix /export/pdf route paths to reflect DOCX output | Low | NEW |
| P2 | Add SSO/SAML/OIDC support | High | Unchanged |
| P2 | Add password reset flow | Medium | Unchanged |
| P2 | Add email delivery service | Medium | Unchanged |
| P3 | Add automated tests for critical paths | High | Unchanged |
| P3 | Set up GitHub Actions CI/CD | Medium | Unchanged |
| P3 | Add error monitoring (Sentry or equivalent) | Medium | Unchanged |
| P3 | Extract multitenancy + RBAC middleware to cvg-shared | High | Unchanged |
| P3 | Migrate chat_messages data to qa_messages and drop table | Low | NEW |

---

## 17. DIT Tenant Boundary

- DIT is a tenant within Meridian — never a co-owner
- No DIT names, logos, or references in source code
- All client customizations go in the organization branding and config record
- DIT test data stays within the DIT organization namespace only

---

## 18. Runbook Maintenance

Regenerate on any Major or Minor version increment, new module addition, or architecture change.

**Claude Project Runbook Prompt:**
> "Generate a project state summary in markdown covering: (1) Project name and purpose, (2) Legal entity owner, (3) Tech stack and key dependencies, (4) Core features built or in progress, (5) Shared utilities or components that could apply to other apps, (6) Hardcoded values or assumptions that need to be made configurable, (7) Current RBAC and multitenancy status, (8) UI/UX standards in use (theming, component library, etc.), (9) Known gaps or technical debt, (10) Any Dedicated IT or client-specific references that need to be abstracted out."

**Replit Runbook Prompt:**
> "Generate a technical state summary in markdown covering: (1) Project name and primary purpose, (2) Current tech stack — framework, language, runtime, key libraries and versions, (3) Folder and file structure — full tree with a one-line description of each key file or folder, (4) Environment variables currently in use — names only no values, (5) Authentication and authorization implementation — what exists what is missing, (6) Multitenancy status — implemented partial or absent, (7) UI theming — light/dark/system mode status, (8) Database schema or data model summary, (9) API endpoints or routes currently defined, (10) Third-party integrations — APIs SDKs services connected, (11) Hardcoded values that should be configurable — flag anything client-specific, (12) Known bugs incomplete features or technical debt, (13) What is production-ready vs. prototype/draft, (14) Deployment status — where hosted what is the deployment process."

---

*This document is governed by CVG-CORE. Any deviation requires explicit approval documented in the CVG-CORE project before implementation.*
*CVG-MERIDIAN-RB-v2.0.0-20260305 — Cavaridge, LLC — Internal Confidential*
