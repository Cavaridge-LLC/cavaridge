# MERIDIAN — Technical State Summary

**Generated:** 2026-03-05 | **Platform Version:** 2.5.0+2

---

## 1. Project Name and Primary Purpose

**MERIDIAN** is an M&A IT Intelligence Platform that streamlines the IT due diligence process for mergers and acquisitions. It provides deal pipeline management, AI-powered risk assessment, infrastructure intelligence extraction, integration playbook generation, Monte Carlo cost simulation, portfolio analytics, and IC-grade report generation. It is built as a multi-tenant SaaS application with a 7-tier role-based access control system.

---

## 2. Current Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 20.x (NixOS module) |
| **Language** | TypeScript | 5.6.3 |
| **Frontend Framework** | React | 18.3.1 |
| **Build Tool** | Vite | 7.3.0 |
| **CSS** | Tailwind CSS | 3.4.17 |
| **Backend Framework** | Express | 5.0.1 |
| **ORM** | Drizzle ORM | 0.39.3 |
| **Database** | PostgreSQL | 16 (NixOS module) |
| **Session Store** | connect-pg-simple | 10.0.0 |
| **AI Gateway** | OpenRouter (via OpenAI SDK) | openai 6.22.0 |
| **File Storage** | Replit Object Storage | Integration v2.0.0 |
| **Email** | Resend SDK | 6.9.3 |
| **Error Monitoring** | Sentry | @sentry/node 10.42.0, @sentry/react 10.42.0 |
| **Logging** | Pino | 10.3.1 |
| **Testing** | Vitest | 4.0.18 |
| **UI Components** | shadcn/ui (Radix primitives) | Various |
| **Charts** | Recharts | 2.15.2 |
| **Routing (Client)** | Wouter | 3.3.5 |
| **State/Fetching** | TanStack React Query | 5.60.5 |
| **Document Generation** | docx (OOXML) | 9.6.0 |
| **Spreadsheet** | ExcelJS | 4.4.0 |
| **PDF Extraction** | pdf-parse | 1.1.1 |
| **DOCX Extraction** | mammoth | 1.11.0 |
| **Email Parsing** | mailparser | 3.9.3 |
| **Image Processing** | sharp | 0.34.5 |
| **ZIP Handling** | adm-zip | 0.5.16 |
| **Schema Validation** | Zod + drizzle-zod | 3.24.2 / 0.7.0 |
| **Animation** | Framer Motion | 11.13.1 |

---

## 3. Folder and File Structure

```
/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI — PR checks (tsc, build)
├── attached_assets/                  # User-uploaded reference docs and screenshots (not runtime)
├── client/
│   └── src/
│       ├── main.tsx                  # React entry point, Sentry client init
│       ├── App.tsx                   # Root component, routes, error boundaries
│       ├── components/
│       │   ├── ui/                   # shadcn/ui primitives (button, dialog, input, etc.)
│       │   ├── Sidebar.tsx           # Main navigation sidebar with version display
│       │   ├── ErrorBoundary.tsx     # Fatal crash boundary (Sentry-reporting)
│       │   ├── PageErrorBoundary.tsx # Per-page error boundary (Sentry-reporting)
│       │   ├── ThemeProvider.tsx     # Light/dark/system theme context
│       │   └── ...                   # Feature-specific components
│       ├── hooks/
│       │   ├── use-auth.tsx          # Auth context and session management
│       │   ├── use-toast.ts          # Toast notification hook
│       │   └── use-mobile.tsx        # Mobile breakpoint detection
│       ├── lib/
│       │   ├── queryClient.ts        # TanStack Query client, apiRequest helper
│       │   └── scoring.ts            # Client-side score formatting utilities
│       ├── pages/
│       │   ├── login.tsx             # Login, registration, forgot password
│       │   ├── request-access.tsx    # Account request form (public)
│       │   ├── invite.tsx            # Invitation acceptance page
│       │   ├── pipeline.tsx          # Deal pipeline dashboard (default view)
│       │   ├── risk.tsx              # Risk assessment with pillar breakdown
│       │   ├── ask-ai.tsx            # RAG-powered AI chat (Ask MERIDIAN)
│       │   ├── infra.tsx             # Infrastructure intelligence view
│       │   ├── playbook.tsx          # Integration playbook timeline
│       │   ├── simulator.tsx         # Digital twin Monte Carlo simulator
│       │   ├── portfolio.tsx         # Cross-deal portfolio analytics
│       │   ├── reports.tsx           # Report generation (DOCX, Excel, CSV)
│       │   ├── settings.tsx          # Org settings, members, branding, profiles
│       │   ├── platform-admin.tsx    # Platform-level admin panel
│       │   └── not-found.tsx         # 404 page
│       └── index.css                 # Global CSS, theme variables, Tailwind directives
├── drizzle/
│   ├── migrations/                   # Drizzle migration files (baseline snapshot)
│   └── meta/                         # Drizzle migration metadata
├── scripts/
│   └── sterilize-production.ts       # Production data sterilization utility
├── script/
│   └── build.ts                      # Production build script (esbuild + Vite)
├── server/
│   ├── index.ts                      # Server entry — Sentry init, middleware, startup
│   ├── db.ts                         # Database connection pool, migration runner
│   ├── auth.ts                       # Passport/session configuration
│   ├── seed.ts                       # Database seeding (demo org, users, pillar/category defaults)
│   ├── storage.ts                    # IStorage interface + DatabaseStorage implementation
│   ├── email.ts                      # Email service (Resend SDK with console fallback)
│   ├── logger.ts                     # Pino logger configuration
│   ├── vite.ts                       # Vite dev server integration
│   ├── static.ts                     # Static file serving (production)
│   ├── plan-limits.ts                # Plan-based usage limit enforcement
│   ├── openrouter.ts                 # OpenRouter API client (unified AI gateway)
│   ├── llm-config.ts                 # Centralized LLM model routing configuration
│   ├── qa-engine.ts                  # RAG engine — retrieval, reranking, answer generation
│   ├── report-ai.ts                  # AI-powered report narrative generation
│   ├── report-export.ts              # DOCX report builder (full + executive)
│   ├── report-branding.ts            # Organization branding for reports
│   ├── infra-extraction.ts           # AI-powered infrastructure data extraction
│   ├── document-classifier.ts        # AI-powered document classification
│   ├── embeddings.ts                 # OpenAI text-embedding-3-small via OpenRouter
│   ├── vision.ts                     # AI vision analysis for images
│   ├── ingestion.ts                  # Document ingestion pipeline orchestrator
│   ├── processing-pipeline.ts        # Multi-step document processing queue
│   ├── preview.ts                    # Document preview generation
│   ├── middleware/
│   │   └── csrf.ts                   # CSRF token validation middleware
│   ├── routes/
│   │   ├── index.ts                  # Route orchestrator — imports and registers all modules
│   │   ├── _helpers.ts               # Shared middleware, constants, scoring functions
│   │   ├── auth.ts                   # /api/auth/*, invitations, password reset
│   │   ├── deals.ts                  # /api/deals/* CRUD, pillars, findings, scores
│   │   ├── documents.ts              # /api/documents/*, upload, classify, embed, search
│   │   ├── reports.ts                # /api/deals/:id/export/* (DOCX, CSV, Excel, SSE)
│   │   ├── platform.ts              # /api/platform/*, sterilize, account-requests
│   │   ├── qa.ts                     # /api/deals/:dealId/qa/* (Ask MERIDIAN)
│   │   ├── portfolio.ts              # /api/portfolio/* (cross-deal analytics)
│   │   ├── org.ts                    # /api/org/* (settings, members, branding, templates)
│   │   ├── system.ts                 # /api/version, /api/system-status, /api/ai/status
│   │   ├── infra.ts                  # Tech stack, topology, baseline, playbook, simulator
│   │   └── deal-access.ts            # /api/deals/:id/access (per-deal user access)
│   └── replit_integrations/
│       └── object_storage/           # Replit Object Storage SDK integration
│           ├── index.ts
│           ├── objectStorage.ts
│           ├── objectAcl.ts
│           └── routes.ts
├── shared/
│   └── schema.ts                     # Drizzle ORM schema (30+ tables), Zod schemas, types
├── tests/
│   ├── helpers.ts                    # Test utilities, mock storage, auth helpers
│   ├── auth.test.ts                  # Authentication tests (8 tests)
│   ├── deals.test.ts                 # Deal CRUD tests (7 tests)
│   ├── documents.test.ts             # Document tests (3 tests)
│   ├── rbac.test.ts                  # Role-based access control tests (5 tests)
│   └── org-isolation.test.ts         # Multi-tenant isolation tests (5 tests)
├── drizzle.config.ts                 # Drizzle Kit configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
├── vite.config.ts                    # Vite build configuration
├── vitest.config.ts                  # Vitest test configuration
├── package.json                      # Dependencies and scripts
├── version.json                      # Semantic version (2.5.0+2)
├── replit.md                         # Agent memory / project summary
├── RUNBOOK.md                        # Operations runbook (~1460 lines)
└── TECHNICAL_STATE_SUMMARY.md        # This file
```

---

## 4. Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Express session signing key (throws if absent) |
| `OPENROUTER_API_KEY` | Yes (for AI features) | Unified API key for all LLM/embedding/vision calls |
| `RESEND_API_KEY` | No | Email delivery (falls back to console logging) |
| `SENTRY_DSN` | No | Server-side error monitoring |
| `VITE_SENTRY_DSN` | No | Client-side error monitoring |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | Environment mode (development/production/test) |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Auto | Set by Replit Object Storage integration |
| `PRIVATE_OBJECT_DIR` | Auto | Set by Replit Object Storage integration |
| `REPL_ID` | Auto | Set by Replit environment |

---

## 5. Authentication and Authorization

### What Exists
- **Session-based authentication** using `express-session` with PostgreSQL session store (`connect-pg-simple`)
- **Password hashing** with bcryptjs
- **7-tier role hierarchy**: `platform_owner` > `platform_admin` > `org_owner` > `org_admin` > `manager` > `analyst` > `viewer`
- **Permission-based middleware** (`requireAuth`, `requirePerm`, `requirePlatform`) checking role against action
- **Multi-tenancy enforcement**: All queries scoped by `organizationId` from session
- **User invitation system**: Token-based invitations with expiry, email delivery
- **Password reset flow**: Token-based (1-hour expiry), one active token per user, email delivery
- **Account request system**: Public request form, admin approval/rejection workflow
- **CSRF protection**: Cookie-based XSRF-TOKEN with header validation on state-changing requests
- **Rate limiting**: 3-tier (global 100/min, auth 5/min, AI 20/min)
- **Deal-level access control**: Per-deal user access grants with access levels

### What Is Missing
- No OAuth/SSO integration (Google, Microsoft, SAML)
- No MFA/2FA support
- No session invalidation on password change (sessions persist until expiry)
- No account lockout after failed login attempts (rate limiting only)
- No API key authentication for programmatic access
- No IP allowlisting

---

## 6. Multitenancy Status

**Fully Implemented.**

- Every database query is scoped by `organizationId` (from `req.orgId` set by `requireAuth` middleware)
- Users belong to exactly one organization
- Platform users (`platform_owner`, `platform_admin`) can switch between organizations
- Data isolation covers: deals, documents, findings, pillars, tech stack, topology, playbooks, Q&A conversations, audit logs, usage tracking, baseline profiles, pillar templates, tech categories
- Org-level configuration: branding, settings, plan tier, usage limits, pillar templates, tech categories
- Sterilization system for clearing demo/test data per-org
- 5 unit tests specifically validate cross-org isolation

---

## 7. UI Theming

**Light, Dark, and System modes — fully implemented.**

- `ThemeProvider` component manages theme state with `localStorage` persistence
- CSS variables defined in `:root` (light) and `.dark` (dark) classes in `index.css`
- Color palette: blue (primary), green (success), amber (warning), red (danger), purple (accent), cyan (info)
- Typography: DM Sans (UI text), JetBrains Mono (data/code)
- Theme toggle in sidebar footer
- All components use CSS variables (e.g., `var(--bg-primary)`, `var(--text-secondary)`) for automatic theme adaptation

---

## 8. Database Schema Summary

**30+ tables** defined in `shared/schema.ts` using Drizzle ORM. All IDs are `varchar(36)` UUIDs.

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `organizations` | Tenant accounts with plan tiers and limits | Root entity |
| `users` | User accounts with roles and org membership | → organizations |
| `deals` | M&A deal records with scores and lifecycle stage | → organizations |
| `deal_access` | Per-deal user access grants | → deals, users |
| `pillars` | Risk assessment pillars per deal (6 per deal) | → deals |
| `findings` | Risk findings with severity and remediation | → deals, pillars |
| `finding_cross_references` | Similar finding linkages | → findings |
| `documents` | Uploaded files with extraction metadata | → deals, users |
| `document_chunks` | Text chunks for vector search | → documents, deals |
| `document_classifications` | AI classification results per document | → documents, deals |
| `tech_stack_items` | Detected technology components | → deals |
| `baseline_comparisons` | Acquirer baseline alignment gaps | → deals |
| `topology_nodes` | Network topology nodes | → deals |
| `topology_connections` | Network topology edges | → deals |
| `playbook_phases` | Integration playbook phases | → deals |
| `playbook_tasks` | Tasks within playbook phases | → playbook_phases |
| `qa_conversations` | AI chat conversation threads | → deals |
| `qa_messages` | Messages within conversations | → qa_conversations |
| `qa_saved_answers` | Bookmarked Q&A answers | → deals |
| `score_snapshots` | Historical score recordings | → deals |
| `processing_queue` | Document processing pipeline queue | → deals, documents |
| `usage_tracking` | Plan usage metering per org | → organizations |
| `invitations` | User invitation tokens | → organizations, users |
| `audit_log` | Action audit trail | → organizations, users |
| `baseline_profiles` | Acquirer technology baselines | → organizations |
| `pillar_templates` | Configurable pillar definitions (org or platform) | → organizations (nullable) |
| `tech_categories` | Configurable tech categories (org or platform) | → organizations (nullable) |
| `platform_settings` | Global platform configuration | → users |
| `account_requests` | Public account request submissions | → organizations, users |
| `organization_branding` | Report branding per org | Unique on tenantId |
| `password_reset_tokens` | Password reset token storage | → users |

**Vector support**: `pgvector` extension enabled; `document_chunks` has an `embedding` vector column for semantic search.

---

## 9. API Endpoints

### Auth & Invitations (10 routes)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | Session logout |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/invitations` | Create invitation |
| POST | `/api/invitations/accept` | Accept invitation |
| GET | `/api/invitations/lookup/:token` | Lookup invitation by token |
| GET | `/api/invitations` | List org invitations |
| POST | `/api/auth/request-password-reset` | Request password reset token |
| POST | `/api/auth/reset-password` | Reset password with token |

### Deals (11 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/deals` | List deals (org-scoped) |
| GET | `/api/deals/:id` | Get deal detail |
| POST | `/api/deals` | Create deal |
| PATCH | `/api/deals/:id` | Update deal |
| POST | `/api/deals/:id/findings` | Add finding |
| GET | `/api/deals/:id/findings` | List findings |
| GET | `/api/deals/:id/pillars` | List pillars |
| POST | `/api/deals/:id/recalculate-scores` | Recalculate deal scores |
| POST | `/api/admin/recalculate-all-scores` | Recalculate all deals |
| POST | `/api/deals/:id/match-findings` | Match similar findings |
| GET | `/api/deals/:id/finding-cross-refs` | Get finding cross-references |

### Documents (22 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/deals/:id/documents` | List deal documents |
| POST | `/api/deals/:id/documents` | Upload document(s) |
| GET | `/api/deals/:id/document-stats` | Document statistics |
| GET | `/api/deals/:id/queue-status` | Processing queue status |
| POST | `/api/deals/:id/retry-failed` | Retry failed documents |
| POST | `/api/documents/:docId/retry` | Retry single document |
| GET | `/api/deals/:id/classifications` | Document classifications |
| GET | `/api/deals/:id/evidence-coverage` | Evidence coverage analysis |
| POST | `/api/deals/:dealId/documents/:docId/reclassify` | Reclassify document |
| PATCH | `/api/deals/:dealId/documents/:docId/classification` | Update classification |
| POST | `/api/documents/reprocess` | Reprocess documents |
| GET | `/api/documents/:id/impact` | Deletion impact analysis |
| GET | `/api/documents/:id/preview` | Document preview |
| GET | `/api/documents/:id/metadata` | Document metadata |
| DELETE | `/api/documents/:id` | Delete document (cascade) |
| DELETE | `/api/documents/batch` | Batch delete documents |
| GET | `/api/documents/analyze-images/status` | Image analysis status |
| POST | `/api/documents/analyze-images` | Batch image analysis |
| POST | `/api/documents/:docId/analyze-image` | Single image analysis |
| POST | `/api/documents/embed` | Generate embeddings |
| GET | `/api/documents/embed-progress/:dealId` | Embedding progress |
| POST | `/api/documents/search` | Semantic/full-text search |

### Infrastructure & AI (10 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/deals/:id/tech-stack` | Get tech stack items |
| POST | `/api/deals/:id/tech-stack` | Add tech stack item |
| POST | `/api/deals/:id/extract-tech-stack` | AI extract tech stack |
| GET | `/api/deals/:id/baseline-comparisons` | Get baseline gaps |
| POST | `/api/deals/:id/compare-baseline` | AI compare baseline |
| GET | `/api/deals/:id/topology` | Get network topology |
| POST | `/api/deals/:id/extract-topology` | AI extract topology |
| POST | `/api/deals/:id/generate-infra-analysis` | AI generate infra analysis |
| POST | `/api/deals/:id/generate-playbook` | AI generate integration playbook |
| GET | `/api/deals/:id/simulate/monte-carlo` | Monte Carlo cost simulation |

### Reports & Export (10 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/deals/:id/export/docx` | Full DOCX report |
| GET | `/api/deals/:id/export/executive-docx` | Executive summary DOCX |
| GET | `/api/deals/:id/export/pdf` | Legacy alias → DOCX (deprecated) |
| GET | `/api/deals/:id/export/executive-pdf` | Legacy alias → exec DOCX (deprecated) |
| GET | `/api/deals/:id/export/csv` | CSV export |
| POST | `/api/deals/:id/export/excel` | Excel export |
| POST | `/api/deals/:id/export/docx-stream` | SSE-streamed DOCX generation |
| POST | `/api/deals/:id/export/executive-docx-stream` | SSE-streamed exec DOCX |
| POST | `/api/deals/:id/export/pdf-stream` | Legacy alias → DOCX stream (deprecated) |
| GET | `/api/reports/temp/:jobId` | Download temp report file |

### Q&A / Ask MERIDIAN (5 routes)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/deals/:dealId/qa/ask` | Ask question (RAG) |
| GET | `/api/deals/:dealId/qa/conversations` | List conversations |
| GET | `/api/deals/:dealId/qa/conversations/:convId` | Get conversation |
| POST | `/api/deals/:dealId/qa/save-answer` | Save answer |
| DELETE | `/api/deals/:dealId/qa/conversations/:convId` | Delete conversation |

### Organization (24 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/org/members` | List org members |
| GET | `/api/org/audit-log` | Audit log |
| GET | `/api/org/info` | Org info |
| PATCH | `/api/org/settings` | Update org settings |
| GET/PUT | `/api/settings/branding` | Get/update report branding |
| POST | `/api/settings/branding/logo` | Upload branding logo |
| GET/POST/PUT/DELETE | `/api/org/baseline-profiles[/:id]` | Baseline profile CRUD |
| PATCH | `/api/org/members/:userId/role` | Change member role |
| PATCH | `/api/org/members/:userId/status` | Change member status |
| DELETE | `/api/org/members/:userId` | Remove member |
| POST | `/api/org/transfer-ownership` | Transfer org ownership |
| PUT | `/api/org/members/:userId/deal-access` | Set member deal access |
| GET/POST/PUT/DELETE | `/api/org/pillar-templates[/:id]` | Pillar template CRUD |
| GET/POST/PUT/DELETE | `/api/org/tech-categories[/:id]` | Tech category CRUD |

### Platform Admin (12 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/platform/organizations` | List all orgs |
| PATCH | `/api/platform/organizations/:orgId` | Update org |
| POST | `/api/platform/organizations` | Create org |
| DELETE | `/api/platform/organizations/:orgId` | Delete org |
| POST | `/api/platform/switch-org` | Switch active org |
| GET/PUT | `/api/platform/settings` | Platform settings |
| GET/PATCH | `/api/platform/account-requests[/:id]` | Account request management |
| GET | `/api/platform/stats` | Platform statistics |
| GET | `/api/platform/users` | All platform users |
| GET/POST | `/api/platform/sterilize[/preview]` | Data sterilization |
| POST | `/api/account-requests` | Public account request (no auth) |

### Portfolio (3 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/portfolio/risk-trend` | Risk score trend data |
| GET | `/api/portfolio/pillar-matrix` | Cross-deal pillar matrix |
| GET | `/api/portfolio/finding-trends` | Finding trend analytics |

### System (5 routes)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/version` | Version info |
| GET | `/api/system-status` | System health status |
| GET | `/api/pipeline-stats` | Document pipeline stats |
| GET | `/api/findings` | Global findings list |
| GET | `/api/ai/status` | AI service status |

### Object Storage (2 routes)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/uploads/request-url` | Request signed upload URL |
| GET | `/objects/*` | Serve stored objects |

**Total: ~114 API endpoints**

---

## 10. Third-Party Integrations

| Service | SDK/Library | Purpose | Required |
|---------|------------|---------|----------|
| **OpenRouter** | openai SDK (custom baseURL) | Unified AI gateway — LLM (Claude Sonnet 4), embeddings (text-embedding-3-small), vision (GPT-4o) | Yes (for AI features) |
| **Replit Object Storage** | javascript_object_storage v2.0.0 | File upload/download, document storage | Yes |
| **Replit PostgreSQL** | pg + drizzle-orm | Primary database | Yes |
| **Resend** | resend SDK | Transactional email (invitations, password resets, account notifications) | No (console fallback) |
| **Sentry** | @sentry/node + @sentry/react | Error monitoring and crash reporting | No (graceful skip) |
| **pgvector** | PostgreSQL extension | Vector similarity search for RAG | Yes (for semantic search) |

---

## 11. Hardcoded Values That Should Be Configurable

| Value | Location | Issue |
|-------|----------|-------|
| `"MERIDIAN <noreply@meridian.dev>"` | `server/email.ts` | Email from address — client-specific |
| `"#2563eb"` | `server/email.ts` | Email brand color — should read from org branding |
| `"MERIDIAN"` / `"M&A IT Due Diligence Platform"` | `server/email.ts` | Platform name in email templates — client-specific |
| `"meridian123"` | `server/email.ts` | Temporary password in account approval email — security risk |
| `"https://meridian.cavaridge.com"` | `server/openrouter.ts` | HTTP-Referer header for OpenRouter — client-specific |
| `anthropic/claude-sonnet-4-20250514` | `server/llm-config.ts` | Primary LLM model ID — should be env-configurable |
| `openai/text-embedding-3-small` | `server/llm-config.ts` | Embedding model ID — should be env-configurable |
| `openai/gpt-4o` | `server/llm-config.ts` | Vision model ID — should be env-configurable |
| `"#1a56db"` / `"#6b7280"` / `"#059669"` | `shared/schema.ts` | Default branding colors — cosmetic, low priority |
| Scoring thresholds (4.0, 3.0, etc.) | `client/src/lib/scoring.ts` | Risk score thresholds — could be org-configurable |
| Rate limit values (100, 5, 20/min) | `server/routes/_helpers.ts` | Rate limits — could be env-configurable |

---

## 12. Known Bugs, Incomplete Features, and Technical Debt

### Incomplete Features
- **Email delivery**: Works but email templates have hardcoded platform branding (not org-aware)
- **Account approval email**: Contains hardcoded temporary password `"meridian123"` — should generate random password or force reset
- **TBD placeholders**: `server/report-export.ts` defaults `estimated_cost` to `"TBD"`; `server/infra-extraction.ts` defaults `timeRange` to `"TBD"` when AI response is incomplete
- **PDF export routes**: Still mapped but serve DOCX with Deprecation headers — should eventually be removed
- **Playbook UI**: Defaults phase end dates to `"TBD"` if data is missing

### Technical Debt
- **Schema transition guard**: `server/processing-pipeline.ts` has a try-catch for missing `embedding` column — indicates schema transition debt
- **Tailwind v3.4 limitation**: Sidebar rail feature limited by missing `in-` selector support (noted in code comment)
- **Toast side-effects**: Toast dismissal logic has acknowledged side-effect pattern
- **No ESLint configuration**: No lint script or config file exists
- **Legacy PDF route aliases**: 4 deprecated routes still active
- **Seed data in production**: Extensive seed file with demo org/users; sterilization script exists but is manual
- **attached_assets directory**: Contains ~30+ development prompt files and reference images — not runtime code, should be cleaned

### Potential Issues
- **AI response parsing**: Vision module throws if no JSON found in AI response — could fail on malformed model output
- **No session invalidation on password change**: Sessions persist after password reset until natural expiry
- **Object Storage routes**: Integration-provided routes are described as "examples" — may need hardening

---

## 13. Production-Ready vs. Prototype/Draft

### Production-Ready
- Authentication and authorization (session, RBAC, CSRF, rate limiting)
- Multi-tenancy with full data isolation
- Deal pipeline CRUD and lifecycle management
- Document ingestion pipeline (upload, extraction, classification, chunking, dedup)
- Risk assessment scoring with evidence confidence weighting
- Database schema and migrations
- Structured logging (Pino)
- Error monitoring (Sentry, optional)
- Unit testing (28 tests, CI pipeline)
- DOCX report generation (full and executive)
- Excel/CSV export
- Organization settings and branding
- User invitation and password reset flows
- Configurable pillar templates and tech categories

### Functional but Dependent on AI (requires OPENROUTER_API_KEY)
- Ask MERIDIAN (RAG chat) — fully built, requires AI for answers
- Infrastructure extraction (tech stack, topology) — requires AI
- Integration playbook generation — requires AI
- Document classification — requires AI
- Vision analysis (image-based findings) — requires AI
- Report narrative generation — requires AI

### Prototype / Needs Hardening
- Email templates (hardcoded branding, temporary password issue)
- Monte Carlo simulator (functional but parameters are approximations)
- Portfolio analytics (functional, limited to 3 chart types)
- Object Storage route security (uses integration defaults)
- Account approval workflow (temporary password instead of forced reset)

---

## 14. Deployment Status

### Hosting
- **Platform**: Replit (NixOS container with nodejs-20, web, postgresql-16 modules)
- **Deployment target**: Autoscale (`deploymentTarget = "autoscale"` in `.replit`)

### Deployment Process
1. **Build**: `npm run build` runs `script/build.ts` — esbuild bundles server to `dist/index.cjs`, Vite builds client to `dist/public/`
2. **Run**: `node ./dist/index.cjs` (production entry point)
3. **Static assets**: Served from `dist/public/` (Vite output)
4. **Database**: PostgreSQL 16 on Replit, auto-migrates on startup via Drizzle migrator
5. **File storage**: Replit Object Storage (no external S3 needed)
6. **Port mapping**: Internal 5000 → External 80

### CI/CD
- **GitHub Actions**: `.github/workflows/ci.yml` runs on PRs to `main`/`dev` — TypeScript check + production build
- **No automated deployment pipeline**: Deployment is manual via Replit's publish button
- **No staging environment**: Development and production share the same database (sterilization script available for cleanup)

### Production Configuration Required
| Item | Status |
|------|--------|
| `DATABASE_URL` | Set (Replit-managed) |
| `SESSION_SECRET` | Set (required, throws if missing) |
| `OPENROUTER_API_KEY` | Set (required for AI features) |
| `RESEND_API_KEY` | Optional (email falls back to console) |
| `SENTRY_DSN` | Optional (error monitoring) |
| `VITE_SENTRY_DSN` | Optional (client error monitoring) |
