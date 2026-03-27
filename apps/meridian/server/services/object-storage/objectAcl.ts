/**
 * Object ACL — Simplified for Supabase Storage
 *
 * With Supabase Storage, ACL is enforced via:
 * 1. RLS policies on storage.objects table
 * 2. Tenant-scoped paths (tenantId/uploads/...)
 * 3. Signed URLs for time-limited access
 *
 * This module provides backward-compatible types and helpers
 * for consuming code that references ACL constructs.
 */

export enum ObjectPermission {
  READ = 'read',
  WRITE = 'write',
}

export enum ObjectAccessGroupType {
  TENANT = 'tenant',
  USER = 'user',
}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: 'public' | 'private';
  tenantId?: string;
  aclRules?: ObjectAclRule[];
}

/**
 * Check if a user can access an object based on tenant path isolation.
 * In the Supabase model, access is controlled by:
 *   1. The object path starting with the user's tenantId
 *   2. RLS policies on the storage bucket
 *   3. Signed URLs for time-limited sharing
 */
export function canAccessObject({
  userId,
  tenantId,
  objectPath,
  requestedPermission,
}: {
  userId?: string;
  tenantId: string;
  objectPath: string;
  requestedPermission: ObjectPermission;
}): boolean {
  // Public bucket objects are always readable
  if (objectPath.startsWith('/public/') && requestedPermission === ObjectPermission.READ) {
    return true;
  }

  // Private objects require tenant path match
  const cleanPath = objectPath.replace(/^\/objects\//, '');
  return cleanPath.startsWith(`${tenantId}/`);
}
