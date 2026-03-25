/**
 * CVG-AEGIS — ConnectSecure Integration Routes
 *
 * Ingest and query ConnectSecure vulnerability scan data.
 * POST /ingest: MSP Admin — receive webhook or manual upload
 * GET /: MSP Tech+ — list scans
 * GET /:id: MSP Tech+ — scan detail with mapped findings
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import {
  mapToAegisRiskModel,
  calculateConnectSecureRiskScore,
  type ConnectSecureScanPayload,
} from "../services/connectsecure";

export const connectSecureRouter = Router();

// ---------------------------------------------------------------------------
// POST /ingest — ingest ConnectSecure scan data (MSP Admin)
// ---------------------------------------------------------------------------

connectSecureRouter.post("/ingest", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { clientTenantId, scanData } = req.body;

    if (!scanData || !scanData.scanId) {
      res.status(400).json({ error: "scanData with scanId required." });
      return;
    }

    const payload = scanData as ConnectSecureScanPayload;
    const targetTenantId = clientTenantId ?? tenantId;

    // Map to AEGIS risk model
    const mappedFindings = mapToAegisRiskModel(payload);
    const riskScore = calculateConnectSecureRiskScore(payload);

    const db = getDb();
    const id = randomUUID();

    await db.execute({
      sql: `
        INSERT INTO aegis.connectsecure_scans (
          id, tenant_id, external_scan_id, scan_type, target, status,
          vulnerabilities, compliance_results, risk_score, summary, raw_data, scanned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      params: [
        id, targetTenantId, payload.scanId, payload.scanType,
        payload.target, payload.status,
        JSON.stringify(payload.vulnerabilities),
        JSON.stringify(payload.complianceResults),
        riskScore,
        JSON.stringify(payload.summary),
        JSON.stringify(payload),
        payload.scannedAt ? new Date(payload.scannedAt) : new Date(),
      ],
    } as any);

    res.status(201).json({
      id,
      externalScanId: payload.scanId,
      riskScore,
      mappedFindingsCount: mappedFindings.length,
      mappedFindings: mappedFindings.slice(0, 10), // Top 10 by priority
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET / — list ConnectSecure scans for tenant
// ---------------------------------------------------------------------------

connectSecureRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { clientTenantId, limit = "20" } = req.query;
    const targetTenantId = (clientTenantId as string) ?? tenantId;

    const result = await db.execute({
      sql: `
        SELECT id, external_scan_id, scan_type, target, status, risk_score, summary, scanned_at, ingested_at
        FROM aegis.connectsecure_scans
        WHERE tenant_id = $1
        ORDER BY ingested_at DESC
        LIMIT $2
      `,
      params: [targetTenantId, parseInt(limit as string)],
    } as any);

    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — scan detail with mapped findings
// ---------------------------------------------------------------------------

connectSecureRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    const result = await db.execute({
      sql: `SELECT * FROM aegis.connectsecure_scans WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, tenantId],
    } as any);

    const scan = (result as any)?.[0];
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    // Re-map to AEGIS risk model
    let mappedFindings: unknown[] = [];
    if (scan.raw_data) {
      try {
        const payload = typeof scan.raw_data === "string"
          ? JSON.parse(scan.raw_data)
          : scan.raw_data;
        mappedFindings = mapToAegisRiskModel(payload);
      } catch {
        // Raw data may not be parseable
      }
    }

    res.json({ ...scan, mappedFindings });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
