# Caelum Statement of Work — Master Specification

**Version:** 2.1
**Date:** 2026-03-12
**Supersedes:** SOW-MASTER-SPEC v2.0 (2026-03-10), v2.0.1 (2026-03-11)
**Owner:** Cavaridge, LLC (CVG-CAELUM)
**Tenant:** Resolved at runtime via `tenantConfig`
**Status:** LOCKED — This is the defacto standard for all SoW generation.

---

## 1. Purpose

This specification defines the canonical structure, formatting rules, and content requirements for all Statements of Work (SoW) produced through the CVG-CAELUM SoW builder platform. The provider name and branding are resolved per-tenant via `tenantConfig`. Any SoW that deviates from this spec is non-conformant.

---

## 2. Breaking Changes from v2.0

| Change | v2.0 | v2.1 |
|---|---|---|
| **Section count** | 9 (Approval mandatory) | 8 default (Approval excluded by default, included only on request) |
| **Section numbering** | 1–9 | 1–8 default; 1–9 when Approval is included |
| **Approval section** | Section 8 (required) | Excluded by default. When included, inserted as Section 8 and Labor Hours shifts to Section 9 |
| **Labor Hours table** | Phase × multi-role with rates and cost columns | Role × Scope of Involvement × Est. Hours (ranges). NO rates. NO dollar amounts. NO pricing of any kind |
| **Phase estimated hours** | Required per phase in Section 5 | Removed from Section 5. Hours appear only in Section 8 (Labor Hours) |
| **Document title** | "STATEMENT OF WORK" | "DEDICATED IT, LLC" header with "Scope of Work" subtitle (resolved via tenantConfig) |
| **Color palette** | Dark navy (#1F3864), light blue (#D6E4F0), black body text | Blue (#2E5090), light blue-gray (#F2F6FA), dark body text (#333333) |
| **H2 color** | Same as H1 (blue) | Dark (#1A1A1A) — distinct from H1 |
| **Table borders** | #CCCCCC | #BFBFBF |
| **Font** | Arial (confirmed, was inconsistently Aptos in some outputs) | Arial (locked) |

---

## 3. Unified Section Structure (Mandatory Order)

Every SoW MUST contain exactly these 8 sections by default, numbered 1–8, in this order. No sections may be added, removed, or reordered unless explicitly requested.

| # | Section | Purpose |
|---|---------|---------|
| 1 | Summary | Executive-level description of the engagement |
| 2 | Proposed Solution | Narrative-first technical approach with numbered subsections |
| 3 | Prerequisites | What must be true before work begins |
| 4 | Project Management | Site info, contacts, and PM tasks |
| 5 | High-Level Project Outline | Phased work breakdown |
| 6 | Caveats and Risks | Exclusions, assumptions, risk table, change control |
| 7 | Completion Criteria | Conditions that define "done" |
| 8 | Estimated Labor Hours | Role-based effort breakdown with hour ranges (no pricing) |

**When Approval is requested:** Insert as Section 8; Estimated Labor Hours shifts to Section 9. Total becomes 9 sections.

---

## 4. Section-by-Section Specification

### Cover Page

**Header Line:** `{tenantConfig.vendorName}` (centered, bold, 18pt, blue #2E5090)

**Subtitle Line:** `Scope of Work` (centered, 14pt, gray #666666)

**Project Title Line:** `[Project Name]` (centered, bold, 16pt, dark #1A1A1A, bordered top and bottom with blue #2E5090 rules)

**Client Line:** `[Client / Facility Name]` (centered, bold, 13pt, blue #2E5090)

**Cover Table (required fields):**

| Field | Required | Notes |
|---|---|---|
| Client | Yes | Legal entity name |
| Facility | Conditional | Include when client operates multiple sites |
| Provider | Yes | Resolved from `tenantConfig.vendorName` |
| Billing Model | Yes | "Fixed-Fee", "Time & Materials", or "Hybrid (Fixed + T&M)" |
| Document Date | Yes | Format: Month DD, YYYY |
| Version | Yes | Format: X.Y |
| Classification | Yes | Default: "Confidential" |
| Quote # | Conditional | Include when tied to a PSA/quoting system ticket |
| Expiration Date | Conditional | Include for fixed-fee quotes |

**Cover table formatting:** Full-width (9360 DXA), 2 columns (2800 / 6560 DXA), borders #BFBFBF, alternating row shading #F2F6FA, label column bold, text 10pt #333333.

---

### Section 1: Summary

- 1–3 paragraphs of plain narrative. No bullet points, no tables.
- Must state: who the client is, what the business need is, and what the provider will do.
- If billing model is fixed-fee, state explicitly: *"This project is scoped as a fixed-fee engagement. Any work requested beyond the deliverables outlined in this document will require a separate scope of work or change order."*
- May include an italicized scope-boundary note at the end clarifying what is NOT covered at a high level. Detailed exclusions go in Section 6.

---

### Section 2: Proposed Solution

**Structure:** Narrative-first. Begin with 1–2 paragraphs describing the overall approach and expected outcome.

**Subsections:** Number as 2.1, 2.2, 2.3, etc. Each subsection gets its own narrative paragraph(s) describing the work to be performed, the approach, and the expected outcome. Use subsections whenever scope has multiple distinct workstreams.

**Optional elements (include when applicable):**
- **Infrastructure Components Table** — For hardware/network deployments. Columns: Component | Description. Header row: blue bg (#2E5090), white text. Alternating rows: #F2F6FA.
- **Key Deliverables** — Numbered list of concrete outputs the client will receive. Place after all narrative/tables.
- **Scope Boundary Note** — Bulleted list of what this SoW explicitly does NOT include, if not already covered in Section 6.

**Note on Proposed Solution:** This section should read like a technical narrative a client executive can follow — not a task list. Task-level detail belongs in Section 5.

---

### Section 3: Prerequisites

**Structure:** Numbered list of conditions that must be satisfied before work begins.

**Each prerequisite must be:**
- Specific and verifiable (not vague)
- Assigned to an owner (Client or Vendor) either explicitly or by context
- Written as a complete sentence

**Closing note:** *"Delays in meeting these prerequisites may impact the project timeline and/or require a change order."*

---

### Section 4: Project Management

**Required subsections:**

1. **Site Address** — Physical address or `[TBD — To be provided by Client]`
2. **Client Point of Contact** — Name, Email, Phone (or `[TBD]` placeholders)
3. **Additional Contacts** (conditional) — GC Point of Contact, ISP Broker, Vendor POCs as needed. Include when the project involves coordination with third parties. Format each as Name/Email/Phone bullets. Include italicized note when contact is TBD: *(If a GC becomes involved, Client will provide GC contact details for coordination regarding access, schedule, and MDF/IDF readiness.)*
4. **Project Management Tasks** — Bulleted list. MUST include the following three items verbatim, without exception:
   - Provide project plan with milestones (if applicable) and estimated time of completion.
   - Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.
   - Remove old documentation references and update documentation to reflect new configurations.
5. Additional PM tasks specific to the engagement may follow the mandatory three.

---

### Section 5: High-Level Project Outline

**Structure:** Named phases (Phase 1, Phase 2, etc.)

**Each phase MUST contain:**

| Element | Format | Required |
|---|---|---|
| Phase Title | H2 heading: `Phase N: [Descriptive Title]` | Yes |
| Objective | Bold label "Objective:" followed by 1–2 sentence description | Yes |
| Tasks | Bold label "Tasks" followed by bulleted list | Yes |
| Deliverables | Bold label "Deliverables" followed by bulleted list of tangible outputs | Yes |

**Note:** Estimated hours are NOT included per phase. All labor estimates appear in Section 8 (Estimated Labor Hours) only.

---

### Section 6: Caveats and Risks

**Required subsections (numbered 6.1–6.4, in this order):**

1. **6.1 Scope Exclusions** — Bulleted list of what is NOT included. Be explicit.
2. **6.2 Assumptions** — Bulleted list of conditions assumed to be true.
3. **6.3 Risks** — Table format. Columns: Risk | Impact | Mitigation. Header row: blue bg (#2E5090), white text. Alternating data rows: #F2F6FA / white.
4. **6.4 Change Control** — Standard paragraph:
   > *"Any work, equipment, or services not explicitly described in this document are considered out of scope. Out-of-scope requests identified during the engagement will be documented and presented to the client as a separate change order or scope of work for review and approval prior to execution."*

---

### Section 7: Completion Criteria

- Bulleted list of specific, measurable conditions.
- Each criterion should map to a deliverable from Section 2 or Section 5.
- Include a closing statement:
  > *"Upon receipt of written sign-off, the project will be formally closed. Any issues or requests identified after sign-off will be handled through standard {vendorName} support channels or scoped as a separate engagement."*

---

### Section 8: Estimated Labor Hours (default) / Section 9 (when Approval is included)

**CRITICAL: This section contains NO pricing, NO rates, NO dollar amounts of any kind.**

**Table structure (canonical format):**

| Role | Scope of Involvement | Est. Hours |
|---|---|---|
| **Project Manager** | [Description of PM involvement] | XX – XX |
| **Senior Engineer** | [Description of engineering work] | XX – XX |
| **Field Technician** | [Description of field work] | XX – XX |
| **Knowledge Transfer** | [Description of handover activities] | XX – XX |
| **Total Estimated Hours** | | **XX – XX** |

**Table formatting:**
- Header row: blue bg (#2E5090), white bold text, 10pt
- Data rows: alternating #F2F6FA / white, 10pt #333333
- Role column: bold
- Est. Hours column: center-aligned
- Totals row: bold role text, bold hours
- Borders: #BFBFBF
- Column widths: 2800 / 4360 / 2200 DXA

**Rules:**
- Hours are ALWAYS ranges (e.g., "16 – 24"), never fixed numbers
- Roles are generic (Project Manager, Senior Engineer, Field Technician, Knowledge Transfer) — adapt as needed per engagement but never include rate/cost info
- One row per role, not per phase
- Scope of Involvement describes what that role does across the entire engagement

**Closing notes (always include as bulleted list under "Notes:" bold label):**
- *"Hours assume all prerequisites are met prior to deployment. Delays in [relevant prerequisites] may increase labor effort."*
- *"Travel time to and from the site is not included in the estimates above and will be scoped based on deployment schedule."*
- *"Hours for knowledge transfer may be combined with the final day of on-site deployment."*
- *"Hardware and licensing costs are not included in this estimate and will be quoted separately upon confirmation of final equipment specifications."* (Include only when hardware is not itemized in Section 2.)

---

### Section 8 (Optional): Approval

**EXCLUDED BY DEFAULT.** Include only when explicitly requested.

When included, this section becomes Section 8 and Estimated Labor Hours shifts to Section 9.

**Signature Block — Stacked layout (not side-by-side table):**

```
Client — [Client Entity Name]

____________________________________________
Authorized Signature

Printed Name: ___________________________
Date: _______________


Provider — {tenantConfig.vendorName}

____________________________________________
Authorized Signature

Printed Name: ___________________________
Date: _______________
```

**Preamble text:**
> *"By signing below, the authorized representatives acknowledge they have reviewed this Scope of Work and agree to the terms, deliverables, prerequisites, and exclusions outlined herein."*
> *"This document constitutes the complete scope for the [Project Name] at [Facility Name]. Work will commence upon receipt of signed approval."*

---

## 5. Formatting Rules

### Typography
- **Font:** Arial throughout (no exceptions — not Aptos, not Calibri)
- **Body text:** 11pt (22 half-points), color #333333
- **Section headings (H1):** 14pt bold, color #2E5090
- **Subsection headings (H2):** 12pt bold, color #1A1A1A
- **Phase titles:** H2 style (12pt bold, #1A1A1A)
- **Table text:** 10pt (20 half-points), color #333333

### Page Layout
- **Paper:** US Letter (8.5" × 11" / 12240 × 15840 DXA)
- **Margins:** 1" all sides (1440 DXA)
- **Content width:** 9360 DXA
- **Header:** Right-aligned, italicized, 8pt, gray #666666: `[Facility Name] — [Project Name]` with blue bottom border (#2E5090, 4pt)
- **Footer:** Centered, 8pt, gray #666666: `Page [N] | {vendorName} | Confidential` with blue top border (#2E5090, 4pt)

### Tables
- **Header row:** Blue background (#2E5090), white bold text (#FFFFFF)
- **Alternating data rows:** #F2F6FA / white (first data row is white, second is #F2F6FA, alternating)
- **Borders:** #BFBFBF, single line, 1pt
- **Cell padding:** 80 DXA top/bottom, 120 DXA left/right
- **Width:** Full content width (9360 DXA) unless otherwise specified

### Color Palette (LOCKED)

| Use | Hex | Description |
|---|---|---|
| H1 headings / Accent | #2E5090 | Blue |
| H2 headings | #1A1A1A | Near-black |
| Table header BG | #2E5090 | Blue (same as H1) |
| Table header text | #FFFFFF | White |
| Table row banding | #F2F6FA | Light blue-gray |
| Body text | #333333 | Dark gray |
| Subtitle / meta text | #666666 | Medium gray |
| Table / cell borders | #BFBFBF | Light gray |
| Cover title rules | #2E5090 | Blue (top/bottom border on project title) |

---

## 6. CVG-CAELUM JSON Schema

The following JSON schema defines the data model for programmatic SoW generation. All SoW data entered through Caelum MUST conform to this schema.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Caelum-SoW-v2.1",
  "type": "object",
  "required": ["cover", "summary", "proposed_solution", "prerequisites", "project_management", "phases", "caveats_risks", "completion_criteria", "labor_hours"],
  "properties": {
    "cover": {
      "type": "object",
      "required": ["client", "provider", "billing_model", "document_date", "version", "classification"],
      "properties": {
        "client": { "type": "string" },
        "facility": { "type": "string" },
        "project_name": { "type": "string" },
        "provider": { "type": "string", "description": "Resolved from tenantConfig.vendorName" },
        "billing_model": { "type": "string", "enum": ["Fixed-Fee", "Time & Materials", "Hybrid (Fixed + T&M)"] },
        "document_date": { "type": "string", "format": "date" },
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+$" },
        "classification": { "type": "string", "default": "Confidential" },
        "quote_number": { "type": "string" },
        "expiration_date": { "type": "string", "format": "date" }
      }
    },
    "summary": {
      "type": "object",
      "required": ["narrative"],
      "properties": {
        "narrative": { "type": "string", "description": "1-3 paragraphs. No bullets or tables." },
        "scope_boundary_note": { "type": "string", "description": "Italicized note clarifying what is NOT covered." }
      }
    },
    "proposed_solution": {
      "type": "object",
      "required": ["overview"],
      "properties": {
        "overview": { "type": "string", "description": "1-2 paragraph narrative of approach." },
        "subsections": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["number", "title", "narrative"],
            "properties": {
              "number": { "type": "string", "pattern": "^2\\.\\d+$" },
              "title": { "type": "string" },
              "narrative": { "type": "string" }
            }
          }
        },
        "components_table": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["component", "description"],
            "properties": {
              "component": { "type": "string" },
              "description": { "type": "string" }
            }
          }
        },
        "key_deliverables": {
          "type": "array",
          "items": { "type": "string" }
        },
        "exclusion_notes": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "prerequisites": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "project_management": {
      "type": "object",
      "required": ["pm_tasks"],
      "properties": {
        "site_address": { "type": "string" },
        "contacts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["role", "name"],
            "properties": {
              "role": { "type": "string" },
              "name": { "type": "string" },
              "title": { "type": "string" },
              "email": { "type": "string" },
              "phone": { "type": "string" },
              "notes": { "type": "string" }
            }
          }
        },
        "pm_tasks": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 3,
          "description": "First 3 items are mandatory verbatim. Additional tasks follow."
        }
      }
    },
    "phases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["number", "title", "objective", "tasks", "deliverables"],
        "properties": {
          "number": { "type": "integer", "minimum": 1 },
          "title": { "type": "string" },
          "objective": { "type": "string" },
          "tasks": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
          "deliverables": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
        }
      },
      "minItems": 1
    },
    "caveats_risks": {
      "type": "object",
      "required": ["exclusions", "assumptions", "risks", "change_control"],
      "properties": {
        "exclusions": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "assumptions": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "risks": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["risk", "impact", "mitigation"],
            "properties": {
              "risk": { "type": "string" },
              "impact": { "type": "string" },
              "mitigation": { "type": "string" }
            }
          },
          "minItems": 1
        },
        "change_control": { "type": "string" }
      }
    },
    "completion_criteria": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "approval": {
      "type": "object",
      "description": "OPTIONAL — excluded by default. Include only when explicitly requested.",
      "properties": {
        "client_entity": { "type": "string" },
        "provider_entity": { "type": "string", "description": "Resolved from tenantConfig.vendorName" },
        "preamble_text": { "type": "string" }
      }
    },
    "labor_hours": {
      "type": "object",
      "required": ["rows"],
      "properties": {
        "rows": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["role", "scope", "hours_range"],
            "properties": {
              "role": { "type": "string", "description": "Generic role name: Project Manager, Senior Engineer, Field Technician, Knowledge Transfer, etc." },
              "scope": { "type": "string", "description": "Description of what this role does across the engagement." },
              "hours_range": { "type": "string", "pattern": "^\\d+ [–-] \\d+$", "description": "Hour range, e.g. '16 – 24'. NEVER a fixed number. NEVER includes rates or pricing." }
            }
          },
          "minItems": 1
        },
        "total_hours_range": { "type": "string", "pattern": "^\\d+ [–-] \\d+$", "description": "Sum of all role ranges." },
        "notes": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

---

## 7. Validation Checklist

Before any SoW is delivered:

- [ ] All 8 sections present in order (1–8), or 9 if Approval was requested
- [ ] Cover page follows exact layout: vendor header → subtitle → bordered project title → client line → info table
- [ ] Cover table contains all required fields with correct formatting
- [ ] Billing model explicitly stated in Summary
- [ ] Section 2 begins with narrative (not a list) and uses numbered subsections
- [ ] Section 4 contains all 3 mandatory PM tasks verbatim
- [ ] Each phase in Section 5 has: title, objective, tasks, deliverables (NO estimated hours per phase)
- [ ] Section 6 contains all 4 numbered subsections: 6.1 Exclusions, 6.2 Assumptions, 6.3 Risks (table), 6.4 Change Control
- [ ] Section 7 criteria map to deliverables
- [ ] Approval section is ABSENT unless explicitly requested
- [ ] Labor table uses Role | Scope | Est. Hours format with hour RANGES
- [ ] Labor table contains NO rates, NO dollar amounts, NO pricing of any kind
- [ ] Labor table includes totals row with range
- [ ] All table headers use blue bg (#2E5090) with white text
- [ ] All table row banding uses #F2F6FA
- [ ] All table borders use #BFBFBF
- [ ] Font is Arial throughout (not Aptos, not Calibri)
- [ ] H1 headings are #2E5090, H2 headings are #1A1A1A
- [ ] No placeholder text remains (or explicitly marked [TBD])
- [ ] Header and footer present on all pages with blue border rules
- [ ] Document passes DOCX validation

---

## 8. Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-09 | Benjamin Posner | Initial spec from Scope Statement Template chat |
| 2.0 | 2026-03-10 | Benjamin Posner | Complete rewrite after 3-doc audit. Added: cover table standardization, Section 6 restructure (4 subsections), estimated hours per phase, risk table format, quote summary in approval, JSON schema for Caelum, validation checklist, formatting/color rules. |
| 2.0.1 | 2026-03-11 | Benjamin Posner | Removed all hardcoded tenant references (DIT / Dedicated IT). Provider name, rates, and branding now resolved via tenantConfig at runtime. Renamed spec file from DIT-SOW-MASTER-SPEC to SOW-MASTER-SPEC. |
| 2.1 | 2026-03-12 | Benjamin Posner | **LOCKED as defacto standard.** Approval section excluded by default (8 sections, not 9). Labor Hours table redesigned: Role/Scope/Hours ranges only — all rates, dollar amounts, and pricing removed. Estimated hours removed from individual phases (Section 5). Color palette locked: #2E5090 blue headers, #1A1A1A H2, #F2F6FA banding, #BFBFBF borders, #333333 body text. Font locked as Arial. Cover page layout standardized to vendor header / subtitle / bordered title / client line. Signature block changed from side-by-side table to stacked underscore lines. JSON schema updated (approval now optional, labor_hours restructured, phase estimated_hours removed). Validation checklist expanded. |
