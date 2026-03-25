/**
 * Budget API — /api/v1/budgets
 *
 * CapEx/OpEx projections. Roll-up by quarter and year.
 */

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../services/auth";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { insertBudgetItemSchema } from "@shared/schema";
import * as storage from "../../storage";
import { calculateBudgetRollup } from "../../modules/budget";

const router = Router();

function param(req: AuthenticatedRequest, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function getOrgId(req: AuthenticatedRequest): string {
  return req.tenantId ?? req.user!.tenantId ?? req.user!.id;
}

// ── Budget Items CRUD ───────────────────────────────────────────────

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const clientId = req.query.clientId as string;
  if (!clientId) return res.status(400).json({ message: "clientId query param required" });
  const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined;
  const rows = await storage.getBudgetItems(getOrgId(req), clientId, fiscalYear);
  res.json(rows);
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const row = await storage.getBudgetItem(getOrgId(req), param(req, "id"));
  if (!row) return res.status(404).json({ message: "Budget item not found" });
  res.json(row);
});

router.post("/", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const parsed = insertBudgetItemSchema.safeParse({
    ...req.body,
    tenantId: getOrgId(req),
  });
  if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
  const row = await storage.createBudgetItem(parsed.data);
  res.status(201).json(row);
});

router.patch("/:id", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const row = await storage.updateBudgetItem(getOrgId(req), param(req, "id"), req.body);
  if (!row) return res.status(404).json({ message: "Budget item not found" });
  res.json(row);
});

router.delete("/:id", requireAuth, requireRole(ROLES.MSP_ADMIN), async (req: AuthenticatedRequest, res) => {
  await storage.deleteBudgetItem(getOrgId(req), param(req, "id"));
  res.status(204).end();
});

// ── Budget Rollup ───────────────────────────────────────────────────

router.get("/rollup/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
  const orgId = getOrgId(req);
  const clientId = param(req, "clientId");
  const roadmapId = req.query.roadmapId as string | undefined;
  const items = await storage.getBudgetItems(orgId, clientId);
  const summary = calculateBudgetRollup(items, clientId, roadmapId ?? null);
  res.json(summary);
});

export { router as budgetRouter };
