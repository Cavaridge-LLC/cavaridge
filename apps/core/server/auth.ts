// Core auth — thin wrapper around @cavaridge/auth/server
//
// CVG-CORE is the platform control plane. All routes require Platform Admin.
// We load the user via shared Supabase JWT middleware, then gate on platform role.

import {
  createAuthMiddleware,
  requireAuth as sharedRequireAuth,
  requirePlatformRole as sharedRequirePlatformRole,
  type AuthenticatedRequest,
} from "@cavaridge/auth/server";
import { getDb } from "./db";
import { profiles, tenants } from "@cavaridge/auth/schema";

export type { AuthenticatedRequest };
export { sharedRequireAuth as requireAuth };
export { sharedRequirePlatformRole as requirePlatformRole };

// Middleware: loads user profile + tenant from Supabase JWT (cookie or Bearer)
export function loadUser() {
  return createAuthMiddleware(getDb(), profiles, tenants);
}
