/**
 * Snapshot Manager
 *
 * Creates point-in-time snapshots from ingested tenant data and
 * persists them to the tenant_snapshots table.
 */

import { createHash } from "node:crypto";
import type {
  TenantSnapshot,
  SnapshotTrigger,
  TenantUser,
  LicenseSummary,
  SecurityPosture,
  ManagedDevice,
  ConditionalAccessPolicy,
  SourceVendor,
} from "../shared/types.js";

export interface SnapshotInput {
  tenantId: string;
  sourceVendor: SourceVendor;
  trigger: SnapshotTrigger;
  users: TenantUser[];
  licenses: LicenseSummary[];
  security: SecurityPosture;
  devices: ManagedDevice[];
  conditionalAccessPolicies: ConditionalAccessPolicy[];
  domainNames: string[];
}

export function buildSnapshot(input: SnapshotInput): TenantSnapshot {
  const licensedUsers = input.users.filter(
    (u) => u.licenses.length > 0 && u.accountEnabled,
  );
  const managedDevices = input.devices.filter((d) => d.isManaged);
  const totalLicenses = input.licenses.reduce(
    (sum, l) => sum + l.totalQuantity,
    0,
  );

  const hashPayload = JSON.stringify({
    userCount: input.users.length,
    licensedUserCount: licensedUsers.length,
    licenseCount: totalLicenses,
    securityScore: input.security.nativeScore,
    deviceCount: input.devices.length,
    managedDeviceCount: managedDevices.length,
    caPolicyCount: input.conditionalAccessPolicies.length,
    domains: input.domainNames.sort(),
  });

  const dataHash = createHash("sha256").update(hashPayload).digest("hex");

  return {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    sourceVendor: input.sourceVendor,
    capturedAt: new Date(),
    trigger: input.trigger,
    userCount: input.users.length,
    licensedUserCount: licensedUsers.length,
    licenseCount: totalLicenses,
    securityScore: input.security.nativeScore,
    securityScoreMax: input.security.maxPossibleScore,
    deviceCount: input.devices.length,
    managedDeviceCount: managedDevices.length,
    conditionalAccessPolicyCount: input.conditionalAccessPolicies.length,
    domainNames: input.domainNames,
    dataHash,
  };
}
