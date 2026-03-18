import type { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, requireAuth as sharedRequireAuth, type AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../../db";
import { profiles } from "@shared/models/auth";
import { eq } from "drizzle-orm";

export type { AuthenticatedRequest };

/**
 * Forge auth middleware — validates Supabase JWT and loads profile.
 * Tenant scoping is handled separately by the tenantScope middleware.
 */
export async function loadUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();

    if (!supabaseUser) return next();

    req.supabaseUser = { id: supabaseUser.id, email: supabaseUser.email };

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, supabaseUser.id));

    if (!profile || profile.status !== "active") return next();

    req.user = profile;
  } catch (err) {
    console.error("Auth middleware error:", err);
  }

  next();
}

export const requireAuth = sharedRequireAuth;
