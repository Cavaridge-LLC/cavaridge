/**
 * /api/v1/waves — Migration Wave Planning CRUD
 *
 * Waves group workloads by dependencies, complexity, and business priority.
 * Includes auto-generation from dependency analysis.
 * Tenant-scoped, MSP Admin + MSP Tech.
 */

import { Router, type IRouter } from "express";
import { storage } from "../../storage";
import {
  requireAuth,
  requirePermission,
  logAudit,
  type AuthenticatedRequest,
} from "../../auth";
import { createWaveSchema, assignWaveWorkloadsSchema } from "@shared/schema";
import { sequenceWorkloads } from "../../agents/migration-planner";

export const wavesRouter: IRouter = Router();

// POST /api/v1/waves — Create a wave manually
wavesRouter.post(
  "/",
  requireAuth as any,
  requirePermission("manage_workloads") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, ...rest } = req.body;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }
      const parsed = createWaveSchema.parse(rest);
      const wave = await storage.createWave({
        ...parsed,
        projectId,
        tenantId: req.tenantId!,
        scheduledStart: parsed.scheduledStart ? new Date(parsed.scheduledStart) : null,
        scheduledEnd: parsed.scheduledEnd ? new Date(parsed.scheduledEnd) : null,
      });

      await logAudit(
        req.tenantId!,
        req.user!.id,
        "create_wave",
        "wave",
        wave.id,
        { name: parsed.name, projectId },
        req.ip || undefined,
      );

      res.status(201).json(wave);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: (error as any).errors });
      }
      console.error("Error creating wave:", error);
      res.status(500).json({ message: "Failed to create wave" });
    }
  },
);

// GET /api/v1/waves — List waves (requires ?projectId query param)
wavesRouter.get(
  "/",
  requireAuth as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ message: "projectId query parameter is required" });
      }
      const waves = await storage.getWavesByProject(projectId, req.tenantId!);
      res.json(waves);
    } catch (error) {
      console.error("Error fetching waves:", error);
      res.status(500).json({ message: "Failed to fetch waves" });
    }
  },
);

// GET /api/v1/waves/:id — Get single wave with assigned workloads
wavesRouter.get(
  "/:id",
  requireAuth as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

      const wave = await storage.getWave(id, tenantId);
      if (!wave) {
        return res.status(404).json({ message: "Wave not found" });
      }

      const assignments = await storage.getWaveWorkloads(id, tenantId);
      res.json({ ...wave, workloadAssignments: assignments });
    } catch (error) {
      console.error("Error fetching wave:", error);
      res.status(500).json({ message: "Failed to fetch wave" });
    }
  },
);

// PUT /api/v1/waves/:id — Update wave
wavesRouter.put(
  "/:id",
  requireAuth as any,
  requirePermission("manage_workloads") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;
      const tenantId = req.tenantId!;

      const updated = await storage.updateWave(id, tenantId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Wave not found" });
      }

      await logAudit(
        tenantId,
        req.user!.id,
        "update_wave",
        "wave",
        id,
        { changes: Object.keys(req.body) },
        req.ip || undefined,
      );

      res.json(updated);
    } catch (error) {
      console.error("Error updating wave:", error);
      res.status(500).json({ message: "Failed to update wave" });
    }
  },
);

// POST /api/v1/waves/:id/assign — Assign workloads to a wave
wavesRouter.post(
  "/:id/assign",
  requireAuth as any,
  requirePermission("manage_workloads") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const waveId = req.params.id as string;
      const tenantId = req.tenantId!;

      const wave = await storage.getWave(waveId, tenantId);
      if (!wave) {
        return res.status(404).json({ message: "Wave not found" });
      }

      const parsed = assignWaveWorkloadsSchema.parse(req.body);
      const assignments = await storage.assignWorkloadsToWave(
        waveId,
        tenantId,
        parsed.workloadIds,
      );

      await logAudit(
        tenantId,
        req.user!.id,
        "assign_wave_workloads",
        "wave",
        waveId,
        { workloadCount: assignments.length },
        req.ip || undefined,
      );

      res.status(201).json(assignments);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: (error as any).errors });
      }
      console.error("Error assigning workloads to wave:", error);
      res.status(500).json({ message: "Failed to assign workloads" });
    }
  },
);

// POST /api/v1/waves/generate — Auto-generate waves from dependency analysis
wavesRouter.post(
  "/generate",
  requireAuth as any,
  requirePermission("run_analysis") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      const tenantId = req.tenantId!;

      const [projectWorkloads, projectDeps] = await Promise.all([
        storage.getWorkloadsByProject(projectId, tenantId),
        storage.getDependenciesByProject(projectId, tenantId),
      ]);

      if (projectWorkloads.length === 0) {
        return res.status(400).json({ message: "No workloads found for this project" });
      }

      // Run sequencing algorithm
      const sequence = sequenceWorkloads(projectWorkloads, projectDeps);

      // Group by phase
      const phases = new Map<number, typeof sequence>();
      for (const item of sequence) {
        if (!phases.has(item.phase)) phases.set(item.phase, []);
        phases.get(item.phase)!.push(item);
      }

      // Create waves from phases
      const createdWaves = [];
      for (const [phase, items] of Array.from(phases.entries()).sort((a, b) => a[0] - b[0])) {
        const phaseName = phase === -1
          ? "Blocked — Circular Dependencies"
          : `Phase ${phase}`;

        const wave = await storage.createWave({
          projectId,
          tenantId,
          name: phaseName,
          phase: Math.max(phase, 0),
          waveOrder: phase === -1 ? 999 : phase,
          status: phase === -1 ? "blocked" : "draft",
          estimatedDurationDays: items.length * 3, // rough estimate: 3 days per workload
        });

        // Assign workloads to this wave
        const workloadIds = items.map((i) => i.workloadId);
        await storage.assignWorkloadsToWave(wave.id, tenantId, workloadIds);

        createdWaves.push({ ...wave, workloadCount: workloadIds.length });
      }

      await logAudit(
        tenantId,
        req.user!.id,
        "generate_waves",
        "project",
        projectId,
        { wavesCreated: createdWaves.length, workloadCount: projectWorkloads.length },
        req.ip || undefined,
      );

      res.status(201).json({
        wavesCreated: createdWaves.length,
        waves: createdWaves,
        sequence,
      });
    } catch (error) {
      console.error("Error generating waves:", error);
      res.status(500).json({ message: "Failed to generate waves" });
    }
  },
);
