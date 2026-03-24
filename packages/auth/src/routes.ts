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
  extractBearerToken,
  type AuthenticatedRequest,
  type SupabaseConfig,
} from "./server.js";

export interface AuthRoutesConfig {
  db: NodePgDatabase<any>;
  profilesTable: any;
  tenantsTable: any;
  auditLogTable?: any;
  supabase?: Partial<SupabaseConfig>;
  /** Default role for new users. Default: "client_viewer" */
  defaultRole?: string;
  /** Default plan tier for new orgs. Default: "starter" */
  defaultPlanTier?: string;
  /** Max users for new orgs. Default: 5 */
  defaultMaxUsers?: number;
  /**
   * Whether to auto-create a tenant for new users on registration.
   * Default: true (backward compatible).
   * Set to false for new apps that use the onboarding flow.
   */
  autoCreateTenant?: boolean;
}

export function registerAuthRoutes(app: Express, config: AuthRoutesConfig) {
  const {
    db,
    profilesTable,
    tenantsTable,
    auditLogTable,
    defaultRole = "client_viewer",
    defaultPlanTier = "starter",
    defaultMaxUsers = 5,
    autoCreateTenant = true,
  } = config;

  // ---------- POST /api/auth/setup-profile ----------
  app.post("/api/auth/setup-profile", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const supabase = createSupabaseServerClient(req, res, config.supabase);

      const bearerToken = extractBearerToken(req);
      const { data: { user: supabaseUser } } = bearerToken
        ? await supabase.auth.getUser(bearerToken)
        : await supabase.auth.getUser();

      if (!supabaseUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if profile already exists — by auth ID first
      const [existingById] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, supabaseUser.id));

      if (existingById) {
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

        const tenantId = existingById.tenantId || existingById.organizationId;
        const [tenant] = tenantId
          ? await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId))
          : [null];
        return res.json({ profile: existingById, tenant, organization: tenant });
      }

      // Check for existing profile by email (identity linking)
      if (supabaseUser.email) {
        const [existingByEmail] = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.email, supabaseUser.email));

        if (existingByEmail) {
          const identityData = supabaseUser.identities?.[0]?.identity_data;
          const updates: Record<string, any> = { updatedAt: new Date() };
          if (identityData?.avatar_url) updates.avatarUrl = identityData.avatar_url;
          if (identityData?.full_name) updates.displayName = identityData.full_name;

          await db.update(profilesTable).set(updates).where(eq(profilesTable.id, existingByEmail.id));

          const tenantId = existingByEmail.tenantId || existingByEmail.organizationId;
          const [tenant] = tenantId
            ? await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId))
            : [null];
          return res.json({ profile: existingByEmail, tenant, organization: tenant });
        }
      }

      // ---- New user — create profile ----

      const { name, organizationName } = req.body || {};

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

      let newTenantId: string | null = null;
      let tenant: any = null;

      if (autoCreateTenant) {
        const slug = (organizationName || displayName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const tenantResults = await db
          .insert(tenantsTable)
          .values({
            name: organizationName || `${displayName}'s Organization`,
            slug,
            type: "msp",
            planTier: defaultPlanTier,
            maxUsers: defaultMaxUsers,
            isActive: true,
          })
          .returning() as any[];

        tenant = tenantResults[0];

        newTenantId = tenant.id;
      }

      // Create profile
      const profileRole = autoCreateTenant ? defaultRole : "prospect";
      const profileValues: Record<string, any> = {
        id: supabaseUser.id,
        email,
        displayName,
        avatarUrl,
        role: profileRole,
        isPlatformUser: false,
        status: "active",
      };

      // Support both tenantId and organizationId columns
      if (profilesTable.tenantId) {
        profileValues.tenantId = newTenantId;
      }
      if (profilesTable.organizationId) {
        profileValues.organizationId = newTenantId;
      }

      const profileResults = await db
        .insert(profilesTable)
        .values(profileValues)
        .returning() as any[];

      const profile = profileResults[0];

      // Set tenant owner
      if (tenant) {
        await db
          .update(tenantsTable)
          .set({ ownerUserId: profile.id })
          .where(eq(tenantsTable.id, tenant.id));
      }

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: newTenantId || "",
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

      res.status(201).json({ profile, tenant, organization: tenant });
    } catch (error: any) {
      console.error("Setup profile error:", error);
      res.status(500).json({ message: "Failed to set up profile" });
    }
  });

  // ---------- GET /api/auth/me ----------
  app.get("/api/auth/me", (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    res.json({
      profile: req.user,
      tenant: req.tenant || null,
      organization: req.tenant || null,
    });
  });

  // ---------- GET /api/auth/callback ----------
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

    res.redirect("/");
  });

  // ---------- POST /api/auth/logout ----------
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const supabase = createSupabaseServerClient(req, res, config.supabase);

      const bearerToken = extractBearerToken(req);
      if (bearerToken) {
        await supabase.auth.setSession({
          access_token: bearerToken,
          refresh_token: "",
        });
      }

      await supabase.auth.signOut();
      res.json({ message: "Logged out" });
    } catch (error) {
      console.error("Logout error:", error);
      res.json({ message: "Logged out" });
    }
  });
}
