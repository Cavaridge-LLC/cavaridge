import { storage, requireAuth, getAccessibleDeals, type AuthenticatedRequest } from './_helpers';
import { type Express } from "express";

export function registerPortfolioRoutes(app: Express) {
  // ──────── PORTFOLIO (tenant scoped) ────────

  app.get("/api/portfolio/risk-trend", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const snapshots = await storage.getScoreSnapshotsByOrg(req.orgId!);
      const grouped: Record<string, number[]> = {};
      for (const s of snapshots) {
        const d = new Date(s.recordedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(Number(s.score));
      }
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const trend = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, scores]) => {
          const [y, m] = key.split("-");
          const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10;
          return { month: `${months[parseInt(m) - 1]} ${y.slice(2)}`, score: avg };
        });
      res.json(trend);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch risk trend" });
    }
  });

  app.get("/api/portfolio/pillar-matrix", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const [allDeals, allPillars] = await Promise.all([
        storage.getDealsByOrg(req.orgId!),
        storage.getAllPillarsByOrg(req.orgId!),
      ]);
      const pillarNames = Array.from(new Set(allPillars.map((p) => p.pillarName))).sort();
      const dealList = allDeals.map((d) => ({
        id: d.id,
        name: d.targetName,
        compositeScore: d.compositeScore,
      }));
      const matrix: Record<string, Record<string, string | null>> = {};
      for (const name of pillarNames) {
        matrix[name] = {};
        for (const deal of dealList) {
          const p = allPillars.find((pp) => pp.dealId === deal.id && pp.pillarName === name);
          matrix[name][deal.id] = p?.score ?? null;
        }
      }
      res.json({ deals: dealList, pillarNames, matrix });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pillar matrix" });
    }
  });

  app.get("/api/portfolio/finding-trends", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { getPortfolioFindingTrends } = await import("../finding-matcher");
      const trends = await getPortfolioFindingTrends(req.orgId!);
      res.json({ trends });
    } catch (error: any) {
      console.error("Finding trends error:", error.message);
      res.status(500).json({ message: "Failed to fetch finding trends" });
    }
  });
}
