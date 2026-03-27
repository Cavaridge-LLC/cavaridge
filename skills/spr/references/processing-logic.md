# SharePoint Permissions Report — Processing Logic & Generation

Complete reference for building the XLSX workbook and HTML dashboard. Read this file before generating.

## Table of Contents

1. [Data Model](#1-data-model)
2. [Risk Flag Taxonomy](#2-risk-flag-taxonomy)
3. [Report Tone Rules](#3-report-tone-rules)
4. [XLSX Structure](#4-xlsx-structure)
5. [HTML Dashboard Structure](#5-html-dashboard-structure)
6. [Formatting Standards](#6-formatting-standards)
7. [Python Generation Pattern](#7-python-generation-pattern)

---

## 1. Data Model

### JSON Schema (v1.0)

The input JSON has this structure:

```
{
  schemaVersion: "1.0",
  tenant: "contoso.onmicrosoft.com",
  collectedAt: "ISO-8601",
  collector: "PnP.PowerShell" | "Microsoft.Graph",
  summary: { totalSites, totalGroups, totalUniquePermissions, totalSharingLinks, ... },
  sites: [
    {
      url, title, template, owner, created, lastModified,
      storageUsedMB, externalSharingCapability, lockState,
      groups: [ { Name, Members: [ { LoginName, Title, Email, UserType } ], Roles } ],
      uniquePermissions: [ { Path, Type, Name, RoleAssignments: [ { Principal, PrincipalType, Roles } ] } ],
      sharingLinks: [ { Path, Type, Name, LinkType, Scope, CreatedBy, Created, Expiration, IsActive } ],
      itemsScanned, itemsWithUniquePerms,
      errors: []
    }
  ]
}
```

### Derived Fields

Compute these per-site:

| Field | Computation |
|-------|-------------|
| External Sharing Enabled | `externalSharingCapability` not in ['Disabled', 'ExistingExternalUserSharingOnly'] |
| External Members Count | Count of group members where `UserType` = 'External' or `LoginName` contains '#ext#' or '@' domain is external |
| Anonymous Link Count | Count of sharingLinks where `Scope` = 'anonymous' or `LinkType` = 'anonymous' |
| Org-Wide Link Count | Count of sharingLinks where `Scope` = 'organization' |
| Non-Expiring Link Count | Count of sharingLinks where `Expiration` is null/empty |
| Unique Perm Count | Length of `uniquePermissions` array |
| "Everyone" Grants | Count of uniquePermissions where any RoleAssignment principal contains 'Everyone' (case-insensitive) |
| "Everyone Except External" Grants | Count where principal contains 'Everyone except external users' |
| Owner Count | Number of members in the Owners group |
| Ownerless | Owner is empty or Owner group has 0 members |
| Days Since Last Modified | (now - lastModified).days |
| Stale Site | Days Since Last Modified > 180 |

### User Access Matrix

Build a cross-reference: for each unique user/group found across all sites, list every site + role they have access to. This powers the "Who Has Access" tab and HTML user-lookup view.

```python
user_access = {}  # { principal_key: [ { site_url, site_title, path, role, grant_type } ] }

for site in data['sites']:
    # From groups
    for group in site['groups']:
        for member in group.get('Members', []):
            key = (member.get('Email') or member.get('LoginName', '')).lower()
            user_access.setdefault(key, []).append({
                'site_url': site['url'],
                'site_title': site['title'],
                'path': '/ (Site Group: ' + group['Name'] + ')',
                'role': group.get('Roles', 'Member'),
                'grant_type': 'Group Membership'
            })
    # From unique permissions
    for up in site['uniquePermissions']:
        for ra in up.get('RoleAssignments', []):
            key = (ra.get('Principal', '')).lower()
            user_access.setdefault(key, []).append({
                'site_url': site['url'],
                'site_title': site['title'],
                'path': up['Path'],
                'role': ra.get('Roles', ''),
                'grant_type': 'Direct/Unique Permission'
            })
```

---

## 2. Risk Flag Taxonomy

### Site-Level Flags

| Flag | Severity | Condition |
|------|----------|-----------|
| Anonymous Sharing Links Active | **Critical** | Site has ≥1 anonymous sharing link |
| External Sharing — Unintended | **High** | externalSharingCapability allows external AND intake says not intentional |
| "Everyone" Permissions Present | **High** | Site has ≥1 "Everyone" or "Everyone except external users" grant |
| Ownerless Site | **High** | No owner or owners group is empty |
| Excessive Unique Permissions | **Medium** | >50 items with unique permissions in a single site |
| Non-Expiring Sharing Links | **Medium** | ≥1 sharing link with no expiration date |
| Organization-Wide Sharing Links | **Medium** | ≥1 org-scope sharing link (anyone in org can access) |
| Stale Site with Active Sharing | **Medium** | Last modified >180 days ago AND has active sharing links |
| External Members in Groups | **Low** | External users found in site permission groups |
| Stale Site — No Sharing | **Low** | Last modified >180 days ago, no sharing links (just a note) |

### Contextual Suppressions (based on intake)

| Intake Answer | Flag Affected | Action |
|---------------|---------------|--------|
| External sharing intentional (M&A/vendor) | External Sharing — Unintended | **SUPPRESS.** Reframe: "External sharing is enabled by design for [stated purpose]." |
| Named sites with intentional broad access | "Everyone" Permissions on those sites | Downgrade to **Info**. Note: "Confirmed intentional — company-wide resource." |
| Sensitivity labels / DLP in use | All Medium flags | Note compensating control in executive summary. Do not suppress flags. |
| Named service accounts | External Members in Groups (for those accounts) | Downgrade to **Info**. |
| Sites pending decommission | Stale Site flags for those sites | Downgrade to **Info**. Note: "Scheduled for decommission." |

### Sharing Link Risk Classification

| Link Type | Scope | Severity | Description |
|-----------|-------|----------|-------------|
| anonymous | anonymous | **Critical** | Anyone with the URL can access — no auth required |
| edit | anonymous | **Critical** | Anonymous AND writable — extreme risk |
| view/edit | organization | **Medium** | Every user in the org can access via link |
| view/edit | users | **Low** | Specific people — lowest sharing risk |
| any | any + no expiration | +1 severity tier | Bump severity one level for no-expiration links |

---

## 3. Report Tone Rules

### Posture Assessment

| Posture | Criteria | Framing |
|---------|----------|---------|
| **Strong** | No Critical flags, ≤2 High flags, external sharing intentional or disabled | Lead with positive findings. Frame remaining items as "Maintenance Observations." |
| **Moderate** | No Critical flags, but 3+ High or many Medium flags | Acknowledge strengths, present prioritized recommendations. |
| **Needs Attention** | ≥1 Critical flag OR 5+ High flags | Lead with highest-severity items. Recommendations are direct but professional. |

### Universal Framing Rules

- **ALWAYS:** "This report provides a point-in-time snapshot of the SharePoint Online permission structure to support ongoing access governance."
- **NEVER:** "This report reveals security failures" or language implying negligence.
- **Anonymous links:** "Publicly accessible content identified — recommend immediate review to confirm business need."
- **Everyone permissions:** "Broadly scoped access detected — recommend narrowing to named groups."
- **Stale sites:** "Inactive site with residual permissions — recommend archival review."
- **Large unique-permission counts:** "Permission complexity in this library may benefit from restructuring to use group-based access."

### Positive Findings Section

Include when compensating controls are present:

```
Positive Finding: Information Protection Controls

[Sensitivity labels / DLP policies] are deployed in this tenant, providing
automated classification and protection of sensitive content independent of
SharePoint permission settings.

[If external sharing is intentional:]
External sharing is configured to support [stated purpose] with appropriate
scoping at the site-collection level rather than tenant-wide.

Assessment: The organization has layered security controls that complement
SharePoint-native permissions.
```

---

## 4. XLSX Structure

### Tab 1: Executive Summary

1. **Title:** "[Client Name] — SharePoint Permissions & Security Report"
2. **Report Date**, **Collected**, **Prepared By**
3. **Collection Info:** Collector version, scan duration, scope
4. **Positive Findings block** (green, only if applicable)
5. **Metrics table:**
   - Total Site Collections
   - Sites with External Sharing Enabled (with context)
   - Total Permission Groups
   - Items with Unique (Non-Inherited) Permissions
   - Active Sharing Links (breakdown: anonymous / org / user-scoped)
   - External Users with Access
6. **Findings table** — "Security Observations" or "Maintenance Observations" (strong)
   - Each row: Finding | Severity | Affected Sites | Context
7. **Recommendations** — numbered, 5-8 items, tone-appropriate

### Tab 2: All Sites

Columns: Site Title | URL | Template | Owner | Created | Last Modified | Days Since Modified | Storage (MB) | External Sharing | Groups Count | Unique Perms | Sharing Links | Anonymous Links | Risk Flags

Filters enabled. Frozen header. Flagged rows highlighted.

### Tab 3: Permission Groups

Columns: Site Title | Site URL | Group Name | Role | Member Count | External Members | Members List (truncated to 500 chars)

### Tab 4: Unique Permissions (Broken Inheritance)

Columns: Site Title | Path | Item Type | Item Name | Principal | Principal Type | Role | Risk Flag

### Tab 5: Sharing Links

Columns: Site Title | Path | Item Type | Item Name | Link Type | Scope | Created By | Created Date | Expiration | Severity

Sorted: Critical first, then by site.

### Tab 6: External Access

Columns: Site Title | Site URL | External Sharing Setting | External Users | External Groups | Anonymous Links | Sharing Links (Non-Expiring)

### Tab 7: Who Has Access (User-Centric)

Columns: User/Group | Type | Sites with Access | Total Access Grants | Highest Role | Access Details (semicolon-delimited)

Sorted by total access grants descending — users with broadest access first.

---

## 5. HTML Dashboard Structure

The HTML file is a single self-contained file (no external dependencies except CDN-hosted Tailwind and Alpine.js/vanilla JS). It includes:

### Header
- Client name, report date, collection metadata
- DIT/Cavaridge branding

### Summary Cards (top row)
- Total Sites | External Sharing Sites | Unique Permissions | Sharing Links | Critical Findings | High Findings

### Tab 1: Risk Overview
- Findings table (sortable, filterable by severity)
- Stacked bar chart of risk distribution by site (CSS-only or SVG)

### Tab 2: Site Explorer
- Left panel: alphabetical site list with risk badge
- Right panel: selected site detail showing groups, unique permissions, sharing links
- Tree view for permission hierarchy: Site → Library → Folder → File

### Tab 3: Who Has Access
- Search box: type a user's name/email to see everywhere they have access
- Results: table of site + path + role + grant type
- "Broadest Access" section: users with access to the most sites

### Tab 4: Sharing Links
- Filterable table of all sharing links
- Color-coded severity badges
- Quick filters: Anonymous | Org-Wide | No Expiration | External

### Tab 5: Recommendations
- Prioritized list matching the XLSX executive summary
- Expandable detail sections

### Design Requirements
- Responsive (usable on tablet)
- Print-friendly (media query hides nav, shows all sections)
- Brand colors: #2E5090 primary, #F2F6FA background, #1A1A1A text
- No external API calls — all data embedded in the HTML

---

## 6. Formatting Standards

Same as IAR — maintains brand consistency across all AEGIS reports.

| Element | Value |
|---------|-------|
| Font | Arial throughout |
| Title | 14pt bold, color #2E5090 |
| Section headers | 11pt bold, color #1A1A1A |
| Body text | 9pt, color #1A1A1A |
| Muted/attribution | 10pt italic, color #555555 |
| Table header row | 10pt bold white text on #2E5090 fill |
| Row banding | Alternating #F2F6FA / #FFFFFF |
| Borders | Thin, color #BFBFBF |
| Positive finding rows | Fill #F0FFF0, text #2E7D32 |
| Critical flag rows | Fill #FFE0E0 |
| High flag rows | Fill #FFF0F0 |
| Medium flag rows | Fill #FFF3E0 |
| Low/Info flag rows | Fill #FFFDE7 |
| Green metric rows | Fill #F0FFF0, bold text #2E7D32 |

### Severity Color Map (for HTML badges)

| Severity | Background | Text |
|----------|-----------|------|
| Critical | #DC2626 | #FFFFFF |
| High | #EA580C | #FFFFFF |
| Medium | #D97706 | #FFFFFF |
| Low | #2563EB | #FFFFFF |
| Info | #6B7280 | #FFFFFF |

### openpyxl Style Constants

```python
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

BLUE_HDR = PatternFill('solid', fgColor='2E5090')
LIGHT_BAND = PatternFill('solid', fgColor='F2F6FA')
WHITE_FILL = PatternFill('solid', fgColor='FFFFFF')
CRITICAL_FILL = PatternFill('solid', fgColor='FFE0E0')
HIGH_FILL = PatternFill('solid', fgColor='FFF0F0')
MEDIUM_FILL = PatternFill('solid', fgColor='FFF3E0')
LOW_FILL = PatternFill('solid', fgColor='FFFDE7')
GREEN_FILL = PatternFill('solid', fgColor='F0FFF0')

HDR_FONT = Font(name='Arial', bold=True, color='FFFFFF', size=10)
BODY_FONT = Font(name='Arial', size=9)
BOLD_FONT = Font(name='Arial', bold=True, size=9)
TITLE_FONT = Font(name='Arial', bold=True, size=14, color='2E5090')
SUBTITLE_FONT = Font(name='Arial', bold=True, size=11, color='1A1A1A')
MUTED_FONT = Font(name='Arial', italic=True, size=10, color='555555')
GREEN_BOLD = Font(name='Arial', bold=True, size=9, color='2E7D32')
CRITICAL_FONT = Font(name='Arial', bold=True, size=9, color='DC2626')

THIN_BORDER = Border(
    left=Side(style='thin', color='BFBFBF'),
    right=Side(style='thin', color='BFBFBF'),
    top=Side(style='thin', color='BFBFBF'),
    bottom=Side(style='thin', color='BFBFBF'))
```

---

## 7. Python Generation Pattern

### XLSX Generation

Use `pandas` for data shaping and `openpyxl` for workbook generation.

```python
import json
import pandas as pd
from openpyxl import Workbook
from datetime import datetime, timezone

# 1. Load JSON
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

NOW = datetime.now(timezone.utc)

# 2. Build DataFrames
sites_df = build_sites_dataframe(data)          # Tab 2
groups_df = build_groups_dataframe(data)         # Tab 3
unique_perms_df = build_unique_perms_df(data)    # Tab 4
sharing_links_df = build_sharing_links_df(data)  # Tab 5
external_df = build_external_access_df(data)     # Tab 6
user_access_df = build_user_access_df(data)      # Tab 7

# 3. Compute risk flags per site
for idx, site in sites_df.iterrows():
    sites_df.at[idx, 'Risk Flags'] = compute_site_risk_flags(site, data, intake)

# 4. Build workbook with 7 tabs per §4
# 5. Apply formatting per §6
# 6. Save to /home/claude/, copy to /mnt/user-data/outputs/
# 7. Present via present_files tool
```

### HTML Generation

Generate a single self-contained HTML file:

```python
html_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{client_name} — SharePoint Permissions Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Brand overrides and print styles */
        @media print {{ .no-print {{ display: none; }} }}
    </style>
</head>
<body>
    <!-- Embed data as JSON in a script tag -->
    <script>
        const REPORT_DATA = {json_data};
    </script>

    <!-- Dashboard UI built with vanilla JS -->
    ...
</body>
</html>"""
```

**IMPORTANT:** Since the HTML will be served locally, use the CDN Tailwind script tag. All interactive behavior should be vanilla JavaScript (no React/Alpine dependency). Embed the full dataset as a JSON object in a `<script>` tag so the dashboard is fully self-contained.

### Risk Flag Computation

```python
def compute_site_risk_flags(site_row, raw_data, intake):
    flags = []
    site = next((s for s in raw_data['sites'] if s['url'] == site_row['URL']), None)
    if not site:
        return 'None'

    # Critical: Anonymous sharing links
    anon_links = [l for l in site.get('sharingLinks', [])
                  if str(l.get('Scope', '')).lower() == 'anonymous'
                  or str(l.get('LinkType', '')).lower() == 'anonymous']
    if anon_links:
        flags.append(f'CRITICAL: {len(anon_links)} Anonymous Sharing Link(s)')

    # High: Unintended external sharing
    ext_sharing = site.get('externalSharingCapability', 'Disabled')
    if ext_sharing not in ['Disabled', 'ExistingExternalUserSharingOnly']:
        if not intake.get('external_sharing_intentional'):
            flags.append('HIGH: External Sharing Enabled (Unintended)')

    # High: "Everyone" permissions
    everyone_count = sum(1 for up in site.get('uniquePermissions', [])
                         for ra in up.get('RoleAssignments', [])
                         if 'everyone' in str(ra.get('Principal', '')).lower())
    if everyone_count > 0:
        flags.append(f'HIGH: {everyone_count} "Everyone" Permission Grant(s)')

    # High: Ownerless
    if not site.get('owner'):
        flags.append('HIGH: No Site Owner')

    # Medium: Excessive unique permissions
    if site.get('itemsWithUniquePerms', 0) > 50:
        flags.append(f'MEDIUM: {site["itemsWithUniquePerms"]} Items with Unique Permissions')

    # Medium: Non-expiring sharing links
    non_exp = [l for l in site.get('sharingLinks', []) if not l.get('Expiration')]
    if non_exp:
        flags.append(f'MEDIUM: {len(non_exp)} Non-Expiring Sharing Link(s)')

    # Medium: Org-wide sharing links
    org_links = [l for l in site.get('sharingLinks', [])
                 if str(l.get('Scope', '')).lower() == 'organization']
    if org_links:
        flags.append(f'MEDIUM: {len(org_links)} Organization-Wide Sharing Link(s)')

    # Medium: Stale site with active sharing
    days = site_row.get('Days Since Modified')
    if days and days > 180 and site.get('sharingLinks'):
        flags.append('MEDIUM: Stale Site with Active Sharing Links')

    # Low: External members
    ext_members = sum(1 for g in site.get('groups', [])
                      for m in g.get('Members', [])
                      if m.get('UserType') == 'External'
                      or '#ext#' in str(m.get('LoginName', '')).lower())
    if ext_members > 0:
        flags.append(f'LOW: {ext_members} External User(s) in Permission Groups')

    # Low: Stale site (no sharing)
    if days and days > 180 and not site.get('sharingLinks'):
        flags.append('LOW: Stale Site (>180 Days Inactive)')

    return '; '.join(flags) if flags else 'None'
```

### Date Handling

```python
from datetime import datetime, timezone

NOW = datetime.now(timezone.utc)

def parse_iso_date(val):
    if not val or str(val).strip() == '':
        return None
    try:
        dt = pd.to_datetime(val, utc=True)
        return dt
    except:
        return None

def days_since(date_val):
    dt = parse_iso_date(date_val)
    if dt is None:
        return None
    return (NOW - dt.to_pydatetime().replace(tzinfo=timezone.utc)).days
```
