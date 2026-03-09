import { storage, requireAuth, verifyDealAccess, requirePerm, logAudit, type AuthenticatedRequest } from './_helpers';
import { type Express } from "express";

export function registerDealAccessRoutes(app: Express) {
// ──────── DEAL ACCESS MANAGEMENT ────────

app.get("/api/deals/:id/access", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const accessList = await storage.getDealAccessByDeal(req.params.id);
    res.json(accessList);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deal access" });
  }
});

app.post("/api/deals/:id/access", requireAuth as any, verifyDealAccess as any, requirePerm("edit_deal_metadata") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, accessLevel } = req.body;
    if (!userId || !accessLevel) return res.status(400).json({ message: "userId and accessLevel are required" });

    const da = await storage.createDealAccess({
      dealId: req.params.id,
      userId,
      accessLevel,
      grantedBy: req.user!.id,
    });

    await logAudit(req.orgId!, req.user!.id, "grant_deal_access", "deal_access", da.id, { dealId: req.params.id, userId, accessLevel }, req.ip || undefined);

    res.status(201).json(da);
  } catch (error) {
    res.status(500).json({ message: "Failed to grant deal access" });
  }
});

app.delete("/api/deals/:id/access/:userId", requireAuth as any, verifyDealAccess as any, requirePerm("edit_deal_metadata") as any, async (req: AuthenticatedRequest, res) => {
  try {
    await storage.deleteDealAccess(req.params.id, req.params.userId);
    res.json({ message: "Access revoked" });
  } catch (error) {
    res.status(500).json({ message: "Failed to revoke deal access" });
  }
});
}
