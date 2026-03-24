import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import * as storage from "./storage";
import { requireAuth, type AuthenticatedRequest } from "./services/auth";
import { hasMinimumRole, ROLES, type Role } from "@cavaridge/auth";
import {
  insertClientSchema,
  insertInitiativeSchema,
  insertMeetingSchema,
  insertSnapshotSchema,
  insertCatalogEntrySchema,
  insertOverrideSchema,
} from "@shared/schema";
import type { NativeControl, AdjustedSecurityScoreReport } from "@shared/types/security-scoring";
import {
  matchCompensatingControls,
  generateScoreReport,
  calculateWhatIfScore,
  seedCatalog,
} from "./modules/security-scoring";
import { getScoreTrend } from "./modules/security-scoring/trend";
import { SecurityAdvisorAgent } from "./agents/security-advisor";
import { generateQbrPackage } from "./modules/qbr";

// ── RBAC Middleware ───────────────────────────────────────────────────

function requireRole(minimumRole: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!hasMinimumRole(req.user.role as Role, minimumRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

function getOrgId(req: AuthenticatedRequest): string {
  return req.tenantId ?? req.user!.organizationId ?? req.user!.id;
}

function agentContext(req: AuthenticatedRequest) {
  return {
    tenantId: getOrgId(req),
    userId: req.user!.id,
    appCode: "CVG-MIDAS" as const,
    correlationId: crypto.randomUUID(),
  };
}

// ── Route Registration ───────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  // ═══════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════════

  app.get("/api/clients", requireAuth, async (req: AuthenticatedRequest, res) => {
    const rows = await storage.getClients(getOrgId(req));
    res.json(rows);
  });

  app.get("/api/clients/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    const row = await storage.getClient(getOrgId(req), req.params.id);
    if (!row) return res.status(404).json({ message: "Client not found" });
    res.json(row);
  });

  app.post("/api/clients", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const parsed = insertClientSchema.safeParse({ ...req.body, tenantId: getOrgId(req) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createClient(parsed.data);
    res.status(201).json(row);
  });

  // ═══════════════════════════════════════════════════════════════════
  // INITIATIVES
  // ═══════════════════════════════════════════════════════════════════

  app.get("/api/clients/:clientId/initiatives", requireAuth, async (req: AuthenticatedRequest, res) => {
    const rows = await storage.getInitiatives(getOrgId(req), req.params.clientId);
    res.json(rows);
  });

  app.post("/api/initiatives", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const parsed = insertInitiativeSchema.safeParse({ ...req.body, tenantId: getOrgId(req) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createInitiative(parsed.data);
    res.status(201).json(row);
  });

  app.patch("/api/initiatives/:id", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const row = await storage.updateInitiative(getOrgId(req), req.params.id, req.body);
    if (!row) return res.status(404).json({ message: "Initiative not found" });
    res.json(row);
  });

  app.delete("/api/initiatives/:id", requireAuth, requireRole(ROLES.TENANT_ADMIN), async (req: AuthenticatedRequest, res) => {
    await storage.deleteInitiative(getOrgId(req), req.params.id);
    res.status(204).end();
  });

  app.patch("/api/initiatives/reorder/batch", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const updates: { id: string; quarter: string; sortOrder: number }[] = req.body.updates;
    if (!Array.isArray(updates)) return res.status(400).json({ message: "updates array required" });
    for (const u of updates) {
      await storage.updateInitiative(getOrgId(req), u.id, { quarter: u.quarter, sortOrder: u.sortOrder });
    }
    res.json({ ok: true });
  });

  app.patch("/api/initiatives/:id/complete", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const row = await storage.updateInitiative(getOrgId(req), req.params.id, {
      status: "Completed",
      completedAt: new Date(),
    });
    if (!row) return res.status(404).json({ message: "Initiative not found" });
    res.json({ ...row, needsRescore: !!row.controlId });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MEETINGS
  // ═══════════════════════════════════════════════════════════════════

  app.get("/api/meetings", requireAuth, async (req: AuthenticatedRequest, res) => {
    const clientId = req.query.clientId as string | undefined;
    const rows = await storage.getMeetings(getOrgId(req), clientId);
    res.json(rows);
  });

  app.get("/api/meetings/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    const row = await storage.getMeeting(getOrgId(req), req.params.id);
    if (!row) return res.status(404).json({ message: "Meeting not found" });
    res.json(row);
  });

  app.post("/api/meetings", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const parsed = insertMeetingSchema.safeParse({ ...req.body, tenantId: getOrgId(req) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createMeeting(parsed.data);
    res.status(201).json(row);
  });

  app.patch("/api/meetings/:id", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const row = await storage.updateMeeting(getOrgId(req), req.params.id, req.body);
    if (!row) return res.status(404).json({ message: "Meeting not found" });
    res.json(row);
  });

  app.delete("/api/meetings/:id", requireAuth, requireRole(ROLES.TENANT_ADMIN), async (req: AuthenticatedRequest, res) => {
    await storage.deleteMeeting(getOrgId(req), req.params.id);
    res.status(204).end();
  });

  // ═══════════════════════════════════════════════════════════════════
  // SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════

  app.get("/api/clients/:clientId/snapshot", requireAuth, async (req: AuthenticatedRequest, res) => {
    const row = await storage.getSnapshot(getOrgId(req), req.params.clientId);
    if (!row) return res.status(404).json({ message: "Snapshot not found" });
    res.json(row);
  });

  app.put("/api/clients/:clientId/snapshot", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const data = { ...req.body, clientId: req.params.clientId, tenantId: getOrgId(req) };
    const parsed = insertSnapshotSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.upsertSnapshot(parsed.data);
    res.json(row);
  });

  // ═══════════════════════════════════════════════════════════════════
  // COMPENSATING CONTROL CATALOG (platform-scoped)
  // ═══════════════════════════════════════════════════════════════════

  app.get("/api/scoring/catalog", requireAuth, async (_req, res) => {
    const rows = await storage.getCatalogEntries();
    res.json(rows);
  });

  app.post("/api/scoring/catalog", requireAuth, requireRole(ROLES.PLATFORM_ADMIN), async (req: AuthenticatedRequest, res) => {
    const parsed = insertCatalogEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createCatalogEntry(parsed.data);
    res.status(201).json(row);
  });

  app.patch("/api/scoring/catalog/:id", requireAuth, requireRole(ROLES.PLATFORM_ADMIN), async (req: AuthenticatedRequest, res) => {
    const row = await storage.updateCatalogEntry(req.params.id, req.body);
    if (!row) return res.status(404).json({ message: "Catalog entry not found" });
    res.json(row);
  });

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY SCORING OVERRIDES (per-client)
  // ═══════════════════════════════════════════════════════════════════

  app.get("/api/clients/:clientId/scoring/overrides", requireAuth, async (req: AuthenticatedRequest, res) => {
    const rows = await storage.getOverrides(getOrgId(req), req.params.clientId);
    res.json(rows);
  });

  app.post("/api/clients/:clientId/scoring/overrides", requireAuth, requireRole(ROLES.TENANT_ADMIN), async (req: AuthenticatedRequest, res) => {
    const data = {
      ...req.body,
      tenantId: getOrgId(req),
      clientId: req.params.clientId,
      setBy: req.user!.id,
    };
    const parsed = insertOverrideSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.setOverride(parsed.data);
    res.status(201).json(row);
  });

  app.delete("/api/clients/:clientId/scoring/overrides/:controlId", requireAuth, requireRole(ROLES.TENANT_ADMIN), async (req: AuthenticatedRequest, res) => {
    await storage.deleteOverride(getOrgId(req), req.params.clientId, req.params.controlId);
    res.status(204).end();
  });

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY SCORE CALCULATION & HISTORY
  // ═══════════════════════════════════════════════════════════════════

  app.post("/api/clients/:clientId/scoring/calculate", requireAuth, requireRole(ROLES.TENANT_ADMIN), async (req: AuthenticatedRequest, res) => {
    const orgId = getOrgId(req);
    const { clientId } = req.params;
    const { nativeControls, vendor = "microsoft", detectedSignals = [] } = req.body as {
      nativeControls: NativeControl[];
      vendor?: "microsoft" | "google";
      detectedSignals?: Array<{ signalType: string; value: string }>;
    };

    if (!nativeControls || !Array.isArray(nativeControls)) {
      return res.status(400).json({ message: "nativeControls array is required" });
    }

    const matchResults = await matchCompensatingControls(orgId, clientId, nativeControls, detectedSignals);
    const report = await generateScoreReport(orgId, clientId, vendor, nativeControls, matchResults);
    res.json(report);
  });

  app.get("/api/clients/:clientId/scoring/latest", requireAuth, async (req: AuthenticatedRequest, res) => {
    const row = await storage.getLatestScore(getOrgId(req), req.params.clientId);
    if (!row) return res.status(404).json({ message: "No score history found" });
    res.json(row.reportJson);
  });

  app.get("/api/clients/:clientId/scoring/history", requireAuth, async (req: AuthenticatedRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const rows = await storage.getScoreHistory(getOrgId(req), req.params.clientId, limit);
    res.json(rows.map((r) => ({
      id: r.id,
      nativeScore: Number(r.nativeScore),
      adjustedScore: Number(r.adjustedScore),
      realGapCount: r.realGapCount,
      compensatedCount: r.compensatedCount,
      generatedAt: r.generatedAt,
    })));
  });

  app.get("/api/clients/:clientId/scoring/trend", requireAuth, async (req: AuthenticatedRequest, res) => {
    const trend = await getScoreTrend(getOrgId(req), req.params.clientId);
    if (!trend) return res.json({ dataPoints: [], trendDirection: "stable", significantChanges: [] });
    res.json(trend);
  });

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY ADVISOR AGENT
  // ═══════════════════════════════════════════════════════════════════

  app.post("/api/clients/:clientId/advisor/analyze", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const orgId = getOrgId(req);
    const latest = await storage.getLatestScore(orgId, req.params.clientId);
    if (!latest) return res.status(404).json({ message: "No score data. Run a score calculation first." });

    const report = latest.reportJson as AdjustedSecurityScoreReport;
    const advisor = new SecurityAdvisorAgent();
    const ctx = agentContext(req);

    const output = await advisor.runWithAudit({
      data: {
        tenantId: orgId,
        clientId: req.params.clientId,
        scoreReport: report,
        clientContext: req.body.clientContext,
        focus: req.body.focus,
      },
      context: ctx,
    });

    res.json(output.result);
  });

  app.post("/api/clients/:clientId/advisor/what-if", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const orgId = getOrgId(req);
    const latest = await storage.getLatestScore(orgId, req.params.clientId);
    if (!latest) return res.status(404).json({ message: "No score data" });

    const report = latest.reportJson as AdjustedSecurityScoreReport;
    const { gapIds } = req.body as { gapIds: string[] };

    if (!gapIds || !Array.isArray(gapIds)) {
      return res.status(400).json({ message: "gapIds array is required" });
    }

    const result = calculateWhatIfScore(report, gapIds);
    res.json({
      ...result,
      currentScore: report.adjustedScore,
      gapsResolved: gapIds,
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QBR PACKAGE
  // ═══════════════════════════════════════════════════════════════════

  app.post("/api/clients/:clientId/qbr/generate", requireAuth, requireRole(ROLES.USER), async (req: AuthenticatedRequest, res) => {
    const orgId = getOrgId(req);
    const ctx = agentContext(req);
    const pkg = await generateQbrPackage(orgId, req.params.clientId, req.user!.id, ctx);
    res.json(pkg);
  });

  // ═══════════════════════════════════════════════════════════════════
  // ROADMAP FROM GAPS
  // ═══════════════════════════════════════════════════════════════════

  app.post("/api/clients/:clientId/roadmap/from-gaps", requireAuth, requireRole(ROLES.TENANT_ADMIN), async (req: AuthenticatedRequest, res) => {
    const orgId = getOrgId(req);
    const { clientId } = req.params;

    const latest = await storage.getLatestScore(orgId, clientId);
    if (!latest) return res.status(404).json({ message: "No score data" });

    const report = latest.reportJson as AdjustedSecurityScoreReport;
    const created = [];

    for (const gap of report.realGaps) {
      const initiative = await storage.createInitiative({
        tenantId: orgId,
        clientId,
        title: `Remediate: ${gap.controlName}`,
        description: gap.vendorRecommendation,
        team: "Security",
        priority: gap.roadmapPriority <= 3 ? "Critical" : gap.roadmapPriority <= 6 ? "High" : "Medium",
        status: "Proposed",
        quarter: "Backlog",
        cost: gap.estimatedEffort === "high" ? "$10k+" : gap.estimatedEffort === "medium" ? "$2k - $5k" : "< $2k",
        businessProblem: `Security gap: ${gap.controlName} in ${gap.category}. ${gap.pointsAtStake} points at stake.`,
        serviceArea: gap.category,
        sortOrder: gap.roadmapPriority,
        source: "security_gap",
        controlId: gap.controlId,
      });
      created.push(initiative);
    }

    res.status(201).json({ created: created.length, initiatives: created });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SEED (dev convenience)
  // ═══════════════════════════════════════════════════════════════════

  app.post("/api/seed", requireAuth, async (req: AuthenticatedRequest, res) => {
    const orgId = getOrgId(req);
    const existingClients = await storage.getClients(orgId);
    if (existingClients.length > 0) {
      return res.json({ message: "Already seeded", clients: existingClients });
    }

    const catalogCount = await seedCatalog();

    const acme = await storage.createClient({ tenantId: orgId, name: "Acme Corp", industry: "Manufacturing", headcount: 120 });
    const globex = await storage.createClient({ tenantId: orgId, name: "Globex Inc", industry: "Finance", headcount: 85 });
    const initech = await storage.createClient({ tenantId: orgId, name: "Initech Solutions", industry: "Professional Services", headcount: 55 });

    const acmeInits = [
      { clientId: acme.id, title: "Migrate to Microsoft 365", description: "Move all email and file storage to M365 environment.", team: "Cloud", priority: "High", status: "In Progress", quarter: "Q1 2026", cost: "$5k - $10k", businessProblem: "Employees struggling with remote collaboration.", sortOrder: 0 },
      { clientId: acme.id, title: "MFA Enforcement", description: "Enforce Multi-Factor Auth across all user accounts.", team: "Security", priority: "Critical", status: "Completed", quarter: "Q1 2026", cost: "< $1k", businessProblem: "High risk of compromised credentials.", sortOrder: 1 },
      { clientId: acme.id, title: "Network Switch Upgrade", description: "Replace end-of-life core switches.", team: "Infrastructure", priority: "High", status: "Planned", quarter: "Q2 2026", cost: "$15k", businessProblem: "Frequent network drops.", sortOrder: 0 },
      { clientId: acme.id, title: "Security Awareness Training", description: "Roll out phishing simulation and training.", team: "Security", priority: "Medium", status: "Planned", quarter: "Q2 2026", cost: "$2k/yr", sortOrder: 1 },
      { clientId: acme.id, title: "Disaster Recovery Test", description: "Annual DR testing and validation.", team: "Strategy", priority: "High", status: "Planned", quarter: "Q2 2026", cost: "Included", businessProblem: "Uncertainty around RTO.", sortOrder: 2 },
      { clientId: acme.id, title: "Server Virtualization", description: "Virtualize remaining on-prem legacy servers.", team: "Infrastructure", priority: "Medium", status: "Proposed", quarter: "Q3 2026", cost: "$20k", sortOrder: 0 },
      { clientId: acme.id, title: "Compliance Audit", description: "SOC2 readiness assessment.", team: "Strategy", priority: "High", status: "Proposed", quarter: "Q3 2026", cost: "$12k", businessProblem: "Losing enterprise deals.", sortOrder: 1 },
      { clientId: acme.id, title: "Workstation Refresh", description: "Replace 25 laptops reaching 4-year lifecycle.", team: "Infrastructure", priority: "Medium", status: "Proposed", quarter: "Q4 2026", cost: "$35k", businessProblem: "Slow hardware.", sortOrder: 0 },
    ];
    for (const init of acmeInits) {
      await storage.createInitiative({ ...init, tenantId: orgId, source: "manual" });
    }

    await storage.upsertSnapshot({ tenantId: orgId, clientId: acme.id, engagementScore: 84, goalsAligned: 3, riskLevel: "Elevated", budgetTotal: 62000, adoptionPercent: 68, roiStatus: "On track" });

    await storage.createMeeting({ tenantId: orgId, clientId: acme.id, clientName: "Acme Corp", title: "Q2 Executive Business Review", type: "QBR", state: "Scheduled", dateLabel: "Apr 18, 2026", attendees: ["CEO", "COO", "IT Manager", "vCIO"], agenda: "1) Executive Snapshot\n2) Progress vs last quarter\n3) Top risks\n4) Roadmap approvals\n5) Next quarter priorities", notes: "" });
    await storage.createMeeting({ tenantId: orgId, clientId: globex.id, clientName: "Globex Inc", title: "Security & Compliance Review", type: "Security Review", state: "Draft", dateLabel: "TBD", attendees: ["CFO", "Operations", "Security Lead", "vCIO"], agenda: "Review insurance requirements, MFA coverage, backups.", notes: "" });
    await storage.createMeeting({ tenantId: orgId, clientId: initech.id, clientName: "Initech Solutions", title: "FY Planning Workshop", type: "Strategy Review", state: "Closed", dateLabel: "Jan 12, 2026", attendees: ["CEO", "VP Ops", "Finance", "vCIO"], agenda: "Align 3-year goals to technology roadmap.", notes: "Priorities confirmed.", executiveSummary: "Leadership aligned on focused FY26 plan.", nextSteps: ["Finalize Q1-Q2 delivery plan", "Send board pack", "Schedule stakeholder check-in"] });

    res.status(201).json({ message: "Seeded successfully", clientIds: [acme.id, globex.id, initech.id], catalogEntries: catalogCount });
  });

  return httpServer;
}
