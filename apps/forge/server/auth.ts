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
import { forgeProjects } from "@shared/schema";

export type { AuthenticatedRequest };
export { sharedRequireAuth as requireAuth };
export { sharedRequirePlatformRole as requirePlatformRole };

// Middleware: loads user profile + tenant from Supabase JWT
export const loadUser = createAuthMiddleware(db, profiles, tenants);

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

// Project access verification — ensures user's tenant owns the project
export async function requireProjectAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const projectId = (req.params.projectId || req.params.id) as string;
  if (!projectId || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Platform roles can access any project
  if (isPlatformRole(req.user.role)) {
    return next();
  }

  if (!req.tenantId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const [project] = await db
    .select()
    .from(forgeProjects)
    .where(and(eq(forgeProjects.id, projectId), eq(forgeProjects.tenantId, req.tenantId)));

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  next();
}
