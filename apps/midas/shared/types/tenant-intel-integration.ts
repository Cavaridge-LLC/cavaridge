/**
 * Tenant-Intel Integration Types — CVG-MIDAS
 *
 * Types for consuming @cavaridge/tenant-intel data in Midas.
 * License utilization, security config, user metrics.
 */

// ── License Utilization Summary (for QBR / Dashboard) ────────────────

export interface LicenseUtilizationSummary {
  tenantId: string;
  clientId: string;
  capturedAt: string;
  totalLicenses: number;
  assignedLicenses: number;
  utilizationPct: number;
  estimatedMonthlySpend: number | null;
  wastedLicenseCount: number;
  wastedMonthlyCost: number | null;
  topSkus: LicenseSkuSummary[];
}

export interface LicenseSkuSummary {
  skuName: string;
  totalQuantity: number;
  assignedCount: number;
  availableCount: number;
  utilizationPct: number;
  estimatedMonthlyCost: number | null;
}

// ── User Metrics (for QBR section) ──────────────────────────────────

export interface UserMetricsSummary {
  tenantId: string;
  clientId: string;
  capturedAt: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  mfaEnabledCount: number;
  mfaEnabledPct: number;
  adminCount: number;
  licensedUserCount: number;
}

// ── Security Config Summary (for QBR) ───────────────────────────────

export interface SecurityConfigSummary {
  tenantId: string;
  clientId: string;
  capturedAt: string;
  nativeSecurityScore: number | null;
  maxSecurityScore: number | null;
  conditionalAccessPolicyCount: number;
  managedDeviceCount: number;
  compliantDeviceCount: number;
  deviceCompliancePct: number;
}

// ── Combined Tenant Intel for Midas ─────────────────────────────────

export interface TenantIntelSnapshot {
  licenses: LicenseUtilizationSummary;
  users: UserMetricsSummary;
  security: SecurityConfigSummary;
}
