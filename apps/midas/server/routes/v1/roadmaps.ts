/**
 * Roadmap API — /api/v1/roadmaps
 *
 * Multi-year IT roadmaps per client with projects.
 */

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../services/auth";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { insertRoadmapSchema, insertProjectSchema } from "@shared/schema";
import * as storage from "../../storage";

const router = Router();

/** Extract route param safely (Express 5). */
function param(req: AuthenticatedRequest, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function getOrgId(req: AuthenticatedRequest): string {
  return req.tenantId ?? req.user!.tenantId ?? req.user!.id;
}

// ── Roadmaps ────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const clientId = req.query.clientId as string | undefined;
  const rows = await storage.getRoadmaps(getOrgId(req), clientId);
  res.json(rows);
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const row = await storage.getRoadmap(getOrgId(req), param(req, "id"));
  if (!row) return res.status(404).json({ message: "Roadmap not found" });
  res.json(row);
});

router.post("/", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const parsed = insertRoadmapSchema.safeParse({
    ...req.body,
    tenantId: getOrgId(req),
    createdBy: req.user!.id,
  });
  if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
  const row = await storage.createRoadmap(parsed.data);
  res.status(201).json(row);
});

router.patch("/:id", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const row = await storage.updateRoadmap(getOrgId(req), param(req, "id"), req.body);
  if (!row) return res.status(404).json({ message: "Roadmap not found" });
  res.json(row);
});

router.delete("/:id", requireAuth, requireRole(ROLES.MSP_ADMIN), async (req: AuthenticatedRequest, res) => {
  await storage.deleteRoadmap(getOrgId(req), param(req, "id"));
  res.status(204).end();
});

// ── Roadmap Projects ────────────────────────────────────────────────

router.get("/:roadmapId/projects", requireAuth, async (req: AuthenticatedRequest, res) => {
  const rows = await storage.getProjects(getOrgId(req), param(req, "roadmapId"));
  res.json(rows);
});

export { router as roadmapRouter };
