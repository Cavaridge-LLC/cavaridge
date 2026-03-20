// @cavaridge/auth/guards — Express middleware guards for auth & RBAC
//
// Usage:
//   import { requireAuth, requirePlatformAdmin, requireRole, requireTenantAccess } from "@cavaridge/auth/guards";
//   app.get("/admin", requirePlatformAdmin, handler);
//   app.get("/data", requireAuth, requireMinRole("user"), handler);
//   app.get("/tenant/:tenantId/data", requireAuth, requireTenantAccess("tenantId"), handler);

import type { Response, NextFunction } from "express";
import { hasMinimumRole, isPlatformRole, type Role, ROLE_HIERARCHY } from "./index.js";
import type { AuthenticatedRequest } from "./server.js";

// Re-export existing guards from server.ts for convenience
export { requireAuth, requirePlatformRole } from "./server.js";

/**
 * Middleware factory: requires the user to have at least the specified role
 * in the RBAC hierarchy (platform_owner > platform_admin > tenant_admin > user > viewer).
 */
export function requireRole(role: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!hasMinimumRole(req.user.role as Role, role)) {
      return res.status(403).json({ message: "Insufficient role" });
    }
    next();
  };
}

/**
 * Shorthand for requireRole("platform_admin").
 * Allows both platform_admin and platform_owner.
 */
export function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!isPlatformRole(req.user.role)) {
    return res.status(403).json({ message: "Platform admin access required" });
  }
  next();
}

/**
 * Alias for requireRole — checks the role hierarchy.
 * requireMinRole("tenant_admin") allows tenant_admin, platform_admin, and platform_owner.
 */
export const requireMinRole = requireRole;

/**
 * Middleware factory: checks that the authenticated user belongs to
 * the tenant identified by a route parameter, or has parent access
 * (platform roles see all tenants).
 *
 * @param tenantIdParam - Name of the route parameter containing the tenant ID.
 *   Defaults to "tenantId". Falls back to req.body.tenantId if not in params.
 */
export function requireTenantAccess(tenantIdParam = "tenantId") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Platform roles have access to all tenants
    if (isPlatformRole(req.user.role)) {
      return next();
    }

    const targetTenantId =
      req.params[tenantIdParam] || req.body?.[tenantIdParam];

    if (!targetTenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // User must belong to the target tenant
    if (req.user.organizationId !== targetTenantId) {
      return res.status(403).json({ message: "Access denied to this tenant" });
    }

    next();
  };
}
