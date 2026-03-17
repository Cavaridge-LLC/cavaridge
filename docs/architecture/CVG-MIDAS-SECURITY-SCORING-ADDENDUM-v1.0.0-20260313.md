# CVG-MIDAS — Security Scoring Module Addendum

**Version:** 1.0.0  
**Date:** 2026-03-13  
**Author:** Benjamin Posner  
**Status:** DRAFT  
**IP Owner:** Cavaridge, LLC (D-U-N-S: 138750552)  
**Parent Document:** CVG-MIDAS application architecture (TBD)  
**Dependency:** @cavaridge/tenant-intel v1.0.0

---

## 1. Purpose

This addendum defines the Security Scoring Module within Midas (CVG-MIDAS). The module consumes security posture data from `@cavaridge/tenant-intel` and produces a **Cavaridge Adjusted Security Score** that accounts for compensating third-party controls — giving MSPs and their clients a realistic view of their actual security posture rather than the misleading native scores from Microsoft or Google.

### 1.1 Problem Statement

Microsoft Secure Score and Google Workspace Security Health penalize organizations for not using native platform security tools, even when equivalent or superior third-party solutions are in place. This creates two problems for MSPs:

1. **Client perception:** Clients see low scores and question their MSP's competence
2. **QBR noise:** MSPs waste time explaining why the native score is wrong instead of focusing on real gaps

The Security Scoring Module solves both by producing a defensible, auditable adjusted score that MSPs can present with confidence.

---

## 2. Architecture

### 2.1 Module Location

```
apps/
  midas/
    src/
      modules/
        security-scoring/
          index.ts                     # Module public API
          adjusted-score.ts            # Core scoring engine
          compensating-controls/
            catalog.ts                 # Master catalog of third-party mappings
            types.ts                   # CompensatingControl types
            matcher.ts                 # Auto-detection logic
            overrides.ts               # Manual MSP override management
          reports/
            score-report.ts            # QBR-ready score output
            gap-report.ts              # Real gaps (uncompensated controls)
            trend-report.ts            # Score trend over time
          agents/
            security-advisor-agent.ts  # Recommendation engine
```

### 2.2 Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                  @cavaridge/tenant-intel                   │
│                                                           │
│  SecurityPosture ──► SecurityControl[] ──► NativeScore    │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Midas: Security Scoring Module                │
│                                                           │
│  ┌─────────────────────┐   ┌──────────────────────────┐  │
│  │ Compensating Control │   │  Tenant-Intel Detected   │  │
│  │   Catalog            │   │  Software/Services       │  │
│  │  (curated mappings)  │   │  (auto-match candidates) │  │
│  └──────────┬──────────┘   └────────────┬─────────────┘  │
│             │                           │                 │
│             ▼                           ▼                 │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Matcher Engine                       │    │
│  │  For each unimplemented native control:           │    │
│  │   1. Check auto-detected third-party services     │    │
│  │   2. Check manual MSP overrides                   │    │
│  │   3. Check compensating control catalog            │    │
│  │   4. Assign: compensated | partial | real_gap      │    │
│  └──────────────────────┬───────────────────────────┘    │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │           Adjusted Score Calculator               │    │
│  │                                                   │    │
│  │  Native Score:    47/100                          │    │
│  │  Compensated:    +35 points                       │    │
│  │  Adjusted Score:  82/100                          │    │
│  │  Real Gaps:       3 controls (18 points)          │    │
│  └──────────────────────┬───────────────────────────┘    │
│                          │                                │
│              ┌───────────┴───────────┐                    │
│              ▼                       ▼                    │
│  ┌──────────────────┐   ┌──────────────────────────┐    │
│  │  QBR Score Report │   │  Roadmap Gap Items       │    │
│  │  (client-facing)  │   │  (feeds Midas roadmap)   │    │
│  └──────────────────┘   └──────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Compensating Controls Catalog

### 3.1 Structure

The catalog maps Microsoft Secure Score control IDs (and Google Security Health check IDs) to third-party products that satisfy the same security intent.

```typescript
interface CompensatingControlMapping {
  id: string;                          // Catalog entry ID
  nativeControlId: string;             // Microsoft: controlId from Graph API
                                       // Google: security health check ID
  nativeControlName: string;           // Human-readable name
  vendor: 'microsoft' | 'google';
  category: SecurityCategory;
  thirdPartyProducts: ThirdPartyProduct[];
  compensationLevel: 'full' | 'partial';  // Does the third party fully satisfy the intent?
  notes?: string;                      // MSP-facing context
  lastVerified: Date;                  // When mapping was last confirmed accurate
}

interface ThirdPartyProduct {
  productName: string;                 // e.g., 'SentinelOne Singularity'
  vendorName: string;                  // e.g., 'SentinelOne'
  detectionSignals: DetectionSignal[]; // How tenant-intel can auto-detect this
  satisfiesIntent: string;             // Why this product covers the control
}

interface DetectionSignal {
  signalType: 'app_registration'       // Found in Entra app registrations
             | 'service_principal'      // Found as enterprise app
             | 'installed_agent'        // Found via Intune device inventory
             | 'dns_record'            // MX/SPF/DKIM points to third party
             | 'conditional_access'     // Referenced in CA policies
             | 'manual';               // MSP-entered override only
  signalPattern: string;               // Regex or identifier to match
}

type SecurityCategory =
  | 'identity_mfa'
  | 'identity_access'
  | 'email_protection'
  | 'endpoint_protection'
  | 'data_protection'
  | 'backup_recovery'
  | 'device_management'
  | 'network_security'
  | 'application_security'
  | 'logging_monitoring';
```

### 3.2 Initial Catalog Scope (MVP)

The MVP catalog covers the most common MSP third-party substitutions — the controls that cause the largest score discrepancies:

| Category | Native Control | Common Third-Party Compensators |
|----------|---------------|--------------------------------|
| **Identity / MFA** | Require MFA for all users | Duo, Okta, JumpCloud, AuthPoint |
| **Identity / MFA** | Enable risk-based MFA policies | Duo Adaptive, Okta Adaptive MFA |
| **Email Protection** | Enable Safe Attachments (Defender) | Proofpoint, Mimecast, Barracuda, Avanan |
| **Email Protection** | Enable Safe Links (Defender) | Proofpoint URL Defense, Mimecast URL Protect |
| **Email Protection** | Anti-phishing policies | Proofpoint, Mimecast, IRONSCALES, Abnormal |
| **Endpoint Protection** | Enable Microsoft Defender for Endpoint | SentinelOne, CrowdStrike, Sophos, Bitdefender GravityZone |
| **Endpoint Protection** | Enable attack surface reduction rules | SentinelOne Storyline, CrowdStrike Falcon Prevent |
| **Backup / Recovery** | Enable cloud backup | Veeam, Acronis, Datto, Axcient, Druva |
| **Device Management** | Require device compliance (Intune) | JumpCloud, Kandji, Mosyle, Addigy (Mac) |
| **Data Protection** | Enable DLP policies | Proofpoint DLP, Netskope, Code42 |
| **Logging / Monitoring** | Enable audit log search | Blumira, Huntress, Arctic Wolf, Todyl |
| **Network Security** | Enable Conditional Access | JumpCloud Conditional Access, Okta Access Policies |

**Catalog is config-driven, not code-driven.** Stored as structured data in Supabase, editable by MSP admins. No code changes required to add a new product or mapping.

### 3.3 Auto-Detection

When `tenant-intel` ingests a tenant, it collects signals that the Matcher Engine uses to auto-suggest compensating controls:

**Microsoft 365 detection signals:**
- **App registrations / Enterprise apps:** Duo, Okta, CrowdStrike, SentinelOne often appear as service principals in Entra ID
- **MX records / mail flow connectors:** Proofpoint, Mimecast, Barracuda detected via MX or transport rules
- **Intune device inventory:** Agent names reveal installed endpoint protection
- **Conditional Access policies:** Third-party MFA providers referenced in grant controls
- **SPF/DKIM/DMARC records:** Reveal mail security stack

**Google Workspace detection signals:**
- **Third-party SAML apps:** Reveal SSO/MFA providers
- **MX records:** Reveal mail gateway
- **Chrome management:** Reveals endpoint management tools
- **Marketplace apps:** Installed third-party security apps

### 3.4 Manual MSP Overrides

Not everything can be auto-detected. The MSP must be able to:

1. **Confirm an auto-detected mapping** ("Yes, SentinelOne is deployed on all endpoints for this client")
2. **Add a manual override** ("This client uses Huntress for MDR — mark logging/monitoring as compensated")
3. **Reject an auto-detection** ("That Duo service principal is from a trial that expired, don't count it")
4. **Set partial compensation** ("They have Proofpoint for email filtering but haven't enabled URL rewriting")

Overrides are stored per-tenant, per-control, with audit trail (who set it, when, why).

```typescript
interface MSPOverride {
  id: string;
  tenantId: string;
  nativeControlId: string;
  overrideType: 'confirm_auto' | 'manual_add' | 'reject_auto' | 'set_partial';
  thirdPartyProduct: string;
  compensationLevel: 'full' | 'partial' | 'none';
  notes: string;                    // Required — MSP must document rationale
  setBy: string;                    // User ID of MSP engineer
  setAt: Date;
  expiresAt?: Date;                 // Optional — forces periodic revalidation
}
```

---

## 4. Scoring Engine

### 4.1 Score Calculation

```
Cavaridge Adjusted Score = Native Implemented Points
                         + Fully Compensated Points
                         + (Partially Compensated Points × 0.5)
                         ────────────────────────────────────────
                                   Max Possible Points
```

- **Native Implemented:** Controls Microsoft/Google marks as implemented → full points
- **Fully Compensated:** Controls not natively implemented but mapped to a third-party product at `full` compensation → full points
- **Partially Compensated:** Mapped at `partial` compensation → 50% of points (configurable)
- **Not Applicable:** Controls marked N/A by vendor → excluded from max possible
- **Real Gaps:** Everything remaining → 0 points, flagged for roadmap

### 4.2 Output Schema

```typescript
interface AdjustedSecurityScoreReport {
  tenantId: string;
  generatedAt: Date;
  vendor: 'microsoft' | 'google';

  // Headline numbers
  nativeScore: number;               // What Microsoft/Google reports
  nativeMaxScore: number;
  adjustedScore: number;             // Cavaridge Adjusted Score
  adjustedMaxScore: number;          // May differ if N/A controls excluded
  scoreDelta: number;                // adjustedScore - nativeScore

  // Category breakdown
  categories: CategoryScore[];

  // Control-level detail
  controls: ScoredControl[];

  // Actionable outputs
  realGaps: RealGap[];               // Uncompensated controls → roadmap items
  compensatedControls: CompensatedDetail[];  // What third-party tools are covering

  // Trend (if historical snapshots exist)
  trend?: ScoreTrend;
}

interface CategoryScore {
  category: SecurityCategory;
  nativeScore: number;
  adjustedScore: number;
  maxScore: number;
  gapCount: number;
  compensatedCount: number;
}

interface RealGap {
  controlId: string;
  controlName: string;
  category: SecurityCategory;
  pointsAtStake: number;
  vendorRecommendation: string;
  mspRecommendation?: string;        // Generated by SecurityAdvisor agent
  estimatedEffort: 'low' | 'medium' | 'high';
  roadmapPriority: number;           // 1 = highest
}

interface ScoreTrend {
  dataPoints: { date: Date; nativeScore: number; adjustedScore: number }[];
  trendDirection: 'improving' | 'stable' | 'declining';
  significantChanges: string[];      // e.g., "MFA score improved after Duo deployment in Jan 2026"
}
```

### 4.3 Score Confidence

Not all compensating control mappings carry the same confidence. The report includes a confidence indicator:

| Confidence | Criteria |
|------------|----------|
| **High** | Auto-detected + MSP confirmed |
| **Medium** | Auto-detected, not yet confirmed; OR manually added with notes |
| **Low** | Manually added without supporting evidence; OR override has expired |

QBR reports surface confidence level so the MSP can prioritize revalidation.

---

## 5. SecurityAdvisor Agent

A new agent within the Midas module that consumes the scored output and generates actionable recommendations.

### 5.1 Capabilities

- **Gap prioritization:** Rank real gaps by risk impact, implementation effort, and cost
- **Recommendation generation:** For each real gap, produce a specific recommendation (not just "implement MFA" but "deploy Duo for the 12 users currently without any MFA coverage, estimated 2 hours + $48/mo at current Duo pricing")
- **What-if analysis:** "If we implement controls X, Y, and Z, the adjusted score goes from 82 to 94"
- **Trend narrative:** "Score dropped 4 points since last quarter because Conditional Access policy CA-003 was disabled on Feb 12"
- **QBR talking points:** Auto-generated summary suitable for client-facing delivery

### 5.2 Agent Integration

```typescript
// SecurityAdvisor agent registered in the shared agent pool

interface SecurityAdvisorInput {
  tenantId: string;
  scoreReport: AdjustedSecurityScoreReport;
  clientContext?: string;             // Optional MSP notes about client priorities
  focus?: SecurityCategory[];         // Optional category filter
}

interface SecurityAdvisorOutput {
  executiveSummary: string;           // 2-3 sentence QBR opener
  prioritizedGaps: PrioritizedGap[];
  whatIfScenarios: WhatIfScenario[];
  quarterOverQuarterNarrative: string;
  talkingPoints: string[];            // Bullet-ready for QBR slides
}
```

### 5.3 Routing

SecurityAdvisor runs through the standard Cavaridge agent pipeline:

- Invoked via Ducky (conversational) or Midas UI (on-demand report generation)
- Routes through Spaniel → OpenRouter → model (per central routing config)
- Multi-model consensus applies for recommendation outputs (primary/secondary/tiebreaker)
- All executions logged to Langfuse

---

## 6. Midas Roadmap Integration

Real gaps feed directly into the Midas roadmap engine:

1. **Auto-generation:** Each `RealGap` becomes a candidate roadmap item with pre-populated title, description, category, effort estimate, and priority
2. **MSP review:** MSP engineer reviews, adjusts priority, adds cost estimates, and approves for the client roadmap
3. **QBR packaging:** Approved roadmap items appear in the QBR output alongside the score report
4. **Completion tracking:** When a roadmap item is marked complete, the MSP is prompted to update the compensating control mapping or confirm the native control is now implemented
5. **Score recalculation:** Next ingestion cycle reflects the change in both native and adjusted scores

This creates a closed loop: **Assess → Score → Recommend → Roadmap → Implement → Rescore.**

---

## 7. Google Workspace Security Health

While the MVP prioritizes Microsoft 365 (consistent with `tenant-intel` Phase 1), the architecture supports Google Workspace:

- **Google Security Health API:** Provides checks similar to Secure Score (2SV enforcement, app access, sharing settings, mobile management)
- **Same compensating control pattern applies:** Google penalizes for not using Chrome management when Kandji/Mosyle covers the same intent
- **Unified scoring:** The `AdjustedSecurityScoreReport` schema is vendor-neutral; a client with both M365 and Google gets two scores, or a weighted composite

Google Workspace scoring is targeted for Phase 2 alongside `tenant-intel` Google connector buildout.

---

## 8. Data Model (Supabase)

### 8.1 Tables

```sql
-- Compensating controls catalog (shared across all tenants)
CREATE TABLE compensating_control_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  native_control_id TEXT NOT NULL,
  native_control_name TEXT NOT NULL,
  vendor TEXT NOT NULL CHECK (vendor IN ('microsoft', 'google')),
  category TEXT NOT NULL,
  third_party_product JSONB NOT NULL,    -- ThirdPartyProduct[]
  compensation_level TEXT NOT NULL CHECK (compensation_level IN ('full', 'partial')),
  notes TEXT,
  last_verified TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-tenant MSP overrides
CREATE TABLE security_scoring_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  native_control_id TEXT NOT NULL,
  override_type TEXT NOT NULL,
  third_party_product TEXT,
  compensation_level TEXT NOT NULL,
  notes TEXT NOT NULL,
  set_by UUID NOT NULL REFERENCES users(id),
  set_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (tenant_id, native_control_id)
);

-- Score history (one row per scoring run)
CREATE TABLE security_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  vendor TEXT NOT NULL,
  native_score NUMERIC NOT NULL,
  native_max_score NUMERIC NOT NULL,
  adjusted_score NUMERIC NOT NULL,
  adjusted_max_score NUMERIC NOT NULL,
  real_gap_count INTEGER NOT NULL,
  compensated_count INTEGER NOT NULL,
  report_json JSONB NOT NULL,          -- Full AdjustedSecurityScoreReport
  snapshot_id UUID REFERENCES tenant_snapshots(id),
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE security_scoring_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_overrides ON security_scoring_overrides
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_isolation_scores ON security_score_history
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

---

## 9. QBR Report Output

The module produces two client-facing report formats:

### 9.1 Score Summary (QBR Slide Data)

Structured data suitable for Midas to render in QBR presentations:

- **Headline:** "Your Security Score: 82/100 (Microsoft reports 47)"
- **Score delta visualization:** Native vs. Adjusted side-by-side
- **Category breakdown:** Radar/spider chart data by security category
- **Top 3 real gaps:** Prioritized action items with effort/cost estimates
- **Quarter-over-quarter trend:** Score trajectory with change annotations
- **Compensating controls summary:** "12 controls covered by third-party tools"

### 9.2 Detailed Gap Report (MSP Internal)

Full control-level detail for the MSP engineering team:

- Every control, its native status, compensation status, and confidence level
- Auto-detection evidence for each compensating control claim
- Override audit trail
- Recommended actions for each real gap
- What-if modeling for proposed changes

---

## 10. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | Should the compensating control catalog be Cavaridge-curated only, or allow MSPs to contribute mappings? | Catalog governance, quality control |
| 2 | Partial compensation multiplier (currently 0.5) — should this be configurable per MSP or per control? | Score accuracy, complexity |
| 3 | Should expired overrides auto-revert to "real gap" or flag for review without changing the score? | Score stability, workflow |
| 4 | Google Workspace Security Health API access — confirm availability and permission model | Phase 2 scope |
| 5 | Integration with existing PSA tools (ConnectWise, Autotask) for roadmap item sync? | Midas scope creep risk |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-13 | Benjamin Posner | Initial draft |
