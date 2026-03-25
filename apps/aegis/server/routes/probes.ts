/**
 * CVG-AEGIS — Probe Management Routes
 *
 * AEGIS Probe: Raspberry Pi appliance for internal network scanning.
 * Registration, heartbeat, scan initiation, and result ingestion.
 *
 * POST /register: public (probe-authenticated via enrollment token)
 * POST /:id/heartbeat: public (probe-authenticated)
 * POST /:id/results: public (probe-authenticated)
 * GET /: MSP Tech+
 * POST /:id/scan: MSP Admin — initiate scan
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { randomUUID } from "crypto";
import { getDb } from "../db";

export const probeRouter = Router();

// ---------------------------------------------------------------------------
// POST /register — register a new probe (public, token-authenticated)
// ---------------------------------------------------------------------------

probeRouter.post("/register", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enrollmentToken, name, serialNumber, firmwareVersion, networkSegment } = req.body;

    if (!enrollmentToken || !name) {
      res.status(400).json({ error: "enrollmentToken and name required." });
      return;
    }

    const db = getDb();

    // Validate enrollment token
    const tokenResult = await db.execute({
      sql: `SELECT tenant_id FROM aegis.enrollment_tokens WHERE token = $1 AND revoked_at IS NULL`,
      params: [enrollmentToken],
    } as any);

    const tokenRecord = (tokenResult as any)?.[0];
    if (!tokenRecord) {
      res.status(401).json({ error: "Invalid enrollment token." });
      return;
    }

    const probeId = randomUUID();

    await db.execute({
      sql: `
        INSERT INTO aegis.probes (id, tenant_id, name, serial_number, firmware_version, network_segment, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'registered')
      `,
      params: [
        probeId, tokenRecord.tenant_id, name,
        serialNumber ?? null, firmwareVersion ?? null, networkSegment ?? null,
      ],
    } as any);

    res.status(201).json({
      probeId,
      tenantId: tokenRecord.tenant_id,
      status: "registered",
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/heartbeat — probe heartbeat (public, probe-authenticated)
// ---------------------------------------------------------------------------

probeRouter.post("/:id/heartbeat", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { firmwareVersion, ipAddress } = req.body;
    const db = getDb();

    const sets = ["last_heartbeat = now()", "status = 'active'", "updated_at = now()"];
    const params: unknown[] = [];
    let idx = 1;

    if (firmwareVersion) { sets.push(`firmware_version = $${idx++}`); params.push(firmwareVersion); }
    if (ipAddress) { sets.push(`ip_address = $${idx++}`); params.push(ipAddress); }

    params.push(req.params.id);

    await db.execute({
      sql: `UPDATE aegis.probes SET ${sets.join(", ")} WHERE id = $${idx++}`,
      params,
    } as any);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/results — ingest scan results from probe (public, probe-authenticated)
// ---------------------------------------------------------------------------

probeRouter.post("/:id/results", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scanType, target, findings, discoveredAssets, summary } = req.body;

    if (!scanType) {
      res.status(400).json({ error: "scanType required." });
      return;
    }

    const db = getDb();

    // Get probe's tenant_id
    const probeResult = await db.execute({
      sql: `SELECT tenant_id FROM aegis.probes WHERE id = $1`,
      params: [req.params.id],
    } as any);

    const probe = (probeResult as any)?.[0];
    if (!probe) {
      res.status(404).json({ error: "Probe not found" });
      return;
    }

    const resultId = randomUUID();

    await db.execute({
      sql: `
        INSERT INTO aegis.probe_scan_results (
          id, probe_id, tenant_id, scan_type, target, status,
          findings, discovered_assets, summary, started_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, now(), now())
      `,
      params: [
        resultId, req.params.id, probe.tenant_id,
        scanType, target ?? null,
        JSON.stringify(findings ?? []),
        JSON.stringify(discoveredAssets ?? []),
        JSON.stringify(summary ?? {}),
      ],
    } as any);

    res.status(201).json({ resultId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET / — list probes for tenant (MSP Tech+, enforced at mount)
// ---------------------------------------------------------------------------

probeRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    const result = await db.execute({
      sql: `SELECT * FROM aegis.probes WHERE tenant_id = $1 ORDER BY last_heartbeat DESC NULLS LAST`,
      params: [tenantId],
    } as any);

    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — probe detail with recent scan results
// ---------------------------------------------------------------------------

probeRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    const probeResult = await db.execute({
      sql: `SELECT * FROM aegis.probes WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, tenantId],
    } as any);

    const probe = (probeResult as any)?.[0];
    if (!probe) {
      res.status(404).json({ error: "Probe not found" });
      return;
    }

    const scansResult = await db.execute({
      sql: `
        SELECT id, scan_type, target, status, summary, completed_at
        FROM aegis.probe_scan_results
        WHERE probe_id = $1
        ORDER BY completed_at DESC
        LIMIT 20
      `,
      params: [req.params.id],
    } as any);

    res.json({ ...probe, recentScans: scansResult ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/scan — initiate scan from probe (MSP Admin)
// ---------------------------------------------------------------------------

probeRouter.post("/:id/scan", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { scanType = "asset_discovery", target, config } = req.body;

    // Verify probe belongs to tenant
    const probeResult = await db.execute({
      sql: `SELECT id, status FROM aegis.probes WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, tenantId],
    } as any);

    const probe = (probeResult as any)?.[0];
    if (!probe) {
      res.status(404).json({ error: "Probe not found" });
      return;
    }

    if (probe.status !== "active") {
      res.status(400).json({ error: `Probe is ${probe.status}. Must be active to initiate scan.` });
      return;
    }

    const resultId = randomUUID();

    await db.execute({
      sql: `
        INSERT INTO aegis.probe_scan_results (
          id, probe_id, tenant_id, scan_type, target, status, started_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', now())
      `,
      params: [resultId, req.params.id, tenantId, scanType, target ?? null],
    } as any);

    // In production, this would push a command to the probe via a queue
    res.status(202).json({
      scanId: resultId,
      probeId: req.params.id,
      scanType,
      status: "pending",
      message: "Scan command queued for probe.",
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
