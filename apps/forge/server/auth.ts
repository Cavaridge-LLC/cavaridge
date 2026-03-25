// Forge auth — thin wrapper around @cavaridge/auth/server
//
// Re-exports shared auth utilities configured with Forge's db + tables.

import type { Response, NextFunction } from "express";
import {
  createAuthMiddleware,
  createAuditLogger,
  requireAuth as sharedRequireAuth,
  requirePlatformRole as sharedRequirePlatformRole,
  type AuthenticatedRequest,
} from "@cavaridge/auth/server";
import { isPlatformRole } from "@cavaridge/auth";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { profiles, tenants } from "@shared/schema";
import { auditLog } from "@cavaridge/auth/schema";
import { hasPermission, type ForgePermission } from "./permissions";
import { forgeContent } from "@shared/schema";

export type { AuthenticatedRequest };
export { sharedRequireAuth as requireAuth };
export { sharedRequirePlatformRole as requirePlatformRole };

// Middleware: loads user profile + tenant from Supabase JWT
// Cast db to `any` to work around cross-package @types/pg version mismatch
// between forge's drizzle-orm resolution and @cavaridge/auth's resolution.
export const loadUser = createAuthMiddleware(db as any, profiles, tenants);

// Audit logger
export const logAudit = createAuditLogger(db, auditLog);

// Permission middleware (Forge-specific)
export function requirePermission(action: ForgePermission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!hasPermission(req.user.role, action)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

// Content access verification — ensures user's tenant owns the content piece
export async function requireContentAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const contentId = (req.params.id || req.params.contentId) as string;
  if (!contentId || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Platform roles can access any content
  if (isPlatformRole(req.user.role)) {
    return next();
  }

  if (!req.tenantId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const [content] = await db
    .select()
    .from(forgeContent)
    .where(and(eq(forgeContent.id, contentId), eq(forgeContent.tenantId, req.tenantId)));

  if (!content) {
    return res.status(404).json({ message: "Content not found" });
  }

  next();
}

/** @deprecated Use requireContentAccess */
export const requireProjectAccess = requireContentAccess;
