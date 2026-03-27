/**
 * CVG-AEGIS — SharePoint Posture Module
 *
 * Express routes for the SharePoint Permissions & Security Report
 * within the AEGIS security posture dashboard.
 *
 * Endpoints:
 *   POST /api/aegis/spr/analyze     — Upload JSON, get risk analysis
 *   GET  /api/aegis/spr/reports     — List tenant SPR reports
 *   GET  /api/aegis/spr/reports/:id — Get specific report
 *   GET  /api/aegis/spr/collector   — Redirect to standalone collector
 */

import { Router, type Request, type Response } from 'express';
import {
  type SPRAuditData,
  type SPRIntakeAnswers,
  type SPRSiteAnalysis,
  computeSiteRiskFlags,
  highestSeverity,
  buildUserAccessMap,
  classifySharingLinkSeverity,
  daysSince,
  assessPosture,
} from '@cavaridge/spr-core';

export const sprRouter = Router();

/**
 * POST /api/aegis/spr/analyze
 *
 * Accepts the raw audit JSON + intake answers.
 * Returns the full risk analysis without persisting (stateless analysis).
 * Used by both the AEGIS dashboard and the Claude skill.
 */
sprRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { auditData, intake } = req.body as {
      auditData: SPRAuditData;
      intake: SPRIntakeAnswers;
    };

    // Validate schema version
    if (auditData?.schemaVersion !== '1.0') {
      res.status(400).json({
        error: 'Invalid schema version',
        expected: '1.0',
        received: auditData?.schemaVersion,
      });
      return;
    }

    if (!auditData?.sites?.length) {
      res.status(400).json({ error: 'No sites found in audit data' });
      return;
    }

    // Analyze each site
    const siteAnalyses: SPRSiteAnalysis[] = auditData.sites.map((site) => {
      const flags = computeSiteRiskFlags(site, intake);
      const dsm = daysSince(site.lastModified);

      const anonLinks = site.sharingLinks.filter(
        (l) =>
          l.Scope?.toLowerCase() === 'anonymous' ||
          l.LinkType?.toLowerCase() === 'anonymous'
      );

      let extMembers = 0;
      for (const g of site.groups) {
        for (const m of g.Members || []) {
          if (m.UserType === 'External' || m.LoginName?.toLowerCase().includes('#ext#')) {
            extMembers++;
          }
        }
      }

      let everyoneGrants = 0;
      for (const up of site.uniquePermissions) {
        for (const ra of up.RoleAssignments) {
          const p = (ra.Principal || ra.PrincipalName || '').toLowerCase();
          if (p === 'everyone' || p === 'everyone except external users') {
            everyoneGrants++;
          }
        }
      }

      const nonExpLinks = site.sharingLinks.filter((l) => !l.Expiration);
      const orgLinks = site.sharingLinks.filter(
        (l) => l.Scope?.toLowerCase() === 'organization'
      );

      return {
        siteUrl: site.url,
        siteTitle: site.title,
        owner: site.owner || '(None)',
        created: site.created,
        lastModified: site.lastModified,
        daysSinceModified: dsm,
        storageMB: site.storageUsedMB,
        externalSharing: site.externalSharingCapability,
        groupCount: site.groups.length,
        uniquePermCount: site.itemsWithUniquePerms,
        sharingLinkCount: site.sharingLinks.length,
        anonymousLinkCount: anonLinks.length,
        externalMemberCount: extMembers,
        everyoneGrantCount: everyoneGrants,
        nonExpiringLinkCount: nonExpLinks.length,
        orgWideLinkCount: orgLinks.length,
        riskFlags: flags,
        overallSeverity: highestSeverity(flags),
      };
    });

    // Build user access map
    const userAccessMap = buildUserAccessMap(auditData);
    const userAccess = Array.from(userAccessMap.values())
      .sort((a, b) => b.totalGrants - a.totalGrants);

    // Classify sharing links
    const sharingLinkAnalysis = auditData.sites.flatMap((site) =>
      site.sharingLinks.map((link) => ({
        siteTitle: site.title,
        siteUrl: site.url,
        ...link,
        severity: classifySharingLinkSeverity(link),
      }))
    );

    // Overall posture
    const posture = assessPosture(siteAnalyses);

    // Aggregate findings
    const findingsMap = new Map<string, { severity: string; sites: string[]; count: number }>();
    for (const sa of siteAnalyses) {
      for (const flag of sa.riskFlags) {
        const key = flag.code;
        const existing = findingsMap.get(key) || {
          severity: flag.severity,
          sites: [],
          count: 0,
        };
        existing.sites.push(sa.siteTitle);
        existing.count++;
        findingsMap.set(key, existing);
      }
    }

    res.json({
      tenant: auditData.tenant,
      collectedAt: auditData.collectedAt,
      collector: auditData.collector,
      posture,
      summary: auditData.summary,
      siteAnalyses,
      findings: Array.from(findingsMap.entries()).map(([code, data]) => ({
        code,
        ...data,
        sites: [...new Set(data.sites)],
      })),
      sharingLinks: sharingLinkAnalysis,
      userAccess: userAccess.slice(0, 100), // Top 100 broadest-access users
      totalUsers: userAccess.length,
    });
  } catch (err) {
    console.error('[SPR] Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed', details: String(err) });
  }
});

/**
 * GET /api/aegis/spr/reports
 *
 * Lists stored SPR reports for the authenticated tenant.
 * Requires tenant context from auth middleware.
 */
sprRouter.get('/reports', async (req: Request, res: Response) => {
  // TODO: Implement when Supabase persistence is added
  // For now, return empty — the standalone collector handles data collection
  // and the Claude skill handles report generation
  res.json({
    reports: [],
    message: 'Report persistence coming in Phase 2. Use the standalone collector + Claude skill for now.',
  });
});

/**
 * GET /api/aegis/spr/reports/:id
 */
sprRouter.get('/reports/:id', async (req: Request, res: Response) => {
  res.status(501).json({
    message: 'Report persistence coming in Phase 2.',
  });
});

/**
 * GET /api/aegis/spr/collector
 *
 * Returns the URL of the standalone collector service.
 * In Phase 2, this will be replaced by an integrated Graph API connector.
 */
sprRouter.get('/collector', (_req: Request, res: Response) => {
  const collectorUrl = process.env.SPR_COLLECTOR_URL || 'https://spr.cavaridge.com';
  res.json({
    collectorUrl,
    methods: [
      { id: 'browser', name: 'Browser Collector', url: collectorUrl },
      { id: 'python', name: 'Python Script', download: `${collectorUrl}/downloads/invoke_sp_audit.py` },
      { id: 'pnp', name: 'PnP.PowerShell', download: `${collectorUrl}/downloads/Invoke-SPPermissionsAudit-PnP.ps1` },
      { id: 'graph', name: 'Graph PowerShell SDK', download: `${collectorUrl}/downloads/Invoke-SPPermissionsAudit-Graph.ps1` },
    ],
  });
});
