# CVG-MERIDIAN — Meridian Application Runbook
**Document:** CVG-MERIDIAN-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-MERIDIAN |
| **App Name** | Meridian |
| **Purpose** | M&A IT Intelligence Platform for private equity firms and investment committees — deal pipeline, risk assessment, AI document analysis, infrastructure intelligence, integration playbooks, Monte Carlo simulation, portfolio analytics, and IC-grade PDF reports |
| **IP Owner** | Cavaridge, LLC |
| **Status** | In Development — most mature app in the portfolio |
| **Repo** | `cavaridge/cvg-meridian` (Private) |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.x |
| Language | TypeScript | 5.6.3 |
| Frontend | React | 18.3.1 |
| Build | Vite | 7.3.0 |
| CSS | Tailwind CSS | 3.4.17 |
| UI Components | shadcn/ui (Radix) | Various |
| Routing (client) | Wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.60.5 |
| Backend | Express.js | 5.0.1 |
| Database | PostgreSQL 16 + pgvector | 1536 dimensions |
| ORM | Drizzle ORM | 0.39.3 |
| Session Store | connect-pg-simple | 10.0.0 |
| File Storage | Replit Object Storage | GCS-backed |
| PDF Generation | PDFKit | 0.17.2 |
| Excel Generation | ExcelJS | 4.4.0 |
| AI (Primary) | Anthropic Claude | claude-sonnet-4-20250514 |
| AI (Embeddings) | OpenAI | text-embedding-3-small |
| AI (Vision Fallback) | Google Gemini | gemini-2.0-flash |
| Image Processing | Sharp | 0.34.5 |
| Password Hashing | bcryptjs | 3.0.3 |
| Validation | Zod | 3.24.2 |
| Charts | Recharts | 2.15.2 |
| Animations | Framer Motion | 11.13.1 |

---

## 3. Cavaridge Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Multitenancy | ✅ Compliant | Org-scoped data isolation, `organizationId` on all tables, query scoping enforced |
| RBAC | ✅ Compliant | 7-tier role hierarchy, 21+ permissions, deal-level access control |
| Light/Dark/System theme | ✅ Compliant | ThemeProvider with localStorage persistence, system mode via `prefers-color-scheme` |
| No hardcoded client data | ⚠️ Partial | 6 assessment pillars, 12 tech stack categories, scoring algorithms hardcoded |
| IP hygiene | ✅ Compliant | No DIT references in codebase |
| OpenRouter via Cavaridge key | ❌ Absent | Uses direct Anthropic, OpenAI, and Google API keys — not routed through OpenRouter |
| No plaintext secrets | ⚠️ Partial | Hardcoded fallback session secret when `SESSION_SECRET` not set |
| llm.config.js routing | ❌ Absent | Model selection scattered across route files |
| Rate limiting | ❌ Absent | No rate limiting on API endpoints |
| CSRF protection | ❌ Absent | Relies on sameSite cookies only |
| Automated tests | ❌ Absent | Zero tests |

---

## 4. Database Schema

**PostgreSQL 16 + pgvector. 24 tables across 4 domains:**

**Core:** organizations, users, deals, deal_access, invitations, account_requests
**Analysis:** pillars, findings, documents, document_chunks (vector 1536), document_classifications
**Infrastructure:** tech_stack_items, topology_nodes, topology_connections, baseline_profiles, baseline_comparisons
**Planning & AI:** playbook_phases, playbook_tasks, qa_conversations, qa_messages, qa_saved_answers
**System:** audit_log, score_snapshots, organization_branding, platform_settings

---

## 5. Authentication & Authorization

**Implemented:**
- Session-based auth via `express-session` + PostgreSQL session store
- Password hashing with bcryptjs (10 salt rounds)
- 7-tier role hierarchy: `platform_owner` > `platform_admin` > `org_owner` > `org_admin` > `analyst` > `contributor` > `viewer`
- 24 granular permissions mapped per role
- Deal-level access control via `deal_access` table (lead, contributor, reviewer, observer)
- Platform admin org-switching (impersonation)
- Token-based invitation flow with role assignment

**Missing:**
- No email delivery — invitations must be shared manually
- No password reset flow
- No MFA/2FA
- No login rate limiting / brute-force protection
- No CSRF tokens
- No OAuth/SSO (no Google/Microsoft/SAML)
- Hardcoded fallback session secret

---

## 6. Core Features — Built

- Deal pipeline management with lifecycle stages
- 6-pillar risk assessment with weighted scoring
- AI-powered document analysis (extraction, classification, chunking, vector search)
- Multi-provider AI vision pipeline (Claude → Gemini → OpenAI fallback)
- Infrastructure intelligence — tech stack extraction, topology visualization
- Baseline comparison profiles per organization
- Integration playbook builder with phases, tasks, and critical path
- Monte Carlo financial simulation
- RAG-powered Q&A ("Ask Meridian") with citation support
- IC-grade PDF report generation (PDFKit)
- Excel export (ExcelJS)
- Per-org branding (logo, colors, footer text)
- Audit logging
- Score snapshots over time

---

## 7. Known Gaps & Technical Debt

- **Replit lock-in:** File storage uses Replit Object Storage exclusively. Migration to S3/Azure Blob would require replacing the ObjectStorageService layer.
- **No containerization:** No Dockerfile or docker-compose.
- **No CI/CD:** No automated testing, linting gates, or deployment automation beyond Replit workflows.
- **Schema management:** Uses `drizzle push` with no versioned migrations — no rollback path.
- **Single-model AI dependency:** Core logic depends on Claude claude-sonnet-4-20250514 with no model failover for non-vision tasks.
- **No AI cost tracking:** API calls not metered at deal or org level.
- **100+ API routes:** Large surface area needing rate limiting and CSRF protection.
- **No API key auth:** Enterprise plan advertises "API Access" but no implementation exists.
- **Typography:** DM Sans (UI), JetBrains Mono (data) — aligns with Cavaridge design system.

---

## 8. Shared Components (Extractable to cvg-shared)

- 7-tier RBAC middleware with permission checking — reference implementation for portfolio
- Organization-scoped multitenancy middleware — the only full implementation in the portfolio
- ThemeProvider with system preference detection
- PDFKit report generation patterns
- Vector search pipeline (embeddings + pgvector)
- Audit logging middleware
- Per-org branding system

---

## 9. Remediation Priorities

| Priority | Task | Effort |
|---|---|---|
| P1 | Route all AI calls through OpenRouter, create llm.config.js | Medium |
| P1 | Remove hardcoded session secret fallback | Low |
| P1 | Add rate limiting to all API endpoints | Medium |
| P1 | Add CSRF protection | Medium |
| P2 | Make assessment pillars, tech stack categories configurable per org | High |
| P2 | Implement versioned Drizzle migrations | Medium |
| P2 | Add SSO/SAML/OIDC support | High |
| P3 | Add automated tests for critical paths | High |
| P3 | Set up GitHub Actions CI/CD | Medium |
| P3 | Add error monitoring (Sentry or equivalent) | Medium |
| P3 | Extract multitenancy + RBAC middleware to cvg-shared | High |

---

## 10. DIT Tenant Boundary

- DIT is a tenant within Meridian — never a co-owner
- No DIT names, logos, or references in source code
- All client customizations go in the organization branding/config record
- DIT test data stays within the DIT organization namespace only

---

## 11. Runbook Maintenance

**Regenerate this runbook on:** any Major or Minor version increment, new module addition, or architecture change.

**Claude Project Runbook Prompt:**
> "Generate a project state summary in markdown covering: (1) Project name and purpose, (2) Legal entity owner, (3) Tech stack and key dependencies, (4) Core features built or in progress, (5) Shared utilities or components that could apply to other apps, (6) Hardcoded values or assumptions that need to be made configurable, (7) Current RBAC and multitenancy status, (8) UI/UX standards in use (theming, component library, etc.), (9) Known gaps or technical debt, (10) Any Dedicated IT or client-specific references that need to be abstracted out."

**Replit Runbook Prompt:**
> "Generate a technical state summary in markdown covering: (1) Project name and primary purpose, (2) Current tech stack — framework, language, runtime, key libraries and versions, (3) Folder and file structure — full tree with a one-line description of each key file or folder, (4) Environment variables currently in use — names only no values, (5) Authentication and authorization implementation — what exists what is missing, (6) Multitenancy status — implemented partial or absent, (7) UI theming — light/dark/system mode status, (8) Database schema or data model summary, (9) API endpoints or routes currently defined, (10) Third-party integrations — APIs SDKs services connected, (11) Hardcoded values that should be configurable — flag anything client-specific, (12) Known bugs incomplete features or technical debt, (13) What is production-ready vs. prototype/draft, (14) Deployment status — where hosted what is the deployment process."

---

*This document is governed by CVG-CORE. Any deviation requires explicit approval documented in the CVG-CORE project before implementation.*
*Classification: Cavaridge LLC — Internal Confidential*
