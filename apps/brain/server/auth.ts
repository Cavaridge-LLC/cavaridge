// Brain auth — thin wrapper around @cavaridge/auth/server
//
// Re-exports shared auth utilities configured with Brain's db + tables.

import type { Response, NextFunction } from "express";
import {
  createAuthMiddleware,
  requireAuth as sharedRequireAuth,
  requirePlatformRole as sharedRequirePlatformRole,
  type AuthenticatedRequest,
} from "@cavaridge/auth/server";
import { db } from "./db.js";
import { profiles, tenants } from "@cavaridge/auth/schema";
import { hasPermission, type BrainPermission } from "./permissions.js";

export type { AuthenticatedRequest };
export { sharedRequireAuth as requireAuth };
export { sharedRequirePlatformRole as requirePlatformRole };

// Middleware: loads user profile + tenant from Supabase JWT
export const loadUser = createAuthMiddleware(db, profiles, tenants);

// Permission middleware (Brain-specific)
export function requirePermission(action: BrainPermission) {
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
