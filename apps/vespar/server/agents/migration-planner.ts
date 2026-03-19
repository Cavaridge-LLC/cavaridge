/**
 * Vespar Migration Planner — Layer 3 Product Agent
 *
 * Service layer that composes shared agents (RiskScorerAgent, CostAnalyzerAgent)
 * to orchestrate cloud migration planning workflows. NOT a BaseAgent subclass —
 * this is the domain-specific orchestrator that wires shared agents with
 * Vespar's data model.
 */

import { RiskScorerAgent, CostAnalyzerAgent } from "@cavaridge/agents";
import { storage } from "../storage";
import { createVesparContext } from "./context";
import type {
  Workload,
  Dependency,
  RiskFinding,
  InsertRiskFinding,
  InsertCostProjection,
  Criticality,
  RiskCategory,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskSummary {
  compositeScore: number;
  riskLevel: string;
  breakdown: Record<string, number>;
  narrative: string;
  findingsCount: number;
}

interface CostSummary {
  totalCurrentMonthly: number;
  totalProjectedMonthly: number;
  totalMigrationOnetime: number;
  monthlySavings: number;
  annualSavings: number;
  narrative: string;
}

interface SequencedWorkload {
  workloadId: string;
  workloadName: string;
  phase: number;
  wave: number;
  criticality: string;
  strategy: string | null;
  blockedBy: string[];
}

interface MigrationReadinessResult {
  readinessScore: number;
  riskSummary: RiskSummary;
  costSummary: CostSummary;
  migrationSequence: SequencedWorkload[];
  recommendations: string[];
}

interface RunbookResult {
  title: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Risk weight configuration for migration planning
// ---------------------------------------------------------------------------

const MIGRATION_RISK_WEIGHTS = {
  technical: 0.30,
  operational: 0.25,
  financial: 0.20,
  compliance: 0.15,
  organizational: 0.10,
};

// ---------------------------------------------------------------------------
// Criticality score mapping
// ---------------------------------------------------------------------------

const CRITICALITY_SCORES: Record<string, number> = {
  critical: 90,
  high: 70,
  medium: 45,
  low: 20,
};

const CRITICALITY_ORDER: string[] = ["critical", "high", "medium", "low"];

// ---------------------------------------------------------------------------
// Helper: Build risk findings from workload analysis
// ---------------------------------------------------------------------------

function buildRiskFindingsFromWorkloads(
  workloads: Workload[],
  deps: Dependency[],
  projectId: string,
  tenantId: string,
): InsertRiskFinding[] {
  const findings: InsertRiskFinding[] = [];

  for (const w of workloads) {
    // Database migrations carry high technical risk
    if (w.type === "database") {
      findings.push({
        projectId,
        tenantId,
        workloadId: w.id,
        title: `Database migration risk: ${w.name}`,
        description: `Database workloads require careful data migration planning, schema compatibility checks, and rollback procedures. Type: ${w.type}, Criticality: ${w.criticality}.`,
        severity: w.criticality as Criticality,
        category: "technical" as RiskCategory,
        riskScore: CRITICALITY_SCORES[w.criticality] ?? 45,
        status: "open",
      });
    }

    // Identity workloads carry high operational risk
    if (w.type === "identity") {
      findings.push({
        projectId,
        tenantId,
        workloadId: w.id,
        title: `Identity system migration risk: ${w.name}`,
        description: `Identity and access management migrations affect all dependent services. Requires coordinated cutover and extensive testing.`,
        severity: w.criticality === "low" ? "medium" : (w.criticality as Criticality),
        category: "operational" as RiskCategory,
        riskScore: Math.min(CRITICALITY_SCORES[w.criticality] + 10, 100),
        status: "open",
      });
    }

    // Critical workloads without a strategy are an organizational risk
    if (!w.migrationStrategy && (w.criticality === "critical" || w.criticality === "high")) {
      findings.push({
        projectId,
        tenantId,
        workloadId: w.id,
        title: `No migration strategy defined: ${w.name}`,
        description: `High-criticality workload "${w.name}" has no migration strategy assigned. This delays planning and increases organizational risk.`,
        severity: "high" as Criticality,
        category: "organizational" as RiskCategory,
        riskScore: 65,
        status: "open",
      });
    }

    // Refactor strategy = high technical complexity
    if (w.migrationStrategy === "refactor") {
      findings.push({
        projectId,
        tenantId,
        workloadId: w.id,
        title: `Refactor complexity: ${w.name}`,
        description: `Refactoring "${w.name}" requires application redesign, new architecture patterns, and extended testing cycles.`,
        severity: "high" as Criticality,
        category: "technical" as RiskCategory,
        riskScore: 70,
        status: "open",
      });
    }

    // Workloads with many blocking dependencies
    const blockingDeps = deps.filter(
      (d) => d.targetWorkloadId === w.id && d.blocksMigration,
    );
    if (blockingDeps.length >= 2) {
      findings.push({
        projectId,
        tenantId,
        workloadId: w.id,
        title: `Multiple blocking dependencies: ${w.name}`,
        description: `Workload "${w.name}" has ${blockingDeps.length} blocking dependencies that must complete before migration can begin. This creates sequencing bottlenecks.`,
        severity: "medium" as Criticality,
        category: "operational" as RiskCategory,
        riskScore: 55,
        status: "open",
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Pure function: Topological sort with dependency-aware sequencing
// ---------------------------------------------------------------------------

export function sequenceWorkloads(
  workloads: Workload[],
  deps: Dependency[],
): SequencedWorkload[] {
  const workloadMap = new Map(workloads.map((w) => [w.id, w]));

  // Build adjacency list: source must complete before target
  // (target depends on source — source blocks target)
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  const blockedByMap = new Map<string, string[]>();

  for (const w of workloads) {
    inDegree.set(w.id, 0);
    adjList.set(w.id, []);
    blockedByMap.set(w.id, []);
  }

  // Only blocking dependencies affect sequencing order
  const blockingDeps = deps.filter((d) => d.blocksMigration);
  for (const d of blockingDeps) {
    // sourceWorkloadId blocks targetWorkloadId
    const neighbors = adjList.get(d.sourceWorkloadId);
    if (neighbors) {
      neighbors.push(d.targetWorkloadId);
    }
    inDegree.set(d.targetWorkloadId, (inDegree.get(d.targetWorkloadId) ?? 0) + 1);

    const blocked = blockedByMap.get(d.targetWorkloadId);
    const sourceW = workloadMap.get(d.sourceWorkloadId);
    if (blocked && sourceW) {
      blocked.push(sourceW.name);
    }
  }

  // Kahn's algorithm for topological sort, grouped by phase/level
  const result: SequencedWorkload[] = [];
  let queue: string[] = [];

  for (const [id, deg] of Array.from(inDegree.entries())) {
    if (deg === 0) queue.push(id);
  }

  let phase = 1;
  const visited = new Set<string>();

  while (queue.length > 0) {
    // Sort within this phase by criticality (critical first)
    queue.sort((a, b) => {
      const wA = workloadMap.get(a);
      const wB = workloadMap.get(b);
      const idxA = CRITICALITY_ORDER.indexOf(wA?.criticality ?? "medium");
      const idxB = CRITICALITY_ORDER.indexOf(wB?.criticality ?? "medium");
      return idxA - idxB;
    });

    const nextQueue: string[] = [];
    let wave = 1;

    for (const id of queue) {
      if (visited.has(id)) continue;
      visited.add(id);

      const w = workloadMap.get(id);
      if (!w) continue;

      result.push({
        workloadId: w.id,
        workloadName: w.name,
        phase,
        wave: wave++,
        criticality: w.criticality,
        strategy: w.migrationStrategy,
        blockedBy: blockedByMap.get(w.id) ?? [],
      });

      // Release dependents
      for (const neighbor of adjList.get(id) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0 && !visited.has(neighbor)) {
          nextQueue.push(neighbor);
        }
      }
    }

    queue = nextQueue;
    phase++;
  }

  // Detect cycles: any unvisited workloads are in a cycle
  for (const w of workloads) {
    if (!visited.has(w.id)) {
      result.push({
        workloadId: w.id,
        workloadName: w.name,
        phase: -1, // Flag as cycle member
        wave: 0,
        criticality: w.criticality,
        strategy: w.migrationStrategy,
        blockedBy: ["CIRCULAR DEPENDENCY DETECTED"],
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// analyzeMigrationReadiness
// ---------------------------------------------------------------------------

export async function analyzeMigrationReadiness(
  projectId: string,
  tenantId: string,
  userId: string,
): Promise<MigrationReadinessResult> {
  const ctx = createVesparContext(tenantId, userId);

  // Load all project data
  const [projectWorkloads, projectDeps] = await Promise.all([
    storage.getWorkloadsByProject(projectId, tenantId),
    storage.getDependenciesByProject(projectId, tenantId),
  ]);

  // Generate risk findings from workload analysis
  const generatedFindings = buildRiskFindingsFromWorkloads(
    projectWorkloads,
    projectDeps,
    projectId,
    tenantId,
  );

  // Run risk scoring via shared agent
  let riskSummary: RiskSummary;
  try {
    const scorer = new RiskScorerAgent();
    const output = await scorer.runWithAudit({
      data: {
        findings: generatedFindings.map((f) => ({
          title: f.title,
          severity: f.severity,
          pillar: f.category,
          description: f.description ?? "",
        })),
        weights: MIGRATION_RISK_WEIGHTS,
        generateNarrative: true,
        systemPrompt:
          "You are a cloud migration risk analyst. Evaluate the provided risk findings for a migration project and produce a composite risk score, breakdown by pillar, risk level classification, and a concise narrative summary.",
      },
      context: createVesparContext(tenantId, userId, { agentId: "risk-scorer" }),
    });

    // Convert ScoreBreakdown[] to Record<string, number> for our RiskSummary type
    const breakdownRecord: Record<string, number> = {};
    if (output.result?.breakdown) {
      for (const b of output.result.breakdown) {
        breakdownRecord[b.pillar] = b.weightedScore;
      }
    }

    riskSummary = {
      compositeScore: output.result?.compositeScore ?? computeDeterministicRiskScore(generatedFindings),
      riskLevel: output.result?.riskLevel ?? classifyRiskLevel(computeDeterministicRiskScore(generatedFindings)),
      breakdown: Object.keys(breakdownRecord).length > 0 ? breakdownRecord : computeDeterministicBreakdown(generatedFindings),
      narrative: output.result?.narrative ?? "Risk analysis completed using deterministic scoring.",
      findingsCount: generatedFindings.length,
    };
  } catch {
    // Graceful fallback: deterministic scoring without LLM
    const score = computeDeterministicRiskScore(generatedFindings);
    riskSummary = {
      compositeScore: score,
      riskLevel: classifyRiskLevel(score),
      breakdown: computeDeterministicBreakdown(generatedFindings),
      narrative: "Risk analysis completed using deterministic scoring (agent unavailable).",
      findingsCount: generatedFindings.length,
    };
  }

  // Run cost analysis via shared agent
  let costSummary: CostSummary;
  try {
    const analyzer = new CostAnalyzerAgent();
    const workloadSummary = projectWorkloads
      .map(
        (w) =>
          `- ${w.name} (${w.type}, ${w.criticality}, strategy: ${w.migrationStrategy ?? "undecided"}, effort: ${w.estimatedEffortHours ?? "unknown"}h)`,
      )
      .join("\n");

    const output = await analyzer.runWithAudit({
      data: {
        systemPrompt:
          "You are a cloud migration cost analyst. Analyze the following workloads and provide TCO estimates including current monthly costs, projected cloud costs, one-time migration costs, and potential savings. Use industry benchmarks when specific cost data is unavailable.",
        userPrompt: `Analyze migration costs for the following ${projectWorkloads.length} workloads:\n${workloadSummary}`,
        maxTokens: 2048,
      },
      context: createVesparContext(tenantId, userId, { agentId: "cost-analyzer" }),
    });

    // CostAnalyzerOutput.estimates is CostEstimate[] — aggregate totals from array
    const estimates = output.result?.estimates ?? [];
    const totalLow = estimates.reduce((sum, e) => sum + e.lowEstimate, 0);
    const totalHigh = estimates.reduce((sum, e) => sum + e.highEstimate, 0);
    const avgEstimate = (totalLow + totalHigh) / 2;
    // Use totalRange for overall range; derive savings as difference from current
    const rangeHigh = output.result?.totalRange?.high ?? totalHigh;

    costSummary = {
      totalCurrentMonthly: rangeHigh,
      totalProjectedMonthly: avgEstimate,
      totalMigrationOnetime: totalLow,
      monthlySavings: rangeHigh - avgEstimate,
      annualSavings: (rangeHigh - avgEstimate) * 12,
      narrative: output.result?.narrative ?? "Cost analysis completed.",
    };
  } catch {
    // Graceful fallback: deterministic cost estimation
    costSummary = computeDeterministicCosts(projectWorkloads);
  }

  // Sequence workloads respecting dependencies
  const migrationSequence = sequenceWorkloads(projectWorkloads, projectDeps);

  // Compute overall readiness score (0-100)
  const readinessScore = computeReadinessScore(
    riskSummary,
    costSummary,
    migrationSequence,
    projectWorkloads,
  );

  // Persist readiness score to the project
  await storage.updateProject(projectId, tenantId, { readinessScore });

  // Store generated risk findings
  if (generatedFindings.length > 0) {
    await storage.bulkCreateRisks(generatedFindings);
  }

  // Build recommendations
  const recommendations = buildRecommendations(
    riskSummary,
    costSummary,
    migrationSequence,
    projectWorkloads,
  );

  return {
    readinessScore,
    riskSummary,
    costSummary,
    migrationSequence,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// analyzeWorkloadRisks
// ---------------------------------------------------------------------------

export async function analyzeWorkloadRisks(
  projectId: string,
  tenantId: string,
  userId: string,
): Promise<InsertRiskFinding[]> {
  const [projectWorkloads, projectDeps] = await Promise.all([
    storage.getWorkloadsByProject(projectId, tenantId),
    storage.getDependenciesByProject(projectId, tenantId),
  ]);

  const findings = buildRiskFindingsFromWorkloads(
    projectWorkloads,
    projectDeps,
    projectId,
    tenantId,
  );

  // Attempt agent-enhanced risk scoring
  try {
    const scorer = new RiskScorerAgent();
    await scorer.runWithAudit({
      data: {
        findings: findings.map((f) => ({
          title: f.title,
          severity: f.severity,
          pillar: f.category,
          description: f.description ?? "",
        })),
        weights: MIGRATION_RISK_WEIGHTS,
        generateNarrative: true,
        systemPrompt:
          "You are a cloud migration risk analyst. Score each finding and return a composite assessment. Focus on migration-specific risks: data loss, downtime, compatibility, and rollback complexity.",
      },
      context: createVesparContext(tenantId, userId, { agentId: "risk-scorer" }),
    });
  } catch {
    // Agent unavailable — deterministic scores already assigned in buildRiskFindingsFromWorkloads
  }

  // Persist findings
  if (findings.length > 0) {
    await storage.bulkCreateRisks(findings);
  }

  return findings;
}

// ---------------------------------------------------------------------------
// analyzeWorkloadCosts
// ---------------------------------------------------------------------------

export async function analyzeWorkloadCosts(
  projectId: string,
  tenantId: string,
  userId: string,
): Promise<InsertCostProjection[]> {
  const projectWorkloads = await storage.getWorkloadsByProject(projectId, tenantId);

  let costProjections: InsertCostProjection[] = [];

  try {
    const analyzer = new CostAnalyzerAgent();
    const workloadSummary = projectWorkloads
      .map(
        (w) =>
          `- ${w.name}: type=${w.type}, criticality=${w.criticality}, strategy=${w.migrationStrategy ?? "undecided"}, currentHosting=${w.currentHosting ?? "unknown"}, effort=${w.estimatedEffortHours ?? "unknown"}h`,
      )
      .join("\n");

    const output = await analyzer.runWithAudit({
      data: {
        systemPrompt:
          "You are a cloud migration cost analyst specializing in TCO analysis. For each workload, estimate: current monthly cost, projected cloud monthly cost, one-time migration cost, monthly savings, and annual savings. Use industry benchmarks for workload types when specific data is unavailable. Return structured JSON with per-workload estimates.",
        userPrompt: `Provide per-workload cost projections for:\n${workloadSummary}`,
        maxTokens: 2048,
      },
      context: createVesparContext(tenantId, userId, { agentId: "cost-analyzer" }),
    });

    // Parse agent output into cost projection records
    if (output.result?.estimates && Array.isArray(output.result.estimates)) {
      costProjections = (output.result.estimates as unknown as Array<Record<string, unknown>>).map(
        (est: Record<string, unknown>, idx: number) => ({
          projectId,
          tenantId,
          workloadId: projectWorkloads[idx]?.id ?? null,
          currentMonthlyCost: String(est.currentMonthly ?? "0"),
          projectedMonthlyCost: String(est.projectedMonthly ?? "0"),
          migrationCostOnetime: String(est.migrationOnetime ?? "0"),
          savingsMonthly: String(est.savingsMonthly ?? "0"),
          savingsAnnual: String(est.savingsAnnual ?? "0"),
          assumptions: (est.assumptions as Record<string, unknown>) ?? {},
          costBreakdown: (est.breakdown as Record<string, unknown>) ?? {},
        }),
      );
    }
  } catch {
    // Graceful fallback: deterministic cost estimates based on workload type
    costProjections = projectWorkloads.map((w) => {
      const baseCost = estimateBaseCost(w);
      return {
        projectId,
        tenantId,
        workloadId: w.id,
        currentMonthlyCost: String(baseCost.current),
        projectedMonthlyCost: String(baseCost.projected),
        migrationCostOnetime: String(baseCost.migration),
        savingsMonthly: String(baseCost.current - baseCost.projected),
        savingsAnnual: String((baseCost.current - baseCost.projected) * 12),
        assumptions: { source: "deterministic-estimate", workloadType: w.type },
        costBreakdown: {},
      };
    });
  }

  // Persist cost projections
  if (costProjections.length > 0) {
    await storage.bulkCreateCosts(costProjections);
  }

  return costProjections;
}

// ---------------------------------------------------------------------------
// generateMigrationRunbook
// ---------------------------------------------------------------------------

export async function generateMigrationRunbook(
  projectId: string,
  tenantId: string,
  userId: string,
): Promise<RunbookResult> {
  const [project, projectWorkloads, projectDeps, risks] = await Promise.all([
    storage.getProject(projectId, tenantId),
    storage.getWorkloadsByProject(projectId, tenantId),
    storage.getDependenciesByProject(projectId, tenantId),
    storage.getRisksByProject(projectId, tenantId),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found for tenant ${tenantId}`);
  }

  const sequence = sequenceWorkloads(projectWorkloads, projectDeps);

  // Build comprehensive context for runbook generation
  const workloadList = projectWorkloads
    .map(
      (w) =>
        `  - ${w.name} (${w.type}, ${w.criticality}, strategy: ${w.migrationStrategy ?? "undecided"})`,
    )
    .join("\n");

  const riskList = risks
    .filter((r) => r.status === "open")
    .map((r) => `  - [${r.severity.toUpperCase()}] ${r.title}: ${r.description ?? "No details"}`)
    .join("\n");

  const sequenceList = sequence
    .map(
      (s) =>
        `  Phase ${s.phase}, Wave ${s.wave}: ${s.workloadName} (${s.criticality}, ${s.strategy ?? "undecided"})${s.blockedBy.length > 0 ? ` — blocked by: ${s.blockedBy.join(", ")}` : ""}`,
    )
    .join("\n");

  const title = `Migration Runbook: ${project.name}`;

  // Attempt LLM-generated runbook content
  try {
    // Use CostAnalyzerAgent as a general-purpose LLM wrapper for content generation
    // (In production, this would use a dedicated Report Generator agent)
    const analyzer = new CostAnalyzerAgent();
    const output = await analyzer.runWithAudit({
      data: {
        systemPrompt: `You are a cloud migration architect generating a detailed migration runbook. Output well-structured markdown with clear sections, checklists, and step-by-step procedures.`,
        userPrompt: `Generate a comprehensive migration runbook for the following project:

Project: ${project.name}
Description: ${project.description ?? "N/A"}
Source Environment: ${project.sourceEnvironment}
Target Environment: ${project.targetEnvironment}
Readiness Score: ${project.readinessScore ?? "Not assessed"}

Workloads (${projectWorkloads.length}):
${workloadList}

Open Risks (${risks.filter((r) => r.status === "open").length}):
${riskList || "  None identified"}

Migration Sequence:
${sequenceList}

Include the following sections:
1. Executive Summary
2. Pre-Migration Checklist
3. Migration Phases (aligned with the sequence above)
4. Per-Workload Procedures
5. Rollback Procedures
6. Communication Plan
7. Post-Migration Validation
8. Risk Mitigation Actions`,
        maxTokens: 2048,
      },
      context: createVesparContext(tenantId, userId, { agentId: "runbook-generator" }),
    });

    const content =
      output.result?.narrative ??
      buildDeterministicRunbook(project, projectWorkloads, risks, sequence);

    return { title, content };
  } catch {
    // Deterministic fallback
    const content = buildDeterministicRunbook(project, projectWorkloads, risks, sequence);
    return { title, content };
  }
}

// ---------------------------------------------------------------------------
// Deterministic helpers (fallbacks when agents are unavailable)
// ---------------------------------------------------------------------------

function computeDeterministicRiskScore(findings: InsertRiskFinding[]): number {
  if (findings.length === 0) return 0;
  const totalScore = findings.reduce((sum, f) => sum + (f.riskScore ?? 50), 0);
  return Math.round(totalScore / findings.length);
}

function classifyRiskLevel(score: number): string {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function computeDeterministicBreakdown(
  findings: InsertRiskFinding[],
): Record<string, number> {
  const breakdown: Record<string, { sum: number; count: number }> = {};

  for (const f of findings) {
    const cat = f.category;
    if (!breakdown[cat]) breakdown[cat] = { sum: 0, count: 0 };
    breakdown[cat].sum += f.riskScore ?? 50;
    breakdown[cat].count += 1;
  }

  const result: Record<string, number> = {};
  for (const [cat, data] of Object.entries(breakdown)) {
    result[cat] = Math.round(data.sum / data.count);
  }
  return result;
}

function computeDeterministicCosts(workloads: Workload[]): CostSummary {
  let totalCurrent = 0;
  let totalProjected = 0;
  let totalMigration = 0;

  for (const w of workloads) {
    const base = estimateBaseCost(w);
    totalCurrent += base.current;
    totalProjected += base.projected;
    totalMigration += base.migration;
  }

  return {
    totalCurrentMonthly: totalCurrent,
    totalProjectedMonthly: totalProjected,
    totalMigrationOnetime: totalMigration,
    monthlySavings: totalCurrent - totalProjected,
    annualSavings: (totalCurrent - totalProjected) * 12,
    narrative: "Cost estimates based on workload type benchmarks (agent unavailable).",
  };
}

function estimateBaseCost(w: Workload): {
  current: number;
  projected: number;
  migration: number;
} {
  // Industry-rough benchmarks by workload type
  const costMap: Record<string, { current: number; projected: number; migration: number }> = {
    server: { current: 500, projected: 350, migration: 2000 },
    database: { current: 800, projected: 600, migration: 5000 },
    application: { current: 300, projected: 250, migration: 3000 },
    storage: { current: 200, projected: 100, migration: 1000 },
    network: { current: 150, projected: 100, migration: 1500 },
    identity: { current: 100, projected: 80, migration: 2500 },
    other: { current: 250, projected: 200, migration: 1500 },
  };

  const base = costMap[w.type] ?? costMap.other;

  // Scale by criticality
  const critMultiplier =
    w.criticality === "critical"
      ? 2.0
      : w.criticality === "high"
        ? 1.5
        : w.criticality === "medium"
          ? 1.0
          : 0.7;

  return {
    current: Math.round(base.current * critMultiplier),
    projected: Math.round(base.projected * critMultiplier),
    migration: Math.round(base.migration * critMultiplier),
  };
}

function computeReadinessScore(
  riskSummary: RiskSummary,
  _costSummary: CostSummary,
  sequence: SequencedWorkload[],
  workloads: Workload[],
): number {
  // Start at 100 and deduct based on issues
  let score = 100;

  // Deduct for risk (higher risk = lower readiness)
  score -= Math.round(riskSummary.compositeScore * 0.4);

  // Deduct for workloads without strategy
  const noStrategy = workloads.filter((w) => !w.migrationStrategy).length;
  score -= Math.round((noStrategy / Math.max(workloads.length, 1)) * 20);

  // Deduct for circular dependencies
  const cycles = sequence.filter((s) => s.phase === -1).length;
  score -= cycles * 10;

  // Deduct for critical workloads in early phases
  const criticalEarly = sequence.filter(
    (s) => s.criticality === "critical" && s.phase === 1,
  ).length;
  if (criticalEarly > 3) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function buildRecommendations(
  riskSummary: RiskSummary,
  _costSummary: CostSummary,
  sequence: SequencedWorkload[],
  workloads: Workload[],
): string[] {
  const recs: string[] = [];

  if (riskSummary.compositeScore >= 70) {
    recs.push(
      "High overall risk score detected. Consider a phased pilot migration with non-critical workloads before migrating production systems.",
    );
  }

  const noStrategy = workloads.filter((w) => !w.migrationStrategy);
  if (noStrategy.length > 0) {
    recs.push(
      `${noStrategy.length} workload(s) lack a migration strategy. Assign strategies (rehost, replatform, refactor, etc.) to improve planning accuracy.`,
    );
  }

  const cycles = sequence.filter((s) => s.phase === -1);
  if (cycles.length > 0) {
    recs.push(
      `Circular dependencies detected involving ${cycles.length} workload(s): ${cycles.map((c) => c.workloadName).join(", ")}. Resolve dependency cycles before proceeding.`,
    );
  }

  const dbWorkloads = workloads.filter((w) => w.type === "database");
  if (dbWorkloads.length > 0) {
    recs.push(
      "Database workloads require dedicated migration runbooks with rollback procedures, data validation, and performance benchmarking.",
    );
  }

  const identityWorkloads = workloads.filter((w) => w.type === "identity");
  if (identityWorkloads.length > 0) {
    recs.push(
      "Identity workloads should be migrated last or with a parallel-run period to avoid access disruptions across dependent services.",
    );
  }

  if (recs.length === 0) {
    recs.push(
      "Project appears well-structured for migration. Proceed with detailed per-workload planning.",
    );
  }

  return recs;
}

function buildDeterministicRunbook(
  project: { name: string; description: string | null; sourceEnvironment: string; targetEnvironment: string; readinessScore: number | null },
  workloads: Workload[],
  risks: RiskFinding[],
  sequence: SequencedWorkload[],
): string {
  const openRisks = risks.filter((r) => r.status === "open");
  const phases = new Map<number, SequencedWorkload[]>();
  for (const s of sequence) {
    if (!phases.has(s.phase)) phases.set(s.phase, []);
    phases.get(s.phase)!.push(s);
  }

  let md = `# ${project.name} — Migration Runbook\n\n`;
  md += `## 1. Executive Summary\n\n`;
  md += `Migration from **${project.sourceEnvironment}** to **${project.targetEnvironment}**.\n`;
  md += `${workloads.length} workloads identified. Readiness score: ${project.readinessScore ?? "Not assessed"}.\n`;
  md += `${openRisks.length} open risk(s) require attention.\n\n`;

  md += `## 2. Pre-Migration Checklist\n\n`;
  md += `- [ ] All workloads have assigned migration strategies\n`;
  md += `- [ ] Dependency mapping is complete and validated\n`;
  md += `- [ ] Risk mitigations are documented for all critical/high risks\n`;
  md += `- [ ] Rollback procedures are tested for each phase\n`;
  md += `- [ ] Communication plan distributed to stakeholders\n`;
  md += `- [ ] Backup and recovery procedures verified\n\n`;

  md += `## 3. Migration Phases\n\n`;
  for (const [phase, items] of Array.from(phases.entries()).sort((a, b) => a[0] - b[0])) {
    if (phase === -1) {
      md += `### Blocked — Circular Dependencies\n\n`;
      for (const item of items) {
        md += `- **${item.workloadName}** — BLOCKED: resolve circular dependency before scheduling\n`;
      }
      md += `\n`;
    } else {
      md += `### Phase ${phase}\n\n`;
      for (const item of items) {
        md += `- **Wave ${item.wave}: ${item.workloadName}** (${item.criticality}, ${item.strategy ?? "undecided"})`;
        if (item.blockedBy.length > 0) {
          md += ` — after: ${item.blockedBy.join(", ")}`;
        }
        md += `\n`;
      }
      md += `\n`;
    }
  }

  md += `## 4. Open Risks\n\n`;
  if (openRisks.length === 0) {
    md += `No open risks identified.\n\n`;
  } else {
    for (const r of openRisks) {
      md += `- **[${r.severity.toUpperCase()}]** ${r.title}\n`;
      if (r.mitigation) md += `  - Mitigation: ${r.mitigation}\n`;
    }
    md += `\n`;
  }

  md += `## 5. Rollback Procedures\n\n`;
  md += `Each phase must have a documented rollback procedure tested before execution.\n\n`;

  md += `## 6. Post-Migration Validation\n\n`;
  md += `- [ ] All workloads accessible and functional in target environment\n`;
  md += `- [ ] Performance benchmarks meet or exceed baseline\n`;
  md += `- [ ] Data integrity verified across all migrated databases\n`;
  md += `- [ ] DNS and network routing updated and validated\n`;
  md += `- [ ] Monitoring and alerting configured in target environment\n`;

  return md;
}
