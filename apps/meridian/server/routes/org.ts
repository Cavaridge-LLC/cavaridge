import { type Express } from "express";
import { storage, organizations, eq, db, requireAuth, logAudit, requirePerm, checkPlanLimit, incrementUsage, getUsageSummary, PLAN_LIMITS, getNextTier, tierLabel, limitLabel, crypto, isPlatformRole, type AuthenticatedRequest, type PlanTier } from './_helpers';
import { hasPermission } from './_helpers';
import { ObjectStorageService } from "../replit_integrations/object_storage";

export function registerOrgRoutes(app: Express) {
app.get("/api/org/members", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const members = await storage.getUsersByOrg(req.orgId!);
    const safeMembers = members.map(({ passwordHash, ...m }) => m);
    res.json(safeMembers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

app.get("/api/org/audit-log", requireAuth as any, requirePerm("view_audit_log") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await storage.getAuditLogFiltered(req.orgId!, { action: action || undefined, userId: userId || undefined, limit, offset });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch audit log" });
  }
});

app.get("/api/org/info", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const org = req.org!;
    const usageSummary = await getUsageSummary(req.orgId!);
    const storageLimit = usageSummary.storage.limit;
    res.json({
      organization: org,
      usage: {
        users: usageSummary.users.current,
        maxUsers: usageSummary.users.limit,
        deals: usageSummary.deals.current,
        maxDeals: usageSummary.deals.limit,
        storageMb: Math.round(usageSummary.storage.current * 1024 * 10) / 10,
        maxStorageMb: storageLimit === -1 ? -1 : Math.round(storageLimit * 1024),
        chatQueries: usageSummary.queries.current,
        maxChatQueries: usageSummary.queries.limit,
        baselines: usageSummary.baselines.current,
        maxBaselines: usageSummary.baselines.limit,
        storageGb: usageSummary.storage.current,
        maxStorageGb: usageSummary.storage.limit,
      },
      planTier: usageSummary.planTier,
      planLimits: usageSummary.planLimits,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch org info" });
  }
});

app.patch("/api/org/settings", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, industryDefault, settingsJson, logoUrl, primaryColor } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (industryDefault !== undefined) updates.industryDefault = industryDefault;
    if (settingsJson !== undefined) updates.settingsJson = settingsJson;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;

    const updated = await storage.updateOrganization(req.orgId!, updates);
    await logAudit(req.orgId!, req.user!.id, "settings_changed", "organization", req.orgId!, { changes: Object.keys(updates) }, req.ip || undefined);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update settings" });
  }
});

app.get("/api/settings/branding", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const branding = await storage.getBranding(req.orgId!);
    res.json(branding || null);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch branding" });
  }
});

app.put("/api/settings/branding", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      companyName, logoUrl, logoWidthPx,
      primaryColor, secondaryColor, accentColor,
      reportHeaderText, reportFooterText, confidentialityNotice,
      contactName, contactEmail, contactPhone, website,
      showMeridianBadge, customCoverPage,
    } = req.body;

    const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
    const colorFields = { primaryColor, secondaryColor, accentColor };
    for (const [key, val] of Object.entries(colorFields)) {
      if (val !== undefined && typeof val === "string" && !hexColorRegex.test(val)) {
        return res.status(400).json({ message: `Invalid ${key}: must be a 7-character hex color (e.g. #1a56db)` });
      }
    }

    if (logoWidthPx !== undefined && (typeof logoWidthPx !== "number" || logoWidthPx < 50 || logoWidthPx > 500)) {
      return res.status(400).json({ message: "logoWidthPx must be a number between 50 and 500" });
    }

    const updates: Record<string, any> = {};
    if (companyName !== undefined) updates.companyName = String(companyName).slice(0, 255);
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (logoWidthPx !== undefined) updates.logoWidthPx = logoWidthPx;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (secondaryColor !== undefined) updates.secondaryColor = secondaryColor;
    if (accentColor !== undefined) updates.accentColor = accentColor;
    if (reportHeaderText !== undefined) updates.reportHeaderText = String(reportHeaderText).slice(0, 255);
    if (reportFooterText !== undefined) updates.reportFooterText = String(reportFooterText).slice(0, 255);
    if (confidentialityNotice !== undefined) updates.confidentialityNotice = String(confidentialityNotice);
    if (contactName !== undefined) updates.contactName = String(contactName).slice(0, 255);
    if (contactEmail !== undefined) updates.contactEmail = String(contactEmail).slice(0, 255);
    if (contactPhone !== undefined) updates.contactPhone = String(contactPhone).slice(0, 50);
    if (website !== undefined) updates.website = String(website).slice(0, 255);
    if (showMeridianBadge !== undefined) updates.showMeridianBadge = !!showMeridianBadge;
    if (customCoverPage !== undefined) updates.customCoverPage = !!customCoverPage;

    const branding = await storage.upsertBranding(req.orgId!, updates);
    await logAudit(req.orgId!, req.user!.id, "settings_changed", "branding", req.orgId!, { changes: Object.keys(updates) }, req.ip || undefined);
    res.json(branding);
  } catch (error) {
    res.status(500).json({ message: "Failed to update branding" });
  }
});

app.post("/api/settings/branding/logo", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/octet-stream")) {
      return res.status(400).json({ message: "Send file as application/octet-stream with X-File-Type header" });
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;
    const MAX_SIZE = 2 * 1024 * 1024;

    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) {
          reject(new Error("File exceeds 2MB limit"));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", resolve);
      req.on("error", reject);
    });

    const fileBuffer = Buffer.concat(chunks);

    const fileType = req.headers["x-file-type"] as string || "image/png";
    const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ message: "Only PNG, JPG, and SVG files are allowed" });
    }

    const ext = fileType === "image/svg+xml" ? "svg" : fileType === "image/jpeg" ? "jpg" : "png";
    const fileName = `branding-logo-${req.orgId}.${ext}`;

    const uploadResponse = await fetch("http://127.0.0.1:1106/object-storage/signed-object-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectId: `branding/${fileName}`,
        httpMethod: "PUT",
      }),
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to get upload URL from storage");
    }

    const { url: signedUrl } = await uploadResponse.json() as { url: string };

    const putResponse = await fetch(signedUrl, {
      method: "PUT",
      body: fileBuffer,
      headers: { "Content-Type": fileType },
    });

    if (!putResponse.ok) {
      throw new Error("Failed to upload to storage");
    }

    const logoUrl = `/objects/branding/${fileName}`;

    await storage.upsertBranding(req.orgId!, { logoUrl });

    res.json({ logoUrl });
  } catch (error: any) {
    const message = error.message === "File exceeds 2MB limit" ? error.message : "Failed to upload logo";
    res.status(error.message === "File exceeds 2MB limit" ? 400 : 500).json({ message });
  }
});

app.get("/api/org/baseline-profiles", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const profiles = await storage.getBaselineProfiles(req.orgId!);
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch baseline profiles" });
  }
});

app.post("/api/org/baseline-profiles", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, profileData, isDefault } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    if (isDefault) {
      const existing = await storage.getBaselineProfiles(req.orgId!);
      for (const p of existing) {
        if (p.isDefault) {
          await storage.updateBaselineProfile(p.id, { isDefault: false });
        }
      }
    }

    const profile = await storage.createBaselineProfile({
      organizationId: req.orgId!,
      name,
      profileData: profileData || {},
      isDefault: isDefault || false,
    });
    await logAudit(req.orgId!, req.user!.id, "baseline_profile_created", "baseline_profile", profile.id, { name }, req.ip || undefined);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to create baseline profile" });
  }
});

app.put("/api/org/baseline-profiles/:profileId", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await storage.getBaselineProfile(req.params.profileId);
    if (!profile || profile.organizationId !== req.orgId) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const { name, profileData, isDefault } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (profileData !== undefined) updates.profileData = profileData;
    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
      if (isDefault) {
        const existing = await storage.getBaselineProfiles(req.orgId!);
        for (const p of existing) {
          if (p.isDefault && p.id !== profile.id) {
            await storage.updateBaselineProfile(p.id, { isDefault: false });
          }
        }
      }
    }

    const updated = await storage.updateBaselineProfile(profile.id, updates);
    await logAudit(req.orgId!, req.user!.id, "baseline_profile_updated", "baseline_profile", profile.id, { changes: Object.keys(updates) }, req.ip || undefined);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update baseline profile" });
  }
});

app.delete("/api/org/baseline-profiles/:profileId", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await storage.getBaselineProfile(req.params.profileId);
    if (!profile || profile.organizationId !== req.orgId) {
      return res.status(404).json({ message: "Profile not found" });
    }

    await storage.deleteBaselineProfile(profile.id);
    await logAudit(req.orgId!, req.user!.id, "baseline_profile_deleted", "baseline_profile", profile.id, { name: profile.name }, req.ip || undefined);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete baseline profile" });
  }
});

app.patch("/api/org/members/:userId/role", requireAuth as any, requirePerm("change_roles") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: "role is required" });

    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser || targetUser.organizationId !== req.orgId) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.role === "org_owner" && req.user!.role !== "org_owner" && !isPlatformRole(req.user!.role)) {
      return res.status(403).json({ message: "Only owners can change another owner's role" });
    }

    if (req.user!.role === "org_admin" && !["analyst", "integration_pm", "viewer"].includes(role)) {
      return res.status(403).json({ message: "Admins can only assign analyst, integration_pm, or viewer roles" });
    }

    const updated = await storage.updateUser(targetUserId, { role } as any);
    await logAudit(req.orgId!, req.user!.id, "role_changed", "user", targetUserId, { oldRole: targetUser.role, newRole: role }, req.ip || undefined);

    const { passwordHash: _, ...safe } = updated;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: "Failed to change role" });
  }
});

app.patch("/api/org/members/:userId/status", requireAuth as any, requirePerm("change_roles") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "status is required" });

    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser || targetUser.organizationId !== req.orgId) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.role === "org_owner") {
      return res.status(403).json({ message: "Cannot disable the owner" });
    }
    if (targetUserId === req.user!.id) {
      return res.status(400).json({ message: "Cannot disable yourself" });
    }

    const updated = await storage.updateUser(targetUserId, { status } as any);
    await logAudit(req.orgId!, req.user!.id, "user_disabled", "user", targetUserId, { status }, req.ip || undefined);

    const { passwordHash: _, ...safe } = updated;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: "Failed to update user status" });
  }
});

app.delete("/api/org/members/:userId", requireAuth as any, requirePerm("change_roles") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser || targetUser.organizationId !== req.orgId) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.role === "org_owner") {
      return res.status(403).json({ message: "Cannot remove the owner" });
    }
    if (targetUserId === req.user!.id) {
      return res.status(400).json({ message: "Cannot remove yourself" });
    }

    await storage.deleteUser(targetUserId);
    await logAudit(req.orgId!, req.user!.id, "user_removed", "user", targetUserId, { email: targetUser.email, name: targetUser.name }, req.ip || undefined);

    res.json({ message: "User removed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove user" });
  }
});

app.post("/api/org/transfer-ownership", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== "org_owner" && !isPlatformRole(req.user!.role)) {
      return res.status(403).json({ message: "Only the owner can transfer ownership" });
    }
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: "targetUserId is required" });

    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser || targetUser.organizationId !== req.orgId) {
      return res.status(404).json({ message: "User not found" });
    }

    await storage.updateUser(targetUserId, { role: "org_owner" } as any);
    await storage.updateUser(req.user!.id, { role: "org_admin" } as any);
    await storage.updateOrganization(req.orgId!, { ownerUserId: targetUserId });
    await logAudit(req.orgId!, req.user!.id, "ownership_transferred", "user", targetUserId, { from: req.user!.id, to: targetUserId }, req.ip || undefined);

    res.json({ message: "Ownership transferred" });
  } catch (error) {
    res.status(500).json({ message: "Failed to transfer ownership" });
  }
});

app.put("/api/org/members/:userId/deal-access", requireAuth as any, requirePerm("change_roles") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = req.params.userId;
    const { dealAccess: accessEntries } = req.body;
    if (!Array.isArray(accessEntries)) return res.status(400).json({ message: "dealAccess array is required" });

    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser || targetUser.organizationId !== req.orgId) {
      return res.status(404).json({ message: "User not found" });
    }

    await storage.deleteDealAccessByUser(targetUserId);

    for (const entry of accessEntries) {
      if (entry.accessLevel && entry.accessLevel !== "none") {
        await storage.upsertDealAccess({
          dealId: entry.dealId,
          userId: targetUserId,
          accessLevel: entry.accessLevel,
          grantedBy: req.user!.id,
        });
      }
    }

    await logAudit(req.orgId!, req.user!.id, "deal_access_updated", "user", targetUserId, { deals: accessEntries.length }, req.ip || undefined);

    const updatedAccess = await storage.getDealAccessByUser(targetUserId);
    res.json(updatedAccess);
  } catch (error) {
    res.status(500).json({ message: "Failed to update deal access" });
  }
});

app.get("/api/org/pillar-templates", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    let templates = await storage.getPillarTemplates(req.orgId!);
    if (templates.length === 0) {
      templates = await storage.getPillarTemplates(null);
    }
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pillar templates" });
  }
});

app.post("/api/org/pillar-templates", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, weight, displayOrder } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    const template = await storage.createPillarTemplate({
      organizationId: req.orgId!,
      name,
      description: description || null,
      weight: weight || null,
      displayOrder: displayOrder || 0,
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: "Failed to create pillar template" });
  }
});

app.put("/api/org/pillar-templates/:id", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const template = await storage.getPillarTemplate(req.params.id);
    if (!template || template.organizationId !== req.orgId) {
      return res.status(404).json({ message: "Pillar template not found" });
    }
    const { name, description, weight, displayOrder } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (weight !== undefined) updates.weight = weight;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
    const updated = await storage.updatePillarTemplate(template.id, updates);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update pillar template" });
  }
});

app.delete("/api/org/pillar-templates/:id", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const template = await storage.getPillarTemplate(req.params.id);
    if (!template || template.organizationId !== req.orgId) {
      return res.status(404).json({ message: "Pillar template not found" });
    }
    await storage.deletePillarTemplate(template.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete pillar template" });
  }
});

app.get("/api/org/tech-categories", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    let categories = await storage.getTechCategories(req.orgId!);
    if (categories.length === 0) {
      categories = await storage.getTechCategories(null);
    }
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tech categories" });
  }
});

app.post("/api/org/tech-categories", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, displayOrder } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    const category = await storage.createTechCategory({
      organizationId: req.orgId!,
      name,
      description: description || null,
      displayOrder: displayOrder || 0,
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: "Failed to create tech category" });
  }
});

app.put("/api/org/tech-categories/:id", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const category = await storage.getTechCategory(req.params.id);
    if (!category || category.organizationId !== req.orgId) {
      return res.status(404).json({ message: "Tech category not found" });
    }
    const { name, description, displayOrder } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
    const updated = await storage.updateTechCategory(category.id, updates);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update tech category" });
  }
});

app.delete("/api/org/tech-categories/:id", requireAuth as any, requirePerm("manage_org_settings") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const category = await storage.getTechCategory(req.params.id);
    if (!category || category.organizationId !== req.orgId) {
      return res.status(404).json({ message: "Tech category not found" });
    }
    await storage.deleteTechCategory(category.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete tech category" });
  }
});
}
