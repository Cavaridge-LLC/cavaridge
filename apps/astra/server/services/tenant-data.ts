/**
 * Tenant Data Bridge — tries @cavaridge/tenant-intel first, falls back to direct Graph.
 *
 * Once tenant-intel ingestion pipelines are live (Phase 1), Astra becomes a "view" on
 * top of tenant-intel data filtered to licensing. Until then, direct Graph calls remain
 * the operational path.
 */

import {
  isTenantIntelAvailable,
  getLicenseUtilization,
  getTenantUsers,
  getSecurityPosture,
  type LicenseUtilization,
  type TenantUser,
  type SecurityPosture,
} from "@cavaridge/tenant-intel";
import { fetchM365Data, fetchActiveUserDetailReport } from "../microsoft-graph";

export interface TenantLicenseData {
  source: "tenant-intel" | "graph-direct";
  licenses?: LicenseUtilization | null;
  users?: TenantUser[];
  security?: SecurityPosture | null;
  graphData?: Awaited<ReturnType<typeof fetchM365Data>>;
  activityData?: Awaited<ReturnType<typeof fetchActiveUserDetailReport>>;
}

/**
 * Fetches license and user data, preferring tenant-intel when available.
 * Falls back to direct Microsoft Graph API calls via session token.
 */
export async function getLicenseData(
  tenantId: string,
  sessionId?: string,
): Promise<TenantLicenseData | null> {
  // Try tenant-intel first (Phase 1+ when ingestion pipelines are live)
  if (isTenantIntelAvailable()) {
    const [licenses, users, security] = await Promise.all([
      getLicenseUtilization(tenantId),
      getTenantUsers(tenantId),
      getSecurityPosture(tenantId),
    ]);
    if (licenses && users.length > 0) {
      return { source: "tenant-intel", licenses, users, security };
    }
  }

  // Fallback to direct Graph API
  if (sessionId) {
    const [graphData, activityData] = await Promise.all([
      fetchM365Data(sessionId),
      fetchActiveUserDetailReport(sessionId).catch(() => null),
    ]);
    return { source: "graph-direct", graphData, activityData };
  }

  return null;
}
