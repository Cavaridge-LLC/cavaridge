/**
 * Optimization Plans CRUD — /api/v1/optimization-plans
 *
 * Manage implementation plans for approved recommendations.
 */

import { Router } from "express";
import { db } from "../db.js";
import { optimizationPlans, recommendations, licenseAudits } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../services/auth/index.js";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";

const router = Router();

const createPlanSchema = z.object({
  auditId: z.number(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  implementationPlan: z.object({
    phases: z.array(z.object({
      name: z.string(),
      description: z.string(),
      targetDate: z.string().optional(),
      recommendationIds: z.array(z.number()),
    })),
  }).optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  implementationPlan: z.record(z.unknown()).optional(),
});

// List plans
router.get("/",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const plans = await db
      .select()
      .from(optimizationPlans)
      .where(eq(optimizationPlans.tenantId, req.tenantId!))
      .orderBy(desc(optimizationPlans.createdAt))
      .limit(50);

    res.json({ plans });
  },
);

// Get single plan with its recommendations
router.get("/:id",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const [plan] = await db
      .select()
      .from(optimizationPlans)
      .where(
        and(
          eq(optimizationPlans.id, Number(req.params.id)),
          eq(optimizationPlans.tenantId, req.tenantId!),
        ),
      );

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // Get associated recommendations
    const recs = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, req.tenantId!),
          eq(recommendations.auditId, plan.auditId),
        ),
      )
      .orderBy(desc(recommendations.monthlySavings));

    res.json({ plan, recommendations: recs });
  },
);

// Create plan
router.post("/",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { auditId, name, description, implementationPlan } = parsed.data;
    const tenantId = req.tenantId!;

    // Verify audit exists
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

    // Count approved recommendations
    const recs = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.auditId, auditId),
          eq(recommendations.status, "approved"),
        ),
      );

    const totalMonthlySavings = recs.reduce((sum, r) => sum + (r.monthlySavings ?? 0), 0);

    const [created] = await db
      .insert(optimizationPlans)
      .values({
        tenantId,
        auditId,
        name,
        description: description ?? null,
        status: "draft",
        totalRecommendations: recs.length,
        totalMonthlySavings: Math.round(totalMonthlySavings * 100) / 100,
        totalAnnualSavings: Math.round(totalMonthlySavings * 12 * 100) / 100,
        implementationPlan: (implementationPlan ?? null) as unknown as Record<string, unknown>,
      })
      .returning();

    res.status(201).json(created);
  },
);

// Update plan
router.patch("/:id",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const [existing] = await db
      .select()
      .from(optimizationPlans)
      .where(
        and(
          eq(optimizationPlans.id, Number(req.params.id)),
          eq(optimizationPlans.tenantId, req.tenantId!),
        ),
      );

    if (!existing) return res.status(404).json({ error: "Plan not found" });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.implementationPlan) updates.implementationPlan = parsed.data.implementationPlan;

    const [updated] = await db
      .update(optimizationPlans)
      .set(updates)
      .where(eq(optimizationPlans.id, Number(req.params.id)))
      .returning();

    res.json(updated);
  },
);

// Delete plan
router.delete("/:id",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const [existing] = await db
      .select({ id: optimizationPlans.id })
      .from(optimizationPlans)
      .where(
        and(
          eq(optimizationPlans.id, Number(req.params.id)),
          eq(optimizationPlans.tenantId, req.tenantId!),
        ),
      );

    if (!existing) return res.status(404).json({ error: "Plan not found" });

    await db
      .delete(optimizationPlans)
      .where(eq(optimizationPlans.id, Number(req.params.id)));

    res.status(204).send();
  },
);

export { router as optimizationPlansRouter };
