/**
 * @cavaridge/report-templates — Type definitions
 *
 * Types for QBR/ABR template selection, branding, journey data,
 * and the hydration engine that populates templates with live data.
 */

// ── Template Selection ─────────────────────────────────────────────

export type ReportType = "qbr" | "abr";
export type ReportTier = "smb" | "enterprise";
export type BrandKey = "dit" | "cavaridge" | string; // extensible for partner tenants

export interface TemplateSelection {
  reportType: ReportType;
  tier: ReportTier;
  brand: BrandKey;
}

// ── Tenant Branding ────────────────────────────────────────────────

export interface TenantBranding {
  brandKey: BrandKey;
  companyName: string;
  website: string;
  copyrightHolder: string;
  footerTagline?: string; // e.g., "Powered by Ducky Intelligence"
  primaryColor: string;   // hex without #
  accentColor: string;
  logoPath?: string;      // path to logo asset
  iconPath?: string;      // path to icon asset
  stack: TenantStack;
}

export interface TenantStack {
  psa: string;         // e.g., "ConnectWise" or "Salesforce"
  rmm: string;         // e.g., "NinjaRMM" or "RMM (TBD)"
  edr: string;         // e.g., "SentinelOne" or "Guardz + SentinelOne"
  itdr: string;        // e.g., "Huntress"
  mfa: string;         // e.g., "Cisco Duo"
  dns: string;         // e.g., "Umbrella/Atakama" or "Atakama"
  backup: string;      // e.g., "NinjaRMM Backup"
  securityCenter: string; // e.g., "M365 Security Center"
}

// ── Journey / Historical Data ──────────────────────────────────────

export interface JourneyMetric {
  label: string;
  source: string; // which tool to pull from
  baseline?: number | string;
  q1?: number | string;
  q2?: number | string;
  q3?: number | string;
  q4?: number | string;
  lastQuarter?: number | string;
  thisQuarter?: number | string;
  trend?: "improving" | "stable" | "declining";
}

export interface JourneyData {
  metrics: JourneyMetric[];
  baselineDate?: string;
}

// ── QBR Hydration Input ────────────────────────────────────────────

export interface QbrHydrationInput {
  /** Template to use */
  template: TemplateSelection;

  /** Tenant branding config */
  branding: TenantBranding;

  /** Client info */
  clientName: string;
  clientId: string;
  quarter: string;        // e.g., "Q2 2026"
  fiscalYear?: string;    // e.g., "FY2026" (ABR only)
  preparedBy?: string;
  preparedDate?: string;

  /** Journey tracking */
  journey?: JourneyData;

  /** Executive summary (from QbrPackage) */
  executiveSummary?: string;

  /** Security section */
  security?: {
    secureScore: number;
    secureScoreMax: number;
    adjustedScore?: number;
    mfaAdoption: number;
    edrCoverage: number;
    patchCompliance: number;
    talkingPoints: string[];
    recommendations: string[];
    gaps: Array<{
      title: string;
      category: string;
      priority: string;
      pointsAtStake: number;
    }>;
  };

  /** Infrastructure metrics */
  infrastructure?: {
    totalEndpoints: number;
    systemUptime: number;
    devicesMonitored: number;
    patchCompliance: number;
    alertsTriggered: number;
    autoResolved: number;
  };

  /** Service delivery */
  serviceDelivery?: {
    ticketsResolved: number;
    slaCompliance: number;
    avgTicketsPerMonth: number;
    firstContactResolution?: number;
    csat?: number;
  };

  /** Roadmap items */
  roadmapItems: Array<{
    title: string;
    status: string;
    priority: string;
    quarter: string;
    cost?: string;
    businessProblem?: string;
  }>;

  /** Open issues / risks */
  risks?: Array<{
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    mitigation?: string;
  }>;

  /** Action items */
  actionItems?: Array<{
    action: string;
    owner: string;
    dueDate: string;
    status: string;
  }>;

  /** ABR-specific sections */
  annualReview?: {
    totalTicketsResolved: number;
    projectsCompleted: number;
    securityIncidents: number;
    uptimeAchieved: number;
    milestones: string[];
  };

  annualValue?: {
    secureScoreImprovement: string;
    costSavings: string;
    efficiencyGains: string;
    businessEnablement: string;
  };
}

// ── Template Registry Entry ────────────────────────────────────────

export interface TemplateRegistryEntry {
  reportType: ReportType;
  tier: ReportTier;
  brand: BrandKey;
  filename: string;
  slideCount: number;
  description: string;
}
