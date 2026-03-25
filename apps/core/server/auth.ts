// Core auth — thin wrapper around @cavaridge/auth/server
//
// CVG-CORE is the platform control plane. All routes require Platform Admin.
// We load the user via shared Supabase JWT middleware, then gate on platform role.

import type { Request, Response, NextFunction } from "express";
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

// Lazy-initialized auth middleware — defers DB connection to first request
let _loadUser: ((req: Request, res: Response, next: NextFunction) => void) | null = null;

export function loadUser(req: Request, res: Response, next: NextFunction): void {
  if (!_loadUser) {
    _loadUser = createAuthMiddleware(getDb(), profiles, tenants);
  }
  _loadUser(req, res, next);
}
