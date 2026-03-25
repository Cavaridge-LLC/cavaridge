/**
 * CVG-AEGIS — Report Generation Routes
 *
 * DOCX/PDF security posture report generation.
 * POST /generate: MSP Admin — generate report
 * GET /: MSP Tech+ — list generated reports
 * GET /:id: MSP Tech+ — download report
 *
 * Phase 1: JSON report payload with structure for DOCX/PDF rendering.
 * Phase 2: DOCX rendering via Caelum's shared engine.
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { runAiAnalysis, hasAiCapability } from "../services/ai-analysis";

export const reportsRouter = Router();

// ---------------------------------------------------------------------------
// POST /generate — generate security posture report (MSP Admin)
// ---------------------------------------------------------------------------

reportsRouter.post("/generate", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const {
      clientTenantId,
      reportType = "posture_summary",
      format = "json",
      includeAiNarrative = false,
    } = req.body;

    const db = getDb();
    const targetTenantId = clientTenantId ?? tenantId;

    // Gather data for report
    const scoreResult = await db.execute({
      sql: `
        SELECT * FROM aegis.adjusted_scores
        WHERE tenant_id = $1 AND client_tenant_id = $2
        ORDER BY calculated_at DESC LIMIT 1
      `,
      params: [tenantId, targetTenantId],
    } as any);

    const historyResult = await db.execute({
      sql: `
        SELECT total_score, recorded_at
        FROM aegis.score_history
        WHERE tenant_id = $1 AND client_tenant_id = $2
        ORDER BY recorded_at DESC LIMIT 12
      `,
      params: [tenantId, targetTenantId],
    } as any);

    const saasResult = await db.execute({
      sql: `
        SELECT name, domain, category, classification, risk_score, visit_count
        FROM aegis.saas_applications WHERE tenant_id = $1
        ORDER BY risk_score DESC LIMIT 20
      `,
      params: [targetTenantId],
    } as any);

    const iarResult = await db.execute({
      sql: `
        SELECT id, flag_count, high_severity_count, medium_severity_count, low_severity_count, executive_summary, completed_at
        FROM aegis.iar_reviews
        WHERE tenant_id = $1 AND status = 'completed'
        ORDER BY completed_at DESC LIMIT 1
      `,
      params: [targetTenantId],
    } as any);

    const controlsResult = await db.execute({
      sql: `
        SELECT control_type, name, vendor, is_detected, bonus_points
        FROM aegis.compensating_controls
        WHERE tenant_id = $1 AND enabled = true
      `,
      params: [targetTenantId],
    } as any);

    // Build report structure
    const reportData = {
      metadata: {
        reportId: randomUUID(),
        reportType,
        format,
        tenantId,
        clientTenantId: targetTenantId,
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
      },
      sections: {
        executiveSummary: {
          currentScore: (scoreResult as any)?.[0]?.total_score ?? null,
          scoreHistory: historyResult ?? [],
          trend: calculateTrend(historyResult as any[] ?? []),
        },
        adjustedScore: (scoreResult as any)?.[0] ?? null,
        saasDiscovery: {
          topRisk: saasResult ?? [],
        },
        identityReview: (iarResult as any)?.[0] ?? null,
        compensatingControls: controlsResult ?? [],
      },
      aiNarrative: null as string | null,
    };

    // Optional AI-generated narrative
    if (includeAiNarrative && hasAiCapability()) {
      try {
        const aiResult = await runAiAnalysis({
          tenantId,
          userId,
          analysisType: "posture_report",
          context: reportData.sections,
        });
        reportData.aiNarrative = aiResult.content;
      } catch {
        reportData.aiNarrative = "AI narrative generation unavailable.";
      }
    }

    res.json(reportData);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateTrend(history: Array<{ total_score: string; recorded_at: string }>): string {
  if (!history || history.length < 2) return "insufficient_data";

  const recent = parseFloat(history[0]?.total_score ?? "0");
  const older = parseFloat(history[history.length - 1]?.total_score ?? "0");
  const delta = recent - older;

  if (delta > 5) return "improving";
  if (delta < -5) return "declining";
  return "stable";
}
