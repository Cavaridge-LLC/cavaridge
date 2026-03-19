import { storage, db, dsql, eq, requireAuth, requirePlatformRole, requirePlatformOwner, logAudit, hashPassword, isPlatformRole, crypto, type AuthenticatedRequest } from './_helpers';
import { type Express } from "express";
import { emailService } from "../email";

export function registerPlatformRoutes(app: Express) {
app.get("/api/platform/organizations", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const orgs = await storage.getAllOrganizations();
    const orgsWithStats = await Promise.all(orgs.map(async (org) => {
      const userCount = await storage.getUserCount(org.id);
      const dealCount = await storage.getDealCountByOrg(org.id);
      const baselineProfiles = await storage.getBaselineProfiles(org.id);
      return { ...org, userCount, dealCount, hasBaseline: baselineProfiles.length > 0, baselineCount: baselineProfiles.length };
    }));
    res.json(orgsWithStats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
});

app.patch("/api/platform/organizations/:orgId", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;
    const org = await storage.getOrganization(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    const { planTier, maxUsers, maxDeals, maxStorageMb, isActive } = req.body;
    const updates: any = {};
    if (planTier !== undefined) updates.planTier = planTier;
    if (maxUsers !== undefined) updates.maxUsers = maxUsers;
    if (maxDeals !== undefined) updates.maxDeals = maxDeals;
    if (maxStorageMb !== undefined) updates.maxStorageMb = maxStorageMb;
    if (isActive !== undefined) updates.isActive = isActive;

    const updated = await storage.updateOrganization(orgId, updates);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update organization" });
  }
});

app.post("/api/platform/switch-org", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.body;
    if (orgId) {
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      (req as any).session.selectedOrgId = orgId;
    } else {
      (req as any).session.selectedOrgId = undefined;
    }
    res.json({ message: "Organization context switched", orgId: orgId || null });
  } catch (error) {
    res.status(500).json({ message: "Failed to switch organization" });
  }
});

app.get("/api/platform/settings", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const settings = await storage.getAllPlatformSettings();
    const settingsMap: Record<string, any> = {};
    settings.forEach(s => { settingsMap[s.settingKey] = s.settingValue; });
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch platform settings" });
  }
});

app.put("/api/platform/settings", requireAuth as any, requirePlatformOwner as any, async (req: AuthenticatedRequest, res) => {
  try {
    const entries = req.body;
    if (!entries || typeof entries !== "object") return res.status(400).json({ message: "Invalid settings" });

    for (const [key, value] of Object.entries(entries)) {
      await storage.upsertPlatformSetting(key, value, req.user!.id);
    }
    res.json({ message: "Platform settings updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update platform settings" });
  }
});

app.get("/api/platform/account-requests", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await storage.getAccountRequests(status);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch account requests" });
  }
});

app.patch("/api/platform/account-requests/:id", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, planTier } = req.body;
    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }

    const request = await storage.getAccountRequest(id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ message: "Request already processed" });

    if (status === "approved") {
      const org = await storage.createOrganization({
        name: request.companyName,
        industry: request.industry || "Technology",
        planTier: planTier || "starter",
        maxUsers: 5,
        maxDeals: 10,
        maxStorageMb: 5000,
        isActive: true,
      });

      const passwordHash = await hashPassword("meridian123");
      const user = await storage.createUser({
        email: request.contactEmail,
        name: request.contactName,
        role: "org_owner",
        organizationId: org.id,
        passwordHash,
        status: "active",
      });

      await storage.updateOrganization(org.id, { ownerUserId: user.id });
      await storage.updateAccountRequest(id, {
        status: "approved",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      });

      const loginUrl = `${req.protocol}://${req.get("host")}/login`;
      await emailService.sendAccountApproval(request.contactEmail, request.companyName, loginUrl);

      res.json({ message: "Request approved, organization created", organization: org });
    } else {
      await storage.updateAccountRequest(id, {
        status: "rejected",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      });

      await emailService.sendAccountRejection(request.contactEmail, reviewNotes || undefined);

      res.json({ message: "Request rejected" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to process account request" });
  }
});

app.get("/api/platform/stats", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await storage.getPlatformStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch platform stats" });
  }
});

app.get("/api/platform/users", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const platformUsers = await storage.getPlatformUsers();
    const safeUsers = platformUsers.map(({ passwordHash, ...rest }) => rest);
    res.json(safeUsers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch platform users" });
  }
});

app.post("/api/platform/organizations", requireAuth as any, requirePlatformRole as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, slug, planTier, ownerEmail, ownerName, industry } = req.body;
    if (!name || !ownerEmail || !ownerName) {
      return res.status(400).json({ message: "Name, owner email, and owner name are required" });
    }

    const existingUser = await storage.getUserByEmail(ownerEmail);
    if (existingUser) {
      return res.status(400).json({ message: "A user with this email already exists" });
    }

    const org = await storage.createOrganization({
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
      industry: industry || "Technology",
      planTier: planTier || "starter",
      maxUsers: planTier === "enterprise" ? 100 : planTier === "professional" ? 25 : 5,
      maxDeals: planTier === "enterprise" ? -1 : planTier === "professional" ? 50 : 10,
      maxStorageMb: planTier === "enterprise" ? 100000 : planTier === "professional" ? 25000 : 5000,
      isActive: true,
    });

    const token = crypto.randomUUID();
    const invitation = await storage.createInvitation({
      tenantId: org.id,
      email: ownerEmail,
      role: "org_owner",
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: req.user!.id,
    });

    const inviteLink = `/invite/${token}`;
    res.json({ message: "Organization created", organization: org, inviteLink });
  } catch (error: any) {
    console.error("Create org error:", error);
    res.status(500).json({ message: "Failed to create organization" });
  }
});

app.delete("/api/platform/organizations/:orgId", requireAuth as any, requirePlatformOwner as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;
    const org = await storage.getOrganization(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    if (org.slug === "cavaridge") return res.status(403).json({ message: "Cannot delete the platform organization" });

    await storage.deleteOrganization(orgId);
    res.json({ message: "Organization deleted" });
  } catch (error: any) {
    console.error("Delete org error:", error);
    res.status(500).json({ message: "Failed to delete organization" });
  }
});

app.get("/api/platform/sterilize/preview", requireAuth as any, requirePlatformOwner as any, async (_req: AuthenticatedRequest, res) => {
  try {
    const { getDryRunCounts } = await import("../scripts/sterilize-production");
    const result = await getDryRunCounts();
    res.json(result);
  } catch (error: any) {
    console.error("Sterilize preview error:", error);
    res.status(500).json({ message: "Failed to get preview: " + (error.message || "Unknown error") });
  }
});

app.post("/api/platform/sterilize", requireAuth as any, requirePlatformOwner as any, async (req: AuthenticatedRequest, res) => {
  try {
    const confirmation = req.body?.confirmation;
    if (confirmation !== "STERILIZE") {
      return res.status(403).json({ success: false, error: "Invalid confirmation. Send { confirmation: \"STERILIZE\" } to proceed." });
    }

    const { runSterilization } = await import("../scripts/sterilize-production");
    const result = await runSterilization();
    if (result.success) {
      res.json({
        success: true,
        summary: {
          orgs_deleted: result.orgs_deleted,
          users_deleted: result.users_deleted,
          deals_deleted: result.deals_deleted,
          documents_deleted: result.documents_deleted,
          files_deleted: result.files_deleted,
          preserved_org: result.preserved_org,
          preserved_users: result.preserved_users,
        },
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error("Sterilize error:", error);
    res.status(500).json({ success: false, error: "Sterilization failed: " + (error.message || "Unknown error") });
  }
});

app.post("/api/account-requests", async (req, res) => {
  try {
    const { companyName, contactName, email, contactEmail, phone, contactPhone, industry, estimatedDealsPerYear, estimatedUsers, message, notes } = req.body;
    const resolvedEmail = email || contactEmail;
    const resolvedPhone = phone || contactPhone;
    const resolvedMessage = message || notes;
    if (!companyName || !contactName || !resolvedEmail) {
      return res.status(400).json({ message: "companyName, contactName, and email are required" });
    }

    const FREE_EMAIL_DOMAINS = [
      "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
      "icloud.com", "mail.com", "protonmail.com", "zoho.com", "yandex.com",
      "gmx.com", "live.com", "msn.com", "me.com", "inbox.com",
    ];
    const emailDomain = resolvedEmail.split("@")[1]?.toLowerCase();
    if (!emailDomain || FREE_EMAIL_DOMAINS.includes(emailDomain)) {
      return res.status(400).json({ message: "Please use a work email address" });
    }

    const existing = await storage.getUserByEmail(resolvedEmail);
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const request = await storage.createAccountRequest({
      companyName,
      contactName,
      contactEmail: resolvedEmail,
      contactPhone: resolvedPhone || null,
      industry: industry || null,
      estimatedDealsPerYear: estimatedDealsPerYear || null,
      estimatedUsers: estimatedUsers || null,
      message: resolvedMessage || null,
      status: "pending",
    });

    res.status(201).json({ message: "Account request submitted", requestId: request.id });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit account request" });
  }
});
}
