// @cavaridge/auth/admin-routes — Platform Admin API routes
//
// All routes guarded by requirePlatformRole (platform_owner or platform_admin only).
// Register with: registerAdminRoutes(app, config)
//
// Routes:
//   GET    /api/admin/tenants         — list all tenants
//   POST   /api/admin/tenants         — create MSP tenant
//   PUT    /api/admin/tenants/:id     — edit tenant
//   POST   /api/admin/tenants/:id/suspend — suspend tenant + children
//   GET    /api/admin/users           — list all users
//   PUT    /api/admin/users/:id       — update user (role, tenant, status)
//   POST   /api/admin/users/:id/force-reset — trigger password reset
//   GET    /api/admin/invites         — list invites
//   POST   /api/admin/invites         — create invite
//   DELETE /api/admin/invites/:id     — revoke invite
//   GET    /api/admin/audit-log       — paginated audit log

import type { Express, Response } from "express";
import { eq, desc, ilike, and, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomBytes } from "crypto";
import {
  requirePlatformRole,
  createSupabaseAdminClient,
  type AuthenticatedRequest,
  type SupabaseConfig,
} from "./server.js";

export interface AdminRoutesConfig {
  db: NodePgDatabase<any>;
  profilesTable: any;
  tenantsTable: any;
  invitesTable: any;
  auditLogTable?: any;
  supabase?: Partial<SupabaseConfig>;
}

export function registerAdminRoutes(app: Express, config: AdminRoutesConfig) {
  const { db, profilesTable, tenantsTable, invitesTable, auditLogTable } = config;

  // All admin routes require platform role
  app.use("/api/admin", requirePlatformRole);

  // ---------- TENANTS ----------

  // GET /api/admin/tenants — list all tenants
  app.get("/api/admin/tenants", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const type = req.query.type as string | undefined;

      const conditions: any[] = [];

      if (type) {
        conditions.push(eq(tenantsTable.type, type));
      }
      if (search) {
        conditions.push(
          or(
            ilike(tenantsTable.name, `%${search}%`),
            ilike(tenantsTable.slug, `%${search}%`),
          ),
        );
      }

      let query = db.select().from(tenantsTable);
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query.orderBy(desc(tenantsTable.createdAt));
      res.json({ tenants: results });
    } catch (error: any) {
      console.error("Admin tenants list error:", error);
      res.status(500).json({ message: "Failed to list tenants" });
    }
  });

  // POST /api/admin/tenants — create MSP tenant
  app.post("/api/admin/tenants", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, slug, type = "msp", parentId, planTier = "starter", maxUsers = 5, config: tenantConfig } = req.body;

      if (!name) return res.status(400).json({ message: "Tenant name required" });

      const tenantSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const [tenant] = (await db
        .insert(tenantsTable)
        .values({
          name,
          slug: tenantSlug,
          type,
          parentId: parentId || null,
          planTier,
          maxUsers,
          isActive: true,
          config: tenantConfig || {},
        })
        .returning()) as any[];

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: tenant.id,
            userId: req.user!.id,
            action: "tenant_create",
            resourceType: "tenant",
            resourceId: tenant.id,
            details: { name, type },
            ipAddress: req.ip || null,
          });
        } catch { /* non-critical */ }
      }

      res.status(201).json({ tenant });
    } catch (error: any) {
      if (error.constraint?.includes("slug")) {
        return res.status(409).json({ message: "Tenant slug already exists" });
      }
      console.error("Admin tenant create error:", error);
      res.status(500).json({ message: "Failed to create tenant" });
    }
  });

  // PUT /api/admin/tenants/:id — edit tenant
  app.put("/api/admin/tenants/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, status, config: tenantConfig, planTier, maxUsers } = req.body;

      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (status !== undefined) updates.isActive = status === "active";
      if (tenantConfig !== undefined) updates.config = tenantConfig;
      if (planTier !== undefined) updates.planTier = planTier;
      if (maxUsers !== undefined) updates.maxUsers = maxUsers;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      const [updated] = await db
        .update(tenantsTable)
        .set(updates)
        .where(eq(tenantsTable.id, id))
        .returning();

      if (!updated) return res.status(404).json({ message: "Tenant not found" });

      res.json({ tenant: updated });
    } catch (error: any) {
      console.error("Admin tenant update error:", error);
      res.status(500).json({ message: "Failed to update tenant" });
    }
  });

  // POST /api/admin/tenants/:id/suspend — suspend tenant + cascade to children
  app.post("/api/admin/tenants/:id/suspend", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Suspend the tenant
      await db.update(tenantsTable).set({ isActive: false }).where(eq(tenantsTable.id, id));

      // Suspend child tenants
      await db.update(tenantsTable).set({ isActive: false }).where(eq(tenantsTable.parentId, id));

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: id,
            userId: req.user!.id,
            action: "tenant_suspend",
            resourceType: "tenant",
            resourceId: id,
            details: {},
            ipAddress: req.ip || null,
          });
        } catch { /* non-critical */ }
      }

      res.json({ message: "Tenant suspended" });
    } catch (error: any) {
      console.error("Admin tenant suspend error:", error);
      res.status(500).json({ message: "Failed to suspend tenant" });
    }
  });

  // ---------- USERS ----------

  // GET /api/admin/users — list all users
  app.get("/api/admin/users", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const tenantId = req.query.tenantId as string | undefined;
      const role = req.query.role as string | undefined;
      const limit = parseInt(req.query.limit as string || "50", 10);
      const offset = parseInt(req.query.offset as string || "0", 10);

      let query = db.select().from(profilesTable);
      const conditions: any[] = [];

      if (search) {
        conditions.push(
          or(
            ilike(profilesTable.email, `%${search}%`),
            ilike(profilesTable.displayName, `%${search}%`),
          ),
        );
      }
      if (tenantId) {
        conditions.push(eq(profilesTable.organizationId, tenantId));
      }
      if (role) {
        conditions.push(eq(profilesTable.role, role));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query.orderBy(desc(profilesTable.createdAt)).limit(limit).offset(offset);
      res.json({ users: results });
    } catch (error: any) {
      console.error("Admin users list error:", error);
      res.status(500).json({ message: "Failed to list users" });
    }
  });

  // PUT /api/admin/users/:id — update user
  app.put("/api/admin/users/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { role, organizationId, status } = req.body;

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (role !== undefined) updates.role = role;
      if (organizationId !== undefined) updates.organizationId = organizationId;
      if (status !== undefined) updates.status = status;

      const [updated] = await db
        .update(profilesTable)
        .set(updates)
        .where(eq(profilesTable.id, id))
        .returning();

      if (!updated) return res.status(404).json({ message: "User not found" });

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: updated.organizationId,
            userId: req.user!.id,
            action: "user_update",
            resourceType: "user",
            resourceId: id,
            details: { changes: { role, organizationId, status } },
            ipAddress: req.ip || null,
          });
        } catch { /* non-critical */ }
      }

      res.json({ user: updated });
    } catch (error: any) {
      console.error("Admin user update error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // POST /api/admin/users/:id/force-reset — trigger password reset
  app.post("/api/admin/users/:id/force-reset", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [user] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));

      if (!user) return res.status(404).json({ message: "User not found" });

      const admin = createSupabaseAdminClient(config.supabase);
      await admin.auth.admin.generateLink({
        type: "recovery",
        email: user.email,
      });

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: user.organizationId,
            userId: req.user!.id,
            action: "force_password_reset",
            resourceType: "user",
            resourceId: id,
            details: { targetEmail: user.email },
            ipAddress: req.ip || null,
          });
        } catch { /* non-critical */ }
      }

      res.json({ message: "Password reset initiated" });
    } catch (error: any) {
      console.error("Admin force reset error:", error);
      res.status(500).json({ message: "Failed to initiate password reset" });
    }
  });

  // ---------- INVITES ----------

  // GET /api/admin/invites
  app.get("/api/admin/invites", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.query.status as string | undefined;

      let query = db.select().from(invitesTable);
      if (status) {
        query = query.where(eq(invitesTable.status, status)) as any;
      }

      const results = await query.orderBy(desc(invitesTable.createdAt));
      res.json({ invites: results });
    } catch (error: any) {
      console.error("Admin invites list error:", error);
      res.status(500).json({ message: "Failed to list invites" });
    }
  });

  // POST /api/admin/invites — create invite
  app.post("/api/admin/invites", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, tenantId, role = "user" } = req.body;

      if (!email) return res.status(400).json({ message: "Email required" });

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invite] = (await db
        .insert(invitesTable)
        .values({
          email,
          tenantId: tenantId || null,
          role,
          invitedBy: req.user!.id,
          token,
          status: "pending",
          expiresAt,
        })
        .returning()) as any[];

      // Audit log
      if (auditLogTable) {
        try {
          await db.insert(auditLogTable).values({
            organizationId: tenantId,
            userId: req.user!.id,
            action: "invite_create",
            resourceType: "invite",
            resourceId: invite.id,
            details: { email, role },
            ipAddress: req.ip || null,
          });
        } catch { /* non-critical */ }
      }

      res.status(201).json({ invite });
    } catch (error: any) {
      console.error("Admin invite create error:", error);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // DELETE /api/admin/invites/:id — revoke
  app.delete("/api/admin/invites/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [revoked] = await db
        .update(invitesTable)
        .set({ status: "revoked" })
        .where(eq(invitesTable.id, id))
        .returning();

      if (!revoked) return res.status(404).json({ message: "Invite not found" });

      res.json({ message: "Invite revoked" });
    } catch (error: any) {
      console.error("Admin invite revoke error:", error);
      res.status(500).json({ message: "Failed to revoke invite" });
    }
  });

  // ---------- AUDIT LOG ----------

  // GET /api/admin/audit-log
  app.get("/api/admin/audit-log", async (req: AuthenticatedRequest, res: Response) => {
    if (!auditLogTable) {
      return res.json({ entries: [], total: 0 });
    }

    try {
      const limit = parseInt(req.query.limit as string || "50", 10);
      const offset = parseInt(req.query.offset as string || "0", 10);
      const userId = req.query.userId as string | undefined;
      const action = req.query.action as string | undefined;

      let query = db.select().from(auditLogTable);
      const conditions: any[] = [];

      if (userId) conditions.push(eq(auditLogTable.userId, userId));
      if (action) conditions.push(eq(auditLogTable.action, action));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query.orderBy(desc(auditLogTable.createdAt)).limit(limit).offset(offset);

      res.json({ entries: results });
    } catch (error: any) {
      console.error("Admin audit log error:", error);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });
}
