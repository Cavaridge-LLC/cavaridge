/**
 * CVG-AEGIS — Compensating Controls Routes
 *
 * CRUD for per-tenant compensating controls.
 * GET catalog: MSP Tech+
 * GET/POST/PATCH/DELETE: MSP Admin
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import {
  getControlsCatalog,
  evaluateCompensatingControls,
  calculateCompensatingBonus,
} from "../services/compensating-controls";

export const compensatingControlsRouter = Router();

// ---------------------------------------------------------------------------
// GET /catalog — available controls reference
// ---------------------------------------------------------------------------

compensatingControlsRouter.get("/catalog", (_req: AuthenticatedRequest, res: Response) => {
  res.json({ controls: getControlsCatalog() });
});

// ---------------------------------------------------------------------------
// GET / — list tenant's configured controls
// ---------------------------------------------------------------------------

compensatingControlsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { clientTenantId } = req.query;
    const targetTenantId = (clientTenantId as string) ?? tenantId;

    const result = await db.execute({
      sql: `SELECT * FROM aegis.compensating_controls WHERE tenant_id = $1 ORDER BY control_type`,
      params: [targetTenantId],
    } as any);

    const controls = (result ?? []) as any[];
    const autoDetected = controls
      .filter((c: any) => c.is_detected)
      .map((c: any) => ({ controlType: c.control_type, metadata: c.metadata }));
    const manualOverrides = controls
      .filter((c: any) => c.detection_method === "manual")
      .map((c: any) => ({
        controlType: c.control_type,
        enabled: c.enabled,
        bonusPoints: parseFloat(c.bonus_points ?? "0"),
      }));

    const evaluated = evaluateCompensatingControls(autoDetected, manualOverrides);
    const bonus = calculateCompensatingBonus(evaluated);

    res.json({
      controls: result ?? [],
      evaluated,
      totalBonus: bonus,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST / — add/configure a compensating control (MSP Admin)
// ---------------------------------------------------------------------------

compensatingControlsRouter.post("/", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const {
      clientTenantId,
      controlType,
      name,
      description,
      vendor,
      signalSource,
      detectionMethod = "manual",
      isDetected = true,
      bonusPoints,
      flagSuppressions = [],
    } = req.body;

    if (!controlType || !name) {
      res.status(400).json({ error: "controlType and name required." });
      return;
    }

    const targetTenantId = clientTenantId ?? tenantId;

    const result = await db.execute({
      sql: `
        INSERT INTO aegis.compensating_controls (
          id, tenant_id, control_type, name, description, vendor,
          signal_source, detection_method, is_detected, detected_at,
          bonus_points, flag_suppressions, overridden_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (tenant_id, control_type)
        DO UPDATE SET
          name = EXCLUDED.name,
          is_detected = EXCLUDED.is_detected,
          detection_method = EXCLUDED.detection_method,
          bonus_points = EXCLUDED.bonus_points,
          flag_suppressions = EXCLUDED.flag_suppressions,
          overridden_by = EXCLUDED.overridden_by,
          overridden_at = now(),
          updated_at = now()
        RETURNING *
      `,
      params: [
        randomUUID(), targetTenantId, controlType, name,
        description ?? null, vendor ?? null,
        signalSource ?? null, detectionMethod,
        isDetected, isDetected ? new Date() : null,
        bonusPoints ?? 0, JSON.stringify(flagSuppressions),
        detectionMethod === "manual" ? userId : null,
      ],
    } as any);

    res.status(201).json((result as any)?.[0] ?? { ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:id — update control (MSP Admin)
// ---------------------------------------------------------------------------

compensatingControlsRouter.patch("/:id", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const { enabled, isDetected, bonusPoints, flagSuppressions } = req.body;

    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    let idx = 1;

    if (enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(enabled); }
    if (isDetected !== undefined) {
      sets.push(`is_detected = $${idx++}`);
      params.push(isDetected);
      sets.push(`detection_method = 'manual'`);
      sets.push(`overridden_by = $${idx++}`);
      params.push(userId);
      sets.push(`overridden_at = now()`);
    }
    if (bonusPoints !== undefined) { sets.push(`bonus_points = $${idx++}`); params.push(bonusPoints); }
    if (flagSuppressions !== undefined) { sets.push(`flag_suppressions = $${idx++}`); params.push(JSON.stringify(flagSuppressions)); }

    params.push(req.params.id, tenantId);

    const result = await db.execute({
      sql: `UPDATE aegis.compensating_controls SET ${sets.join(", ")} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      params,
    } as any);

    const control = (result as any)?.[0];
    if (!control) {
      res.status(404).json({ error: "Control not found" });
      return;
    }

    res.json(control);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — remove control override (MSP Admin)
// ---------------------------------------------------------------------------

compensatingControlsRouter.delete("/:id", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    await db.execute({
      sql: `DELETE FROM aegis.compensating_controls WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, tenantId],
    } as any);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
