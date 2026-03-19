// Ducky auth — thin wrapper around @cavaridge/auth/server
//
// Re-exports shared auth utilities configured with Ducky's db + tables.

import {
  createAuthMiddleware,
  createAuditLogger,
  createPermissionMiddleware,
  requireAuth as sharedRequireAuth,
  requirePlatformRole as sharedRequirePlatformRole,
  type AuthenticatedRequest,
} from "@cavaridge/auth/server";
import { db } from "./db";
import { profiles, organizations, auditLog } from "@cavaridge/auth/schema";
import { ROLE_PERMISSIONS, type Permission } from "./permissions";

// Re-export types and guards for use by route files
export type { AuthenticatedRequest };
export { sharedRequireAuth as requireAuth };
export { sharedRequirePlatformRole as requirePlatformRole };

// Middleware: loads user profile + org from Supabase JWT
export const loadUser = createAuthMiddleware(db, profiles, organizations);

// Permission middleware factory
export const requirePermissionMiddleware = createPermissionMiddleware<Permission>(ROLE_PERMISSIONS);

// Audit logger
export const logAudit = createAuditLogger(db, auditLog);
