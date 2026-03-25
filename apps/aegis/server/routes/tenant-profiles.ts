/**
 * CVG-AEGIS — Tenant Profile Routes
 *
 * Business context profiles used by the IAR Contextual Intelligence Engine.
 * GET/PUT: MSP Admin
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { getDb } from "../db";

export const tenantProfilesRouter = Router();

// ---------------------------------------------------------------------------
// GET /:clientTenantId — get tenant profile
// ---------------------------------------------------------------------------

tenantProfilesRouter.get("/:clientTenantId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM aegis.tenant_profiles WHERE tenant_id = $1`,
      params: [req.params.clientTenantId],
    } as any);

    const profile = (result as any)?.[0];
    if (!profile) {
      res.json({
        tenantId: req.params.clientTenantId,
        message: "No profile configured. Default settings will be used for IAR analysis.",
      });
      return;
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// PUT /:clientTenantId — create/update tenant profile (MSP Admin)
// ---------------------------------------------------------------------------

tenantProfilesRouter.put("/:clientTenantId", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user!.id;
    const { clientTenantId } = req.params;
    const {
      industryVertical,
      isMAActive,
      isMultiSite,
      isContractorHeavy,
      vendorDensity,
      employeeCount,
      notes,
      metadata,
    } = req.body;

    const result = await db.execute({
      sql: `
        INSERT INTO aegis.tenant_profiles (
          id, tenant_id, industry_vertical, is_ma_active, is_multi_site,
          is_contractor_heavy, vendor_density, employee_count, notes, metadata, updated_by
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tenant_id) DO UPDATE SET
          industry_vertical = EXCLUDED.industry_vertical,
          is_ma_active = EXCLUDED.is_ma_active,
          is_multi_site = EXCLUDED.is_multi_site,
          is_contractor_heavy = EXCLUDED.is_contractor_heavy,
          vendor_density = EXCLUDED.vendor_density,
          employee_count = EXCLUDED.employee_count,
          notes = EXCLUDED.notes,
          metadata = EXCLUDED.metadata,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
        RETURNING *
      `,
      params: [
        clientTenantId,
        industryVertical ?? null,
        isMAActive ?? false,
        isMultiSite ?? false,
        isContractorHeavy ?? false,
        vendorDensity ?? "normal",
        employeeCount ?? null,
        notes ?? null,
        JSON.stringify(metadata ?? {}),
        userId,
      ],
    } as any);

    res.json((result as any)?.[0] ?? { ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
