/**
 * Report Generation — /api/v1/reports
 *
 * Generate vCIO reports combining license optimization and AEGIS IAR data.
 * Produces Markdown content (DOCX rendering deferred to shared Report Generator agent).
 */

import { Router } from "express";
import { db } from "../db.js";
import { vcioReports, licenseAudits, recommendations } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../services/auth/index.js";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { generateVCIOReport } from "../services/vcio-report.js";
import type { VCIOReportData, WasteDetectionResult, IARRiskFlag } from "../types/index.js";

const router = Router();

const generateReportSchema = z.object({
  auditId: z.number(),
  planId: z.number().optional(),
  title: z.string().min(1).max(200).optional(),
  includeIAR: z.boolean().default(false),
  /** Mock IAR data for testing until AEGIS integration is live */
  iarData: z.object({
    riskFlags: z.array(z.object({
      flagType: z.string(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      userPrincipalName: z.string(),
      description: z.string(),
      suppressed: z.boolean().default(false),
      suppressionReason: z.string().optional(),
    })),
    securityScore: z.number().min(0).max(100),
    lastReviewDate: z.string(),
  }).optional(),
});

// List vCIO reports
router.get("/vcio",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const reports = await db
      .select()
      .from(vcioReports)
      .where(eq(vcioReports.tenantId, req.tenantId!))
      .orderBy(desc(vcioReports.createdAt))
      .limit(50);

    res.json({ reports });
  },
);

// Get single vCIO report
router.get("/vcio/:id",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const [report] = await db
      .select()
      .from(vcioReports)
      .where(
        and(
          eq(vcioReports.id, Number(req.params.id)),
          eq(vcioReports.tenantId, req.tenantId!),
        ),
      );

    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  },
);

// Generate vCIO report
router.post("/vcio/generate",
  requireAuth,
  requireRole(ROLES.MSP_TECH),
  async (req: AuthenticatedRequest, res) => {
    const parsed = generateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const { auditId, planId, title, includeIAR, iarData } = parsed.data;
    const tenantId = req.tenantId!;

    // Fetch audit
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
      return res.status(400).json({ error: "Audit must be completed" });
    }

    // Fetch recommendations for this audit
    const recs = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.auditId, auditId),
        ),
      );

    const wasteResult = audit.wasteResults as unknown as WasteDetectionResult | null;
    const totalMonthlySavings = recs.reduce((sum, r) => sum + (r.monthlySavings ?? 0), 0);

    const reportData: VCIOReportData = {
      tenantId,
      auditId: String(auditId),
      licenseData: {
        totalUsers: audit.totalUsers ?? 0,
        totalMonthlyCost: audit.totalMonthlyCost ?? 0,
        wasteFindings: wasteResult?.findings ?? [],
        recommendations: recs.map((r) => ({
          id: String(r.id),
          userId: r.userId ?? "",
          userDisplayName: r.userDisplayName ?? "",
          userPrincipalName: r.userPrincipalName ?? "",
          type: r.type as "downgrade" | "removal" | "consolidation" | "upgrade" | "reassignment",
          currentLicenses: Array.isArray(r.currentLicenses) ? (r.currentLicenses as string[]) : [],
          recommendedLicenses: Array.isArray(r.recommendedLicenses) ? (r.recommendedLicenses as string[]) : [],
          currentMonthlyCost: r.currentMonthlyCost ?? 0,
          recommendedMonthlyCost: r.recommendedMonthlyCost ?? 0,
          monthlySavings: r.monthlySavings ?? 0,
          annualSavings: r.annualSavings ?? 0,
          rationale: r.rationale ?? "",
          riskLevel: (r.riskLevel ?? "medium") as "critical" | "high" | "medium" | "low" | "info",
          status: (r.status ?? "pending") as "pending" | "approved" | "rejected" | "implemented" | "deferred",
        })),
        totalSavings: {
          monthly: totalMonthlySavings,
          annual: totalMonthlySavings * 12,
        },
      },
    };

    // Add IAR data if requested
    if (includeIAR && iarData) {
      reportData.iarData = {
        riskFlags: iarData.riskFlags as IARRiskFlag[],
        securityScore: iarData.securityScore,
        lastReviewDate: new Date(iarData.lastReviewDate),
      };
    }

    try {
      const output = await generateVCIOReport(reportData);

      // Store report
      const [report] = await db
        .insert(vcioReports)
        .values({
          tenantId,
          auditId,
          planId: planId ?? null,
          title: title ?? output.title,
          content: output.content,
          reportData: reportData as unknown as Record<string, unknown>,
          includesIAR: includeIAR,
          generatedAt: output.generatedAt,
        })
        .returning();

      res.status(201).json(report);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: `Report generation failed: ${message}` });
    }
  },
);

// Delete vCIO report
router.delete("/vcio/:id",
  requireAuth,
  requireRole(ROLES.MSP_ADMIN),
  async (req: AuthenticatedRequest, res) => {
    const [existing] = await db
      .select({ id: vcioReports.id })
      .from(vcioReports)
      .where(
        and(
          eq(vcioReports.id, Number(req.params.id)),
          eq(vcioReports.tenantId, req.tenantId!),
        ),
      );

    if (!existing) return res.status(404).json({ error: "Report not found" });

    await db
      .delete(vcioReports)
      .where(eq(vcioReports.id, Number(req.params.id)));

    res.status(204).send();
  },
);

export { router as reportsRouter };
