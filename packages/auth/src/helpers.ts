// @cavaridge/auth/helpers — Tenant hierarchy and role resolution
//
// Usage:
//   import { getTenantHierarchy, getUserRoleForTenant } from "@cavaridge/auth/helpers";
//   const chain = await getTenantHierarchy(db, tenantId);
//   const role = await getUserRoleForTenant(db, userId, tenantId);

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { tenants, tenantMemberships, profiles } from "./schema.js";
import type { Tenant, TenantMembership } from "./schema.js";
import type { Role } from "./index.js";

/**
 * Resolves the full parent chain for a tenant, from the given tenant
 * up to the Platform root. Returns an array ordered from the target
 * tenant (index 0) to the root (last index).
 *
 * Max depth: 10 (safety guard against circular references).
 */
export async function getTenantHierarchy(
  db: NodePgDatabase<any>,
  tenantId: string,
): Promise<Tenant[]> {
  const chain: Tenant[] = [];
  let currentId: string | null = tenantId;
  const maxDepth = 10;

  for (let i = 0; i < maxDepth && currentId; i++) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, currentId));

    if (!tenant) break;

    chain.push(tenant);
    currentId = tenant.parentId;
  }

  return chain;
}

/**
 * Returns the user's effective role for a given tenant.
 *
 * Resolution order:
 * 1. Direct membership in the target tenant (tenant_memberships table)
 * 2. Inherited role from a parent tenant (MSP Admin sees all child tenants)
 * 3. Platform Admin profile flag (sees everything)
 * 4. null if no access
 */
export async function getUserRoleForTenant(
  db: NodePgDatabase<any>,
  userId: string,
  tenantId: string,
): Promise<Role | null> {
  // Check if user is a Platform Admin via profile
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId));

  if (!profile) return null;

  if (profile.isPlatformUser || profile.role === "platform_admin") {
    return "platform_admin" as Role;
  }

  // Check direct membership in the target tenant
  const [directMembership] = await db
    .select()
    .from(tenantMemberships)
    .where(
      eq(tenantMemberships.userId, userId),
    );

  // Get all memberships for this user
  const memberships = await db
    .select()
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, userId));

  // Check direct membership first
  const direct = memberships.find(
    (m: TenantMembership) => m.tenantId === tenantId && m.isActive,
  );
  if (direct) return direct.role as Role;

  // Check inherited access — walk the target tenant's parent chain
  // and see if the user has a membership in any ancestor
  const hierarchy = await getTenantHierarchy(db, tenantId);

  for (const ancestorTenant of hierarchy.slice(1)) {
    const ancestorMembership = memberships.find(
      (m: TenantMembership) => m.tenantId === ancestorTenant.id && m.isActive,
    );
    if (ancestorMembership) {
      // MSP Admin/Tech in parent → inherits downward
      return ancestorMembership.role as Role;
    }
  }

  return null;
}

/**
 * Returns all tenant IDs that a user has access to, based on their
 * memberships and the tenant hierarchy (downward inheritance).
 */
export async function getAccessibleTenantIds(
  db: NodePgDatabase<any>,
  userId: string,
): Promise<string[]> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId));

  if (!profile) return [];

  // Platform Admin sees all tenants
  if (profile.isPlatformUser || profile.role === "platform_admin") {
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    return allTenants.map((t) => t.id);
  }

  // Get user's direct memberships
  const memberships = await db
    .select()
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, userId));

  const activeMemberships = memberships.filter((m: TenantMembership) => m.isActive);
  const accessibleIds = new Set<string>();

  for (const membership of activeMemberships) {
    accessibleIds.add(membership.tenantId);

    // For MSP-level roles, include all child tenants
    if (membership.role === "msp_admin" || membership.role === "msp_tech") {
      const children = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.parentId, membership.tenantId));

      for (const child of children) {
        accessibleIds.add(child.id);
        // Also get grandchildren (sites under clients)
        const grandchildren = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.parentId, child.id));
        for (const gc of grandchildren) {
          accessibleIds.add(gc.id);
        }
      }
    }
  }

  return Array.from(accessibleIds);
}
