# CVG-AEGIS-SPR-SPEC-v1.0
## SharePoint Permissions & Security Report — Architecture Specification

**Version:** 1.0  
**Date:** 2026-03-27  
**Status:** APPROVED  
**Author:** Architecture (Claude) → Builder (Claude Code CLI)  
**IP Owner:** Cavaridge, LLC (D-U-N-S: 138750552)  
**Affects:** CVG-AEGIS, monorepo, Claude skills, Railway

---

## 1. PURPOSE

This specification defines the SharePoint Permissions & Security Report (SPR) module within the AEGIS Security Posture Platform. The SPR provides a comprehensive audit of SharePoint Online permissions, sharing links, group memberships, and access patterns across an entire M365 tenant — down to the file level.

---

## 2. DELIVERY ARCHITECTURE

### 2.1 Three-Phase Deployment

| Phase | Delivery | Status |
|-------|----------|--------|
| **Phase 1** | Standalone Railway service (`cavaridge-spr`) hosting browser collector + script downloads. Claude skill generates XLSX + HTML reports from uploaded JSON. | **Active** |
| **Phase 2** | AEGIS module with API routes (`/api/aegis/spr/*`). Server-side Graph API connector replaces manual script runs. Report storage in Supabase. | Planned |
| **Phase 3** | Recurring scan agent via Ducky → Spaniel → OpenRouter. Diff-based alerting on permission changes. Cross-reference with IAR data. | Planned |

### 2.2 Component Map

```
┌────────────────────────────────────────────────────────────┐
│                    Data Collection                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Browser  │ │ Python   │ │ PnP PS   │ │ Graph PS SDK │  │
│  │ MSAL.js  │ │ MSAL     │ │ PnP.PS   │ │ Microsoft.   │  │
│  │          │ │          │ │          │ │ Graph        │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘  │
│       └──────────┬──┴───────────┘───────────────┘          │
│                  ▼                                          │
│        JSON (Schema v1.0)                                  │
└────────────────┬───────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│ Claude Skill  │  │ AEGIS API        │
│ (spr skill)   │  │ /api/aegis/spr/  │
│               │  │ analyze          │
│ ┌───────────┐ │  └────────┬─────────┘
│ │ XLSX      │ │           │
│ │ Generator │ │           ▼
│ ├───────────┤ │  ┌──────────────────┐
│ │ HTML      │ │  │ @cavaridge/      │
│ │ Dashboard │ │  │ spr-core         │
│ └───────────┘ │  │ (risk engine)    │
└───────────────┘  └──────────────────┘
```

---

## 3. JSON SCHEMA (v1.0)

All four collectors produce identical JSON. The schema is defined as TypeScript types in `@cavaridge/spr-core` and documented in `skills/spr/references/processing-logic.md`.

Key top-level fields: `schemaVersion`, `tenant`, `collectedAt`, `collector`, `collectorVersion`, `parameters`, `summary`, `sites[]`, `errors[]`.

Each site contains: `url`, `title`, `owner`, `groups[]`, `uniquePermissions[]`, `sharingLinks[]`, `itemsScanned`, `itemsWithUniquePerms`, `errors[]`.

---

## 4. RISK FLAG TAXONOMY

| Code | Severity | Condition |
|------|----------|-----------|
| ANON_SHARING | **Critical** | ≥1 anonymous sharing link on site |
| EXT_SHARING_UNINTENDED | **High** | External sharing enabled + intake says unintended |
| EVERYONE_PERMS | **High** | "Everyone" or "Everyone except external" grants present |
| NO_OWNER | **High** | Site has no owner |
| EXCESSIVE_UNIQUE_PERMS | **Medium** | >50 items with unique (broken-inheritance) permissions |
| NON_EXPIRING_LINKS | **Medium** | ≥1 sharing link without expiration |
| ORG_WIDE_LINKS | **Medium** | ≥1 organization-scope sharing link |
| STALE_WITH_SHARING | **Medium** | Last modified >180d + active sharing links |
| EXT_MEMBERS | **Low** | External users in permission groups |
| STALE_SITE | **Low** | Last modified >180d, no sharing |

### Contextual Suppressions

Intake answers modulate severity. See `skills/spr/references/processing-logic.md` §2 for the full suppression table.

---

## 5. COLLECTOR PLATFORM MATRIX

| Method | Windows | macOS | Linux | Mobile | Headless/CI | Auth |
|--------|---------|-------|-------|--------|-------------|------|
| Browser (`sp-audit-browser.html`) | ✅ | ✅ | ✅ | ✅ | ❌ | Interactive (MSAL.js popup) |
| Python (`invoke_sp_audit.py`) | ✅ | ✅ | ✅ | ❌ | ✅ | Interactive, Device Code, App-Only |
| PnP.PowerShell | ✅ | ✅ | ✅ | ❌ | ⚠️ | Interactive, Credential |
| Graph PowerShell SDK | ✅ | ✅ | ✅ | ❌ | ✅ | Interactive, App-Only (secret/cert) |

---

## 6. MONOREPO INTEGRATION

### 6.1 New Package

```
packages/spr-core/          ← @cavaridge/spr-core
├── package.json
├── tsconfig.json
└── src/
    └── index.ts            ← Types, risk engine, user access map builder
```

### 6.2 AEGIS Module

```
apps/aegis/src/modules/spr/
├── index.ts                ← Re-export
└── routes.ts               ← Express routes for /api/aegis/spr/*
```

Mount in AEGIS app entry: `app.use('/api/aegis/spr', sprRouter)`

### 6.3 Claude Skill

```
skills/spr/
├── SKILL.md
└── references/
    ├── processing-logic.md
    └── collection-instructions.md
```

### 6.4 Standalone Service

Separate Railway service: `cavaridge-spr`  
Repo: `cavaridge-spr-collector` (or subdirectory of monorepo with Railway watch path)  
No environment variables required beyond `PORT` (Railway-injected).

---

## 7. REPORT OUTPUTS

### 7.1 XLSX Workbook (7 tabs)

1. Executive Summary — metrics, findings, recommendations
2. All Sites — full site inventory with risk flags
3. Permission Groups — group memberships across all sites
4. Unique Permissions — broken-inheritance items with principals
5. Sharing Links — all active sharing links with severity
6. External Access — external user/sharing summary per site
7. Who Has Access — user-centric cross-reference (broadest access first)

### 7.2 Interactive HTML Dashboard (6 tabs)

1. Overview — summary cards + findings table
2. Sites — searchable site list with risk badges
3. Unique Permissions — filterable permission table
4. Sharing Links — severity-filtered link table
5. Who Has Access — user search with full access details
6. Recommendations — prioritized action items

---

## 8. TONE RULES

Identical to IAR: never frame findings as MSP negligence. Everything is proactive review, establishing a baseline, security hygiene. See `skills/spr/references/processing-logic.md` §3.

---

## 9. CROSS-APP INTEGRATION

| Source | Target | Data |
|--------|--------|------|
| SPR | CVG-AEGIS Dashboard | Risk scores, finding counts |
| SPR | IAR | Cross-reference: external SP users vs. Entra guest accounts |
| SPR | CVG-ASTRA | License data for users with SP-only access |
| SPR | CVG-MIDAS | SharePoint posture score feeds QBR Cavaridge Adjusted Score |
| SPR Collector Service | Ducky Intelligence | Phase 3: scheduled scans + diff alerting |

---

## 10. BUILD ORDER FOR CLAUDE CODE

```
Step 1:  Create packages/spr-core/ with types + risk engine
Step 2:  Add @cavaridge/spr-core to AEGIS app dependencies
Step 3:  Create apps/aegis/src/modules/spr/ (routes + index)
Step 4:  Mount sprRouter in AEGIS Express app
Step 5:  Add SPR_COLLECTOR_URL to Doppler (staging + prod)
Step 6:  Deploy standalone collector to Railway
Step 7:  Add skills/spr/ to monorepo
Step 8:  Update CLAUDE.md to register SPR module
Step 9:  Run pnpm typecheck — zero errors expected
```

---

*CVG-AEGIS-SPR-SPEC-v1.0 — Cavaridge, LLC*  
*Store at: `docs/architecture/CVG-AEGIS-SPR-SPEC-v1.0-20260327.md`*
