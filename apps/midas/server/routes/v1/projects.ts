/**
 * Project API — /api/v1/projects
 *
 * Projects with timelines, budgets, priority, dependencies.
 */

import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../services/auth";
import { requireRole } from "@cavaridge/auth/guards";
import { ROLES } from "@cavaridge/auth";
import { insertProjectSchema } from "@shared/schema";
import * as storage from "../../storage";

const router = Router();

function param(req: AuthenticatedRequest, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function getOrgId(req: AuthenticatedRequest): string {
  return req.tenantId ?? req.user!.tenantId ?? req.user!.id;
}

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const clientId = req.query.clientId as string | undefined;
  const roadmapId = req.query.roadmapId as string | undefined;
  const rows = await storage.getProjects(getOrgId(req), roadmapId, clientId);
  res.json(rows);
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const row = await storage.getProject(getOrgId(req), param(req, "id"));
  if (!row) return res.status(404).json({ message: "Project not found" });
  res.json(row);
});

router.post("/", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const parsed = insertProjectSchema.safeParse({
    ...req.body,
    tenantId: getOrgId(req),
  });
  if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
  const row = await storage.createProject(parsed.data);
  res.status(201).json(row);
});

router.patch("/:id", requireAuth, requireRole(ROLES.MSP_TECH), async (req: AuthenticatedRequest, res) => {
  const row = await storage.updateProject(getOrgId(req), param(req, "id"), req.body);
  if (!row) return res.status(404).json({ message: "Project not found" });
  res.json(row);
});

router.delete("/:id", requireAuth, requireRole(ROLES.MSP_ADMIN), async (req: AuthenticatedRequest, res) => {
  await storage.deleteProject(getOrgId(req), param(req, "id"));
  res.status(204).end();
});

export { router as projectRouter };
