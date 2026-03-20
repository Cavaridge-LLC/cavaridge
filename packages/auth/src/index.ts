// @cavaridge/auth — Supabase Auth, RBAC, tenant isolation
//
// Implements the 5-role RBAC taxonomy:
//   Platform Owner > Platform Admin > Tenant Admin > User > Viewer
//
// Usage in apps:
//   import { ROLES, hasMinimumRole, isPlatformRole, SUPPORTED_PROVIDERS } from "@cavaridge/auth";
//   import { createSupabaseServerClient, requireAuth, createAuthMiddleware } from "@cavaridge/auth/server";
//   import { SupabaseAuthProvider, useAuth, useSupabase, useAuthProps } from "@cavaridge/auth/client";
//   import { profiles, organizations, tenants, invites, auditLog } from "@cavaridge/auth/schema";
//   import { registerAuthRoutes } from "@cavaridge/auth/routes";
//   import { signInWithEmail, signInWithGoogle, resetPassword } from "@cavaridge/auth/functions";
//   import { AUTH_PROVIDERS, SUPPORTED_PROVIDERS } from "@cavaridge/auth/providers";
//   import { requirePlatformAdmin, requireRole, requireTenantAccess } from "@cavaridge/auth/guards";

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

export function isPlatformRole(role: string): boolean {
  return role === ROLES.PLATFORM_OWNER || role === ROLES.PLATFORM_ADMIN;
}

// Re-export provider config for convenience
export { AUTH_PROVIDERS, SUPPORTED_PROVIDERS } from "./providers.js";
export type { AuthProviderEntry } from "./providers.js";
