# Cavaridge App Build Prompts

**Document Code:** CVG-BUILD-PROMPTS-v1.0.0-20260324  
**Status:** Spaniel (running/done), Ducky (running/done). Everything below is queued.  
**Usage:** Paste each prompt into terminal as `claude --remote -p "..." --allowedTools ...`  
**Rule:** Run in order. Don't start an app until its dependencies are done.

**Allowed tools (same for all — copy this after every prompt):**
```
--allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 3 — Caelum (CVG-CAELUM) — SoW Builder

**Depends on:** Ducky (for AI-powered SoW content generation)

```bash
claude --remote -p "Read CLAUDE.md, docs/architecture/SOW-MASTER-SPEC-v2_2.md, and all docs/architecture/ files first. Caelum (CVG-CAELUM) is the SoW Builder — third in build order. Auth is wired. Ducky is built.

BUILD CAELUM TO SPEC:
1. SoW document engine — programmatic SoW generation that STRICTLY follows SoW Spec v2.2 (8 sections, LOCKED). Implement the SowDocumentV2 TypeScript interface with normalizeSowJson() backward-compatibility layer.
2. 8-section structure enforcement — Summary, Proposed Solution (numbered subs), Prerequisites, Project Mgmt (3 MANDATORY PM tasks: project plan with milestones; regular updates via preferred method; remove old docs and update to reflect new configs), Project Outline, Caveats/Risks (Exclusions/Assumptions/Risk table/Change Control), Completion Criteria, Estimated Labor Hours (Role|Scope|Hour ranges ONLY — NO pricing). Approval section excluded by default.
3. Formatting — Arial font, H1 #2E5090, H2 #1A1A1A, table headers blue-bg/white-text, #F2F6FA row banding, #BFBFBF borders. Bullets default list style — numbered/lettered only when sequence matters.
4. AI-powered content generation — integrate with Ducky (POST /v1/app-query with app_code=CVG-CAELUM) for intelligent SoW section drafting. User provides project context, Ducky helps generate section content.
5. SoW CRUD API — Express 5 endpoints: POST /v1/sows (create), GET /v1/sows (list), GET /v1/sows/:id, PUT /v1/sows/:id, DELETE /v1/sows/:id, POST /v1/sows/:id/generate-docx (export to DOCX). All tenant-scoped, MSP Admin + MSP Tech.
6. Template system — reusable SoW templates per project type (network deployment, Citrix migration, M365 migration, etc.). CRUD for templates. Templates are tenant-scoped.
7. DOCX export — generate .docx files matching the SoW Spec v2.2 formatting exactly. Use docx-js or equivalent.
8. Version history — track SoW revisions. Each save creates a version. Diff between versions.
9. Tests — unit tests for SowDocumentV2 interface validation, section structure enforcement, DOCX generation.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase for SoW storage — RLS enforced, tenant-scoped
- All AI calls go through Ducky, never direct to Spaniel or OpenRouter
- No hardcoded client data — no DIT-specific values
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(caelum): implement SoW builder with spec v2.2 compliance and Ducky integration. Save build report to logs/caelum-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 4 — Meridian (CVG-MER) — M&A IT Intelligence Platform

**Depends on:** Ducky, tenant-intel package

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Meridian (CVG-MER) is the M&A IT Intelligence Platform — fourth in build order. Auth is wired. Ducky is built.

BUILD MERIDIAN TO SPEC:
1. IT due diligence framework — implement the 12-section assessment order. Evidence tagging: OBSERVED, REPRESENTED, UNVERIFIED. Risk classification system with severity levels.
2. Tenant-intel integration — consume @cavaridge/tenant-intel for Microsoft 365 and Google Workspace tenant ingestion. Display tenant health, license counts, security posture data.
3. Assessment CRUD API — Express 5 endpoints for creating, managing, and completing IT due diligence assessments. POST /v1/assessments, GET /v1/assessments, GET /v1/assessments/:id, PUT /v1/assessments/:id, POST /v1/assessments/:id/sections/:sectionId. All tenant-scoped, MSP Admin + MSP Tech.
4. Evidence collection — structured evidence capture per assessment section. Support file attachments (references only — store metadata, not files), notes, screenshots, and interview records.
5. Risk matrix — auto-generated risk matrix from assessment findings. Severity (Critical/High/Medium/Low) × Likelihood. CapEx estimates per finding.
6. Report generation — generate full IT due diligence DOCX reports from assessment data. Include risk matrices, evidence summaries, and CapEx projections.
7. AI-powered analysis — integrate with Ducky (app_code=CVG-MER) for intelligent risk analysis, finding summarization, and recommendation generation.
8. Dashboard — API endpoints to power a dashboard showing assessment status, risk distribution, and portfolio-level metrics across all assessments for an MSP.
9. Tests — unit tests for risk classification, evidence tagging validation. Integration tests for assessment CRUD.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced, tenant-scoped
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(meridian): implement M&A IT intelligence platform with due diligence framework. Save build report to logs/meridian-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 5 — HIPAA (CVG-HIPAA) — HIPAA Risk Assessment Toolkit

**Depends on:** Ducky

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. HIPAA (CVG-HIPAA) is the HIPAA Risk Assessment Toolkit — fifth in build order. Auth is wired. Ducky is built.

BUILD HIPAA TO SPEC:
1. HIPAA Security Rule mapping — implement all HIPAA Security Rule safeguards (Administrative, Physical, Technical) as structured assessment sections. Map to 45 CFR 164.308, 164.310, 164.312.
2. Risk assessment engine — guided workflow for completing a HIPAA risk assessment. Each safeguard has required/addressable implementation specifications. Score each as Compliant, Partially Compliant, Non-Compliant, or Not Applicable.
3. Assessment CRUD API — POST /v1/assessments, GET /v1/assessments, GET /v1/assessments/:id, PUT /v1/assessments/:id, POST /v1/assessments/:id/safeguards/:id. All tenant-scoped, MSP Admin + MSP Tech.
4. Gap analysis — auto-generate gap analysis from assessment scores. Prioritize by risk severity. Map gaps to remediation recommendations.
5. Remediation tracking — track remediation tasks per gap. Status lifecycle: Identified → In Progress → Remediated → Verified. Due dates and assignees.
6. Report generation — generate HIPAA risk assessment reports as DOCX. Include executive summary, safeguard-by-safeguard results, gap analysis, remediation plan, and risk register.
7. AI-powered recommendations — integrate with Ducky (app_code=CVG-HIPAA) for intelligent remediation recommendations and policy language generation.
8. Compliance timeline — track assessment history over time. Show compliance posture trending.
9. Tests — unit tests for safeguard scoring, gap analysis generation. Integration tests for assessment workflow.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced, tenant-scoped
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(hipaa): implement HIPAA risk assessment toolkit with Security Rule mapping. Save build report to logs/hipaa-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 6 — AEGIS (CVG-AEGIS) — Security Posture & Risk Intelligence Platform

**Depends on:** Ducky, tenant-intel

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. AEGIS (CVG-AEGIS) is the Security Posture & Risk Intelligence Platform — sixth in build order. Auth is wired. Competes with ThreatMate and SecurityScorecard.

BUILD AEGIS TO SPEC:
1. Cavaridge Adjusted Score — 0-100 composite security metric. This is the key differentiator with no competitive equivalent. Inputs: vulnerability scan results, configuration compliance, endpoint protection status, email security, identity/access posture. Adjustable weights per category.
2. Compensating controls engine — SentinelOne, Duo, Proofpoint, and other third-party tools suppress or downgrade risk flags. If a client has Duo MFA, MFA-related findings are adjusted down. Configurable per tenant.
3. ConnectSecure integration — ingest scan data from ConnectSecure API. Map to internal risk model.
4. Identity Access Review (IAR) module — freemium tier: base severity flags only. Full tier: Contextual Intelligence Engine with 3 layers. L1: compensating controls adjust flags. L2: business context (M&A, contractor-heavy, vertical). L3: report tone (posture-based framing). CRITICAL: never frame findings as MSP negligence. Astra cross-sell for vCIO reporting/license optimization.
5. Freemium scan landing page — public-facing page for lead gen. No auth required. Quick external scan produces a teaser report with limited findings. Full report requires signup.
6. Security posture dashboard API — endpoints for MSP-level and client-level security posture views. Trend over time. Peer comparison (anonymized).
7. AEGIS Probe — define the data model and API endpoints for Raspberry Pi appliance that does on-site scanning. Probe registers with AEGIS, pushes scan results.
8. Pen test tiers — two-tier model: Tier 1 (Nuclei-based automated scanning), Tier 2 (Horizon3.ai NodeZero integration). API endpoints to initiate, track, and report on both tiers.
9. AI-powered analysis — integrate with Ducky (app_code=CVG-AEGIS) for risk narrative generation, executive summary writing, and remediation prioritization.
10. Report generation — DOCX/PDF security posture reports with Adjusted Score, finding details, remediation roadmap.
11. Tests — unit tests for Adjusted Score calculation, compensating controls engine. Integration tests for IAR module.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced, tenant-scoped
- Redis for score caching and scan job queues (BullMQ)
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(aegis): implement security posture platform with Adjusted Score, IAR, and pen test tiers. Save build report to logs/aegis-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 7 — Midas (CVG-MIDAS) — IT Roadmap / QBR Platform

**Depends on:** Ducky, tenant-intel, AEGIS (for Adjusted Score cross-reference)

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Midas (CVG-MIDAS) is the IT Roadmap / QBR Platform — seventh in build order. Auth is wired.

BUILD MIDAS TO SPEC:
1. Cavaridge Adjusted Score integration — consume AEGIS Adjusted Score for each client. Display score trends. Account for compensating third-party controls (SentinelOne, Duo, Proofpoint) that native vendor scoring misses. This solves a known MSP pain point.
2. Tenant-intel integration — consume @cavaridge/tenant-intel for M365/Google Workspace data. License utilization, security configuration status, user metrics.
3. QBR report engine — Quarterly Business Review report generation. Sections: Executive Summary, Security Posture (Adjusted Score + trend), Infrastructure Health, License Optimization Opportunities, Roadmap Progress, Recommendations. Generate as DOCX.
4. IT roadmap builder — multi-year IT roadmap per client. Projects with timelines, budgets, priority, dependencies. Roadmap visualization data (API returns structured data for frontend Gantt/timeline rendering).
5. Budget planning — CapEx and OpEx projections per roadmap item. Roll-up by quarter and year. Compare planned vs actual.
6. Recommendation engine — AI-powered (via Ducky, app_code=CVG-MIDAS) recommendations based on security posture, license utilization, and infrastructure age. Prioritized by impact and effort.
7. CRUD API — endpoints for roadmaps, projects, QBR reports, budgets. All tenant-scoped, MSP Admin + MSP Tech.
8. Dashboard API — MSP-level portfolio view: all clients, their Adjusted Scores, roadmap progress, upcoming QBR dates.
9. Tests — unit tests for budget rollup calculations, Adjusted Score integration. Integration tests for QBR generation.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced, tenant-scoped
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(midas): implement IT roadmap and QBR platform with Adjusted Score integration. Save build report to logs/midas-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 8 — Vespar (CVG-VESPAR) — Cloud Migration Planning

**Depends on:** Ducky, tenant-intel

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Vespar (CVG-VESPAR) is the Cloud Migration Planning platform — eighth in build order. Auth is wired.

BUILD VESPAR TO SPEC:
1. Migration assessment — structured assessment of current infrastructure for cloud readiness. Inventory: servers, applications, databases, network dependencies, integrations.
2. Migration strategy engine — classify workloads into migration strategies: Rehost, Replatform, Refactor, Repurchase, Retire, Retain (6 Rs). AI-assisted classification via Ducky (app_code=CVG-VESPAR).
3. Dependency mapping — capture application dependencies, network flows, and integration points. Flag migration blockers and risks.
4. Migration wave planning — group workloads into waves based on dependencies, complexity, and business priority. Timeline estimation per wave.
5. Cost modeling — estimate cloud costs (compute, storage, network, licensing) per workload. Compare current on-prem costs vs projected cloud costs. TCO analysis.
6. CRUD API — endpoints for migration assessments, workloads, waves, cost models. All tenant-scoped, MSP Admin + MSP Tech.
7. Report generation — migration readiness report as DOCX. Include inventory summary, strategy recommendations, wave plan, cost projections, risk register.
8. Tests — unit tests for cost modeling, workload classification. Integration tests for assessment CRUD.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced, tenant-scoped
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(vespar): implement cloud migration planning platform. Save build report to logs/vespar-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 9 — Ceres (CVG-CERES) — Nursing Toolkit

**Depends on:** Nothing (standalone, no backend)

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Ceres (CVG-CERES) is a free, public-access nursing toolkit. No login, no tenant gating, no RBAC, no backend. Pure client-side calculations. Exception to standard UTM/auth rules. A gift to the nursing community from Cavaridge.

BUILD CERES TO SPEC:
1. Welcome/landing page — lists all available tools with descriptions. Clean, professional, mobile-first design.
2. 60-Day Medicare Frequency Calculator — client-side tool. Input: start of care date, frequency ordered (e.g., 3W2 2W2 1W4). Output: visit schedule with dates, week numbers, and compliance check against Medicare 60-day episode window. Handle edge cases: holidays, weekends, recertification periods.
3. Home Health Over-Utilization Calculator — PDGM-based. Input: PDGM clinical grouping, functional level, comorbidity adjustment. Compare actual visit counts against expected utilization thresholds. Flag over-utilization risk with severity levels.
4. Mobile-first responsive design — field nurses run these tools on phones and tablets. Every tool must work perfectly on small screens. Large tap targets, readable fonts, no horizontal scrolling.
5. Bookmarkable URLs — each tool gets its own route that can be directly bookmarked and shared. No auth redirects.
6. Offline capability — tools should work without an internet connection once the page is loaded (all calculations are client-side).
7. Expand toolkit structure — create a plugin/component architecture that makes adding new nursing tools trivial. Each tool is a self-contained component with its own route.
8. Branding — subtle Cavaridge branding. Footer: Powered by Ducky Intelligence. Clean, trustworthy healthcare aesthetic.
9. Tests — unit tests for both calculators with known input/output pairs. Test edge cases for Medicare frequency parsing.

CONSTRAINTS:
- NO backend, NO auth, NO Supabase, NO API calls
- Pure client-side React/TypeScript
- Must be deployable as a static site
- Mobile-responsive is non-negotiable
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(ceres): implement nursing toolkit with Medicare and PDGM calculators. Save build report to logs/ceres-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 10 — Astra (CVG-ASTRA) — M365 License Optimization

**Depends on:** Ducky, tenant-intel

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Astra (CVG-ASTRA) is the M365 License Optimization platform — tenth in build order. Auth is wired. Has Microsoft Graph API integration (needs MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID).

BUILD ASTRA TO SPEC:
1. Microsoft Graph integration — connect to customer M365 tenants via Graph API. Pull: user license assignments, license usage/activity, available SKUs, group-based licensing, service plan details.
2. Tenant-intel integration — consume @cavaridge/tenant-intel for baseline M365 tenant data.
3. License waste detection — identify unused licenses (no sign-in for 30/60/90 days configurable), underutilized licenses (user has E5 but only uses E3 features), duplicate licenses, licenses assigned to disabled/deleted accounts.
4. Optimization recommendations — AI-powered (via Ducky, app_code=CVG-ASTRA) recommendations: downgrade opportunities, removal candidates, consolidation options. Calculate monthly/annual savings per recommendation.
5. vCIO reporting — cross-reference with AEGIS IAR data for combined security + license reporting. This is the IAR cross-sell path.
6. CRUD API — endpoints for tenant connections, license audits, recommendations, optimization plans. All tenant-scoped, MSP Admin + MSP Tech.
7. Report generation — M365 license optimization report as DOCX. Include current spend, waste identified, recommendations with projected savings, implementation plan.
8. Dashboard API — MSP portfolio view: all client tenants, total license spend, total identified savings, optimization status.
9. Tests — unit tests for waste detection algorithms, savings calculations. Integration tests with mocked Graph API responses.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced, tenant-scoped
- AI calls through Ducky only
- Microsoft Graph calls require proper OAuth2 token management per customer tenant
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(astra): implement M365 license optimization with Graph API integration. Save build report to logs/astra-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 11 — Brain (CVG-BRAIN) — Voice-First Knowledge Capture

**Depends on:** Ducky

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Brain (CVG-BRAIN) is the voice-first knowledge capture and recall platform — eleventh in build order. Auth is wired.

BUILD BRAIN TO SPEC:
1. Voice capture API — endpoints to receive audio transcriptions (from mobile/web clients). Process natural language into structured knowledge entries. POST /v1/captures (accepts text or audio transcript), GET /v1/captures.
2. Knowledge extraction — use Ducky (app_code=CVG-BRAIN) to extract structured data from raw voice/text input: entities (people, companies, systems, dates), action items, decisions, technical details. Tag and categorize automatically.
3. Knowledge graph — store extracted entities and relationships in Supabase. Entity types: Person, Organization, System, Process, Decision, Action Item. Relationships: owns, manages, connects_to, depends_on, decided_by.
4. Recall API — natural language query interface. POST /v1/recall with a question, get back relevant knowledge entries with context. Powers 'What did I capture about X?' queries. Uses Ducky for semantic search and answer synthesis.
5. Integration layer — 11 connectors design. Define connector interface and implement the first 3: Email (parse forwarded emails into knowledge), Calendar (extract meeting context), Notes (import from markdown/text). Remaining 8 connectors are interface stubs for future implementation.
6. Model Intelligence Engine — route different knowledge tasks to appropriate models via Ducky. Extraction tasks → high-accuracy model. Recall tasks → fast model. Summarization → balanced model.
7. CRUD API — standard endpoints for knowledge entries, entities, relationships, connectors. All tenant-scoped, MSP Admin + MSP Tech.
8. Tests — unit tests for knowledge extraction parsing, entity relationship mapping. Integration tests for capture-to-recall workflow.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced, tenant-scoped
- BullMQ + Redis for async knowledge processing
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(brain): implement voice-first knowledge capture with extraction and recall. Save build report to logs/brain-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 12 — Forge (CVG-FORGE) — Autonomous Content Creation

**Depends on:** Ducky

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Forge (CVG-FORGE) is the autonomous content creation platform — twelfth in build order. Auth is wired. Competes with SuperCool.com.

BUILD FORGE TO SPEC:
1. LangGraph.js 5-stage pipeline — implement the content creation pipeline: Stage 1 (Research & Outline), Stage 2 (Draft Generation), Stage 3 (Review & Refinement), Stage 4 (Formatting & Polish), Stage 5 (Export). Each stage is a LangGraph node with defined inputs/outputs.
2. Content types — support DOCX, PDF, static HTML as Phase 1 outputs. Each content type has its own export formatter in Stage 5.
3. Content CRUD API — POST /v1/content (create with type, topic, parameters), GET /v1/content, GET /v1/content/:id, PUT /v1/content/:id, DELETE /v1/content/:id, POST /v1/content/:id/regenerate (re-run pipeline), GET /v1/content/:id/status (pipeline progress). All tenant-scoped, MSP Admin + MSP Tech.
4. Template library — pre-built content templates: blog post, case study, white paper, email campaign, social media series, proposal, one-pager. Templates define structure, tone, and length parameters.
5. Brand voice — per-tenant brand voice configuration. Tone, vocabulary preferences, style guidelines. Injected into every pipeline run.
6. Pipeline observability — track each stage's status, duration, token usage, and intermediate outputs. Langfuse tracing via Ducky.
7. Batch generation — support generating multiple content pieces from a single brief (e.g., blog post + social media series + email from same topic).
8. AI integration — all LLM calls go through Ducky (app_code=CVG-FORGE). Each pipeline stage uses appropriate task_type for optimal model routing.
9. Tests — unit tests for pipeline stage transitions, template validation. Integration tests for end-to-end content generation with mocked Ducky.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM + LangGraph.js
- Supabase — RLS enforced, tenant-scoped
- BullMQ + Redis for pipeline job management
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(forge): implement content creation platform with LangGraph.js pipeline. Save build report to logs/forge-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 13 — Cavalier (CVG-CAVALIER) — Channel GTM Platform

**Depends on:** Ducky

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Cavalier (CVG-CAVALIER) is the Cavalier Partners channel GTM platform — thirteenth in build order. Auth is wired. Uses shared Supabase project cavaridge-platform with 16 tables and 9 roles.

BUILD CAVALIER TO SPEC:
1. Partner management — CRUD for channel partners (MSPs who resell or refer Cavaridge products). Partner profiles, tiers (Registered, Silver, Gold, Platinum), status lifecycle.
2. Deal registration — partners register deals to claim opportunities. Deal CRUD with status: Registered → Qualified → Won → Lost → Expired. Conflict detection (same prospect registered by multiple partners).
3. Partner portal API — endpoints partners use to manage their pipeline, view commissions, access marketing materials, and track performance. Role-gated: partners see only their own data.
4. Commission engine — define commission structures per product and partner tier. Track earned, pending, and paid commissions. Calculate based on deal close and payment status.
5. Marketing asset library — upload and categorize co-branded marketing materials. Partners can access and download assets appropriate for their tier.
6. Lead distribution — inbound leads assigned to partners based on geography, specialization, and tier. Round-robin with weighted priority.
7. Performance dashboard API — partner scorecards: deals registered, deals won, revenue generated, commission earned, certification status. MSP Admin view of all partners.
8. AI-powered partner matching — via Ducky (app_code=CVG-CAVALIER), match inbound prospects to best-fit partners based on vertical expertise, geography, and capacity.
9. Tests — unit tests for commission calculations, deal conflict detection, lead distribution. Integration tests for deal lifecycle.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase cavaridge-platform project — RLS on all 16 tables, 9 roles configured
- AI calls through Ducky only
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(cavalier): implement channel GTM platform with partner management and deal registration. Save build report to logs/cavalier-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## App 14 — Core (CVG-CORE) — Platform Administration

**Depends on:** All apps (this is the control plane)

```bash
claude --remote -p "Read CLAUDE.md and all docs/architecture/ files first. Core (CVG-CORE) is the platform administration control plane — last in build order. Auth is wired. Platform Admin only.

BUILD CORE TO SPEC:
1. Tenant management — full CRUD for the 4-tier tenant hierarchy (Platform → MSP → Client → Site/Prospect). Create, update, deactivate tenants. Manage parent-child relationships. Platform Admin only.
2. User management — CRUD for users across all tenants. Assign roles, manage tenant memberships, invite users, deactivate accounts. View user activity.
3. Role management — view and assign the 6 RBAC roles. Audit who has what role in which tenant.
4. App registry dashboard — display status of all 14 Cavaridge apps. Health checks (call each app's /health endpoint), version info, deployment status.
5. Platform analytics — aggregate metrics across all tenants: total users, active sessions, LLM usage (from Spaniel/Ducky), storage consumption, API call volumes.
6. Audit log viewer — query and display audit logs from @cavaridge/audit package. Filter by tenant, user, action, date range. Export as CSV.
7. Configuration management — platform-level settings: OpenRouter model routing config, default rate limits, feature flags per app, maintenance mode toggles.
8. Billing/usage tracking — track per-tenant usage of LLM calls, storage, and API requests. Usage reports per billing period. (Actual payment integration is future — just tracking and reporting for now.)
9. API — all endpoints under /v1/admin/. Platform Admin only. Full RBAC enforcement.
10. Tests — unit tests for tenant hierarchy validation, role assignment rules. Integration tests for tenant CRUD cascade.

CONSTRAINTS:
- Express 5 + TypeScript 5.6+ + Drizzle ORM
- Supabase — RLS enforced
- Platform Admin only — strictest auth of any app
- No hardcoded client data
- Zero type errors when done

Run pnpm tsc --noEmit — zero errors. Run any tests. Commit: feat(core): implement platform administration control plane. Save build report to logs/core-build-report.md." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## Final Smoke Test — Run After ALL Apps Are Built

```bash
claude --remote -p "Read CLAUDE.md. All 14 apps have been built. Run a final integration verification:

1. pnpm build from workspace root — every package and app must build. Fix any failures.
2. pnpm tsc --noEmit across entire workspace — zero errors required.
3. For every app, verify: (a) @cavaridge/auth is wired (except Ceres), (b) all Supabase queries are tenant-scoped, (c) theme support exists for apps with UI, (d) no hardcoded client data anywhere.
4. Verify no app calls OpenRouter directly — all LLM calls must go through Spaniel (service-to-service) or Ducky (app integration).
5. Verify Ducky branding: search for any instance of 'Ducky AI' — must be zero. Only 'Ducky Intelligence' or 'Ducky Intelligence by Cavaridge' allowed.
6. Verify no Replit references remain anywhere in the codebase.
7. Produce a final portfolio summary table and save to logs/final-build-summary.md:

| App Code | App Name | Build | Types | Auth | Theme | Tests | API Endpoints | Notes |
(one row per app)

8. List any remaining TODO/FIXME/HACK comments across the codebase.
9. Commit: chore: final portfolio build verification.

This is the final checkpoint before the platform goes to staging." --allowedTools "Read" "Write" "Edit" "Bash(pnpm *)" "Bash(npx *)" "Bash(git *)" "Bash(find *)" "Bash(ls *)" "Bash(cat *)" "Bash(grep *)" "Bash(tree *)" "Bash(mkdir *)" "Bash(cp *)" "Bash(mv *)" "Bash(rm *)" "Bash(node *)"
```

---

## Parallel Execution Guide

Apps that DON'T depend on each other can run simultaneously:

| Batch | Apps | Why parallel |
|-------|------|-------------|
| 1 | Caelum + Meridian + HIPAA | All only need Ducky |
| 2 | AEGIS + Vespar + Ceres | AEGIS needs tenant-intel, Vespar needs tenant-intel, Ceres is standalone |
| 3 | Midas + Astra | Both need AEGIS data, but can build the integration stubs in parallel |
| 4 | Brain + Forge | Both only need Ducky |
| 5 | Cavalier | Needs its own Supabase project |
| 6 | Core | Depends on all apps (health checks) — must be last |
| 7 | Final Smoke Test | After everything |

To run a batch in parallel, chain with `&&` per tab, run tabs simultaneously:

**Tab 1:** `caelum && midas && cavalier`  
**Tab 2:** `meridian && vespar && brain && core`  
**Tab 3:** `hipaa && aegis && ceres && astra && forge && final-smoke-test`
