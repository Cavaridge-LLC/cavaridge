# CVG-NEXUS — NexusEHR Application Runbook
**Document:** CVG-NEXUS-RB-v1.0.0-20260304
**Owner:** Cavaridge, LLC
**Classification:** Internal — Confidential
**Governance Authority:** CVG-CORE-RB-v2.0.0-20260303

---

## 1. Application Identity

| Field | Value |
|---|---|
| **App Code** | CVG-NEXUS |
| **App Name** | NexusEHR |
| **Purpose** | Electronic Health Record (EHR) and Practice Management Platform — clinical documentation, patient scheduling, billing, and practice operations for healthcare providers |
| **IP Owner** | Cavaridge, LLC |
| **Status** | Planned |
| **Repo** | `cavaridge/cvg-nexus` (Private — to be created) |

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
| Auth | TBD — must support healthcare-grade authentication (MFA required) | — |

---

## 3. Cavaridge Standards Compliance (Target — Build from Day One)

| Standard | Target | Notes |
|---|---|---|
| Multitenancy | ✅ Required | `tenant_id` on every table. Practice-level isolation. Row-level scoping enforced. |
| RBAC | ✅ Required | Healthcare-specific roles: Provider, Nurse, Admin, Biller, Front Desk, Patient Portal. Extends Cavaridge minimum taxonomy. |
| Light/Dark/System theme | ✅ Required | ThemeProvider with `prefers-color-scheme` from day one. |
| No hardcoded client data | ✅ Required | All practice config in tenant records. No practice names, specialties, or fee schedules in code. |
| IP hygiene | ✅ Required | Cavaridge, LLC ownership. LICENSE file. No DIT or client references. |
| OpenRouter via Cavaridge key | ✅ Required | All AI calls through OpenRouter. Model selection in llm.config.js. |
| No plaintext secrets | ✅ Required | Replit Secrets for dev, Doppler for staging/production. |
| llm.config.js routing | ✅ Required | Scaffolded before any AI feature. |
| Rate limiting | ✅ Required | Applied from first route. |
| CSRF protection | ✅ Required | Enabled from day one. |
| Automated tests | ✅ Required | Critical — healthcare software requires comprehensive test coverage. |

---

## 4. Planned Feature Domains

**Electronic Health Records:**
- Patient demographics and medical history
- Clinical encounter documentation (SOAP notes, assessments, plans)
- Problem lists, medication lists, allergy tracking
- Lab results and imaging integration
- Clinical decision support alerts
- e-Prescribing workflow

**Practice Management:**
- Patient scheduling with appointment types and provider availability
- Check-in/check-out workflow
- Insurance verification
- Claims management and billing
- Payment processing and patient statements
- Reporting and analytics dashboards

**Patient Portal:**
- Patient-facing portal for appointments, messages, and records
- Secure messaging between patients and providers
- Online scheduling and appointment requests
- Patient intake forms (digital)
- Lab results viewing
- Bill pay

**AI-Powered Features (via OpenRouter):**
- Clinical documentation assistance (ambient note generation)
- Coding suggestions (ICD-10, CPT)
- Prior authorization narrative drafting
- Clinical summarization
- All routed through llm.config.js

---

## 5. RBAC Extension (Healthcare-Specific)

Beyond the Cavaridge minimum role taxonomy:

| Role | Scope | Purpose |
|---|---|---|
| Platform Owner | Global | Cavaridge platform management |
| Platform Admin | Global | Tenant management, no billing |
| Practice Admin | Tenant | Full control within practice — users, settings, configuration |
| Provider | Tenant | Full clinical access — encounters, orders, prescriptions, notes |
| Nurse / Clinical Staff | Tenant | Clinical documentation, vitals, triage, medication administration |
| Biller | Tenant | Claims, payments, billing reports — no clinical data access |
| Front Desk | Tenant | Scheduling, check-in/out, demographics — limited clinical access |
| Patient Portal User | Patient-scoped | Own records, messages, appointments, bill pay only |

---

## 6. Regulatory & Compliance Requirements

**⚠️ CRITICAL: NexusEHR will handle Protected Health Information (PHI). Compliance is non-negotiable.**

| Requirement | Standard | Notes |
|---|---|---|
| HIPAA Security Rule | 45 CFR 164 | Administrative, physical, and technical safeguards |
| HIPAA Privacy Rule | 45 CFR 160/164 | Patient data use and disclosure |
| ONC Health IT Certification | 21st Century Cures Act | Required for EHR products |
| HL7 FHIR | R4 | Interoperability standard for health data exchange |
| SMART on FHIR | App launch framework | Third-party app integration |
| Meaningful Use / MIPS | CMS Quality Programs | Reporting and quality measures |
| State-specific regulations | Varies | Telehealth, prescribing, consent laws |

**Architectural implications:**
- All PHI encrypted at rest and in transit
- Comprehensive audit logging on every PHI access (who, what, when, why)
- Automatic session timeout
- MFA required for all clinical users
- Role-based data segmentation (billers cannot see clinical notes without cause)
- Data retention policies per tenant/state
- BAA (Business Associate Agreement) framework for third-party integrations
- FHIR API endpoints for interoperability
- Patient consent management

---

## 7. Database Considerations

**PostgreSQL with strict tenant isolation:**
- `practice_id` (tenant_id) on every clinical and administrative table
- Row-level security (RLS) policies enforced at database level — not just application middleware
- Audit log table capturing every PHI read, write, and delete
- Separate schema or table partitioning strategy for high-volume clinical data
- Backup encryption and point-in-time recovery

**Key data domains:**
- Patients (demographics, insurance, contacts)
- Encounters (visits, notes, assessments, plans)
- Orders (labs, imaging, referrals)
- Medications (prescriptions, administration records)
- Billing (claims, payments, adjustments)
- Scheduling (appointments, availability, resources)
- Messages (patient-provider communication)
- Documents (uploaded files, scanned records)

---

## 8. Build Sequence (Pre-Build Checklist)

- [ ] App registered in CVG-CORE registry ✅
- [ ] Claude project created with system prompt and this runbook attached
- [ ] **Regulatory review completed** — HIPAA, ONC, state requirements documented
- [ ] Architecture spec fully defined in Claude before Replit opens
- [ ] Data model designed with PHI handling, audit logging, and tenant isolation
- [ ] RBAC roles defined (all healthcare-specific roles)
- [ ] FHIR API surface designed
- [ ] GitHub private repo created with LICENSE and .gitignore
- [ ] Doppler project created with dev/staging/prd environments
- [ ] Multitenancy scaffold with RLS policies before any feature work
- [ ] Light/dark/system theme wired on day one
- [ ] llm.config.js scaffolded before any AI feature
- [ ] MFA authentication implemented before any PHI handling
- [ ] Rate limiting, CSRF, and encryption from day one
- [ ] Error boundaries in React client
- [ ] Comprehensive test framework established before clinical features
- [ ] Initial runbook generated at v1.0.0 after first build session

---

## 9. Shared Components (Reusable from Portfolio)

| Component | Source | Notes |
|---|---|---|
| Multitenancy middleware | cvg-shared (extract from Meridian) | Needs enhancement with RLS |
| RBAC middleware | cvg-shared (extract from Meridian) | Extend with healthcare roles |
| ThemeProvider | cvg-shared | Three-way theme system |
| PDF generation | cvg-shared (Caelum/Meridian) | Clinical report generation |
| Audit logging | cvg-shared (extract from Meridian) | Enhance for PHI access tracking |
| Scheduling algorithms | CVG-CERES (reference) | Visit scheduling patterns |

---

## 10. DIT Tenant Boundary

- DIT is a tenant within NexusEHR — never a co-owner
- No DIT names, logos, or references in source code from day one
- DIT (or any MSP managing healthcare clients) gets a standard tenant record
- All practice customizations in tenant config — never in codebase

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
