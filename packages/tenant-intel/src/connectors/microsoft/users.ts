/**
 * Microsoft Graph — User Directory Connector
 *
 * Enumerates users, group memberships, admin roles, and MFA status.
 */

import type { GraphClient } from "./graph-client.js";
import type { TenantUser, NormalizedLicense } from "../../shared/types.js";

interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  department: string | null;
  jobTitle: string | null;
  accountEnabled: boolean;
  signInActivity?: {
    lastSignInDateTime?: string;
  };
  assignedLicenses?: Array<{ skuId: string }>;
  createdDateTime?: string;
}

interface DirectoryRole {
  id: string;
  displayName: string;
  members?: Array<{ id: string }>;
}

interface AuthMethod {
  id: string;
  "@odata.type": string;
}

export async function fetchUsers(
  client: GraphClient,
  tenantId: string,
): Promise<TenantUser[]> {
  const graphUsers = await client.getAll<GraphUser>("/users", {
    $select:
      "id,displayName,mail,userPrincipalName,department,jobTitle,accountEnabled,signInActivity,assignedLicenses,createdDateTime",
    $top: "999",
  });

  const adminRoleMap = await fetchAdminRoles(client);

  const users: TenantUser[] = [];

  for (const gu of graphUsers) {
    const adminRoles = adminRoleMap.get(gu.id) || [];
    const mfaStatus = await checkMfaStatus(client, gu.id);

    users.push({
      id: crypto.randomUUID(),
      tenantId,
      sourceVendor: "microsoft",
      sourceId: gu.id,
      displayName: gu.displayName,
      email: gu.mail || gu.userPrincipalName,
      userPrincipalName: gu.userPrincipalName,
      department: gu.department || undefined,
      jobTitle: gu.jobTitle || undefined,
      accountEnabled: gu.accountEnabled,
      licenses: (gu.assignedLicenses || []).map(
        (l): NormalizedLicense => ({
          skuName: l.skuId,
          skuId: l.skuId,
          utilizationScore: 0,
          services: [],
        }),
      ),
      lastSignIn: gu.signInActivity?.lastSignInDateTime
        ? new Date(gu.signInActivity.lastSignInDateTime)
        : undefined,
      mfaEnabled: mfaStatus.enabled,
      mfaMethod: mfaStatus.method,
      isAdmin: adminRoles.length > 0,
      adminRoles: adminRoles.length > 0 ? adminRoles : undefined,
      createdAt: gu.createdDateTime ? new Date(gu.createdDateTime) : new Date(),
      updatedAt: new Date(),
    });
  }

  return users;
}

async function fetchAdminRoles(client: GraphClient): Promise<Map<string, string[]>> {
  const roleMap = new Map<string, string[]>();

  try {
    const roles = await client.getAll<DirectoryRole>("/directoryRoles", {
      $expand: "members",
    });

    for (const role of roles) {
      for (const member of role.members || []) {
        const existing = roleMap.get(member.id) || [];
        existing.push(role.displayName);
        roleMap.set(member.id, existing);
      }
    }
  } catch {
    // Directory roles may not be accessible — degrade gracefully
  }

  return roleMap;
}

async function checkMfaStatus(
  client: GraphClient,
  userId: string,
): Promise<{ enabled: boolean; method?: string }> {
  try {
    const methods = await client.getAll<AuthMethod>(
      `/users/${userId}/authentication/methods`,
    );
    const strongMethods = methods.filter(
      (m) =>
        m["@odata.type"] !== "#microsoft.graph.passwordAuthenticationMethod",
    );
    if (strongMethods.length > 0) {
      const method = strongMethods[0]["@odata.type"]
        .replace("#microsoft.graph.", "")
        .replace("AuthenticationMethod", "");
      return { enabled: true, method };
    }
    return { enabled: false };
  } catch {
    return { enabled: false };
  }
}
