/**
 * Ingestion Pipeline — Orchestrator
 *
 * Coordinates full tenant data ingestion from Microsoft Graph API.
 * Runs each module independently so partial failures don't block
 * the entire pipeline.
 */

import {
  GraphClient,
  fetchUsers,
  fetchLicenses,
  fetchSecurityPosture,
  fetchConditionalAccessPolicies,
  fetchDevices,
} from "../connectors/microsoft/index.js";
import { buildSnapshot } from "../storage/snapshot.js";
import { computeDelta, type DeltaInput } from "../storage/delta.js";
import { generateTenantEmbeddings } from "../storage/vector-store.js";
import type {
  M365Credentials,
  IngestOptions,
  IngestResult,
  IngestModule,
  IngestModuleResult,
  TenantUser,
  LicenseSummary,
  SecurityPosture,
  ManagedDevice,
  ConditionalAccessPolicy,
  TenantSnapshot,
  DeltaReport,
} from "../shared/types.js";

const DEFAULT_MODULES: IngestModule[] = [
  "users",
  "licenses",
  "security",
  "devices",
  "conditional_access",
];

export async function ingestTenant(
  credentials: M365Credentials,
  options?: IngestOptions,
): Promise<IngestResult> {
  const startTime = Date.now();
  const tenantId = credentials.tenantId;
  const modules = options?.modules || DEFAULT_MODULES;
  const trigger = options?.trigger || "manual";

  const client = new GraphClient(credentials);

  let users: TenantUser[] = [];
  let licenses: LicenseSummary[] = [];
  let security: SecurityPosture = emptySecurityPosture(tenantId);
  let devices: ManagedDevice[] = [];
  let conditionalAccessPolicies: ConditionalAccessPolicy[] = [];
  let domainNames: string[] = [];

  const moduleResults: IngestModuleResult[] = [];

  // Run each module, capturing individual results
  if (modules.includes("users")) {
    const result = await runModule("users", async () => {
      users = await fetchUsers(client, tenantId);
      return users.length;
    });
    moduleResults.push(result);
  }

  if (modules.includes("licenses")) {
    const result = await runModule("licenses", async () => {
      licenses = await fetchLicenses(client, tenantId);
      return licenses.length;
    });
    moduleResults.push(result);
  }

  if (modules.includes("security")) {
    const result = await runModule("security", async () => {
      security = await fetchSecurityPosture(client, tenantId);
      conditionalAccessPolicies = await fetchConditionalAccessPolicies(client, tenantId);
      return security.controls.length;
    });
    moduleResults.push(result);
  }

  if (modules.includes("devices")) {
    const result = await runModule("devices", async () => {
      devices = await fetchDevices(client, tenantId);
      return devices.length;
    });
    moduleResults.push(result);
  }

  if (modules.includes("conditional_access")) {
    const result = await runModule("conditional_access", async () => {
      if (conditionalAccessPolicies.length === 0) {
        conditionalAccessPolicies = await fetchConditionalAccessPolicies(client, tenantId);
      }
      return conditionalAccessPolicies.length;
    });
    moduleResults.push(result);
  }

  // Fetch domain names from org profile
  try {
    const org = await client.get<{ value: Array<{ verifiedDomains: Array<{ name: string }> }> }>(
      "/organization",
      { $select: "verifiedDomains" },
    );
    domainNames = org.value?.[0]?.verifiedDomains?.map((d) => d.name) || [];
  } catch {
    // Non-critical — continue without domains
  }

  // Build snapshot
  const snapshot = buildSnapshot({
    tenantId,
    sourceVendor: "microsoft",
    trigger,
    users,
    licenses,
    security,
    devices,
    conditionalAccessPolicies,
    domainNames,
  });

  // Generate embeddings (non-blocking — errors don't fail ingestion)
  try {
    await generateTenantEmbeddings(tenantId, snapshot.id, {
      users,
      licenses,
      security,
    });
  } catch {
    // Embedding generation failure is non-critical
  }

  return {
    tenantId,
    snapshotId: snapshot.id,
    sourceVendor: "microsoft",
    capturedAt: snapshot.capturedAt,
    modules: moduleResults,
    durationMs: Date.now() - startTime,
  };
}

export function computeSnapshotDelta(
  from: {
    snapshot: TenantSnapshot;
    users: TenantUser[];
    licenses: LicenseSummary[];
    security: SecurityPosture;
    devices: ManagedDevice[];
  },
  to: {
    snapshot: TenantSnapshot;
    users: TenantUser[];
    licenses: LicenseSummary[];
    security: SecurityPosture;
    devices: ManagedDevice[];
  },
): DeltaReport {
  const deltaInput: DeltaInput = {
    fromSnapshot: from.snapshot,
    toSnapshot: to.snapshot,
    fromUsers: from.users,
    toUsers: to.users,
    fromLicenses: from.licenses,
    toLicenses: to.licenses,
    fromSecurity: from.security,
    toSecurity: to.security,
    fromDevices: from.devices,
    toDevices: to.devices,
  };
  return computeDelta(deltaInput);
}

async function runModule(
  module: IngestModule,
  fn: () => Promise<number>,
): Promise<IngestModuleResult> {
  const start = Date.now();
  try {
    const recordCount = await fn();
    return {
      module,
      recordCount,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      module,
      recordCount: 0,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function emptySecurityPosture(tenantId: string): SecurityPosture {
  return {
    tenantId,
    sourceVendor: "microsoft",
    nativeScore: 0,
    maxPossibleScore: 0,
    scorePct: 0,
    controls: [],
    capturedAt: new Date(),
  };
}
