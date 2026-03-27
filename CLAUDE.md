# CLAUDE.md

This file governs all Claude Code work in the Cavaridge monorepo.

-----

## What This Repo Is

Monorepo for the entire Cavaridge application portfolio. Contains all apps, shared packages, governance standards, templates, prompts, and runbooks.

**Owner:** Cavaridge, LLC (D-U-N-S: 138750552). Sole IP owner of all code, documentation, and applications.

**Operator:** Benjamin Posner — communicates intent in natural language. Claude Code translates to implementation.

-----

## Repo Structure

```
cavaridge/
├── apps/                  ← Each app is an independent deployable
│   ├── meridian/          ← M&A IT Intelligence Platform (CVG-MER)
│   ├── caelum/            ← SoW Builder (CVG-CAELUM)
│   ├── forge/             ← Autonomous Content Creation Platform (CVG-FORGE)
│   ├── midas/             ← IT Roadmap / QBR Platform (CVG-MIDAS)
│   ├── vespar/            ← Cloud Migration Planning (CVG-VESPAR)
│   ├── astra/             ← M365 License Optimization (CVG-ASTRA)
│   ├── hipaa/             ← HIPAA Risk Assessment Toolkit (CVG-HIPAA)
│   ├── aegis/             ← Security Posture & Browser Security Platform (CVG-AEGIS)
│   ├── ceres/             ← Medicare 60-Day Frequency Calculator (CVG-CERES)
│   ├── spaniel/           ← Internal LLM Gateway (CVG-AI / Project Spaniel)
│   ├── ducky/             ← Research & Intelligence Platform (CVG-RESEARCH / Project Ducky)
│   ├── brain/             ← Voice-First Knowledge Capture (CVG-BRAIN)
│   ├── cavalier/          ← Cavalier Partners — Channel Partner GTM Platform (CVG-CAVALIER)
│   ├── browse/            ← Browser Automation Subsystem (CVG-BROWSE)
│   ├── pawvault/          ← The Paw Vault — Family pet scrapbook + health record app (CVG-PVT) — iOS + Android
│   └── pawvault-web/      ← The Paw Vault web companion — React + Vite (CVG-PVT)
├── packages/              ← Shared code imported by apps
│   ├── ui/                ← Radix + Tailwind component library
│   ├── auth/              ← Supabase auth, Universal Tenant Model, RBAC, tenant isolation
│   ├── config/            ← Shared env config (database URLs, feature flags)
│   ├── spaniel/           ← LLM Gateway wrapping OpenRouter (CVG-AI)
│   ├── agent-core/        ← Shared agent types, base class, tool definitions
│   ├── agent-runtime/     ← Execution engine (Vercel AI SDK wrapper)
│   ├── agents/            ← Vertical agent subgraphs (healthcare, legal, financial, msp) + Ducky supervisor router
│   ├── domain-agents/     ← 12 domain-specialist knowledge agents (Addendum A)
│   ├── connector-sdk/     ← Connector development SDK (Phase 4 publication)
│   ├── connectors/        ← 25+ platform connectors (MSP, healthcare, ITSM, ERP, legal, financial)
│   ├── connector-core/    ← Connector interfaces, normalized models, registry, sync engine
│   ├── psa-core/          ← Ticket schema, SLA engine, time entry, contract lifecycle, billing
│   ├── tenant-intel/      ← Shared M365/GWS tenant ingestion & intelligence layer
│   ├── ducky-animations/  ← Lottie animations for Ducky mascot (9 states)
│   ├── security/          ← Input validation, PII detection, prompt injection prevention
│   ├── agent-test/        ← Automated agent simulation engine (personas, scenarios, scoring, canary gates)
│   ├── blueprints/        ← Reusable build template library (versioned, tenant-scoped, searchable)
│   ├── audit/             ← Immutable append-only agent audit logging
│   ├── compliance-gateway/ ← Cross-vertical PHI/PII/CHD detection, de-identification, audit logging
│   ├── knowledge/         ← Multi-tenant RAG with vertical namespaces (pgvector + BM25 hybrid)
│   ├── agent-memory/      ← 4-tier agent memory persistence (Platform/MSP/Client/Session)
│   ├── mcp/               ← MCP (Model Context Protocol) server + tool definitions
│   ├── fhir/              ← FHIR R4 connectors + EHR adapters (Epic, Cerner, athenahealth, eCW)
│   ├── pawvault-ui/       ← The Paw Vault warm design system (Tailwind + Radix)
│   └── pawvault-ai/       ← The Paw Vault Ducky Intelligence client wrapper
├── docs/
│   ├── architecture/      ← All architecture specs, addenda, and conformance docs
│   └── prototypes/        ← Reference implementations and executable specs
├── templates/             ← Scaffold files for new app repos
├── registry/              ← apps.json — canonical app registry metadata
├── scripts/               ← CI compliance checks, utilities
└── .github/workflows/     ← CI/CD pipelines
```

-----

## App Code Registry

|App Code    |Name                 |Directory    |Status |Description                                                                                                                                                                                                                                                                                   |
|------------|---------------------|-------------|-------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|CVG-CORE    |Governance Core      |(root)       |Active |Central governance, RBAC, tenant provisioning                                                                                                                                                                                                                                                 |
|CVG-AI      |Spaniel              |apps/spaniel |Planned|Internal LLM gateway — sole router for all AI calls                                                                                                                                                                                                                                           |
|CVG-RESEARCH|Ducky                |apps/ducky   |Planned|User-facing research & intelligence platform (web, iOS, Android). Supervisor router for multi-vertical agent system.                                                                                                                                                                          |
|CVG-CAELUM  |Caelum               |apps/caelum  |Active |SoW builder — DIT is a tenant, not hardcoded                                                                                                                                                                                                                                                  |
|CVG-FORGE   |Forge                |apps/forge   |Planned|Autonomous content creation platform (compete with SuperCool)                                                                                                                                                                                                                                 |
|CVG-MER     |Meridian             |apps/meridian|Active |M&A IT intelligence platform                                                                                                                                                                                                                                                                  |
|CVG-HIPAA   |HIPAA Risk Assessment|apps/hipaa   |Active |Healthcare compliance assessments                                                                                                                                                                                                                                                             |
|CVG-AEGIS   |Aegis                |apps/aegis   |Planned|Security posture & browser security platform (compete with Atakama + ThreatMate + SecurityScorecard). Includes Identity Access Review module (freemium + full-tier, Astra cross-sell).                                                                                                        |
|CVG-MIDAS   |Midas                |apps/midas   |Active |IT roadmap / QBR platform + security scoring module                                                                                                                                                                                                                                           |
|CVG-VESPAR  |Vespar               |apps/vespar  |Active |Cloud migration planning (not “SkyShift”, not “Vesper”)                                                                                                                                                                                                                                       |
|CVG-ASTRA   |Astra                |apps/astra   |Active |M365 license optimization. Receives IAR data from AEGIS for vCIO reporting, license optimization dashboards, and executive-ready client posture summaries (Phase 4 of CVG-AEGIS-IDENTITY-REVIEW-v1.0).                                                                                        |
|CVG-CERES   |Ceres                |apps/ceres   |Active |Medicare 60-day frequency calculator                                                                                                                                                                                                                                                          |
|CVG-BRAIN   |Brain                |apps/brain   |Planned|Voice-first knowledge capture & recall                                                                                                                                                                                                                                                        |
|CVG-CAVALIER|Cavalier Partners    |apps/cavalier|Planned|Channel partner GTM platform (Cavaridge Managed Services)                                                                                                                                                                                                                                     |
|CVG-BROWSE  |Browser Automation   |apps/browse  |Planned|Playwright + Browserless browser automation subsystem. BullMQ task queue, per-tenant browser context isolation, HIPAA ephemeral container escalation. MCP server exposing navigate/extract/fill_form/screenshot/execute_workflow tools. See DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md §3.|
|CVG-PVT     |The Paw Vault        |apps/pawvault|Planned|Family pet scrapbook + health record freemium consumer mobile app. **Standalone — NOT a cavaridge-platform UTM tenant.** Separate Supabase instance. RevenueCat billing. Ducky Intelligence AI. Cavaridge Puppies division.                                                                   |

**16 apps total.** Every app must be registered here before any code is written.

-----

## Build Order

```
Spaniel → Ducky → Caelum → Forge → Meridian → HIPAA → AEGIS → Midas → rest
```

**Extended (v2.11):** CVG-BROWSE (browser automation) → Compliance Gateway → Healthcare vertical agent → Legal vertical agent → Financial vertical agent → MSP/IT vertical agent formalization → Supervisor router + memory layer. See DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md §9 for phased implementation checklist.

Rationale: Spaniel is the LLM gateway everything depends on. Ducky is the user-facing AI layer. Caelum has immediate DIT operational urgency. Forge reuses Caelum’s DOCX rendering + Ducky personality + Spaniel execution. Meridian, HIPAA, and AEGIS follow as the compliance/intelligence cluster. Midas (with security scoring + tenant-intel) builds on data from upstream apps. CVG-BROWSE establishes browser automation infrastructure that all vertical agents share, then Compliance Gateway is prerequisite for healthcare, and vertical agents build on both.

**Note:** AEGIS browser extension and Cloudflare Gateway integration are independent of the agent-first pipeline and can be developed in parallel once monorepo core (`packages/auth/`, `packages/db/`) is stable.

**Consumer track (parallel to platform):**
CVG-PVT (The Paw Vault) builds independently of the platform app sequence. It shares no deployment dependencies with the platform cluster and can be developed concurrently with any phase.

**Supporting infrastructure build sequence:**

1. Spaniel (CVG-AI) — LLM gateway
1. Ducky (CVG-RESEARCH) — conversation state, agentic architecture
1. security/audit packages — shared security primitives
1. @cavaridge/tenant-intel — M365/GWS ingestion layer
1. App builds per order above

### 4-Phase Build Timeline (from Addendum A)

|Phase  |Timeline|Deliverables                                                                                              |
|-------|--------|----------------------------------------------------------------------------------------------------------|
|Phase 1|Q2 2026 |Spaniel gateway, Ducky MVP, 4 domain agents (HIPAA, Cybersecurity, Tech/Infra, Finance), 5 base connectors|
|Phase 2|Q3 2026 |Remaining 8 domain agents, 10 additional connectors, connector marketplace MVP                            |
|Phase 3|Q4 2026 |Full connector marketplace, subscription tier gating, regulatory auto-ingest pipeline                     |
|Phase 4|Q1 2027 |Connector SDK publication, partner-built connectors, advanced marketplace features                        |

### Multi-Vertical Agent Build Timeline (from DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC v1.0)

|Phase  |Sprints|Deliverables                                                                                                                                       |
|-------|-------|---------------------------------------------------------------------------------------------------------------------------------------------------|
|Phase 1|1–3    |CVG-BROWSE (Browserless on Railway, BullMQ queue, Playwright workers), MCP server, per-tenant isolation, HIPAA escalation                          |
|Phase 2|4–8    |Compliance Gateway (PHI/PII/CHD detection + de-identification), Healthcare vertical agent (FHIR R4, Da Vinci PA, EHR adapters), RAG knowledge layer|
|Phase 3|9–14   |Legal vertical agent (Clio, PACER, contract review, e-discovery), Financial vertical agent (Plaid, SOX, PCI, AML), MSP/IT vertical formalization   |
|Phase 4|15–18  |Ducky supervisor router, 4-tier agent memory, VerticalAgentConfig CRUD, advanced RAG (HyDE + re-ranking), production hardening                     |

-----

## Common Stack

- **Language:** TypeScript 5.6+ (strict mode, no `any` unless justified with comment)
- **Runtime:** Node.js 20
- **Framework:** Express 5
- **Database:** PostgreSQL 16 via Supabase + Drizzle ORM + pgvector
- **Auth:** Supabase Auth with Universal Tenant Model (see below)
- **UI:** React 18-19, Vite, Tailwind CSS v4, shadcn/ui, Radix primitives
- **Hosting:** Railway (one service per app, auto-deploy from GitHub)
- **Secrets:** Doppler (dev/staging/production environments)
- **LLM Routing:** OpenRouter via @cavaridge/spaniel — master Cavaridge LLC key
- **Agent Framework:** Vercel AI SDK + LangGraph.js for complex workflows
- **Vector Store:** pgvector in Supabase
- **Job Queue:** BullMQ + Redis (Railway-hosted)
- **Observability:** Langfuse (self-hosted)
- **Browser Automation:** Playwright + Browserless (Railway-hosted, CVG-BROWSE)
- **MCP:** Model Context Protocol server via @cavaridge/mcp (JSON-RPC 2.0)
- **Source:** github.com/Cavaridge-LLC/cavaridge (pnpm workspaces + Turborepo)

-----

## Universal Tenant Model

The same 4-tier hierarchy governs ALL Cavaridge platform apps. Defined in `packages/auth/` and enforced via Supabase RLS at every layer. **Does NOT apply to CVG-PVT — see CVG-PVT section below.**

```
Cavaridge (Platform Owner)          ← type: platform
└── MSP Tenant (e.g., Dedicated IT) ← type: msp
    ├── Client A (e.g., Compass SP) ← type: client
    │   ├── Site: Main Office       ← type: site
    │   └── Site: Tampa ASC         ← type: site
    ├── Client B                    ← type: client
    └── Prospect X (freemium scan)  ← type: prospect
```

**Schema:** Self-referencing `tenants` table with `parent_id` FK. `type` enum: `platform | msp | client | site | prospect`. `config` jsonb for branding, policies, feature flags.

**RBAC — 6 Standard Roles (enforced at data/API/UI layers):**

|Role          |Scope                       |Access                                  |
|--------------|----------------------------|----------------------------------------|
|Platform Admin|Full platform               |Everything — Cavaridge operators only   |
|MSP Admin     |Their MSP + all children    |Full CRUD, user management, billing     |
|MSP Tech      |Their MSP + assigned clients|Operational access, no billing/user mgmt|
|Client Admin  |Their org + sites           |Manage own users, view reports          |
|Client Viewer |Their org + sites           |Read-only dashboards and reports        |
|Prospect      |Limited preview             |Freemium scan results only (AEGIS)      |

**Role inheritance:** Downward only. No lateral access. MSP Admin sees all their clients. Client Admin never sees other clients.

**Per-App UTM Mapping:** See `docs/architecture/CVG-UTM-CONFORMANCE-v1.0.0-20260315.md` for how each app maps tenant tiers to domain-specific concepts.

-----

## Universal Build Standards

- **Multitenancy first.** Every feature supports tenant isolation from day one. `tenant_id` on every data table.
- **No hardcoded client data.** DIT is an MSP tenant only — never embed DIT-specific values, branding, or logic.
- **Light/dark/system themes** required on every app from day one.
- **All LLM calls route through `@cavaridge/spaniel`.** Direct OpenRouter imports are forbidden (enforced by ESLint). No app-level LLM API keys permitted. Model selection defined by task type in central routing config (`llm.config.js`).
- **Compliance Gateway rule:** All vertical agent LLM calls MUST pass through `@cavaridge/compliance-gateway` before reaching Spaniel. The gateway enforces PHI/PII/CHD detection, de-identification, prompt sanitization, output leakage scanning, and audit logging. No vertical agent may bypass the gateway. Model selection is enforced by compliance context: HIPAA tenants route to BAA-covered providers (Azure OpenAI zero-retention or AWS Bedrock) only. PCI tenants must have CHD redacted pre-LLM. Legal privilege tenants route to controlled environments only.
- **Browser automation rule:** CVG-BROWSE tasks execute in per-tenant isolated Playwright BrowserContexts against Browserless on Railway. HIPAA-flagged tenants escalate to ephemeral container-per-task isolation (container created, used, destroyed — no state leakage). All browser tasks scoped by tenant domain whitelist stored in VerticalAgentConfig. Browser task results audited via Langfuse. No browser task may navigate outside the tenant’s configured allowed domains.
- **Functional components with hooks.** No class components. Named exports for components. Default export only for page-level modules.
- **Feature-based directory structure** within each app.
- **Commit messages:** Imperative mood, <72 chars. Prefix: `feat:`, `fix:`, `chore:`, `docs:`.
- **All user-facing text** must support tenant customization — no hardcoded product names in UI.
- **Agent testing required.** All agents must pass @cavaridge/agent-test simulation battery before version promotion. Security scenarios: 100% pass. Functional scenarios: 95%+. PHI/PII boundary tests: zero tolerance.
- **Blueprint integration.** All successful Ducky builds should be offered for blueprint save. Generated agents must include at least 3 test scenarios. Blueprint search is mandatory during Plan Mode.
- **CVGBuilder enforcement.** Generated code must route LLM calls through Ducky → Spaniel. Generated schemas must include tenant_id + RLS. Generated UIs must include Ducky Intelligence branding.

-----

## Secret Management

- No plaintext keys in any repo. Ever.
- `.env` files gitignored on every project before first commit.
- Dev secrets in local env or Doppler dev environment.
- Staging/production secrets in Doppler.
- Master Cavaridge OpenRouter key never leaves the vault.
- App sub-keys scoped to minimum required access, stored in Doppler.
- `REDIS_URL` in Doppler (provisioned on Railway).
- `BROWSER_API_TOKEN` in Doppler (Browserless auth for CVG-BROWSE).
- Spaniel service tokens rotated on schedule.

-----

## LLM Workflow

- **Claude** = architect, governance, documentation, planning, standards definition.
- **Claude Code CLI** = builder, code execution, implementation. Replaced Replit Agent (2026-03-10).
- **GitHub** = source of truth for all code.
- Claude defines standards before Claude Code builds.
- All LLM calls import from `@cavaridge/spaniel` — direct OpenRouter imports are forbidden.

-----

## Agent-First Platform Architecture

- Master spec: `docs/architecture/CVG-AGENT-FIRST-PLATFORM-ARCHITECTURE-v1.docx`
- This spec is **APPROVED** (2026-03-13) — all apps built as agents first, interfaces second.
- All LLM calls route through @cavaridge/spaniel (not directly to OpenRouter).

### Three-Tier Agent Model (Addendum A)

**Layer 1 — 12 Domain Specialist Agents** (knowledge experts, no task execution):

|Domain ID|Agent                    |Guardrails                             |Primary Consumers               |
|---------|-------------------------|---------------------------------------|--------------------------------|
|HIPAA    |HIPAA Compliance Agent   |45 CFR Parts 160/164 only              |CVG-HIPAA, CVG-MER, CVG-AEGIS   |
|PCI-DSS  |PCI-DSS Agent            |PCI DSS v4.0 requirements              |CVG-AEGIS, CVG-MER              |
|HITRUST  |HITRUST Agent            |HITRUST CSF v11                        |CVG-HIPAA, CVG-AEGIS            |
|SOC2     |SOC 2 Agent              |AICPA TSC 2017                         |CVG-AEGIS, CVG-MER              |
|CMS      |CMS/Medicare Agent       |CMS CoPs, PDGM, LCD/NCD                |CVG-CERES, CVG-HIPAA            |
|FINANCE  |Finance Agent            |GAAP/IFRS, MSP financial models        |CVG-MIDAS, CVG-MER              |
|FINTECH  |FinTech Agent            |PCI, SOX, financial APIs               |CVG-MIDAS                       |
|LEGAL    |Legal Agent              |Contract law, MSA/SLA patterns         |CVG-CAELUM, CVG-MER             |
|TECH     |Tech/Infrastructure Agent|Networking, cloud, infra best practices|ALL apps                        |
|LANG     |Language Agent           |Grammar, tone, localization            |CVG-FORGE, CVG-CAELUM, CVG-BRAIN|
|CYBER    |Cybersecurity Agent      |NIST CSF, CIS Controls, MITRE ATT&CK   |CVG-AEGIS, CVG-HIPAA            |
|PRIVACY  |Data Privacy Agent       |State privacy laws, GDPR, CCPA         |CVG-HIPAA, CVG-AEGIS            |

Domain agents hosted in separate Postgres schemas, shared Supabase instance, RLS-isolated. Regulatory auto-ingest pipeline for Federal Register / CMS / NIST updates.

**Layer 2 — 7 Functional Agents** (shared, parameterized by consuming app):

|Agent             |What It Does                                               |Consumed By                           |
|------------------|-----------------------------------------------------------|--------------------------------------|
|Document Analysis |PDF/DOCX/image ingestion, classification, entity extraction|Meridian, HIPAA, Caelum, Ducky, Forge |
|Compliance Checker|Regulatory framework evaluation, gap analysis              |HIPAA, CORE, Meridian, Caelum, AEGIS  |
|Report Generator  |Formatted output (PDF/DOCX/PPTX) with charts               |ALL apps                              |
|Data Extractor    |Unstructured → normalized schemas                          |Meridian, Astra, Vespar, Ceres, Midas |
|Research Agent    |Web research, source analysis, confidence scoring          |Ducky (primary), Meridian, CORE, Forge|
|Risk Scorer       |Deterministic scoring with configurable weights            |Meridian, HIPAA, CORE, Vespar, AEGIS  |
|Cost Analyzer     |ROI, TCO, license math, labor estimates                    |Meridian, Astra, Vespar, Midas, Caelum|

**Layer 3 — Product Agents** (app-specific):

|Agent                         |App       |Purpose                                                                                  |
|------------------------------|----------|-----------------------------------------------------------------------------------------|
|Knowledge Graph Builder       |CVG-MER   |M&A intelligence graph construction                                                      |
|M365 License Optimizer        |CVG-ASTRA |License right-sizing recommendations                                                     |
|SoW Generator                 |CVG-CAELUM|Statement of work drafting from templates                                                |
|Medicare Calculator           |CVG-CERES |Deterministic frequency calculation (no LLM)                                             |
|Migration Planner             |CVG-VESPAR|Cloud migration sequencing and risk analysis                                             |
|Browser Security Policy Engine|CVG-AEGIS |AI-driven browser policy recommendations via Ducky                                       |
|Pet Health Insights           |CVG-PVT   |Health trend analysis, breed-specific prompts, NL vault search via Ducky Intelligence API|

### Vertical Agent Architecture (v2.11 — DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC v1.0)

**Vertical Agent Config:** Each vertical agent (healthcare, legal, financial, msp) is parameterized by a `VerticalAgentConfig` record in Supabase (table: `vertical_agent_configs`, RLS: Platform Admin only). Config specifies: systemPrompt, tools[], guardrails[], knowledgeNamespaces[], complianceRules[], allowedModels[], humanApprovalRequired[], browserAutomationEnabled, browserDomainWhitelist[], maxBrowserStepsPerTask. A `VerticalAgentFactory` composes the base agent class with config at runtime — one codebase, one deployment, vertically-distinct behavior via metadata. Adding a new vertical requires configuration, not architecture changes.

**Supervisor pattern:** Ducky acts as LangGraph.js supervisor using `Command` objects for agent handoffs. Intent classification (LLM-driven, Zod-validated `VerticalRoute`) routes to the correct vertical subgraph. Confidence < 0.7 triggers clarification before routing. Cross-vertical tasks use `Command.PARENT` to return to supervisor for re-routing.

**Vertical Agent Subgraphs:**

|Vertical  |Package Path                           |Key Integrations                                                                          |Compliance Context                                           |
|----------|---------------------------------------|------------------------------------------------------------------------------------------|-------------------------------------------------------------|
|Healthcare|`packages/agents/verticals/healthcare/`|FHIR R4 (Epic, Cerner, athenahealth, eCW), Da Vinci CRD/DTR/PAS, browser portal automation|HIPAA — BAA-covered LLM only, PHI de-identification mandatory|
|Legal     |`packages/agents/verticals/legal/`     |Clio V4, PACER, NetDocuments/iManage, SALI LMSS, LEDES                                    |Privilege protection — controlled LLM environment            |
|Financial |`packages/agents/verticals/financial/` |Plaid, QuickBooks/Xero, Vanta/Drata/Secureframe, Okta/Azure AD                            |SOX audit trail, PCI CHD redaction, BSA/AML monitoring       |
|MSP/IT    |`packages/agents/verticals/msp/`       |AEGIS, RMM connectors, PSA-core, Cavalier, Caelum                                         |Standard tenant isolation                                    |

**Compliance Gateway (`@cavaridge/compliance-gateway`):**

All vertical agent LLM calls pass through this gateway. Processing pipeline: Detector Registry → PHI/PII/CHD Detection → De-identify/Tokenize/Redact → Audit Log → Input Guard → Spaniel → Output Guard → Return. Model selection enforced by compliance context (HIPAA → Azure OpenAI ZDR or AWS Bedrock; PCI → CHD never sent to LLM; Legal privilege → controlled environment). Audit retention: Healthcare 6yr, Legal 10yr, Financial 7yr, MSP 3yr.

**RAG Knowledge Layer (`@cavaridge/knowledge`):**

Multi-tenant, multi-vertical retrieval. Supabase pgvector (HNSW index) + BM25 (tsvector) hybrid search. 5-stage pipeline: query understanding → HyDE expansion → parallel hybrid retrieval → reciprocal rank fusion → neural re-ranking. `knowledge_chunks` table with RLS by `tenant_id`. Platform-level knowledge pre-seeded with HIPAA/PCI/SOX/CMS/NIST regulatory text.

**4-Tier Agent Memory (`@cavaridge/agent-memory`):**

|Tier    |Scope              |Backend                   |TTL      |
|--------|-------------------|--------------------------|---------|
|Platform|All tenants        |PostgresStore (Supabase)  |Permanent|
|MSP     |Organization       |RedisStore (Railway Redis)|1 year   |
|Client  |Client within MSP  |RedisStore (Railway Redis)|6 months |
|Session |Single conversation|PostgresSaver (Supabase)  |30 days  |

### Addendum B — Seven Architecture Enhancements (CVG-ARCH-ADDENDUM-B-v1.0)

1. `@cavaridge/repo-intel` — Monorepo intelligence package for codebase-aware agent context
1. Spaniel cross-validation — Multi-model consensus verification in the LLM gateway
1. Ducky Verification Engine — Output verification and hallucination detection
1. Caelum project specification ingestion — Structured project specs feed SoW generation
1. CI/CD agent automation in AEGIS — Security scanning integrated into deployment pipelines
1. Agent template marketplace — Shareable agent configurations across tenants
1. Platform analytics — Cross-app usage, performance, and business intelligence dashboards

All seven slot into the existing build phases without changing the build order. Referenced in CLAUDE.md alongside Addendum A.

-----

## Connector Framework (25+ Connectors)

Organized by vertical, gated by subscription tier (base/pro/enterprise):

**MSP Vertical:** NinjaOne, ConnectWise Automate, Datto RMM, Atera, Syncro, HaloPSA, ConnectWise Manage, IT Glue, Hudu
**Healthcare Vertical:** athenahealth, Epic (read-only), Kareo, MEDITECH
**ITSM/Productivity:** Jira, ServiceNow, Zendesk, Freshdesk
**ERP/Finance:** QuickBooks, Xero, Stripe, FreshBooks
**Collaboration:** Slack, Microsoft Teams, Google Workspace, M365

**Healthcare connectors (via @cavaridge/fhir):**

- Epic (FHIR R4 + SMART on FHIR, App Showroom certification, 2-4 month timeline)
- Oracle Health/Cerner (FHIR R4 + Ignite APIs, Oracle Health Developer Program)
- athenahealth (FHIR R4 + proprietary REST, Marketplace 6-12 week approval)
- eClinicalWorks (FHIR R4 via healow, sponsor from customer practice required)
- Redox / Health Gorilla (middleware accelerator, optional — accelerates initial EHR integration)

**Legal connectors:**

- Clio (V4 REST API — practice management, 150K+ legal professionals)
- PACER Case Locator API (federal court record search, $0.10/page)
- NetDocuments / iManage (document management)
- SALI LMSS (18,000+ standardized legal matter tags)
- LEDES 1998B / XML 2.0 (billing data exchange)

**Financial connectors:**

- Plaid (12,000+ US financial institutions)
- QuickBooks (REST API v3)
- Xero (REST API)
- Vanta / Drata / Secureframe (multi-framework compliance evidence)
- Okta / Azure AD (SCIM + REST — identity provider access reviews for SOX/SoD)

Connector marketplace with tenant request/vote system. Connector SDK publication in Phase 4.

-----

## CVG-AI / Spaniel (LLM Gateway)

- Architecture: `docs/architecture/CVG-AI-ARCH-v1.0.0-20260310.md`
- **Stateless LLM gateway.** Sole consumer is Ducky. Not user-facing.
- Task-type-based model routing via OpenRouter. Three-tier fallback cascade (primary → secondary → tertiary).
- Multi-model consensus for hallucination detection (cross-validation per Addendum B).
- Weekly model catalog refresh from OpenRouter.
- Semantic caching: Redis + pgvector.
- HIPAA ZDR (Zero Data Retention) mode.
- Cost tracking per tenant, per model, per task type.
- Langfuse observability for all executions.
- **Compliance Gateway integration (v2.11):** When called by a vertical agent, Spaniel receives requests that have already been sanitized by @cavaridge/compliance-gateway. Spaniel enforces the model whitelist from the compliance context (HIPAA tenants → BAA-covered models only). See DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md §4.

-----

## CVG-RESEARCH / Ducky (Intelligence Platform)

- Architecture: `docs/architecture/CVG-RESEARCH-ARCH-v1.0.0-20260310.md`
- Agentic architecture: `docs/architecture/CVG-RESEARCH-AGENTIC-ARCHITECTURE-v1.0.md`
- Roadmap: `docs/architecture/CVG-AGENTIC-ROADMAP-v1.0.md`
- Multi-vertical spec: `docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md`
- **User-facing intelligence platform** (web, iOS via Expo, Android via Expo).
- Full agentic architecture: Planner → Executor → Action Engine → Approval Gateway.
- **Multi-vertical supervisor (v2.11):** Ducky acts as LangGraph.js supervisor routing requests to healthcare, legal, financial, and MSP/IT vertical agent subgraphs. Intent classification determines vertical; confidence < 0.7 triggers clarification. Cross-vertical coordination via Command.PARENT. All vertical agents share Ducky’s conversation state and tenant context.
- 25+ connectors across MSP, healthcare, ITSM, ERP, legal, and financial verticals with connector marketplace.
- Conversation auto-branching via semantic similarity scoring (0.65 threshold).
- The AI reasoning API for ALL other Cavaridge apps — including CVG-PVT via consumer endpoint.

### Ducky Intelligence Branding

- **Public brand:** “Ducky Intelligence” or “Ducky Intelligence by Cavaridge”
- **NEVER use “Ducky AI”** — conflicts with existing companies (ducky.ai, ducky-ai.com, duckie.ai)
- Character/mascot name “Ducky” alone is fine when referring to the mascot itself.
- Animated Blenheim Cavalier King Charles Spaniel mascot with 9 Lottie animation states (idle, listening, thinking, searching, found, presenting, error, celebrating, sleeping).
- Persists across ALL tenant-branded instances — “Intel Inside” model. Tenants control app skin but not the AI companion.
- Footer tagline in all apps: **“Powered by Ducky Intelligence.”**
- Domain: ducky.cavaridge.com
- Character design reference: `docs/branding/Ducky-Character-Design-Reference-v1.0.docx`
- Personality spec: `docs/branding/DUCKY-INTELLIGENCE-PERSONALITY-SPEC-v1.0.md`

-----

## CVG-BROWSE (Browser Automation Subsystem)

- Architecture: `docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md` §3
- **Playwright + Browserless** browser automation as a platform primitive.
- BullMQ task queue (`browser-tasks`) with exponential backoff retry (3 attempts).
- Per-tenant isolated Playwright BrowserContexts. HIPAA tenants escalate to ephemeral container-per-task.
- Browserless runs as Railway service: `ghcr.io/browserless/chromium`, 20 concurrent sessions, `shm_size: 2g`, health endpoint at `/health`.
- **MCP server** exposing browser tools: `navigate`, `extract`, `fill_form`, `screenshot`, `execute_workflow`. All tools scoped per tenant via UTM. Any MCP-compatible client can consume.
- AI-driven browser-use loop: capture accessibility tree → send to LLM via Spaniel → parse Zod-validated action → execute via Playwright → loop until complete or maxSteps.
- Browser task results audited via Langfuse. Domain whitelist enforced per tenant config.
- Used by vertical agents for: legacy payer portal automation (healthcare), court portal access (legal), banking portal tasks (financial), vendor portal checks (MSP/IT).

-----

## CVG-CAELUM (SoW Builder)

- All generated SoWs MUST conform to `docs/architecture/SOW-MASTER-SPEC-v2_3.md`
- This spec is **LOCKED** (v2.3, 2026-03-25) — do not deviate without explicit instruction.
- Approval section excluded by default (8 sections). Include only when requested.
- Labor Hours table: Role | Scope | Hour ranges ONLY. No rates, no pricing, no dollar amounts.
- **8 mandatory sections:** Summary, Proposed Solution (numbered subs), Prerequisites, Project Management, High-Level Project Outline, Caveats/Risks, Completion Criteria, Estimated Labor Hours.
- **3 mandatory PM tasks in every SoW:** (1) Project plan with milestones, (2) Regular updates at kickoff-established intervals, (3) Documentation updated to reflect new configurations.
- **Formatting:** Arial font, H1 #2E5090, H2 #1A1A1A, table headers blue-bg/white-text, #F2F6FA row banding, #BFBFBF borders.
- Each new SoW handled in its own individual chat.

-----

## CVG-FORGE (Autonomous Content Creation Platform)

- Product Brief: `docs/architecture/CVG-FORGE-PRODUCT-BRIEF-v1.0.md`
- Architecture: `docs/architecture/CVG-FORGE-ARCH-v1.0.md`
- Roadmap: `docs/architecture/CVG-FORGE-ROADMAP-v1.0.md`
- Competes with SuperCool (Famous Labs). Differentiation: reliable execution, transparent credit system, Ducky personality, MSP white-label capability.
- **5-stage agent pipeline:** Brief Analysis → Research → Content Generation → Render → Quality Check.
- Phased output formats: Phase 1 (DOCX, PDF, MD), Phase 2 (PPTX, XLSX), Phase 3 (HTML/landing pages), Phase 4 (video/audio).
- Reuses Caelum’s DOCX rendering engine, Ducky personality layer, and Spaniel execution pipeline.
- Cross-app dependency: Research Agent shared with Ducky.

-----

## CVG-AEGIS (Security Posture, Browser Security & Identity Review Platform)

### Architecture Documents

- Original architecture: `docs/architecture/CVG-AEGIS-ARCH-v1.0.0-20260314.md`
- Browser security spec: `docs/architecture/CVG-AEGIS-BROWSER-SECURITY-v1.0.md`
- Competitive analysis: `docs/architecture/CVG-AEGIS-COMPETITIVE-ANALYSIS-v1.0.md`
- Identity Access Review spec: `docs/architecture/CVG-AEGIS-IDENTITY-REVIEW-v1.0.md`
- IAR Addendum A — Subscription Intelligence: `docs/architecture/CVG-AEGIS-IAR-ADDENDUM-A-v1.0.md`

### Scope

Competes with Atakama (direct MSP browser security competitor), ThreatMate, and SecurityScorecard. AEGIS expanded from Security Posture & Risk Intelligence (2026-03-14) to include a full Managed Browser Security Platform (2026-03-16). Three integrated delivery components:

1. **Browser Extension (Chromium Manifest V3)** — Chrome/Edge extension for real-time phishing detection (Safe Browsing API + DOM heuristics), credential breach monitoring (HIBP k-anonymity), DLP controls (file upload/download blocking, clipboard monitoring, screen watermarking), SaaS shadow IT discovery and app categorization, and browser config compliance checks. Force-deployed via RMM (Intune/NinjaOne/Datto) using `ExtensionInstallForcelist` registry key. Thin client — heavy processing on backend.
1. **DNS Filtering (Cloudflare Gateway / Zero Trust)** — AEGIS acts as management plane for Cloudflare Gateway. Per-tenant Gateway locations via Cloudflare API. Three deployment models: WARP client (full tunnel), DoH via MDM, or router-level (Meraki MX upstream DNS for ASC sites). Cloudflare free tier covers up to 50 seats per tenant. DNS layer is swappable (NextDNS fallback) but Cloudflare is primary.
1. **Multi-Tenant MSP Dashboard (React)** — Built on existing 4-tier tenant model. Three portal tiers: Platform Admin, MSP Portal, Client Portal. Policy management, device enrollment, SaaS inventory, credential risk, DLP incidents, Cavaridge Adjusted Score, automated report generation.

### Cavaridge Adjusted Score (Browser Security Signals)

Composite 0–100 security posture metric. Default weights:

|Signal Source                   |Weight|Data Origin                          |
|--------------------------------|------|-------------------------------------|
|Microsoft Secure Score          |25%   |Microsoft Graph API                  |
|Browser Security Compliance     |20%   |AEGIS extension telemetry            |
|Google Workspace Security Health|15%   |Google Admin SDK                     |
|Credential Hygiene              |15%   |HIBP breach data + reuse detection   |
|DNS Filtering Compliance        |10%   |Cloudflare Gateway logs              |
|SaaS Shadow IT Risk             |10%   |SaaS discovery telemetry             |
|Compensating Controls Bonus     |+5 max|SentinelOne, Duo, Proofpoint presence|

Weights configurable per MSP tenant. Config-driven compensating controls catalog with auto-detection via tenant-intel signals and manual MSP overrides with audit trail.

### AEGIS Build Phases

|Phase  |Timeline   |Deliverables                                                                                                                                            |Sellable Outcome             |
|-------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|
|Phase 1|Weeks 1–3  |Backend scaffold, policy engine data model (Supabase + RLS), telemetry ingestion (BullMQ), minimal extension (URL visit reporting + SaaS classification)|Shadow IT Discovery          |
|Phase 2|Weeks 4–7  |Phishing detection (Safe Browsing + heuristics), credential monitoring (HIBP), Cloudflare Gateway integration, DLP file controls                        |Managed Browser Security     |
|Phase 3|Weeks 8–10 |Cavaridge Adjusted Score (all signals), dashboards, credential risk scoring, CIS Controls mapping, AI policy recommendations via Ducky                  |Security Posture Intelligence|
|Phase 4|Weeks 10–12|Freemium scan landing page, Chrome Web Store listing, RMM deploy scripts (PowerShell for Intune/NinjaOne/Datto), MSP onboarding, sales collateral       |GTM launch                   |

### Key Architecture Decisions

- Extension telemetry batched via HTTPS POST to AEGIS API; device auth via rotating JWT from enrollment.
- Policy cache on extension refreshed every 15 min (configurable); policies are JSON data, not remote code (MV3 compliant).
- Cloudflare Gateway is infrastructure — AEGIS API wraps all CF API calls; DNS layer is swappable if needed.
- All telemetry stored tenant-scoped in Supabase with RLS; default retention 90 days events, 365 days reports.
- Extension distributed via Chrome Web Store + RMM force-deploy (`ExtensionInstallForcelist` registry key).
- Enrollment flow: Extension activates → checks for `device_id` in `chrome.storage.local` → if absent, calls `/api/v1/enroll` with RMM-provided enrollment token → receives `device_id` + `tenant_id` + initial policy set.
- `declarativeNetRequest` for URL blocking (MV3 compliant); content scripts for DOM-level phishing analysis and DLP.
- Credentials are NEVER transmitted — only SHA-1 prefix (first 5 chars) for HIBP k-anonymity lookups.

### Scanning Strategy (Original AEGIS Scope — Retained)

|Layer            |Approach                                                                               |Source                                                                   |
|-----------------|---------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
|External scanner |Build (AEGIS-owned)                                                                    |Nmap, DNS, TLS checks                                                    |
|Internal scanner |Integrate (ConnectSecure API primary, RMM APIs supplement, Wazuh Phase 4+ escape hatch)|ConnectSecure, NinjaOne, etc.                                            |
|AEGIS Probe      |Build (Raspberry Pi appliance, $75-100/unit)                                           |Nmap asset discovery, port scan, service fingerprint via encrypted tunnel|
|M365/Cloud config|Build                                                                                  |Graph API, Google Admin SDK                                              |
|Browser telemetry|Build (Extension)                                                                      |Chrome/Edge Manifest V3 extension                                        |
|DNS telemetry    |Integrate (Cloudflare Gateway)                                                         |Cloudflare Zero Trust API                                                |

### Penetration Testing (Two Tiers)

|             |Tier 1: “AEGIS Security Validation”               |Tier 2: “AEGIS Red Team”                                                   |
|-------------|--------------------------------------------------|---------------------------------------------------------------------------|
|Engine       |Nuclei (MIT license)                              |Horizon3.ai NodeZero (partnership)                                         |
|Scope        |Curated YAML templates for MSP/SMB attack surfaces|Full autonomous pentesting (6 test types)                                  |
|Authorization|Standard MSA                                      |**Explicit written authorization required per engagement — non-negotiable**|
|Pricing      |Included in subscription                          |Premium add-on                                                             |
|Deployment   |Cloud, Probe, or Docker                           |NodeZero cloud platform                                                    |

### AEGIS Pricing (Proposed)

|Tier        |Per Endpoint/Mo|Includes                                                   |
|------------|---------------|-----------------------------------------------------------|
|Free Scan   |$0             |One-time external posture scan (lead gen)                  |
|Essentials  |$2.50–$4.00    |Extension: SaaS discovery, phishing, credential alerts     |
|Professional|$5.00–$7.00    |+ Cloudflare DNS filtering + DLP + Cavaridge Adjusted Score|
|Enterprise  |$8.00–$12.00   |+ AI recommendations (Ducky) + QBR reports + API access    |

MSPs purchase at wholesale and set their own retail pricing to end clients.

### AEGIS Compliance Mapping

|Framework          |AEGIS Coverage                                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------------------------|
|HIPAA Security Rule|DLP prevents PHI exfiltration; DNS blocks malicious destinations; credential monitoring enforces access hygiene|
|CIS Controls v8    |SaaS inventory (CIS 2), browser policy enforcement (CIS 9), MSP tenant model (CIS 15)                          |
|NIST CSF 2.0       |Access control, data security, continuous monitoring                                                           |
|SOC 2 Type II      |Policy enforcement logging, device compliance monitoring                                                       |

### Cross-App Integration

|Source → Target               |Data Flow                                                                                                                 |
|------------------------------|--------------------------------------------------------------------------------------------------------------------------|
|CVG-AEGIS → CVG-MIDAS         |Security findings + Cavaridge Adjusted Score → QBR line items                                                             |
|CVG-AEGIS → CVG-MER           |Posture scores → M&A due diligence risk factors                                                                           |
|CVG-AEGIS → CVG-HIPAA         |Bidirectional compliance state                                                                                            |
|CVG-AEGIS → CVG-CAELUM        |Remediation findings → auto-generated SoW drafts                                                                          |
|tenant-intel → CVG-AEGIS      |M365/GWS config data → Cavaridge Adjusted Score inputs                                                                    |
|Cloudflare Gateway → CVG-AEGIS|DNS query logs → telemetry correlation + DNS compliance scoring                                                           |
|CVG-AEGIS (IAR) → CVG-ASTRA   |Identity posture data, license waste detection → vCIO reports, license optimization dashboards, executive summaries       |
|CVG-AEGIS (IAR) → CVG-CAVALIER|Freemium IAR as co-branded lead-gen tool for channel partners; IAR reviews as “first value” demo during partner onboarding|

### Identity Access Review Module (IAR)

- Architecture: `docs/architecture/CVG-AEGIS-IDENTITY-REVIEW-v1.0.md`
- Subscription Intelligence Addendum: `docs/architecture/CVG-AEGIS-IAR-ADDENDUM-A-v1.0.md`
- Prototype reference: `docs/prototypes/aegis-identity-review/process.py`
- Migration: `migrations/015_iar_subscription_intelligence.sql`
- Drizzle schema: `packages/aegis/src/schema/iar-subscriptions.ts`

Automated Microsoft 365 tenant user security analysis. Ingests standard M365 Admin Center exports (Entra ID user export + M365 Active User Detail), correlates on UPN, classifies risk via deterministic rule engine, generates branded XLSX report.

**Two-tier model:**

1. **Freemium Tier** — Public landing page, no login, no data retention. CSV upload → in-memory processing → branded XLSX download → lead capture. Mirrors AEGIS freemium scan landing page model.
1. **Full Tier** — AEGIS agent integration with tenant-scoped storage, historical diffing engine (delta between reviews), Microsoft Graph API direct pull (Phase 3), remediation task generation (disable/revoke → PSA/ConnectSecure).

**Risk Flag Taxonomy (deterministic, no LLM):**

|Flag                          |Base Severity|Suppressed/Downgraded When                                                             |
|------------------------------|-------------|---------------------------------------------------------------------------------------|
|Blocked but Licensed          |High         |Never — always a license waste finding                                                 |
|External with License         |High         |Tenant profile indicates contractor-heavy model (downgrade to Low)                     |
|Inactive Licensed (>180d)     |High         |Confirmed leave of absence in tenant notes (downgrade to Medium)                       |
|No MFA Registered (Graph only)|High         |Never — always critical                                                                |
|Inactive Licensed (>90d)      |Medium       |MFA enforced (downgrade to Low); activity outside M365 confirmed                       |
|Licensed — No Activity Data   |Medium       |Account type is service/room/shared (suppress)                                         |
|Password Never Expires        |Medium       |MFA enforced via any provider (suppress — reframe as positive finding per NIST 800-63B)|
|Stale External Guest          |Low          |M&A-active or vendor-heavy tenant profile (downgrade to Info)                          |

**Subscription-Level Flags (optional — when subscription export provided):**

|Flag                             |Severity|Condition                               |
|---------------------------------|--------|----------------------------------------|
|Over-Provisioned License         |Medium  |Utilization < 50% AND unused seats ≥ 5  |
|Under-Utilized License           |Low     |Utilization 50–75% AND unused seats ≥ 3 |
|Expiring ≤30 Days (No Auto-Renew)|High    |Renewal ≤ 30 days AND auto-renew off    |
|Expiring ≤60 Days (No Auto-Renew)|Medium  |Renewal ≤ 60 days AND auto-renew off    |
|Expiring ≤90 Days                |Low     |Informational — regardless of auto-renew|
|Trial Subscription Active        |Medium  |Trial subscription still active         |
|Expired Subscription             |High    |Status expired or past renewal date     |

Total IAR flag count: 8 user-level + 7 subscription-level = 15 deterministic flags.

**Subscription Intelligence (Addendum A — CVG-AEGIS-IAR-ADDENDUM-A-v1.0):**

Optional third input: M365 subscription export (Billing → Your products → Export). When provided, the IAR is enriched with:

- **Subscription Overview tab** — every subscription with term, billing frequency, renewal date, utilization rate, cost analysis, and subscription-level risk flags.
- **License Breakdown enrichment** — per-user mapping to subscription term, billing frequency, renewal date, and auto-renew status.
- **Executive Summary additions** — subscription snapshot block with total purchased licenses, overall utilization rate, upcoming renewals, and estimated annual licensing cost/waste.
- **Cost analysis** — annual cost per subscription confirmed at intake (never inferred), with per-license cost and wasted cost computed from unused seats.

Schema: `aegis.iar_subscription_snapshots` (subscription data per review) + `aegis.iar_subscription_user_map` (user-to-subscription mapping). Two new columns on `aegis.iar_reviews`: `has_subscription_data` (boolean), `subscription_source` (csv_export/graph_api). RLS enforced, standard RBAC grants. Phase 3 supplements with Graph API `subscribedSkus` endpoint (billing fields still require CSV or manual intake since Graph doesn’t expose them).

**Contextual Intelligence Engine (Full Tier — Phase 2+):**

Three layers of contextual adjustment applied after base flag computation:

1. **Compensating Control Awareness** — Pulls tenant-intel signals (Duo/Entra ID MFA, SentinelOne, Conditional Access policies, Proofpoint) and auto-adjusts flag severity.
1. **Business Context Modifiers** — Tenant profile metadata (industry vertical, M&A activity flag, multi-site flag, vendor density) calibrates what “normal” looks like.
1. **Report Tone Engine** — Auto-adjusts executive summary framing based on aggregate finding severity. Never frames findings in a way that makes the MSP’s management of the client look negligent in a client-facing deliverable.

**IAR Build Phases:**

|Phase  |Deliverable                                                                  |
|-------|-----------------------------------------------------------------------------|
|Phase 1|Freemium landing page + CSV processing + risk flag engine + branded XLSX     |
|Phase 2|AEGIS agent integration + tenant storage + historical delta engine           |
|Phase 3|Microsoft Graph direct pull (zero-touch recurring reviews)                   |
|Phase 4|Astra integration (vCIO reports, license cost analysis, executive narratives)|

**Astra Cross-Sell:** IAR data feeds directly into Astra’s vCIO reporting layer. **Cavalier Partners:** IAR packaged as co-branded partner-deliverable tool.

-----

## CVG-MIDAS (IT Roadmap / QBR Platform)

- Security Scoring Module: `docs/architecture/CVG-MIDAS-SECURITY-SCORING-ADDENDUM-v1.0.0-20260313.md`
- **Cavaridge Adjusted Score:** Pulls Microsoft Secure Score and Google Workspace Security Health data, then applies compensating control adjustments for third-party tools (SentinelOne, Duo, Proofpoint, etc.) that native vendor scores penalize.
- Config-driven compensating controls catalog with auto-detection via tenant-intel signals and manual MSP overrides with audit trail.
- SecurityAdvisor agent for gap prioritization and what-if analysis.

-----

## CVG-CAVALIER (Cavalier Partners — Channel GTM Platform)

- Architecture: `docs/architecture/CVG-CAVALIER-ARCH-v1.0.md`
- PSA-Core Spec: `docs/architecture/CVG-PSA-CORE-v1.0.md`
- Connector Framework: `docs/architecture/CVG-CONNECTOR-FRAMEWORK-v1.0.md`
- GTM Strategy: `docs/architecture/CVG-CAVALIER-GTM-v1.0.docx` (reference only, not a code spec)
- **“Bring your RMM, we handle everything else”** positioning.
- Three-stream revenue: per-tech/mo ($149–$349) + per-client + premium modules.
- Partner tiers: Starter / Professional / Enterprise.
- Native PSA-lite module distributed across `psa-core`, Midas, Core, Astra, Spaniel.
- NinjaOne + HaloPSA connectors Phase 1 (Q2 2026), Atera + Syncro Phase 2 (Q3), CW Automate + Datto Phase 3 (Q4).
- Migration: `migrations/001_cavalier_partners.sql` — all PSA-lite and connector tables, enums, indexes, RLS enablement.

### Cavalier Packages

|Package                        |Path                           |Description                                                                     |
|-------------------------------|-------------------------------|--------------------------------------------------------------------------------|
|`@cavaridge/psa-core`          |`packages/psa-core/`           |Shared PSA schemas (Drizzle), SLA/Ticket/Billing/Dispatch engines, BullMQ queues|
|`@cavaridge/connector-core`    |`packages/connector-core/`     |Base connector interfaces, registry, sync log schema, queue definitions         |
|`@cavaridge/connector-ninjaone`|`packages/connectors/ninjaone/`|NinjaOne RMM connector (Phase 1)                                                |
|`@cavaridge/connector-halopsa` |`packages/connectors/halopsa/` |HaloPSA PSA connector (Phase 1)                                                 |
|`@cavaridge/connector-guardz`  |`packages/connectors/guardz/`  |Guardz security connector (Phase 2)                                             |
|`@cavaridge/connector-atera`   |`packages/connectors/atera/`   |Atera RMM connector (Phase 2)                                                   |
|`@cavaridge/connector-syncro`  |`packages/connectors/syncro/`  |Syncro RMM connector (Phase 2)                                                  |

### Cavalier Build Standards

1. All PSA entities use `tenant_id` for Supabase RLS. Never query without tenant scoping.
1. Connectors implement interfaces from `@cavaridge/connector-core`. Never import platform-specific types into consuming apps.
1. All connector credentials go through Doppler (staging/prod) or encrypted tenant config (dev). Never in `.env` or plaintext DB columns.
1. All LLM calls for ticket enrichment route through OpenRouter per existing standards. Traced via Langfuse.
1. BullMQ queues use the names defined in `psa-core/src/queues/index.ts` and `connector-core/src/registry.ts`. Do not create ad-hoc queue names.
1. Connector sync operations must log to `connector_sync_logs` via the schema in connector-core.
1. Ticket numbers are tenant-scoped sequential: `TKT-NNNNN`. Invoice numbers include year: `INV-YYYY-NNNNN`. Contract numbers: `CTR-NNNNN`.

-----

## CVG-PVT — The Paw Vault

**Division:** Cavaridge Puppies (consumer division of Cavaridge, LLC)
**Store:** `apps/pawvault/` (mobile) + `apps/pawvault-web/` (web)
**Status:** Planned — V1 MVP
**Platform:** iOS + Android (Expo), Web (React + Vite)
**Spec:** `docs/architecture/CVG-PVT-SPEC-v1.0-20260327.md`
**Runbook:** `runbooks/CVG-PVT-RB-v1.0.0-20260327.md` (generate before first build sprint)

### What It Is

Family-first freemium consumer app documenting the complete life of a family’s pets — health records, memories, milestones, and family sharing — from first day through the rainbow bridge.

**Tagline:** *“Their story, from first day to last.”*

### Isolation from Platform — CRITICAL

CVG-PVT is **fully standalone**. It is NOT a UTM tenant. It does NOT use the platform Supabase instance.

|Concern |Value                                                                               |
|--------|------------------------------------------------------------------------------------|
|Supabase|**Dedicated consumer instance** — separate project, separate connection string      |
|Auth    |Custom family vault RBAC (Owner / Co-Owner / Caregiver / Viewer / Teen / Child View)|
|Billing |**RevenueCat** (iOS IAP + Android IAP + Stripe web)                                 |
|Railway |Independent service — NOT on the platform cluster                                   |
|AI      |Ducky Intelligence API (CVG-RESEARCH) only — via Ducky → Spaniel → OpenRouter       |

### Key Architecture Decisions

- **Vault = unit of data ownership** — all data belongs to the vault, not the user; enables ownership transfer without migration
- **Version control on all health records** — every edit creates a new immutable version; no record is ever destroyed
- **COPPA compliance** — users under 13 have no independent account; teen accounts (13–17) require parental consent flow
- **Generational ownership transfer** — child grows up alongside pet; at 18, complete digital vault transfers to them via 7-day confirmed transfer flow
- **Memorial archival guarantee** — vaults for deceased pets enter read-only mode; data retained indefinitely regardless of subscription status
- **No commercial messaging in memorial mode** — upgrade prompts and upsell are suppressed when a pet is marked as deceased

### Tiers

- **Free:** $0 — 2 pets, 2 family members, 50 photos, basic health tracking
- **Plus:** $4.99/mo or $34.99/yr — unlimited pets, 10 members, unlimited storage, PDF export, version history
- **Premium:** $8.99/mo or $69.99/yr — everything in Plus + Ducky AI insights, breed prompts, teen accounts, ownership transfer, printable books
- **Lifetime:** $129.99 one-time — everything in Premium, transferable with pet ownership

### Packages

- `packages/pawvault-ui/` — warm design system (Tailwind + Radix, Vault Stone + Amber Gold palette)
- `packages/pawvault-ai/` — Ducky Intelligence client wrapper for CVG-PVT

### Critical Rules

- **NEVER** make CVG-PVT a UTM tenant or connect it to the platform Supabase instance
- **NEVER** add DIT-specific logic to this app
- **NEVER** use “Ducky AI” — always “Powered by Ducky Intelligence”
- **NEVER** show upgrade prompts or commercial messaging in memorial mode
- **NEVER** store LLM keys in CVG-PVT — all AI routes through Ducky → Spaniel → OpenRouter
- **NEVER** destroy health record versions — always append new version, preserve history

-----

## Shared Platform Packages

### @cavaridge/tenant-intel

- Architecture: `docs/architecture/TENANT-INTEL-ARCH-v1.0.0-20260313.md`
- Ingests M365/Google Workspace tenant data (metadata, config, usage analytics, security posture — NOT content).
- Three agents: TenantGraph, UsagePattern, ConfigDrift.
- Consumed by: Meridian, Midas, Astra, HIPAA, AEGIS, Ducky.
- Content ingestion (email/doc bodies) explicitly deferred to Phase 2 behind compliance gate.

### @cavaridge/compliance-gateway (v2.11)

- Spec: `docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md` §4
- Cross-vertical middleware enforcing PHI/PII/CHD detection and handling. All vertical agent LLM calls MUST pass through this gateway before reaching Spaniel.
- **Detectors:** phi-detector (HIPAA 18 Safe Harbor identifiers), pii-detector (SSN, DL, passport), chd-detector (PCI PAN, CVV, track data).
- **Transformers:** deidentifier (Safe Harbor), tokenizer (reversible), redactor (irreversible).
- **Audit logger:** Immutable trail in Supabase + pgaudit. Per-vertical retention: Healthcare 6yr, Legal 10yr, Financial 7yr, MSP 3yr.
- **Model guard:** Enforces BAA-covered model selection for HIPAA tenants (Azure OpenAI ZDR or AWS Bedrock). PCI tenants: CHD redacted pre-LLM. Legal privilege: controlled environment only.

### @cavaridge/knowledge (v2.11)

- Spec: `docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md` §6
- Multi-tenant RAG with vertical namespaces. Supabase pgvector (HNSW index) + BM25 (tsvector) hybrid retrieval.
- 5-stage pipeline: query understanding → HyDE expansion → parallel hybrid retrieval → reciprocal rank fusion → neural re-ranking.
- RLS-enforced tenant isolation on `knowledge_chunks` table.
- Platform-level knowledge pre-seeded with HIPAA/PCI/SOX/CMS/NIST regulatory text, auto-refreshed via scheduled BullMQ jobs.

### @cavaridge/agent-memory (v2.11)

- Spec: `docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md` §7
- 4-tier persistence aligned to UTM hierarchy: Platform (PostgresStore, permanent), MSP (RedisStore, 1yr TTL), Client (RedisStore, 6mo TTL), Session (PostgresSaver, 30d TTL).
- Exposes `createSearchMemoryTool` and `createManageMemoryTool` to agents.
- Hot-path inline writes for critical facts; background BullMQ jobs for summarization/dedup.

### @cavaridge/mcp (v2.11)

- Spec: `docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md` §3.6
- MCP (Model Context Protocol) server implementation. JSON-RPC 2.0.
- Exposes Cavaridge platform capabilities as MCP tools consumable by any MCP-compatible client (Claude Desktop, Cursor, custom agents).
- Browser automation tools scoped per tenant via UTM. All tool invocations authenticated and tenant-scoped.

### @cavaridge/fhir (v2.11)

- Spec: `docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md` §5.3
- FHIR R4 connector interface + EHR-specific adapters (Epic, Oracle Health/Cerner, athenahealth, eClinicalWorks).
- SMART on FHIR OAuth 2.0 (PKCE required, backend services via client_credentials with JWT assertion).
- `FHIRNormalizer` maps EHR-specific extensions to common internal model.
- Da Vinci Implementation Guide support: CRD (Coverage Requirements Discovery), DTR (Documentation Templates and Rules), PAS (Prior Authorization Support).

-----

## Database — New Tables (v2.11)

Tables added by DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC v1.0:

|Table                   |Schema|RLS                |Purpose                                                                                                           |
|------------------------|------|-------------------|------------------------------------------------------------------------------------------------------------------|
|`vertical_agent_configs`|public|Platform Admin only|VerticalAgentConfig records — systemPrompt, tools, guardrails, knowledge namespaces, compliance rules per vertical|
|`knowledge_chunks`      |public|tenant_id          |RAG knowledge layer — pgvector embeddings (HNSW), tsvector BM25, vertical namespace, source tracking              |
|`compliance_controls`   |public|Platform Admin     |Unified cross-vertical control matrix mapping controls to HIPAA/PCI/SOX/Legal frameworks                          |
|`compliance_audit_log`  |public|tenant_id          |Immutable audit trail for Compliance Gateway events (per-vertical retention policies)                             |
|`browser_tasks`         |public|tenant_id          |BullMQ job metadata for CVG-BROWSE task tracking, audit, and result delivery                                      |

-----

## Architecture Documents

|Document                                           |Path                                                                      |Status              |
|---------------------------------------------------|--------------------------------------------------------------------------|--------------------|
|Agent-First Platform Architecture                  |`docs/architecture/CVG-AGENT-FIRST-PLATFORM-ARCHITECTURE-v1.docx`         |APPROVED 2026-03-13 |
|Architecture Addendum A — Three-Tier Agent Model   |`docs/architecture/CVG-ARCH-ADDENDUM-A-v1.0.docx`                         |APPROVED 2026-03-15 |
|Architecture Addendum B — Seven Enhancements       |`docs/architecture/CVG-ARCH-ADDENDUM-B-v1.docx`                           |APPROVED 2026-03-16 |
|UTM Conformance Specification                      |`docs/architecture/CVG-UTM-CONFORMANCE-v1.0.0-20260315.md`                |APPROVED 2026-03-15 |
|Spaniel Architecture                               |`docs/architecture/CVG-AI-ARCH-v1.0.0-20260310.md`                        |APPROVED            |
|Ducky Architecture                                 |`docs/architecture/CVG-RESEARCH-ARCH-v1.0.0-20260310.md`                  |APPROVED            |
|Ducky Agentic Architecture                         |`docs/architecture/CVG-RESEARCH-AGENTIC-ARCHITECTURE-v1.0.md`             |APPROVED            |
|Ducky Agentic Roadmap                              |`docs/architecture/CVG-AGENTIC-ROADMAP-v1.0.md`                           |APPROVED            |
|**Ducky Intelligence Multi-Vertical Spec**         |`docs/architecture/DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md`        |**DRAFT 2026-03-27**|
|AEGIS Architecture (Original)                      |`docs/architecture/CVG-AEGIS-ARCH-v1.0.0-20260314.md`                     |APPROVED            |
|AEGIS Browser Security Spec                        |`docs/architecture/CVG-AEGIS-BROWSER-SECURITY-v1.0.md`                    |APPROVED 2026-03-16 |
|AEGIS Competitive Analysis                         |`docs/architecture/CVG-AEGIS-COMPETITIVE-ANALYSIS-v1.0.md`                |APPROVED 2026-03-16 |
|AEGIS Identity Access Review Spec                  |`docs/architecture/CVG-AEGIS-IDENTITY-REVIEW-v1.0.md`                     |DRAFT 2026-03-24    |
|AEGIS IAR Addendum A — Subscription Intelligence   |`docs/architecture/CVG-AEGIS-IAR-ADDENDUM-A-v1.0.md`                      |APPROVED 2026-03-26 |
|Forge Product Brief                                |`docs/architecture/CVG-FORGE-PRODUCT-BRIEF-v1.0.md`                       |APPROVED            |
|Forge Architecture                                 |`docs/architecture/CVG-FORGE-ARCH-v1.0.md`                                |APPROVED            |
|Forge Roadmap                                      |`docs/architecture/CVG-FORGE-ROADMAP-v1.0.md`                             |APPROVED            |
|SoW Master Spec v2.3                               |`docs/architecture/SOW-MASTER-SPEC-v2_3.md`                               |LOCKED 2026-03-25   |
|Tenant-Intel Architecture                          |`docs/architecture/TENANT-INTEL-ARCH-v1.0.0-20260313.md`                  |APPROVED            |
|Midas Security Scoring Addendum                    |`docs/architecture/CVG-MIDAS-SECURITY-SCORING-ADDENDUM-v1.0.0-20260313.md`|APPROVED            |
|Cavalier Partners Architecture                     |`docs/architecture/CVG-CAVALIER-ARCH-v1.0.md`                             |APPROVED 2026-03-16 |
|Cavalier Partners GTM                              |`docs/architecture/CVG-CAVALIER-GTM-v1.0.docx`                            |APPROVED            |
|PSA-Core Specification                             |`docs/architecture/CVG-PSA-CORE-v1.0.md`                                  |APPROVED 2026-03-16 |
|Connector Framework Spec                           |`docs/architecture/CVG-CONNECTOR-FRAMEWORK-v1.0.md`                       |APPROVED            |
|Brain Architecture                                 |`docs/architecture/CVG-BRAIN-ARCH-v1.0.docx`                              |APPROVED            |
|Brain Addendum A (Integration + Model Intelligence)|`docs/architecture/CVG-BRAIN-ADDENDUM-A-v1.0.docx`                        |APPROVED            |
|Ducky Character Design Reference                   |`docs/branding/Ducky-Character-Design-Reference-v1.0.docx`                |APPROVED            |
|Ducky Intelligence Personality Spec                |`docs/branding/DUCKY-INTELLIGENCE-PERSONALITY-SPEC-v1.0.md`               |APPROVED            |
|Master Platform Build Spec                         |`docs/architecture/CVG-PLATFORM-BUILD-SPEC-v1.0.docx`                     |APPROVED 2026-03-18 |
|The Paw Vault Architecture Spec                    |`docs/architecture/CVG-PVT-SPEC-v1.0-20260327.md`                         |APPROVED 2026-03-27 |

-----

## Versioning

- Runbook format: `[AppCode]-RB-v[Major].[Minor].[Patch]-[YYYYMMDD]`
- Runbooks regenerated on every Major or Minor version increment.
- Runbooks re-attached to Claude Projects on every regeneration.
- Semantic versioning for all packages and apps.
- **File naming:** Avoid decimal version numbers before file extensions (use v1, v2, v3 — not v1.0 before an extension).

|Increment|When                                                                |
|---------|--------------------------------------------------------------------|
|**Major**|Fundamental architecture change — new data model, auth provider swap|
|**Minor**|New feature, module, or standard added                              |
|**Patch**|Corrections, clarifications, minor updates                          |

-----

## Labor & Pricing Reference

For SoWs, diligence reports, or cost estimates:

- Standard: $185/hr | Senior: $225/hr | Emergency: $285/hr
- Hardware margins: 15–25% | Licensing margins: 10%
- All pricing presented as budgetary estimates.
- Equipment/licensing costs researched at assessment time — never hardcoded.

-----

## Communication Standards

- Author name: **“Benjamin Posner”** (never “Ben Posner” or “Benjamin Rogan”)
- Company: Cavaridge, LLC
- Evidence tagging: OBSERVED / REPRESENTED / UNVERIFIED
- Risk color-coding: Critical (red) / High (orange) / Medium (yellow) / Low (green)
- Tone: direct, professional, no filler
- Call out assumptions explicitly
- Use structured formats: tables, checklists, numbered steps

-----

## New App Launch Checklist

**Governance**

- [ ] App registered in this file’s App Registry before any code written
- [ ] Architecture doc created in `docs/architecture/` if app has significant scope
- [ ] Initial runbook generated at v1.0.0

**GitHub**

- [ ] Directory created under `apps/<app-name>/`
- [ ] LICENSE file references Cavaridge, LLC ownership
- [ ] `.env` added to `.gitignore` before first commit

**Railway**

- [ ] Railway service created with correct root directory and watch paths
- [ ] Environment variables configured (or synced from Doppler)

**Secrets**

- [ ] Doppler project created with dev/staging/production environments
- [ ] OpenRouter sub-key created, scoped to this app, stored in Doppler
- [ ] Master Cavaridge OpenRouter key confirmed not referenced anywhere in code

**Architecture**

- [ ] Multitenancy scaffold in place (UTM) before any feature work begins *(platform apps only — CVG-PVT uses vault RBAC)*
- [ ] RBAC roles defined before any UI is built
- [ ] Light/dark/system theme wired on day one
- [ ] `llm.config.js` scaffolded with standard model routes before any AI feature is built
- [ ] DIT configured as a tenant record — not embedded in code *(platform apps only)*
- [ ] Ducky Intelligence branding wired (animation component + “Powered by Ducky Intelligence” footer)

**Agent Architecture**

- [ ] Domain agents identified and mapped to app requirements
- [ ] Functional agents parameterized for app-specific use cases
- [ ] Product-specific agents scoped (if applicable)
- [ ] All agent executions routed through Spaniel
- [ ] Langfuse tracing configured
- [ ] If vertical agent: VerticalAgentConfig record created, Compliance Gateway integration verified

**Consumer Apps (CVG-PVT only)**

- [ ] Dedicated Supabase consumer instance provisioned (NOT cavaridge-platform)
- [ ] RevenueCat project created with product IDs registered for iOS + Android + Web
- [ ] COPPA compliance verified (no independent accounts for under-13)
- [ ] Parental consent flow implemented for teen accounts (13–17)
- [ ] Memorial mode: upgrade prompts confirmed suppressed when pet is deceased
- [ ] Full vault ZIP export available to all tiers (data portability guarantee)

-----

## Cross-App Integration Map

|Source App                   |→ Target App      |Data Flow                                                                                                |
|-----------------------------|------------------|---------------------------------------------------------------------------------------------------------|
|CVG-AEGIS                    |→ CVG-MIDAS       |Security findings + Cavaridge Adjusted Score → QBR line items                                            |
|CVG-AEGIS                    |→ CVG-MER         |Posture scores → M&A due diligence                                                                       |
|CVG-AEGIS                    |→ CVG-HIPAA       |Bidirectional compliance state                                                                           |
|CVG-AEGIS                    |→ CVG-CAELUM      |Remediation → SoW drafts                                                                                 |
|CVG-MIDAS                    |→ CVG-CAELUM      |Roadmap items → SoW generation                                                                           |
|CVG-HIPAA                    |→ CVG-MER         |Compliance gaps → acquisition risk                                                                       |
|tenant-intel                 |→ CVG-MIDAS       |Tenant data → security scoring                                                                           |
|tenant-intel                 |→ CVG-ASTRA       |Usage data → license optimization                                                                        |
|CVG-AEGIS (IAR)              |→ CVG-ASTRA       |Identity posture, license waste → vCIO reports, license optimization, exec summaries                     |
|CVG-AEGIS (IAR)              |→ CVG-CAVALIER    |Freemium IAR as co-branded lead-gen; IAR reviews as partner demo tool                                    |
|tenant-intel                 |→ CVG-HIPAA       |Config data → compliance checks                                                                          |
|tenant-intel                 |→ CVG-AEGIS       |M365/GWS config → Cavaridge Adjusted Score inputs                                                        |
|Cloudflare GW                |→ CVG-AEGIS       |DNS logs → telemetry correlation + DNS compliance scoring                                                |
|CVG-AI (Spaniel)             |→ ALL             |LLM gateway for all AI calls                                                                             |
|CVG-RESEARCH (Ducky)         |→ ALL             |AI reasoning API, conversation state, multi-vertical supervisor — including CVG-PVT via consumer endpoint|
|CVG-BROWSE                   |→ Vertical Agents |Browser automation for legacy portal interactions (payer portals, court systems, banking, vendor portals)|
|@cavaridge/compliance-gateway|→ CVG-AI (Spaniel)|PHI/PII/CHD-sanitized prompts with compliance context (model whitelist, audit metadata)                  |
|@cavaridge/knowledge         |→ Vertical Agents |Tenant-scoped + vertical-scoped RAG retrieval for domain-specific reasoning                              |
|@cavaridge/fhir              |→ Healthcare Agent|FHIR R4 data (Patient, Encounter, Coverage, ClaimResponse) from EHR systems                              |

-----

## Revision History

|Version|Date      |Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|-------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|1.0    |2026-03   |Initial monorepo CLAUDE.md (Vercel/Replit era)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|2.0    |2026-03-10|Railway migration, Claude Code CLI replaces Replit Agent, CVG-CORE-DEV-v2.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|2.1    |2026-03-12|Agent-first architecture approved, Spaniel/Ducky architecture docs, build order locked, SoW spec v2.1 locked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
|2.2    |2026-03-14|CVG-AEGIS added (Security Posture & Risk Intelligence), build order updated (AEGIS after HIPAA), app registry expanded to 12 apps, cross-app integration map added, **Universal Tenant Model codified** (4-tier hierarchy: Platform → MSP → Client → Site/Prospect, shared via packages/auth/, standard RBAC roles defined)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|2.3    |2026-03-15|UTM Conformance Specification added, per-app migration requirements defined for all 12 apps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|2.4    |2026-03-15|**Architecture Addendum A** integrated: three-tier agent model (12 domain agents, 7 functional agents, product agents), connector framework expanded 10→25, 4-phase build timeline. **CVG-FORGE added** (13th app).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|2.5    |2026-03-15|AEGIS architecture expanded: ConnectSecure, AEGIS Probe, two-tier pentesting. **Ducky Intelligence branding locked** — never “Ducky AI.”                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
|2.6    |2026-03-16|**CVG-CAVALIER added** (14th app). psa-core and connector-core packages, 5 connector stubs. **Addendum B** (7 architecture enhancements). App registry at 14 apps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|2.7    |2026-03-16|**AEGIS expanded to Managed Browser Security Platform.** Chromium MV3 extension, Cloudflare Gateway DNS filtering, Cavaridge Adjusted Score, 4-phase AEGIS build timeline, pricing tiers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|2.8    |2026-03-18|Agent Simulation Engine, Blueprint Library, CVGBuilder v3 Plan Mode, Master Platform Build Spec v1.0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|2.9    |2026-03-24|**AEGIS IAR module added.** Two-tier model, deterministic risk flag engine (8 flags), Contextual Intelligence Engine (3 layers), Astra cross-sell.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|2.10   |2026-03-26|**IAR Subscription Intelligence (Addendum A).** 7 subscription-level flags (15 total), Subscription Overview tab, cost analysis, migration 015. SoW Master Spec v2.3 LOCKED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
|2.11   |2026-03-27|**Ducky Intelligence Multi-Vertical Agent System.** CVG-BROWSE added (15th app — Playwright + Browserless, BullMQ, MCP server). 6 new packages: compliance-gateway, knowledge, agent-memory, mcp, fhir, agents (vertical subgraphs). Vertical Agent Architecture with Ducky supervisor router, VerticalAgentConfig metadata-driven specialization, healthcare/legal/financial/msp verticals. Compliance Gateway mandatory for all vertical agent LLM calls. 5 new database tables. 4-phase multi-vertical build timeline (18 sprints). Spec: `DUCKY-INTELLIGENCE-MULTI-VERTICAL-SPEC-v1_0.md`.                                                                                                                                                                                                                |
|2.12   |2026-03-27|**CVG-PVT added** (The Paw Vault — 16th app). Cavaridge Puppies consumer division. Fully standalone: dedicated consumer Supabase instance, independent Railway service, custom family vault RBAC (Owner/Co-Owner/Caregiver/Viewer/Teen/Child View), RevenueCat billing. Only platform dependency: Ducky Intelligence API (CVG-RESEARCH) via Ducky → Spaniel → OpenRouter. `pawvault-ui` and `pawvault-ai` packages added. Consumer track build note added (parallel to platform). Pet Health Insights product agent added to Layer 3. UTM section clarified: does not apply to CVG-PVT. New App Launch Checklist: consumer app section added. Ducky cross-app integration updated to include CVG-PVT consumer endpoint. Architecture doc registered: `CVG-PVT-SPEC-v1.0-20260327.md`. App registry at 16 apps.|

-----

*This document is the governing reference for all Cavaridge application development. Cavaridge, LLC is the sole IP owner.*