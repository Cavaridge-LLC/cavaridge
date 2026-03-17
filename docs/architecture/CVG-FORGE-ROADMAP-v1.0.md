# CVG-FORGE — MVP Feature Matrix & Phased Roadmap

**Version:** 1.0  
**Date:** 2026-03-15  
**Author:** Claude (Architect) / Benjamin Posner (Owner)  
**Status:** DRAFT  
**Owner:** Cavaridge, LLC  

---

## 1. MVP Definition

The FORGE MVP proves the core thesis: **a single brief in → a finished, downloadable asset out**, with transparent cost estimation, quality validation, and Ducky personality throughout.

MVP scope is deliberately narrow: 3 output formats (DOCX, PPTX, static HTML site), single-tenant operation with multi-tenant data model in place, and the full 5-stage agent pipeline with Ducky QC.

### 1.1 MVP Exit Criteria

- [ ] User can submit a natural language brief and receive a finished DOCX, PPTX, or HTML site
- [ ] Cost estimate shown and approved before execution begins
- [ ] Real-time progress with Ducky animations for each pipeline stage
- [ ] Quality score >= 0.75 on 80%+ of test briefs across all 3 formats
- [ ] Revision request works without additional credit charge (up to 3x)
- [ ] Usage dashboard shows credit consumption per project
- [ ] Langfuse traces accessible for every agent run
- [ ] Multi-tenant data model enforced (RLS active) even if only one tenant at launch
- [ ] Deployed on Railway with CI/CD from GitHub

---

## 2. Feature Matrix

### 2.1 Phase 1 — MVP (Weeks 1–8)

**Target: Core pipeline + 3 output formats + Ducky UX**

| Feature | Priority | Complexity | Dependencies |
|---------|----------|------------|--------------|
| **Brief Intake UI** | P0 | Medium | `@cavaridge/ui` |
| Multi-step form (describe → format → audience → tone) | P0 | Medium | — |
| File attachment support (reference docs) | P1 | Low | Supabase Storage |
| Template selection (pre-built starting points) | P1 | Medium | pgvector |
| **Cost Estimation** | P0 | Medium | OpenRouter pricing API |
| Pre-execution estimate with itemized breakdown | P0 | Medium | — |
| Approve/cancel flow before credits consumed | P0 | Low | — |
| **Agent Pipeline** | P0 | High | `agent-core`, `agent-runtime` |
| INTAKE agent (brief → structured spec) | P0 | Medium | — |
| RESEARCH agent (web search + template retrieval) | P0 | High | Web search tool, pgvector |
| STRUCTURE agent (content planning per format) | P0 | High | — |
| GENERATE agent (parallel section generation) | P0 | High | BullMQ |
| VALIDATE agent (Ducky QC scoring) | P0 | High | — |
| **Output Rendering** | P0 | High | — |
| DOCX renderer (docx npm package) | P0 | Medium | Existing CVG-CAELUM logic |
| PPTX renderer (pptxgenjs) | P0 | High | New implementation |
| HTML site renderer (Vite build → zip) | P0 | High | New implementation |
| PDF renderer (HTML→PDF via Puppeteer) | P1 | Medium | Puppeteer |
| **Real-Time Progress** | P0 | Medium | Socket.IO, Redis |
| WebSocket progress events per pipeline stage | P0 | Medium | — |
| Ducky animation states mapped to stages | P0 | Low | `ducky-animations` |
| **Output Delivery** | P0 | Medium | Supabase Storage |
| Signed download URLs (24hr expiry) | P0 | Low | — |
| In-browser preview (DOCX/PDF viewer, slide carousel, iframe) | P1 | High | — |
| **Revision System** | P0 | Medium | — |
| Free revision requests (up to 3 per project) | P0 | Medium | — |
| Revision agent (targeted fixes, not full regeneration) | P0 | High | — |
| Revision diff view (original brief vs. output) | P1 | Medium | — |
| **Usage & Billing** | P0 | Medium | — |
| Credit tracking per project and user | P0 | Medium | — |
| Usage dashboard with period breakdown | P0 | Medium | — |
| Stripe integration for credit purchases | P1 | Medium | Stripe SDK |
| **Auth & Tenancy** | P0 | Low | `@cavaridge/auth` |
| Supabase auth + RLS on all tables | P0 | Low | Existing |
| 6 standard RBAC roles enforced | P0 | Low | Existing |
| Tenant-scoped data isolation | P0 | Low | Existing |
| **Observability** | P0 | Medium | Langfuse |
| Langfuse trace per agent run | P0 | Low | Existing |
| User-facing trace view (simplified) | P1 | Medium | — |
| **Infrastructure** | P0 | Medium | Railway |
| Railway deployment (API + workers + WS) | P0 | Medium | — |
| GitHub CI/CD pipeline | P0 | Low | Existing Turborepo setup |
| BullMQ worker pool with auto-scaling triggers | P1 | Medium | — |

### 2.2 Phase 2 — Expansion (Weeks 9–16)

**Target: Additional formats + templates + collaboration + billing**

| Feature | Priority | Complexity |
|---------|----------|------------|
| **Additional Output Formats** | | |
| XLSX renderer (financial models, trackers) | P0 | High |
| HTML email template renderer | P1 | Medium |
| Social media kit generator (image set + copy) | P1 | High |
| **Template System** | | |
| Platform-global template library (20+ templates) | P0 | Medium |
| Tenant-specific template creation (admin UI) | P0 | Medium |
| Semantic template search via pgvector | P0 | Medium |
| Template usage analytics | P1 | Low |
| **Collaboration** | | |
| Project sharing within tenant | P0 | Medium |
| Comment/feedback on output (pre-revision) | P1 | Medium |
| Team usage dashboard (MSP Admin view) | P0 | Medium |
| **Billing & Monetization** | | |
| Subscription tiers (Free / Pro / Business / Enterprise) | P0 | High |
| Stripe subscription management | P0 | High |
| Credit top-up / overage handling | P0 | Medium |
| MSP reseller billing (tenant charges clients) | P1 | High |
| **White-Label** | | |
| Tenant branding on output files (logo, colors, fonts) | P0 | High |
| Custom domain for tenant FORGE instance | P1 | High |
| "Powered by Ducky AI" footer (always present) | P0 | Low |
| **Integrations** | | |
| Google Drive export | P1 | Medium |
| Slack notification on completion | P1 | Low |
| Webhook on project status change | P1 | Medium |

### 2.3 Phase 3 — Advanced (Weeks 17–24)

**Target: Rich media + API access + advanced autonomy**

| Feature | Priority | Complexity |
|---------|----------|------------|
| **Rich Media Outputs** | | |
| Short-form video (explainer/promo) via rendering API | P1 | Very High |
| Voiceover / TTS integration | P1 | High |
| Interactive React micro-apps (calculators, forms) | P1 | High |
| **API & Headless Mode** | | |
| Public API for programmatic asset generation | P0 | High |
| API key management per tenant | P0 | Medium |
| Webhook-driven async workflows | P0 | Medium |
| Batch project creation | P1 | Medium |
| **Advanced Autonomy** | | |
| Multi-asset projects (brief → deck + doc + site together) | P0 | Very High |
| Iterative refinement loops (AI proposes improvements proactively) | P1 | High |
| Brand voice learning (per-tenant style fine-tuning via examples) | P1 | High |
| **Analytics & Intelligence** | | |
| Project success rate analytics per tenant | P0 | Medium |
| Model performance scoring (which models produce best quality per format) | P0 | Medium |
| Cost optimization recommendations | P1 | Medium |
| **Marketplace (Future)** | | |
| Community template marketplace | P2 | Very High |
| Third-party renderer plugins | P2 | Very High |

---

## 3. Phased Roadmap

### 3.1 Timeline Overview

```
Week  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
      ├──────── Phase 1: MVP ────────┤├────── Phase 2: Expansion ──────┤├──── Phase 3: Advanced ────┤
      │                              │                                  │                            │
      ▼                              ▼                                  ▼                            ▼
   Sprint 1-2:              MVP Launch              Phase 2 Launch              Phase 3 Launch
   Foundation              (Internal/Beta)          (Public Beta)               (GA)
```

### 3.2 Phase 1 Sprint Breakdown

#### Sprint 1 (Weeks 1–2): Foundation
- [ ] Scaffold `apps/forge/` in monorepo (Express 5 + React + TypeScript)
- [ ] Create Drizzle migrations for all `forge_*` tables
- [ ] Wire up `@cavaridge/auth` — RLS policies on all tables
- [ ] Implement INTAKE agent (brief → ProjectSpec)
- [ ] Implement ESTIMATE agent (spec → CostEstimate)
- [ ] Basic Brief Intake UI (single-page form, no templates yet)
- [ ] Railway service setup (forge-api, forge-workers)
- **Deliverable:** User can submit a brief and see a cost estimate

#### Sprint 2 (Weeks 3–4): Pipeline Core
- [ ] Implement RESEARCH agent (web search + result structuring)
- [ ] Implement STRUCTURE agent (format-specific content planning)
- [ ] Implement GENERATE agent (parallel section generation via BullMQ)
- [ ] Redis + BullMQ queue setup on Railway
- [ ] Langfuse integration on all agent runs
- **Deliverable:** Full pipeline executes end-to-end (output is raw JSON, not rendered)

#### Sprint 3 (Weeks 5–6): Rendering & QC
- [ ] Implement VALIDATE agent (Ducky QC scoring)
- [ ] DOCX render worker (leverage CVG-CAELUM patterns)
- [ ] PPTX render worker (pptxgenjs implementation)
- [ ] HTML site render worker (Vite-based static site builder)
- [ ] Supabase Storage integration for output files
- [ ] Signed download URL generation
- **Deliverable:** Pipeline produces actual downloadable files with quality scores

#### Sprint 4 (Weeks 7–8): UX Polish & Launch Prep
- [ ] WebSocket progress events (Socket.IO + Redis adapter)
- [ ] Ducky animation integration on progress view
- [ ] Revision system (free revision flow, REVISE agent)
- [ ] Usage dashboard (credit tracking per project)
- [ ] Cost preview → approve flow in UI
- [ ] In-browser output preview (basic)
- [ ] CI/CD pipeline finalization
- [ ] Internal testing across 50+ diverse briefs per format
- [ ] Bug fix and stabilization sprint
- **Deliverable:** MVP ready for internal/beta users

---

## 4. Build Order & Dependencies

```
@cavaridge/auth (existing) ─────────────────────────────┐
@cavaridge/agent-core (existing) ──────────────────────┐ │
@cavaridge/agent-runtime (existing) ─────────────────┐ │ │
@cavaridge/ducky-animations (existing) ────────────┐ │ │ │
@cavaridge/ui (existing) ────────────────────────┐ │ │ │ │
                                                 │ │ │ │ │
Sprint 1: Scaffold + Intake + Estimate ─────────►├─┤─┤─┤─┤
                                                 │ │ │ │
Sprint 2: Research + Structure + Generate ──────►├─┤─┤─┘
                                                 │ │ │
Sprint 3: Validate + Renderers + Storage ───────►├─┤─┘
                                                 │ │
Sprint 4: UX + WebSocket + Revision ────────────►├─┘
                                                 │
                                          MVP LAUNCH
```

**Critical path:** Sprint 2 (pipeline agents) and Sprint 3 (renderers) are the highest-risk sprints. PPTX and HTML site rendering are net-new capabilities for the Cavaridge monorepo.

---

## 5. Subscription Tier Planning (Phase 2 Implementation)

| Tier | Credits/Month | Max Projects | Formats | Revisions | Price |
|------|--------------|--------------|---------|-----------|-------|
| **Free** | 50 | 5 | DOCX, PDF only | 1 per project | $0 |
| **Pro** | 500 | Unlimited | All Phase 1 | 3 per project | $29/mo |
| **Business** | 2,000 | Unlimited | All formats | 5 per project | $79/mo |
| **Enterprise** | Custom | Unlimited | All + API access | Unlimited | Custom |
| **MSP Reseller** | Pool allocation | Per-client limits | All + white-label | Configurable | Custom |

Credit costs per output type (approximate):

| Output | Estimated Credits | Rationale |
|--------|------------------|-----------|
| 1-page DOCX (letter, memo) | 5–10 | Light research + generation |
| Multi-page DOCX (report, proposal) | 15–40 | Research + multi-section generation |
| 10-slide PPTX | 20–35 | Structure + per-slide generation |
| Landing page (HTML) | 25–50 | Design + content + responsive |
| Multi-page website (HTML) | 50–100 | Architecture + per-page generation |

---

## 6. Competitive Positioning Matrix

How FORGE stacks up against SuperCool and alternatives at each phase:

| Capability | SuperCool | Gamma | Canva AI | FORGE MVP | FORGE Phase 2 | FORGE Phase 3 |
|-----------|-----------|-------|----------|-----------|---------------|---------------|
| Single-brief → finished asset | Yes (unreliable) | Slides only | No | Yes (3 formats) | Yes (6+ formats) | Yes (9+ formats) |
| Transparent cost preview | No | N/A (flat rate) | N/A | Yes | Yes | Yes |
| Retry without penalty | No | N/A | N/A | Yes (3 free) | Yes (5 free) | Yes (unlimited for Enterprise) |
| Quality validation | No | No | No | Yes (Ducky QC) | Yes | Yes |
| Agent observability | No | No | No | Yes (Langfuse) | Yes | Yes |
| Multi-tenant / white-label | No | No | Enterprise only | Data model ready | Full white-label | Full + marketplace |
| Video/audio output | Yes (unreliable) | No | Limited | No | No | Yes |
| API / headless mode | No | No | Enterprise | No | Webhooks | Full API |
| Mobile app | Yes | No | Yes | Responsive web | Responsive web | TBD (PWA) |
| Customer support | None | Good | Good | Built-in (Cavaridge) | Built-in | Built-in |
| Task success rate | ~25% | ~90% (slides) | ~85% | Target: 85%+ | Target: 90%+ | Target: 92%+ |

---

## 7. Risk-Adjusted Timeline

| Phase | Optimistic | Expected | Pessimistic | Key Risk |
|-------|-----------|----------|-------------|----------|
| Phase 1 (MVP) | 6 weeks | 8 weeks | 12 weeks | PPTX/HTML renderers are net-new |
| Phase 2 (Expansion) | 6 weeks | 8 weeks | 12 weeks | Stripe billing + white-label complexity |
| Phase 3 (Advanced) | 6 weeks | 8 weeks | 14 weeks | Video rendering + API security |
| **Total to GA** | **18 weeks** | **24 weeks** | **38 weeks** | — |

### 7.1 De-risk Actions

1. **Prototype PPTX renderer in Week 1** — build a standalone pptxgenjs proof-of-concept before sprint 3 to validate slide quality
2. **Prototype HTML site renderer in Week 1** — same approach; build a Vite-based static site generator from a JSON spec
3. **Establish QC benchmark set** — curate 50 test briefs per format by end of Sprint 1 for automated quality regression testing
4. **Cap Phase 1 scope ruthlessly** — no templates, no collaboration, no billing UI in MVP. Pure pipeline + output + Ducky.

---

## 8. Success Metrics by Phase

### Phase 1 (MVP)
| Metric | Target |
|--------|--------|
| Pipeline completion rate | >85% of submitted projects produce output |
| Ducky QC pass rate (>= 0.75) | >80% of projects on first generation |
| Average pipeline execution time | <3 minutes for standard DOCX |
| Internal tester satisfaction | >4/5 rating |

### Phase 2 (Public Beta)
| Metric | Target |
|--------|--------|
| Monthly active users | 500+ |
| Paid conversion rate | >5% |
| Template usage rate | >30% of projects start from template |
| Average revision requests per project | <1.5 |
| Support ticket volume | <50/week |

### Phase 3 (GA)
| Metric | Target |
|--------|--------|
| Monthly active users | 2,000+ |
| Monthly recurring revenue | $15K+ |
| API adoption | 10+ tenants using headless mode |
| Task success rate | >90% |
| NPS | >40 |

---

*This document is the intellectual property of Cavaridge, LLC. Distribution prohibited without written consent.*
