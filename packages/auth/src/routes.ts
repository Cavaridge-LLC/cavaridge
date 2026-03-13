// @cavaridge/auth/routes — Server-side auth route helpers
//
// Factory function that registers auth-related Express routes.
// Each app calls this once with its db + tables to set up:
//   POST /api/auth/setup-profile — create profile + org after sign-up
//   GET  /api/auth/me            — return current profile + org
//   GET  /api/auth/callback      — handle OAuth redirect from Supabase
//   POST /api/auth/logout        — server-side sign out

import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  createSupabaseServerClient,
  type AuthenticatedRequest,
  type SupabaseConfig,
} from "./server.js";

export interface AuthRoutesConfig {
  db: NodePgDatabase<any>;
  profilesTable: any;
  orgsTable: any;
  auditLogTable?: any;
  supabase?: Partial<SupabaseConfig>;
  /** Default role for new users. Default: "tenant_admin" */
  defaultRole?: string;
  /** Default plan tier for new orgs. Default: "starter" */
  defaultPlanTier?: string;
  /** Max users for new orgs. Default: 5 */
  defaultMaxUsers?: number;
}

export function registerAuthRoutes(app: Express, config: AuthRoutesConfig) {
  const {
    db,
    profilesTable,
    orgsTable,
    auditLogTable,
    defaultRole = "tenant_admin",
    defaultPlanTier = "starter",
    defaultMaxUsers = 5,
  } = config;

  // ---------- POST /api/auth/setup-profile ----------
  // Called by the client after supabase.auth.signUp() to create
  // the profile row + organization in our custom tables.
  app.post("/api/auth/setup-profile", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const supabase = createSupabaseServerClient(req, res, config.supabase);
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();

      if (!supabaseUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if profile already exists
      const [existing] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, supabaseUser.id));

      if (existing) {
        // Profile already set up — just return it
        const [org] = existing.organizationId
          ? await db.select().from(orgsTable).where(eq(orgsTable.id, existing.organizationId))
          : [null];
        return res.json({ profile: existing, organization: org });
      }

      const { name, organizationName } = req.body || {};
      const displayName = name || supabaseUser.user_metadata?.display_name || supabaseUser.email || "User";
      const email = supabaseUser.email || "";

      // Create organization
      const slug = (organizationName || displayName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const [org] = await db
        .insert(orgsTable)
        .values({
          name: organizationName || `${displayName}'s Organization`,
          slug,
          planTier: defaultPlanTier,
          maxUsers: defaultMaxUsers,
          isActive: true,
        })
        .returning();

      // Create profile
      const [profile] = await db
        .insert(profilesTable)
        .values({
          id: supabaseUser.id,
          email,
          displayName,
          avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
          role: defaultRole,
          organizationId: org.id,
          isPlatformUser: false,
          status: "active",
        })
        .returning();

      // Set org owner
      await db
        .update(orgsTable)
        .set({ ownerUserId: profile.id })
        .where(eq(orgsTable.id, org.id));

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: org.id,
            userId: profile.id,
            action: "register",
            resourceType: "user",
            resourceId: profile.id,
            details: { email },
            ipAddress: req.ip || null,
          });
        } catch {
          // Non-critical
        }
      }

      res.status(201).json({ profile, organization: org });
    } catch (error: any) {
      console.error("Setup profile error:", error);
      res.status(500).json({ message: "Failed to set up profile" });
    }
  });

  // ---------- GET /api/auth/me ----------
  // Returns the current authenticated user's profile + organization.
  // Relies on the auth middleware having already loaded req.user + req.org.
  app.get("/api/auth/me", (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    res.json({
      profile: req.user,
      organization: req.org || null,
    });
  });

  // ---------- GET /api/auth/callback ----------
  // Handles the OAuth redirect from Supabase. Exchanges the auth code
  // for a session, then redirects to the app root.
  app.get("/api/auth/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;

    if (code) {
      try {
        const supabase = createSupabaseServerClient(req, res, config.supabase);
        await supabase.auth.exchangeCodeForSession(code);
      } catch (error) {
        console.error("OAuth callback error:", error);
      }
    }

    // Redirect to app root — the client will pick up the session from cookies
    res.redirect("/");
  });

  // ---------- POST /api/auth/logout ----------
  // Server-side sign out — clears the Supabase session cookies.
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const supabase = createSupabaseServerClient(req, res, config.supabase);
      await supabase.auth.signOut();
      res.json({ message: "Logged out" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });
}
