/**
 * /api/v1/reports — Migration Readiness Report Generation
 *
 * Generates structured migration readiness reports with:
 * - Inventory summary
 * - Strategy recommendations
 * - Wave plan
 * - Cost projections
 * - Risk register
 *
 * Returns JSON report structure (DOCX rendering handled by client or
 * @cavaridge/agents ReportGeneratorAgent in production).
 */

import { Router, type IRouter } from "express";
import { storage } from "../../storage";
import {
  requireAuth,
  requirePermission,
  logAudit,
  type AuthenticatedRequest,
} from "../../auth";
import { sequenceWorkloads } from "../../agents/migration-planner";

export const reportsRouter: IRouter = Router();

// POST /api/v1/reports/readiness — Generate migration readiness report
reportsRouter.post(
  "/readiness",
  requireAuth as any,
  requirePermission("view_analysis") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      const tenantId = req.tenantId!;

      const project = await storage.getProject(projectId, tenantId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const [projectWorkloads, deps, risks, costs, projectRunbooks, waves] = await Promise.all([
        storage.getWorkloadsByProject(projectId, tenantId),
        storage.getDependenciesByProject(projectId, tenantId),
        storage.getRisksByProject(projectId, tenantId),
        storage.getCostsByProject(projectId, tenantId),
        storage.getRunbooksByProject(projectId, tenantId),
        storage.getWavesByProject(projectId, tenantId),
      ]);

      const sequence = sequenceWorkloads(projectWorkloads, deps);

      // Build report structure
      const report = buildReadinessReport(
        project,
        projectWorkloads,
        deps,
        risks,
        costs,
        projectRunbooks,
        waves,
        sequence,
      );

      await logAudit(
        tenantId,
        req.user!.id,
        "generate_report",
        "project",
        projectId,
        { reportType: "readiness" },
        req.ip || undefined,
      );

      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  },
);

// POST /api/v1/reports/readiness/markdown — Generate markdown version
reportsRouter.post(
  "/readiness/markdown",
  requireAuth as any,
  requirePermission("view_analysis") as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      const tenantId = req.tenantId!;

      const project = await storage.getProject(projectId, tenantId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const [projectWorkloads, deps, risks, costs, , waves] = await Promise.all([
        storage.getWorkloadsByProject(projectId, tenantId),
        storage.getDependenciesByProject(projectId, tenantId),
        storage.getRisksByProject(projectId, tenantId),
        storage.getCostsByProject(projectId, tenantId),
        storage.getRunbooksByProject(projectId, tenantId),
        storage.getWavesByProject(projectId, tenantId),
      ]);

      const sequence = sequenceWorkloads(projectWorkloads, deps);
      const markdown = buildReadinessMarkdown(project, projectWorkloads, risks, costs, waves, sequence);

      res.json({ markdown, projectId, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Error generating markdown report:", error);
      res.status(500).json({ message: "Failed to generate markdown report" });
    }
  },
);

// -- Report builders --

interface ReportProject {
  id: string;
  name: string;
  description: string | null;
  sourceEnvironment: string;
  targetEnvironment: string;
  status: string;
  readinessScore: number | null;
}

function buildReadinessReport(
  project: ReportProject,
  workloads: Array<{ id: string; name: string; type: string; criticality: string; migrationStrategy: string | null; status: string; estimatedEffortHours: number | null }>,
  deps: Array<{ sourceWorkloadId: string; targetWorkloadId: string; dependencyType: string; blocksMigration: boolean }>,
  risks: Array<{ id: string; title: string; severity: string; category: string; status: string; riskScore: number | null; mitigation: string | null }>,
  costs: Array<{ workloadId: string | null; currentMonthlyCost: string | null; projectedMonthlyCost: string | null; migrationCostOnetime: string | null }>,
  runbooks: Array<{ id: string; title: string; status: string }>,
  waves: Array<{ id: string; name: string; phase: number; status: string; estimatedDurationDays: number | null }>,
  sequence: Array<{ workloadId: string; workloadName: string; phase: number; wave: number; criticality: string; strategy: string | null; blockedBy: string[] }>,
) {
  // Inventory summary
  const inventorySummary = {
    totalWorkloads: workloads.length,
    byType: countBy(workloads, "type"),
    byCriticality: countBy(workloads, "criticality"),
    byStrategy: countBy(workloads, "migrationStrategy"),
    byStatus: countBy(workloads, "status"),
    totalEffortHours: workloads.reduce((sum, w) => sum + (w.estimatedEffortHours ?? 0), 0),
  };

  // Strategy recommendations
  const strategyBreakdown = workloads.reduce(
    (acc: Record<string, string[]>, w) => {
      const strategy = w.migrationStrategy ?? "unclassified";
      if (!acc[strategy]) acc[strategy] = [];
      acc[strategy].push(w.name);
      return acc;
    },
    {},
  );

  // Dependency analysis
  const blockingDeps = deps.filter((d) => d.blocksMigration);
  const dependencyAnalysis = {
    totalDependencies: deps.length,
    blockingDependencies: blockingDeps.length,
    byType: countBy(deps, "dependencyType"),
  };

  // Risk register
  const openRisks = risks.filter((r) => r.status === "open");
  const riskRegister = {
    totalRisks: risks.length,
    openRisks: openRisks.length,
    bySeverity: countBy(risks, "severity"),
    byCategory: countBy(risks, "category"),
    criticalAndHigh: risks.filter((r) => r.severity === "critical" || r.severity === "high"),
  };

  // Cost projections summary
  const costSummary = {
    totalCurrentMonthly: sumCostField(costs, "currentMonthlyCost"),
    totalProjectedMonthly: sumCostField(costs, "projectedMonthlyCost"),
    totalMigrationOnetime: sumCostField(costs, "migrationCostOnetime"),
    monthlySavings: sumCostField(costs, "currentMonthlyCost") - sumCostField(costs, "projectedMonthlyCost"),
    annualSavings: (sumCostField(costs, "currentMonthlyCost") - sumCostField(costs, "projectedMonthlyCost")) * 12,
    projectionCount: costs.length,
  };

  // Wave plan
  const wavePlan = waves.map((w) => ({
    ...w,
    workloads: sequence
      .filter((s) => s.phase === w.phase)
      .map((s) => ({ id: s.workloadId, name: s.workloadName, strategy: s.strategy })),
  }));

  return {
    reportType: "migration-readiness",
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      sourceEnvironment: project.sourceEnvironment,
      targetEnvironment: project.targetEnvironment,
      status: project.status,
      readinessScore: project.readinessScore,
    },
    inventorySummary,
    strategyBreakdown,
    dependencyAnalysis,
    wavePlan,
    costSummary,
    riskRegister,
    runbooks: runbooks.map((r) => ({ id: r.id, title: r.title, status: r.status })),
    migrationSequence: sequence,
  };
}

function buildReadinessMarkdown(
  project: ReportProject,
  workloads: Array<{ name: string; type: string; criticality: string; migrationStrategy: string | null; estimatedEffortHours: number | null }>,
  risks: Array<{ title: string; severity: string; category: string; status: string; mitigation: string | null }>,
  costs: Array<{ workloadId: string | null; currentMonthlyCost: string | null; projectedMonthlyCost: string | null; migrationCostOnetime: string | null }>,
  waves: Array<{ name: string; phase: number; status: string; estimatedDurationDays: number | null }>,
  sequence: Array<{ workloadName: string; phase: number; wave: number; criticality: string; strategy: string | null; blockedBy: string[] }>,
): string {
  let md = `# Migration Readiness Report: ${project.name}\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Source:** ${project.sourceEnvironment} | **Target:** ${project.targetEnvironment}\n`;
  md += `**Readiness Score:** ${project.readinessScore ?? "Not assessed"}/100\n\n`;

  // Inventory
  md += `## 1. Infrastructure Inventory\n\n`;
  md += `| Workload | Type | Criticality | Strategy | Est. Hours |\n`;
  md += `|----------|------|-------------|----------|------------|\n`;
  for (const w of workloads) {
    md += `| ${w.name} | ${w.type} | ${w.criticality} | ${w.migrationStrategy ?? "unclassified"} | ${w.estimatedEffortHours ?? "-"} |\n`;
  }
  md += `\n`;

  // Strategy
  md += `## 2. Strategy Recommendations\n\n`;
  const strategyCounts: Record<string, number> = {};
  for (const w of workloads) {
    const s = w.migrationStrategy ?? "unclassified";
    strategyCounts[s] = (strategyCounts[s] || 0) + 1;
  }
  for (const [strategy, count] of Object.entries(strategyCounts)) {
    md += `- **${strategy}**: ${count} workload(s)\n`;
  }
  md += `\n`;

  // Wave Plan
  md += `## 3. Migration Wave Plan\n\n`;
  if (waves.length > 0) {
    for (const w of waves) {
      md += `### ${w.name} (${w.status})\n`;
      md += `Estimated duration: ${w.estimatedDurationDays ?? "TBD"} days\n\n`;
      const phaseItems = sequence.filter((s) => s.phase === w.phase);
      for (const item of phaseItems) {
        md += `- **${item.workloadName}** (${item.criticality}, ${item.strategy ?? "unclassified"})`;
        if (item.blockedBy.length > 0) md += ` — after: ${item.blockedBy.join(", ")}`;
        md += `\n`;
      }
      md += `\n`;
    }
  } else {
    md += `No waves have been generated yet. Run wave generation first.\n\n`;
  }

  // Cost Projections
  md += `## 4. Cost Projections\n\n`;
  const totalCurrent = sumCostField(costs, "currentMonthlyCost");
  const totalProjected = sumCostField(costs, "projectedMonthlyCost");
  const totalMigration = sumCostField(costs, "migrationCostOnetime");
  md += `| Metric | Amount |\n`;
  md += `|--------|--------|\n`;
  md += `| Current Monthly Cost | $${totalCurrent.toLocaleString()} |\n`;
  md += `| Projected Monthly Cost | $${totalProjected.toLocaleString()} |\n`;
  md += `| Monthly Savings | $${(totalCurrent - totalProjected).toLocaleString()} |\n`;
  md += `| Annual Savings | $${((totalCurrent - totalProjected) * 12).toLocaleString()} |\n`;
  md += `| One-Time Migration Cost | $${totalMigration.toLocaleString()} |\n`;
  md += `\n`;

  // Risk Register
  md += `## 5. Risk Register\n\n`;
  const openRisks = risks.filter((r) => r.status === "open");
  if (openRisks.length === 0) {
    md += `No open risks identified.\n\n`;
  } else {
    md += `| Risk | Severity | Category | Mitigation |\n`;
    md += `|------|----------|----------|------------|\n`;
    for (const r of openRisks) {
      md += `| ${r.title} | ${r.severity} | ${r.category} | ${r.mitigation ?? "None defined"} |\n`;
    }
    md += `\n`;
  }

  md += `---\n*Powered by Ducky Intelligence.*\n`;

  return md;
}

// Utility helpers

function countBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce(
    (acc: Record<string, number>, item) => {
      const val = String(item[key] ?? "unknown");
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    },
    {},
  );
}

function sumCostField(
  costs: Array<Record<string, unknown>>,
  field: string,
): number {
  return costs.reduce((sum, c) => sum + (parseFloat(String(c[field] ?? "0")) || 0), 0);
}
