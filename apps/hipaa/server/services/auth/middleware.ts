import type { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, extractBearerToken, requireAuth as sharedRequireAuth, type AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../../db";
import { profiles, tenants } from "@shared/models/auth";
import { eq, and } from "drizzle-orm";
import { isPlatformRole } from "@cavaridge/auth";

export type { AuthenticatedRequest };

/**
 * HIPAA auth middleware — validates Supabase JWT and loads profile.
 * Tenant scoping is handled separately by the tenantScope middleware.
 */
export async function loadUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const bearerToken = extractBearerToken(req);
    const { data: { user: supabaseUser } } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (!supabaseUser) return next();

    req.supabaseUser = { id: supabaseUser.id, email: supabaseUser.email };

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, supabaseUser.id));

    if (!profile || profile.status !== "active") return next();

    req.user = profile;
    // Load tenant record from the database
    if (profile.organizationId) {
      req.tenantId = profile.organizationId;

      // Platform roles see tenants regardless of isActive status
      const [tenant] = isPlatformRole(profile.role)
        ? await db.select().from(tenants).where(eq(tenants.id, profile.organizationId))
        : await db.select().from(tenants).where(
            and(eq(tenants.id, profile.organizationId), eq(tenants.isActive, true))
          );

      if (tenant) {
        req.org = tenant;
        req.tenant = tenant;
        req.orgId = tenant.id;
      }
    }
  } catch (err) {
    console.error("Auth middleware error:", err);
  }

  next();
}

export const requireAuth = sharedRequireAuth;
