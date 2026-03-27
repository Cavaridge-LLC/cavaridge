---
name: spr
description: "Generate a SharePoint Online Permissions & Security Report as a branded .xlsx workbook + interactive .html dashboard. Use this skill whenever the user uploads a SharePoint permissions audit JSON file (from the PnP or Graph collector scripts), mentions 'SharePoint permissions', 'SPR', 'SharePoint security report', 'site permissions audit', 'sharing link audit', 'SharePoint access review', or 'who has access to what in SharePoint'. Also trigger for casual phrasing like 'run a SharePoint report for [client]', 'check SharePoint permissions', 'audit our SharePoint', 'external sharing report', or 'SharePoint oversharing'. This skill produces both .xlsx and .html files."
---

# AEGIS SharePoint Permissions & Security Report — Generation Skill

## Overview

This skill generates a client-ready SharePoint Online Permissions & Security Report. It ingests structured JSON from one of two PowerShell data-collection scripts (PnP.PowerShell or Microsoft.Graph SDK), analyzes site structures, permission hierarchies, sharing links, external access, and oversharing patterns, then produces:

1. **Branded XLSX workbook** — executive summary + 6 data tabs, pivot-ready, DIT/Cavaridge branded
2. **Interactive HTML dashboard** — tree navigation, user-centric access view, risk heatmap, filterable

**This is a DIT / Cavaridge Managed Services deliverable.** The report must never frame findings in a way that implies the MSP has been negligent. Findings are improvement opportunities and proactive security hygiene, not evidence of failure.

## Required Input

**One JSON file** produced by either collector script:

| Collector | Script | Filename Pattern |
|-----------|--------|-----------------|
| PnP.PowerShell | `Invoke-SPPermissionsAudit-PnP.ps1` | `SPPermissionsAudit_*.json` |
| Microsoft.Graph | `Invoke-SPPermissionsAudit-Graph.ps1` | `SPPermissionsAudit_*.json` |

Both scripts produce JSON with `schemaVersion: '1.0'` and the same top-level structure. Auto-detect via the `collector` field.

If the user doesn't have the JSON yet, read and relay the collection instructions from `references/collection-instructions.md`.

## Workflow

### Step 1: Identify the File

Check `/mnt/user-data/uploads/` for a JSON file. Validate:
- Has `schemaVersion` field (must be '1.0')
- Has `sites` array with at least one entry
- Has `summary` object

If the file is missing or invalid, ask the user.

### Step 2: Ask Intake Questions

**MANDATORY — do not generate the report until these are answered.**

Ask all required questions in a single message using the ask_user_input tool for structured ones.

| # | Question | Impact |
|---|----------|--------|
| **1** | **Client name** (as it should appear in the report header) | Report title |
| **2** | **Is external sharing intentionally enabled? For what purpose?** (M&A collaboration, vendor portal, public resources, or Not intended) | If intentional: reframe external sharing findings as "configured as expected." If not: flag as High risk. |
| **3** | **Are there known sites with intentionally broad access?** (e.g. company-wide intranet, public knowledge base) | Suppress oversharing flags on named sites |
| **4** | **Does this organization use sensitivity labels or DLP policies?** | If yes: note as compensating control in positive findings |

**Optional follow-ups** (ask, but proceed with defaults if user says "just run it"):

| # | Question | Default |
|---|----------|---------|
| 5 | Known service accounts with site access? | Flag all, recommend review |
| 6 | Any sites pending decommission? | Flag all stale sites |
| 7 | Prepared by? | "Dedicated IT (DIT)" |

### Step 3: Generate Both Reports

Read the full processing logic from `references/processing-logic.md`, then execute in this order:

1. **Parse and analyze** the JSON data
2. **Compute risk flags** per the taxonomy
3. **Generate XLSX** workbook (7 tabs)
4. **Generate HTML** interactive dashboard
5. **Save both** to `/mnt/user-data/outputs/`

### Step 4: Deliver

Present both files via `present_files`. Give a brief summary of key numbers (total sites, unique permissions, sharing links, external-sharing-enabled sites, top risk findings) but keep it concise — the reports speak for themselves.

## Critical Rules

1. **Never generate without confirming external sharing intent.** This single answer changes the entire risk profile — a tenant with external sharing enabled intentionally for vendor collaboration is fundamentally different from one where it's enabled by accident.
2. **Never frame findings as MSP negligence.** Everything is "proactive review," "establishing a baseline," "security hygiene." Never "gap," "failure," "oversight."
3. **"Everyone" and "Everyone except external users" permissions are always flagged.** These are the #1 oversharing vector regardless of intent.
4. **Anonymous sharing links are always High severity.** No exception — they are publicly accessible URLs.
5. **File-level unique permissions in bulk = management burden flag.** More than 50 unique permissions in a single library signals a structural problem, not fine-grained security.
6. **Sharing links without expiration are flagged.** Even intentional sharing should have a review cadence.
7. **All formatting follows Cavaridge/DIT brand standards.** Same constants as IAR: Arial, H1 #2E5090, blue table headers with white text, #F2F6FA row banding, #BFBFBF borders.
