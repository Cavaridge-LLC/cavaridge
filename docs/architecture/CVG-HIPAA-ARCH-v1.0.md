# CVG-HIPAA Architecture Document v1.0

**Application Code:** CVG-HIPAA
**Name:** HIPAA Risk Assessment Toolkit
**Status:** Active
**Date:** 2026-03-27
**Owner:** Cavaridge, LLC (D-U-N-S: 138750552)

---

## 1. Overview

CVG-HIPAA provides MSPs serving healthcare clients with a structured HIPAA Security Rule risk assessment workflow, gap analysis, remediation tracking, and compliance reporting. It is one of the core compliance apps in the Cavaridge platform and feeds into Meridian (M&A risk), AEGIS (bidirectional compliance state), and Caelum (remediation SoW generation).

### Target Market

- Managed Service Providers (MSPs) with healthcare client portfolios
- Healthcare organizations requiring annual HIPAA Security Rule risk assessments
- Compliance consultants providing HIPAA audit support

### Competitive Positioning

- Unlike static checklist tools, CVG-HIPAA provides a weighted risk scoring engine aligned to NIST CSF
- Contextual intelligence via Ducky (AI-powered gap analysis recommendations)
- Integrated remediation tracking with SoW auto-generation via Caelum
- Multi-tenant: MSPs manage multiple healthcare client assessments from a single dashboard

---

## 2. Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + Express 5 |
| Frontend | React 18 + Vite + Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL 16 via Supabase + Drizzle ORM |
| Auth | Supabase Auth + UTM (packages/auth/) |
| LLM | @cavaridge/spaniel (OpenRouter) — gap analysis recommendations |
| Hosting | Railway (single service) |

### Directory Structure

```
apps/hipaa/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── QuickCheck.tsx      ← Freemium 20-question assessment
│       │   ├── Assessment.tsx      ← Full wizard assessment
│       │   ├── Remediation.tsx     ← Remediation tracking
│       │   └── Dashboard.tsx       ← Assessment overview
│       └── components/
├── server/
│   ├── routes/
│   │   ├── assessments.ts          ← Assessment CRUD + wizard state
│   │   ├── controls.ts             ← Control catalog queries
│   │   ├── remediation.ts          ← Remediation item CRUD
│   │   ├── reports.ts              ← PDF/XLSX generation
│   │   ├── gap-analysis.ts         ← AI-powered gap analysis
│   │   └── quickcheck.ts           ← Freemium scoring endpoint
│   ├── data/
│   │   └── hipaa-security-controls.ts  ← Full 42-standard control catalog
│   └── services/
│       ├── assessment-engine.ts    ← Scoring engine
│       └── report-generator.ts     ← Branded output
└── shared/
    └── schema.ts                   ← Drizzle schema
```

---

## 3. Assessment Workflow

The assessment follows a wizard-style flow organized by HIPAA Security Rule safeguard categories:

### Section 1: Administrative Safeguards (§164.308)

12 standards covering security management, workforce security, information access management, security awareness training, security incident procedures, contingency planning, and evaluation.

### Section 2: Physical Safeguards (§164.310)

4 standards covering facility access controls, workstation use, workstation security, and device/media controls.

### Section 3: Technical Safeguards (§164.312)

5 standards covering access control, audit controls, integrity, person or entity authentication, and transmission security.

### Section 4: Organizational Requirements (§164.314)

2 standards covering business associate contracts and group health plan requirements.

### Flow

1. **Create Assessment** — Select client, assessment type (initial/annual/ad-hoc), assign assessor
2. **Answer Controls** — Step through each control with status (Implemented / Partially / Not Implemented / N/A) + evidence notes
3. **Auto-Score** — Engine calculates weighted risk score per control, per section, and overall
4. **Gap Analysis** — AI-driven analysis of gaps with prioritized remediation recommendations
5. **Generate Report** — PDF executive summary + XLSX detailed findings
6. **Create Remediation Plan** — Convert findings to actionable remediation items with due dates
7. **Track Progress** — Monitor remediation completion rates, trigger re-assessment when ready

---

## 4. Control Catalog

The catalog is sourced from 45 CFR Parts 160 and 164 (HIPAA Security Rule):

| Category | Standards | Implementation Specifications |
|----------|-----------|-------------------------------|
| Administrative (§164.308) | 12 | 32 |
| Physical (§164.310) | 4 | 12 |
| Technical (§164.312) | 5 | 9 |
| Organizational (§164.314) | 2 | 6 |
| Policies & Documentation (§164.316) | 1 | 2 |
| **Total** | **24** | **61** |

Each control has:
- `standard_id` — CFR reference (e.g., `164.308(a)(1)`)
- `requirement_type` — Required (R) or Addressable (A)
- `nist_csf_mapping` — Maps to NIST CSF 2.0 function (Identify, Protect, Detect, Respond, Recover)
- `severity_weight` — 1.0 (low) to 4.0 (critical), based on breach impact potential
- `description` and `implementation_guidance`

### Implementation stored at:

`apps/hipaa/server/data/hipaa-security-controls.ts` — Full catalog with all fields, severities, and NIST CSF mappings.

---

## 5. Risk Scoring Methodology

### Per-Control Score (0–4 scale)

| Status | Score | Meaning |
|--------|-------|---------|
| Implemented | 0 | Control fully in place with evidence |
| Partially Implemented | 1–2 | Control exists but gaps remain (assessor judgment) |
| Not Implemented | 3 | Control absent — risk present |
| N/A | — | Not applicable (excluded from scoring) |

### Weighted Risk Score

```
Control Risk = status_score × severity_weight × nist_alignment_factor
Section Risk = Σ(control_risks) / Σ(max_possible_risks) × 100
Overall Risk = Weighted average of section risks
```

**NIST CSF Alignment Factor:**
| Function | Factor | Rationale |
|----------|--------|-----------|
| Protect | 1.2 | Preventive controls reduce breach probability |
| Detect | 1.1 | Detection enables rapid response |
| Respond | 1.0 | Standard response weight |
| Recover | 0.9 | Recovery mitigates impact |
| Identify | 0.8 | Governance controls are foundational |

### Risk Rating Bands

| Score Range | Rating | Color |
|-------------|--------|-------|
| 0–20 | Low Risk | Green |
| 21–40 | Moderate Risk | Yellow |
| 41–60 | Elevated Risk | Orange |
| 61–80 | High Risk | Red |
| 81–100 | Critical Risk | Dark Red |

---

## 6. Report Formats

### PDF Executive Summary

- Cavaridge branding (Header #2E5090, Arial font, #F2F6FA row banding)
- Overall risk score with rating badge
- Section-by-section risk breakdown (bar chart)
- Top 10 highest-risk findings
- Remediation priority matrix
- Assessor signature block

### XLSX Detailed Findings

- **Tab 1: Executive Summary** — Scores, ratings, assessment metadata
- **Tab 2: Control Status** — Every control with status, score, evidence notes
- **Tab 3: Gap Analysis** — Gaps prioritized by risk score
- **Tab 4: Remediation Plan** — Recommended actions, owners, due dates, estimated effort
- **Tab 5: Historical Comparison** — Delta from previous assessment (if available)

### Remediation XLSX

- Standalone remediation tracker exportable to client project management tools
- Status tracking: Not Started / In Progress / Complete / Deferred
- Estimated cost ranges per remediation item

---

## 7. Freemium Tier: HIPAA QuickCheck

**Route:** `/quickcheck` (public, no auth)

A 20-question self-assessment covering HIPAA Security Rule basics. Each question maps to one or more control standards.

### Flow

1. User answers 20 yes/no questions
2. Deterministic scoring: each "No" adds weighted risk points
3. Instant risk score (0-100) + gap summary displayed
4. Lead capture form (name, email, company, phone)
5. Branded PDF download with results

### Design

- Dark theme (#0f172a background, Cavaridge blue #2E5090 accents)
- Inline styles (no Tailwind dependency for freemium pages)
- Client-side processing only — no data retention
- No Supabase, no auth, no server-side storage

### Question Categories (20 questions)

| Category | Questions | Weight |
|----------|-----------|--------|
| Risk Analysis & Management | 4 | High |
| Access Controls | 3 | High |
| Audit Controls | 2 | Medium |
| Encryption & Integrity | 3 | High |
| Workforce Training | 2 | Medium |
| Incident Response | 2 | Medium |
| Business Associates | 2 | High |
| Physical Security | 2 | Low |

---

## 8. Full Tier

### Tenant-Scoped Assessments

- All assessment data stored in `hipaa` schema with `tenant_id` FK
- RLS enforced at database level via Supabase
- MSP Admin sees all client assessments; Client Admin sees only their own

### Historical Diffing Engine

- Each assessment creates a snapshot of all control statuses
- Delta engine compares current vs. previous assessment
- Highlights: newly implemented controls, regressions, unchanged gaps
- Trend visualization: risk score over time (line chart)

### Remediation Tracking

- Convert any finding to a remediation item
- Assign owner, due date, priority, estimated cost
- Status workflow: Not Started → In Progress → Complete / Deferred
- Automated reminders for overdue items
- Completion percentage feeds back into assessment dashboard

### Ducky Intelligence Integration

- AI-powered gap analysis recommendations via @cavaridge/spaniel
- Per-finding remediation suggestions with implementation guidance
- Executive summary narrative generation
- All LLM calls scoped to HIPAA domain agent knowledge

---

## 9. Cross-App Integration

| Direction | Integration |
|-----------|-------------|
| HIPAA → AEGIS | Bidirectional compliance state sync. HIPAA assessment findings update AEGIS compliance posture. AEGIS browser security findings flag technical safeguard gaps. |
| HIPAA → Meridian | Compliance gaps surface as M&A acquisition risk factors. Assessment scores feed due diligence risk models. |
| HIPAA → Caelum | High-risk findings auto-generate remediation SoW drafts via Caelum's SoW engine. |
| HIPAA → Midas | Assessment scores and remediation progress feed QBR reporting. |
| tenant-intel → HIPAA | M365/GWS config data auto-populates technical safeguard responses (encryption, access controls, audit logging). |

---

## 10. Domain Agent Consumption

| Agent | Usage |
|-------|-------|
| HIPAA Compliance Agent | Primary knowledge source. 45 CFR Parts 160/164 guardrails. Provides control interpretation, regulatory citation, and implementation guidance. |
| HITRUST Agent | Cross-maps HIPAA controls to HITRUST CSF v11 for organizations pursuing HITRUST certification. |
| CMS/Medicare Agent | Provides CMS Conditions of Participation context for healthcare facilities subject to both HIPAA and CMS requirements. |
| Cybersecurity Agent | NIST CSF alignment, CIS Controls mapping for technical safeguard implementation guidance. |

---

## 11. UTM Mapping

| UTM Tier | HIPAA Role | Access |
|----------|-----------|--------|
| Platform Admin | Platform Admin | Full access — all tenants, all assessments |
| MSP Admin | Compliance Director | All client assessments, report generation, template management |
| MSP Tech | Assessor | Assigned client assessments, control evaluation, evidence upload |
| Client Admin | Client Compliance Officer | Own organization assessments, remediation tracking, report access |
| Client Viewer | Compliance Viewer | Read-only access to assessment results and reports |
| Prospect | QuickCheck User | Freemium QuickCheck only — no tenant data |

---

## 12. Build Phases

| Phase | Timeline | Deliverables |
|-------|----------|-------------|
| Phase 1 (Current) | Q2 2026 | QuickCheck freemium page, control catalog, assessment CRUD, basic scoring engine, PDF/XLSX reports |
| Phase 2 | Q3 2026 | Historical diffing, remediation tracking, Ducky gap analysis, tenant-intel auto-population |
| Phase 3 | Q4 2026 | AEGIS bidirectional sync, Caelum SoW generation, Midas QBR integration |
| Phase 4 | Q1 2027 | HITRUST cross-mapping, CMS CoP overlay, multi-framework assessment support |

---

## 13. Data Model (Key Tables)

All tables in `hipaa` schema with `tenant_id` FK and RLS enabled.

| Table | Purpose |
|-------|---------|
| `hipaa.assessments` | Assessment metadata (client, assessor, type, status, dates, overall_score) |
| `hipaa.assessment_responses` | Per-control responses (assessment_id, control_id, status, score, evidence_notes) |
| `hipaa.remediation_items` | Remediation tasks (assessment_id, control_id, owner, due_date, status, cost_estimate) |
| `hipaa.assessment_snapshots` | Point-in-time snapshots for historical diffing |
| `hipaa.quickcheck_leads` | Freemium lead capture (name, email, company, score, created_at) |
| `hipaa.report_exports` | Generated report metadata and storage references |

---

## 14. Security Considerations

- **PHI Handling:** Assessment data may reference PHI in evidence notes. All data encrypted at rest (Supabase default). Evidence uploads scanned for PHI markers before storage.
- **Data Retention:** Assessment data retained per tenant policy (minimum 6 years per HIPAA requirement). Freemium QuickCheck retains zero assessment data — lead contact info only.
- **Access Control:** RLS enforced at every query. No cross-tenant data leakage possible.
- **Audit Trail:** All assessment modifications logged with user, timestamp, and change delta.
- **LLM Safety:** All Ducky-powered analysis routes through @cavaridge/compliance-gateway. PHI de-identification applied before any LLM call. BAA-covered model routing enforced for HIPAA tenant contexts.
- **Export Security:** PDF/XLSX reports generated server-side. Downloads authenticated and scoped to tenant.

---

*Cavaridge, LLC is the sole IP owner of all CVG-HIPAA code, documentation, and methodology.*
