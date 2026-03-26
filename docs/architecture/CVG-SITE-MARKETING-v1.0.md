# CVG-SITE-MARKETING-v1.0

> **Status:** DRAFT  
> **Created:** 2026-03-26  
> **Author:** Platform Architecture  
> **Classification:** Internal — Product Specification  
> **App Code:** CVG-SITE  
> **Supersedes:** N/A  
> **Dependencies:** CVG-CORE (auth), CVG-AEGIS (free scan), CVG-CERES (public tools)

---

## 1. Purpose

Define the architecture and content structure for the Cavaridge public-facing marketing website (cavaridge.com). This site exists **before** any login, signup, or trial gate. It must accomplish three goals:

1. **Establish credibility** — position Cavaridge as a serious MSP platform, not a startup experiment
2. **Generate qualified leads** — through free tools, content, and progressive engagement
3. **Enable self-service evaluation** — public docs, interactive demos, transparent pricing

This spec is informed by competitive analysis of 8 MSP SaaS marketing sites (NinjaOne, ConnectWise, Datto, Syncro, Augmentt, CoreView, Nerdio, SkyKick) and the Ydentic teardown (CVG-COMP-YDENTIC-v1.0).

---

## 2. Guiding Principles

### 2.1 Product-Led Growth (PLG) First
Every MSP SaaS company that's winning uses some form of PLG. The demo-only, sales-led model (ConnectWise, Ydentic) is losing to companies offering free trials, free tools, and interactive demos (NinjaOne, Augmentt, Syncro). Cavaridge already has two PLG hooks in development:

- **CVG-AEGIS freemium scan** — public security posture scan as lead gen
- **CVG-CERES public tools** — free nursing toolkit, no login required

These must be prominently featured on the marketing site as entry points.

### 2.2 Show, Don't Gate
- Public API documentation (unlike Ydentic's fully gated docs)
- Interactive product tours / embedded demos (Augmentt pattern)
- Architecture diagrams and technical deep dives
- Transparent pricing (at minimum pricing model + "contact for quote")

### 2.3 Ducky Intelligence Branding
The animated Blenheim Cavalier mascot (Ducky) must be visible and memorable across the marketing site — the "Intel Inside" model. This is a significant brand differentiator that no competitor has. Ducky should appear in product demos, loading states, error pages, and the footer tagline.

### 2.4 Healthcare Vertical Positioning
Cavaridge's healthcare expertise (ASCs, HIPAA, CMS/Medicare) is a genuine competitive moat. No MSP platform competitor explicitly targets healthcare. The marketing site should lead with vertical authority, not generic MSP messaging.

---

## 3. Site Map

```
cavaridge.com/
├── / ............................ Homepage (see §4)
├── /platform ................... Platform overview (see §5)
│   ├── /platform/aegis ......... Security Posture & Risk Intelligence
│   ├── /platform/meridian ...... M365 Tenant Intelligence
│   ├── /platform/midas ......... License & Cost Optimization
│   ├── /platform/astra ......... vCIO Advisory & Reporting
│   ├── /platform/caelum ........ SoW & Document Intelligence
│   ├── /platform/hipaa ......... HIPAA Compliance Engine
│   ├── /platform/cavalier ...... Channel Partner Commerce
│   ├── /platform/forge ......... Content Creation Platform
│   ├── /platform/brain ......... Voice-First Knowledge Capture
│   └── /platform/ducky ......... AI Research & Intelligence
├── /solutions .................. Vertical solutions
│   ├── /solutions/healthcare ... ASC / Ambulatory Surgery Centers
│   ├── /solutions/msp .......... MSP Operations & Scalability
│   └── /solutions/compliance ... HIPAA / SOC 2 / HITRUST
├── /free-tools ................. Public-access tools (no login)
│   ├── /free-tools/security-scan .. AEGIS freemium scan
│   ├── /free-tools/nursing ...... CERES nursing toolkit
│   └── /free-tools/roi-calculator . MSP ROI calculator (see §6.3)
├── /pricing .................... Transparent pricing page
├── /customers .................. Case studies & testimonials
├── /docs ....................... Public documentation
│   ├── /docs/api ............... API reference
│   ├── /docs/integrations ...... Integration guides
│   ├── /docs/architecture ...... Platform architecture overview
│   └── /docs/changelog ......... Release notes / changelog
├── /partners ................... Partner program
│   ├── /partners/directory ..... Find a partner
│   └── /partners/become ........ Become a partner
├── /resources .................. Content hub
│   ├── /resources/blog ......... Blog
│   ├── /resources/webinars ..... Webinars & video
│   ├── /resources/guides ....... Whitepapers & guides
│   └── /resources/framework .... Cavaridge MSP Framework (thought leadership)
├── /about ...................... About Cavaridge
│   ├── /about/team ............. Team
│   ├── /about/careers .......... Careers
│   └── /about/trust ............ Trust Center (SOC 2, security, privacy)
├── /login ...................... App login (redirect to app.cavaridge.com)
├── /signup ..................... Trial signup (redirect to app.cavaridge.com)
└── /demo ....................... Book a demo (Calendly or equivalent)
```

---

## 4. Homepage Specification

The homepage follows the NinjaOne pattern (best-in-class) adapted for Cavaridge's positioning. Every section must exist above the trial/signup gate — this page sells before it asks.

### 4.1 Hero Section
- **Headline:** 5-7 words, outcome-focused. Examples:
  - "Intelligent MSP Operations. Healthcare-Ready."
  - "The AI-Powered MSP Platform."
  - "Secure. Compliant. Intelligent."
- **Subheadline:** 15-25 words expanding on the headline. Must mention AI + healthcare.
- **Primary CTA:** "Start Free Trial" (high-intent)
- **Secondary CTA:** "Watch Demo" or "See How It Works" (research-mode)
- **Ducky mascot:** Animated Lottie — "greeting" state, positioned near hero

### 4.2 Logo Bar
- Customer logos (DIT clients that approve usage)
- Technology partner logos (Microsoft, Cisco Meraki, SentinelOne, Duo, Proofpoint, ConnectSecure, Horizon3.ai)
- Compliance badges (SOC 2 — when achieved, HIPAA-ready)

### 4.3 Platform Overview Tabs
Each tab shows:
- App name + icon
- 1-sentence value prop
- Screenshot or product illustration
- 1 quantified metric (when available)
- Named customer testimonial (when available)

Tabs (ordered by market appeal):
1. **AEGIS** — Security Posture & Risk Intelligence
2. **Meridian** — M365 Tenant Intelligence
3. **HIPAA** — Compliance Automation
4. **Midas** — License Optimization & Cost Savings
5. **Astra** — vCIO Advisory Dashboards
6. **Cavalier** — Channel Partner Commerce

### 4.4 Differentiator Section — "Why Cavaridge?"
Three pillars with icons:
1. **Agent-First Architecture** — "Every tool is an AI agent. Interfaces come second."
2. **Healthcare-Ready by Default** — "Built for ASCs, clinics, and regulated environments."
3. **Cavaridge Adjusted Score** — "The only composite security metric that accounts for your compensating controls."

### 4.5 Free Tools Section
- AEGIS free security scan (CTA: "Scan Your Posture — Free")
- CERES nursing toolkit (CTA: "Open Nursing Tools — No Login Required")
- ROI Calculator (CTA: "Calculate Your MSP Savings")
- Positioned as "value before transaction" — give first, sell later

### 4.6 Case Studies Carousel
- Specific metrics: dollar amounts, percentage improvements, hours saved
- Named customers with logos (requires client approval)
- Vertical tags: Healthcare, ASC, MSP Operations

### 4.7 Integrations Grid
Visual grid of integration logos organized by category:
- **RMM/PSA:** ConnectWise, Datto, NinjaOne, HaloPSA
- **Security:** SentinelOne, Duo, Proofpoint, ConnectSecure, Horizon3.ai
- **Cloud:** Microsoft 365, Google Workspace, Azure, AWS
- **Compliance:** Vanta, Drata, Compliancy Group
- **Distributors:** Pax8, Ingram Micro, TD SYNNEX, D&H, ScanSource

### 4.8 Trust Section
- SOC 2 Type II badge (when achieved)
- HIPAA compliance statement
- Data residency information
- Link to Trust Center (/about/trust)

### 4.9 Bottom CTA
- Repeat dual CTA: Free Trial + Book Demo
- Ducky mascot — "waving" Lottie state

---

## 5. Platform Pages Specification

Each platform page (/platform/{app}) follows a consistent template:

### Template Structure
1. **Hero:** App name, tagline, primary screenshot
2. **Problem Statement:** What pain does this solve? (MSP-centric language)
3. **Feature Blocks:** 4-6 key capabilities, each with:
   - Feature name
   - 2-3 sentence description
   - Screenshot or illustration
   - "How it works" micro-detail
4. **Competitive Comparison:** "How [App] compares" — table vs. 2-3 named competitors
5. **Integration Details:** What this app connects to
6. **Pricing Teaser:** Starting tier + link to /pricing
7. **CTA:** Start Free Trial + Book Demo

### Per-App Competitive Callouts

**AEGIS vs. Ydentic:** Ydentic has zero security posture capabilities. AEGIS provides composite scoring (Cavaridge Adjusted Score), pen testing tiers, browser security, DNS filtering, and IAR — none of which exist in Ydentic or AvePoint Elements.

**Meridian vs. Ydentic:** Direct overlap on M365 tenant management. Differentiate on: AI-powered insights (Ducky Intelligence layer), non-MS support (Google Workspace via tenant-intel), and integrated vCIO reporting (Astra cross-sell). Ydentic's hybrid AD breadth is deeper — acknowledge this and position Meridian as cloud-forward.

**Midas vs. Ydentic:** Ydentic has basic license visibility. Midas adds: Cavaridge Adjusted Score for license optimization, unused license detection, cost benchmarking across tenants, and compensating control awareness. Direct competitive advantage.

---

## 6. Lead Generation Assets

### 6.1 AEGIS Free Security Scan
- No login required — email-gated results delivery
- Scans public-facing posture indicators
- Generates PDF report with Cavaridge Adjusted Score teaser
- CTA to upgrade: "Get your full score with AEGIS"
- **This is the #1 lead gen mechanism.** Every MSP SaaS leader uses a free assessment tool.

### 6.2 CERES Public Tools
- Already scoped: 60-Day Medicare Frequency Calculator, Over-Utilization Calculator
- Zero auth, zero tracking beyond basic analytics
- Branded "A gift to the nursing community from Cavaridge"
- Subtle brand awareness play — every nurse using CERES sees Cavaridge

### 6.3 MSP ROI Calculator (NEW — recommended)
- Interactive tool: input # of tenants, # of techs, avg ticket volume, current tools
- Output: estimated time savings, cost reduction, and efficiency gains with Cavaridge
- Modeled after Nerdio's Cost Estimator and CoreView's ROI methodology
- Email-gated full report with personalized recommendations
- **Priority: Build this as a standalone React component deployable to /free-tools/roi-calculator**

### 6.4 MSP Framework Content Series (NEW — recommended)
- Modeled after Ydentic's "7 Principles" blog series
- Cavaridge version: "The Cavaridge MSP Framework" — 7-10 principles for modern MSP operations
- Each principle maps to a platform capability
- Positions Cavaridge as strategic advisor, not just tool vendor
- Doubles as SEO content targeting "MSP best practices," "MSP scalability," etc.

---

## 7. Pricing Page Strategy

Based on competitive analysis, the optimal approach for Cavaridge's current stage:

### Tier Structure (Visible)
| Tier | Target | Key Features | Pricing Display |
|---|---|---|---|
| **Free** | Evaluation / Small MSPs | AEGIS free scan, CERES tools, limited Meridian | "$0 — Get Started" |
| **Growth** | 1-50 tenant MSPs | AEGIS + Meridian + Midas core | "Starting at $X/tenant/mo" |
| **Professional** | 50-500 tenant MSPs | Full platform, Astra, Cavalier | "Starting at $X/tenant/mo" |
| **Enterprise** | 500+ tenant MSPs | Custom, dedicated support, SLAs | "Contact Sales" |

### Pricing Principles
- Show at least directional pricing (ranges or "starting at")
- Per-tenant pricing model (industry standard — Nerdio, SoftwareCentral, others)
- Annual discount for commitment
- No pricing in labor/services (keep consistent with SoW spec)
- "All-in" simplicity — avoid per-module pricing that creates calculator fatigue

---

## 8. Public Documentation Strategy

Ydentic gates ALL documentation behind Azure auth. This is a competitive weakness Cavaridge should exploit.

### Public Docs (docs.cavaridge.com)
- API reference with interactive playground (Swagger/Redoc)
- Integration guides for each connector
- Platform architecture overview (high-level — no proprietary IP)
- Getting Started guide
- Changelog / release notes
- Status page

### Gated Docs (behind auth)
- Detailed runbooks
- SOC 2 evidence packages
- Pen testing reports
- Customer-specific configuration guides

### Technical Content as Marketing
- Architecture blog posts (how we built X)
- Security practices (encryption, RLS, audit logging)
- AI/agent architecture explainers
- Open-source contributions (if any)

---

## 9. Review Platform Strategy (Day One Priority)

Ydentic's zero review presence is their biggest go-to-market failure. Cavaridge must establish presence on these platforms from launch:

| Platform | Priority | Action |
|---|---|---|
| **G2** | P0 | Create vendor profile, claim badges, solicit first 10 reviews within 60 days of launch |
| **Capterra** | P0 | Create listing, leverage GetApp/Software Advice network |
| **TrustRadius** | P1 | Create profile, target healthcare IT buyers specifically |
| **Microsoft AppSource** | P1 | List AEGIS and Meridian for marketplace distribution |
| **PeerSpot** | P2 | Enterprise-focused — list when Enterprise tier launches |

### Review Solicitation Process
1. After successful onboarding (Day 30), automated email requesting G2 review
2. After first QBR showing positive metrics, personal ask for detailed review
3. Incentivize with Cavaridge swag (Ducky plush? 🐕) — check platform TOS first

---

## 10. Technical Implementation Notes

### Stack (Recommended)
- **Framework:** Next.js 14+ (App Router) — SSG for marketing pages, SSR for dynamic content
- **Hosting:** Vercel (marketing site only — not the app platform)
- **CMS:** Contentlayer or Sanity for blog/resources (headless)
- **Analytics:** PostHog (self-hosted option for HIPAA) or Plausible
- **Forms:** React Hook Form → Supabase or HubSpot
- **Search:** Algolia DocSearch for /docs
- **Interactive Demos:** Navattic, Storylane, or custom React components

### Domain Structure
- `cavaridge.com` — marketing site (this spec)
- `app.cavaridge.com` — application platform (login/dashboard)
- `docs.cavaridge.com` — public documentation
- `status.cavaridge.com` — status page
- `api.cavaridge.com` — API endpoints

### SEO Priority Keywords
- "MSP platform for healthcare"
- "HIPAA compliant MSP tools"
- "MSP security posture scoring"
- "M365 multi-tenant management"
- "MSP license optimization"
- "vCIO reporting platform"
- "ASC IT management"
- "MSP AI automation"

---

## 11. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-26 | Platform Architecture | Initial marketing site architecture spec |
