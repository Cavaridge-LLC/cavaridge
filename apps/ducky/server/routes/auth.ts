import type { Express } from "express";
import { db } from "../db";
import { users, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, hashPassword, verifyPassword, logAudit, type AuthenticatedRequest } from "../auth";
import { isPlatformRole } from "@shared/schema";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, organizationName } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ message: "email, password, and name are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const passwordHash = await hashPassword(password);
      const slug = (organizationName || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const [org] = await db.insert(organizations).values({
        name: organizationName || `${name}'s Organization`,
        slug,
        planTier: "starter",
        maxUsers: 5,
        isActive: true,
      }).returning();

      const [user] = await db.insert(users).values({
        email,
        name,
        role: "tenant_admin",
        organizationId: org.id,
        passwordHash,
        status: "active",
      }).returning();

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

      const [user] = await db.select().from(users).where(eq(users.email, email));
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

      if (user.organizationId) {
        await logAudit(user.organizationId, user.id, "login", "user", user.id, {}, req.ip || undefined);
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
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { passwordHash: _, ...safeUser } = req.user;

    res.json({
      user: safeUser,
      organization: req.org || null,
    });
  });
}
