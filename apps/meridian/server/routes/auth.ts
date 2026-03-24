// Meridian auth routes — shared Supabase auth + Meridian-specific invitation system

import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import {
  storage, tenants, eq, db,
  requireAuth, logAudit,
  checkPlanLimit, PLAN_LIMITS,
  crypto, createSupabaseAdminClient,
  type AuthenticatedRequest, type PlanTier,
} from "./_helpers";
import { profiles, auditLog } from "@shared/schema";
import { emailService } from "../email";
import { requirePermissionMiddleware } from "../auth";

export function registerAuthRoutes(app: Express) {
  // ── Shared Supabase auth routes ──────────────────────────────────────
  // Registers: POST /api/auth/setup-profile, GET /api/auth/me,
  //            GET /api/auth/callback, POST /api/auth/logout
  registerSharedAuthRoutes(app, {
    db,
    profilesTable: profiles,
    tenantsTable: tenants,
    auditLogTable: auditLog,
    defaultRole: "msp_admin",
    defaultPlanTier: "starter",
    defaultMaxUsers: 5,
  });

  // ── Meridian-specific /api/auth/me extension ─────────────────────────
  // Adds planTier + planLimits to the auth response.
  // Clients should use this endpoint instead of /api/auth/me.
  app.get("/api/auth/me-ext", (req: AuthenticatedRequest, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const planTier = (req.org?.planTier || "starter") as PlanTier;
    const planLimits = PLAN_LIMITS[planTier] || PLAN_LIMITS.starter;
    res.json({
      profile: req.user,
      organization: req.org || null,
      planTier,
      planLimits,
    });
  });

  // ── Invitations ──────────────────────────────────────────────────────

  app.post("/api/invitations", requireAuth as any, requirePermissionMiddleware("invite_users") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { email, role } = req.body;
      if (!email || !role) return res.status(400).json({ message: "email and role are required" });

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && (existingUser as any).organizationId === req.orgId) {
        return res.status(409).json({ message: "This user is already a member" });
      }

      const userLimit = await checkPlanLimit(req.orgId!, "users");
      if (!userLimit.allowed) {
        return res.status(403).json({
          message: "Plan limit reached",
          limitType: "users",
          current: userLimit.current,
          limit: userLimit.limit,
          planTier: userLimit.planTier,
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await storage.createInvitation({
        tenantId: req.orgId!,
        email,
        role,
        invitedBy: req.user!.id,
        token,
        expiresAt,
        status: "pending",
      });

      await logAudit(req.orgId!, req.user!.id, "user_invited", "invitation", invitation.id, { email, role }, req.ip || undefined);

      const inviteUrl = `${req.protocol}://${req.get("host")}/invite/${token}`;

      const org = await storage.getOrganization(req.orgId!);
      await emailService.sendInvitation(email, org?.name || "your organization", inviteUrl, req.user!.displayName);

      res.status(201).json({ ...invitation, inviteUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  app.post("/api/invitations/accept", async (req, res) => {
    try {
      const { token, name, password } = req.body;
      if (!token || !name || !password) return res.status(400).json({ message: "token, name, and password are required" });

      const invitation = await storage.getInvitationByToken(token);
      if (!invitation || invitation.status !== "pending") return res.status(404).json({ message: "Invalid or expired invitation" });
      if (new Date(invitation.expiresAt) < new Date()) return res.status(410).json({ message: "Invitation expired" });

      const existing = await storage.getUserByEmail(invitation.email);
      if (existing) return res.status(409).json({ message: "Email already registered" });

      // Create user in Supabase auth
      const supabaseAdmin = createSupabaseAdminClient();
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      });

      if (authError || !authData.user) {
        return res.status(400).json({ message: authError?.message || "Failed to create auth user" });
      }

      // Create profile in our database
      const [user] = await db.insert(profiles).values({
        id: authData.user.id,
        email: invitation.email,
        displayName: name,
        role: invitation.role as any,
        tenantId: invitation.tenantId,
        status: "active",
      }).returning();

      await storage.updateInvitation(invitation.id, { status: "accepted", acceptedAt: new Date() } as any);

      res.json({ profile: user });
    } catch (error) {
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.get("/api/invitations/lookup/:token", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation || invitation.status !== "pending") return res.status(404).json({ message: "Invalid or expired invitation" });
      if (new Date(invitation.expiresAt) < new Date()) return res.status(410).json({ message: "Invitation expired" });

      const [org] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, invitation.tenantId));
      res.json({
        email: invitation.email,
        role: invitation.role,
        organizationName: org?.name || "Unknown",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to look up invitation" });
    }
  });

  app.get("/api/invitations", requireAuth as any, requirePermissionMiddleware("invite_users") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const invites = await storage.getInvitationsByOrg(req.orgId!);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Password reset is now handled by Supabase's built-in resetPasswordForEmail.
  // The client calls supabase.auth.resetPasswordForEmail(email) directly.
}
