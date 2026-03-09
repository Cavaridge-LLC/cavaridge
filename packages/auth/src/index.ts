// @cavaridge/auth — Supabase auth, RBAC, tenant isolation
//
// Implements the 5-role RBAC taxonomy:
//   Platform Owner > Platform Admin > Tenant Admin > User > Viewer
//
// Usage in apps:
//   import { createAuthMiddleware, requireRole, getTenantContext } from "@cavaridge/auth/server";
//   import { useAuth, useRole, useTenant } from "@cavaridge/auth/client";
//
// TODO: Build out after first Supabase project is provisioned.

export const ROLES = {
  PLATFORM_OWNER: "platform_owner",
  PLATFORM_ADMIN: "platform_admin",
  TENANT_ADMIN: "tenant_admin",
  USER: "user",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Role[] = [
  ROLES.PLATFORM_OWNER,
  ROLES.PLATFORM_ADMIN,
  ROLES.TENANT_ADMIN,
  ROLES.USER,
  ROLES.VIEWER,
];

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) <= ROLE_HIERARCHY.indexOf(requiredRole);
}
