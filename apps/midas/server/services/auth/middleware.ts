// Midas auth — thin wrapper around @cavaridge/auth
//
// Delegates to shared createAuthMiddleware. No local auth logic.

import {
  createAuthMiddleware,
  requireAuth as sharedRequireAuth,
  type AuthenticatedRequest,
} from "@cavaridge/auth/server";
import { db } from "../../db";
import { profiles, tenants } from "@cavaridge/auth/schema";

export type { AuthenticatedRequest };

// Middleware: loads user profile + tenant from Supabase JWT
export const loadUser = createAuthMiddleware(db, profiles, tenants);

export const requireAuth = sharedRequireAuth;
