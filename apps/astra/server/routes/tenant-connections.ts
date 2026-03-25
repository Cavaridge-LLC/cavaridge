/**
 * Tenant Connections CRUD — /api/v1/tenant-connections
 *
 * Manages Microsoft 365 tenant connections for license monitoring.
 * All endpoints tenant-scoped, MSP Admin + MSP Tech.
 */

import { Router } from "express";
import { db } from "../db.js";
import { tenantConnections } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../services/auth/index.js";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";

const router = Router();

const createConnectionSchema = z.object({
  name: z.string().min(1).max(200),
  m365TenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

const updateConnectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "paused", "disconnected"]).optional(),
});

// List all tenant connections
router.get("/",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const connections = await db
      .select({
        id: tenantConnections.id,
        tenantId: tenantConnections.tenantId,
        name: tenantConnections.name,
        m365TenantId: tenantConnections.m365TenantId,
        status: tenantConnections.status,
        lastSyncAt: tenantConnections.lastSyncAt,
        createdAt: tenantConnections.createdAt,
      })
      .from(tenantConnections)
      .where(eq(tenantConnections.tenantId, req.tenantId!));

    res.json({ connections });
  },
);

// Get single connection
router.get("/:id",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const [conn] = await db
      .select({
        id: tenantConnections.id,
        tenantId: tenantConnections.tenantId,
        name: tenantConnections.name,
        m365TenantId: tenantConnections.m365TenantId,
        status: tenantConnections.status,
        lastSyncAt: tenantConnections.lastSyncAt,
        createdAt: tenantConnections.createdAt,
      })
      .from(tenantConnections)
      .where(
        and(
          eq(tenantConnections.id, Number(req.params.id)),
          eq(tenantConnections.tenantId, req.tenantId!),
        ),
      );

    if (!conn) return res.status(404).json({ error: "Connection not found" });
    res.json(conn);
  },
);

// Create connection
router.post("/",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { name, m365TenantId, clientId, clientSecret } = parsed.data;

    // In production, encrypt the client secret via Doppler/KMS
    // For now, base64 encode as placeholder (NOT secure for production)
    const encryptedSecret = Buffer.from(clientSecret).toString("base64");

    const [created] = await db
      .insert(tenantConnections)
      .values({
        tenantId: req.tenantId!,
        name,
        m365TenantId,
        clientId,
        encryptedSecret,
        status: "active",
      })
      .returning();

    res.status(201).json({
      id: created.id,
      tenantId: created.tenantId,
      name: created.name,
      m365TenantId: created.m365TenantId,
      status: created.status,
      createdAt: created.createdAt,
    });
  },
);

// Update connection
router.patch("/:id",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const parsed = updateConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const [existing] = await db
      .select({ id: tenantConnections.id })
      .from(tenantConnections)
      .where(
        and(
          eq(tenantConnections.id, Number(req.params.id)),
          eq(tenantConnections.tenantId, req.tenantId!),
        ),
      );

    if (!existing) return res.status(404).json({ error: "Connection not found" });

    const updates: Record<string, unknown> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.status) updates.status = parsed.data.status;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(tenantConnections)
      .set(updates)
      .where(eq(tenantConnections.id, Number(req.params.id)))
      .returning();

    res.json({
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      status: updated.status,
      updatedAt: updated.updatedAt,
    });
  },
);

// Delete connection
router.delete("/:id",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const [existing] = await db
      .select({ id: tenantConnections.id })
      .from(tenantConnections)
      .where(
        and(
          eq(tenantConnections.id, Number(req.params.id)),
          eq(tenantConnections.tenantId, req.tenantId!),
        ),
      );

    if (!existing) return res.status(404).json({ error: "Connection not found" });

    await db
      .delete(tenantConnections)
      .where(eq(tenantConnections.id, Number(req.params.id)));

    res.status(204).send();
  },
);

export { router as tenantConnectionsRouter };
