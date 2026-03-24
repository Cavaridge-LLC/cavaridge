# SOW-MASTER-SPEC v2.2

> **Status:** LOCKED  
> **Effective:** 2026-03-24  
> **Supersedes:** v2.1 (2026-03-12)

---

## 1. Document Structure

All SoWs consist of **8 sections by default** (9 if Approval is explicitly requested):

| # | Section | Required |
|---|---------|----------|
| 1 | Summary | Yes |
| 2 | Proposed Solution | Yes |
| 3 | Prerequisites | Yes |
| 4 | Project Management | Yes |
| 5 | High-Level Project Outline | Yes |
| 6 | Caveats and Risks | Yes |
| 7 | Completion Criteria | Yes |
| 8 | Estimated Labor Hours | Yes |
| (8 or 9) | Approval | **Only when requested** |

When Approval is included, it slides in as Section 8 and Estimated Labor Hours bumps to Section 9.

---

## 2. List Formatting Rule (NEW in v2.2)

**Bullets are the default list style.** Use unordered bullet points for all lists throughout the SoW unless one of the following exceptions applies:

- **Numbered lists** — Use only when items must be executed or read in a specific sequence (e.g., phased project outline, step-by-step procedures).
- **Lettered lists** — Use only when items are cross-referenced elsewhere in the document by their letter designator.
- **Numbered subsections** (e.g., 2.1, 2.2) — Continue using these for Section 2 (Proposed Solution) subsection headings per existing convention.

If there is no ordering or cross-reference reason, default to bullets.

---

## 3. Cover Page

Layout (top to bottom, centered):

1. **Vendor header** — Provider name, bold, large font, #2E5090
2. **Subtitle** — "Statement of Work", bold, #2E5090
3. **Project title** — Descriptive project name, #1A1A1A
4. **Client line** — `Client: [Client Name]`

**Cover info fields** (left-aligned, below title block):

| Field | Required |
|-------|----------|
| Client | Yes |
| Facility | Yes |
| Date | Yes |
| Prepared By | Yes |
| Reference # | Yes |

---

## 4. Section-by-Section Requirements

### Section 1: Summary

- 1–2 paragraphs, narrative prose. No bullets or tables.
- States what the provider will do, for whom, and the high-level deliverable.
- Billing model stated here if applicable.

### Section 2: Proposed Solution

- Opens with narrative overview (1–2 paragraphs).
- Uses numbered subsections (2.1, 2.2, etc.) for distinct workstreams.
- Within each subsection, use **bullets** for task/deliverable lists (not lettered or numbered unless sequence matters).
- Tables are permitted for component/equipment summaries.

### Section 3: Prerequisites

Standard preamble:

> "The following items must be in place prior to project commencement. Delays in meeting these prerequisites may impact the project timeline and/or require a change order."

Followed by **bullet list** of prerequisites. Tailor to the specific project. Every prerequisite should be something that, if not met, would block or delay execution.

### Section 4: Project Management

This section contains **project logistics, contact information, and PM task commitments**. Use the following subsection structure. Include only the subsections that are applicable to the scope — omit any that do not apply.

#### Shipping Address
Physical address where equipment should be shipped, if equipment procurement or shipping is part of the scope. Use `[TBD – To be provided by {client}]` if unknown.

If shipping is not part of the scope, omit this subsection entirely.

#### Site Address
Physical address of the facility where work will be performed. Use `[TBD – To be provided by {client}]` if unknown.

#### Client Point of Contact
Primary client-side decision-maker for the engagement:
- Name
- Email
- Phone

Use `[TBD]` for unknown values. If a secondary contact is relevant (e.g., onsite technical contact separate from project sponsor), add an additional contact block with a descriptive label.

#### Vendor Contacts (Include Only Applicable Entries)

Include a subsection for each third-party vendor whose coordination is relevant to the scope. **Only include vendors that apply to this specific engagement.** Common vendor contact types include (but are not limited to):

- **GC Point of Contact** — General Contractor, when construction coordination is needed.
- **Internet Services Provider / Broker** — When ISP circuit ordering, coordination, or handoff is in scope.
- **Low Voltage Contractor** — When structured cabling, WAP mounting, or cable termination coordination is needed.
- **Other Vendors** — Any vendor the provider must coordinate with (e.g., security alarm company, elevator company, AV integrator, equipment supplier).

For each applicable vendor contact, include:
- Name
- Email
- Phone

Use `[TBD]` for unknown values. If no vendor coordination is needed, include a brief italicized note:

> *No third-party vendor coordination is anticipated for this engagement. If vendor involvement becomes necessary, the client will provide contact details at that time.*

#### Project Management Tasks

**The following three items are mandatory in every SoW without exception:**

- Provide project plan with milestones (if applicable) and estimated time of completion.
- Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.
- Remove old documentation references and update documentation to reflect new configurations.

**Additional PM tasks to include when applicable** (bullets, not numbered):

- Coordinate technical handoff, deployment support, and validation with onsite technical contact and LV vendor.
- Coordinate equipment delivery and storage logistics with the general contractor (GC) and site administrators.
- Manage vendor coordination for [specific vendors].

### Section 5: High-Level Project Outline

Organize as numbered phases (numbering is appropriate here — phases are sequential). Each phase **must** follow this structure:

```
Phase N: [Phase Name]

Objective: [One sentence describing the goal of this phase.]

Tasks
• [Task 1]
• [Task 2]

Deliverables
• [Deliverable 1]
• [Deliverable 2]
```

Not every project will have all standard phases. Merge or split as needed, but every SoW must have at minimum: a planning phase, an execution phase, and a close-out phase.

**No estimated hours per phase.** Hours live only in Section 8 (Estimated Labor Hours).

### Section 6: Caveats and Risks

Organize into four numbered subsections:

#### 6.1 Scope Exclusions
**Bullet list** of what is explicitly not included.

#### 6.2 Assumptions
**Bullet list** of conditions assumed to be true.

#### 6.3 Risks
Table format with three columns:

| Risk | Impact | Mitigation |
|------|--------|------------|

Include 4–6 risks relevant to the project.

#### 6.4 Change Control
Standard paragraph describing the change order process. Typical language:

> "Any work not explicitly defined in this Statement of Work will require a formal Change Request. Change Requests must be submitted in writing and approved by both parties before work begins. Approved changes may impact timeline, cost, and resource allocation."

### Section 7: Completion Criteria

**Bullet list** of criteria that must all be met for the engagement to be considered complete. Each criterion should map to a deliverable in Section 2 or a phase in Section 5.

### Section 8: Estimated Labor Hours

Table format:

| Role | Scope | Est. Hours |
|------|-------|-----------|
| [Generic role] | [Description of involvement] | [Range, e.g. 4 – 6] |
| | **Total Estimated Range** | [Sum range] |

**Rules:**
- Roles are generic (Project Manager, Senior Engineer, Field Technician, etc.) — never named individuals.
- Hours are always **ranges** (e.g., "16 – 24"), never fixed numbers.
- **NO rates, NO dollar amounts, NO pricing of any kind.**
- Include a totals row with the summed range.
- Optional notes below the table for clarification (italicized).

### Section 8/9: Approval (OPTIONAL)

**Excluded by default.** Include only when explicitly requested.

When included:
- Stacked underscore signature lines (not side-by-side table).
- Client signs first, provider signs second.
- Each signature block: Name, Title, Signature line, Date line.

---

## 5. Formatting Rules (LOCKED)

| Element | Value |
|---------|-------|
| Font | Arial |
| Body text size | 11pt |
| H1 color | #2E5090 |
| H2 color | #1A1A1A |
| Body text color | #333333 |
| Table header background | #2E5090 |
| Table header text | #FFFFFF (white) |
| Table row banding | #F2F6FA |
| Table borders | #BFBFBF |
| Page size | US Letter (8.5" × 11") |
| Margins | 1" all sides |

---

## 6. JSON Schema (for CVG-CAELUM)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SowDocumentV2_2",
  "type": "object",
  "required": [
    "metadata", "summary", "proposed_solution", "prerequisites",
    "project_management", "phases", "caveats_risks",
    "completion_criteria", "labor_hours"
  ],
  "properties": {
    "metadata": {
      "type": "object",
      "required": ["client", "facility", "date", "prepared_by", "reference"],
      "properties": {
        "client": { "type": "string" },
        "facility": { "type": "string" },
        "date": { "type": "string", "format": "date" },
        "prepared_by": { "type": "string" },
        "reference": { "type": "string", "pattern": "^SOW-\\d{4}$" },
        "project_title": { "type": "string" }
      }
    },
    "summary": {
      "type": "object",
      "required": ["text"],
      "properties": {
        "text": { "type": "string", "description": "1-2 paragraph narrative. No bullets or tables." },
        "billing_model": { "type": "string", "enum": ["T&M", "Fixed-Fee", "Hybrid"] }
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
              "narrative": { "type": "string" },
              "tasks": { "type": "array", "items": { "type": "string" }, "description": "Bullet items within subsection." }
            }
          }
        }
      }
    },
    "prerequisites": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Rendered as bullet list."
    },
    "project_management": {
      "type": "object",
      "required": ["site_address", "client_contact", "pm_tasks"],
      "properties": {
        "shipping_address": {
          "type": "string",
          "description": "Physical shipping address. Omit property entirely if shipping is not in scope."
        },
        "site_address": { "type": "string" },
        "client_contact": {
          "type": "object",
          "required": ["name"],
          "properties": {
            "label": { "type": "string", "default": "Client Point of Contact" },
            "name": { "type": "string" },
            "email": { "type": "string" },
            "phone": { "type": "string" }
          }
        },
        "additional_client_contacts": {
          "type": "array",
          "description": "Additional client-side contacts (e.g., onsite technical contact).",
          "items": {
            "type": "object",
            "required": ["label", "name"],
            "properties": {
              "label": { "type": "string" },
              "name": { "type": "string" },
              "email": { "type": "string" },
              "phone": { "type": "string" }
            }
          }
        },
        "vendor_contacts": {
          "type": "array",
          "description": "Third-party vendor contacts. Include only vendors relevant to the scope. Omit array entirely or leave empty if no vendor coordination needed.",
          "items": {
            "type": "object",
            "required": ["label", "name"],
            "properties": {
              "label": { "type": "string", "description": "Vendor type label, e.g. 'GC Point of Contact', 'Internet Services Provider / Broker', 'Low Voltage Contractor'." },
              "name": { "type": "string" },
              "email": { "type": "string" },
              "phone": { "type": "string" },
              "notes": { "type": "string", "description": "Optional note, e.g. 'Circuit details still required (see prerequisites).'" }
            }
          }
        },
        "vendor_contacts_not_applicable_note": {
          "type": "string",
          "description": "Italicized note when no vendor coordination is needed. Omit if vendor_contacts has entries."
        },
        "pm_tasks": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 3,
          "description": "First 3 items are mandatory verbatim. Additional tasks appended as bullets."
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
      "minItems": 1,
      "description": "Rendered as bullet list."
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
              "role": { "type": "string", "description": "Generic role name." },
              "scope": { "type": "string", "description": "Description of involvement." },
              "hours_range": { "type": "string", "pattern": "^\\d+ [–-] \\d+$", "description": "Hour range. NEVER a fixed number. NEVER includes rates or pricing." }
            }
          },
          "minItems": 1
        },
        "total_hours_range": { "type": "string", "pattern": "^\\d+ [–-] \\d+$" },
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
- [ ] Cover page follows exact layout: vendor header → subtitle → project title → client line
- [ ] Cover info fields present with correct formatting
- [ ] Summary is narrative prose (no bullets, no tables)
- [ ] Section 2 begins with narrative and uses numbered subsections (2.1, 2.2, etc.)
- [ ] **Lists use bullets by default** — numbered/lettered only when sequence or cross-reference requires it
- [ ] Section 3 opens with standard preamble, followed by bullet list
- [ ] Section 4 includes Site Address (always) and Shipping Address (if equipment shipping is in scope)
- [ ] Section 4 includes at least one Client Point of Contact
- [ ] Section 4 includes applicable Vendor Contacts only (or "not applicable" note)
- [ ] Section 4 contains all 3 mandatory PM tasks
- [ ] Each phase in Section 5 has: title, objective, tasks, deliverables (NO estimated hours per phase)
- [ ] Section 6 contains all 4 numbered subsections: 6.1 Exclusions, 6.2 Assumptions, 6.3 Risks (table), 6.4 Change Control
- [ ] Section 7 criteria map to deliverables (bullet list)
- [ ] Approval section is ABSENT unless explicitly requested
- [ ] Labor table uses Role | Scope | Est. Hours format with hour RANGES only
- [ ] Labor table contains NO rates, NO dollar amounts, NO pricing of any kind
- [ ] Labor table includes totals row with range
- [ ] All table headers use blue bg (#2E5090) with white text
- [ ] All table row banding uses #F2F6FA
- [ ] All table borders use #BFBFBF
- [ ] Font is Arial throughout
- [ ] H1 headings are #2E5090, H2 headings are #1A1A1A
- [ ] No placeholder text remains (or explicitly marked [TBD])
- [ ] Document passes DOCX validation

---

## 8. Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-09 | Benjamin Posner | Initial spec from Scope Statement Template chat. |
| 2.0 | 2026-03-10 | Benjamin Posner | Complete rewrite after 3-doc audit. Added: cover table standardization, Section 6 restructure (4 subsections), estimated hours per phase, risk table format, quote summary in approval, JSON schema for Caelum, validation checklist, formatting/color rules. |
| 2.0.1 | 2026-03-11 | Benjamin Posner | Removed all hardcoded tenant references (DIT / Dedicated IT). Provider name, rates, and branding now resolved via tenantConfig at runtime. Renamed spec file from DIT-SOW-MASTER-SPEC to SOW-MASTER-SPEC. |
| 2.1 | 2026-03-12 | Benjamin Posner | **LOCKED as de facto standard.** Approval section excluded by default (8 sections, not 9). Labor Hours table redesigned: Role/Scope/Hours ranges only — all rates, dollar amounts, and pricing removed. Estimated hours removed from individual phases (Section 5). Color palette locked. Font locked as Arial. Cover page layout standardized. Signature block changed from side-by-side table to stacked underscore lines. JSON schema updated. Validation checklist expanded. |
| 2.2 | 2026-03-24 | Benjamin Posner | **Section 4 (Project Management) expanded:** Added Shipping Address subsection (include when equipment shipping is in scope, omit otherwise). Vendor Contacts restructured as flexible/conditional — include only contacts applicable to the engagement (GC, ISP/Broker, LV Contractor, others). Explicit "not applicable" note when no vendor coordination needed. **List formatting rule added:** Bullets are the default list style throughout all sections. Numbered/lettered lists permitted only when sequence or cross-reference requires it. JSON schema updated: added `shipping_address`, restructured `vendor_contacts` as typed array, added `vendor_contacts_not_applicable_note`, added `additional_client_contacts`. Validation checklist updated to reflect new Section 4 requirements and bullet preference. |
