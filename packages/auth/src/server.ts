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
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { isPlatformRole, isMspRole } from "./index.js";
import type { Profile, Tenant } from "./schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthenticatedRequest extends Request {
  user?: Profile;
  /** The loaded tenant record */
  tenant?: Tenant;
  /** The authenticated user's tenant UUID */
  tenantId?: string;
  /** List of tenant IDs the user can access (populated by auth middleware) */
  accessibleTenantIds?: string[];
  supabaseUser?: { id: string; email?: string };
  /** @deprecated Use `tenant` */
  org?: Tenant;
  /** @deprecated Use `tenantId` */
  orgId?: string;
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
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
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
 * Extracts a Bearer token from the Authorization header, if present.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Creates a Supabase admin client using the service-role key.
 * Use this for server-only operations that bypass RLS.
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
 * and tenant from the database. Also resolves accessible tenant IDs for
 * MSP-level users (downward inheritance).
 */
export function createAuthMiddleware(
  db: NodePgDatabase<any>,
  profilesTable: any,
  tenantsTable: any,
  config?: Partial<SupabaseConfig>,
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createSupabaseServerClient(req, res, config);

      const bearerToken = extractBearerToken(req);
      const { data: { user: supabaseUser } } = bearerToken
        ? await supabase.auth.getUser(bearerToken)
        : await supabase.auth.getUser();

      if (!supabaseUser) {
        return next();
      }

      req.supabaseUser = { id: supabaseUser.id, email: supabaseUser.email };

      // Look up profile
      const profileResults = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, supabaseUser.id));

      const profile = profileResults[0] as Profile | undefined;

      if (!profile || profile.status !== "active") {
        return next();
      }

      req.user = profile;

      // Load tenant record
      // Use tenantId if available, fall back to organizationId for backward compat
      const userTenantId = (profile as any).tenantId || (profile as any).organizationId;
      if (userTenantId) {
        const tenantResults = await db
          .select()
          .from(tenantsTable)
          .where(eq(tenantsTable.id, userTenantId));

        const tenant = tenantResults[0] as Tenant | undefined;

        if (tenant) {
          req.tenant = tenant;
          req.tenantId = tenant.id;
          // Backward compat
          req.org = tenant;
          req.orgId = tenant.id;
        }
      }

      // For MSP roles, resolve child tenant IDs for access checks
      if (req.tenantId && isMspRole(profile.role)) {
        const children = await db
          .select({ id: tenantsTable.id })
          .from(tenantsTable)
          .where(eq(tenantsTable.parentId, req.tenantId));

        const childIds = children.map((c: { id: string }) => c.id);
        const grandchildIds: string[] = [];

        for (const childId of childIds) {
          const grandchildren = await db
            .select({ id: tenantsTable.id })
            .from(tenantsTable)
            .where(eq(tenantsTable.parentId, childId));
          grandchildIds.push(...grandchildren.map((gc: { id: string }) => gc.id));
        }

        req.accessibleTenantIds = [req.tenantId, ...childIds, ...grandchildIds];
      } else if (req.tenantId) {
        req.accessibleTenantIds = [req.tenantId];
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

/** Returns 403 if user is not Platform Admin */
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
