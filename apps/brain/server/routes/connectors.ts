/**
 * Connectors API — CVG-BRAIN
 *
 * Manage Brain integration connectors.
 * GET /api/v1/connectors — List available connectors and their status
 * POST /api/v1/connectors/:id/configure — Configure connector credentials
 * POST /api/v1/connectors/:id/sync — Trigger sync
 * GET /api/v1/connectors/:id/health — Connector health check
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { BRAIN_CONNECTORS } from "../connectors/index.js";
import { M365CalendarConnector } from "../connectors/m365-calendar.js";
import { M365EmailConnector } from "../connectors/m365-email.js";

const router = Router();

// Connector instances (in production, managed by connector registry)
const connectorInstances: Record<string, { connector: M365CalendarConnector | M365EmailConnector }> = {};

function getTenantContext(req: Request) {
  return {
    tenantId: (req as Record<string, unknown>).tenantId as string || req.headers["x-tenant-id"] as string || "",
    userId: (req as Record<string, unknown>).userId as string || req.headers["x-user-id"] as string || "",
  };
}

// List all available connectors
router.get("/", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const connectors = BRAIN_CONNECTORS.map((c) => ({
    ...c,
    isConfigured: !!connectorInstances[`${tenantId}:${c.id}`],
  }));

  res.json({ connectors });
});

// Configure a connector
router.post("/:id/configure", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const { id } = req.params;
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
    let connector: M365CalendarConnector | M365EmailConnector;
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

    connectorInstances[`${tenantId}:${id}`] = { connector };

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
router.post("/:id/sync", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const { id } = req.params;
  const { entityType = "calendar_events" } = req.body as { entityType?: string };

  const instance = connectorInstances[`${tenantId}:${id}`];
  if (!instance) {
    res.status(400).json({ error: "Connector not configured. Call POST /configure first." });
    return;
  }

  try {
    const result = await instance.connector.fullSync(entityType);
    res.json({ syncResult: result });
  } catch (err) {
    res.status(500).json({ error: "Sync failed", details: err instanceof Error ? err.message : String(err) });
  }
});

// Health check
router.get("/:id/health", async (req: Request, res: Response) => {
  const { tenantId } = getTenantContext(req);
  if (!tenantId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const instance = connectorInstances[`${tenantId}:${req.params.id}`];
  if (!instance) {
    res.json({
      connectorId: req.params.id,
      status: "not_configured",
      message: "Connector has not been configured for this tenant",
    });
    return;
  }

  const health = await instance.connector.healthCheck();
  res.json(health);
});

export default router;
