/**
 * Vector Store — pgvector embedding storage
 *
 * Generates and stores embeddings for tenant data so Ducky and other
 * agents can perform semantic queries against tenant state.
 */

import { generateEmbedding } from "@cavaridge/spaniel";
import type { TenantUser, LicenseSummary, SecurityPosture } from "../shared/types.js";

export interface EmbeddingRecord {
  id: string;
  tenantId: string;
  snapshotId: string;
  entityType: "user_summary" | "license_summary" | "security_summary" | "config_summary";
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export async function generateTenantEmbeddings(
  tenantId: string,
  snapshotId: string,
  data: {
    users: TenantUser[];
    licenses: LicenseSummary[];
    security: SecurityPosture;
  },
): Promise<EmbeddingRecord[]> {
  const documents = buildEmbeddingDocuments(tenantId, snapshotId, data);

  if (documents.length === 0) return [];

  const texts = documents.map((d) => d.content);
  const embeddings = await generateEmbedding(texts, {
    tenantId,
    userId: "system",
    appCode: "CVG-CORE",
  });

  return documents.map((doc, i) => ({
    ...doc,
    embedding: embeddings[i],
  }));
}

function buildEmbeddingDocuments(
  tenantId: string,
  snapshotId: string,
  data: {
    users: TenantUser[];
    licenses: LicenseSummary[];
    security: SecurityPosture;
  },
): Omit<EmbeddingRecord, "embedding">[] {
  const docs: Omit<EmbeddingRecord, "embedding">[] = [];

  // User summary
  const totalUsers = data.users.length;
  const enabledUsers = data.users.filter((u) => u.accountEnabled).length;
  const admins = data.users.filter((u) => u.isAdmin);
  const mfaEnabled = data.users.filter((u) => u.mfaEnabled).length;
  const departments = [...new Set(data.users.map((u) => u.department).filter(Boolean))];

  docs.push({
    id: crypto.randomUUID(),
    tenantId,
    snapshotId,
    entityType: "user_summary",
    content: `Tenant has ${totalUsers} users (${enabledUsers} active). ${admins.length} administrators. ${mfaEnabled} users with MFA enabled (${totalUsers > 0 ? Math.round((mfaEnabled / totalUsers) * 100) : 0}%). Departments: ${departments.join(", ") || "not specified"}.`,
    metadata: { totalUsers, enabledUsers, adminCount: admins.length, mfaEnabled, departments },
  });

  // License summary
  if (data.licenses.length > 0) {
    const totalLicenses = data.licenses.reduce((s, l) => s + l.totalQuantity, 0);
    const totalAssigned = data.licenses.reduce((s, l) => s + l.assignedCount, 0);
    const wastedCount = data.licenses.reduce((s, l) => s + l.availableCount, 0);
    const licenseNames = data.licenses.map((l) => `${l.skuName} (${l.assignedCount}/${l.totalQuantity})`);

    docs.push({
      id: crypto.randomUUID(),
      tenantId,
      snapshotId,
      entityType: "license_summary",
      content: `Tenant has ${totalLicenses} total licenses across ${data.licenses.length} SKUs. ${totalAssigned} assigned, ${wastedCount} unassigned. License breakdown: ${licenseNames.join("; ")}.`,
      metadata: { totalLicenses, totalAssigned, wastedCount, skuCount: data.licenses.length },
    });
  }

  // Security summary
  const implementedControls = data.security.controls.filter((c) => c.nativeStatus === "implemented").length;
  const totalControls = data.security.controls.length;

  docs.push({
    id: crypto.randomUUID(),
    tenantId,
    snapshotId,
    entityType: "security_summary",
    content: `Microsoft Secure Score: ${data.security.nativeScore}/${data.security.maxPossibleScore} (${data.security.scorePct}%). ${implementedControls}/${totalControls} security controls implemented. MFA enrollment: ${totalUsers > 0 ? Math.round((mfaEnabled / totalUsers) * 100) : 0}%.`,
    metadata: {
      nativeScore: data.security.nativeScore,
      maxScore: data.security.maxPossibleScore,
      scorePct: data.security.scorePct,
      implementedControls,
      totalControls,
    },
  });

  return docs;
}
