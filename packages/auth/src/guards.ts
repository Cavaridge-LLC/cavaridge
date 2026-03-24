// @cavaridge/auth/guards — Express middleware guards for auth & RBAC
//
// Usage:
//   import { requireAuth, requireRole, requireTenant } from "@cavaridge/auth/guards";
//   app.get("/admin", requireRole("platform_admin"), handler);
//   app.get("/data", requireAuth, requireRole("msp_tech"), handler);
//   app.get("/tenant/:tenantId/data", requireAuth, requireTenant("tenantId"), handler);

import type { Response, NextFunction } from "express";
import { hasMinimumRole, isPlatformRole, isMspRole, type Role } from "./index.js";
import type { AuthenticatedRequest } from "./server.js";

// Re-export requireAuth from server.ts
export { requireAuth } from "./server.js";

/**
 * Middleware factory: requires the user to have at least the specified role
 * in the RBAC hierarchy.
 *
 * platform_admin > msp_admin > msp_tech > client_admin > client_viewer > prospect
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
 * Middleware: requires Platform Admin role.
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
 * Middleware factory: checks that the authenticated user belongs to
 * the tenant identified by a route parameter, or has hierarchical access
 * (platform roles see all tenants, MSP roles see their children).
 *
 * @param tenantIdParam - Name of the route parameter containing the tenant ID.
 *   Defaults to "tenantId". Falls back to req.body.tenantId if not in params.
 */
export function requireTenant(tenantIdParam = "tenantId") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Platform Admin has access to all tenants
    if (isPlatformRole(req.user.role)) {
      return next();
    }

    const targetTenantId =
      req.params[tenantIdParam] || req.body?.[tenantIdParam];

    if (!targetTenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // Direct tenant match
    if (req.user.tenantId === targetTenantId) {
      return next();
    }

    // MSP roles can access child tenants — check if the target is in
    // the user's accessible tenant list (populated by auth middleware)
    if (isMspRole(req.user.role) && req.accessibleTenantIds?.includes(targetTenantId)) {
      return next();
    }

    return res.status(403).json({ message: "Access denied to this tenant" });
  };
}

/**
 * Alias for requireTenant — backward compatibility.
 * @deprecated Use requireTenant
 */
export const requireTenantAccess = requireTenant;
