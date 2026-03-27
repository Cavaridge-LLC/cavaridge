/**
 * CVG-AEGIS — Tenant Intelligence Sync Service
 *
 * Bridges @cavaridge/tenant-intel data into the AEGIS Cavaridge Adjusted Score
 * pipeline. Fetches M365 Secure Score, Google Workspace Security Health,
 * and security tool presence (SentinelOne, Duo, Proofpoint) from tenant-intel
 * snapshots and managed device inventories.
 *
 * This module replaces the "not_configured" placeholders in the score route
 * for Signals 1 (Microsoft Secure Score), 3 (Google Workspace), and 7
 * (Compensating Controls auto-detection).
 */

import type {
  SecurityPosture,
  TenantSnapshot,
  ManagedDevice,
  TenantUser,
  ConditionalAccessPolicy,
} from "@cavaridge/tenant-intel";
import { getDb } from "../db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structured data ready for Adjusted Score calculation */
export interface TenantIntelScoreInputs {
  tenantId: string;
  syncedAt: Date;

  /** M365 Secure Score (0-100 normalized) */
  microsoftSecureScore: {
    available: boolean;
    rawScore: number | null;
    maxScore: number | null;
    normalizedScore: number | null;
    controlCount: number;
    capturedAt: Date | null;
  };

  /** Google Workspace Security Health (0-100 normalized) */
  googleWorkspaceHealth: {
    available: boolean;
    normalizedScore: number | null;
    capturedAt: Date | null;
  };

  /** Credential hygiene signals derived from tenant-intel user data */
  credentialHygiene: {
    available: boolean;
    mfaAdoptionPct: number | null;
    passwordNeverExpiresPct: number | null;
    staleAccountPct: number | null;
    normalizedScore: number | null;
  };

  /** Auto-detected security tools from managed devices / service principals */
  detectedTools: DetectedSecurityTool[];

  /** Summary of tenant health for diagnostic purposes */
  summary: {
    totalUsers: number;
    licensedUsers: number;
    managedDevices: number;
    conditionalAccessPolicies: number;
    lastSnapshotAt: Date | null;
  };
}

export interface DetectedSecurityTool {
  controlType: string;
  name: string;
  vendor: string;
  detectionMethod: "service_principal" | "intune_inventory" | "mx_record" | "conditional_access" | "saas_discovery";
  confidence: "high" | "medium" | "low";
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Known tool detection patterns
// ---------------------------------------------------------------------------

interface ToolDetectionPattern {
  controlType: string;
  name: string;
  vendor: string;
  /** Match against service principal display names (case-insensitive) */
  servicePrincipalPatterns: string[];
  /** Match against installed app names from managed devices */
  deviceAppPatterns: string[];
  /** Match against MX record hostnames */
  mxPatterns: string[];
  /** Match against conditional access grant control values */
  conditionalAccessPatterns: string[];
}

const TOOL_DETECTION_PATTERNS: ToolDetectionPattern[] = [
  {
    controlType: "sentinelone_edr",
    name: "SentinelOne EDR",
    vendor: "SentinelOne",
    servicePrincipalPatterns: ["sentinelone", "sentinel one", "s1"],
    deviceAppPatterns: ["sentinelagent", "sentinelone", "sentinel agent"],
    mxPatterns: [],
    conditionalAccessPatterns: [],
  },
  {
    controlType: "crowdstrike_edr",
    name: "CrowdStrike Falcon",
    vendor: "CrowdStrike",
    servicePrincipalPatterns: ["crowdstrike", "falcon"],
    deviceAppPatterns: ["csfalcon", "crowdstrike", "falcon sensor"],
    mxPatterns: [],
    conditionalAccessPatterns: [],
  },
  {
    controlType: "duo_mfa",
    name: "Duo Security MFA",
    vendor: "Cisco",
    servicePrincipalPatterns: ["duo security", "duo mobile", "duo mfa", "cisco duo"],
    deviceAppPatterns: ["duo mobile"],
    mxPatterns: [],
    conditionalAccessPatterns: ["duo"],
  },
  {
    controlType: "entra_id_mfa",
    name: "Entra ID MFA",
    vendor: "Microsoft",
    servicePrincipalPatterns: [],
    deviceAppPatterns: [],
    mxPatterns: [],
    conditionalAccessPatterns: ["mfa", "multifactor", "multi-factor"],
  },
  {
    controlType: "proofpoint_email",
    name: "Proofpoint Email Security",
    vendor: "Proofpoint",
    servicePrincipalPatterns: ["proofpoint"],
    deviceAppPatterns: [],
    mxPatterns: ["pphosted.com", "proofpoint"],
    conditionalAccessPatterns: [],
  },
  {
    controlType: "mimecast_email",
    name: "Mimecast Email Security",
    vendor: "Mimecast",
    servicePrincipalPatterns: ["mimecast"],
    deviceAppPatterns: [],
    mxPatterns: ["mimecast.com"],
    conditionalAccessPatterns: [],
  },
  {
    controlType: "conditional_access",
    name: "Conditional Access Policies",
    vendor: "Microsoft",
    servicePrincipalPatterns: [],
    deviceAppPatterns: [],
    mxPatterns: [],
    conditionalAccessPatterns: [], // Detected by policy count, not pattern match
  },
  {
    controlType: "datto_backup",
    name: "Datto BCDR",
    vendor: "Kaseya",
    servicePrincipalPatterns: ["datto", "kaseya"],
    deviceAppPatterns: ["datto", "shadowsnap"],
    mxPatterns: [],
    conditionalAccessPatterns: [],
  },
];

// ---------------------------------------------------------------------------
// Main Sync Function
// ---------------------------------------------------------------------------

/**
 * Fetch and normalize tenant intelligence data for Adjusted Score calculation.
 *
 * Queries the tenant-intel snapshot tables (stored in the shared Supabase
 * instance) to retrieve the latest M365 Secure Score, security controls,
 * managed device inventory, and user directory. Then runs tool detection
 * heuristics against service principals, device apps, MX records, and
 * conditional access policies.
 *
 * @param tenantId - The tenant (client) to sync data for
 * @returns Structured inputs ready for computeAdjustedScore()
 */
export async function syncTenantIntelForScore(
  tenantId: string,
): Promise<TenantIntelScoreInputs> {
  const db = getDb();
  const now = new Date();

  // ── Fetch latest snapshot metadata ────────────────────────────────
  const snapshotResult = await db.execute({
    sql: `
      SELECT id, tenant_id, source_vendor, captured_at, user_count,
             licensed_user_count, device_count, managed_device_count,
             conditional_access_policy_count, security_score, security_score_max
      FROM tenant_intel.snapshots
      WHERE tenant_id = $1
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    params: [tenantId],
  } as any);

  const snapshot = (snapshotResult as any)?.[0] ?? null;

  // ── Fetch M365 Secure Score ───────────────────────────────────────
  const securityResult = await db.execute({
    sql: `
      SELECT native_score, max_possible_score, score_pct, captured_at,
             source_vendor
      FROM tenant_intel.security_scores
      WHERE tenant_id = $1 AND source_vendor = 'microsoft'
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    params: [tenantId],
  } as any);

  const securityRow = (securityResult as any)?.[0] ?? null;

  const microsoftSecureScore = securityRow
    ? {
        available: true,
        rawScore: parseFloat(securityRow.native_score),
        maxScore: parseFloat(securityRow.max_possible_score),
        normalizedScore: parseFloat(securityRow.score_pct),
        controlCount: 0, // Populated below from controls query
        capturedAt: new Date(securityRow.captured_at),
      }
    : {
        available: false,
        rawScore: null,
        maxScore: null,
        normalizedScore: null,
        controlCount: 0,
        capturedAt: null,
      };

  // Fetch control count for diagnostics
  if (microsoftSecureScore.available) {
    const controlsResult = await db.execute({
      sql: `
        SELECT COUNT(*)::int as count
        FROM tenant_intel.security_controls
        WHERE tenant_id = $1
      `,
      params: [tenantId],
    } as any);

    microsoftSecureScore.controlCount = (controlsResult as any)?.[0]?.count ?? 0;
  }

  // ── Fetch Google Workspace Security Health ────────────────────────
  const googleResult = await db.execute({
    sql: `
      SELECT native_score, max_possible_score, score_pct, captured_at
      FROM tenant_intel.security_scores
      WHERE tenant_id = $1 AND source_vendor = 'google'
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    params: [tenantId],
  } as any);

  const googleRow = (googleResult as any)?.[0] ?? null;

  const googleWorkspaceHealth = googleRow
    ? {
        available: true,
        normalizedScore: parseFloat(googleRow.score_pct),
        capturedAt: new Date(googleRow.captured_at),
      }
    : {
        available: false,
        normalizedScore: null,
        capturedAt: null,
      };

  // ── Compute Credential Hygiene from user directory ────────────────
  const credentialResult = await db.execute({
    sql: `
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE mfa_enabled = true)::int as mfa_enabled,
        COUNT(*) FILTER (WHERE account_enabled = true)::int as active_accounts,
        COUNT(*) FILTER (
          WHERE last_sign_in < now() - interval '90 days' AND account_enabled = true
        )::int as stale_accounts
      FROM tenant_intel.user_directory
      WHERE tenant_id = $1
    `,
    params: [tenantId],
  } as any);

  const credRow = (credentialResult as any)?.[0];
  const totalUsers = credRow?.total_users ?? 0;

  let credentialHygiene: TenantIntelScoreInputs["credentialHygiene"];

  if (totalUsers > 0) {
    const mfaAdoptionPct = (credRow.mfa_enabled / totalUsers) * 100;
    // Password never expires requires a separate query or column
    const passwordResult = await db.execute({
      sql: `
        SELECT COUNT(*)::int as count
        FROM tenant_intel.user_directory
        WHERE tenant_id = $1 AND account_enabled = true
          AND (metadata->>'passwordNeverExpires')::boolean = true
      `,
      params: [tenantId],
    } as any);

    const activeAccounts = credRow.active_accounts || 1;
    const passwordNeverExpiresCount = (passwordResult as any)?.[0]?.count ?? 0;
    const passwordNeverExpiresPct = (passwordNeverExpiresCount / activeAccounts) * 100;
    const staleAccountPct = (credRow.stale_accounts / activeAccounts) * 100;

    // Credential hygiene score: weighted combination
    //  - MFA adoption (50% weight): 100% MFA = 50 points
    //  - Non-expiring passwords (20% weight): lower is better
    //  - Stale accounts (30% weight): lower is better
    const mfaComponent = (mfaAdoptionPct / 100) * 50;
    const passwordComponent = ((100 - passwordNeverExpiresPct) / 100) * 20;
    const staleComponent = ((100 - staleAccountPct) / 100) * 30;
    const normalizedScore = Math.max(0, Math.min(100, mfaComponent + passwordComponent + staleComponent));

    credentialHygiene = {
      available: true,
      mfaAdoptionPct: Math.round(mfaAdoptionPct * 10) / 10,
      passwordNeverExpiresPct: Math.round(passwordNeverExpiresPct * 10) / 10,
      staleAccountPct: Math.round(staleAccountPct * 10) / 10,
      normalizedScore: Math.round(normalizedScore * 10) / 10,
    };
  } else {
    credentialHygiene = {
      available: false,
      mfaAdoptionPct: null,
      passwordNeverExpiresPct: null,
      staleAccountPct: null,
      normalizedScore: null,
    };
  }

  // ── Detect security tools ─────────────────────────────────────────
  const detectedTools = await detectSecurityTools(db, tenantId);

  // ── Build summary ─────────────────────────────────────────────────
  const summary = {
    totalUsers: snapshot?.user_count ?? totalUsers,
    licensedUsers: snapshot?.licensed_user_count ?? 0,
    managedDevices: snapshot?.managed_device_count ?? 0,
    conditionalAccessPolicies: snapshot?.conditional_access_policy_count ?? 0,
    lastSnapshotAt: snapshot ? new Date(snapshot.captured_at) : null,
  };

  return {
    tenantId,
    syncedAt: now,
    microsoftSecureScore,
    googleWorkspaceHealth,
    credentialHygiene,
    detectedTools,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Security Tool Detection
// ---------------------------------------------------------------------------

/**
 * Detect third-party security tools from tenant-intel data sources:
 *  - Service principals (Entra ID app registrations)
 *  - Managed device installed applications
 *  - MX records (email security gateways)
 *  - Conditional access policies (MFA providers)
 */
async function detectSecurityTools(
  db: ReturnType<typeof getDb>,
  tenantId: string,
): Promise<DetectedSecurityTool[]> {
  const detected: DetectedSecurityTool[] = [];

  // ── Service principals ────────────────────────────────────────────
  const spResult = await db.execute({
    sql: `
      SELECT DISTINCT metadata->>'displayName' as display_name,
             metadata->>'appId' as app_id
      FROM tenant_intel.config_snapshots
      WHERE tenant_id = $1 AND config_type = 'service_principal'
    `,
    params: [tenantId],
  } as any);

  const servicePrincipals = ((spResult ?? []) as any[]).map(
    (r: any) => (r.display_name ?? "").toLowerCase(),
  );

  // ── Managed device apps ───────────────────────────────────────────
  const deviceAppsResult = await db.execute({
    sql: `
      SELECT DISTINCT jsonb_array_elements_text(
        COALESCE(metadata->'installedApps', '[]'::jsonb)
      ) as app_name
      FROM tenant_intel.managed_devices
      WHERE tenant_id = $1
      LIMIT 500
    `,
    params: [tenantId],
  } as any);

  const deviceApps = ((deviceAppsResult ?? []) as any[]).map(
    (r: any) => (r.app_name ?? "").toLowerCase(),
  );

  // ── MX records ────────────────────────────────────────────────────
  const mxResult = await db.execute({
    sql: `
      SELECT metadata->>'value' as mx_value
      FROM tenant_intel.config_snapshots
      WHERE tenant_id = $1 AND config_type = 'mx_record'
    `,
    params: [tenantId],
  } as any);

  const mxRecords = ((mxResult ?? []) as any[]).map(
    (r: any) => (r.mx_value ?? "").toLowerCase(),
  );

  // ── Conditional access policies ───────────────────────────────────
  const caResult = await db.execute({
    sql: `
      SELECT display_name, grant_controls
      FROM tenant_intel.conditional_access_policies
      WHERE tenant_id = $1 AND state = 'enabled'
    `,
    params: [tenantId],
  } as any);

  const caPolicies = (caResult ?? []) as any[];
  const caStrings = caPolicies.map((p: any) =>
    `${p.display_name ?? ""} ${JSON.stringify(p.grant_controls ?? {})}`.toLowerCase(),
  );

  // ── Conditional Access as a compensating control ──────────────────
  if (caPolicies.length > 0) {
    detected.push({
      controlType: "conditional_access",
      name: "Conditional Access Policies",
      vendor: "Microsoft",
      detectionMethod: "conditional_access",
      confidence: "high",
      metadata: { policyCount: caPolicies.length },
    });
  }

  // ── Pattern matching against all sources ──────────────────────────
  for (const pattern of TOOL_DETECTION_PATTERNS) {
    // Skip conditional_access — already handled above
    if (pattern.controlType === "conditional_access") continue;

    // Check service principals
    for (const spName of servicePrincipals) {
      if (pattern.servicePrincipalPatterns.some(p => spName.includes(p))) {
        detected.push({
          controlType: pattern.controlType,
          name: pattern.name,
          vendor: pattern.vendor,
          detectionMethod: "service_principal",
          confidence: "high",
          metadata: { matchedServicePrincipal: spName },
        });
        break; // One match per pattern source is sufficient
      }
    }

    // Check device apps (if not already detected via SP)
    if (!detected.some(d => d.controlType === pattern.controlType)) {
      for (const appName of deviceApps) {
        if (pattern.deviceAppPatterns.some(p => appName.includes(p))) {
          detected.push({
            controlType: pattern.controlType,
            name: pattern.name,
            vendor: pattern.vendor,
            detectionMethod: "intune_inventory",
            confidence: "medium",
            metadata: { matchedDeviceApp: appName },
          });
          break;
        }
      }
    }

    // Check MX records (email security tools)
    if (!detected.some(d => d.controlType === pattern.controlType)) {
      for (const mx of mxRecords) {
        if (pattern.mxPatterns.some(p => mx.includes(p))) {
          detected.push({
            controlType: pattern.controlType,
            name: pattern.name,
            vendor: pattern.vendor,
            detectionMethod: "mx_record",
            confidence: "high",
            metadata: { matchedMxRecord: mx },
          });
          break;
        }
      }
    }

    // Check conditional access policy content (for MFA providers like Duo)
    if (!detected.some(d => d.controlType === pattern.controlType)) {
      for (const caStr of caStrings) {
        if (pattern.conditionalAccessPatterns.some(p => caStr.includes(p))) {
          detected.push({
            controlType: pattern.controlType,
            name: pattern.name,
            vendor: pattern.vendor,
            detectionMethod: "conditional_access",
            confidence: "medium",
            metadata: { matchedConditionalAccessPolicy: true },
          });
          break;
        }
      }
    }
  }

  // Deduplicate — keep the highest-confidence detection per controlType
  const deduped = new Map<string, DetectedSecurityTool>();
  const confidenceOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };

  for (const tool of detected) {
    const existing = deduped.get(tool.controlType);
    if (!existing || confidenceOrder[tool.confidence] > confidenceOrder[existing.confidence]) {
      deduped.set(tool.controlType, tool);
    }
  }

  return Array.from(deduped.values());
}

// ---------------------------------------------------------------------------
// Convenience: Convert detected tools to compensating control inputs
// ---------------------------------------------------------------------------

/**
 * Map detected security tools to the compensating controls format expected
 * by evaluateCompensatingControls() in compensating-controls.ts.
 */
export function toAutoDetectedControls(
  tools: DetectedSecurityTool[],
): Array<{ controlType: string; metadata: Record<string, unknown> }> {
  return tools.map(t => ({
    controlType: t.controlType,
    metadata: {
      ...t.metadata,
      detectionMethod: t.detectionMethod,
      confidence: t.confidence,
    },
  }));
}
