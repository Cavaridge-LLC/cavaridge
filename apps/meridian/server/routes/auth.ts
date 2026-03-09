import type { Express } from "express";
import { storage, organizations, eq, db, requireAuth, hashPassword, verifyPassword, logAudit, requirePerm, checkPlanLimit, crypto, PLAN_LIMITS, type AuthenticatedRequest, type PlanTier } from "./_helpers";
import { emailService } from "../email";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, organizationName, industryDefault } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ message: "email, password, and name are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const passwordHash = await hashPassword(password);
      const slug = (organizationName || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const org = await storage.createOrganization({
        name: organizationName || `${name}'s Organization`,
        slug,
        ownerUserId: null,
        industryDefault: industryDefault || null,
        planTier: "starter",
        maxUsers: 5,
        maxDeals: 10,
        maxStorageMb: 5000,
        isActive: true,
      });

      const user = await storage.createUser({
        email,
        name,
        role: "org_owner",
        organizationId: org.id,
        passwordHash,
        status: "active",
      });

      await db.update(organizations).set({ ownerUserId: user.id }).where(eq(organizations.id, org.id));

      (req as any).session.userId = user.id;

      await logAudit(org.id, user.id, "register", "user", user.id, { email }, req.ip || undefined);

      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json({ user: safeUser, organization: org });
    } catch (error: any) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.status !== "active") {
        return res.status(403).json({ message: "Account is not active" });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      (req as any).session.userId = user.id;

      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);

      if (user.organizationId) {
        await logAudit(user.organizationId, user.id, "login", "session", undefined, { email }, req.ip || undefined);
      }

      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error("Logout error:", err);
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req: AuthenticatedRequest, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { passwordHash: _, ...safeUser } = req.user;
    const planTier = (req.org?.planTier || "starter") as PlanTier;
    const planLimits = PLAN_LIMITS[planTier] || PLAN_LIMITS.starter;
    res.json({ user: safeUser, organization: req.org, planTier, planLimits });
  });

  app.post("/api/invitations", requireAuth as any, requirePerm("invite_users") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { email, role } = req.body;
      if (!email || !role) return res.status(400).json({ message: "email and role are required" });

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.organizationId === req.orgId) {
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
        organizationId: req.orgId!,
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
      await emailService.sendInvitation(email, org?.name || "your organization", inviteUrl, req.user!.name);

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

      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        email: invitation.email,
        name,
        role: invitation.role as any,
        organizationId: invitation.organizationId,
        passwordHash,
        status: "active",
        invitedBy: invitation.invitedBy,
        invitedAt: new Date(),
      });

      await storage.updateInvitation(invitation.id, { status: "accepted", acceptedAt: new Date() } as any);

      (req as any).session.userId = user.id;
      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.get("/api/invitations/lookup/:token", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation || invitation.status !== "pending") return res.status(404).json({ message: "Invalid or expired invitation" });
      if (new Date(invitation.expiresAt) < new Date()) return res.status(410).json({ message: "Invitation expired" });

      const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, invitation.organizationId));
      res.json({
        email: invitation.email,
        role: invitation.role,
        organizationName: org?.name || "Unknown",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to look up invitation" });
    }
  });

  app.get("/api/invitations", requireAuth as any, requirePerm("invite_users") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const invites = await storage.getInvitationsByOrg(req.orgId!);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(200).json({ message: "If an account exists, a reset link will be sent" });
      }

      await storage.deletePasswordResetTokensByUser(user.id);

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken({ userId: user.id, token, expiresAt });

      await emailService.sendPasswordReset(user.email, token, user.name);

      res.json({ message: "If an account exists, a reset link will be sent" });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const tokenRecord = await storage.getPasswordResetToken(token);
      if (!tokenRecord || tokenRecord.usedAt) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      if (new Date(tokenRecord.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Reset token has expired" });
      }

      const passwordHash = await hashPassword(password);
      await storage.updateUser(tokenRecord.userId, { passwordHash });
      await storage.markPasswordResetTokenUsed(tokenRecord.id);

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}
