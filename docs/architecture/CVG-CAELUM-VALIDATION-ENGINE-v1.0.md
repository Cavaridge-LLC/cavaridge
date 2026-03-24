# CVG-CAELUM-VALIDATION-ENGINE-v1.0

> **Status:** DRAFT  
> **Date:** 2026-03-24  
> **Author:** Benjamin Posner  
> **App Code:** CVG-CAELUM  
> **Dependencies:** SOW-MASTER-SPEC-v2.2, @cavaridge/auth (UTM), @cavaridge/agent-core

---

## 1. Problem Statement

SoW compliance is currently enforced by convention — Claude references the spec from memory and CLAUDE.md, but there is no runtime validation. This results in missed sections, wrong list formatting, missing subsections, and inconsistent structure across sessions. The spec must be enforced programmatically at the point of generation, not after the fact.

Additionally, tenants (MSPs) need the ability to customize their SoW templates — branding, colors, default boilerplate, vendor contact types — without breaking structural compliance. The platform must separate what is **locked** (structural rules) from what is **customizable** (presentation and defaults).

---

## 2. Architecture Overview

Three components:

```
┌─────────────────────────────────────────────────────┐
│                  CVG-CAELUM                          │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  SoW Builder  │→│  Validation  │→│  Renderer  │ │
│  │  (LLM Agent)  │  │   Engine     │  │ (DOCX/PDF)│ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         ↑                 ↑               ↑         │
│         │                 │               │         │
│  ┌──────┴─────────────────┴───────────────┴──────┐  │
│  │            Tenant Template Registry            │  │
│  │  (platform defaults + MSP overrides)           │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Flow:**
1. SoW Builder (LLM agent or manual input) produces a `SowDocumentV2` JSON object.
2. Validation Engine runs the JSON against the locked structural rules. Returns pass/fail with itemized findings.
3. If validation passes, the Renderer applies tenant template (colors, fonts, logo, boilerplate) and exports DOCX/PDF.
4. If validation fails, the SoW is blocked from export. Findings are returned to the builder agent for self-correction, or surfaced to the user for manual fix.

**No SoW leaves the system without passing validation.** This is a hard gate, not a warning.

---

## 3. Validation Engine

### 3.1 Rule Categories

Rules are organized into two tiers:

| Tier | Scope | Override? | Examples |
|------|-------|-----------|---------|
| **Platform Rules** | Structural compliance with SOW-MASTER-SPEC | Never | Section count/order, mandatory PM tasks, labor hours format, bullet default, Section 6 subsections |
| **Tenant Rules** | Tenant-specific requirements layered on top | Per-tenant | Additional mandatory exclusions, required vendor contact types, minimum risk count, custom PM tasks |

### 3.2 Platform Rules (Locked — Non-Negotiable)

These rules are hardcoded in the validation engine and cannot be overridden by any tenant. They enforce the structural integrity of SOW-MASTER-SPEC-v2.2+.

#### Structure Rules
- `STRUCT-001`: Exactly 8 sections present in order (1–8), or 9 if approval is explicitly flagged.
- `STRUCT-002`: Section numbers match expected sequence (1=Summary, 2=Proposed Solution, 3=Prerequisites, 4=Project Management, 5=High-Level Project Outline, 6=Caveats and Risks, 7=Completion Criteria, 8=Estimated Labor Hours).
- `STRUCT-003`: Approval section absent unless `approval_requested: true` flag is set.

#### Section 1 — Summary
- `S1-001`: Summary text exists and is non-empty.
- `S1-002`: Summary contains no bullet markers or table structures (narrative prose only).

#### Section 2 — Proposed Solution
- `S2-001`: Opens with an `overview` narrative paragraph before any subsections.
- `S2-002`: At least one numbered subsection (2.x) present.
- `S2-003`: Each subsection has a `number` matching pattern `2.\d+`, a `title`, and a `narrative`.

#### Section 3 — Prerequisites
- `S3-001`: Prerequisites array has at least one item.
- `S3-002`: Standard preamble text present (exact match or semantic equivalent).

#### Section 4 — Project Management
- `S4-001`: `site_address` field exists (may be [TBD]).
- `S4-002`: `shipping_address` present if any phase references equipment procurement or shipping. (Advisory — warn, don't block.)
- `S4-003`: At least one `client_contact` with `name` field.
- `S4-004`: `vendor_contacts` array present OR `vendor_contacts_not_applicable_note` present. Both may not be empty/missing simultaneously.
- `S4-005`: `pm_tasks` array has minimum 3 items.
- `S4-006`: First PM task matches mandatory text — project plan with milestones and estimated completion.
- `S4-007`: Second PM task matches mandatory text — regular updates via preferred method at kickoff-established intervals.
- `S4-008`: Third PM task matches mandatory text — remove old documentation and update to reflect new configurations.

#### Section 5 — High-Level Project Outline
- `S5-001`: At least 3 phases present (planning, execution, close-out minimum).
- `S5-002`: Each phase has `title`, `objective`, `tasks` (array, min 1), `deliverables` (array, min 1).
- `S5-003`: No `estimated_hours` field on any phase (hours live only in Section 8).
- `S5-004`: Phases are numbered sequentially starting at 1.

#### Section 6 — Caveats and Risks
- `S6-001`: Exactly 4 subsections present: exclusions, assumptions, risks, change_control.
- `S6-002`: `exclusions` array has at least one item.
- `S6-003`: `assumptions` array has at least one item.
- `S6-004`: `risks` array has at least one item, each with `risk`, `impact`, `mitigation`.
- `S6-005`: `change_control` is a non-empty string.

#### Section 7 — Completion Criteria
- `S7-001`: `completion_criteria` array has at least one item.
- `S7-002`: (Advisory) Each criterion should trace to a deliverable in Section 2 or Section 5. Flag unmatched criteria as warnings.

#### Section 8 — Estimated Labor Hours
- `S8-001`: `labor_hours.rows` has at least one row.
- `S8-002`: Each row has `role` (string), `scope` (string), `hours_range` (matches pattern `^\d+ [–-] \d+$`).
- `S8-003`: No row contains dollar signs, rate keywords ("per hour", "/hr", "rate"), or numeric currency patterns.
- `S8-004`: `total_hours_range` exists and matches pattern `^\d+ [–-] \d+$`.

#### Formatting Rules
- `FMT-001`: All lists rendered as bullets unless item is inside a sequenced phase structure (Section 5 phase numbering is exempt).
- `FMT-002`: No lettered lists (a, b, c) or numbered lists (1, 2, 3) outside of Section 5 phase numbers and Section 2 subsection numbers.

### 3.3 Tenant Rules (Configurable)

Tenants can add rules that layer on top of platform rules. Tenant rules can only **add** requirements — they cannot relax or disable platform rules.

Examples of tenant-configurable rules:

| Rule Type | Example | Config Field |
|-----------|---------|-------------|
| Required exclusions | "Low-voltage cabling" must always appear in 6.1 | `required_exclusions[]` |
| Required assumptions | "Work performed during normal business hours" | `required_assumptions[]` |
| Minimum risk count | At least 4 risks required | `min_risk_count` |
| Required vendor contact types | GC and ISP always required for greenfield projects | `required_vendor_types[]` |
| Additional mandatory PM tasks | "Coordinate with LV vendor" | `additional_pm_tasks[]` |
| Required completion criteria | "Documentation updated" always present | `required_completion_criteria[]` |
| Scope type presets | "Greenfield" auto-includes GC, ISP, LV vendor contacts | `scope_presets{}` |

### 3.4 Validation Response Schema

```typescript
interface ValidationResult {
  passed: boolean;
  timestamp: string;
  spec_version: string;            // "2.2"
  tenant_id: string;
  findings: ValidationFinding[];
  summary: {
    errors: number;                // Hard failures — block export
    warnings: number;              // Advisory — allow export with flag
    passed_rules: number;
    total_rules: number;
  };
}

interface ValidationFinding {
  rule_id: string;                 // "S4-006"
  severity: "error" | "warning";
  section: number;                 // 1-8
  message: string;                 // Human-readable description
  expected?: string;               // What the rule requires
  actual?: string;                 // What was found
  auto_fixable: boolean;           // Can the agent self-correct?
  fix_hint?: string;               // Guidance for the agent
}
```

### 3.5 Agent Self-Correction Loop

When the validation engine returns findings, the SoW Builder agent should attempt self-correction before surfacing errors to the user:

```
Agent generates SowDocumentV2 JSON
        ↓
Validation Engine runs
        ↓
    Passed? → Export
        ↓ (No)
Agent receives findings[]
        ↓
Auto-fixable findings? → Agent patches JSON → Re-validate (max 3 attempts)
        ↓ (Not auto-fixable)
Surface findings to user with actionable descriptions
```

**Max retry loops:** 3. If the agent cannot produce a compliant document in 3 attempts, surface all remaining findings to the user.

---

## 4. Tenant Template Registry

### 4.1 Template Inheritance Model

```
Platform Defaults (SOW-MASTER-SPEC-v2.2)
        ↓ (inherit, cannot override structural rules)
MSP Template (tenant-level customization)
        ↓ (inherit, can override MSP defaults per-SoW)
Per-SoW Overrides (one-time adjustments)
```

Each layer can only customize what the layer above permits. Structural rules from the platform level are never overridable.

### 4.2 Tenant Template Schema

```typescript
interface SowTenantTemplate {
  tenant_id: string;
  template_name: string;
  version: string;
  created_at: string;
  updated_at: string;

  // === PRESENTATION (fully customizable) ===
  branding: {
    vendor_name: string;             // "Dedicated IT" — rendered on cover page
    vendor_logo_url?: string;        // Optional logo for cover page header
    subtitle_text: string;           // Default: "Statement of Work"
  };

  colors: {
    h1: string;                      // Default: "#2E5090"
    h2: string;                      // Default: "#1A1A1A"
    body_text: string;               // Default: "#333333"
    table_header_bg: string;         // Default: "#2E5090"
    table_header_text: string;       // Default: "#FFFFFF"
    table_row_band: string;          // Default: "#F2F6FA"
    table_border: string;            // Default: "#BFBFBF"
  };

  typography: {
    font_family: string;             // Default: "Arial"
    body_size_pt: number;            // Default: 11
    h1_size_pt: number;              // Default: 16
    h2_size_pt: number;              // Default: 13
  };

  page: {
    size: "letter" | "a4";           // Default: "letter"
    margins_inches: number;          // Default: 1
  };

  // === CONTENT DEFAULTS (customizable, appended to platform minimums) ===
  defaults: {
    // These are pre-populated when a new SoW is created — user can edit/remove
    prerequisites_preamble: string;
    change_control_text: string;
    default_exclusions: string[];
    default_assumptions: string[];
    default_risks: Array<{ risk: string; impact: string; mitigation: string }>;
    default_pm_tasks_additional: string[];   // Appended AFTER the 3 mandatory tasks

    // Vendor contact types that appear by default (user removes N/A ones)
    default_vendor_contact_types: string[];  // e.g. ["GC", "ISP/Broker", "LV Contractor"]

    // Scope presets — pre-fill templates based on project type
    scope_presets: Record<string, ScopePreset>;
  };

  // === TENANT VALIDATION RULES (additive only) ===
  validation_overrides: {
    required_exclusions: string[];
    required_assumptions: string[];
    required_completion_criteria: string[];
    additional_pm_tasks: string[];
    required_vendor_types: string[];         // Enforced by scope preset, not globally
    min_risk_count: number;                  // Default: 1 (platform minimum)
  };
}

interface ScopePreset {
  name: string;                              // "Greenfield ASC", "Workstation Deployment", etc.
  description: string;
  required_vendor_types: string[];           // Auto-populated vendor contact sections
  default_phases: Array<{                    // Pre-built phase templates
    title: string;
    objective_template: string;
    task_templates: string[];
    deliverable_templates: string[];
  }>;
  default_exclusions: string[];
  default_assumptions: string[];
  default_risks: Array<{ risk: string; impact: string; mitigation: string }>;
  default_prerequisites: string[];
}
```

### 4.3 Scope Presets (Examples for DIT)

Presets give tenants reusable starting points. When a user creates a new SoW and selects a preset, the template auto-fills phases, risks, exclusions, and vendor contacts — all editable.

| Preset Name | Auto-fills | Required Vendor Types |
|-------------|-----------|----------------------|
| Greenfield ASC | 5-phase network buildout, Meraki-specific tasks, ASC prerequisites | GC, ISP/Broker, LV Contractor |
| Workstation Deployment | 4-phase staging/deploy/test/close, Entra ID join tasks | (none by default) |
| Firewall Replacement | 3-phase swap (pre-config, cutover, validation), change window assumptions | (none by default) |
| UPS Installation | 5-phase install lifecycle, electrical outlet prerequisites | (none by default) |
| Citrix/RDS Migration | 6-phase migration, app compat testing, pilot group phases | (none by default) |
| IT Due Diligence | Assessment phases, evidence collection, risk matrix deliverables | (none by default) |

### 4.4 Database Schema (Supabase)

```sql
-- Tenant SoW templates
CREATE TABLE sow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  config JSONB NOT NULL,              -- SowTenantTemplate JSON
  is_default BOOLEAN DEFAULT false,   -- One default per tenant
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(tenant_id, template_name)
);

-- Scope presets (can be platform-level or tenant-level)
CREATE TABLE sow_scope_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = platform preset
  preset_name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,              -- ScopePreset JSON
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, preset_name)
);

-- Validation results (audit trail)
CREATE TABLE sow_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  sow_id UUID NOT NULL,               -- Reference to the SoW being validated
  spec_version TEXT NOT NULL,          -- "2.2"
  passed BOOLEAN NOT NULL,
  errors INT DEFAULT 0,
  warnings INT DEFAULT 0,
  findings JSONB NOT NULL,             -- Full ValidationResult JSON
  validated_at TIMESTAMPTZ DEFAULT now(),
  validated_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE sow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_scope_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_validation_results ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "tenant_templates" ON sow_templates
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY "tenant_presets" ON sow_scope_presets
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY "tenant_validation" ON sow_validation_results
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

---

## 5. Integration Points

### 5.1 Claude (Chat Layer)

Claude's enforcement is limited to memory + CLAUDE.md references. To improve compliance at this layer:

- **CLAUDE.md** must reference the spec version and validation checklist explicitly.
- When Claude generates a SoW in chat (outside Caelum), it should self-audit against the checklist before presenting the deliverable. This is convention-based — the only hard gate is in Caelum.
- The SOW-MASTER-SPEC markdown file is the single source of truth. If Claude and Caelum disagree, Caelum wins.

### 5.2 Claude Code CLI (Build Layer)

Claude Code can run the validation engine as a CLI command:

```bash
# Validate a SoW JSON file against the spec
pnpm caelum:validate --input sow.json --tenant-id <uuid>

# Validate and auto-fix where possible
pnpm caelum:validate --input sow.json --fix --output sow-fixed.json
```

### 5.3 Caelum API (Application Layer)

```typescript
// POST /api/sow/validate
// Body: SowDocumentV2 JSON
// Response: ValidationResult

// POST /api/sow/export
// Body: { sow: SowDocumentV2, format: "docx" | "pdf" | "md" }
// Response: File stream (blocked if validation fails)

// GET /api/sow/templates
// Response: Tenant's available templates

// GET /api/sow/presets
// Response: Available scope presets (platform + tenant)
```

**The `/export` endpoint runs validation internally.** There is no way to export a SoW that hasn't passed. The validation result is stored in `sow_validation_results` for audit.

---

## 6. Future: Tenant Template Editor UI

Phase 2 deliverable. A UI within Caelum where MSP Admins can:

- Customize colors, fonts, and branding (live preview).
- Add/remove default exclusions, assumptions, and risks.
- Create and manage scope presets.
- Add tenant-specific validation rules.
- Preview a sample SoW rendered with their template.
- Version their template (with rollback).

This UI is gated to the **MSP Admin** RBAC role.

---

## 7. Implementation Order

| Phase | Deliverable | Dependency |
|-------|------------|------------|
| 1 | Validation Engine (platform rules only) | SOW-MASTER-SPEC-v2.2 |
| 2 | CLI validator command (`caelum:validate`) | Phase 1 |
| 3 | Supabase schema (templates, presets, validation results) | @cavaridge/auth |
| 4 | `/api/sow/validate` and `/api/sow/export` endpoints with hard gate | Phase 1 + Phase 3 |
| 5 | Tenant template CRUD API | Phase 3 |
| 6 | DIT scope presets (Greenfield ASC, Workstation Deployment, etc.) | Phase 5 |
| 7 | Tenant Template Editor UI | Phase 5 |
| 8 | Agent self-correction loop integration | Phase 4 + @cavaridge/agent-core |

---

## 8. Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-24 | Benjamin Posner | Initial architecture spec. Validation engine with 30+ platform rules, tenant template registry with inheritance model, scope presets, database schema, integration points, implementation roadmap. |
