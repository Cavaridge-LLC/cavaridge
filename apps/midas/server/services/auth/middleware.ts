import type { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, extractBearerToken, requireAuth as sharedRequireAuth, type AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../../db";
import { profiles } from "@shared/models/auth";
import { eq } from "drizzle-orm";

export type { AuthenticatedRequest };

/**
 * Midas auth middleware — validates Supabase JWT and loads profile.
 * Tries Bearer token first (for OAuth callback flows where cookies
 * may not be set yet), falls back to cookie-based auth.
 */
export async function loadUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const supabase = createSupabaseServerClient(req, res);

    // Try Bearer token first, fall back to cookies
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
  } catch (err) {
    console.error("Auth middleware error:", err);
  }

  next();
}

export const requireAuth = sharedRequireAuth;
