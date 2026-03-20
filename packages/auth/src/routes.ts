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
  /**
   * Whether to auto-create a tenant for new users on registration.
   * Default: true (backward compatible).
   * Set to false for new apps that use the onboarding flow
   * (invite acceptance, tenant request, or MSP registration).
   */
  autoCreateTenant?: boolean;
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
    autoCreateTenant = true,
  } = config;

  // ---------- POST /api/auth/setup-profile ----------
  // Called by the client after supabase.auth.signUp() or after OAuth sign-in
  // to create the profile row (+ optionally organization) in our custom tables.
  app.post("/api/auth/setup-profile", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const supabase = createSupabaseServerClient(req, res, config.supabase);
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();

      if (!supabaseUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if profile already exists — by auth ID first
      const [existingById] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, supabaseUser.id));

      if (existingById) {
        // Profile already set up — update with latest provider metadata if available
        const identityData = supabaseUser.identities?.[0]?.identity_data;
        if (identityData) {
          const updates: Record<string, any> = {};
          if (identityData.full_name && identityData.full_name !== existingById.displayName) {
            updates.displayName = identityData.full_name;
          }
          if (identityData.avatar_url && identityData.avatar_url !== existingById.avatarUrl) {
            updates.avatarUrl = identityData.avatar_url;
          }
          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db.update(profilesTable).set(updates).where(eq(profilesTable.id, existingById.id));
          }
        }

        const [org] = existingById.organizationId
          ? await db.select().from(orgsTable).where(eq(orgsTable.id, existingById.organizationId))
          : [null];
        return res.json({ profile: existingById, organization: org });
      }

      // Check for existing profile by email (identity linking scenario —
      // e.g., user registered with email/password, then signs in with OAuth using same email)
      if (supabaseUser.email) {
        const [existingByEmail] = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.email, supabaseUser.email));

        if (existingByEmail) {
          // Do NOT create a duplicate — update the existing profile with latest metadata
          const identityData = supabaseUser.identities?.[0]?.identity_data;
          const updates: Record<string, any> = { updatedAt: new Date() };
          if (identityData?.avatar_url) updates.avatarUrl = identityData.avatar_url;
          if (identityData?.full_name) updates.displayName = identityData.full_name;

          await db.update(profilesTable).set(updates).where(eq(profilesTable.id, existingByEmail.id));

          const [org] = existingByEmail.organizationId
            ? await db.select().from(orgsTable).where(eq(orgsTable.id, existingByEmail.organizationId))
            : [null];
          return res.json({ profile: existingByEmail, organization: org });
        }
      }

      // ---- New user — create profile ----

      const { name, organizationName } = req.body || {};

      // Extract display name from: request body > provider metadata > Supabase user metadata > email
      const identityData = supabaseUser.identities?.[0]?.identity_data;
      const displayName =
        name ||
        identityData?.full_name ||
        supabaseUser.user_metadata?.display_name ||
        supabaseUser.email ||
        "User";
      const email = supabaseUser.email || "";
      const avatarUrl =
        identityData?.avatar_url ||
        supabaseUser.user_metadata?.avatar_url ||
        null;

      let orgId: string | null = null;
      let org: any = null;

      if (autoCreateTenant) {
        // Create organization (legacy behavior for backward compatibility)
        const slug = (organizationName || displayName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        [org] = await db
          .insert(orgsTable)
          .values({
            name: organizationName || `${displayName}'s Organization`,
            slug,
            planTier: defaultPlanTier,
            maxUsers: defaultMaxUsers,
            isActive: true,
          })
          .returning();

        orgId = org.id;
      }

      // Create profile — when autoCreateTenant is false, new user gets viewer role
      // and no tenant assignment (pending onboarding)
      const profileRole = autoCreateTenant ? defaultRole : "viewer";
      const [profile] = await db
        .insert(profilesTable)
        .values({
          id: supabaseUser.id,
          email,
          displayName,
          avatarUrl,
          role: profileRole,
          organizationId: orgId,
          isPlatformUser: false,
          status: "active",
        })
        .returning();

      // Set org owner (only if we created an org)
      if (org) {
        await db
          .update(orgsTable)
          .set({ ownerUserId: profile.id })
          .where(eq(orgsTable.id, org.id));
      }

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: orgId,
            userId: profile.id,
            action: "register",
            resourceType: "user",
            resourceId: profile.id,
            details: { email, authProvider: supabaseUser.app_metadata?.provider || "email" },
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
      organization: req.tenant || req.org || null,
      tenant: req.tenant || req.org || null,
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
