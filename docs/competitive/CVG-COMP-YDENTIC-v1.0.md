# CVG-COMP-YDENTIC-v1.0

> **Status:** ACTIVE  
> **Created:** 2026-03-26  
> **Author:** Platform Architecture  
> **Classification:** Internal — Competitive Intelligence  
> **Supersedes:** N/A

---

## 1. Company Overview

| Field | Value |
|---|---|
| **Legal Entity** | Ydentic B.V. (acquired by AvePoint, Inc. — NASDAQ: AVPT) |
| **Founded** | 2017, Zwolle, Netherlands |
| **Founder** | Jorn Wittendorp (prev. built & sold largest Dutch MSP to telco, 2012) |
| **Headcount (pre-acq)** | ~15 employees |
| **Est. Revenue (pre-acq)** | ~$3M ARR |
| **Partners** | ~55 MSPs (45+ Dutch, handful Nordic/UK/AU/Caribbean) |
| **Acquisition** | AvePoint, January 15, 2025 |
| **Post-Acq Brand** | AvePoint Elements (Ydentic brand still operational as of 2026-03) |
| **ISO Certification** | Yes (likely 27001) |
| **NEN 7510 Compliant** | Yes (Dutch healthcare/govt standard — confirmed via case studies) |
| **GTM Model** | 100% partner-led, sales-led, demo-only — zero PLG |
| **Pricing** | Fully opaque — no public pricing, no self-serve |
| **Review Presence** | ZERO — no G2, Capterra, TrustRadius, Reddit, or independent reviews |
| **Conference Presence** | ESPC23 (Amsterdam), limited channel events |

---

## 2. Platform Architecture

**Deployment Model:** Self-hosted SaaS — runs inside MSP's own Azure infrastructure. MSP owns all data, controls security. Ydentic pushes automated updates (multiple monthly releases). This is the primary structural differentiator vs. all cloud-native competitors.

**Tech Stack:** Built entirely on Microsoft stack. Azure-native. No AI/ML capabilities mentioned anywhere.

**Post-Acquisition Shift:** AvePoint Elements is pure cloud SaaS — the self-hosted model is likely being deprecated. This creates a window for competitors targeting data-sovereignty-conscious MSPs.

---

## 3. Feature Matrix (11 Modules)

### 3.1 Multi-Tenant Baseline Management ★★★★★
- Connects ALL AD types simultaneously: on-prem AD, Shared AD, Hybrid AD, Azure AD (Entra ID)
- Single pane — no re-authentication across tenants
- Abstracts AD type differences from service desk staff
- Granular delegation of control to customer key users
- Scheduled background workers, event-driven notifications
- Per-tenant theming, global cross-tenant reporting
- **Claimed metric:** Up to 70% ticket reduction
- **Moat assessment:** On-prem/Shared AD support is genuinely rare — most competitors are cloud-only

### 3.2 User Lifecycle Management ★★★★★
- Full joiner/mover/leaver automation
- RBAC + ABAC (attribute-based access control)
- Managed resources: Users, Mailboxes, MFA, Guest Users, Shared Mailboxes, Groups, SharePoint, Teams, AVD, Azure VMs, OneDrive, RDS, **NTFS File Shares**, Azure Files, Exchange Online, Intune, AutoPilot, Config Profiles, Compliance Policies, Conditional Access
- Role-based onboarding: define resources per role, auto-execute all steps
- Offboarding: access revocation, task reassignment, data securing, license termination
- HR integrations: Afas, AutoTask, NMBRS (Dutch HR/payroll — Certified Afas Partner)
- Uniform regardless of AD type

### 3.3 Workflows & Approvals ★★★☆☆
- Multi-step workflows with dynamic multi-level authorization
- **Cross-tenant workflow replication** — build once, deploy to many customers
- Conversation/commenting during workflow processing
- Connected to self-service portal for end-user triggers
- Pre-built best-practice workflow templates included
- **Gaps:** No visual workflow designer, no conditional branching/logic, no webhook/API triggers documented

### 3.4 Microsoft License Management ★★★★☆
- Real-time cross-tenant license monitoring
- Insights API → Power BI
- Direct NCE (Microsoft Partner Portal) + distributor portal integration
- Delegated purchasing rights per employee
- Automated invoicing via API
- SPLA reporting for MS partnership compliance
- Custom license types alongside MS licenses
- **Gaps:** No cost optimization AI, no unused license detection, no Azure consumption billing, no cross-customer benchmarking

### 3.5 Ydentic Workspace (End-User Portal) ★★★☆☆
- Customizable web portal — daily starting point for end users
- Productivity widgets (calendar, email, tasks)
- Custom widget creation + distribution
- **White-label branding per customer**
- Azure SSO, app launcher, company announcements
- Centrally managed or delegated to customer
- Positioned as revenue vehicle + stickiness driver

### 3.6 Self-Service Portal ★★★★★
- Service catalog: browse → select → auto-trigger workflow → auto-fulfill
- **MFA-based self-service password reset** (personal email or SMS)
- Automated access authorization: SharePoint, Teams, File Shares, Shared Mailboxes, Groups, Roles
- **Time-based access** — temporary resource access with automatic expiration ★
- Auto-approval or custom approval chains per request type
- Primary driver of 70% ticket reduction claim

### 3.7 Auditing & Reporting ★★★★☆
- Indelible logging of every action across all tenant types
- Built-in "Ydentic Insights" BI tool
- Predefined + scheduled + instant + shared reports
- Custom count selectors, saved list filters
- Insights API for Power BI / Excel export
- Cross-tenant unified logging (differentiator vs. native MS admin centers)
- **Gaps:** No SIEM integration mentioned, no compliance-specific report packs (HIPAA, SOC 2)

### 3.8 Tenant Onboarding ★★★☆☆
- No-Code Migration Wizard
- CLI for advanced/scripted migrations
- Excel onboarding templates with validation
- AD Naming Profiles for standardization
- Batch auto-convert, tenant templates
- 15 years of MSP experience baked in
- **Gaps:** No API-based onboarding, no automated discovery

### 3.9 Platform Infrastructure ★★★★☆
- Self-hosted SaaS in MSP's own Azure
- Automated deployment + continuous health monitoring
- Multiple monthly releases
- MSP owns all data — full data residency control
- ISO certified, NEN 7510/GDPR compliant
- **Strategic note:** This model is likely being deprecated post-AvePoint acquisition

### 3.10 Platform Integrations ★★☆☆☆
- PSA: AutoTask confirmed (others unconfirmed)
- HRM: Afas, AutoTask, NMBRS
- Automation APIs + SDK for custom integrations
- Event-based triggers, integration auditability
- Liquit partnership for universal app delivery
- **Gaps:** ConnectWise, ServiceNow, HaloPSA not confirmed. No integration marketplace. SDK docs gated.

### 3.11 AvePoint Elements (Post-Acquisition) ★★★★☆
- Adds: data protection, backup, migration, compliance monitoring
- AI data readiness (Copilot preparation)
- Real-time alerts, storage optimization
- Recommendations engine for AI-powered service suggestions
- Microsoft #IntuneForMSPs validated
- Marketplace integration with major distributors (planned June 2025)
- AvePoint scale: 21,000+ customers, 3,500+ channel partners

---

## 4. Case Studies Summary

| Customer | Type | Key Value | Notable Detail |
|---|---|---|---|
| **Wortell** | Leading Dutch MSP | Co-development, rapid feature delivery | Chose Ydentic over "major players" |
| **Ekco** | European managed cloud (healthcare/legal) | ISO 27001 + NEN 7510 compliance | 6+ year collaboration, "26 clicks → gone" |
| **Hallo** | Dutch MSP, multi-office | Standardization, processing time reduction | Multiple offices doing tasks the same way |
| **Arcus IT** (now Onited) | Dutch IT group | Self-service delegation without risk | Enabled customer self-service with guardrails |
| **ITON** (now part of Ekco) | Dutch MSP | Speed, customer self-service | Co-created roadmap, eliminated AD/payroll mismatch |
| **SureGroup ICT** | Dutch MSP (healthcare) | Afas HR integration, compliance | Automated JML via certified Afas partnership |

**Pattern:** All Dutch. All cite self-service + standardization. No hard ROI numbers beyond "26 clicks."

---

## 5. Competitive Landscape Position

| Competitor | Primary Focus | Pricing Model | PLG? | Key Differentiator |
|---|---|---|---|---|
| **Nerdio** | AVD + M365 multi-tenant | Per-tenant | Free trial | Patented AVD auto-scaling (~55% Azure savings) |
| **CoreView** | M365 governance + security | Per-user tiered | Demo-only | Config-as-code, drift detection, "Corey" AI |
| **Augmentt** | M365 security + SaaS management | Per-user tiered | Free community + interactive demo | 1-click CIS/NIST/SCuBA baselines, SaaS discovery |
| **SkyKick** | Broad MSP suite | Per-MSP-employee | Free trial | 500+ pre-built automations, ConnectWise-owned |
| **CyberDrain CIPP** | M365 multi-tenant | Open-source/free | Yes | Reddit-beloved, community-driven |
| **MS 365 Lighthouse** | Basic multi-tenant | Free (CSP partners) | N/A | Microsoft-native, improving fast |
| **Ydentic/AvePoint** | Identity + lifecycle + multi-tenant | Opaque/negotiated | No | Hybrid AD support, self-hosted model |

---

## 6. Weaknesses to Exploit

1. **Zero review presence** — invisible to English-language MSP buyers doing comparison research
2. **Zero AI** — no agents, no intelligent automation, no ML-powered insights
3. **Microsoft-only** — nothing for Google Workspace, non-MS SaaS, or hybrid cloud
4. **No security posture scoring** — no composite risk metric, no pen testing, no vulnerability scanning
5. **No healthcare-specific compliance** — NEN 7510 (Dutch) ≠ HIPAA; no CMS/Medicare tooling
6. **No vCIO advisory layer** — pure operational tool, no strategic reporting
7. **No content generation** — no document/report/presentation automation
8. **No channel partner commerce** — no distributor marketplace, no deal registration
9. **No public-access tools** — no freemium hook, no free assessment, no CERES equivalent
10. **Gated documentation** — builds friction, prevents developer evaluation
11. **Self-hosted model being deprecated** — creates customer uncertainty post-AvePoint acquisition
12. **No pricing transparency** — sales-only model loses to PLG competitors at top of funnel

---

## 7. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-26 | Platform Architecture | Initial competitive intelligence teardown |
