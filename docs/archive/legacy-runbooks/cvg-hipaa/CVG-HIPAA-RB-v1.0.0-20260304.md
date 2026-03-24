# CVG-HIPAA — HIPAA Risk Assessment Toolkit Runbook
**Document:** CVG-HIPAA-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-HIPAA |
| **App Name** | HIPAA Risk Assessment Toolkit |
| **Purpose** | HIPAA compliance tooling — risk assessment workflows, gap analysis, remediation tracking, and compliance documentation for healthcare organizations and their IT service providers |
| **IP Owner** | Cavaridge, LLC |
| **Status** | Planned |
| **Repo** | `cavaridge/cvg-hipaa` (Private — to be created) |

---

## 2. Tech Stack (Target)

Aligns with Cavaridge portfolio standard stack:

| Layer | Technology | Version Target |
|---|---|---|
| Language | TypeScript | Latest stable |
| Runtime | Node.js | 20.x |
| Frontend | React | 19.x |
| Build | Vite | Latest stable |
| CSS | Tailwind CSS v4 | Latest stable |
| UI Components | shadcn/ui (Radix) | Latest stable |
| Icons | Lucide React | Latest stable |
| Typography | DM Sans (UI) + JetBrains Mono (data) | Google Fonts |
| Routing (client) | Wouter | Latest stable |
| Data Fetching | TanStack React Query | Latest stable |
| Backend | Express.js | 5.x |
| Database | PostgreSQL | 16.x |
| ORM | Drizzle ORM | Latest stable |
| Validation | Zod + drizzle-zod | Latest stable |
| AI | OpenRouter via OpenAI SDK | Via llm.config.js |
| Auth | TBD — Replit Auth for dev, SSO/SAML for production | — |

---

## 3. Cavaridge Standards Compliance (Target — Build from Day One)

| Standard | Target | Notes |
|---|---|---|
| Multitenancy | ✅ Required | `tenant_id` on every table from first migration. Row-level scoping enforced. |
| RBAC | ✅ Required | Minimum: Platform Owner, Platform Admin, Tenant Admin, User, Viewer. Extend for compliance officer, auditor roles. |
| Light/Dark/System theme | ✅ Required | ThemeProvider with `prefers-color-scheme` detection from day one. |
| No hardcoded client data | ✅ Required | All client config in tenant records. No client names, branding, or compliance profiles in code. |
| IP hygiene | ✅ Required | Cavaridge, LLC ownership. LICENSE file. No DIT or client references. |
| OpenRouter via Cavaridge key | ✅ Required | All AI calls through OpenRouter. Model selection in llm.config.js only. |
| No plaintext secrets | ✅ Required | Replit Secrets for dev, Doppler for staging/production. |
| llm.config.js routing | ✅ Required | Scaffolded before any AI feature is built. |
| Rate limiting | ✅ Required | Applied from first route. |
| CSRF protection | ✅ Required | Enabled from day one. |
| Automated tests | ✅ Required | Baseline tests for critical compliance paths before production. |

---

## 4. Planned Features

**Risk Assessment Engine:**
- HIPAA Security Rule risk assessment workflow (45 CFR 164.308(a)(1)(ii)(A))
- Safeguard evaluation across Administrative, Physical, and Technical categories
- Threat and vulnerability identification per ePHI asset
- Risk scoring with likelihood × impact matrix
- Risk treatment options (mitigate, accept, transfer, avoid)

**Gap Analysis:**
- Control mapping against HIPAA requirements
- Current state vs. target state comparison
- Automated gap identification with severity scoring
- Prioritized remediation recommendations

**Remediation Tracking:**
- Action item management with owners, due dates, and status
- Progress dashboards per assessment
- Evidence attachment for completed controls
- Milestone tracking against remediation plan

**Documentation & Reporting:**
- Assessment report generation (PDF export)
- Risk register with version history
- Policy and procedure templates
- Board-level executive summary
- Audit trail for all assessment activities

**AI-Powered Features (via OpenRouter):**
- Intelligent risk identification based on organization profile
- Gap analysis narrative generation
- Remediation recommendation engine
- Policy document drafting assistance
- All routed through llm.config.js

---

## 5. RBAC Extension (Healthcare-Specific)

Beyond the Cavaridge minimum role taxonomy, HIPAA Toolkit should implement:

| Role | Scope | Purpose |
|---|---|---|
| Platform Owner | Global | Cavaridge platform management |
| Platform Admin | Global | Tenant management, no billing |
| Tenant Admin | Tenant | Full control within healthcare org |
| Compliance Officer | Tenant | Lead assessments, approve risk treatments, sign off on remediation |
| Auditor | Tenant | Read-only access to all assessment data, reports, and audit trails |
| User | Tenant | Create/edit assessments, log evidence, update remediation items |
| Viewer | Tenant | Read-only access to assigned assessments |

---

## 6. Compliance Considerations

- **Data sensitivity:** HIPAA assessment data may reference ePHI handling practices. The app itself should NOT store actual ePHI, but assessment metadata requires careful handling.
- **Audit logging:** All user actions on assessment data must be logged with timestamp, user, and action detail.
- **Session management:** Automatic timeout after inactivity period. Session tokens must be secure.
- **Data retention:** Assessment data retention policies must be configurable per tenant.
- **Encryption:** Data at rest and in transit. Database encryption required.
- **Access logging:** Track all data access for compliance audit purposes.

---

## 7. Build Sequence (Pre-Build Checklist)

- [ ] App registered in CVG-CORE registry ✅
- [ ] Claude project created with system prompt and this runbook attached
- [ ] Architecture spec fully defined in Claude before Replit opens
- [ ] Data model designed with tenant isolation and audit logging from start
- [ ] RBAC roles defined (including Compliance Officer and Auditor)
- [ ] GitHub private repo created with LICENSE and .gitignore
- [ ] Doppler project created with dev/staging/prd environments
- [ ] Multitenancy scaffold in place before any feature work
- [ ] Light/dark/system theme wired on day one
- [ ] llm.config.js scaffolded before any AI feature
- [ ] Rate limiting and CSRF protection from first route
- [ ] Error boundaries in React client
- [ ] Initial runbook generated at v1.0.0 after first build session

---

## 8. Shared Components (Reusable from Portfolio)

| Component | Source | Notes |
|---|---|---|
| Multitenancy middleware | cvg-shared (extract from Meridian) | Org-scoped data isolation |
| RBAC middleware | cvg-shared (extract from Meridian) | Permission checking, role hierarchy |
| ThemeProvider | cvg-shared (reference: Ceres/Meridian) | Three-way theme system |
| PDF generation | cvg-shared (extract from Caelum/Meridian) | PDFKit patterns |
| SSE streaming | cvg-shared (extract from Astra/Caelum) | AI response streaming |
| Audit logging | cvg-shared (extract from Meridian) | Timestamped action logging |

---

## 9. DIT Tenant Boundary

- DIT is a tenant within HIPAA Toolkit — never a co-owner
- No DIT names, logos, or references in source code from day one
- DIT gets a standard tenant record for their compliance assessments
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
