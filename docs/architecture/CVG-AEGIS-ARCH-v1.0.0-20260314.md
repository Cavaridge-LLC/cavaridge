# CVG-AEGIS Architecture Specification

**Document:** CVG-AEGIS-ARCH-v1.0.0-20260314.md
**Status:** DRAFT — Pending Benjamin Posner approval
**Author:** Claude (Architect) / Benjamin Posner (Principal, Cavaridge LLC)
**Date:** 2026-03-14
**Cavaridge IP:** All code, documentation, and intellectual property are owned exclusively by Cavaridge, LLC (D-U-N-S: 138750552)

---

## 1. Overview

### 1.1 What Is AEGIS?

CVG-AEGIS is a Security Posture & Risk Intelligence Platform that unifies **inside-out posture assessment** with **outside-in risk scoring** in a single MSP-native, multi-tenant application. AEGIS gives MSPs a complete view of client security posture that no single competitor currently delivers.

**AEGIS** (Greek: the protective shield of Zeus) — app code **CVG-AEGIS**.

### 1.2 Problem Statement

MSPs currently face a fragmented tooling landscape for security posture management:

- **Microsoft Secure Score** is free but M365-only, single-tenant, non-customizable, and functions as a Microsoft stack upsell engine. No multi-tenant management, no compliance mapping, no remediation.
- **SecurityScorecard** ($292M raised, ~$26K/yr avg) provides outside-in risk ratings across 10 factor groups with A-F grading, but is enterprise-focused with no MSP multi-tenant workflow, no internal scanning, and no M365 baseline checks. Core use case is third-party vendor risk management (TPRM) and supply chain risk — not MSP client posture management.
- **ThreatMate** ($4.88M raised, MSP-native) delivers strong inside-out capabilities — attack surface discovery, automated pentesting, M365 CISA baselines, endpoint compliance, dark web monitoring — but has no vendor/supply chain scoring, no cyber risk quantification, no native compliance framework mapping, and limited PSA integrations beyond ConnectWise. Report output is generic and non-actionable (see §1.3).

No platform combines both directions (inside-out + outside-in) with MSP-native multi-tenancy, native compliance mapping, financial risk quantification, QBR/roadmap integration, and a freemium lead-gen funnel.

### 1.3 Competitive Intelligence: ThreatMate Report Analysis

A ThreatMate external scan of `cavaridge.com` was conducted on 2026-03-14. Key observations about their product output:

**What They Do Well:**
- Fast external scan across subdomains (discovered astra.app, ceres.app, meridian.app automatically)
- Clean branded PDF output suitable for prospect conversations
- Clear severity banding (0-100 scale, 4 risk tiers)
- SMB-friendly stats (avg breach cost, recovery time, % of SMB attacks)

**Where They Fall Short (AEGIS Differentiation Opportunities):**
- **External-only** — they explicitly state on the final page that this scan "only looks at what's visible from the outside"
- **Generic recommendations** — "Review this report with your team" and "Create an action plan" are not actionable remediation steps
- **No compliance mapping** — findings are not mapped to any framework (HIPAA, NIST, SOC 2, etc.)
- **No financial risk quantification** — no dollar-value exposure estimates
- **No remediation specificity** — DMARC finding says "could allow email spoofing" but doesn't provide the fix (e.g., "update DNS TXT record to `v=DMARC1; p=quarantine; ...`")
- **No trend tracking** — snapshot only, no posture-over-time visualization
- **Upsell funnel, not standalone value** — the free report exists to sell the full platform subscription
- **No QBR/roadmap integration** — findings don't feed into any business review or IT planning workflow
- **Missing context** — TLS cipher findings don't indicate which ciphers to keep vs. disable, or how to configure at the hosting/CDN layer

**Actual Findings on cavaridge.com (actionable for DIT/Cavaridge):**
1. DMARC policy is `none` on both `cavaridge.com` and `www.cavaridge.com` — needs `p=quarantine` or `p=reject`
2. Weak TLS ciphers (CBC-mode and RSA-only key exchange suites) — Railway/CDN configuration issue
3. HTTP (port 80) open on multiple subdomains — should enforce HTTPS redirect
4. 1 informational item not shown in free report

---

## 2. Architecture

### 2.1 Technology Stack

Follows Cavaridge universal build standards (CVG-CORE-DEV-v2.0):

| Layer | Technology |
|---|---|
| Runtime | Node 20 / TypeScript 5.6+ |
| Framework | Express 5 |
| Database | Supabase (PostgreSQL + pgvector) |
| ORM | Drizzle ORM |
| Build | pnpm workspaces + Turborepo (monorepo) |
| Hosting | Railway |
| Secrets | Doppler (staging/prod), Replit Secrets (dev) |
| LLM Gateway | CVG-AI (Project Spaniel) → OpenRouter |
| Conversation State | CVG-RESEARCH (Project Ducky) |
| Agent Framework | Vercel AI SDK + LangGraph.js |
| Queue | BullMQ + Redis |
| Observability | Langfuse |

### 2.2 Multi-Tenancy Model

AEGIS uses the **Universal Tenant Model** (codified in `CLAUDE.md` and implemented in `packages/auth/`). The same 4-tier hierarchy governs all Cavaridge apps:

```
Cavaridge (Platform Owner)          ← type: platform
└── MSP Tenant (e.g., Dedicated IT) ← type: msp
    ├── Client A (e.g., Compass SP) ← type: client
    │   ├── Site: Main Office       ← type: site
    │   └── Site: Tampa ASC         ← type: site
    ├── Client B                    ← type: client
    └── Prospect X (freemium scan)  ← type: prospect
```

- **Isolation:** Supabase RLS at every layer (DB → API middleware → UI) — per Universal Tenant Model
- **RBAC:** Platform Admin, MSP Admin, MSP Tech, Client Admin, Client Viewer, Prospect (read-only, limited) — per Universal Tenant Model standard roles
- **Inheritance:** MSP-level scan policies cascade to clients; per-client overrides supported
- **No hardcoded client data** — all client configuration in `tenantConfig` or environment variables
- DIT is a tenant only; Cavaridge LLC is the sole IP owner

### 2.3 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CVG-AEGIS Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Public Site  │  │  MSP Portal  │  │  Client View │      │
│  │  (Freemium)  │  │  (Full App)  │  │  (Read-Only) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│  ┌──────▼─────────────────▼──────────────────▼──────────┐   │
│  │                    API Layer (Express 5)               │   │
│  │  /api/scan  /api/posture  /api/risk  /api/compliance  │   │
│  │  /api/reports  /api/vendors  /api/prospects            │   │
│  └──────────────────────┬────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐   │
│  │                  Scan Engine Layer                      │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐ │   │
│  │  │  External   │ │  Internal  │ │  M365 / Cloud      │ │   │
│  │  │  Scanner    │ │  Scanner   │ │  Config Checker    │ │   │
│  │  └────────────┘ └────────────┘ └────────────────────┘ │   │
│  └──────────────────────┬────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐   │
│  │                  Intelligence Layer                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │ Scoring  │ │Compliance│ │ Risk     │ │ Report   │ │   │
│  │  │ Engine   │ │ Mapper   │ │ Quant($) │ │ Gen      │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └──────────────────────┬────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐   │
│  │              Ducky AI Agent Layer                       │   │
│  │  ComplianceAgent · RiskScoreAgent · ReportGenAgent     │   │
│  │  DataExtractAgent · ResearchAgent                      │   │
│  │           (via Spaniel → OpenRouter)                    │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │              Data Layer (Supabase + RLS)                │   │
│  │  tenants · clients · scans · findings · scores ·       │   │
│  │  vendors · compliance_maps · reports · prospects        │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Integrations                                                │
│  PSA: ConnectWise · Autotask/Datto · HaloPSA                │
│  RMM: Datto RMM · NinjaOne · ConnectWise Automate           │
│  Vuln Scanning: ConnectSecure API (internal findings)        │
│  Pentest T1: Nuclei (open source, AEGIS-owned templates)     │
│  Pentest T2: Horizon3.ai NodeZero API (autonomous pentest)   │
│  Platform: CVG-MIDAS (QBR) · CVG-MER (M&A) · CVG-HIPAA     │
│  Identity: Microsoft Graph API (Entra ID / M365)             │
│  Hardware: AEGIS Probe (Raspberry Pi network discovery)       │
│  DNS/TLS: External scan engines (AEGIS-built)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Modules

### 3.1 Scan Engine — Build vs. Integrate vs. Partner

AEGIS is an **intelligence and scoring platform**, not a scanning engine for every layer. The strategy is: build what differentiates us, integrate with best-of-breed MSP tools for internal visibility, and partner for autonomous pentesting.

#### 3.1.0 Scanning Strategy Overview

| Layer | Approach | Technology | Cost to AEGIS |
|---|---|---|---|
| External scanning | **Build** (owned) | Custom Node.js scanners | Dev time only |
| Internal vuln scanning | **Integrate** (API) | ConnectSecure API + RMM APIs | ConnectSecure subscription |
| Network discovery appliance | **Build** (owned) | Raspberry Pi "AEGIS Probe" | ~$75-100 hardware/unit |
| M365 / Cloud config | **Build** (owned) | Microsoft Graph API, CISA SCuBA | Dev time only |
| Pentest Tier 1 — Validation | **Build** (owned) | Nuclei (open source) | Free engine, curate templates |
| Pentest Tier 2 — Red Team | **Partner** | Horizon3.ai NodeZero | NodeZero subscription |
| Scoring, compliance, reports | **Build** (owned) | AEGIS core — this is the product | Dev time only |

#### 3.1.1 External Scanner (Outside-In) — BUILT BY AEGIS

Performs non-intrusive, outside-in reconnaissance of a target domain. This is AEGIS-owned code.

| Check | Description | Data Source |
|---|---|---|
| DNS Health | SPF, DKIM, DMARC policy analysis | DNS TXT records |
| TLS/SSL | Certificate validity, cipher suite strength, protocol version | Direct TLS handshake |
| Open Ports | Common service ports exposed (80, 443, 22, 3389, etc.) | Port scanning |
| Subdomain Discovery | Enumerate subdomains via DNS, CT logs | Certificate Transparency, DNS |
| HTTP Security Headers | CSP, HSTS, X-Frame-Options, etc. | HTTP response headers |
| Web Application | Common misconfigurations, exposed admin panels | HTTP probing |
| Dark Web Exposure | Credential leaks, breach data for domain email addresses | OSINT / breach databases |
| IP Reputation | Blacklist status, abuse history | Reputation feeds |

**Freemium scan (§5)** uses a subset: DNS Health + TLS/SSL + HTTP Headers + Subdomain Discovery + Dark Web (limited). Full scan requires authenticated tenant.

#### 3.1.2 Internal Scanner (Inside-Out) — INTEGRATE, DON'T BUILD

AEGIS does **not** build its own internal vulnerability scanner. MSP clients already have RMM agents deployed. Building another agent creates deployment friction and competes with existing tooling. Instead, AEGIS ingests findings from best-of-breed MSP tools and normalizes them into the AEGIS scoring engine.

**Primary integration: ConnectSecure (formerly CyberCNS)**

ConnectSecure is an MSP-native vulnerability and compliance management platform with lightweight agents, EPSS-based risk scoring, 230,000+ CVE coverage, automated patching for 550+ apps, and integrations with ConnectWise and Datto. Usage-based pricing starts at ~$300/month.

| Data Ingested via ConnectSecure API | Purpose in AEGIS |
|---|---|
| Vulnerability findings (CVE, severity, EPSS score) | Feed AEGIS scoring engine, compliance mapper |
| Patch compliance status | Patch Management scoring category |
| Endpoint inventory | Asset count, OS distribution, encryption status |
| PII exposure detection | Data Protection scoring category |
| CIS benchmark results | Compliance mapper |

**Secondary integrations: RMM platforms**

| RMM | Integration Method | Data Pulled |
|---|---|---|
| Datto RMM | API | Endpoint inventory, patch status, AV status, alerts |
| NinjaOne | API | Endpoint inventory, patch status, alerts |
| ConnectWise Automate | API | Endpoint inventory, patch status, scripts |

RMM data supplements ConnectSecure findings — no separate agent deployment required.

**Future option (Phase 4+): Wazuh**

If AEGIS needs to own the internal scanning layer entirely (eliminate ConnectSecure dependency), Wazuh is the open-source path. It provides unified XDR/SIEM with lightweight endpoint agents, file integrity monitoring, intrusion detection, and real-time active response. Heavier to deploy but zero licensing cost.

#### 3.1.3 AEGIS Probe — Network Discovery Appliance (Raspberry Pi)

A pre-configured Raspberry Pi device shipped to client sites for network discovery and lightweight assessment. Inspired by ThreatMate's Pi offering but designed as a cloud-reporting sensor, not a standalone scanner.

**Hardware:** Raspberry Pi 5 (8GB) + Ethernet + case + pre-flashed SD card. Cost per unit: ~$75-100.

**What the Probe Does:**

| Capability | Tool | Output |
|---|---|---|
| Asset discovery | Nmap | Host inventory, MAC addresses, OS fingerprints |
| Port scanning | Nmap | Open ports, service versions per host |
| Service fingerprinting | Nmap NSE scripts | Service identification, banner grabbing |
| SNMP enumeration | snmpwalk | Network device inventory (switches, APs, printers) |
| Basic vuln detection | Nmap vulners script | CVE matches for discovered services |
| Wireless survey | iwlist / airmon-ng (optional) | SSID inventory, encryption types |

**What the Probe Does NOT Do:**

- Full OpenVAS/Greenbone scans (Pi lacks the RAM/CPU — a 25-device scan can take days and crash)
- Authenticated credentialed scans
- Automated exploitation or pentesting
- Web application scanning

**Architecture:**

```
AEGIS Probe (on-site)                    AEGIS Cloud
┌─────────────────────┐                 ┌──────────────────────┐
│  Raspberry Pi 5     │   encrypted     │  AEGIS API           │
│  ├── Nmap           │   tunnel        │  ├── Normalize data  │
│  ├── snmpwalk       │ ──────────────► │  ├── Score findings  │
│  ├── AEGIS Agent    │   (WireGuard    │  ├── Map compliance  │
│  │   (Node.js)      │    or HTTPS)    │  ├── Generate report │
│  └── Auto-discover  │                 │  └── Store in DB     │
└─────────────────────┘                 └──────────────────────┘
```

- Probe boots, connects to AEGIS cloud via encrypted tunnel (WireGuard or HTTPS API)
- Runs discovery scan automatically on the local subnet
- Uploads results to AEGIS cloud for processing, scoring, and reporting
- All heavy analysis happens server-side — Pi is just a sensor
- Probe auto-updates its agent and Nmap scripts from AEGIS cloud

**Use Cases:**

1. **Prospecting:** Drop a Probe on a prospect's network during a sales visit. Retrieve results remotely. Generate branded report showing what their current MSP missed.
2. **Onboarding:** Ship a Probe to a new client. Get instant network inventory before the first tech visit.
3. **Ongoing monitoring:** Leave a Probe on-site for continuous asset discovery and change detection.
4. **Environments without RMM:** Some clients (especially prospects or M&A targets) have no RMM deployed. The Probe fills the gap.

**MSP Branding:** Probe shell can be branded with MSP logo sticker. AEGIS dashboard shows "Probe: [client name] — Last seen: [timestamp]".

#### 3.1.4 M365 / Cloud Config Checker — BUILT BY AEGIS

| Check | Description | Baseline |
|---|---|---|
| Secure Score Ingestion | Pull Microsoft Secure Score and recommendations | Microsoft Graph Security API |
| CISA M365 Baselines | SCuBA (Secure Cloud Business Applications) checks | CISA BOD 25-01 |
| Conditional Access | CA policy coverage and gap analysis | Entra ID |
| Mail Flow | Transport rules, anti-phishing, safe links/attachments | Exchange Online |
| SharePoint/OneDrive | External sharing, anonymous links, DLP policies | SharePoint API |
| Teams | Guest access, meeting policies, app permissions | Teams API |

---

### 3.2 Penetration Testing — Two Tiers

AEGIS offers two distinct penetration testing capabilities, differentiated by depth, cost, and use case.

#### 3.2.1 Tier 1: "AEGIS Security Validation" — BUILT BY AEGIS (Nuclei)

Automated vulnerability validation that goes beyond scanning to confirm whether discovered vulnerabilities are actually exploitable. This is NOT a full pentest — it's exploitability confirmation with evidence.

**Engine:** Nuclei (open source, ProjectDiscovery). Template-based architecture with a massive community-driven library of YAML templates. Zero false positives by design — if Nuclei confirms it, it's real.

**Why Nuclei:**

- Free and open source (MIT license) — no licensing cost
- Template-based — AEGIS curates and maintains a custom template library
- Fast execution — can validate hundreds of checks in minutes
- Zero false positives — templates are deterministic, not heuristic
- Extensible — write custom checks in YAML, no compiled code
- Active community — thousands of templates for current CVEs, misconfigs, exposures

**AEGIS Nuclei Template Library (curated for MSP/SMB):**

| Template Category | Examples |
|---|---|
| Email Security | DMARC enforcement, SPF alignment, DKIM validation |
| Authentication | Default credentials, exposed admin panels, weak auth |
| Cloud Misconfig | Open S3/Azure Blob, exposed management consoles |
| Network Exposure | Exposed RDP, SMB, VNC, database ports |
| TLS/SSL | Weak ciphers, expired certs, protocol downgrade |
| Web Application | OWASP Top 10 subset (XSS, SQLi, open redirects) |
| Infrastructure | Exposed version strings, unpatched known CVEs |
| MSP-Specific | Exposed RMM consoles, PSA login pages, ConnectWise/Datto misconfigs |

**Deployment Options:**

1. **Cloud-hosted (default):** AEGIS cloud runs Nuclei against external-facing targets. No client-side deployment needed.
2. **AEGIS Probe:** Nuclei runs locally on the Pi against internal targets, results uploaded to AEGIS cloud.
3. **Docker on client VM:** For environments where the MSP wants deeper internal validation, deploy a Nuclei Docker container on an existing server.

**Output:** Each validated finding produces:
- Confirmed exploitability status (not theoretical — proven)
- Evidence (HTTP response, screenshot, extracted data)
- Severity + AEGIS score impact
- Specific remediation steps
- Compliance framework tags

**Authorization:** Tier 1 validation runs automatically as part of the AEGIS scan pipeline. MSP must have a signed service agreement with the client that covers security scanning (standard MSA language). No separate authorization needed beyond existing MSP contract.

#### 3.2.2 Tier 2: "AEGIS Red Team" — PARTNER (Horizon3.ai NodeZero)

Full autonomous penetration testing that chains vulnerabilities, moves laterally, proves exploitability with evidence, and delivers CISO-grade attack path reporting. This is real offensive security.

**Partner: Horizon3.ai / NodeZero**

NodeZero is an autonomous pentest platform ($140M+ raised, 3,000+ organizations, available on Pax8 Marketplace). It safely attacks the environment to uncover what's actually exploitable, chains weaknesses together like a real adversary, and provides step-by-step remediation with 1-click verification.

**Why NodeZero (not Pentera or building our own):**

| Factor | NodeZero | Pentera | Build Our Own |
|---|---|---|---|
| MSP channel presence | Pax8 Marketplace, MSP/MSSP program | Enterprise-focused | N/A |
| Deployment | Docker container or OVA — minutes to deploy | On-premise appliance — heavier lift | Years of development |
| Internal + External | Both | Both | Would need both |
| Cloud pentesting | AWS, Azure, Kubernetes | Limited | N/A |
| AD password audit | Built-in | Limited | N/A |
| Pricing | $500-5,000/month based on assets | Higher, less flexible | Massive dev investment |
| Agent requirement | None — agentless | None | N/A |
| Scalability | Unlimited assets, concurrent tests | Capped at ~6,000 assets | N/A |
| MITRE ATT&CK mapping | Full framework alignment | Partial | N/A |

**Integration Architecture:**

```
MSP initiates pentest via AEGIS dashboard
         │
         ▼
┌──────────────────────────────┐
│  AEGIS orchestrates NodeZero │
│  via Horizon3.ai API         │
│  ├── Create test scope       │
│  ├── Set attack parameters   │
│  ├── Monitor progress        │
│  └── Retrieve results        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  NodeZero executes pentest   │
│  (Docker host on client      │
│   network for internal, or   │
│   Horizon3 cloud for ext)    │
│  ├── Network enumeration     │
│  ├── Vulnerability discovery │
│  ├── Exploit chaining        │
│  ├── Lateral movement        │
│  ├── Evidence collection     │
│  └── Remediation guidance    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  AEGIS post-processing       │
│  ├── Ingest NodeZero results │
│  ├── Map to AEGIS findings   │
│  ├── Compliance framework    │
│  │   mapping (HIPAA, NIST..) │
│  ├── Financial risk quant    │
│  ├── Update dual score       │
│  ├── Generate branded report │
│  └── Create PSA tickets      │
└──────────────────────────────┘
```

**NodeZero Test Types Available:**

| Test | Description | Deployment |
|---|---|---|
| Internal Pentest | Simulates attacker/malicious insider on internal network | Docker host on-site |
| External Pentest | Discovers and attacks public-facing assets | Horizon3 cloud |
| AD Password Audit | Tests for weak, breached, and reused passwords | Docker host on-site |
| Phishing Impact | Tests what an attacker can do with phished credentials | Docker host on-site |
| Cloud Pentest | AWS, Azure, Kubernetes privilege escalation and misconfig | Docker host + cloud |
| Rapid Response | Targeted test for emerging threats (zero-day CVEs) | Either |

**Authorization:** Tier 2 requires **explicit written authorization** from the client for each pentest engagement. AEGIS provides a standard authorization template. The MSP obtains signature before any NodeZero test is initiated. This is non-negotiable.

**Pricing Model:** AEGIS Red Team is a premium add-on service. The MSP pays Horizon3.ai for NodeZero (direct or via Pax8), and AEGIS provides the orchestration, compliance mapping, risk quantification, and branded reporting layer on top. AEGIS does not mark up NodeZero licensing — the value is in the intelligence layer.

#### 3.2.3 Tier Comparison

| | Tier 1: Security Validation | Tier 2: Red Team |
|---|---|---|
| Engine | Nuclei (open source, owned) | NodeZero (Horizon3.ai, partnered) |
| What it proves | "This vulnerability exists and is exploitable" | "An attacker can chain these weaknesses to reach domain admin" |
| Depth | Individual vulnerability confirmation | Full attack path simulation with lateral movement |
| Cost to MSP | Included in AEGIS subscription | Premium add-on (NodeZero subscription) |
| Authorization needed | Standard MSA coverage | Explicit written pentest authorization per engagement |
| Frequency | Continuous (runs with every scan cycle) | Scheduled (monthly/quarterly/on-demand) |
| Deployment | Cloud + Probe | Docker host on client network + cloud |
| Best for | Ongoing posture validation, QBR evidence | Compliance pentests, insurance requirements, real threat assessment |
| Report style | Finding-level evidence within AEGIS report | Full attack path narrative + AEGIS compliance/risk overlay |

### 3.3 Scoring Engine

#### 3.3.1 Composite Score Model

AEGIS produces a **dual score** per client:

1. **Posture Score** (0-100, inside-out): Weighted composite of internal findings, M365 config, endpoint compliance, identity hygiene
2. **Risk Rating** (A-F, outside-in): External attack surface assessment, aligned to SecurityScorecard-style grading for market familiarity

Both scores are presented together — this is the core differentiator. Neither competitor shows both.

#### 3.3.2 Scoring Categories

| Category | Weight (Default) | Direction |
|---|---|---|
| Identity & Access | 20% | Inside-out |
| Endpoint Security | 15% | Inside-out |
| Email Security | 15% | Both |
| Network Exposure | 15% | Outside-in |
| Data Protection | 10% | Inside-out |
| Patch Management | 10% | Inside-out |
| Cloud Configuration | 10% | Inside-out |
| Dark Web Exposure | 5% | Outside-in |

**MSP-customizable weights** — MSPs can adjust category weights per client based on vertical, risk tolerance, or compliance requirements. This directly addresses the Microsoft Secure Score limitation of fixed, non-customizable scoring.

#### 3.3.3 Vendor / Third-Party Risk Rating

- Rate any organization by domain (outside-in scan only)
- A-F letter grade with category breakdown
- Supply chain risk roll-up: aggregate vendor scores for clients with vendor dependencies
- Vendor watchlist with drift alerts
- Maps to cyber insurance questionnaire requirements

### 3.4 Compliance Mapper

Auto-maps scan findings to compliance frameworks:

| Framework | Use Case |
|---|---|
| HIPAA | Healthcare clients (ASCs, practices) — integrates with CVG-HIPAA |
| NIST CSF 2.0 | General cybersecurity framework |
| CIS Controls v8 | Technical security controls |
| SOC 2 Type II | Service organization compliance |
| CMMC 2.0 | Defense contractor supply chain |
| PCI DSS 4.0 | Payment card handling |
| FTC Safeguards Rule | Financial services |
| Cyber Insurance | Common carrier questionnaire requirements |

Each finding carries framework tags. Evidence is timestamped and stored for audit-ready export.

**CVG-HIPAA Integration:** AEGIS compliance findings for HIPAA-tagged controls automatically feed into CVG-HIPAA risk assessment workflows. Shared Supabase schema; no data duplication.

### 3.5 Risk Quantification Engine

Translates technical findings into business language:

- **Annualized Loss Expectancy (ALE):** Per-finding and aggregate, based on industry vertical, company size, and threat probability
- **Cyber Insurance Alignment:** Maps posture to common underwriting criteria; highlights gaps that increase premiums
- **Board-Ready Summaries:** Plain-language risk narrative generated by ReportGenAgent (Ducky AI)
- **What-If Modeling:** "If we remediate these 3 findings, projected ALE drops by $X"

### 3.6 Report Generator

Two report tiers:

| Report | Audience | Content |
|---|---|---|
| Executive Summary | Business owners, board, insurance | Dual score, trend, top 5 risks in plain language, financial exposure, peer comparison |
| Technical Detail | MSP techs, IT teams, auditors | Full finding inventory, CVE references, remediation steps, compliance mapping, evidence |

All reports are:
- **MSP-branded** (logo, colors, contact info from tenantConfig)
- **Exportable** as PDF
- **Schedulable** (monthly/quarterly auto-generation)
- **QBR-ready** — summary section designed to drop directly into CVG-MIDAS quarterly business reviews

#### 3.6.1 Remediation Specificity (vs. ThreatMate)

Every finding includes:
- **What:** Clear description of the issue
- **Why It Matters:** Business impact in plain language
- **How to Fix:** Specific, step-by-step remediation (e.g., "Add this DNS TXT record: `v=DMARC1; p=quarantine; rua=mailto:...`")
- **Effort:** Estimated time to remediate (Low/Medium/High)
- **Impact:** Score improvement if remediated
- **Framework Tags:** Which compliance controls this addresses

### 3.7 MSP Operations Layer

#### 3.7.1 PSA Integration

| PSA | Integration Method | Capabilities |
|---|---|---|
| ConnectWise Manage | REST API | Auto-ticket on finding, status sync, time entry |
| Autotask/Datto | REST API | Auto-ticket on finding, status sync |
| HaloPSA | REST API | Auto-ticket on finding, status sync |

Ticket creation rules are configurable per tenant: severity threshold, auto-assign tech, SLA mapping.

#### 3.7.2 RMM Data Ingestion

| RMM | Integration Method | Data Pulled |
|---|---|---|
| Datto RMM | API | Endpoint inventory, patch status, AV status |
| NinjaOne | API | Endpoint inventory, patch status, alerts |
| ConnectWise Automate | API | Endpoint inventory, patch status, scripts |

RMM data supplements ConnectSecure findings and feeds the AEGIS scoring engine (§3.3).

#### 3.7.3 Platform Cross-Integration

| App | Direction | Data Flow |
|---|---|---|
| CVG-MIDAS | AEGIS → MIDAS | Risk findings become QBR line items and roadmap recommendations |
| CVG-MER | AEGIS → MER | Posture scores feed M&A due diligence assessments (target company risk profile) |
| CVG-HIPAA | Bidirectional | AEGIS compliance mapper shares HIPAA control state; HIPAA risk assessment references AEGIS findings |
| CVG-CAELUM | AEGIS → CAELUM | Remediation projects can auto-generate SoW drafts |

### 3.8 Prospecting Mode

Lightweight workflow for pre-sales:

1. MSP enters prospect domain
2. External-only scan runs (no agent/RMM needed)
3. Branded risk report generated in minutes
4. Report delivered as PDF or shared link
5. Prospect record stored in AEGIS (converts to full client on contract)

Mirrors ThreatMate's prospecting workflow but with compliance mapping, risk quantification, and specific remediation — not generic "talk to your IT team."

---

## 4. Ducky AI Integration

### 4.1 Shared Agents Consumed

| Agent | Use in AEGIS |
|---|---|
| ComplianceAgent | Maps findings to framework controls, identifies gaps |
| RiskScoreAgent | Calculates financial exposure, risk quantification |
| ReportGenAgent | Generates executive summaries, plain-language narratives |
| DataExtractAgent | Parses RMM/PSA data, normalizes vendor scan results |
| ResearchAgent | Enriches findings with current threat intelligence |

### 4.2 Natural Language Interface

Via Ducky conversation layer:

- "What's our biggest exposure across healthcare clients right now?"
- "Show me all clients with DMARC set to none"
- "Which clients dropped in posture score this month?"
- "Generate a remediation plan for Compass Surgical ranked by impact-to-effort"
- "What would our score be if we fixed the top 5 findings?"

### 4.3 Multi-Model Consensus

Risk classification and compliance mapping use the Spaniel multi-model consensus pipeline (primary/secondary parallel, tertiary tiebreaker) to prevent hallucination in compliance tagging and financial risk calculations.

### 4.4 Ducky Branding

- Ducky animated personality present in AEGIS UI (9 Lottie animation states)
- "Powered by Ducky AI" in footer
- Tenant-branded instances retain Ducky ("Intel Inside" model)

---

## 5. Freemium Landing Page & Lead Generation

### 5.1 Concept

The public-facing AEGIS landing page (`aegis.cavaridge.com` or `security.cavaridge.com`) includes a freemium scan-to-lead-capture funnel, modeled after ThreatMate's prospecting page but delivering substantially more value in the free tier.

### 5.2 Freemium Scan Flow

```
┌──────────────────────────────────┐
│     Landing Page (Public)         │
│                                   │
│  [Enter your domain]  [Scan Now]  │
│                                   │
│  Lead capture: Name, Email,       │
│  Company, Phone (optional)        │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│     Scan Processing               │
│  (External-only, no auth needed)  │
│                                   │
│  DNS Health · TLS/SSL · Headers   │
│  Subdomain Discovery              │
│  Dark Web (limited, 3 results)    │
│  DMARC/SPF/DKIM                   │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│     Results Page                  │
│                                   │
│  Dual Score Preview:              │
│  - Risk Rating: B (or A-F)       │
│  - Top 3 findings (teaser)       │
│  - "X issues found" summary      │
│                                   │
│  [Download Full Report - FREE]    │
│  (triggers email delivery +       │
│   CRM/pipeline entry)            │
│                                   │
│  [Get Complete Assessment →]      │
│  (upsell to MSP engagement)      │
└──────────────────────────────────┘
```

### 5.3 Free Report vs. ThreatMate Free Report

| Element | ThreatMate Free | AEGIS Free |
|---|---|---|
| Score type | 0-100 numeric | A-F letter grade + 0-100 |
| Findings shown | Severity only | Severity + specific remediation steps |
| Recommendations | Generic ("talk to your IT team") | Actionable ("update DNS TXT record to...") |
| Compliance mapping | None | Teaser: "This finding impacts HIPAA §164.312(e)(1)" |
| Financial risk | None | Teaser: "Estimated exposure: $XX,000-$XX,000" |
| Trend data | None (single snapshot) | None (single snapshot — trend requires subscription) |
| Branding | ThreatMate-branded or MSP-branded | AEGIS-branded (MSP branding requires subscription) |
| CTA | "Contact your IT partner" | Specific next steps + "Connect with an MSP partner" |

### 5.4 MSP White-Label Option

Subscribed MSPs can deploy their own branded version of the freemium scanner:

- Custom domain (e.g., `security.dedicatedit.com`)
- MSP logo, colors, contact info
- Leads route to MSP's pipeline (webhook or CRM integration)
- MSP controls which findings are shown in free tier

### 5.5 Lead Pipeline

```
Scan submitted → Contact stored in AEGIS prospects table
                → Webhook to CRM (HubSpot, Salesforce, ConnectWise Sell)
                → Auto-email: branded PDF report
                → 7-day nurture: "Did you review your findings?"
                → 30-day follow-up: "Your report expires — rescan?"
```

---

## 6. Data Model (Core Tables)

```
tenants (UNIVERSAL — defined in packages/auth/, shared across all apps)
├── id (uuid, PK)
├── name
├── type (enum: platform | msp | client | site | prospect)
├── parent_id (FK → tenants, nullable — self-referencing hierarchy)
├── config (jsonb — branding, scan policies, weight overrides, feature flags)
└── created_at, updated_at

scans
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── scan_type (enum: external | internal | m365 | full | nuclei_validation | nodezero_pentest | probe_discovery)
├── status (enum: queued | running | complete | failed)
├── initiated_by (FK → users)
├── started_at, completed_at
└── metadata (jsonb — scan config, target domains, options)

findings
├── id (uuid, PK)
├── scan_id (FK → scans)
├── tenant_id (FK → tenants)
├── category (enum: identity | endpoint | email | network | data | patch | cloud | darkweb)
├── severity (enum: critical | high | medium | low | informational)
├── title
├── description
├── remediation (text — specific fix steps)
├── effort (enum: low | medium | high)
├── score_impact (decimal — projected score change if remediated)
├── asset (text — affected domain, IP, endpoint, user)
├── source (enum: aegis_external | connectsecure | rmm | m365_graph | nuclei | nodezero | probe | manual)
├── framework_tags (jsonb — [{framework, control_id, control_name}])
├── financial_exposure (jsonb — {ale_low, ale_high, currency})
├── status (enum: open | in_progress | remediated | accepted | false_positive)
├── psa_ticket_id (text, nullable)
└── found_at, remediated_at

scores
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── scan_id (FK → scans)
├── posture_score (integer, 0-100)
├── risk_rating (enum: A | B | C | D | F)
├── category_scores (jsonb — per-category breakdown)
├── weight_config (jsonb — weights used for this calculation)
└── scored_at

vendors
├── id (uuid, PK)
├── tenant_id (FK → tenants, the client monitoring this vendor)
├── domain
├── name
├── risk_rating (enum: A | B | C | D | F)
├── last_scanned_at
└── findings_summary (jsonb)

compliance_maps
├── id (uuid, PK)
├── finding_id (FK → findings)
├── framework (enum: hipaa | nist_csf | cis | soc2 | cmmc | pci | ftc | insurance)
├── control_id (text)
├── control_name (text)
├── status (enum: met | gap | partial)
└── evidence (jsonb — timestamped proof)

reports
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── scan_id (FK → scans, nullable)
├── report_type (enum: executive | technical | prospecting | qbr_summary)
├── format (enum: pdf | html)
├── storage_path (text)
├── generated_at
└── metadata (jsonb — branding config, recipient info)

prospects
├── id (uuid, PK)
├── msp_tenant_id (FK → tenants, the MSP who owns this lead)
├── domain
├── contact_name
├── contact_email
├── contact_phone (nullable)
├── company_name
├── scan_id (FK → scans)
├── crm_synced (boolean)
├── crm_id (text, nullable)
├── nurture_stage (enum: scanned | report_sent | followup_1 | followup_2 | converted | expired)
└── created_at, converted_at
```

All tables enforce RLS via `tenant_id`. Prospect data is scoped to the MSP tenant that generated the lead.

### Additional Tables (Pentest + Probe)

```
pentests
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── tier (enum: validation | redteam)
├── engine (enum: nuclei | nodezero)
├── status (enum: pending_auth | authorized | queued | running | complete | failed)
├── scope (jsonb — target IPs, domains, exclusions)
├── authorization (jsonb — signed_by, signed_at, document_path)
├── nodezero_test_id (text, nullable — Horizon3 API reference)
├── initiated_by (FK → users)
├── started_at, completed_at
└── metadata (jsonb — test config, attack parameters)

pentest_findings
├── id (uuid, PK)
├── pentest_id (FK → pentests)
├── finding_id (FK → findings, nullable — links to unified findings table)
├── attack_path (jsonb — step-by-step exploit chain)
├── evidence (jsonb — screenshots, HTTP responses, extracted data)
├── exploitability_confirmed (boolean)
├── mitre_attack_ids (text[] — MITRE ATT&CK technique IDs)
└── created_at

probes
├── id (uuid, PK)
├── tenant_id (FK → tenants — the client site where the probe is deployed)
├── msp_tenant_id (FK → tenants — the MSP that owns the probe)
├── serial_number (text — hardware identifier)
├── status (enum: provisioned | online | offline | decommissioned)
├── last_seen_at (timestamptz)
├── firmware_version (text)
├── config (jsonb — scan schedule, target subnets, tunnel config)
├── last_scan_id (FK → scans, nullable)
└── created_at, updated_at
```

---

## 7. Security & Compliance

### 7.1 Platform Security

- All scan data encrypted at rest (Supabase/PostgreSQL encryption) and in transit (TLS 1.2+ only)
- No plaintext secrets in any repo; `.env` gitignored; dev secrets in Replit Secrets; staging/prod in Doppler
- Tenant isolation enforced at DB RLS, API middleware, UI, and Spaniel request headers
- Scan operations use minimum-privilege API tokens (e.g., Microsoft Graph read-only scopes)
- All LLM access routes through OpenRouter via Spaniel (Cavaridge master key; no app-level keys)
- Audit logging via `@cavaridge/audit` package

### 7.2 Scan Ethics & Authorization

**External scans (§3.1.1):** Non-intrusive reconnaissance only. No exploitation, no credential stuffing, no active attacks. Safe to run against any domain without explicit authorization (equivalent to what any browser or search engine does).

**Internal integration (§3.1.2):** AEGIS ingests data from tools the MSP has already deployed (ConnectSecure, RMM agents). No additional agent deployment by AEGIS. The MSP's existing service agreement with the client covers this data access.

**AEGIS Probe (§3.1.3):** Physical device deployed on client network. Requires MSP to have the client's permission to place the device. Standard MSA language covers network discovery. Probe runs Nmap — no exploitation.

**Pentest Tier 1 — Security Validation (§3.2.1):** Nuclei-based exploitability confirmation. Runs within the scope of the MSP's existing service agreement. Templates are deterministic and safe — they confirm a vulnerability exists without causing damage. Covered by standard MSA.

**Pentest Tier 2 — Red Team (§3.2.2):** NodeZero autonomous pentesting. Requires **explicit written authorization** per engagement. AEGIS provides a standard authorization template. The MSP obtains client signature before any test is initiated. This is non-negotiable — no exceptions. NodeZero performs benign exploitation (proves it's possible without causing damage) but the authorization must cover:
- Scope (IP ranges, domains, cloud accounts included/excluded)
- Timing (approved test window)
- Notification (who is informed during/after the test)
- Evidence handling (how results are stored and shared)
- Liability (standard hold-harmless language)

- Rate limiting on all scan operations to prevent abuse
- Freemium scans rate-limited per IP and per domain (prevent competitor abuse)
- AEGIS Probe phone-home frequency limited to prevent bandwidth impact

### 7.3 Data Retention

- Active tenant data: retained for duration of subscription + 90 days
- Prospect/freemium data: retained for 90 days, then purged unless converted
- Scan history: configurable per tenant (default 24 months for trend analysis)
- Compliance evidence: retained per framework requirements (HIPAA: 6 years minimum)

---

## 8. UI / UX

### 8.1 Theme

- Light / Dark / System modes (Cavaridge universal standard)
- Ducky animated presence in all views

### 8.2 Key Views

| View | Description |
|---|---|
| MSP Dashboard | All-client overview: score heatmap, top risks, trend sparklines, alerts |
| Client Detail | Dual score, finding inventory, compliance status, trend chart, vendor roll-up |
| Scan Results | Finding list with severity, remediation, effort, impact, framework tags |
| Compliance View | Framework-by-framework control status with evidence links |
| Vendor Risk | Third-party monitoring dashboard with A-F ratings and alerts |
| Report Builder | Generate/schedule reports, select template, preview, export |
| Prospect Pipeline | Freemium leads, scan status, nurture stage, conversion tracking |
| Settings | Scan policies, weight config, PSA/RMM connections, branding |

### 8.3 Freemium Landing Page Design

- Clean, professional, trust-focused design
- Domain input field with "Scan Now" CTA above the fold
- Social proof: "X organizations scanned" counter
- How-it-works: 3-step visual (Enter Domain → We Scan → Get Report)
- Sample report preview (blurred/partial)
- Lead capture: Name, Email, Company required; Phone optional
- Privacy notice: scan data not shared; GDPR/CCPA compliant

---

## 9. Build Plan

### 9.1 MVP Scope (Phase 1)

**Goal:** Functional freemium scanner + basic MSP portal with external scanning, Nuclei validation, and reporting.

1. **Freemium landing page** — domain input, lead capture, email delivery
2. **External scanner** — DNS (SPF/DKIM/DMARC), TLS/SSL, HTTP headers, subdomain discovery
3. **Nuclei Tier 1 validation** — curated template library for external targets (email security, TLS, exposed services, default creds)
4. **Scoring engine** — outside-in A-F rating with category breakdown
5. **Report generator** — PDF output with branded template, specific remediation steps, exploitability evidence
6. **Prospect pipeline** — lead storage, basic CRM webhook (HubSpot)
7. **Multi-tenant data model** — Supabase schema with UTM (packages/auth/)
8. **Basic MSP dashboard** — client list, scores, findings

### 9.2 Phase 2: Inside-Out + Compliance

1. **ConnectSecure API integration** — ingest vuln findings, patch status, EPSS scores, CIS benchmarks
2. **M365 config checker** — Microsoft Graph integration, CISA SCuBA baselines
3. **Posture Score** — inside-out scoring alongside existing risk rating (dual score)
4. **Compliance mapper** — HIPAA, NIST CSF, CIS Controls mapping
5. **CVG-HIPAA integration** — shared compliance state
6. **Identity & access checks** — MFA coverage, stale accounts via Entra ID
7. **Trend tracking** — score-over-time visualization

### 9.3 Phase 3: Operations + AI + Pentest Tier 2

1. **RMM integration** — endpoint data ingestion (Datto RMM, NinjaOne)
2. **PSA integration** — auto-ticket creation (ConnectWise, Autotask, HaloPSA)
3. **Horizon3.ai NodeZero integration** — Tier 2 Red Team pentest orchestration via API
4. **Pentest authorization workflow** — template generation, client signature capture, scope management
5. **Ducky AI agents** — natural language queries, AI-generated remediation plans
6. **Risk quantification** — ALE calculations, what-if modeling
7. **CVG-MIDAS integration** — findings → QBR line items
8. **Vendor risk module** — third-party domain monitoring with A-F ratings

### 9.4 Phase 4: Scale + Hardware

1. **AEGIS Probe** — Raspberry Pi pre-configuration, auto-provisioning, encrypted cloud tunnel, OTA updates
2. **AEGIS Probe management dashboard** — probe inventory, connectivity status, remote commands
3. **Nuclei internal templates** — expand Tier 1 to cover internal targets via Probe and Docker deployment
4. **CVG-MER integration** — posture scores for M&A targets
5. **CVG-CAELUM integration** — auto-generate remediation SoWs
6. **MSP white-label scanner** — custom domain, branding, lead routing
7. **Additional compliance frameworks** — SOC 2, CMMC, PCI DSS, FTC Safeguards
8. **Dark web monitoring** — continuous credential exposure alerting
9. **Scheduled scanning** — configurable cadence with drift detection
10. **Wazuh evaluation** — assess feasibility of replacing ConnectSecure dependency with owned XDR layer

---

## 10. Build Order Placement

### 10.1 Current Build Order (Pre-AEGIS)

```
Spaniel → Ducky → Caelum → Meridian → HIPAA → Midas → rest
```

### 10.2 Proposed Build Order (With AEGIS)

```
Spaniel → Ducky → Caelum → Meridian → HIPAA → AEGIS → Midas → rest
```

**Rationale:**
- AEGIS Phase 1 (freemium scanner + external scan) can begin development in parallel with HIPAA since the external scanner is independent of the agent stack
- AEGIS Phase 2 shares the compliance mapper with CVG-HIPAA — co-development reduces duplicate work
- AEGIS feeds into Midas (QBR) so it should be operational before Midas reaches full feature set
- The freemium landing page is a **revenue and lead-gen tool from day one** — high business value even before full platform completion
- Spaniel + Ducky must be operational for Phase 3 (AI agents)

**Alternative consideration:** AEGIS Phase 1 (freemium + external scan) could launch even earlier as a standalone microservice since it doesn't depend on Spaniel/Ducky. The lead-gen value alone justifies early deployment.

---

## 11. CLAUDE.md Updates Required

The following changes must be made to the monorepo `CLAUDE.md` to reflect AEGIS:

### 11.1 App Registry Addition

Add to the app code registry:

```
CVG-AEGIS — Aegis (Security Posture & Risk Intelligence Platform)
```

### 11.2 Architecture Doc Reference

Add to the architecture docs list:

```
docs/architecture/CVG-AEGIS-ARCH-v1.0.0-20260314.md
```

### 11.3 Build Order Update

Update the build sequence to:

```
Spaniel → Ducky → Caelum → Meridian → HIPAA → AEGIS → Midas → rest
```

### 11.4 Shared Agent Reference

If not already listed, confirm these agents reference AEGIS as a consumer:
- ComplianceAgent
- RiskScoreAgent
- ReportGenAgent
- DataExtractAgent
- ResearchAgent

### 11.5 Cross-App Integration Reference

Add AEGIS to the integration map for:
- CVG-HIPAA (bidirectional compliance state)
- CVG-MIDAS (findings → QBR line items)
- CVG-MER (posture scores → M&A due diligence)
- CVG-CAELUM (remediation → SoW drafts)

---

## 12. Open Questions

1. **Domain:** `aegis.cavaridge.com` vs. `security.cavaridge.com` vs. dedicated domain?
2. **ConnectSecure vs. alternatives:** ConnectSecure is the recommended internal scanning partner. Evaluate pricing and API capabilities before committing. Alternatives: Nodeware, HostedScan.
3. **Horizon3.ai commercial terms:** Negotiate MSP partner pricing via Pax8 or direct. Understand per-tenant vs. per-asset licensing for NodeZero.
4. **AEGIS Probe hardware:** Raspberry Pi 5 (8GB) is the target. Evaluate Pi 4 (4GB) as lower-cost option. Define the pre-flash image build pipeline and OTA update mechanism.
5. **Probe logistics:** Who assembles and ships the Probes? Pre-built by Cavaridge? Or a hardware fulfillment partner? Cost per unit at scale (10, 50, 100)?
6. **Nuclei template curation:** Who maintains the AEGIS Nuclei template library? Internal Cavaridge security team? Community contributions from MSP partners? How often are templates updated?
7. **Freemium abuse prevention:** Rate limiting strategy for scan-to-lead funnel (prevent scraping, competitor scanning at scale)
8. **Dark web data source:** Which breach database / OSINT provider for credential exposure checks?
9. **Pricing model:** Per-client-per-month for MSPs? Tiered by client count? Free tier limits? Separate pricing for Tier 2 Red Team?
10. **Pentest authorization template:** Legal review of standard authorization language for Tier 2. Must cover scope, timing, liability, and evidence handling.
11. **ThreatMate coexistence:** Could AEGIS ingest ThreatMate scan data as an additional data source for MSPs already using ThreatMate? Or is this a clean competitive replacement?

---

## Appendix A: Naming Confirmation

| Attribute | Value |
|---|---|
| Full Name | Aegis |
| App Code | CVG-AEGIS |
| Origin | Greek mythology — the shield of Zeus, symbolizing protection |
| Spelling | Simple, universally known, easily spelled |
| Memorability | Strong brand recall, "aegis" is commonly used in English ("under the aegis of") |
| Domain Options | aegis.cavaridge.com, security.cavaridge.com |
| Consistency | Fits Cavaridge naming pattern (Caelum, Meridian, Astra, Midas, Vespar, Ceres) |

---

*End of document. This architecture specification is the property of Cavaridge, LLC.*
