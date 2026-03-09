import { storage, db, eq, dsql, requireAuth, logAudit, verifyDealAccess, requirePerm, checkPlanLimit, incrementUsage, recalculateDealScores, INDUSTRY_WEIGHTS, PILLAR_NAMES, type AuthenticatedRequest, getAccessibleDeals, hasAccessToDeal } from './_helpers';
import { insertDealSchema, insertFindingSchema } from "@shared/schema";
import { type Express } from "express";

export function registerDealRoutes(app: Express) {
app.get("/api/deals", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const dealsList = await getAccessibleDeals(req.user!.id, req.orgId!, req.user!.role as any);
    res.json(dealsList);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deals" });
  }
});

app.get("/api/deals/:id", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const deal = await storage.getDeal(req.params.id);
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    res.json(deal);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deal" });
  }
});

app.post("/api/deals", requireAuth as any, requirePerm("create_deals") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { targetName, industry, stage, facilityCount, userCount, estimatedIntegrationCost } = req.body;
    if (!targetName || !industry || !stage) {
      return res.status(400).json({ message: "targetName, industry, and stage are required" });
    }

    const dealLimit = await checkPlanLimit(req.orgId!, "deals");
    if (!dealLimit.allowed) {
      return res.status(403).json({
        message: "Plan limit reached",
        limitType: "deals",
        current: dealLimit.current,
        limit: dealLimit.limit,
        planTier: dealLimit.planTier,
      });
    }

    const year = new Date().getFullYear();
    const prefix = `MRD-${year}-`;
    const maxResult = await db.execute(
      dsql`SELECT MAX(CAST(SUBSTRING(deal_code FROM ${prefix.length + 1}) AS INTEGER)) as max_num
          FROM deals WHERE deal_code LIKE ${prefix + '%'}`
    );
    const maxNum = (maxResult.rows?.[0] as any)?.max_num || 0;
    let nextNum = maxNum + 1;

    let deal;
    for (let attempt = 0; attempt < 3; attempt++) {
      const dealCode = `MRD-${year}-${String(nextNum).padStart(3, "0")}`;
      try {
        deal = await storage.createDeal({
          dealCode,
          targetName,
          industry,
          stage,
          status: "on-track",
          facilityCount: facilityCount || 0,
          userCount: userCount || 0,
          estimatedIntegrationCost: estimatedIntegrationCost || null,
          compositeScore: "60.0",
          overallConfidence: "insufficient",
          organizationId: req.orgId,
        });
        break;
      } catch (err: any) {
        if (err.code === "23505" && err.constraint === "deals_deal_code_unique" && attempt < 2) {
          nextNum++;
          continue;
        }
        throw err;
      }
    }
    if (!deal) throw new Error("Failed to generate unique deal code");

    const templates = await storage.getPillarTemplates(req.orgId!);
    const industryWeights = INDUSTRY_WEIGHTS[industry] || INDUSTRY_WEIGHTS["Technology/SaaS"];
    if (templates.length > 0) {
      for (const tmpl of templates) {
        const industryW = industryWeights[tmpl.name];
        await storage.createPillar({
          dealId: deal.id,
          pillarName: tmpl.name,
          score: "3.0",
          weight: industryW != null ? String(industryW) : String(tmpl.weight),
          findingCount: 0,
          evidenceConfidence: "0.00",
          confidenceLabel: "insufficient",
          documentCount: 0,
          scoreCap: "3.0",
        });
      }
    } else {
      for (const pillarName of PILLAR_NAMES) {
        await storage.createPillar({
          dealId: deal.id,
          pillarName,
          score: "3.0",
          weight: String(industryWeights[pillarName] || 0.17),
          findingCount: 0,
          evidenceConfidence: "0.00",
          confidenceLabel: "insufficient",
          documentCount: 0,
          scoreCap: "3.0",
        });
      }
    }

    await logAudit(req.orgId!, req.user!.id, "create_deal", "deal", deal.id, { targetName, industry }, req.ip || undefined);

    res.status(201).json(deal);
  } catch (error) {
    console.error("Create deal error:", error);
    res.status(500).json({ message: "Failed to create deal" });
  }
});

app.patch("/api/deals/:id", requireAuth as any, verifyDealAccess as any, requirePerm("edit_deal_metadata") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const deal = await storage.getDeal(req.params.id);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const { stage, status, facilityCount, userCount, estimatedIntegrationCost } = req.body;
    const updates: Record<string, any> = {};
    if (stage !== undefined) updates.stage = stage;
    if (status !== undefined) updates.status = status;
    if (facilityCount !== undefined) updates.facilityCount = facilityCount;
    if (userCount !== undefined) updates.userCount = userCount;
    if (estimatedIntegrationCost !== undefined) updates.estimatedIntegrationCost = estimatedIntegrationCost;

    const updated = await storage.updateDeal(req.params.id, updates);
    await logAudit(req.orgId!, req.user!.id, "deal_updated", "deal", req.params.id, { changes: Object.keys(updates), targetName: deal.targetName }, req.ip || undefined);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update deal" });
  }
});

app.post("/api/deals/:id/findings", requireAuth as any, verifyDealAccess as any, requirePerm("add_findings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = req.params.id;
    const deal = await storage.getDeal(dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const { pillarId, severity, title, description, impactEstimate, sourceCount } = req.body;
    if (!pillarId || !severity || !title) {
      return res.status(400).json({ message: "pillarId, severity, and title are required" });
    }

    const finding = await storage.createFinding({
      dealId,
      pillarId,
      severity,
      title,
      description: description || null,
      impactEstimate: impactEstimate || null,
      sourceCount: sourceCount || 0,
      status: "open",
    });

    await recalculateDealScores(dealId);

    await logAudit(req.orgId!, req.user!.id, "finding_added", "finding", finding.id, { title, severity, dealName: deal.targetName }, req.ip || undefined);

    try {
      const { embedAndMatchFindings } = await import("../finding-matcher");
      embedAndMatchFindings(dealId, deal.organizationId).catch((err: any) =>
        console.error(`Finding cross-ref matching failed for deal ${dealId}:`, err.message)
      );
    } catch {}

    res.status(201).json(finding);
  } catch (error) {
    console.error("Create finding error:", error);
    res.status(500).json({ message: "Failed to create finding" });
  }
});

app.get("/api/deals/:id/pillars", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const pillarsList = await storage.getPillarsByDeal(req.params.id);
    res.json(pillarsList);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pillars" });
  }
});

app.post("/api/deals/:id/recalculate-scores", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    await recalculateDealScores(req.params.id);
    const updatedPillars = await storage.getPillarsByDeal(req.params.id);
    const deal = await storage.getDeal(req.params.id);
    res.json({ pillars: updatedPillars, overallConfidence: deal?.overallConfidence, compositeScore: deal?.compositeScore });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to recalculate scores" });
  }
});

app.post("/api/admin/recalculate-all-scores", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user || !["platform_owner", "platform_admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Platform admin access required" });
    }
    const allDeals = await storage.getDeals();
    let recalculated = 0;
    for (const deal of allDeals) {
      await recalculateDealScores(deal.id);
      recalculated++;
    }
    res.json({ message: `Recalculated scores for ${recalculated} deals` });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to recalculate scores" });
  }
});

app.get("/api/deals/:id/findings", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const findingsList = await storage.getFindingsByDeal(req.params.id);
    res.json(findingsList);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch findings" });
  }
});

app.post("/api/deals/:id/match-findings", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = req.params.id;
    const deal = await storage.getDeal(dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const { embedAndMatchFindings } = await import("../finding-matcher");
    const result = await embedAndMatchFindings(dealId, deal.organizationId);
    res.json({ message: "Matching complete", ...result });
  } catch (error: any) {
    console.error("Finding matching error:", error.message);
    res.status(500).json({ message: "Failed to match findings" });
  }
});

app.get("/api/deals/:id/finding-cross-refs", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = req.params.id;
    const deal = await storage.getDeal(dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const { getCrossReferencesForDeal } = await import("../finding-matcher");
    const crossRefs = await getCrossReferencesForDeal(dealId, deal.organizationId);
    res.json(crossRefs);
  } catch (error: any) {
    console.error("Cross-ref fetch error:", error.message);
    res.status(500).json({ message: "Failed to fetch cross-references" });
  }
});
}
