/**
 * Recommendations CRUD — /api/v1/recommendations
 *
 * Manage optimization recommendations generated from audits.
 */

import { Router } from "express";
import { db } from "../db.js";
import { recommendations, licenseAudits } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../services/auth/index.js";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { generateRecommendations } from "../services/optimization.js";
import type { WasteDetectionResult } from "../types/index.js";

const router = Router();

const generateRecsSchema = z.object({
  auditId: z.number(),
  strategy: z.enum(["balanced", "maximize_savings", "maximize_security"]).default("balanced"),
});

const updateRecSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "implemented", "deferred"]).optional(),
  implementationNotes: z.string().optional(),
});

// List recommendations for an audit
router.get("/",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const auditId = req.query.auditId ? Number(req.query.auditId) : undefined;

    const conditions = [eq(recommendations.tenantId, req.tenantId!)];
    if (auditId) conditions.push(eq(recommendations.auditId, auditId));

    const recs = await db
      .select()
      .from(recommendations)
      .where(and(...conditions))
      .orderBy(desc(recommendations.monthlySavings))
      .limit(200);

    res.json({ recommendations: recs });
  },
);

// Get single recommendation
router.get("/:id",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const [rec] = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.id, Number(req.params.id)),
          eq(recommendations.tenantId, req.tenantId!),
        ),
      );

    if (!rec) return res.status(404).json({ error: "Recommendation not found" });
    res.json(rec);
  },
);

// Generate recommendations from an audit
router.post("/generate",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const parsed = generateRecsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { auditId, strategy } = parsed.data;
    const tenantId = req.tenantId!;

    // Fetch the audit
    const [audit] = await db
      .select()
      .from(licenseAudits)
      .where(
        and(
          eq(licenseAudits.id, auditId),
          eq(licenseAudits.tenantId, tenantId),
        ),
      );

    if (!audit) return res.status(404).json({ error: "Audit not found" });
    if (audit.status !== "completed") {
      return res.status(400).json({ error: "Audit must be completed before generating recommendations" });
    }

    const wasteResult = audit.wasteResults as unknown as WasteDetectionResult | null;
    if (!wasteResult) {
      return res.status(400).json({ error: "Audit has no waste detection results" });
    }

    try {
      const output = await generateRecommendations({
        wasteResult,
        strategy,
      });

      // Store recommendations
      const recRows = output.recommendations.map((r) => ({
        tenantId,
        auditId,
        userId: r.userId,
        userDisplayName: r.userDisplayName,
        userPrincipalName: r.userPrincipalName,
        type: r.type,
        currentLicenses: r.currentLicenses as unknown as Record<string, unknown>,
        recommendedLicenses: r.recommendedLicenses as unknown as Record<string, unknown>,
        currentMonthlyCost: r.currentMonthlyCost,
        recommendedMonthlyCost: r.recommendedMonthlyCost,
        monthlySavings: r.monthlySavings,
        annualSavings: r.annualSavings,
        rationale: r.rationale,
        riskLevel: r.riskLevel,
        status: "pending" as const,
      }));

      let insertedRecs: Array<typeof recommendations.$inferSelect> = [];
      if (recRows.length > 0) {
        insertedRecs = await db
          .insert(recommendations)
          .values(recRows)
          .returning();
      }

      res.status(201).json({
        totalRecommendations: insertedRecs.length,
        totalMonthlySavings: output.totalMonthlySavings,
        totalAnnualSavings: output.totalAnnualSavings,
        narrative: output.narrative,
        recommendations: insertedRecs,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Failed to generate recommendations: ${message}` });
    }
  },
);

// Update recommendation status
router.patch("/:id",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const parsed = updateRecSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const [existing] = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.id, Number(req.params.id)),
          eq(recommendations.tenantId, req.tenantId!),
        ),
      );

    if (!existing) return res.status(404).json({ error: "Recommendation not found" });

    const updates: Record<string, unknown> = {};
    if (parsed.data.status) {
      updates.status = parsed.data.status;
      if (parsed.data.status === "approved") {
        updates.approvedBy = req.user?.email ?? req.user?.id;
        updates.approvedAt = new Date();
      }
      if (parsed.data.status === "implemented") {
        updates.implementedAt = new Date();
      }
    }
    if (parsed.data.implementationNotes !== undefined) {
      updates.implementationNotes = parsed.data.implementationNotes;
    }

    const [updated] = await db
      .update(recommendations)
      .set(updates)
      .where(eq(recommendations.id, Number(req.params.id)))
      .returning();

    res.json(updated);
  },
);

// Bulk update recommendation statuses
router.post("/bulk-update",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      ids: z.array(z.number()).min(1),
      status: z.enum(["approved", "rejected", "deferred"]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { ids, status } = parsed.data;
    const tenantId = req.tenantId!;
    let updatedCount = 0;

    for (const id of ids) {
      const [existing] = await db
        .select({ id: recommendations.id })
        .from(recommendations)
        .where(
          and(
            eq(recommendations.id, id),
            eq(recommendations.tenantId, tenantId),
          ),
        );

      if (existing) {
        const updates: Record<string, unknown> = { status };
        if (status === "approved") {
          updates.approvedBy = req.user?.email ?? req.user?.id;
          updates.approvedAt = new Date();
        }

        await db
          .update(recommendations)
          .set(updates)
          .where(eq(recommendations.id, id));

        updatedCount++;
      }
    }

    res.json({ updatedCount });
  },
);

export { router as recommendationsRouter };
