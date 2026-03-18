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

import {
  isTenantIntelAvailable,
  getLatestSnapshot,
  getSecurityPosture,
  getLicenseUtilization,
  getTenantUsers,
  getTenantIntelSummary,
  type TenantSnapshot,
  type SecurityPosture,
  type LicenseUtilization,
  type TenantUser,
  type TenantIntelSummary,
} from "@cavaridge/tenant-intel";

export {
  type TenantSnapshot,
  type SecurityPosture,
  type LicenseUtilization,
  type TenantUser,
  type TenantIntelSummary,
};

/**
 * Enriches a deal with tenant intelligence from the target's M365/GWS tenant.
 * Returns null if tenant-intel is not yet operational (Phase 1 stub).
 */
export async function enrichDealWithTenantIntel(
  targetTenantId: string
): Promise<TenantIntelSummary | null> {
  if (!isTenantIntelAvailable()) {
    return null;
  }
  return getTenantIntelSummary(targetTenantId);
}

/**
 * Pulls security posture data for risk scoring during M&A assessment.
 */
export async function getTargetSecurityPosture(
  targetTenantId: string
): Promise<SecurityPosture | null> {
  if (!isTenantIntelAvailable()) {
    return null;
  }
  return getSecurityPosture(targetTenantId);
}

/**
 * Pulls license utilization for cost analysis during M&A assessment.
 */
export async function getTargetLicenseData(
  targetTenantId: string
): Promise<LicenseUtilization | null> {
  if (!isTenantIntelAvailable()) {
    return null;
  }
  return getLicenseUtilization(targetTenantId);
}

/**
 * Pulls user list for org structure analysis during M&A assessment.
 */
export async function getTargetUsers(
  targetTenantId: string
): Promise<TenantUser[]> {
  if (!isTenantIntelAvailable()) {
    return [];
  }
  return getTenantUsers(targetTenantId);
}

/**
 * Pulls latest environment snapshot for baseline comparison.
 */
export async function getTargetSnapshot(
  targetTenantId: string
): Promise<TenantSnapshot | null> {
  if (!isTenantIntelAvailable()) {
    return null;
  }
  return getLatestSnapshot(targetTenantId);
}
