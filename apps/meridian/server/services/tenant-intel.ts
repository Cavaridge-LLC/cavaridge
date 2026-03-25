/**
 * Meridian — Tenant Intelligence Integration
 *
 * Consumes @cavaridge/tenant-intel to enrich M&A due diligence with
 * M365/Google Workspace tenant data (metadata, security posture,
 * license utilization — NOT content).
 *
 * Used during deal assessment intake to pull environment baselines
 * for acquisition targets.
 */

import type {
  TenantSnapshot,
  SecurityPosture,
  LicenseUtilizationReport,
  TenantUser,
  LicenseSummary,
  ManagedDevice,
} from "@cavaridge/tenant-intel";

import { TenantIntelClient } from "@cavaridge/tenant-intel";

export type {
  TenantSnapshot,
  SecurityPosture,
  LicenseUtilizationReport,
  TenantUser,
  LicenseSummary,
  ManagedDevice,
};

/**
 * Summary of tenant intelligence data for M&A assessment.
 * Aggregated from snapshot, security, and license data.
 */
export interface TenantIntelSummary {
  snapshot: TenantSnapshot | null;
  securityPosture: SecurityPosture | null;
  licenseUtilization: LicenseUtilizationReport | null;
  users: TenantUser[];
  devices: ManagedDevice[];
  userCount: number;
  licensedUserCount: number;
  securityScore: number | null;
  securityScoreMax: number | null;
  deviceCount: number;
}

// Singleton client instance — initialized at app startup if Redis is available
const client = new TenantIntelClient();

/**
 * Check if tenant-intel infrastructure is available.
 * Returns false if Redis/BullMQ is not configured.
 */
export function isTenantIntelAvailable(): boolean {
  return client.isReady();
}

/**
 * Initialize the tenant-intel client with Redis connection.
 * Call once at app startup.
 */
export function initializeTenantIntel(redisUrl: string): void {
  try {
    client.initialize({ url: redisUrl });
  } catch {
    // tenant-intel not available — degrade gracefully
  }
}

/**
 * Enriches a deal with tenant intelligence from the target's M365/GWS tenant.
 * Returns null if tenant-intel is not yet operational.
 */
export async function enrichDealWithTenantIntel(
  _targetTenantId: string
): Promise<TenantIntelSummary | null> {
  if (!isTenantIntelAvailable()) {
    return null;
  }
  // Phase 1: stub — will connect to ingestion pipeline in Phase 2
  return null;
}

/**
 * Pulls security posture data for risk scoring during M&A assessment.
 */
export async function getTargetSecurityPosture(
  _targetTenantId: string
): Promise<SecurityPosture | null> {
  if (!isTenantIntelAvailable()) {
    return null;
  }
  // Phase 1: stub
  return null;
}

/**
 * Pulls license utilization for cost analysis during M&A assessment.
 */
export async function getTargetLicenseData(
  _targetTenantId: string
): Promise<LicenseUtilizationReport | null> {
  if (!isTenantIntelAvailable()) {
    return null;
  }
  // Phase 1: stub
  return null;
}

/**
 * Pulls user list for org structure analysis during M&A assessment.
 */
export async function getTargetUsers(
  _targetTenantId: string
): Promise<TenantUser[]> {
  if (!isTenantIntelAvailable()) {
    return [];
  }
  // Phase 1: stub
  return [];
}
