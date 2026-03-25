/**
 * Connectors API — CVG-BRAIN
 *
 * Manage Brain integration connectors.
 * GET /api/v1/connectors — List available connectors and their status
 * GET /api/v1/connectors/:id — Get connector details
 * POST /api/v1/connectors/:id/configure — Configure connector credentials
 * POST /api/v1/connectors/:id/sync — Trigger sync
 * GET /api/v1/connectors/:id/health — Connector health check
 * DELETE /api/v1/connectors/:id — Remove connector config
 */

import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { db } from "../db.js";
import { connectorConfigs } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

function paramStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

import { BRAIN_CONNECTORS } from "../connectors/index.js";
import { M365CalendarConnector } from "../connectors/m365-calendar.js";
import { M365EmailConnector } from "../connectors/m365-email.js";
import type { IBaseConnector } from "@cavaridge/connector-core";

const router = Router();

// In-memory connector instances (per-tenant). Keyed by "tenantId:connectorId".
const connectorInstances = new Map<string, IBaseConnector>();

function getInstanceKey(tenantId: string, connectorId: string): string {
  return `${tenantId}:${connectorId}`;
}

// List all available connectors
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  try {
    // Load tenant connector configs from DB
    const configs = await db
      .select()
      .from(connectorConfigs)
      .where(eq(connectorConfigs.tenantId, tenantId));

    const configMap = new Map(configs.map((c) => [c.connectorId, c]));

    const connectors = BRAIN_CONNECTORS.map((c) => ({
      ...c,
      isConfigured: configMap.has(c.id),
      config: configMap.get(c.id)
        ? { status: configMap.get(c.id)!.status, lastSyncAt: configMap.get(c.id)!.lastSyncAt }
        : null,
    }));

    res.json({ connectors });
  } catch (err) {
    res.status(500).json({ error: "Failed to list connectors", details: err instanceof Error ? err.message : String(err) });
  }
});

// Get connector details
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const id = paramStr(paramStr(req.params.id));

  try {
    const meta = BRAIN_CONNECTORS.find((c) => c.id === id);
    if (!meta) {
      res.status(404).json({ error: `Unknown connector: ${id}` });
      return;
    }

    const [config] = await db
      .select()
      .from(connectorConfigs)
      .where(and(eq(connectorConfigs.tenantId, tenantId), eq(connectorConfigs.connectorId, id)));

    res.json({
      ...meta,
      isConfigured: !!config,
      config: config ? { status: config.status, lastSyncAt: config.lastSyncAt, createdAt: config.createdAt } : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get connector", details: err instanceof Error ? err.message : String(err) });
  }
});

// Configure a connector
router.post("/:id/configure", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const id = paramStr(paramStr(req.params.id));
  const { credentials, settings } = req.body as {
    credentials: Record<string, string>;
    settings?: Record<string, unknown>;
  };

  if (!credentials) {
    res.status(400).json({ error: "credentials are required" });
    return;
  }

  const connectorMeta = BRAIN_CONNECTORS.find((c) => c.id === id);
  if (!connectorMeta) {
    res.status(404).json({ error: `Unknown connector: ${id}` });
    return;
  }

  if (connectorMeta.status === "stub") {
    res.status(501).json({ error: `${connectorMeta.name} connector is not yet implemented (Phase ${connectorMeta.phase})` });
    return;
  }

  try {
    let connector: IBaseConnector;
    if (id === "m365-calendar") {
      connector = new M365CalendarConnector();
    } else if (id === "m365-email") {
      connector = new M365EmailConnector();
    } else {
      res.status(501).json({ error: "Connector not implemented" });
      return;
    }

    await connector.initialize({
      tenantId,
      connectorId: id,
      credentials,
      settings: settings || {},
    });

    const auth = await connector.authenticate();
    if (!auth.authenticated) {
      res.status(400).json({ error: "Authentication failed", details: auth.error });
      return;
    }

    // Store config in DB
    const existing = await db
      .select()
      .from(connectorConfigs)
      .where(and(eq(connectorConfigs.tenantId, tenantId), eq(connectorConfigs.connectorId, id)));

    if (existing.length > 0) {
      await db
        .update(connectorConfigs)
        .set({
          credentials,
          settings: settings || {},
          status: "active",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(connectorConfigs.id, existing[0].id));
    } else {
      await db.insert(connectorConfigs).values({
        tenantId,
        connectorId: id,
        name: connectorMeta.name,
        credentials,
        settings: settings || {},
        status: "active",
      });
    }

    // Keep instance in memory
    connectorInstances.set(getInstanceKey(tenantId, id), connector);

    res.json({
      id,
      name: connectorMeta.name,
      status: "configured",
      authenticated: true,
      expiresAt: auth.expiresAt?.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Configuration failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// Trigger sync
router.post("/:id/sync", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const id = paramStr(paramStr(req.params.id));
  const { entityType = "calendar_events" } = req.body as { entityType?: string };

  const instance = connectorInstances.get(getInstanceKey(tenantId, id));
  if (!instance) {
    res.status(400).json({ error: "Connector not configured. Call POST /configure first." });
    return;
  }

  try {
    const result = await instance.fullSync(entityType);

    // Update last sync time
    await db
      .update(connectorConfigs)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(and(eq(connectorConfigs.tenantId, tenantId), eq(connectorConfigs.connectorId, id)));

    res.json({ syncResult: result });
  } catch (err) {
    // Record error
    await db
      .update(connectorConfigs)
      .set({ lastError: err instanceof Error ? err.message : String(err), status: "error", updatedAt: new Date() })
      .where(and(eq(connectorConfigs.tenantId, tenantId), eq(connectorConfigs.connectorId, id)));

    res.status(500).json({ error: "Sync failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// Health check
router.get("/:id/health", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;

  const instance = connectorInstances.get(getInstanceKey(tenantId, paramStr(req.params.id)));
  if (!instance) {
    res.json({
      connectorId: paramStr(req.params.id),
      status: "not_configured",
      message: "Connector has not been configured for this tenant",
    });
    return;
  }

  const health = await instance.healthCheck();
  res.json(health);
});

// Remove connector config
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const id = paramStr(paramStr(req.params.id));

  try {
    // Shutdown instance if running
    const instance = connectorInstances.get(getInstanceKey(tenantId, id));
    if (instance) {
      await instance.shutdown();
      connectorInstances.delete(getInstanceKey(tenantId, id));
    }

    const [deleted] = await db
      .delete(connectorConfigs)
      .where(and(eq(connectorConfigs.tenantId, tenantId), eq(connectorConfigs.connectorId, id)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Connector config not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete connector", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
