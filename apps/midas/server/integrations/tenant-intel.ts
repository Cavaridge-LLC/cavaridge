/**
 * Tenant-Intel Integration — consumes @cavaridge/tenant-intel data.
 *
 * Cross-app data flow: tenant-intel → CVG-MIDAS
 * License utilization, security config, user metrics.
 */

import type {
  TenantSnapshot,
  LicenseSummary,
  SecurityPosture,
  LicenseUtilizationReport,
  TenantUser,
  ManagedDevice,
} from "@cavaridge/tenant-intel";

import type {
  LicenseUtilizationSummary,
  LicenseSkuSummary,
  UserMetricsSummary,
  SecurityConfigSummary,
  TenantIntelSnapshot,
} from "@shared/types/tenant-intel-integration";

/**
 * Transform tenant-intel LicenseUtilizationReport into Midas summary format.
 */
export function transformLicenseReport(
  clientId: string,
  report: LicenseUtilizationReport,
): LicenseUtilizationSummary {
  const topSkus: LicenseSkuSummary[] = report.summaries
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10)
    .map((s) => ({
      skuName: s.skuName,
      totalQuantity: s.totalQuantity,
      assignedCount: s.assignedCount,
      availableCount: s.availableCount,
      utilizationPct: s.utilizationPct,
      estimatedMonthlyCost: s.estimatedMonthlyCost ?? null,
    }));

  const totalLicenses = report.summaries.reduce((sum, s) => sum + s.totalQuantity, 0);
  const assignedLicenses = report.summaries.reduce((sum, s) => sum + s.assignedCount, 0);

  return {
    tenantId: report.tenantId,
    clientId,
    capturedAt: report.capturedAt.toISOString(),
    totalLicenses,
    assignedLicenses,
    utilizationPct: totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0,
    estimatedMonthlySpend: report.totalMonthlySpend,
    wastedLicenseCount: report.wastedLicenseCount,
    wastedMonthlyCost: report.wastedMonthlyCost,
    topSkus,
  };
}

/**
 * Transform tenant-intel user data into Midas summary format.
 */
export function transformUserMetrics(
  clientId: string,
  tenantId: string,
  users: TenantUser[],
): UserMetricsSummary {
  const activeUsers = users.filter((u) => u.accountEnabled);
  const inactiveUsers = users.filter((u) => !u.accountEnabled);
  const mfaEnabled = users.filter((u) => u.mfaEnabled);
  const admins = users.filter((u) => u.isAdmin);
  const licensed = users.filter((u) => u.licenses.length > 0);

  return {
    tenantId,
    clientId,
    capturedAt: new Date().toISOString(),
    totalUsers: users.length,
    activeUsers: activeUsers.length,
    inactiveUsers: inactiveUsers.length,
    mfaEnabledCount: mfaEnabled.length,
    mfaEnabledPct: users.length > 0 ? Math.round((mfaEnabled.length / users.length) * 100) : 0,
    adminCount: admins.length,
    licensedUserCount: licensed.length,
  };
}

/**
 * Transform tenant-intel security posture into Midas summary format.
 */
export function transformSecurityConfig(
  clientId: string,
  posture: SecurityPosture,
  devices: ManagedDevice[],
  conditionalAccessCount: number,
): SecurityConfigSummary {
  const managedDevices = devices.filter((d) => d.isManaged);
  const compliantDevices = devices.filter((d) => d.complianceState === "compliant");

  return {
    tenantId: posture.tenantId,
    clientId,
    capturedAt: posture.capturedAt.toISOString(),
    nativeSecurityScore: posture.nativeScore,
    maxSecurityScore: posture.maxPossibleScore,
    conditionalAccessPolicyCount: conditionalAccessCount,
    managedDeviceCount: managedDevices.length,
    compliantDeviceCount: compliantDevices.length,
    deviceCompliancePct: managedDevices.length > 0
      ? Math.round((compliantDevices.length / managedDevices.length) * 100)
      : 0,
  };
}

/**
 * Build a complete tenant intel snapshot for Midas consumption.
 */
export function buildTenantIntelSnapshot(
  clientId: string,
  tenantId: string,
  licenseReport: LicenseUtilizationReport,
  users: TenantUser[],
  securityPosture: SecurityPosture,
  devices: ManagedDevice[],
  conditionalAccessCount: number,
): TenantIntelSnapshot {
  return {
    licenses: transformLicenseReport(clientId, licenseReport),
    users: transformUserMetrics(clientId, tenantId, users),
    security: transformSecurityConfig(clientId, securityPosture, devices, conditionalAccessCount),
  };
}
