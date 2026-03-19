import { type Express } from "express";
import { storage, requireAuth, readVersion, getAccessibleDeals, type AuthenticatedRequest, recalculateDealScores, db, tenants, auditLog, dsql } from "./_helpers";

export function registerSystemRoutes(app: Express) {
  app.get("/api/version", (_req, res) => {
    const v = readVersion();
    const version = `${v.major}.${v.minor}.${v.patch}`;
    res.json({
      version,
      build: v.build,
      full: `${version}+${v.build}`,
      timestamp: v.timestamp,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
    });
  });

  (async () => {
    try {
      const allDeals = await storage.getDeals();
      for (const deal of allDeals) {
        await recalculateDealScores(deal.id);
      }
      if (allDeals.length > 0) {
        console.log(`[scoring] Recalculated scores for ${allDeals.length} deals`);
      }
    } catch (err) {
      console.error("[scoring] Failed to recalculate on startup:", err);
    }
  })();

  (async () => {
    try {
      const v = readVersion();
      const buildKey = `${v.major}.${v.minor}.${v.patch}+${v.build}`;
      const existing = await db.query.auditLog.findFirst({
        where: (log, { and, eq: eqOp }) =>
          and(eqOp(log.action, "app_deployed"), eqOp(log.resourceId, buildKey)),
      });
      if (!existing) {
        const [anyOrg] = await db.select({ id: tenants.id }).from(tenants).limit(1);
        if (anyOrg) {
          const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
          await db.execute(dsql`
            INSERT INTO users (id, email, name, role, status, is_platform_user)
            VALUES (${SYSTEM_USER_ID}, 'system@platform.internal', 'System', 'platform_owner', 'active', true)
            ON CONFLICT DO NOTHING
          `);
          await db.insert(auditLog).values({
            tenantId: anyOrg.id,
            userId: SYSTEM_USER_ID,
            action: "app_deployed",
            resourceType: "system",
            resourceId: buildKey,
            detailsJson: { version: `${v.major}.${v.minor}.${v.patch}`, build: v.build, timestamp: v.timestamp },
            ipAddress: null,
          });
          console.log(`[version] Logged deploy: MERIDIAN v${buildKey}`);
        }
      }
    } catch (err) {
      console.error("[version] Failed to log deploy:", err);
    }
  })();

  app.get("/api/system-status", async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user && req.orgId) {
        const orgDeals = await storage.getDealsByOrg(req.orgId);
        const activeDeals = orgDeals.filter((d) => d.stage !== "Closed").length;
        const openAlerts = await storage.getAllOpenAlertsByOrg(req.orgId);
        const totalDocuments = orgDeals.reduce((s, d) => s + (d.documentsUploaded || 0), 0);
        res.json({ status: "operational", dbConnected: true, activeDeals, openAlerts: openAlerts.length, totalDocuments, totalFindings: openAlerts.length, uptime: process.uptime() });
      } else {
        res.json({ status: "operational", dbConnected: true, activeDeals: 0, openAlerts: 0, totalDocuments: 0, totalFindings: 0, uptime: process.uptime() });
      }
    } catch (error) {
      res.json({ status: "degraded", dbConnected: false, activeDeals: 0, openAlerts: 0, totalDocuments: 0, totalFindings: 0, uptime: process.uptime() });
    }
  });

  app.get("/api/pipeline-stats", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getPipelineStatsByOrg(req.orgId!);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pipeline stats" });
    }
  });

  app.get("/api/findings", requireAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const allFindings = await storage.getAllOpenAlertsByOrg(req.orgId!);
      res.json(allFindings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch findings" });
    }
  });

  app.get("/api/ai/status", (_req, res) => {
    res.json({ configured: !!process.env.OPENROUTER_API_KEY });
  });
}
