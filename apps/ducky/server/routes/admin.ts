import type { Express } from "express";
import { db } from "../db";
import { users, organizations, usageTracking, auditLog, conversations, messages, knowledgeSources, USER_ROLES } from "@shared/schema";
import { eq, and, desc, count, sql, gte } from "drizzle-orm";
import { requireAuth, requirePermissionMiddleware, logAudit, type AuthenticatedRequest } from "../auth";
import { createSupabaseAdminClient } from "@cavaridge/auth/server";
import { z } from "zod";

const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.enum(["tenant_admin", "user", "viewer"]),
  password: z.string().min(6),
});

const changeRoleSchema = z.object({
  role: z.enum(["tenant_admin", "user", "viewer"]),
});

export function registerAdminRoutes(app: Express) {
  // ── User Management ──────────────────────────────────────────────────

  // List users in current org
  app.get("/api/admin/users", requireAuth as any, requirePermissionMiddleware("invite_users") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const orgUsers = await db.select({
        id: users.id,
        email: users.email,
        name: users.displayName,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      }).from(users)
        .where(eq(users.organizationId, req.orgId!))
        .orderBy(users.createdAt);

      res.json(orgUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Invite / create user in current org
  app.post("/api/admin/users", requireAuth as any, requirePermissionMiddleware("invite_users") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = inviteUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }

      const { email, name, role, password } = parsed.data;

      // Check if email already exists
      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      // Check max users
      const orgUserCount = await db.select({ count: count() }).from(users)
        .where(eq(users.organizationId, req.orgId!));

      const [org] = await db.select().from(organizations).where(eq(organizations.id, req.orgId!));
      if (org && org.maxUsers && orgUserCount[0].count >= org.maxUsers) {
        return res.status(403).json({ message: `Organization user limit reached (${org.maxUsers})` });
      }

      // Create user in Supabase auth
      const supabaseAdmin = createSupabaseAdminClient();
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      });

      if (authError || !authData.user) {
        return res.status(400).json({ message: authError?.message || "Failed to create auth user" });
      }

      const [newUser] = await db.insert(users).values({
        id: authData.user.id,
        email,
        displayName: name,
        role,
        organizationId: req.orgId!,
        status: "active",
      }).returning();

      await logAudit(req.orgId!, req.user!.id, "invite_user", "user", newUser.id, {
        email, role, invitedBy: req.user!.email,
      });

      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Change user role
  app.patch("/api/admin/users/:id/role", requireAuth as any, requirePermissionMiddleware("change_roles") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = changeRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid role", errors: parsed.error.issues });
      }

      const [targetUser] = await db.select().from(users)
        .where(and(
          eq(users.id, req.params.id as string),
          eq(users.organizationId, req.orgId!),
        ));

      if (!targetUser) {
        return res.status(404).json({ message: "User not found in organization" });
      }

      // Prevent self-demotion
      if (targetUser.id === req.user!.id) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }

      const [updated] = await db.update(users)
        .set({ role: parsed.data.role, updatedAt: new Date() })
        .where(eq(users.id, targetUser.id))
        .returning();

      await logAudit(req.orgId!, req.user!.id, "change_role", "user", targetUser.id, {
        previousRole: targetUser.role,
        newRole: parsed.data.role,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Deactivate user
  app.patch("/api/admin/users/:id/status", requireAuth as any, requirePermissionMiddleware("change_roles") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { status } = req.body;
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'active' or 'inactive'" });
      }

      const [targetUser] = await db.select().from(users)
        .where(and(
          eq(users.id, req.params.id as string),
          eq(users.organizationId, req.orgId!),
        ));

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (targetUser.id === req.user!.id) {
        return res.status(400).json({ message: "Cannot change your own status" });
      }

      const [updated] = await db.update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, targetUser.id))
        .returning();

      await logAudit(req.orgId!, req.user!.id, "change_status", "user", targetUser.id, {
        previousStatus: targetUser.status,
        newStatus: status,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // ── Organization Info ────────────────────────────────────────────────

  app.get("/api/admin/organization", requireAuth as any, requirePermissionMiddleware("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, req.orgId!));
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      const userCount = await db.select({ count: count() }).from(users)
        .where(eq(users.organizationId, req.orgId!));

      res.json({ ...org, userCount: userCount[0].count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.patch("/api/admin/organization", requireAuth as any, requirePermissionMiddleware("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.length < 1) {
        return res.status(400).json({ message: "Name is required" });
      }

      const [updated] = await db.update(organizations)
        .set({ name, updatedAt: new Date() })
        .where(eq(organizations.id, req.orgId!))
        .returning();

      await logAudit(req.orgId!, req.user!.id, "update_org", "organization", req.orgId!, { name });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // ── Usage Analytics ──────────────────────────────────────────────────

  app.get("/api/admin/analytics", requireAuth as any, requirePermissionMiddleware("view_analytics") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Questions per day
      const questionsPerDay = await db
        .select({
          date: sql<string>`date_trunc('day', ${usageTracking.createdAt})::date`.as("date"),
          count: count(),
        })
        .from(usageTracking)
        .where(and(
          eq(usageTracking.tenantId, req.orgId!),
          eq(usageTracking.actionType, "question"),
          gte(usageTracking.createdAt, since),
        ))
        .groupBy(sql`date_trunc('day', ${usageTracking.createdAt})::date`)
        .orderBy(sql`date_trunc('day', ${usageTracking.createdAt})::date`);

      // Total counts
      const totalQuestions = await db.select({ count: count() }).from(usageTracking)
        .where(and(eq(usageTracking.tenantId, req.orgId!), eq(usageTracking.actionType, "question")));

      const totalUploads = await db.select({ count: count() }).from(usageTracking)
        .where(and(eq(usageTracking.tenantId, req.orgId!), eq(usageTracking.actionType, "source_upload")));

      const totalConversations = await db.select({ count: count() }).from(conversations)
        .where(eq(conversations.tenantId, req.orgId!));

      const totalSources = await db.select({ count: count() }).from(knowledgeSources)
        .where(eq(knowledgeSources.tenantId, req.orgId!));

      // Top users by question count
      const topUsers = await db
        .select({
          userId: usageTracking.userId,
          userName: users.displayName,
          count: count(),
        })
        .from(usageTracking)
        .innerJoin(users, eq(usageTracking.userId, users.id))
        .where(and(
          eq(usageTracking.tenantId, req.orgId!),
          eq(usageTracking.actionType, "question"),
          gte(usageTracking.createdAt, since),
        ))
        .groupBy(usageTracking.userId, users.displayName)
        .orderBy(desc(count()))
        .limit(10);

      // Recent activity
      const recentActivity = await db.select({
        id: usageTracking.id,
        actionType: usageTracking.actionType,
        createdAt: usageTracking.createdAt,
        userName: users.displayName,
      })
        .from(usageTracking)
        .innerJoin(users, eq(usageTracking.userId, users.id))
        .where(eq(usageTracking.tenantId, req.orgId!))
        .orderBy(desc(usageTracking.createdAt))
        .limit(20);

      res.json({
        period: { days, since: since.toISOString() },
        totals: {
          questions: totalQuestions[0].count,
          uploads: totalUploads[0].count,
          conversations: totalConversations[0].count,
          knowledgeSources: totalSources[0].count,
        },
        questionsPerDay,
        topUsers,
        recentActivity,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ── Audit Log ────────────────────────────────────────────────────────

  app.get("/api/admin/audit-log", requireAuth as any, requirePermissionMiddleware("view_audit_log") as any, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await db.select({
        id: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        details: auditLog.details,
        createdAt: auditLog.createdAt,
        userName: users.displayName,
      })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.userId, users.id))
        .where(eq(auditLog.organizationId, req.orgId!))
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset);

      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });
}
