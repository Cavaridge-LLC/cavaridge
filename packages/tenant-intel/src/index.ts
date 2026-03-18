/**
 * @cavaridge/tenant-intel — M365/GWS Tenant Intelligence Layer
 *
 * Ingests tenant metadata, config, usage analytics, and security posture
 * from Microsoft 365 (Graph API) and Google Workspace (Admin SDK).
 *
 * NOT content (email/doc bodies) — that's Phase 2 behind compliance gate.
 *
 * Consumed by: Meridian, Midas, Astra, HIPAA, AEGIS, Ducky.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface TenantSnapshot {
  tenantId: string;
  provider: "m365" | "gws";
  capturedAt: string;
  userCount: number;
  licensedUserCount: number;
  domainNames: string[];
  securityDefaults: boolean | null;
  mfaEnrollmentPct: number | null;
  conditionalAccessPolicies: number | null;
  deviceCount: number | null;
  managedDevicePct: number | null;
  raw: Record<string, unknown>;
}

export interface SecurityPosture {
  tenantId: string;
  provider: "m365" | "gws";
  capturedAt: string;
  secureScore: number | null;
  secureScoreMax: number | null;
  secureScorePct: number | null;
  mfaEnabled: boolean | null;
  passwordPolicies: Record<string, unknown>;
  adminCount: number | null;
  globalAdminCount: number | null;
  staleAccountCount: number | null;
  raw: Record<string, unknown>;
}

export interface LicenseUtilization {
  tenantId: string;
  provider: "m365" | "gws";
  capturedAt: string;
  licenses: Array<{
    skuName: string;
    total: number;
    assigned: number;
    available: number;
    utilizationPct: number;
  }>;
  totalMonthlySpend: number | null;
  raw: Record<string, unknown>;
}

export interface TenantUser {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  mfaEnabled: boolean | null;
  lastSignIn: string | null;
  accountEnabled: boolean;
}

export interface TenantIntelSummary {
  snapshot: TenantSnapshot | null;
  security: SecurityPosture | null;
  licenses: LicenseUtilization | null;
  userCount: number;
}

// ── API (stubs — will be implemented in Phase 1) ────────────────────

/**
 * Returns false until tenant-intel ingestion pipeline is operational.
 * Consuming apps should check this before calling other functions.
 */
export function isTenantIntelAvailable(): boolean {
  return false;
}

export async function getLatestSnapshot(tenantId: string): Promise<TenantSnapshot | null> {
  void tenantId;
  return null;
}

export async function getSecurityPosture(tenantId: string): Promise<SecurityPosture | null> {
  void tenantId;
  return null;
}

export async function getLicenseUtilization(tenantId: string): Promise<LicenseUtilization | null> {
  void tenantId;
  return null;
}

export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  void tenantId;
  return [];
}

export async function getTenantIntelSummary(tenantId: string): Promise<TenantIntelSummary> {
  const [snapshot, security, licenses, users] = await Promise.all([
    getLatestSnapshot(tenantId),
    getSecurityPosture(tenantId),
    getLicenseUtilization(tenantId),
    getTenantUsers(tenantId),
  ]);
  return { snapshot, security, licenses, userCount: users.length };
}
