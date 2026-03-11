# DIT Statement of Work — Master Specification

**Version:** 2.0  
**Date:** 2026-03-10  
**Supersedes:** DIT-SOW-TEMPLATE-SPEC v1.0 (2026-03-09)  
**Owner:** Cavaridge, LLC (CVG-CAELUM)  
**Tenant:** Dedicated IT, LLC  

---

## 1. Purpose

This specification defines the canonical structure, formatting rules, and content requirements for all Statements of Work (SoW) produced by Dedicated IT, LLC. It serves as the authoritative reference for both human authors and the CVG-CAELUM SoW builder platform. Any SoW that deviates from this spec is non-conformant.

---

## 2. Audit of Source Documents

Three SoWs were analyzed to identify inconsistencies and extract best practices:

| Element | WTSI New Build (Doc A) | WTSI End-User (Doc B) | USO AVD (Doc C) |
|---|---|---|---|
| **Document title** | "SCOPE OF WORK" | "Scope of Work" | "STATEMENT OF WORK" |
| **Cover table fields** | Prepared By/For, Date, Version | Client, Facility, Provider, Billing Model, Date, Version, Classification | Side-by-side contact blocks + Delivery/Expiration/Billing row |
| **Section count** | 9 | 9 | 9 |
| **Section 2 style** | Overview → Components table → Exclusions → Deliverables | Numbered subsections (2.1, 2.2…) narrative-first | Single narrative + software table |
| **Section 3 style** | Client / Vendor / Dependencies subsections | Numbered list | Bullet list |
| **Section 4 content** | Site address, POC table, PM tasks | Site address, multiple POCs, PM tasks | PM tasks only (no site/POC) |
| **Phase structure** | Objective → Tasks → Deliverables | Objective → Tasks → Deliverables | Est. Hours → Objective → Tasks → Deliverables |
| **Section 6 structure** | Assumptions / Risks / Mitigation Strategies | Exclusions / Assumptions / Risk table / Change Control | Assumptions / Exclusions / Risks |
| **Approval block** | Side-by-side table | Separate stacked blocks | Quote Summary table + side-by-side |
| **Labor table** | Phase × multi-role with rates + cost | Role × scope description + hour ranges | Phase × single-role × rate |
| **Billing model callout** | Implied T&M | Explicit fixed-fee | Explicit fixed-fee |

### Key Inconsistencies Found

1. **Document title** — Three different strings used across three docs.
2. **Cover table** — Different field sets; Doc B is the richest.
3. **Proposed Solution** — Three different organizational patterns.
4. **Prerequisites** — Three different sub-structures.
5. **Project Management** — Doc C omits site address and POC entirely.
6. **Caveats/Risks** — Different subsection groupings; Doc B has the most complete set.
7. **Approval** — Different layouts; Doc C adds a Quote Summary.
8. **Labor Hours** — Three different table schemas.

---

## 3. Unified Section Structure (Mandatory Order)

Every SoW MUST contain exactly these 9 sections, numbered 1–9, in this order. No sections may be added, removed, or reordered.

| # | Section | Purpose |
|---|---------|---------|
| 1 | Summary | Executive-level description of the engagement |
| 2 | Proposed Solution | Narrative-first technical approach with optional subsections, tables, exclusions, and key deliverables |
| 3 | Prerequisites | What must be true before work begins |
| 4 | Project Management | Site info, contacts, and PM tasks |
| 5 | High-Level Project Outline | Phased work breakdown |
| 6 | Caveats & Risks | Exclusions, assumptions, risks, mitigation, change control |
| 7 | Completion Criteria | Conditions that define "done" |
| 8 | Approval | Quote summary (if applicable) and signature blocks |
| 9 | Estimated Labor Hours | Role-based effort and cost breakdown |

---

## 4. Section-by-Section Specification

### Cover Page

**Title:** `STATEMENT OF WORK` (all caps, centered, bold)

**Project Line:** `[Project Name]` (centered, bold, below title)

**Client Line:** `[Client / Facility Name]` (centered, below project line)

**Cover Table (required fields):**

| Field | Required | Notes |
|---|---|---|
| Client | Yes | Legal entity name |
| Facility | Conditional | Include when client operates multiple sites |
| Provider | Yes | Always "Dedicated IT, LLC" |
| Billing Model | Yes | "Fixed-Fee", "Time & Materials", or "Hybrid (Fixed + T&M)" |
| Document Date | Yes | Format: Month DD, YYYY |
| Version | Yes | Format: X.Y |
| Classification | Yes | Default: "Confidential" |
| Quote # | Conditional | Include when tied to a PSA/quoting system ticket |
| Expiration Date | Conditional | Include for fixed-fee quotes |

**Confidentiality Notice:** Always include below cover table:
> *CONFIDENTIAL — This document is proprietary to Dedicated IT, LLC and intended solely for the above-referenced organization.*

---

### Section 1: Summary

- 1–3 paragraphs of plain narrative. No bullet points, no tables.
- Must state: who the client is, what the business need is, and what Dedicated IT will do.
- If billing model is fixed-fee, state explicitly: *"This project is scoped as a fixed-fee engagement. Any work requested beyond the deliverables outlined in this document will require a separate scope of work or change order."*
- May include an italicized scope-boundary note at the end clarifying what is NOT covered at a high level. Detailed exclusions go in Section 6.

---

### Section 2: Proposed Solution

**Structure:** Narrative-first. Begin with 1–2 paragraphs describing the overall approach and expected outcome.

**Optional subsections (use when scope has multiple distinct workstreams):**
- Number as 2.1, 2.2, 2.3, etc.
- Each subsection gets its own narrative paragraph(s).

**Optional elements (include when applicable):**
- **Infrastructure Components Table** — For hardware/network deployments. Columns: Component | Description.
- **Included Hardware/Software Table** — For projects with line-item procurement. Columns: Description | Unit Price | Qty | Ext. Price. Include subtotal row.
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
2. **Client Point of Contact** — Name, Title, Email, Phone (or `[TBD]` placeholders)
3. **Additional Contacts** (conditional) — GC, ISP Broker, Vendor POCs as needed. Include when the project involves coordination with third parties.
4. **Project Management Tasks** — Bulleted list. MUST include the following three items verbatim, without exception:
   - Provide project plan with milestones (if milestones applicable) and estimated time of completion.
   - Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.
   - Remove old documentation references and update documentation to reflect new configurations.
5. Additional PM tasks specific to the engagement may follow the mandatory three.

---

### Section 5: High-Level Project Outline

**Structure:** Numbered phases (Phase 1, Phase 2, etc.)

**Each phase MUST contain:**

| Element | Format | Required |
|---|---|---|
| Phase Title | Bold, after phase number | Yes |
| Estimated Hours | Inline after title or in a callout | Yes |
| Objective | 1–2 sentence description of phase goal | Yes |
| Tasks | Bulleted list | Yes |
| Deliverables | Bulleted list of tangible outputs | Yes |

**Phase title format:** `Phase N: [Descriptive Title]`
**Estimated hours format:** `Estimated Hours: XX` (placed below phase title, before Objective)

---

### Section 6: Caveats & Risks

**Required subsections (in this order):**

1. **Scope Exclusions** — Bulleted list of what is NOT included. Be explicit.
2. **Assumptions** — Bulleted list of conditions assumed to be true.
3. **Risks** — Table format with columns: Risk | Impact | Mitigation.
4. **Change Control** — Standard paragraph:
   > *"This engagement is scoped as a [billing model] project. Any work, equipment, or services not explicitly described in this document are considered out of scope. Out-of-scope requests identified during the engagement will be documented and presented to the client as a separate change order or scope of work for review and approval prior to execution."*

---

### Section 7: Completion Criteria

- Bulleted or numbered list of specific, measurable conditions.
- Each criterion should map to a deliverable from Section 2 or Section 5.
- Include a closing statement:
  > *"Upon receipt of written sign-off, the project will be formally closed. Any issues or requests identified after sign-off will be handled through standard Dedicated IT support channels or scoped as a separate engagement."*

---

### Section 8: Approval

**Optional: Quote Summary Table** — Include when the SoW contains fixed-fee pricing or line-item costs. Columns: Description | Amount. Include Subtotal, Tax (if applicable), Total.

**Signature Block:**
- Side-by-side table layout (two columns).
- Left: Client entity name, Signature line, Printed Name, Title, Date.
- Right: "Dedicated IT, LLC", Signature line, Printed Name, Title, Date.

**Preamble text:**
> *"By signing below, the authorized representatives acknowledge they have reviewed this Statement of Work and agree to the scope, deliverables, prerequisites, and exclusions outlined herein. Work will commence upon receipt of signed approval."*

---

### Section 9: Estimated Labor Hours

**Table structure — Multi-role format (preferred):**

| Task / Phase | Standard ($185/hr) | Senior ($225/hr) | Hours Total | Est. Labor Cost |
|---|---|---|---|---|

- One row per phase, matching Section 5 phase names.
- Add "Project Management (ongoing)" as a separate row.
- Bold the **TOTALS** row.

**Table structure — Single-role format (acceptable for single-engineer engagements):**

| Phase | Hours | Role | Rate |
|---|---|---|---|

**Standard labor rates:**
- Standard Engineer: $185/hr
- Senior Engineer: $225/hr
- Emergency/After-Hours: $285/hr

**Closing notes (always include):**
- *"This estimate is for budgetary planning purposes. Labor will be billed at actual hours incurred."*
- *"Travel expenses, if applicable, will be billed separately at cost."*
- *"Hardware and licensing costs are not included in labor estimates and will be quoted separately upon confirmation of final specifications."* (Include only when hardware is not itemized in Section 2.)

---

## 5. Formatting Rules

### Typography
- **Font:** Arial throughout
- **Body text:** 11pt
- **Section headings (H1):** 14pt bold
- **Subsection headings (H2):** 12pt bold
- **Phase titles (H3):** 11pt bold

### Page Layout
- **Paper:** US Letter (8.5" × 11")
- **Margins:** 1" all sides
- **Header:** Right-aligned, italicized, gray: `[Client Name] — [Project Name]`
- **Footer:** Centered, gray: `Page [N] | Version [X.Y] | CONFIDENTIAL`

### Tables
- **Header row:** Dark blue background (#1F3864), white bold text
- **Alternating rows:** Light blue (#D6E4F0) / white
- **Border:** Light gray (#CCCCCC), single line
- **Cell padding:** 80 DXA top/bottom, 120 DXA left/right
- **Width:** Full content width (9360 DXA for 1" margins)

### Color Palette
| Use | Hex | Description |
|---|---|---|
| Table header BG | #1F3864 | Dark navy |
| Table header text | #FFFFFF | White |
| Table alt row | #D6E4F0 | Light blue |
| Accent text | #2E75B6 | Medium blue |
| Body text | #000000 | Black |
| Subtle/meta text | #888888 | Gray |
| Border | #CCCCCC | Light gray |

---

## 6. CVG-CAELUM JSON Schema

The following JSON schema defines the data model for programmatic SoW generation. All SoW data entered through Caelum MUST conform to this schema.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DIT-SoW-v2",
  "type": "object",
  "required": ["cover", "summary", "proposed_solution", "prerequisites", "project_management", "phases", "caveats_risks", "completion_criteria", "approval", "labor_hours"],
  "properties": {
    "cover": {
      "type": "object",
      "required": ["client", "provider", "billing_model", "document_date", "version", "classification"],
      "properties": {
        "client": { "type": "string" },
        "facility": { "type": "string" },
        "project_name": { "type": "string" },
        "provider": { "type": "string", "const": "Dedicated IT, LLC" },
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
        "included_items_table": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["description", "unit_price", "qty", "ext_price"],
            "properties": {
              "description": { "type": "string" },
              "unit_price": { "type": "number" },
              "qty": { "type": "integer" },
              "ext_price": { "type": "number" }
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
        "required": ["number", "title", "estimated_hours", "objective", "tasks", "deliverables"],
        "properties": {
          "number": { "type": "integer", "minimum": 1 },
          "title": { "type": "string" },
          "estimated_hours": { "type": "integer", "minimum": 1 },
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
      "required": ["client_entity", "provider_entity"],
      "properties": {
        "quote_summary": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["description", "amount"],
            "properties": {
              "description": { "type": "string" },
              "amount": { "type": "string" }
            }
          }
        },
        "client_entity": { "type": "string" },
        "client_signer_name": { "type": "string" },
        "client_signer_title": { "type": "string" },
        "provider_entity": { "type": "string", "const": "Dedicated IT, LLC" },
        "provider_signer_name": { "type": "string" },
        "provider_signer_title": { "type": "string" }
      }
    },
    "labor_hours": {
      "type": "object",
      "required": ["format", "rows"],
      "properties": {
        "format": { "type": "string", "enum": ["multi_role", "single_role"] },
        "rates": {
          "type": "object",
          "properties": {
            "standard": { "type": "number", "default": 185 },
            "senior": { "type": "number", "default": 225 },
            "emergency": { "type": "number", "default": 285 }
          }
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["phase"],
            "properties": {
              "phase": { "type": "string" },
              "standard_hours": { "type": "number" },
              "senior_hours": { "type": "number" },
              "emergency_hours": { "type": "number" },
              "total_hours": { "type": "number" },
              "est_cost": { "type": "number" },
              "role": { "type": "string" },
              "rate": { "type": "number" },
              "hours": { "type": "number" }
            }
          }
        },
        "notes": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

---

## 7. Validation Checklist

Before any SoW is delivered:

- [ ] All 9 sections present in order (1–9)
- [ ] Cover table contains all required fields
- [ ] Billing model explicitly stated
- [ ] Confidentiality notice present
- [ ] Section 2 begins with narrative (not a list)
- [ ] Section 4 contains all 3 mandatory PM tasks verbatim
- [ ] Each phase in Section 5 has: title, estimated hours, objective, tasks, deliverables
- [ ] Section 6 contains all 4 subsections: Exclusions, Assumptions, Risks (table), Change Control
- [ ] Section 7 criteria map to deliverables
- [ ] Approval block uses side-by-side layout
- [ ] Labor table includes totals row
- [ ] No placeholder text remains (or explicitly marked [TBD])
- [ ] Header and footer present on all pages
- [ ] Document passes DOCX validation

---

## 8. Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-09 | Benjamin Posner | Initial spec from Scope Statement Template chat |
| 2.0 | 2026-03-10 | Benjamin Posner | Complete rewrite after 3-doc audit. Added: cover table standardization, Section 6 restructure (4 subsections), estimated hours per phase, risk table format, quote summary in approval, JSON schema for Caelum, validation checklist, formatting/color rules. |
