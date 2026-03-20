/**
 * Microsoft Graph — Intune Device Inventory Connector
 *
 * Fetches managed device list, compliance state, and OS details.
 */

import type { GraphClient } from "./graph-client.js";
import type { ManagedDevice } from "../../shared/types.js";

interface GraphManagedDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: string;
  isSupervised: boolean;
  managementAgent: string;
  enrolledDateTime: string;
  lastSyncDateTime: string;
  managedDeviceOwnerType: string;
  userPrincipalName: string;
}

export async function fetchDevices(
  client: GraphClient,
  tenantId: string,
): Promise<ManagedDevice[]> {
  try {
    const devices = await client.getAll<GraphManagedDevice>(
      "/deviceManagement/managedDevices",
      {
        $select:
          "id,deviceName,operatingSystem,osVersion,complianceState,isSupervised,managementAgent,enrolledDateTime,lastSyncDateTime,managedDeviceOwnerType,userPrincipalName",
        $top: "999",
      },
    );

    return devices.map((d): ManagedDevice => ({
      id: crypto.randomUUID(),
      tenantId,
      sourceVendor: "microsoft",
      sourceId: d.id,
      deviceName: d.deviceName,
      operatingSystem: d.operatingSystem,
      osVersion: d.osVersion || undefined,
      complianceState: mapComplianceState(d.complianceState),
      isManaged: d.managementAgent !== "none",
      enrolledDateTime: d.enrolledDateTime ? new Date(d.enrolledDateTime) : undefined,
      lastSyncDateTime: d.lastSyncDateTime ? new Date(d.lastSyncDateTime) : undefined,
      ownerType: mapOwnerType(d.managedDeviceOwnerType),
      userPrincipalName: d.userPrincipalName || undefined,
    }));
  } catch {
    // Intune may not be licensed — degrade gracefully
    return [];
  }
}

function mapComplianceState(state: string): ManagedDevice["complianceState"] {
  switch (state?.toLowerCase()) {
    case "compliant":
      return "compliant";
    case "noncompliant":
    case "conflict":
    case "error":
      return "noncompliant";
    case "ingraceperiod":
    case "configmanager":
      return "unknown";
    default:
      return "notEvaluated";
  }
}

function mapOwnerType(type: string): ManagedDevice["ownerType"] {
  switch (type?.toLowerCase()) {
    case "company":
      return "company";
    case "personal":
      return "personal";
    default:
      return "unknown";
  }
}
