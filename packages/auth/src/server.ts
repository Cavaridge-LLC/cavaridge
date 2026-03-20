// @cavaridge/auth/server — Server-side Supabase auth utilities for Express
//
// Creates Supabase clients that read/write auth cookies from Express requests.
// Provides middleware for loading user profiles, enforcing auth, and RBAC.

import type { Request, Response, NextFunction } from "express";
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { isPlatformRole } from "./index.js";
import type { Profile, Tenant } from "./schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthenticatedRequest extends Request {
  user?: Profile;
  /** @deprecated Use `tenant` */
  org?: Tenant;
  /** The loaded tenant record */
  tenant?: Tenant;
  /** @deprecated Use `tenantId` */
  orgId?: string;
  /** The authenticated user's tenant UUID */
  tenantId?: string;
  supabaseUser?: { id: string; email?: string };
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
}

// ---------------------------------------------------------------------------
// Supabase client factories
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase server client scoped to the current request.
 * Reads auth cookies from the Express request and writes Set-Cookie headers
 * on the response when tokens are refreshed.
 */
export function createSupabaseServerClient(
  req: Request,
  res: Response,
  config?: Partial<SupabaseConfig>,
) {
  const url = config?.supabaseUrl || process.env.SUPABASE_URL;
  const key = config?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(req.headers.cookie ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.appendHeader(
            "Set-Cookie",
            serializeCookieHeader(name, value, {
              ...options,
              path: "/",
              sameSite: "lax",
            }),
          ),
        );
      },
    },
  });
}

/**
 * Creates a Supabase admin client using the service-role key.
 * Use this for server-only operations that bypass RLS (e.g., creating profiles on sign-up).
 */
export function createSupabaseAdminClient(config?: Partial<SupabaseConfig>) {
  const url = config?.supabaseUrl || process.env.SUPABASE_URL;
  const key = config?.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/**
 * Creates Express middleware that loads the authenticated user's profile
 * and organization from the database.
 *
 * Uses Supabase's `auth.getUser()` to validate the JWT, then looks up
 * the profile and org from the app's Drizzle tables.
 */
export function createAuthMiddleware(
  db: NodePgDatabase<any>,
  profilesTable: any,
  orgsTable: any,
  config?: Partial<SupabaseConfig>,
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createSupabaseServerClient(req, res, config);
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();

      if (!supabaseUser) {
        return next();
      }

      req.supabaseUser = { id: supabaseUser.id, email: supabaseUser.email };

      // Look up profile
      const [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, supabaseUser.id));

      if (!profile || profile.status !== "active") {
        return next();
      }

      req.user = profile;

      // Load tenant (org)
      if (isPlatformRole(profile.role) && profile.organizationId) {
        const [org] = await db
          .select()
          .from(orgsTable)
          .where(eq(orgsTable.id, profile.organizationId));
        if (org) {
          req.org = org;
          req.orgId = org.id;
          req.tenant = org;
          req.tenantId = org.id;
        }
      } else if (profile.organizationId) {
        const [org] = await db
          .select()
          .from(orgsTable)
          .where(and(eq(orgsTable.id, profile.organizationId), eq(orgsTable.isActive, true)));
        if (org) {
          req.org = org;
          req.orgId = org.id;
          req.tenant = org;
          req.tenantId = org.id;
        }
      }
    } catch (err) {
      console.error("Auth middleware error:", err);
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Guard middleware
// ---------------------------------------------------------------------------

/** Returns 401 if no authenticated user */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

/** Returns 403 if user is not platform_owner or platform_admin */
export function requirePlatformRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!isPlatformRole(req.user.role)) {
    return res.status(403).json({ message: "Platform access required" });
  }
  next();
}

/**
 * Factory that creates permission-checking middleware.
 * Pass your app's role→permissions map, get back a middleware factory.
 *
 * Usage:
 *   const checkPerm = createPermissionMiddleware(ROLE_PERMISSIONS);
 *   app.get("/admin", checkPerm("manage_org_settings"), handler);
 */
export function createPermissionMiddleware<P extends string>(
  rolePermissions: Record<string, Set<P>>,
) {
  return (action: P) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const perms = rolePermissions[req.user.role];
      if (!perms || !perms.has(action)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    };
  };
}

// ---------------------------------------------------------------------------
// Audit logging — canonical implementation in @cavaridge/audit
// ---------------------------------------------------------------------------

export { createLegacyAuditLogger as createAuditLogger } from "@cavaridge/audit/logger";
export { createAuditLogger as createStructuredAuditLogger } from "@cavaridge/audit/logger";

// ---------------------------------------------------------------------------
// Guards — re-export from guards.ts for convenience
// ---------------------------------------------------------------------------

export {
  requirePlatformAdmin,
  requireRole,
  requireMinRole,
  requireTenantAccess,
} from "./guards.js";
