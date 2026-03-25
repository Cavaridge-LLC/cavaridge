/**
 * CVG-AEGIS — Identity Access Review (IAR) Routes
 *
 * Two-tier IAR:
 *   POST /api/v1/iar/freemium — public, no auth, no data retention
 *   POST /api/v1/iar/full     — tenant-scoped, MSP Admin
 *   GET  /api/v1/iar          — list reviews, MSP Tech+
 *   GET  /api/v1/iar/:id      — review detail, MSP Tech+
 *   GET  /api/v1/iar/:id/delta — historical diff (full tier)
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import {
  runIarAnalysis,
  type M365UserRecord,
} from "../services/iar-engine";
import {
  evaluateCompensatingControls,
  type DetectedControl,
} from "../services/compensating-controls";

export const iarRouter = Router();

// ---------------------------------------------------------------------------
// POST /freemium — public, no auth, no data retention
// ---------------------------------------------------------------------------

iarRouter.post("/freemium", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { users, email, name, company } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      res.status(400).json({ error: "users[] array required with M365 user records." });
      return;
    }

    if (users.length > 5000) {
      res.status(400).json({ error: "Maximum 5000 users per freemium review." });
      return;
    }

    // Parse user records
    const parsedUsers: M365UserRecord[] = users.map(parseUserRecord);

    // Run analysis — freemium tier (base severity only)
    const result = runIarAnalysis(parsedUsers, { tier: "freemium" });

    const db = getDb();
    const reviewId = randomUUID();

    // Record for lead capture (no raw user data retained)
    await db.execute({
      sql: `
        INSERT INTO aegis.iar_reviews (
          id, tier, status, input_source, user_count,
          flag_count, high_severity_count, medium_severity_count, low_severity_count,
          executive_summary, prospect_email, prospect_name, prospect_company, completed_at
        ) VALUES ($1, 'freemium', 'completed', 'csv_upload', $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      `,
      params: [
        reviewId, result.userCount,
        result.flagCount, result.highSeverityCount, result.mediumSeverityCount, result.lowSeverityCount,
        result.executiveSummary,
        email ?? null, name ?? null, company ?? null,
      ],
    } as any);

    res.json({
      reviewId,
      tier: "freemium",
      ...result,
      disclaimer: "This analysis uses base severity levels only. Additional environmental context may adjust finding severity. Upgrade to full-tier AEGIS for contextual intelligence.",
    });
  } catch (err) {
    console.error("[aegis] IAR freemium error:", err);
    res.status(500).json({ error: "IAR analysis failed." });
  }
});

// ---------------------------------------------------------------------------
// POST /full — tenant-scoped, MSP Admin
// ---------------------------------------------------------------------------

iarRouter.post("/full", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const { users, clientTenantId, inputSource = "csv_upload" } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      res.status(400).json({ error: "users[] array required with M365 user records." });
      return;
    }

    const parsedUsers: M365UserRecord[] = users.map(parseUserRecord);
    const targetTenantId = clientTenantId ?? tenantId;

    const db = getDb();

    // Load compensating controls for this tenant
    const controlsResult = await db.execute({
      sql: `SELECT * FROM aegis.compensating_controls WHERE tenant_id = $1 AND enabled = true`,
      params: [targetTenantId],
    } as any);

    const dbControls = (controlsResult ?? []) as any[];
    const autoDetected = dbControls
      .filter((c: any) => c.is_detected)
      .map((c: any) => ({ controlType: c.control_type, metadata: c.metadata }));
    const manualOverrides = dbControls
      .filter((c: any) => c.detection_method === "manual")
      .map((c: any) => ({
        controlType: c.control_type,
        enabled: c.enabled,
        bonusPoints: parseFloat(c.bonus_points),
      }));

    const activeControls: DetectedControl[] = evaluateCompensatingControls(autoDetected, manualOverrides);

    // Load business context
    const profileResult = await db.execute({
      sql: `SELECT * FROM aegis.tenant_profiles WHERE tenant_id = $1`,
      params: [targetTenantId],
    } as any);

    const profile = (profileResult as any)?.[0];
    const businessContext = profile
      ? {
          industryVertical: profile.industry_vertical,
          isMAActive: profile.is_ma_active ?? false,
          isMultiSite: profile.is_multi_site ?? false,
          isContractorHeavy: profile.is_contractor_heavy ?? false,
          vendorDensity: (profile.vendor_density as "low" | "normal" | "high") ?? "normal",
          employeeCount: profile.employee_count,
        }
      : undefined;

    // Run full-tier analysis
    const result = runIarAnalysis(parsedUsers, {
      tier: "full",
      activeControls,
      businessContext,
    });

    const reviewId = randomUUID();

    // Store review
    await db.execute({
      sql: `
        INSERT INTO aegis.iar_reviews (
          id, tenant_id, tier, status, input_source, user_count,
          flag_count, high_severity_count, medium_severity_count, low_severity_count,
          findings, executive_summary, contextual_adjustments, completed_at
        ) VALUES ($1, $2, 'full', 'completed', $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
      `,
      params: [
        reviewId, targetTenantId, inputSource, result.userCount,
        result.flagCount, result.highSeverityCount, result.mediumSeverityCount, result.lowSeverityCount,
        JSON.stringify(result.flags), result.executiveSummary,
        JSON.stringify({ controls: activeControls.filter(c => c.isDetected), businessContext }),
      ],
    } as any);

    // Store individual flags
    for (const flag of result.flags) {
      await db.execute({
        sql: `
          INSERT INTO aegis.iar_flags (
            id, review_id, tenant_id, user_principal_name, display_name,
            flag_type, base_severity, adjusted_severity, adjustment_reason,
            is_suppressed, suppression_reason, detail, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        params: [
          randomUUID(), reviewId, targetTenantId,
          flag.userPrincipalName, flag.displayName,
          flag.flagType, flag.baseSeverity, flag.adjustedSeverity,
          flag.adjustmentReason, flag.isSuppressed, flag.suppressionReason,
          flag.detail, JSON.stringify(flag.metadata),
        ],
      } as any);
    }

    // Check for previous review and generate delta
    const prevResult = await db.execute({
      sql: `
        SELECT id FROM aegis.iar_reviews
        WHERE tenant_id = $1 AND tier = 'full' AND id != $2
        ORDER BY created_at DESC LIMIT 1
      `,
      params: [targetTenantId, reviewId],
    } as any);

    const prevReview = (prevResult as any)?.[0];
    if (prevReview) {
      const prevFlagsResult = await db.execute({
        sql: `SELECT * FROM aegis.iar_flags WHERE review_id = $1`,
        params: [prevReview.id],
      } as any);

      const prevFlags = (prevFlagsResult ?? []) as any[];
      const currentFlagKeys = new Set(result.flags.map(f => `${f.userPrincipalName}:${f.flagType}`));
      const prevFlagKeys = new Set(prevFlags.map((f: any) => `${f.user_principal_name}:${f.flag_type}`));

      const newFlags = result.flags.filter(f => !prevFlagKeys.has(`${f.userPrincipalName}:${f.flagType}`));
      const resolvedFlags = prevFlags.filter((f: any) => !currentFlagKeys.has(`${f.user_principal_name}:${f.flag_type}`));

      await db.execute({
        sql: `
          INSERT INTO aegis.iar_deltas (id, tenant_id, current_review_id, previous_review_id, new_flags, resolved_flags, summary)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        params: [
          randomUUID(), targetTenantId, reviewId, prevReview.id,
          JSON.stringify(newFlags.map(f => ({ upn: f.userPrincipalName, flagType: f.flagType, severity: f.baseSeverity }))),
          JSON.stringify(resolvedFlags.map((f: any) => ({ upn: f.user_principal_name, flagType: f.flag_type }))),
          `${newFlags.length} new finding(s), ${resolvedFlags.length} resolved since last review.`,
        ],
      } as any);
    }

    res.json({
      reviewId,
      tier: "full",
      ...result,
      hasDelta: !!prevReview,
    });
  } catch (err) {
    console.error("[aegis] IAR full error:", err);
    res.status(500).json({ error: "IAR analysis failed." });
  }
});

// ---------------------------------------------------------------------------
// GET / — list reviews for tenant
// ---------------------------------------------------------------------------

iarRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { limit = "20", tier } = req.query;

    let query = `
      SELECT id, tier, status, input_source, user_count,
        flag_count, high_severity_count, medium_severity_count, low_severity_count,
        executive_summary, completed_at, created_at
      FROM aegis.iar_reviews WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (tier) {
      query += ` AND tier = $${idx++}`;
      params.push(tier);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx++}`;
    params.push(parseInt(limit as string));

    const result = await db.execute({ sql: query, params } as any);
    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — review detail
// ---------------------------------------------------------------------------

iarRouter.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    const reviewResult = await db.execute({
      sql: `SELECT * FROM aegis.iar_reviews WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.id, tenantId],
    } as any);

    const review = (reviewResult as any)?.[0];
    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const flagsResult = await db.execute({
      sql: `SELECT * FROM aegis.iar_flags WHERE review_id = $1 ORDER BY base_severity ASC`,
      params: [req.params.id],
    } as any);

    res.json({ ...review, flags: flagsResult ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/delta — historical diff
// ---------------------------------------------------------------------------

iarRouter.get("/:id/delta", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;

    const deltaResult = await db.execute({
      sql: `
        SELECT * FROM aegis.iar_deltas
        WHERE current_review_id = $1 AND tenant_id = $2
      `,
      params: [req.params.id, tenantId],
    } as any);

    const delta = (deltaResult as any)?.[0];
    if (!delta) {
      res.json({ message: "No historical data available for comparison." });
      return;
    }

    res.json(delta);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseUserRecord(raw: Record<string, unknown>): M365UserRecord {
  return {
    userPrincipalName: String(raw.userPrincipalName ?? raw.UPN ?? raw.upn ?? ""),
    displayName: String(raw.displayName ?? raw.display_name ?? raw["Display Name"] ?? ""),
    accountEnabled: raw.accountEnabled !== false && raw.accountEnabled !== "false" && raw["Block credential"] !== "Yes",
    assignedLicenses: Array.isArray(raw.assignedLicenses)
      ? raw.assignedLicenses
      : typeof raw.assignedLicenses === "string" && raw.assignedLicenses
        ? raw.assignedLicenses.split("+").map((s: string) => s.trim())
        : typeof raw["Assigned Products"] === "string" && raw["Assigned Products"]
          ? (raw["Assigned Products"] as string).split("+").map((s: string) => s.trim())
          : [],
    lastSignInDateTime: raw.lastSignInDateTime as string | null
      ?? raw["Last activity date (UTC)"] as string | null
      ?? null,
    createdDateTime: String(raw.createdDateTime ?? raw["Creation date"] ?? new Date().toISOString()),
    userType: String(raw.userType ?? raw["User type"] ?? "Member"),
    mfaRegistered: raw.mfaRegistered !== undefined ? Boolean(raw.mfaRegistered) : undefined,
    passwordNeverExpires: raw.passwordNeverExpires !== undefined ? Boolean(raw.passwordNeverExpires) : undefined,
    accountType: (raw.accountType as M365UserRecord["accountType"]) ?? undefined,
    daysSinceActivity: typeof raw.daysSinceActivity === "number" ? raw.daysSinceActivity : undefined,
  };
}
