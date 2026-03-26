# CVG-CONTROLPLANE-SPEC-v1.0

## Cavaridge Control Plane — Platform Evolution Build Specification

**Version:** 1.0  
**Date:** 2026-03-25  
**Status:** LOCKED — Ready for Claude Code CLI execution  
**Author:** Architecture (Claude) → Builder (Claude Code CLI)  
**Affects:** CLAUDE.md, monorepo, Supabase, CVG-AEGIS, new CVG-TECH app

-----

## 0. DOCUMENT PURPOSE

This spec translates the Cavaridge Control Plane architecture review into concrete, executable changes across the monorepo. Claude Code CLI should treat this as the authoritative build order and not deviate from decisions locked below.

**What this spec does NOT do:** Replace existing app specs. This document adds to and extends them.

-----

## 1. DECISIONS LOCKED

These decisions were reached in architecture review and are final:

|# |Decision                                                                                  |Rationale                                                         |
|--|------------------------------------------------------------------------------------------|------------------------------------------------------------------|
|D1|Cavaridge is ONE platform. Apps are domain engines. The shell is unified.                 |Prevents app-switching fragmentation for end users                |
|D2|AEGIS absorbs operational endpoint health (device inventory, patch status, alerts)        |Patch posture IS a security finding; keeps scoring coherent       |
|D3|Cavaridge does NOT build a competing RMM                                                  |Cavaridge is the control plane above RMMs, not a replacement      |
|D4|Action1, Level.io, ScreenConnect, Addigy, Tailscale are connector targets, not competitors|They are data sources surfaced through the connector marketplace  |
|D5|CVG-TECH is added as app #15 — Mobile Technician Shell                                    |iPad/iPhone-first; Expo-based; extends Ducky’s mobile foundation  |
|D6|Connector count expands from 25 → 30 with 5 new RMM/access connectors                     |Formally registers the new connectors in the framework            |
|D7|Platform narrative is locked in CLAUDE.md v3.0                                            |Ensures all future Claude sessions build toward the unified vision|

-----

## 2. CLAUDE.md UPDATE DIRECTIVES (v2.9 → v3.0)

Claude Code CLI must apply the following changes to `CLAUDE.md`. Do not rewrite CLAUDE.md from scratch — apply targeted edits only.

### 2.1 Platform Narrative Block

Insert the following section immediately after the app registry section and before the build order section:

```markdown
## PLATFORM ARCHITECTURE NARRATIVE (LOCKED)

Cavaridge is ONE unified MSP operating system. There are no separate products —
only domain engines underneath a shared shell.

**Mental model:**
- The SHELL is what users navigate. Context changes. The product does not.
- DOMAIN ENGINES own their data, connectors, scoring, and AI logic.
- DUCKY INTELLIGENCE is the reasoning layer embedded in every engine.
- The CONNECTOR FRAMEWORK is the data intake for all external tools.

**The Control Plane value proposition:**
> MSPs today run 5–7 point tools with no connective tissue.
> Cavaridge is the connective tissue — the control plane that normalizes their data,
> scores it against standards, surfaces it through AI, and automates the response.

Cavaridge does NOT compete with RMMs (NinjaRMM, Action1, Level.io).
Cavaridge does NOT compete with remote access tools (ScreenConnect, Tailscale).
Cavaridge SITS ABOVE them — ingesting their data, adding intelligence, and 
surfacing unified recommendations through the Ducky Intelligence layer.

**Navigation principle:** A technician or vCIO navigating Cavaridge should feel
CONTEXT-SWITCHING within a single environment, not app-switching between products.
```

### 2.2 App Registry Update

Replace the 14-app registry entry with the following (add CVG-TECH as #15):

```
App registry (15 apps): CVG-CORE, CVG-HIPAA, CVG-MER (Meridian), CVG-ASTRA,
CVG-CAELUM, CVG-MIDAS, CVG-VESPAR, CVG-CERES, CVG-AI (Spaniel),
CVG-RESEARCH (Ducky), CVG-BRAIN, CVG-AEGIS, CVG-FORGE, CVG-CAVALIER, CVG-TECH.
```

### 2.3 CVG-TECH App Entry

Add after CVG-CAVALIER in the app descriptions block:

```markdown
**CVG-TECH (Mobile Technician Shell):** iPad/iPhone-first technician experience.
Expo-based, extends Ducky's mobile foundation. Purpose: field technicians need a
purpose-built mobile interface — not a responsive clone of the desktop platform.
Features: device health at a glance, patch compliance alerts, remote session launch
(ScreenConnect deeplink), client environment quick-access, Ducky AI assist for
troubleshooting. Auth: @cavaridge/auth, MSP Tech role minimum. UTM: MSP tier +
Client tier visibility. Deploys via EAS (iOS/Android) + web via Railway.
```

### 2.4 CVG-AEGIS Update

Replace the existing AEGIS description with:

```markdown
**CVG-AEGIS (Security Posture & Risk Intelligence + Endpoint Health):**
Competes with ThreatMate and SecurityScorecard. Covers: security posture scoring,
risk intelligence, browser protection (Atakama competitor), ConnectSecure
integration, AEGIS Probe (Raspberry Pi appliance), two-tier pen testing
(Nuclei Tier 1 + Horizon3.ai NodeZero Tier 2), Identity Access Review (IAR) module
(freemium + full-tier), Cavaridge Adjusted Score (0–100 composite metric),
Contextual Intelligence Engine (L1: compensating controls, L2: business context,
L3: report tone). 

AEGIS also owns ENDPOINT HEALTH — the operational RMM layer:
device inventory, patch compliance, health monitoring, and alerting normalized from
RMM connector feeds (Action1, Level.io). Patch posture is a security finding.
These are not separate concerns.
```

### 2.5 Connector Count Update

Update connector framework reference from 25 to 30:

```
Connector framework expanded to 30 connectors with a tenant request/vote marketplace.
```

### 2.6 Build Order Update

Update build order to include CVG-TECH:

```
Build order locked: Spaniel → Ducky → Caelum → Meridian → HIPAA → AEGIS → 
Midas → TECH → rest.
```

CVG-TECH slots 8th — after AEGIS is stable enough to feed endpoint data into the
mobile view, but before the remaining apps.

-----

## 3. NEW CONNECTOR SPECIFICATIONS

Five new connectors are added to `packages/connectors/`. Each follows the existing
connector pattern established in the framework.

### 3.1 Connector Interface Contract

All connectors must implement `IConnector` from `packages/connectors/src/types.ts`.
If this interface does not exist, create it:

```typescript
// packages/connectors/src/types.ts
export interface IConnector {
  id: string;
  name: string;
  category: ConnectorCategory;
  tenantId: string;
  
  connect(credentials: ConnectorCredentials): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<ConnectorHealth>;
  sync(): Promise<SyncResult>;
}

export type ConnectorCategory =
  | 'rmm'
  | 'remote-access'
  | 'mdm'
  | 'network'
  | 'security'
  | 'identity'
  | 'psa'
  | 'email'
  | 'productivity';

export interface ConnectorCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
  tenantId?: string;
  [key: string]: string | undefined;
}

export interface ConnectorHealth {
  status: 'healthy' | 'degraded' | 'offline';
  lastChecked: Date;
  message?: string;
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  errors: string[];
  syncedAt: Date;
}
```

### 3.2 Connector: Action1 (RMM)

**File:** `packages/connectors/src/connectors/action1.ts`  
**Category:** `rmm`  
**Auth:** API Key (stored in Doppler: `ACTION1_API_KEY_{TENANT_ID}`)  
**Base URL:** `https://app.action1.com/api/3.0`

**Data pulled on sync:**

- Endpoint inventory (device list, OS, hardware)
- Patch status per endpoint (installed, missing, failed)
- Software inventory
- Script execution results

**Normalized output types:**

```typescript
export interface Action1Device {
  externalId: string;       // Action1's device ID
  hostname: string;
  platform: 'windows' | 'mac' | 'linux';
  osVersion: string;
  lastSeen: Date;
  patchStatus: 'compliant' | 'non-compliant' | 'unknown';
  missingPatchCount: number;
  installedSoftware?: string[];
}
```

**Sync frequency:** Every 4 hours (BullMQ scheduled job)  
**Queue name:** `connector:action1:sync`

### 3.3 Connector: Level.io (Cross-Platform RMM)

**File:** `packages/connectors/src/connectors/level.ts`  
**Category:** `rmm`  
**Auth:** API Key + Organization ID (Doppler: `LEVEL_API_KEY_{TENANT_ID}`, `LEVEL_ORG_ID_{TENANT_ID}`)  
**Base URL:** `https://app.level.io/api/v1`

**Data pulled on sync:** Same normalized shape as Action1 — use the same
`EndpointDevice` normalized type in Supabase. Connectors map to a common schema.

**Mac support note:** Level.io has first-class macOS support. Flag `platform: 'mac'`
devices and ensure patch compliance data includes macOS update status.

**Sync frequency:** Every 4 hours  
**Queue name:** `connector:level:sync`

### 3.4 Connector: ScreenConnect (Remote Access)

**File:** `packages/connectors/src/connectors/screenconnect.ts`  
**Category:** `remote-access`  
**Auth:** Username + Password or API token (Doppler: `SCREENCONNECT_TOKEN_{TENANT_ID}`)  
**Base URL:** Tenant-specific (stored per connector config: `baseUrl`)

**This connector is READ-ONLY for data sync. Launch is via deeplink.**

**Data pulled on sync:**

- Session list (active + recent)
- Connected machine list
- Session duration history (for reporting)

**Deeplink pattern for CVG-TECH:**

```
screenconnect://instance/ConnectToSession?SessionID={sessionId}
// Falls back to: https://{instance}/Host#session={sessionId}
```

**Sync frequency:** On-demand + every 30 minutes for session list  
**Queue name:** `connector:screenconnect:sync`

### 3.5 Connector: Addigy (Apple Device Management)

**File:** `packages/connectors/src/connectors/addigy.ts`  
**Category:** `mdm`  
**Auth:** Client ID + Client Secret (Doppler: `ADDIGY_CLIENT_ID_{TENANT_ID}`, `ADDIGY_CLIENT_SECRET_{TENANT_ID}`)  
**Base URL:** `https://prod.addigy.com/api`

**Conditional activation:** Only enable when Mac endpoints exceed 20 in tenant environment.
Store this threshold in `connector_configs.activation_threshold` (see schema section).

**Data pulled on sync:**

- macOS device inventory
- MDM compliance status
- Policy enforcement status
- Installed profiles

**Normalized output:** Same `EndpointDevice` shape, `platform: 'mac'`, enriched with
`mdmEnrolled: boolean` and `complianceStatus`.

**Sync frequency:** Every 6 hours  
**Queue name:** `connector:addigy:sync`

### 3.6 Connector: Tailscale (Zero-Trust Network Access)

**File:** `packages/connectors/src/connectors/tailscale.ts`  
**Category:** `network`  
**Auth:** API Key (Doppler: `TAILSCALE_API_KEY_{TENANT_ID}`)  
**Base URL:** `https://api.tailscale.com/api/v2`

**Data pulled on sync:**

- Device list (enrolled in Tailscale network)
- Last-seen timestamps
- Key expiry status
- Tagged ACL groups

**Primary use for CVG-TECH:** Surface whether a device is reachable via Tailscale
before a technician attempts remote access. Show `tailscale: connected | expired | offline`
status badge on device cards.

**Sync frequency:** Every 15 minutes (lightweight — just device status)  
**Queue name:** `connector:tailscale:sync`

-----

## 4. CVG-AEGIS: ENDPOINT HEALTH MODULE

### 4.1 Scope

AEGIS gets a new **Endpoint Health** tab alongside the existing Security Posture tab.
This is NOT a separate app. It is a module within AEGIS, sharing AEGIS auth and UTM context.

**UI structure addition:**

```
AEGIS Navigation:
├── Overview (existing)
├── Security Posture (existing)
├── Identity Access Review (existing — IAR module)
├── Endpoint Health  ← NEW
│   ├── Device Inventory
│   ├── Patch Compliance
│   └── Health Alerts
├── Browser Security (existing)
└── Reports (existing)
```

### 4.2 Endpoint Health Tab: Device Inventory View

**Route:** `/aegis/endpoint-health/devices`

**Features:**

- Filterable device table: hostname, OS, platform, last seen, patch status, Tailscale status
- Platform icons: Windows logo / Apple logo — no “second class” treatment
- RMM source badge: which connector the device came from (Action1 / Level / Addigy)
- Click-through to device detail: full patch list, software inventory, session history
- Export to CSV

**Platform filter:** `All | Windows | Mac | Linux`

### 4.3 Endpoint Health Tab: Patch Compliance View

**Route:** `/aegis/endpoint-health/patch-compliance`

**Features:**

- Compliance percentage ring chart per client (if MSP Admin view)
- Per-device missing patch list with severity classification (Critical / Important / Optional)
- Patch age column: how many days since patch was available
- “Overdue” flag: Critical patches > 7 days uninstalled, Important > 30 days
- Compliance trend sparkline (30-day window)

**Scoring integration:** Missing critical patches MUST feed into the Cavaridge Adjusted Score.
Add a new scoring dimension: `patch_compliance_score` (0–100). Weight in overall score: 20%.

### 4.4 Endpoint Health Tab: Health Alerts View

**Route:** `/aegis/endpoint-health/alerts`

**Features:**

- Alert feed from all RMM connectors, normalized to common severity schema
- Alert status: `open | acknowledged | resolved`
- Filter by severity, client, platform
- Bulk acknowledge / resolve actions (MSP Admin + MSP Tech roles)

### 4.5 Cavaridge Adjusted Score Update

The scoring engine in AEGIS must be updated to include patch compliance.

**Current scoring dimensions (assumed):**

- Identity posture
- Browser security
- Network security
- Endpoint protection (existing)

**New dimension added:**

```typescript
interface AdjustedScoreComponents {
  identityPosture: number;       // existing
  browserSecurity: number;       // existing
  networkSecurity: number;       // existing  
  endpointProtection: number;    // existing
  patchCompliance: number;       // NEW — fed from RMM connectors
}

// Weights must sum to 1.0
const SCORE_WEIGHTS = {
  identityPosture: 0.25,
  browserSecurity: 0.15,
  networkSecurity: 0.15,
  endpointProtection: 0.25,
  patchCompliance: 0.20,        // NEW
};
```

**Freemium rule:** Patch compliance score visible in freemium tier (it’s a teaser).
Full remediation guidance and trend data require full tier.

-----

## 5. CVG-TECH: MOBILE TECHNICIAN SHELL (APP #15)

### 5.1 App Overview

|Property |Value                                     |
|---------|------------------------------------------|
|Code     |CVG-TECH                                  |
|Name     |Cavaridge Tech                            |
|Type     |Expo mobile app (iOS + Android + web)     |
|Purpose  |Field technician experience on iPad/iPhone|
|Min Role |MSP Tech                                  |
|UTM Scope|MSP tier + Client tier                    |
|Auth     |@cavaridge/auth                           |
|Theme    |Light/dark/system required                |
|Ducky    |Embedded (troubleshooting assist)         |

### 5.2 Monorepo Location

```
apps/tech/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Dashboard — client overview
│   │   ├── devices.tsx        # Endpoint device list
│   │   ├── alerts.tsx         # Active alerts feed
│   │   └── sessions.tsx       # Remote session launcher
│   ├── client/[id].tsx        # Client detail view
│   ├── device/[id].tsx        # Device detail + remote launch
│   └── _layout.tsx
├── components/
│   ├── DeviceCard.tsx
│   ├── AlertBadge.tsx
│   ├── RemoteLaunchButton.tsx
│   └── DuckyAssist.tsx
├── hooks/
│   ├── useDevices.ts
│   ├── useAlerts.ts
│   └── useRemoteSession.ts
├── app.json
├── package.json
└── tsconfig.json
```

### 5.3 Screen Specifications

#### Dashboard (index.tsx)

- Client list with health summary chips: `● OK`, `⚠ Alerts`, `✗ Critical`
- Total device count + online count
- Unresolved alert count badge
- Quick filters: `All Clients | Alerts Only | Critical Only`

#### Device List (devices.tsx)

- All devices across visible clients (respects UTM scope)
- Search by hostname
- Filter: `All | Windows | Mac | Offline | Non-Compliant`
- Each card shows: hostname, OS icon, patch status badge, Tailscale indicator, last seen

#### Alerts Feed (alerts.tsx)

- Unified alert feed from all RMM connectors
- Pull-to-refresh
- Swipe-right to acknowledge, swipe-left to snooze (1h, 4h, 24h)
- Severity color coding: red / orange / yellow

#### Remote Session Launcher (sessions.tsx)

- Lists devices with ScreenConnect availability
- One-tap session launch via ScreenConnect deeplink
- Fallback: copy session URL to clipboard if app not installed
- Shows Tailscale status before launch attempt
- Recent sessions list (last 10)

#### Device Detail (device/[id].tsx)

- Full device info: OS, hardware, last seen, RMM source
- Patch compliance summary + list
- Active alerts for this device
- Remote launch button (prominent, primary CTA)
- **Ducky Assist button:** opens Ducky AI with device context pre-loaded
  - Pre-prompt: `"I'm looking at [hostname] running [OS version]. It has [X] missing patches and [Y] active alerts. Help me troubleshoot."`

### 5.4 Ducky Integration in CVG-TECH

CVG-TECH is a Ducky consumer (same model as all other apps). The DuckyAssist component:

```typescript
// components/DuckyAssist.tsx
interface DuckyAssistProps {
  deviceContext?: {
    hostname: string;
    os: string;
    missingPatches: number;
    activeAlerts: Alert[];
  };
  clientContext?: {
    clientName: string;
    environment: string;
  };
}
```

The context is injected as a system message prefix into the Ducky API call via Spaniel.
Technicians get AI-guided troubleshooting without leaving the mobile app.

### 5.5 Railway Deployment

CVG-TECH web build deploys as a static site on Railway (same pattern as other Expo web builds).
iOS and Android: EAS build pipeline. Document EAS configuration in `apps/tech/eas.json`.

```json
// apps/tech/eas.json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

-----

## 6. SUPABASE SCHEMA — MIGRATION 015

**Migration file:** `supabase/migrations/015_endpoint_health.sql`

```sql
-- ============================================================
-- MIGRATION 015: Endpoint Health
-- Part of CVG-CONTROLPLANE-SPEC-v1.0
-- ============================================================

-- Connector configuration per tenant
CREATE TABLE IF NOT EXISTS connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,           -- 'action1' | 'level' | 'screenconnect' | 'addigy' | 'tailscale'
  category TEXT NOT NULL,               -- 'rmm' | 'remote-access' | 'mdm' | 'network'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  activation_threshold INTEGER,         -- e.g. 20 for Addigy (Mac count threshold)
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,                -- 'success' | 'error' | 'partial'
  last_sync_error TEXT,
  config_metadata JSONB NOT NULL DEFAULT '{}',  -- non-secret config (base URLs, org IDs)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, connector_id)
);

-- Normalized endpoint device inventory
CREATE TABLE IF NOT EXISTS endpoint_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,           -- source connector
  external_id TEXT NOT NULL,            -- connector's native device ID
  hostname TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'mac', 'linux', 'ios', 'android', 'unknown')),
  os_version TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN NOT NULL DEFAULT false,
  patch_status TEXT CHECK (patch_status IN ('compliant', 'non-compliant', 'unknown')),
  missing_patch_count INTEGER NOT NULL DEFAULT 0,
  mdm_enrolled BOOLEAN,
  tailscale_status TEXT CHECK (tailscale_status IN ('connected', 'expired', 'offline', 'not-enrolled')),
  raw_data JSONB NOT NULL DEFAULT '{}', -- full connector payload for debugging
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, connector_id, external_id)
);

-- Patch compliance per device
CREATE TABLE IF NOT EXISTS endpoint_patch_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES endpoint_devices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patch_id TEXT NOT NULL,               -- connector's patch identifier
  patch_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'important', 'optional', 'unknown')),
  status TEXT NOT NULL CHECK (status IN ('installed', 'missing', 'failed', 'excluded')),
  available_since TIMESTAMPTZ,          -- when patch became available
  installed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, patch_id)
);

-- Endpoint health alerts (normalized from RMM connectors)
CREATE TABLE IF NOT EXISTS endpoint_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES endpoint_devices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,
  external_alert_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'snoozed')),
  snoozed_until TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  alert_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Point-in-time health snapshots for trend data
CREATE TABLE IF NOT EXISTS endpoint_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_devices INTEGER NOT NULL DEFAULT 0,
  compliant_devices INTEGER NOT NULL DEFAULT 0,
  non_compliant_devices INTEGER NOT NULL DEFAULT 0,
  online_devices INTEGER NOT NULL DEFAULT 0,
  total_missing_patches INTEGER NOT NULL DEFAULT 0,
  critical_missing_patches INTEGER NOT NULL DEFAULT 0,
  open_alerts INTEGER NOT NULL DEFAULT 0,
  critical_alerts INTEGER NOT NULL DEFAULT 0,
  patch_compliance_score NUMERIC(5,2),  -- 0.00–100.00
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_endpoint_devices_tenant ON endpoint_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_devices_platform ON endpoint_devices(tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_endpoint_devices_patch_status ON endpoint_devices(tenant_id, patch_status);
CREATE INDEX IF NOT EXISTS idx_endpoint_patch_status_device ON endpoint_patch_status(device_id);
CREATE INDEX IF NOT EXISTS idx_endpoint_patch_status_severity ON endpoint_patch_status(tenant_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_endpoint_alerts_tenant ON endpoint_alerts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_endpoint_alerts_device ON endpoint_alerts(device_id, status);
CREATE INDEX IF NOT EXISTS idx_endpoint_health_snapshots_tenant ON endpoint_health_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_connector_configs_tenant ON connector_configs(tenant_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_patch_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE endpoint_health_snapshots ENABLE ROW LEVEL SECURITY;

-- connector_configs: MSP Admin can manage their tenant's connectors
CREATE POLICY "connector_configs_tenant_isolation" ON connector_configs
  USING (tenant_id IN (
    SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()
  ));

-- endpoint_devices: visible to MSP members and client members within scope
CREATE POLICY "endpoint_devices_tenant_isolation" ON endpoint_devices
  USING (tenant_id IN (
    SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()
  ));

-- endpoint_patch_status: same scope as devices
CREATE POLICY "endpoint_patch_status_device_scope" ON endpoint_patch_status
  USING (tenant_id IN (
    SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()
  ));

-- endpoint_alerts: MSP Tech and above
CREATE POLICY "endpoint_alerts_tenant_isolation" ON endpoint_alerts
  USING (tenant_id IN (
    SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()
  ));

-- endpoint_health_snapshots: read for MSP members, write for service role only
CREATE POLICY "endpoint_health_snapshots_read" ON endpoint_health_snapshots
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()
  ));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER set_updated_at_connector_configs
  BEFORE UPDATE ON connector_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_endpoint_devices
  BEFORE UPDATE ON endpoint_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_endpoint_patch_status
  BEFORE UPDATE ON endpoint_patch_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_endpoint_alerts
  BEFORE UPDATE ON endpoint_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

-----

## 7. MONOREPO CHANGES

### 7.1 New App

```bash
# Scaffold new Expo app
cd apps
npx create-expo-app tech --template expo-template-blank-typescript
cd tech
# Wire to @cavaridge/auth, @cavaridge/ui, @cavaridge/tenant-intel
```

Add to `pnpm-workspace.yaml` if not auto-detected:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Add to root `turbo.json` pipeline:

```json
{
  "pipeline": {
    "tech#build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

### 7.2 New Package: @cavaridge/connectors-rmm

```bash
mkdir -p packages/connectors-rmm/src/connectors
```

**`packages/connectors-rmm/package.json`:**

```json
{
  "name": "@cavaridge/connectors-rmm",
  "version": "0.1.0",
  "description": "RMM and endpoint access connector implementations",
  "main": "src/index.ts",
  "dependencies": {
    "axios": "^1.6.0",
    "bullmq": "^5.0.0"
  }
}
```

**`packages/connectors-rmm/src/index.ts`:**

```typescript
export { Action1Connector } from './connectors/action1';
export { LevelConnector } from './connectors/level';
export { ScreenConnectConnector } from './connectors/screenconnect';
export { AddigyConnector } from './connectors/addigy';
export { TailscaleConnector } from './connectors/tailscale';
export type { IConnector, ConnectorCategory, ConnectorCredentials, ConnectorHealth, SyncResult } from './types';
export { normalizeDevice } from './normalizers/device';
export { normalizePatch } from './normalizers/patch';
export { normalizeAlert } from './normalizers/alert';
```

### 7.3 Normalizer Utilities

Create `packages/connectors-rmm/src/normalizers/device.ts`:

```typescript
import type { EndpointDevice } from '../types';

// Each connector maps its native response to this common shape
// before writing to endpoint_devices table
export function normalizeDevice(
  connectorId: string,
  tenantId: string,
  raw: Record<string, unknown>
): Omit<EndpointDevice, 'id' | 'created_at' | 'updated_at'> {
  // Base implementation — each connector overrides as needed
  return {
    tenant_id: tenantId,
    connector_id: connectorId,
    external_id: String(raw.id ?? raw.deviceId ?? raw.machine_id),
    hostname: String(raw.name ?? raw.hostname ?? raw.computer_name ?? 'unknown'),
    platform: detectPlatform(raw),
    os_version: String(raw.os ?? raw.osVersion ?? raw.operating_system ?? ''),
    last_seen_at: parseDate(raw.lastSeen ?? raw.last_seen ?? raw.lastContact),
    is_online: Boolean(raw.online ?? raw.isOnline ?? raw.status === 'online'),
    patch_status: 'unknown',
    missing_patch_count: 0,
    raw_data: raw,
  };
}

function detectPlatform(raw: Record<string, unknown>): EndpointDevice['platform'] {
  const os = String(raw.os ?? raw.osVersion ?? raw.platform ?? '').toLowerCase();
  if (os.includes('windows') || os.includes('win')) return 'windows';
  if (os.includes('mac') || os.includes('darwin') || os.includes('osx')) return 'mac';
  if (os.includes('linux')) return 'linux';
  if (os.includes('ios') || os.includes('iphone') || os.includes('ipad')) return 'ios';
  if (os.includes('android')) return 'android';
  return 'unknown';
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}
```

### 7.4 BullMQ Sync Jobs

Add the following job definitions in the existing jobs/worker package:

```typescript
// packages/jobs/src/workers/connector-sync.worker.ts

import { Worker, Queue } from 'bullmq';
import { Action1Connector, LevelConnector, AddigyConnector, TailscaleConnector } from '@cavaridge/connectors-rmm';
import { getConnectorCredentials } from '@cavaridge/security'; // from Doppler

const QUEUES = [
  'connector:action1:sync',
  'connector:level:sync',
  'connector:addigy:sync',
  'connector:tailscale:sync',
  'connector:screenconnect:sync',
];

// Register workers for each connector queue
// Each job payload: { tenantId: string, connectorId: string }
```

-----

## 8. AEGIS APP CODE CHANGES

### 8.1 Routes to Add

```
apps/aegis/app/
├── endpoint-health/
│   ├── _layout.tsx          # Tab layout for Endpoint Health section
│   ├── index.tsx            # Redirect to /devices
│   ├── devices.tsx          # Device Inventory view
│   ├── patch-compliance.tsx # Patch Compliance view
│   └── alerts.tsx           # Health Alerts view
└── device/
    └── [id].tsx             # Device detail page (shared with CVG-TECH via API)
```

### 8.2 Scoring Engine Update

Locate the Cavaridge Adjusted Score calculation (likely in `packages/scoring/` or within
`apps/aegis/lib/scoring.ts`). Add `patchCompliance` dimension:

```typescript
// Add to scoring dimensions
async function calculatePatchComplianceScore(tenantId: string): Promise<number> {
  const { data } = await supabase
    .from('endpoint_health_snapshots')
    .select('patch_compliance_score')
    .eq('tenant_id', tenantId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();
  
  return data?.patch_compliance_score ?? 0;
}
```

### 8.3 Navigation Update

Update AEGIS sidebar/nav component to include Endpoint Health section with the
four child routes listed in section 4.1 above.

-----

## 9. RAILWAY DEPLOYMENT NOTES

No new Railway services required. Changes fit within existing service topology:

|Service            |Change                                                    |
|-------------------|----------------------------------------------------------|
|`cavaridge-aegis`  |Add new route handlers for `/endpoint-health/*`           |
|`cavaridge-workers`|Add 5 new BullMQ queues for connector sync jobs           |
|`cavaridge-tech`   |**NEW** — Deploy CVG-TECH web build as new Railway service|

**CVG-TECH Railway service config:**

```toml
# railway.toml in apps/tech/
[build]
builder = "nixpacks"
buildCommand = "npx expo export --platform web"

[deploy]
startCommand = "npx serve dist"
healthcheckPath = "/"
```

**Environment variables for new service (set in Railway, sourced from Doppler):**

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_SPANIEL_URL
```

-----

## 10. BUILD SEQUENCE FOR CLAUDE CODE

Execute in this order. Do not skip steps.

```
Step 1:  Apply CLAUDE.md changes (section 2)
Step 2:  Create migration 015_endpoint_health.sql (section 6) and run against Supabase
Step 3:  Scaffold packages/connectors-rmm with types, normalizers, index (section 7.2–7.3)
Step 4:  Implement Action1 connector (section 3.2)
Step 5:  Implement Level connector (section 3.3)
Step 6:  Implement Tailscale connector (section 3.6) — lightweight, validates pattern
Step 7:  Implement ScreenConnect connector (section 3.4)
Step 8:  Implement Addigy connector (section 3.5)
Step 9:  Add BullMQ sync workers (section 7.4)
Step 10: Add AEGIS Endpoint Health routes and components (section 8.1)
Step 11: Update AEGIS scoring engine (section 8.2)
Step 12: Update AEGIS navigation (section 8.3)
Step 13: Scaffold CVG-TECH app (section 5.2)
Step 14: Implement CVG-TECH screens (section 5.3)
Step 15: Wire CVG-TECH Ducky integration (section 5.4)
Step 16: Configure Railway for CVG-TECH (section 9)
Step 17: Update CLAUDE.md version to v3.0, increment line count estimate
```

-----

## 11. RUNBOOK REQUIREMENT

Following standard Cavaridge runbook policy:

Generate runbooks for all Major/Minor version increments triggered by this spec:

- `CVG-AEGIS-RB-v[current+minor].[YYYYMMDD].md` — covers new Endpoint Health module
- `CVG-TECH-RB-v1.0.0-20260325.md` — initial runbook for new app

Runbook format: `[AppCode]-RB-v[Major].[Minor].[Patch]-[YYYYMMDD]`

-----

## 12. SUCCESS CRITERIA

This spec is complete when:

- [ ] CLAUDE.md is at v3.0 with Control Plane narrative and 15-app registry
- [ ] Migration 015 is applied and all 5 new tables exist with RLS enabled
- [ ] All 5 connector implementations exist in `packages/connectors-rmm/`
- [ ] BullMQ queues registered for all 5 connector sync jobs
- [ ] AEGIS Endpoint Health tab is navigable with 3 child views
- [ ] Cavaridge Adjusted Score includes `patchCompliance` at 20% weight
- [ ] CVG-TECH app exists in `apps/tech/` with all 4 tab screens
- [ ] CVG-TECH DuckyAssist component wired with device context injection
- [ ] Railway service configured for CVG-TECH web deployment
- [ ] Zero TypeScript errors across all 15 apps (`pnpm typecheck` passes)
- [ ] All new tables visible in Supabase dashboard with correct RLS policies

-----

*CVG-CONTROLPLANE-SPEC-v1.0 — Architecture by Claude — Build by Claude Code CLI*  
*Store at: `docs/architecture/CVG-CONTROLPLANE-SPEC-v1.0-20260325.md`*