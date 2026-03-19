// Meridian auth — thin wrapper around @cavaridge/auth/server
//
// Re-exports shared auth utilities configured with Meridian's db + tables.
// Keeps Meridian-specific middleware: verifyDealAccess, requirePlatformOwner.

import type { Response, NextFunction } from "express";
import {
  createAuthMiddleware,
  createAuditLogger,
  requireAuth as sharedRequireAuth,
  requirePlatformRole as sharedRequirePlatformRole,
  type AuthenticatedRequest,
} from "@cavaridge/auth/server";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { profiles, tenants, auditLog, deals } from "@shared/schema";
import type { UserRole } from "@shared/schema";
import { isPlatformRole } from "@shared/schema";
import { hasPermission, hasAccessToDeal } from "./permissions";

// Re-export types and guards
export type { AuthenticatedRequest };
export { sharedRequireAuth as requireAuth };
export { sharedRequirePlatformRole as requirePlatformRole };

// Middleware: loads user profile + org from Supabase JWT
export const loadUser = createAuthMiddleware(db, profiles, tenants);

// Audit logger
export const logAudit = createAuditLogger(db, auditLog);

// Permission middleware (Meridian-specific — uses its own permission map)
export function requirePermissionMiddleware(action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!hasPermission(req.user, action as any)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

// Platform owner only
export function requirePlatformOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role !== "platform_owner") {
    return res.status(403).json({ message: "Platform owner access required" });
  }
  next();
}

// Deal access verification (Meridian-specific)
export async function verifyDealAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const dealId = req.params.id || req.params.dealId;
  if (!dealId || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (isPlatformRole(req.user.role)) {
    return next();
  }

  if (!req.orgId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const [deal] = await db.select().from(deals)
    .where(eq(deals.id, dealId));

  if (!deal || deal.tenantId !== req.orgId) {
    return res.status(404).json({ message: "Deal not found" });
  }

  const role = req.user.role as UserRole;
  const canAccess = await hasAccessToDeal(req.user.id, deal.id, role);
  if (!canAccess) {
    return res.status(403).json({ message: "Access denied to this deal" });
  }

  next();
}
