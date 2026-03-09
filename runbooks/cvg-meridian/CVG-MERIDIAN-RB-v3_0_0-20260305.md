# CVG-MERIDIAN — Meridian Application Runbook
**Document:** CVG-MERIDIAN-RB-v3.0.0-20260305
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303
**Supersedes:** CVG-MERIDIAN-RB-v2.0.0-20260305

---

## Changelog from v2.0.0

| Change | Detail |
|---|---|
| Full CVG-CORE compliance achieved | All 12 universal build standards now met — up from 4/12 compliant, 3/12 partial, 5/12 absent |
| OpenRouter migration complete | All AI calls route through single `OPENROUTER_API_KEY` via `llm.config.ts`. Direct Anthropic, OpenAI, and Gemini keys deprecated. Per-tenant cost tagging active. |
| Security hardening | Session secret fallback removed (startup crash if unset). Seed route guarded from production. Rate limiting on all endpoints. CSRF double-submit cookie protection on all state-changing routes. Login throttling active. |
| Route architecture restructured | Monolithic `routes.ts` (~3000 lines) split into 9 domain modules. Mount file now <100 lines. |
| Versioned migrations | `drizzle push` replaced with `drizzle-kit generate` + migration runner. Migrations committed to Git with rollback capability. |
| CI/CD pipeline added | GitHub Actions validates TypeScript compilation, linting, tests, and build on all PRs to `main` and `dev`. |
| Automated test suite | 15+ tests covering auth, deal CRUD, document upload, RBAC enforcement, and org isolation via Vitest + supertest. |
| Error monitoring | Sentry integrated server-side and client-side. React error boundaries on all high-risk pages. Graceful degradation when DSN not configured. |
| Structured logging | Pino logger with JSON output, request-scoped context (requestId, userId, orgId). All console.log/error replaced. |
| Configurable assessment pillars | 6 pillars moved from hardcoded logic to `pillar_templates` table. Org-level customization with platform defaults. |
| Configurable tech stack categories | 12 categories moved from hardcoded logic to `tech_category_templates` table. Org-level customization with platform defaults. |
| Auto-finding extraction wired | `extractFindingsFromText()` now called during document ingestion. Findings auto-extracted and saved with `source: 'auto-extracted'`. |
| Password reset flow | Token-based password reset with SHA-256 hashed tokens, 1-hour expiry, single-use enforcement. |
| Email delivery service | Resend integration with fallback to log output in dev. Templates for invitation, account approval/rejection, and password reset. |
| Dynamic copyright and versioning | All hardcoded version strings and copyright notices now read from `/api/version` and org branding / platform_settings. |
| `chat_messages` table dropped | Data migrated to `qa_messages`. All references removed from codebase. |
| Export route paths corrected | `/export/docx` and `/export/executive-docx` added. Legacy `/export/pdf` paths retained with deprecation headers. |
| System user created | Reserved UUID system user inserted on startup — resolves audit log FK violation. |
| Database expanded | 30 → 33 tables. New: `pillar_templates`, `tech_category_templates`, `password_reset_tokens`. Dropped: `chat_messages`. |

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-MERIDIAN |
| **App Name** | Meridian |
| **Platform Version** | 3.0.0 |
| **Purpose** | M&A IT Intelligence Platform for private equity firms and investment committees — deal pipeline, risk assessment, AI document analysis, infrastructure intelligence, integration playbooks, Monte Carlo simulation, portfolio analytics, and IC-grade DOCX report generation |
| **IP Owner** | Cavaridge, LLC |
| **Status** | In Development — most mature app in the portfolio, first to achieve full CVG-CORE compliance |
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
| Migrations | drizzle-kit generate + migrate | Versioned, committed to Git |
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
| AI (All Providers) | OpenRouter | Single gateway — `OPENROUTER_API_KEY` |
| AI Model Config | server/llm.config.ts | Centralized model routing |
| AI (Primary LLM) | Anthropic Claude via OpenRouter | claude-sonnet-4-20250514 |
| AI (Embeddings) | OpenAI via OpenRouter | text-embedding-3-small |
| AI (Vision) | OpenAI GPT-4o via OpenRouter | Fallback: Google Gemini via OpenRouter |
| Email Delivery | Resend | Fallback: log output in dev |
| Error Monitoring | Sentry | Server + client |
| Logging | Pino | Structured JSON, request-scoped |
| Rate Limiting | express-rate-limit | 3-tier: global, auth-strict, AI |
| CSRF Protection | Double-submit cookie | X-XSRF-TOKEN header validation |
| Password Hashing | bcryptjs | 3.0.3 |
| Testing | Vitest + supertest | 15+ tests |
| CI/CD | GitHub Actions | PR validation: typecheck, lint, test, build |
| Validation | Zod | 3.24.2 |
| Charts | Recharts | 2.15.2 |
| Animations | Framer Motion | 11.13.1 |

---

## 3. Cavaridge Standards Compliance

| # | Standard | Status | Notes |
|---|---|---|---|
| 1 | Multitenancy | ✅ Compliant | Org-scoped data isolation, `organizationId` on all tables, query scoping enforced in storage.ts |
| 2 | RBAC | ✅ Compliant | 7-tier role hierarchy, 15+ granular permissions, deal-level access control |
| 3 | Light/Dark/System theme | ✅ Compliant | ThemeProvider with localStorage persistence, system mode via `prefers-color-scheme` |
| 4 | No hardcoded client data | ✅ Compliant | Copyright from org branding / platform_settings. Version from `/api/version`. Pillars and tech categories configurable per org. |
| 5 | IP hygiene | ✅ Compliant | No DIT references in codebase |
| 6 | LLM access via OpenRouter | ✅ Compliant | All AI calls route through `OPENROUTER_API_KEY` via `llm.config.ts`. Per-tenant cost tagging with `app_code` and `tenant_id`. |
| 7 | Secret management | ✅ Compliant | SESSION_SECRET required (startup crash if absent). Seed route blocked in production. Doppler configured for staging/production. |
| 8 | Rate limiting | ✅ Compliant | 3-tier: global (100/min), auth-strict (5/min), AI endpoints (20/min). Health endpoints exempt. 429 responses with retry headers. |
| 9 | CSRF protection | ✅ Compliant | Double-submit cookie pattern. XSRF-TOKEN cookie + X-XSRF-TOKEN header validation on all POST/PUT/PATCH/DELETE. Auth and public endpoints exempt. |
| 10 | Automated testing | ✅ Compliant | 15+ Vitest tests: auth (3), deal CRUD (3), document upload (2), RBAC (4), org isolation (3). |
| 11 | CI/CD | ✅ Compliant | GitHub Actions on PR to main/dev: TypeScript compile, lint, test, build. Merge blocked on failure. |
| 12 | Error handling | ✅ Compliant | React error boundaries on top-level and high-risk pages. Sentry server + client. Pino structured logging with request context. |

**Result: 12 of 12 fully compliant.**

---

## 4. Database Schema

**PostgreSQL 16 + pgvector. 32 tables across 6 domains.**

### Core Domain

| Table | Purpose |
|---|---|
| `organizations` | Tenant organizations — name, plan tier, limits, settings |
| `users` | User accounts — email, password hash, role, org membership. Includes reserved system user. |
| `deals` | M&A deals — target, industry, stage, scores, lifecycle |
| `deal_access` | Per-deal user access grants (lead, contributor, reviewer, observer) |
| `invitations` | Token-based user invitation records with expiry |
| `account_requests` | Public account request submissions — admin approve/reject |
| `password_reset_tokens` | SHA-256 hashed reset tokens with 1-hour expiry and single-use tracking |
| `audit_log` | User action audit trail |
| `platform_settings` | Global platform configuration |
| `organization_branding` | Report branding settings per org (logo, colors, footer) |
| `score_snapshots` | Historical risk score snapshots for trend analysis |
| `usage_tracking` | Plan tier usage counters per org |
| `processing_queue` | Background document processing queue |

### Assessment Domain

| Table | Purpose |
|---|---|
| `pillars` | Risk assessment pillars per deal (instantiated from templates) |
| `pillar_templates` | Org-level or platform-default pillar definitions (name, key, weight, sort order) |
| `findings` | Risk findings — severity, pillar, remediation, cost. Includes `source` field for auto-extracted vs manual. |
| `finding_cross_references` | Cross-referenced findings between deals/pillars |

### Document Domain

| Table | Purpose |
|---|---|
| `documents` | Uploaded documents — file metadata, extracted text, classification, SHA-256 hash |
| `document_chunks` | Text chunks for RAG retrieval (vector 1536 dimensions) |
| `document_classifications` | Classification taxonomy reference data |

### Q&A Domain

| Table | Purpose |
|---|---|
| `qa_conversations` | Ask MERIDIAN conversation threads (includes migrated chat_messages data) |
| `qa_messages` | Individual Q&A messages within conversations |
| `qa_saved_answers` | Saved/cached Q&A answers with embeddings |

### Infrastructure Domain

| Table | Purpose |
|---|---|
| `baseline_profiles` | Org-level acquirer technology baseline templates |
| `tech_stack_items` | Detected technology stack items per deal |
| `tech_category_templates` | Org-level or platform-default tech stack category definitions |
| `baseline_comparisons` | Acquirer vs. target tech gap analysis |
| `topology_nodes` | Network topology nodes (AI-extracted) |
| `topology_connections` | Network topology connections (AI-extracted) |

### Integration Domain

| Table | Purpose |
|---|---|
| `playbook_phases` | Integration playbook phases |
| `playbook_tasks` | Integration playbook tasks within phases |

**Vector support:** pgvector extension enabled. Embeddings stored as 1536-dimension vectors in `document_chunks` and `qa_saved_answers`.

**Schema management:** Versioned Drizzle migrations via `drizzle-kit generate`. Migration files committed to `drizzle/migrations/`. Auto-run on server startup. Rollback via migration history.

---

## 5. Authentication & Authorization

### Implemented

- Session-based auth via `express-session` + PostgreSQL session store (connect-pg-simple)
- `SESSION_SECRET` required — server crashes on startup if not set (no fallback)
- Passport.js local strategy (email + bcrypt, 10 salt rounds)
- Login rate limiting: 5 attempts per minute per IP
- CSRF double-submit cookie on all state-changing endpoints
- Password reset: token-based, SHA-256 hashed tokens, 1-hour expiry, single-use
- **7-tier role hierarchy:**

| Tier | Role | Scope |
|---|---|---|
| 1 | `platform_owner` | Global — full platform control |
| 2 | `platform_admin` | Global — manage orgs, impersonate, no billing |
| 3 | `org_admin` | Tenant — full control within org |
| 4 | `deal_lead` | Tenant — lead-level deal access |
| 5 | `analyst` | Tenant — create, read, update within org |
| 6 | `contributor` | Tenant — limited create/update |
| 7 | `viewer` | Tenant — read-only |

- 15+ granular permissions: create_deals, add_findings, delete_documents, invite_users, change_roles, manage_org_settings, use_chat, view_audit_log, and others (server/permissions.ts)
- Deal-level access control via `deal_access` table
- Platform admin org-switching (impersonation)
- Token-based invitation flow with role assignment, expiry, and email notification
- Account request flow — public submission, admin approve/reject with email notification
- Audit logging via `audit_log` table with reserved system user for platform events
- Seed route blocked in production (returns 404)

### Not Yet Implemented

- MFA / 2FA
- OAuth / SSO (Google, Microsoft, SAML)
- Account lockout after failed attempts (rate limiting provides partial coverage)
- Session timeout configuration (express-session defaults)
- API key authentication (enterprise plan feature — advertised but not built)

---

## 6. Multitenancy Status

**Fully implemented — unchanged from v2.0.0.**

- `organizations` table with UUID primary keys
- Every user belongs to exactly one `organizationId`
- All data tables scoped via `organizationId` through the `deals` table
- `server/storage.ts` filters all queries by `tenantId` derived from authenticated user's `organizationId`
- Platform admins can view and manage all organizations via `/platform-admin`
- Org-level settings: branding, baseline profiles, plan tier limits, pillar templates, tech category templates
- `deal_access` table provides per-deal permission granularity within an org
- Org isolation verified by automated tests (3 tests)

---

## 7. UI Theming

**Light, dark, and system modes — fully implemented. Unchanged from v2.0.0.**

- Theme provider at `client/src/lib/theme.tsx`
- Three modes: `light`, `dark`, `system` (follows OS preference via `prefers-color-scheme`)
- Default: `dark`
- Persisted in `localStorage` under key `meridian-theme`
- CSS variables in `client/src/index.css` under `:root` and `.dark` selectors
- Color palette: dark navy backgrounds, blue primary, green/amber/red status indicators, purple for AI features, cyan for data
- Fonts: DM Sans (UI text), JetBrains Mono (data/numbers) — aligns with Cavaridge design system standard
- Theme toggle in sidebar footer

---

## 8. LLM Configuration

### Central Config: `server/llm.config.ts`

All AI model selection is defined in this single file. No model IDs appear anywhere else in the codebase.

| Task | Model | Route Key |
|---|---|---|
| Report generation | anthropic/claude-sonnet-4-20250514 | `reportGeneration` |
| Risk classification | anthropic/claude-sonnet-4-20250514 | `riskClassification` |
| Document classification | anthropic/claude-sonnet-4-20250514 | `documentClassification` |
| Document analysis | anthropic/claude-sonnet-4-20250514 | `documentAnalysis` |
| Q&A engine | anthropic/claude-sonnet-4-20250514 | `qaEngine` |
| Infrastructure extraction | anthropic/claude-sonnet-4-20250514 | `infraExtraction` |
| Embeddings | openai/text-embedding-3-small | `embeddings` |
| Vision (primary) | openai/gpt-4o | `vision` |
| Vision (fallback) | google/gemini-pro-1.5 | `visionFallback` |
| Lightweight UI hints | mistralai/mistral-7b-instruct | `lightweightUI` |

### Cost Tracking

Every OpenRouter request includes:
- `HTTP-Referer: https://meridian.cavaridge.com`
- `X-Title: CVG-MERIDIAN`
- `metadata.app_code: "CVG-MERIDIAN"`
- `metadata.tenant_id: <org UUID>`

### Environment

Single required variable: `OPENROUTER_API_KEY`

Legacy variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`) deprecated. If present, a startup warning is logged.

---

## 9. Core Features

### Production-Ready

- Deal pipeline management with lifecycle stages and deal codes
- 6-pillar risk assessment with evidence-confidence weighted scoring (pillars configurable per org)
- Document ingestion pipeline (PDF, DOCX, XLSX, email, images, ZIP) with SHA-256 deduplication
- **Auto-finding extraction** — findings automatically extracted during document ingestion, saved with `source: 'auto-extracted'`
- Text chunking and vector embedding generation
- Semantic search (pgvector with three-tier fallback)
- AI document classification
- DOCX report generation — Intelligence Report and Executive Summary (docx library)
- Excel export (ExcelJS, 5 worksheets) and CSV export
- Per-org report branding (logo, colors, footer text, dynamic copyright)
- Plan-based usage limit enforcement (plan-limits.ts)
- Platform administration with org management and sterilization tool
- 7-tier RBAC with deal-level access control
- Full multitenancy with org isolation
- Theme system (light/dark/system)
- Audit logging with reserved system user
- Score snapshots for trend analysis
- Account request flow with email notifications
- Token-based invitation flow with email notifications
- Password reset flow (token-based, 1-hour expiry, single-use)
- Email delivery (Resend with dev fallback)
- Rate limiting (3-tier)
- CSRF protection (double-submit cookie)
- Structured logging (Pino, JSON, request-scoped)
- Error monitoring (Sentry, server + client)
- React error boundaries on top-level and high-risk pages
- Automated test suite (15+ tests)
- CI/CD pipeline (GitHub Actions)

### Production-Grade but AI-Dependent

- AI-powered document classification (document-classifier.ts)
- AI infrastructure extraction — tech stack, topology, baseline (infra-extraction.ts)
- AI integration playbook generation
- AI report content consolidation, summaries, and narratives (report-ai.ts)
- RAG-powered Q&A — Ask MERIDIAN (qa-engine.ts)
- AI image and vision analysis with multi-provider fallback via OpenRouter
- Monte Carlo financial simulation (functional, simplified cost model)

### Prototype / Limited Usage

- **Finding cross-references** — table and finding-matcher.ts exist, limited active usage
- **Portfolio analytics** — functional but limited to basic KPIs and charts

---

## 10. Server Architecture

### Route Modules

| File | Domain | Route Prefix |
|---|---|---|
| `server/routes/auth.ts` | Authentication | `/api/auth/` |
| `server/routes/org.ts` | Organization | `/api/org/` |
| `server/routes/deals.ts` | Deals | `/api/deals/` |
| `server/routes/documents.ts` | Documents | `/api/documents/`, `/api/deals/:id/documents` |
| `server/routes/reports.ts` | Reports & Exports | `/api/deals/:id/export/` |
| `server/routes/qa.ts` | Q&A | `/api/deals/:dealId/qa/` |
| `server/routes/platform.ts` | Platform Admin | `/api/platform/` |
| `server/routes/portfolio.ts` | Portfolio Analytics | `/api/portfolio/` |
| `server/routes/system.ts` | Health & Version | `/api/version`, `/api/system-status`, etc. |

### Service Modules

| File | Purpose |
|---|---|
| `server/routes.ts` | Thin mount file — imports and registers all route modules (<100 lines) |
| `server/index.ts` | Express app creation, middleware stack (rate limiting, CSRF, Sentry, logging), server listen |
| `server/storage.ts` | IStorage interface + PostgreSQL implementation (all CRUD, org-scoped) |
| `server/db.ts` | Drizzle ORM + pg pool initialization |
| `server/migrate.ts` | Drizzle migration runner — executes on startup |
| `server/auth.ts` | Passport.js local strategy, session config (SESSION_SECRET required) |
| `server/permissions.ts` | 7-tier RBAC permission checks |
| `server/plan-limits.ts` | Plan tier usage limit enforcement |
| `server/llm.config.ts` | Centralized AI model routing for all providers via OpenRouter |
| `server/logger.ts` | Pino structured logger + Express request-scoped middleware |
| `server/email.ts` | Resend email delivery with dev fallback + HTML templates |
| `server/seed.ts` | Database seeding — guarded from production execution |
| `server/ingestion.ts` | Document text extraction pipeline + auto-finding extraction |
| `server/processing-pipeline.ts` | Background document processing queue |
| `server/document-classifier.ts` | AI content-based document classification |
| `server/embeddings.ts` | OpenAI embeddings via OpenRouter + pgvector storage + semantic search |
| `server/qa-engine.ts` | RAG Q&A engine — retrieval, Claude generation, citations |
| `server/vision.ts` | AI vision analysis — GPT-4o → Gemini fallback, both via OpenRouter |
| `server/infra-extraction.ts` | AI infrastructure extraction — reads tech categories from config |
| `server/finding-matcher.ts` | Cross-reference finding matching |
| `server/report-export.ts` | DOCX report generation (~1740 lines) |
| `server/report-ai.ts` | AI-powered report content — consolidation, summaries, narratives |
| `server/report-branding.ts` | Organization branding application to reports (dynamic copyright) |
| `server/excel-export.ts` | Excel (XLSX) export with 5 worksheets |
| `server/preview.ts` | Document preview rendering |
| `server/static.ts` | Static file serving for production builds |
| `server/vite.ts` | Vite dev server middleware integration |

### Middleware Stack (order matters)

1. Sentry request handler
2. Pino request logger (attaches `req.log` with requestId, userId, orgId)
3. Express session (connect-pg-simple)
4. Passport authentication
5. CSRF double-submit cookie
6. Global rate limiter (100/min)
7. Route-specific rate limiters (auth: 5/min, AI: 20/min)
8. Route modules
9. Sentry error handler
10. Generic error handler

### Scripts

| File | Purpose |
|---|---|
| `scripts/bump-version.js` | Platform version bumping utility |
| `scripts/sterilize-production.ts` | Production data cleanup script |
| `scripts/migrate-chat-messages.ts` | One-time migration from deprecated chat_messages |
| `version.json` | Platform version — currently 3.0.0 |

---

## 11. API Surface

~100+ routes across 9 domain modules.

| Domain | Route Prefix | Key Endpoints |
|---|---|---|
| Authentication | `/api/auth/` | register, login, logout, me, forgot-password, reset-password |
| Organization | `/api/org/` | info, settings, members, roles, deal-access, audit-log, baseline-profiles, branding, invitations, pillar-templates, tech-categories |
| Deals | `/api/deals/` | CRUD, pillars, findings, scores, lifecycle, access |
| Documents | `/api/documents/`, `/api/deals/:id/documents` | list, delete, preview, classify, embed, search, image analysis, upload |
| Reports & Exports | `/api/deals/:id/export/` | `/docx` (intelligence report), `/executive-docx` (executive summary), `/csv`, `/excel`. Legacy `/pdf` and `/executive-pdf` retained with deprecation headers. |
| Infrastructure | `/api/deals/:id/` | tech-stack, topology, baseline-comparison, infra-analysis |
| Playbook | `/api/deals/:id/playbook` | get, generate |
| Simulator | `/api/deals/:id/simulate/monte-carlo` | Monte Carlo simulation |
| Portfolio | `/api/portfolio/` | risk-trend, pillar-matrix |
| Q&A | `/api/deals/:dealId/qa/` | ask, conversations, save-answer |
| Platform Admin | `/api/platform/` | orgs, users, settings, account-requests, stats, sterilize |
| System | `/api/version`, `/api/system-status`, `/api/pipeline-stats`, `/api/ai/status` | Health, version, pipeline stats |

---

## 12. Hardcoded Values — Remaining Inventory

| Location | Value | Status |
|---|---|---|
| `server/seed.ts` | `"Cavaridge, LLC"`, `"Meridian2026!"`, `"ben@cavaridge.com"` | Acceptable — seed only, blocked in production |
| Assessment pillars (6 defaults) | Platform default pillar templates | Acceptable — configurable per org via `pillar_templates` |
| Tech stack categories (12 defaults) | Platform default category templates | Acceptable — configurable per org via `tech_category_templates` |

**No client-facing hardcoded values remain in production code paths.**

---

## 13. Known Bugs & Technical Debt

### Resolved from v2.0.0

| Item | Resolution |
|---|---|
| Audit log FK error on startup | System user with reserved UUID created on startup |
| Login page hardcoded version | Reads from `/api/version` |
| Hardcoded copyright in reports (5 instances) | Reads from org branding / platform_settings |
| Sterilization UI hardcoded org names | Reads from platform owner org |
| Auto-finding extraction not wired | Now called during document ingestion |
| No rate limiting | 3-tier rate limiting active |
| No CSRF protection | Double-submit cookie active |
| No structured logging | Pino with JSON and request context |
| No error monitoring | Sentry server + client |
| No automated tests | 15+ Vitest tests |
| No CI/CD | GitHub Actions pipeline |
| No versioned migrations | drizzle-kit generate + migrate |
| `chat_messages` table deprecated | Data migrated, table dropped |
| `/export/pdf` semantic mismatch | `/export/docx` routes added, legacy paths deprecated |
| No password reset | Token-based flow implemented |
| No email delivery | Resend integration with dev fallback |
| Hardcoded session secret fallback | Startup crash if SESSION_SECRET unset |
| Seed route accessible in production | Guarded with NODE_ENV check |

### Remaining Technical Debt

- `server/storage.ts` is monolithic — all storage methods in one class. Candidate for domain-based split.
- `server/report-export.ts` is ~1740 lines — candidate for decomposition into section generators.
- Some shadcn/ui components installed but unused.
- No request validation middleware — validation is inline per route handler. Candidate for Zod middleware.
- Finding cross-references (`finding-matcher.ts`) has limited active usage.
- Portfolio analytics limited to basic KPIs — candidate for expansion.
- No API key authentication for enterprise plan.
- No MFA / 2FA.
- No OAuth / SSO.
- No account lockout (rate limiting provides partial coverage).

### Remaining Feature Gaps

| Feature | Priority | Effort | Notes |
|---|---|---|---|
| SSO/SAML/OIDC | P2 | High | Enterprise requirement |
| MFA / 2FA | P2 | Medium | Security enhancement |
| API key authentication | P2 | Medium | Enterprise plan feature |
| Account lockout | P3 | Low | Rate limiting provides partial coverage |
| Document re-processing UI | P3 | Low | Re-extract text from previously processed documents |
| Portfolio analytics expansion | P3 | Medium | Beyond basic KPIs |
| Split storage.ts by domain | P3 | High | Code quality |
| Split report-export.ts | P3 | Medium | Code quality |
| Zod validation middleware | P3 | Medium | Code quality |

---

## 14. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Express session signing key — **no fallback, startup crash if absent** |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API — all AI providers (Claude, GPT-4o, Gemini, embeddings) |
| `RESEND_API_KEY` | No | Resend email delivery (dev logs if absent) |
| `SENTRY_DSN` | No | Sentry error monitoring — server-side (disabled if absent) |
| `VITE_SENTRY_DSN` | No | Sentry error monitoring — client-side (disabled if absent) |
| `EMAIL_FROM` | No | Sender address for emails (default: `noreply@meridian.cavaridge.com`) |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | development / production |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Auto | Replit Object Storage public paths |
| `PRIVATE_OBJECT_DIR` | Auto | Replit Object Storage private directory |

### Deprecated Variables (Log Warning If Present)

| Variable | Replacement |
|---|---|
| `ANTHROPIC_API_KEY` | `OPENROUTER_API_KEY` |
| `OPENAI_API_KEY` | `OPENROUTER_API_KEY` |
| `GEMINI_API_KEY` | `OPENROUTER_API_KEY` |
| `GOOGLE_API_KEY` | `OPENROUTER_API_KEY` |

---

## 15. Deployment Status

| Field | Value |
|---|---|
| Platform | Replit |
| Deployment target | Autoscale |
| Platform version | 3.0.0 |
| Port | 5000 internal → 80 external |
| CI/CD | GitHub Actions — PR validation (typecheck, lint, test, build) |
| Error monitoring | Sentry (when DSN configured) |
| Secrets management | Replit Secrets (dev), Doppler (staging/production) |
| Migrations | Versioned Drizzle migrations, auto-run on startup |

**Build process:**
1. `npm run build` → executes `tsx script/build.ts`
2. Backend bundled via esbuild → `dist/index.cjs`
3. Frontend built via Vite → `dist/public/`
4. Production start: `node ./dist/index.cjs`

**Startup sequence:**
1. Run Drizzle migrations
2. Ensure system user exists
3. Initialize Sentry (if DSN configured)
4. Mount middleware stack (logger, session, passport, CSRF, rate limiting)
5. Mount route modules
6. Begin listening

**Lock-in note:** File storage uses Replit Object Storage exclusively. Migration to S3 or Azure Blob requires replacing the ObjectStorageService layer. No Dockerfile or containerization exists.

---

## 16. Testing

### Test Framework

Vitest + supertest. Configuration in `vitest.config.ts`.

### Test Suite

| File | Tests | Coverage |
|---|---|---|
| `tests/auth.test.ts` | 3 | Register, login, bad login |
| `tests/deals.test.ts` | 3 | Create deal, list scoped to org, cross-org blocked |
| `tests/documents.test.ts` | 2 | Upload document, list documents |
| `tests/rbac.test.ts` | 4 | Viewer blocked from create, viewer can read, contributor blocked from delete, org admin can invite |
| `tests/org-isolation.test.ts` | 3 | Cross-org deal access blocked, cross-org doc access blocked, platform admin sees all |

### Running Tests

```bash
npm test          # Single run
npm run test:watch  # Watch mode
```

### CI Integration

Tests run automatically on every PR to `main` and `dev` via GitHub Actions. Merge is blocked on failure.

---

## 17. Shared Components (Extractable to cvg-shared)

| Component | File | Priority |
|---|---|---|
| 7-tier RBAC middleware | server/permissions.ts | P2 — reference implementation for portfolio |
| Org-scoped multitenancy middleware | server/storage.ts | P2 — only full implementation in portfolio |
| ThemeProvider with system preference detection | client/src/lib/theme.tsx | P2 |
| Central LLM config pattern | server/llm.config.ts | P2 — template for all apps |
| Rate limiting middleware | server/middleware/rate-limit.ts | P2 |
| CSRF middleware | server/middleware/csrf.ts | P2 |
| Structured logger (Pino) | server/logger.ts | P2 |
| Email delivery abstraction | server/email.ts | P3 |
| DOCX report generation patterns | server/report-export.ts | P3 |
| Vector search pipeline (embeddings + pgvector) | server/embeddings.ts | P3 |
| Audit logging middleware | server/routes/org.ts (audit log routes) | P3 |
| Per-org branding system | server/report-branding.ts | P3 |
| Document ingestion pipeline | server/ingestion.ts | P3 — needed by CVG-APOGEE |
| Plan limit enforcement | server/plan-limits.ts | P3 |
| React error boundary | client/src/components/ErrorBoundary.tsx | P3 |
| Password reset flow | server/routes/auth.ts | P3 |

---

## 18. Remaining Remediation Priorities

| Priority | Task | Effort |
|---|---|---|
| P2 | Add SSO/SAML/OIDC support | High |
| P2 | Add MFA / 2FA | Medium |
| P2 | Implement API key authentication (enterprise plan) | Medium |
| P3 | Split storage.ts into domain services | High |
| P3 | Split report-export.ts into section generators | Medium |
| P3 | Add Zod validation middleware for routes | Medium |
| P3 | Expand portfolio analytics beyond basic KPIs | Medium |
| P3 | Extract multitenancy + RBAC + logging to cvg-shared | High |
| P3 | Add account lockout after failed login attempts | Low |
| P3 | Add document re-processing UI | Low |

---

## 19. DIT Tenant Boundary

Unchanged from v2.0.0:
- DIT is a tenant within Meridian — never a co-owner
- No DIT names, logos, or references in source code
- All client customizations go in the organization branding and config record
- DIT test data stays within the DIT organization namespace only

---

## 20. Runbook Maintenance

Regenerate on any Major or Minor version increment, new module addition, or architecture change.

**Claude Project Runbook Prompt:**
> "Generate a project state summary in markdown covering: (1) Project name and purpose, (2) Legal entity owner, (3) Tech stack and key dependencies, (4) Core features built or in progress, (5) Shared utilities or components that could apply to other apps, (6) Hardcoded values or assumptions that need to be made configurable, (7) Current RBAC and multitenancy status, (8) UI/UX standards in use (theming, component library, etc.), (9) Known gaps or technical debt, (10) Any Dedicated IT or client-specific references that need to be abstracted out."

**Replit Runbook Prompt:**
> "Generate a technical state summary in markdown covering: (1) Project name and primary purpose, (2) Current tech stack — framework, language, runtime, key libraries and versions, (3) Folder and file structure — full tree with a one-line description of each key file or folder, (4) Environment variables currently in use — names only no values, (5) Authentication and authorization implementation — what exists what is missing, (6) Multitenancy status — implemented partial or absent, (7) UI theming — light/dark/system mode status, (8) Database schema or data model summary, (9) API endpoints or routes currently defined, (10) Third-party integrations — APIs SDKs services connected, (11) Hardcoded values that should be configurable — flag anything client-specific, (12) Known bugs incomplete features or technical debt, (13) What is production-ready vs. prototype/draft, (14) Deployment status — where hosted what is the deployment process."

---

*This document is governed by CVG-CORE. Any deviation requires explicit approval documented in the CVG-CORE project before implementation.*
*CVG-MERIDIAN-RB-v3.0.0-20260305 — Cavaridge, LLC — Internal Confidential*
