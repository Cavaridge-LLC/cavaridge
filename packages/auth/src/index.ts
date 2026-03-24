// @cavaridge/auth — Supabase Auth, RBAC, tenant isolation
//
// Implements the Universal Tenant Model (UTM) 6-role RBAC taxonomy:
//   Platform Admin > MSP Admin > MSP Tech > Client Admin > Client Viewer > Prospect
//
// 4-tier tenant hierarchy (self-referencing):
//   Platform → MSP → Client → Site/Prospect
//
// Usage in apps:
//   import { ROLES, Role, TenantType, hasMinimumRole } from "@cavaridge/auth";
//   import { requireAuth, requireRole, requireTenant } from "@cavaridge/auth/middleware";
//   import { getTenantHierarchy, getUserRoleForTenant } from "@cavaridge/auth/helpers";
//   import { tenants, profiles, tenantMemberships } from "@cavaridge/auth/schema";

// ---------------------------------------------------------------------------
// Tenant types
// ---------------------------------------------------------------------------

export const TENANT_TYPES = {
  PLATFORM: "platform",
  MSP: "msp",
  CLIENT: "client",
  SITE: "site",
  PROSPECT: "prospect",
} as const;

export type TenantType = (typeof TENANT_TYPES)[keyof typeof TENANT_TYPES];

export const TENANT_TYPE_HIERARCHY: TenantType[] = [
  TENANT_TYPES.PLATFORM,
  TENANT_TYPES.MSP,
  TENANT_TYPES.CLIENT,
  TENANT_TYPES.SITE,
];

// ---------------------------------------------------------------------------
// RBAC — 6 Standard Roles (UTM spec)
// ---------------------------------------------------------------------------

export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  MSP_ADMIN: "msp_admin",
  MSP_TECH: "msp_tech",
  CLIENT_ADMIN: "client_admin",
  CLIENT_VIEWER: "client_viewer",
  PROSPECT: "prospect",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Role hierarchy from most to least privileged.
 * Index 0 = highest privilege.
 */
export const ROLE_HIERARCHY: Role[] = [
  ROLES.PLATFORM_ADMIN,
  ROLES.MSP_ADMIN,
  ROLES.MSP_TECH,
  ROLES.CLIENT_ADMIN,
  ROLES.CLIENT_VIEWER,
  ROLES.PROSPECT,
];

/**
 * Returns true if `userRole` is at least as privileged as `requiredRole`
 * in the RBAC hierarchy.
 */
export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) <= ROLE_HIERARCHY.indexOf(requiredRole);
}

/** Returns true if the role is Platform Admin. */
export function isPlatformRole(role: string): boolean {
  return role === ROLES.PLATFORM_ADMIN;
}

/** Returns true if the role is an MSP-level role (MSP Admin or MSP Tech). */
export function isMspRole(role: string): boolean {
  return role === ROLES.MSP_ADMIN || role === ROLES.MSP_TECH;
}

/** Returns true if the role is a client-level role (Client Admin or Client Viewer). */
export function isClientRole(role: string): boolean {
  return role === ROLES.CLIENT_ADMIN || role === ROLES.CLIENT_VIEWER;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // Tenant management
  MANAGE_TENANTS: "manage_tenants",
  VIEW_TENANTS: "view_tenants",
  // User management
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",
  // Billing
  MANAGE_BILLING: "manage_billing",
  VIEW_BILLING: "view_billing",
  // Data
  MANAGE_DATA: "manage_data",
  VIEW_DATA: "view_data",
  // Reports
  GENERATE_REPORTS: "generate_reports",
  VIEW_REPORTS: "view_reports",
  // Settings
  MANAGE_SETTINGS: "manage_settings",
  VIEW_SETTINGS: "view_settings",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permission sets per role. Apps can extend with app-specific permissions.
 */
export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  [ROLES.PLATFORM_ADMIN]: new Set(Object.values(PERMISSIONS) as Permission[]),
  [ROLES.MSP_ADMIN]: new Set([
    PERMISSIONS.MANAGE_TENANTS,
    PERMISSIONS.VIEW_TENANTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_BILLING,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.MANAGE_DATA,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_SETTINGS,
  ]),
  [ROLES.MSP_TECH]: new Set([
    PERMISSIONS.VIEW_TENANTS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_DATA,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_SETTINGS,
  ]),
  [ROLES.CLIENT_ADMIN]: new Set([
    PERMISSIONS.VIEW_TENANTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_SETTINGS,
  ]),
  [ROLES.CLIENT_VIEWER]: new Set([
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.VIEW_REPORTS,
  ]),
  [ROLES.PROSPECT]: new Set([
    PERMISSIONS.VIEW_DATA,
  ]),
};

// Re-export provider config for convenience
export { AUTH_PROVIDERS, SUPPORTED_PROVIDERS } from "./providers.js";
export type { AuthProviderEntry } from "./providers.js";
