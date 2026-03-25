/**
 * License Audits CRUD — /api/v1/audits
 *
 * Create and manage license waste audits.
 * Triggers waste detection engine and stores results.
 */

import { Router } from "express";
import { db } from "../db.js";
import { licenseAudits, tenantConnections } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../services/auth/index.js";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { detectWaste, toLicensedUserProfile } from "../services/waste-detection.js";
import type { WasteThresholds, AuditConfig } from "../types/index.js";
import { DEFAULT_AUDIT_CONFIG } from "../types/index.js";

const router = Router();

const createAuditSchema = z.object({
  connectionId: z.number().optional(),
  /** User data from Graph sync or CSV upload */
  userData: z.array(z.object({
    id: z.string().optional(),
    displayName: z.string(),
    upn: z.string().optional(),
    userPrincipalName: z.string().optional(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    licenses: z.array(z.string()),
    cost: z.number(),
    usageGB: z.number().optional(),
    maxGB: z.number().optional(),
    status: z.string().optional(),
    activity: z.object({
      exchangeActive: z.boolean(),
      teamsActive: z.boolean(),
      sharePointActive: z.boolean(),
      oneDriveActive: z.boolean(),
      yammerActive: z.boolean().optional(),
      skypeActive: z.boolean().optional(),
      exchangeLastDate: z.string().nullable().optional(),
      teamsLastDate: z.string().nullable().optional(),
      sharePointLastDate: z.string().nullable().optional(),
      oneDriveLastDate: z.string().nullable().optional(),
      yammerLastDate: z.string().nullable().optional(),
      skypeLastDate: z.string().nullable().optional(),
      activeServiceCount: z.number(),
      totalServiceCount: z.number(),
      daysSinceLastActivity: z.number().nullable(),
    }).nullable().optional(),
  })),
  config: z.object({
    thresholds: z.object({
      unusedDays: z.number().min(1).max(365).default(90),
      underutilizedPct: z.number().min(1).max(100).default(40),
    }).optional(),
    includeActivityData: z.boolean().optional(),
    includeMailboxData: z.boolean().optional(),
    includeIARData: z.boolean().optional(),
  }).optional(),
});

// List audits
router.get("/",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const audits = await db
      .select()
      .from(licenseAudits)
      .where(eq(licenseAudits.tenantId, req.tenantId!))
      .orderBy(desc(licenseAudits.createdAt))
      .limit(50);

    res.json({ audits });
  },
);

// Get single audit
router.get("/:id",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const [audit] = await db
      .select()
      .from(licenseAudits)
      .where(
        and(
          eq(licenseAudits.id, Number(req.params.id)),
          eq(licenseAudits.tenantId, req.tenantId!),
        ),
      );

    if (!audit) return res.status(404).json({ error: "Audit not found" });
    res.json(audit);
  },
);

// Create and run audit
router.post("/",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createAuditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { connectionId, userData, config } = parsed.data;
    const tenantId = req.tenantId!;

    // Create the audit record
    const [audit] = await db
      .insert(licenseAudits)
      .values({
        tenantId,
        connectionId: connectionId ?? null,
        status: "running",
        config: config ?? DEFAULT_AUDIT_CONFIG,
        startedAt: new Date(),
      })
      .returning();

    try {
      // Convert user data to typed profiles
      const profiles = userData.map(toLicensedUserProfile);

      // Run waste detection
      const thresholds: WasteThresholds = {
        unusedDays: config?.thresholds?.unusedDays ?? 90,
        underutilizedPct: config?.thresholds?.underutilizedPct ?? 40,
      };

      const wasteResult = detectWaste(profiles, tenantId, thresholds);

      // Update audit with results
      const [updated] = await db
        .update(licenseAudits)
        .set({
          status: "completed",
          userData: userData as unknown as Record<string, unknown>,
          wasteResults: wasteResult as unknown as Record<string, unknown>,
          totalUsers: wasteResult.totalUsers,
          totalMonthlyCost: wasteResult.totalMonthlyCost,
          totalWastedCost: wasteResult.summary.totalWastedMonthlyCost,
          findingsCount: wasteResult.findings.length,
          completedAt: new Date(),
        })
        .where(eq(licenseAudits.id, audit.id))
        .returning();

      res.status(201).json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Mark audit as failed
      await db
        .update(licenseAudits)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(licenseAudits.id, audit.id));

      res.status(500).json({ error: `Audit failed: ${message}` });
    }
  },
);

// Delete audit
router.delete("/:id",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const [existing] = await db
      .select({ id: licenseAudits.id })
      .from(licenseAudits)
      .where(
        and(
          eq(licenseAudits.id, Number(req.params.id)),
          eq(licenseAudits.tenantId, req.tenantId!),
        ),
      );

    if (!existing) return res.status(404).json({ error: "Audit not found" });

    await db
      .delete(licenseAudits)
      .where(eq(licenseAudits.id, Number(req.params.id)));

    res.status(204).send();
  },
);

export { router as auditsRouter };
