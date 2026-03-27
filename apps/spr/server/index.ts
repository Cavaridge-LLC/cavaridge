/**
 * CVG-SPR Server
 *
 * Serves the static SharePoint Permissions Reporter UI and exposes
 * POST /api/analyze — receives a completed audit JSON + intake answers,
 * runs the spr-core risk engine deterministically, then calls Spaniel
 * to generate the client-ready narrative report.
 *
 * Auth note: the client-side MSAL flow handles Microsoft auth entirely
 * in the browser. The server never touches SharePoint credentials.
 * /api/analyze is rate-limited; add ANALYZE_SECRET env var for a
 * lightweight shared-secret check in production.
 */

import express from "express";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import {
  computeSiteRiskFlags,
  assessPosture,
  highestSeverity,
  daysSince,
} from "@cavaridge/spr-core";
import type {
  SPRAuditData,
  SPRIntakeAnswers,
  SPRSiteAnalysis,
} from "@cavaridge/spr-core";
import { BRANDING } from "../shared/branding.js";

// ── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);
const SPANIEL_URL = (process.env.SPANIEL_URL || "").replace(/\/$/, "");
const SPANIEL_SERVICE_TOKEN = process.env.SPANIEL_SERVICE_TOKEN || "";
const ANALYZE_SECRET = process.env.ANALYZE_SECRET || "";

// Resolve public dir — works in dev (tsx) and production (esbuild CJS bundle)
function resolvePublicDir(): string {
  const prodPath = path.join(__dirname, "public");
  const devPath = path.join(__dirname, "..", "public");
  return fs.existsSync(prodPath) ? prodPath : devPath;
}

// ── App ──────────────────────────────────────────────────────────────────────

const app = express();

// Health checks — must come before any auth/body parsing
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, app: BRANDING.appCode });
});
app.get("/api/v1/health", (_req, res) => {
  res.json({
    status: "healthy",
    app: BRANDING.appCode,
    name: BRANDING.appName,
    version: "1.0.0",
    spanielConfigured: !!SPANIEL_URL,
  });
});

// Body parsing
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// ── /api/analyze ─────────────────────────────────────────────────────────────

const analyzeLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — try again in a minute." },
});

app.post("/api/analyze", analyzeLimit, async (req, res) => {
  try {
    // Optional shared-secret check
    if (ANALYZE_SECRET) {
      const provided = req.headers["x-spr-secret"] || req.body?.secret;
      if (provided !== ANALYZE_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const { auditData, intake } = req.body as {
      auditData: SPRAuditData;
      intake: SPRIntakeAnswers;
    };

    // Basic validation
    if (!auditData || !Array.isArray(auditData.sites) || auditData.sites.length === 0) {
      return res.status(400).json({ error: "Invalid or empty audit data." });
    }
    if (!intake?.clientName?.trim()) {
      return res.status(400).json({ error: "intake.clientName is required." });
    }
    if (!SPANIEL_URL) {
      return res.status(503).json({
        error: "AI analysis is not configured on this server (SPANIEL_URL not set).",
      });
    }

    // ── Step 1: Run spr-core risk engine (deterministic) ──────────────────

    const siteAnalyses: SPRSiteAnalysis[] = auditData.sites.map((site) => {
      const flags = computeSiteRiskFlags(site, intake);

      const anonymousLinkCount = (site.sharingLinks ?? []).filter(
        (l) =>
          l.Scope?.toLowerCase() === "anonymous" ||
          l.LinkType?.toLowerCase() === "anonymous",
      ).length;

      const externalMemberCount = (site.groups ?? []).reduce(
        (n, g) =>
          n +
          (g.Members ?? []).filter(
            (m) =>
              m.UserType === "External" ||
              m.LoginName?.toLowerCase().includes("#ext#"),
          ).length,
        0,
      );

      const everyoneGrantCount = (site.uniquePermissions ?? []).reduce(
        (n, up) =>
          n +
          (up.RoleAssignments ?? []).filter((ra) => {
            const p = (ra.Principal || ra.PrincipalName || "").toLowerCase();
            return (
              p === "everyone" || p === "everyone except external users"
            );
          }).length,
        0,
      );

      return {
        siteUrl: site.url,
        siteTitle: site.title,
        owner: site.owner,
        created: site.created,
        lastModified: site.lastModified,
        daysSinceModified: daysSince(site.lastModified),
        storageMB: site.storageUsedMB,
        externalSharing: site.externalSharingCapability,
        groupCount: (site.groups ?? []).length,
        uniquePermCount: (site.uniquePermissions ?? []).length,
        sharingLinkCount: (site.sharingLinks ?? []).length,
        anonymousLinkCount,
        externalMemberCount,
        everyoneGrantCount,
        nonExpiringLinkCount: (site.sharingLinks ?? []).filter((l) => !l.Expiration).length,
        orgWideLinkCount: (site.sharingLinks ?? []).filter(
          (l) => l.Scope?.toLowerCase() === "organization",
        ).length,
        riskFlags: flags,
        overallSeverity: highestSeverity(flags),
      };
    });

    const posture = assessPosture(siteAnalyses);

    const criticalSites = siteAnalyses.filter((s) => s.overallSeverity === "Critical");
    const highSites = siteAnalyses.filter((s) => s.overallSeverity === "High");
    const mediumSites = siteAnalyses.filter((s) => s.overallSeverity === "Medium");
    const totalAnonLinks = siteAnalyses.reduce((n, s) => n + s.anonymousLinkCount, 0);
    const totalExternalMembers = siteAnalyses.reduce((n, s) => n + s.externalMemberCount, 0);
    const totalNonExpiringLinks = siteAnalyses.reduce((n, s) => n + s.nonExpiringLinkCount, 0);
    const totalEveryoneGrants = siteAnalyses.reduce((n, s) => n + s.everyoneGrantCount, 0);

    // ── Step 2: Build condensed prompt payload ─────────────────────────────

    const auditDate = new Date(auditData.collectedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const riskSummary = {
      posture,
      totalSites: siteAnalyses.length,
      criticalSiteCount: criticalSites.length,
      highSiteCount: highSites.length,
      mediumSiteCount: mediumSites.length,
      totalUniquePermissions: auditData.summary.totalUniquePermissions,
      totalSharingLinks: auditData.summary.totalSharingLinks,
      totalAnonLinks,
      totalExternalMembers,
      totalNonExpiringLinks,
      totalEveryoneGrants,
      externalSharingIntentional: intake.externalSharingIntentional,
      hasSensitivityLabels: intake.hasSensitivityLabels,
    };

    // Top-risk sites with their flags (limit payload size)
    const topRiskSites = [
      ...criticalSites,
      ...highSites.slice(0, 8),
      ...mediumSites.slice(0, 4),
    ]
      .slice(0, 20)
      .map((s) => ({
        title: s.siteTitle,
        url: s.siteUrl,
        severity: s.overallSeverity,
        flags: s.riskFlags.map((f) => `[${f.severity}] ${f.description}`),
      }));

    // All sites for the appendix table
    const allSitesTable = siteAnalyses.map((s) => ({
      title: s.siteTitle,
      severity: s.overallSeverity,
      uniquePerms: s.uniquePermCount,
      sharingLinks: s.sharingLinkCount,
      anonLinks: s.anonymousLinkCount,
      externalMembers: s.externalMemberCount,
      daysSinceModified: s.daysSinceModified ?? "unknown",
    }));

    const systemPrompt = `You are Ducky Intelligence, the AI analysis engine for the Cavaridge platform (${BRANDING.duckyFooter}).
You are generating a professional SharePoint Online Permissions & Security Report for an MSP client engagement.

TONE RULES (non-negotiable):
- Never frame findings as MSP negligence or failure.
- All findings are "proactive review", "improvement opportunities", or "security hygiene".
- Forbidden words: gap, failure, oversight, neglected, missed, deficiency.
- The MSP is the trusted advisor — thoroughness of this audit demonstrates their proactive value.
- External sharing flagged as unintentional is "identified for review", never "improperly configured".

OUTPUT FORMAT (strict Markdown — use exactly these section headers):

## Executive Summary
3–5 sentences. State the posture verdict (${posture}), key numbers, and the overall message. Professional, client-facing.

## Key Findings
Bullet list of top risks. Each bullet: **[Severity]** — Finding description.

## Site Risk Breakdown
Markdown table: | Site | Severity | Top Risk Flags |
Include all sites with Critical or High severity.

## Sharing Link Analysis
Paragraph + bullets covering anonymous links, org-wide links, non-expiring links.

## External Access Summary
Paragraph + bullets covering external members in groups, external sharing capability status.

## Recommended Actions
Numbered list. Critical items first. Each action: specific, actionable, who should do it.

## Positive Observations
2–4 bullets — what's working well. Frame positively.

## Appendix: Full Site Risk Table
Markdown table of ALL sites: | Site | Severity | Unique Perms | Sharing Links | Anon Links | External Members | Days Since Modified |`;

    const userMessage = `Generate the SharePoint Permissions & Security Report for this engagement:

**Client:** ${intake.clientName}
**Prepared By:** ${intake.preparedBy || "Dedicated IT (DIT)"}
**Audit Date:** ${auditDate}
**Tenant:** ${auditData.tenant}
**Collector:** ${auditData.collector} v${auditData.collectorVersion}
**External Sharing Intent:** ${
      intake.externalSharingIntentional
        ? `Intentional — ${intake.externalSharingPurpose || "specified purpose"}`
        : "NOT intentional — flag all instances as needing review"
    }
**Sensitivity Labels / DLP:** ${intake.hasSensitivityLabels ? "Yes (note as compensating control)" : "No"}
${intake.broadAccessSites.length > 0 ? `**Known Broad-Access Sites (excluded from oversharing flags):** ${intake.broadAccessSites.join(", ")}` : ""}

**Risk Summary:**
${JSON.stringify(riskSummary, null, 2)}

**Top Risk Sites:**
${JSON.stringify(topRiskSites, null, 2)}

**All Sites (for appendix):**
${JSON.stringify(allSitesTable, null, 2)}

Generate the complete report now. Follow the section headers exactly.`;

    // ── Step 3: Call Spaniel ───────────────────────────────────────────────

    const spanielBody = {
      tenant_id: "cvg-spr-service",
      user_id: "cvg-spr-service",
      app_code: BRANDING.appCode,
      task_hint: "report_generation",
      stream: false,
      context: {
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      },
      options: { max_tokens: 8000 },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let spanielData: { content: string; tokens?: object; cost?: object };
    try {
      const spanielRes = await fetch(`${SPANIEL_URL}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SPANIEL_SERVICE_TOKEN}`,
        },
        body: JSON.stringify(spanielBody),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!spanielRes.ok) {
        const errBody = await spanielRes.text().catch(() => "");
        console.error(`[spr] Spaniel HTTP ${spanielRes.status}: ${errBody}`);
        return res.status(502).json({ error: "AI analysis unavailable. Try again shortly." });
      }

      spanielData = (await spanielRes.json()) as typeof spanielData;
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === "AbortError") {
        return res.status(504).json({ error: "AI analysis timed out. Try again." });
      }
      throw fetchErr;
    }

    // ── Step 4: Return ─────────────────────────────────────────────────────

    return res.json({
      report: spanielData.content,
      posture,
      summary: {
        totalSites: siteAnalyses.length,
        criticalCount: criticalSites.length,
        highCount: highSites.length,
        mediumCount: mediumSites.length,
        totalAnonLinks,
        totalExternalMembers,
        totalNonExpiringLinks,
        totalEveryoneGrants,
      },
      tokens: spanielData.tokens,
      cost: spanielData.cost,
      branding: BRANDING.duckyFooter,
    });
  } catch (err) {
    console.error("[spr] /api/analyze unhandled error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── Static serving ────────────────────────────────────────────────────────────

const publicDir = resolvePublicDir();

app.use(express.static(publicDir));

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[${BRANDING.appCode}] ${BRANDING.appName} listening on 0.0.0.0:${PORT}`);
  console.log(`[${BRANDING.appCode}] Spaniel: ${SPANIEL_URL || "(not configured)"}`);
  console.log(`[${BRANDING.appCode}] Public: ${publicDir}`);
});
