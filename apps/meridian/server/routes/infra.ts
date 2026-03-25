import { storage, requireAuth, verifyDealAccess, requirePerm, logAudit, recalculateDealScores, param, type AuthenticatedRequest } from './_helpers';
import { insertTechStackItemSchema } from "@shared/schema";
import { extractTechStack, extractTopology, compareBaseline, generatePlaybook } from "../infra-extraction";
import { type Express } from "express";

export function registerInfraRoutes(app: Express) {
// ──────── DEAL SUB-RESOURCES (tenant scoped + deal access) ────────

app.get("/api/deals/:id/tech-stack", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const items = await storage.getTechStackByDeal(param(req.params.id));
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tech stack" });
  }
});

app.get("/api/deals/:id/baseline-comparisons", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const comparisons = await storage.getBaselineComparisonsByDeal(param(req.params.id));
    res.json(comparisons);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch baseline comparisons" });
  }
});

app.get("/api/deals/:id/topology", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const [nodes, connections] = await Promise.all([
      storage.getTopologyNodesByDeal(param(req.params.id)),
      storage.getTopologyConnectionsByDeal(param(req.params.id)),
    ]);
    res.json({ nodes, connections });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch topology" });
  }
});

app.post("/api/deals/:id/extract-tech-stack", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await extractTechStack(param(req.params.id));
    if (req.orgId) {
      await logAudit(req.user!.id, req.orgId!, "deal_updated", `Extracted ${result.count} tech stack items`, param(req.params.id));
    }
    const items = await storage.getTechStackByDeal(param(req.params.id));
    res.json({ count: result.count, items });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to extract tech stack" });
  }
});

app.post("/api/deals/:id/extract-topology", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await extractTopology(param(req.params.id));
    if (req.orgId) {
      await logAudit(req.user!.id, req.orgId!, "deal_updated", `Extracted topology: ${result.nodeCount} nodes, ${result.connectionCount} connections`, param(req.params.id));
    }
    const [nodes, connections] = await Promise.all([
      storage.getTopologyNodesByDeal(param(req.params.id)),
      storage.getTopologyConnectionsByDeal(param(req.params.id)),
    ]);
    res.json({ nodeCount: result.nodeCount, connectionCount: result.connectionCount, nodes, connections });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to extract topology" });
  }
});

app.post("/api/deals/:id/compare-baseline", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const deal = await storage.getDeal(param(req.params.id));
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    const dealOrgId = deal.tenantId;
    if (!dealOrgId) return res.status(400).json({ message: "Deal has no organization context" });

    const profiles = await storage.getBaselineProfiles(dealOrgId);
    if (profiles.length === 0) {
      return res.status(400).json({ message: "No baseline profile configured for your organization. Go to Settings > Baseline Profile to create one first." });
    }

    const techStack = await storage.getTechStackByDeal(param(req.params.id));
    if (techStack.length === 0) {
      return res.status(400).json({ message: "No technology stack detected yet. Run 'Extract Tech Stack' first to detect technologies from your documents." });
    }

    const result = await compareBaseline(param(req.params.id), dealOrgId);
    await logAudit(dealOrgId, req.user!.id, "deal_updated", "baseline_comparison", param(req.params.id), { count: result.count });
    const comparisons = await storage.getBaselineComparisonsByDeal(param(req.params.id));
    res.json({ count: result.count, comparisons });
  } catch (error: any) {
    console.error("Baseline comparison failed:", error);
    res.status(500).json({ message: error.message || "Failed to compare baseline" });
  }
});

app.post("/api/deals/:id/generate-infra-analysis", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = param(req.params.id);
    const deal = await storage.getDeal(dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    const dealOrgId = deal.tenantId;
    if (!dealOrgId) return res.status(400).json({ message: "Deal has no organization context" });

    const results: { step: string; count: number }[] = [];

    const techResult = await extractTechStack(dealId);
    results.push({ step: "tech_stack", count: techResult.count });

    const topoResult = await extractTopology(dealId);
    results.push({ step: "topology", count: topoResult.nodeCount });

    const baselineResult = await compareBaseline(dealId, dealOrgId);
    results.push({ step: "baseline", count: baselineResult.count });

    await logAudit(dealOrgId, req.user!.id, "deal_updated", "infra_analysis", dealId, { results });

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to generate infrastructure analysis" });
  }
});

app.post("/api/deals/:id/tech-stack", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = insertTechStackItemSchema.safeParse({ ...req.body, dealId: param(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: "Invalid tech stack item", errors: parsed.error.flatten() });
    const item = await storage.createTechStackItem(parsed.data);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to add tech stack item" });
  }
});

app.get("/api/deals/:id/playbook", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const [phases, tasks] = await Promise.all([
      storage.getPlaybookPhasesByDeal(param(req.params.id)),
      storage.getPlaybookTasksByDeal(param(req.params.id)),
    ]);
    const sorted = phases.sort((a, b) => a.sortOrder - b.sortOrder);
    const result = sorted.map((phase) => ({
      ...phase,
      tasks: tasks
        .filter((t) => t.phaseId === phase.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch playbook" });
  }
});

app.post("/api/deals/:id/generate-playbook", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await generatePlaybook(param(req.params.id));
    res.json(result);
  } catch (error: any) {
    console.error("Playbook generation failed:", error);
    res.status(500).json({ message: error.message || "Failed to generate playbook" });
  }
});

// ──────── SIMULATOR (tenant scoped + deal access) ────────

app.get("/api/deals/:id/simulate/monte-carlo", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const scenario = (req.query.scenario as string) || "phased";
    const dealId = param(req.params.id);

    const techStack = await storage.getTechStackByDeal(dealId);
    const comparisons = await storage.getBaselineComparisonsByDeal(dealId);
    const findings = await storage.getFindingsByDeal(dealId);

    const techCount = techStack.length;
    const criticalGaps = comparisons.filter(c => c.gapSeverity === "critical").length;
    const majorGaps = comparisons.filter(c => c.gapSeverity === "major").length;
    const criticalFindings = findings.filter(f => f.severity === "critical").length;
    const highFindings = findings.filter(f => f.severity === "high").length;

    const complexityFactor = 1 + (techCount * 0.015) + (criticalGaps * 0.08) + (majorGaps * 0.04) + (criticalFindings * 0.06) + (highFindings * 0.03);
    const riskFactor = 1 + (criticalGaps * 0.05) + (criticalFindings * 0.04) + (majorGaps * 0.02);

    const baseParams: Record<string, { mean: number; stddev: number; riskMult: number }> = {
      phased: { mean: 310000, stddev: 45000, riskMult: 0.8 },
      "big-bang": { mean: 230000, stddev: 65000, riskMult: 1.3 },
      "cloud-first": { mean: 370000, stddev: 55000, riskMult: 1.0 },
    };
    const base = baseParams[scenario] || baseParams.phased;
    const mean = Math.round(base.mean * complexityFactor);
    const stddev = Math.round(base.stddev * riskFactor * base.riskMult);

    const iterations = 10000;
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      samples.push(Math.max(0, mean + z * stddev));
    }
    samples.sort((a, b) => a - b);
    const p10 = samples[Math.floor(iterations * 0.1)];
    const p50 = samples[Math.floor(iterations * 0.5)];
    const p90 = samples[Math.floor(iterations * 0.9)];
    const minVal = samples[0];
    const maxVal = samples[samples.length - 1];
    const binCount = 20;
    const binWidth = (maxVal - minVal) / binCount;
    const bins: Array<{ cost_label: string; probability: number; inRange: boolean }> = [];
    for (let i = 0; i < binCount; i++) {
      const lo = minVal + i * binWidth;
      const hi = lo + binWidth;
      const count = samples.filter((s) => s >= lo && (i === binCount - 1 ? s <= hi : s < hi)).length;
      bins.push({
        cost_label: `$${Math.round(lo / 1000)}K`,
        probability: Math.round((count / iterations) * 10000) / 100,
        inRange: lo >= p10 && hi <= p90 + binWidth,
      });
    }

    const inputFactors = [
      { name: "Tech stack complexity", value: techCount, impact: techCount > 10 ? "high" : techCount > 5 ? "medium" : "low" },
      { name: "Critical baseline gaps", value: criticalGaps, impact: criticalGaps > 2 ? "high" : criticalGaps > 0 ? "medium" : "low" },
      { name: "Major baseline gaps", value: majorGaps, impact: majorGaps > 3 ? "high" : majorGaps > 0 ? "medium" : "low" },
      { name: "Critical findings", value: criticalFindings, impact: criticalFindings > 1 ? "high" : criticalFindings > 0 ? "medium" : "low" },
      { name: "High-severity findings", value: highFindings, impact: highFindings > 3 ? "high" : highFindings > 0 ? "medium" : "low" },
    ];

    res.json({
      bins,
      p10: Math.round(p10),
      p50: Math.round(p50),
      p90: Math.round(p90),
      mean: Math.round(mean),
      stddev: Math.round(stddev),
      inputFactors,
      complexityFactor: Math.round(complexityFactor * 100) / 100,
      riskFactor: Math.round(riskFactor * 100) / 100,
    });
  } catch (error) {
    console.error("Simulation failed:", error);
    res.status(500).json({ message: "Failed to run simulation" });
  }
});
}
