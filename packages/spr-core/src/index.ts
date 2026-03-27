/**
 * @cavaridge/spr-core
 * SharePoint Permissions Report — Shared Types & Risk Engine
 *
 * Used by:
 * - CVG-AEGIS SharePoint Posture module (server-side)
 * - Standalone Railway collector service
 * - Claude skill report generator
 */

// ── JSON Schema v1.0 Types ──────────────────────────────────────────────────

export interface SPRAuditData {
  schemaVersion: '1.0';
  tenant: string;
  collectedAt: string;
  collector: 'PnP.PowerShell' | 'Microsoft.Graph' | 'Python/MSAL' | 'Browser/MSAL.js';
  collectorVersion: string;
  parameters: {
    includeItemLevel: boolean;
    maxItemsPerList?: number;
    maxItemsPerDrive?: number;
    excludedSites?: string[];
    authMethod?: string;
  };
  summary: SPRAuditSummary;
  sites: SPRSiteRecord[];
  errors: string[];
}

export interface SPRAuditSummary {
  totalSites: number;
  totalGroups: number;
  totalDrives?: number;
  totalUniquePermissions: number;
  totalSharingLinks: number;
  totalItemsScanned: number;
  sitesWithExternalSharing?: number;
  totalErrors: number;
  graphRequestsMade?: number;
  elapsedMinutes: number;
}

export interface SPRSiteRecord {
  url: string;
  title: string;
  siteId?: string;
  template: string;
  owner: string;
  created: string;
  lastModified: string;
  storageUsedMB: number;
  storageQuotaMB?: number;
  externalSharingCapability: string;
  lockState?: string;
  isHubSite?: boolean;
  groups: SPRGroup[];
  drives?: SPRDrive[];
  uniquePermissions: SPRUniquePermission[];
  sharingLinks: SPRSharingLink[];
  itemsScanned: number;
  itemsWithUniquePerms: number;
  errors: string[];
}

export interface SPRGroup {
  Name: string;
  Description?: string;
  Owner?: string;
  MemberCount: number;
  Members: SPRGroupMember[];
  Roles: string;
  GrantedTo?: SPRGrantee[];
  IsDefaultOwners?: boolean;
  IsDefaultMembers?: boolean;
  IsDefaultVisitors?: boolean;
}

export interface SPRGroupMember {
  LoginName: string;
  Title: string;
  Email: string;
  UserType: 'Member' | 'External' | string;
}

export interface SPRGrantee {
  Name: string;
  PrincipalType: string;
  Roles: string;
}

export interface SPRDrive {
  name: string;
  driveId: string;
  driveType: string;
  usedBytes: number;
  webUrl?: string;
}

export interface SPRUniquePermission {
  Path: string;
  Type: 'Web' | 'DocumentLibrary' | 'List' | 'Folder' | 'File' | string;
  Name: string;
  RoleAssignments: SPRRoleAssignment[];
}

export interface SPRRoleAssignment {
  Principal: string;
  PrincipalName: string;
  PrincipalType: 'User' | 'SecurityGroup' | 'SharePointGroup' | 'Group' | string;
  Roles: string;
  Email?: string;
}

export interface SPRSharingLink {
  Path: string;
  Type: string;
  Name: string;
  LinkType: string;
  Scope: string;
  LinkUrl?: string;
  CreatedBy: string;
  Created: string;
  Expiration: string | null;
  IsActive: boolean;
}

// ── Risk Engine Types ───────────────────────────────────────────────────────

export type RiskSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface RiskFlag {
  severity: RiskSeverity;
  code: string;
  description: string;
  count?: number;
}

export interface SPRIntakeAnswers {
  clientName: string;
  preparedBy: string;
  externalSharingIntentional: boolean;
  externalSharingPurpose?: string;
  broadAccessSites: string[];
  hasSensitivityLabels: boolean;
  knownServiceAccounts: string[];
  decommissionSites: string[];
}

export interface SPRSiteAnalysis {
  siteUrl: string;
  siteTitle: string;
  owner: string;
  created: string;
  lastModified: string;
  daysSinceModified: number | null;
  storageMB: number;
  externalSharing: string;
  groupCount: number;
  uniquePermCount: number;
  sharingLinkCount: number;
  anonymousLinkCount: number;
  externalMemberCount: number;
  everyoneGrantCount: number;
  nonExpiringLinkCount: number;
  orgWideLinkCount: number;
  riskFlags: RiskFlag[];
  overallSeverity: RiskSeverity;
}

export interface SPRUserAccessGrant {
  siteName: string;
  siteUrl: string;
  path: string;
  role: string;
  grantType: 'Group Membership' | 'Direct Permission' | 'Sharing Link';
}

export interface SPRUserAccessRecord {
  principal: string;
  principalType: string;
  sitesWithAccess: number;
  totalGrants: number;
  highestRole: string;
  grants: SPRUserAccessGrant[];
}

// ── Risk Engine ─────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Info: 4,
};

export function severityRank(severity: RiskSeverity): number {
  return SEVERITY_RANK[severity] ?? 99;
}

export function highestSeverity(flags: RiskFlag[]): RiskSeverity {
  if (flags.length === 0) return 'Info';
  return flags.reduce((best, f) =>
    severityRank(f.severity) < severityRank(best) ? f.severity : best,
    'Info' as RiskSeverity
  );
}

export function computeSiteRiskFlags(
  site: SPRSiteRecord,
  intake: SPRIntakeAnswers
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // Critical: Anonymous sharing links
  const anonLinks = site.sharingLinks.filter(
    (l) =>
      l.Scope?.toLowerCase() === 'anonymous' ||
      l.LinkType?.toLowerCase() === 'anonymous'
  );
  if (anonLinks.length > 0) {
    flags.push({
      severity: 'Critical',
      code: 'ANON_SHARING',
      description: `${anonLinks.length} Anonymous Sharing Link(s)`,
      count: anonLinks.length,
    });
  }

  // High: Unintended external sharing
  const extSharing = site.externalSharingCapability || 'Disabled';
  if (
    !['Disabled', 'ExistingExternalUserSharingOnly'].includes(extSharing) &&
    !intake.externalSharingIntentional
  ) {
    flags.push({
      severity: 'High',
      code: 'EXT_SHARING_UNINTENDED',
      description: 'External Sharing Enabled (Unintended)',
    });
  }

  // High: "Everyone" permissions
  let everyoneCount = 0;
  for (const up of site.uniquePermissions) {
    for (const ra of up.RoleAssignments) {
      const p = (ra.Principal || ra.PrincipalName || '').toLowerCase();
      if (p === 'everyone' || p === 'everyone except external users') {
        // Check if site is in broad-access whitelist
        if (!intake.broadAccessSites.some((s) => site.url.includes(s))) {
          everyoneCount++;
        }
      }
    }
  }
  if (everyoneCount > 0) {
    flags.push({
      severity: 'High',
      code: 'EVERYONE_PERMS',
      description: `${everyoneCount} "Everyone" Permission Grant(s)`,
      count: everyoneCount,
    });
  }

  // High: Ownerless site
  if (!site.owner || site.owner.trim() === '') {
    flags.push({
      severity: 'High',
      code: 'NO_OWNER',
      description: 'No Site Owner',
    });
  }

  // Medium: Excessive unique permissions
  if (site.itemsWithUniquePerms > 50) {
    flags.push({
      severity: 'Medium',
      code: 'EXCESSIVE_UNIQUE_PERMS',
      description: `${site.itemsWithUniquePerms} Items with Unique Permissions`,
      count: site.itemsWithUniquePerms,
    });
  }

  // Medium: Non-expiring sharing links
  const nonExpLinks = site.sharingLinks.filter((l) => !l.Expiration);
  if (nonExpLinks.length > 0) {
    flags.push({
      severity: 'Medium',
      code: 'NON_EXPIRING_LINKS',
      description: `${nonExpLinks.length} Non-Expiring Sharing Link(s)`,
      count: nonExpLinks.length,
    });
  }

  // Medium: Org-wide sharing links
  const orgLinks = site.sharingLinks.filter(
    (l) => l.Scope?.toLowerCase() === 'organization'
  );
  if (orgLinks.length > 0) {
    flags.push({
      severity: 'Medium',
      code: 'ORG_WIDE_LINKS',
      description: `${orgLinks.length} Organization-Wide Sharing Link(s)`,
      count: orgLinks.length,
    });
  }

  // Medium: Stale site with active sharing
  const daysSinceModified = daysSince(site.lastModified);
  if (daysSinceModified && daysSinceModified > 180 && site.sharingLinks.length > 0) {
    flags.push({
      severity: 'Medium',
      code: 'STALE_WITH_SHARING',
      description: 'Stale Site with Active Sharing Links',
    });
  }

  // Low: External members in groups
  let extMembers = 0;
  for (const g of site.groups) {
    for (const m of g.Members || []) {
      if (
        m.UserType === 'External' ||
        m.LoginName?.toLowerCase().includes('#ext#')
      ) {
        extMembers++;
      }
    }
  }
  if (extMembers > 0) {
    flags.push({
      severity: 'Low',
      code: 'EXT_MEMBERS',
      description: `${extMembers} External User(s) in Permission Groups`,
      count: extMembers,
    });
  }

  // Low: Stale site (no sharing)
  if (
    daysSinceModified &&
    daysSinceModified > 180 &&
    site.sharingLinks.length === 0
  ) {
    // Check if marked for decommission
    const isDecom = intake.decommissionSites.some((s) => site.url.includes(s));
    flags.push({
      severity: isDecom ? 'Info' : 'Low',
      code: 'STALE_SITE',
      description: isDecom
        ? 'Stale Site (Scheduled for Decommission)'
        : 'Stale Site (>180 Days Inactive)',
    });
  }

  return flags;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function daysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate || isoDate.trim() === '') return null;
  try {
    const dt = new Date(isoDate);
    if (isNaN(dt.getTime())) return null;
    return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export function isExternalUser(loginName: string, userType?: string): boolean {
  return (
    userType === 'External' ||
    userType === 'Guest' ||
    loginName.toLowerCase().includes('#ext#')
  );
}

export function buildUserAccessMap(
  data: SPRAuditData
): Map<string, SPRUserAccessRecord> {
  const map = new Map<string, SPRUserAccessRecord>();
  const ROLE_RANK: Record<string, number> = {
    'Full Control': 0,
    Design: 1,
    Edit: 2,
    Contribute: 3,
    Read: 4,
  };

  for (const site of data.sites) {
    // From groups
    for (const group of site.groups) {
      for (const member of group.Members || []) {
        const key = (member.Email || member.LoginName || '').toLowerCase().trim();
        if (!key || key === 'everyone' || key.includes('everyone except')) continue;
        const existing = map.get(key) || {
          principal: member.Title || key,
          principalType: member.UserType || 'Member',
          sitesWithAccess: 0,
          totalGrants: 0,
          highestRole: 'Read',
          grants: [],
        };
        existing.grants.push({
          siteName: site.title,
          siteUrl: site.url,
          path: `/ (Group: ${group.Name})`,
          role: group.Roles || 'Member',
          grantType: 'Group Membership',
        });
        existing.totalGrants = existing.grants.length;
        existing.sitesWithAccess = new Set(existing.grants.map((g) => g.siteUrl)).size;
        // Update highest role
        const currentRank = ROLE_RANK[existing.highestRole] ?? 5;
        const newRank = ROLE_RANK[group.Roles] ?? 5;
        if (newRank < currentRank) existing.highestRole = group.Roles;
        map.set(key, existing);
      }
    }

    // From unique permissions
    for (const up of site.uniquePermissions) {
      for (const ra of up.RoleAssignments) {
        const key = (ra.Principal || '').toLowerCase().trim();
        if (!key || key === 'everyone' || key.includes('everyone except')) continue;
        const existing = map.get(key) || {
          principal: ra.PrincipalName || key,
          principalType: ra.PrincipalType || 'User',
          sitesWithAccess: 0,
          totalGrants: 0,
          highestRole: 'Read',
          grants: [],
        };
        existing.grants.push({
          siteName: site.title,
          siteUrl: site.url,
          path: up.Path,
          role: ra.Roles || '',
          grantType: 'Direct Permission',
        });
        existing.totalGrants = existing.grants.length;
        existing.sitesWithAccess = new Set(existing.grants.map((g) => g.siteUrl)).size;
        const currentRank = ROLE_RANK[existing.highestRole] ?? 5;
        const newRank = ROLE_RANK[ra.Roles] ?? 5;
        if (newRank < currentRank) existing.highestRole = ra.Roles;
        map.set(key, existing);
      }
    }
  }

  return map;
}

/**
 * Classifies sharing link severity
 */
export function classifySharingLinkSeverity(link: SPRSharingLink): RiskSeverity {
  const scope = (link.Scope || '').toLowerCase();
  const linkType = (link.LinkType || '').toLowerCase();
  const hasExpiration = !!link.Expiration;

  if (scope === 'anonymous' || linkType === 'anonymous') return 'Critical';

  let severity: RiskSeverity = 'Low';
  if (scope === 'organization') severity = 'Medium';

  // Bump severity for no expiration
  if (!hasExpiration && severity !== 'Critical') {
    const bump: Record<string, RiskSeverity> = { Low: 'Medium', Medium: 'High' };
    severity = bump[severity] || severity;
  }

  return severity;
}

/**
 * Determines overall tenant posture
 */
export function assessPosture(
  siteAnalyses: SPRSiteAnalysis[]
): 'Strong' | 'Moderate' | 'Needs Attention' {
  const hasCritical = siteAnalyses.some((s) =>
    s.riskFlags.some((f) => f.severity === 'Critical')
  );
  const highCount = siteAnalyses.reduce(
    (n, s) => n + s.riskFlags.filter((f) => f.severity === 'High').length,
    0
  );

  if (hasCritical || highCount >= 5) return 'Needs Attention';
  if (highCount >= 3) return 'Moderate';
  return 'Strong';
}
