/**
 * Delta Detection
 *
 * Compares two TenantSnapshots and underlying data to produce
 * a DeltaReport describing what changed between ingestion runs.
 */

import type {
  TenantSnapshot,
  DeltaReport,
  DeltaChange,
  DeltaSummary,
  TenantUser,
  LicenseSummary,
  SecurityPosture,
  ManagedDevice,
} from "../shared/types.js";

export interface DeltaInput {
  fromSnapshot: TenantSnapshot;
  toSnapshot: TenantSnapshot;
  fromUsers: TenantUser[];
  toUsers: TenantUser[];
  fromLicenses: LicenseSummary[];
  toLicenses: LicenseSummary[];
  fromSecurity: SecurityPosture;
  toSecurity: SecurityPosture;
  fromDevices: ManagedDevice[];
  toDevices: ManagedDevice[];
}

export function computeDelta(input: DeltaInput): DeltaReport {
  const changes: DeltaChange[] = [];

  // User changes
  const userChanges = diffEntities(
    input.fromUsers,
    input.toUsers,
    (u) => u.sourceId,
    (u) => u.displayName,
    "user",
    ["accountEnabled", "mfaEnabled", "isAdmin", "department", "jobTitle"],
  );
  changes.push(...userChanges);

  // License changes
  const licenseChanges = diffEntities(
    input.fromLicenses,
    input.toLicenses,
    (l) => l.skuId,
    (l) => l.skuName,
    "license",
    ["totalQuantity", "assignedCount", "utilizationPct"],
  );
  changes.push(...licenseChanges);

  // Device changes
  const deviceChanges = diffEntities(
    input.fromDevices,
    input.toDevices,
    (d) => d.sourceId,
    (d) => d.deviceName,
    "device",
    ["complianceState", "isManaged", "operatingSystem"],
  );
  changes.push(...deviceChanges);

  // Security control changes
  const controlChanges = diffEntities(
    input.fromSecurity.controls,
    input.toSecurity.controls,
    (c) => c.controlId,
    (c) => c.controlName,
    "security_control",
    ["nativeStatus", "pointsAchieved"],
  );
  changes.push(...controlChanges);

  // Security score change
  if (input.fromSecurity.nativeScore !== input.toSecurity.nativeScore) {
    changes.push({
      entity: "config",
      changeType: "modified",
      entityId: "security_score",
      entityName: "Microsoft Secure Score",
      field: "nativeScore",
      previousValue: input.fromSecurity.nativeScore,
      currentValue: input.toSecurity.nativeScore,
    });
  }

  const usersAdded = userChanges.filter((c) => c.changeType === "added").length;
  const usersRemoved = userChanges.filter((c) => c.changeType === "removed").length;
  const usersModified = userChanges.filter((c) => c.changeType === "modified").length;
  const devicesAdded = deviceChanges.filter((c) => c.changeType === "added").length;
  const devicesRemoved = deviceChanges.filter((c) => c.changeType === "removed").length;

  const summary: DeltaSummary = {
    usersAdded,
    usersRemoved,
    usersModified,
    licensesChanged: licenseChanges.length,
    securityScoreDelta:
      input.fromSecurity.nativeScore !== null && input.toSecurity.nativeScore !== null
        ? input.toSecurity.nativeScore - input.fromSecurity.nativeScore
        : null,
    devicesAdded,
    devicesRemoved,
    policiesChanged: controlChanges.length,
    totalChanges: changes.length,
  };

  return {
    tenantId: input.toSnapshot.tenantId,
    fromSnapshotId: input.fromSnapshot.id,
    toSnapshotId: input.toSnapshot.id,
    fromDate: input.fromSnapshot.capturedAt,
    toDate: input.toSnapshot.capturedAt,
    changes,
    summary,
  };
}

function diffEntities<T>(
  from: T[],
  to: T[],
  idFn: (item: T) => string,
  nameFn: (item: T) => string,
  entityType: DeltaChange["entity"],
  compareFields: string[],
): DeltaChange[] {
  const changes: DeltaChange[] = [];
  const fromMap = new Map(from.map((item) => [idFn(item), item]));
  const toMap = new Map(to.map((item) => [idFn(item), item]));

  // Added
  for (const [id, item] of toMap) {
    if (!fromMap.has(id)) {
      changes.push({
        entity: entityType,
        changeType: "added",
        entityId: id,
        entityName: nameFn(item),
      });
    }
  }

  // Removed
  for (const [id, item] of fromMap) {
    if (!toMap.has(id)) {
      changes.push({
        entity: entityType,
        changeType: "removed",
        entityId: id,
        entityName: nameFn(item),
      });
    }
  }

  // Modified
  for (const [id, fromItem] of fromMap) {
    const toItem = toMap.get(id);
    if (!toItem) continue;

    for (const field of compareFields) {
      const fromVal = (fromItem as Record<string, unknown>)[field];
      const toVal = (toItem as Record<string, unknown>)[field];
      if (fromVal !== toVal) {
        changes.push({
          entity: entityType,
          changeType: "modified",
          entityId: id,
          entityName: nameFn(toItem),
          field,
          previousValue: fromVal,
          currentValue: toVal,
        });
      }
    }
  }

  return changes;
}
