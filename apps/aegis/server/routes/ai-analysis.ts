/**
 * CVG-AEGIS — AI Analysis Routes
 *
 * All AI calls route through Ducky (app_code=CVG-AEGIS) via Spaniel.
 * Provides: risk narratives, executive summaries, remediation prioritization.
 *
 * POST /risk-narrative: MSP Tech+
 * POST /executive-summary: MSP Tech+
 * POST /remediation-priority: MSP Tech+
 * POST /posture-report: MSP Admin
 */
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "@cavaridge/auth/server";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { runAiAnalysis, hasAiCapability } from "../services/ai-analysis";

export const aiAnalysisRouter = Router();

// ---------------------------------------------------------------------------
// POST /risk-narrative
// ---------------------------------------------------------------------------

aiAnalysisRouter.post("/risk-narrative", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!hasAiCapability()) {
      res.status(503).json({ error: "AI analysis not available. SPANIEL_URL not configured." });
      return;
    }

    const result = await runAiAnalysis({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      analysisType: "risk_narrative",
      context: req.body.context ?? req.body,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /executive-summary
// ---------------------------------------------------------------------------

aiAnalysisRouter.post("/executive-summary", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!hasAiCapability()) {
      res.status(503).json({ error: "AI analysis not available." });
      return;
    }

    const result = await runAiAnalysis({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      analysisType: "executive_summary",
      context: req.body.context ?? req.body,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /remediation-priority
// ---------------------------------------------------------------------------

aiAnalysisRouter.post("/remediation-priority", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!hasAiCapability()) {
      res.status(503).json({ error: "AI analysis not available." });
      return;
    }

    const result = await runAiAnalysis({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      analysisType: "remediation_priority",
      context: req.body.context ?? req.body,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// POST /posture-report (MSP Admin only)
// ---------------------------------------------------------------------------

aiAnalysisRouter.post("/posture-report", requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!hasAiCapability()) {
      res.status(503).json({ error: "AI analysis not available." });
      return;
    }

    const result = await runAiAnalysis({
      tenantId: req.tenantId!,
      userId: req.user!.id,
      analysisType: "posture_report",
      context: req.body.context ?? req.body,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
