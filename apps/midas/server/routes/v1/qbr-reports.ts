/**
 * QBR Reports API — /api/v1/qbr-reports
 *
 * Full QBR generation, storage, and delivery.
 */

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../services/auth";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import * as storage from "../../storage";
import { buildQbrReportData } from "../../modules/qbr/report-builder";
import type { AgentContext } from "@cavaridge/agent-core";

const router = Router();

function param(req: AuthenticatedRequest, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function getOrgId(req: AuthenticatedRequest): string {
  return req.tenantId ?? req.user!.tenantId ?? req.user!.id;
}

function agentContext(req: AuthenticatedRequest): AgentContext {
  return {
    tenantId: getOrgId(req),
    userId: req.user!.id,
    config: {
      agentId: "midas-qbr-builder",
      agentName: "QBR Report Builder",
      appCode: "CVG-MIDAS",
      version: "1.0.0",
    },
    correlationId: crypto.randomUUID(),
  };
}

// ── List QBR Reports ────────────────────────────────────────────────

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const clientId = req.query.clientId as string | undefined;
  const rows = await storage.getQbrReports(getOrgId(req), clientId);
  res.json(rows);
});

// ── Get QBR Report ──────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const row = await storage.getQbrReport(getOrgId(req), param(req, "id"));
  if (!row) return res.status(404).json({ message: "QBR report not found" });
  res.json(row);
});

// ── Generate QBR Report ─────────────────────────────────────────────

router.post("/generate", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const orgId = getOrgId(req);
  const { clientId, quarter, fiscalYear, aegisData, tenantIntel } = req.body;

  if (!clientId) return res.status(400).json({ message: "clientId is required" });

  const now = new Date();
  const q = quarter || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const fy = fiscalYear || now.getFullYear();

  const ctx = agentContext(req);
  const reportData = await buildQbrReportData(
    orgId,
    clientId,
    req.user!.id,
    q,
    fy,
    ctx,
    { aegisData, tenantIntel },
  );

  const client = await storage.getClient(orgId, clientId);
  const reportRecord = await storage.createQbrReport({
    tenantId: orgId,
    clientId,
    title: `${client?.name ?? "Client"} ${q} ${fy} QBR`,
    quarter: q,
    fiscalYear: fy,
    status: "generated",
    generatedBy: req.user!.id,
    reportJson: reportData,
  });

  res.status(201).json(reportRecord);
});

// ── Update QBR Report Status ────────────────────────────────────────

router.patch("/:id", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const row = await storage.updateQbrReport(getOrgId(req), param(req, "id"), req.body);
  if (!row) return res.status(404).json({ message: "QBR report not found" });
  res.json(row);
});

// ── Delete QBR Report ───────────────────────────────────────────────

router.delete("/:id", requireAuth, requireRole(ROLES.MSP_ADMIN), async (req: AuthenticatedRequest, res) => {
  await storage.deleteQbrReport(getOrgId(req), param(req, "id"));
  res.status(204).end();
});

export { router as qbrReportRouter };
