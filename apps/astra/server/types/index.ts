/**
 * CVG-ASTRA — Shared Server Types
 */

export * from "./graph.js";

// ── Waste Detection Types ───────────────────────────────────────────

export type WasteCategory =
  | "unused"           // No sign-in for configurable period
  | "underutilized"    // E5 user only using E3 features
  | "duplicate"        // Overlapping license assignments
  | "disabled_account" // License on disabled/deleted account
  | "unassigned";      // Purchased but not assigned

export type WasteSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface WasteThresholds {
  /** Days of inactivity to flag as unused */
  unusedDays: number;
  /** Minimum service utilization % for underutilized detection */
  underutilizedPct: number;
}

export const DEFAULT_THRESHOLDS: WasteThresholds = {
  unusedDays: 90,
  underutilizedPct: 40,
};

export interface WasteFinding {
  userId: string;
  userDisplayName: string;
  userPrincipalName: string;
  category: WasteCategory;
  severity: WasteSeverity;
  currentLicenses: string[];
  currentMonthlyCost: number;
  estimatedWastedCost: number;
  description: string;
  evidence: string[];
  daysSinceLastActivity: number | null;
  activeServiceCount: number;
  totalServiceCount: number;
}

export interface WasteDetectionResult {
  tenantId: string;
  analyzedAt: Date;
  totalUsers: number;
  totalMonthlyCost: number;
  findings: WasteFinding[];
  summary: WasteDetectionSummary;
  thresholds: WasteThresholds;
}

export interface WasteDetectionSummary {
  totalWastedMonthlyCost: number;
  totalWastedAnnualCost: number;
  unusedLicenseCount: number;
  underutilizedCount: number;
  duplicateCount: number;
  disabledAccountCount: number;
  findingsBySeverity: Record<WasteSeverity, number>;
}

// ── Optimization Types ──────────────────────────────────────────────

export type RecommendationType =
  | "downgrade"
  | "removal"
  | "consolidation"
  | "upgrade"
  | "reassignment";

export type RecommendationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "implemented"
  | "deferred";

export interface OptimizationRecommendation {
  id: string;
  userId: string;
  userDisplayName: string;
  userPrincipalName: string;
  type: RecommendationType;
  currentLicenses: string[];
  recommendedLicenses: string[];
  currentMonthlyCost: number;
  recommendedMonthlyCost: number;
  monthlySavings: number;
  annualSavings: number;
  rationale: string;
  riskLevel: WasteSeverity;
  status: RecommendationStatus;
  implementationNotes?: string;
}

export interface OptimizationPlanSummary {
  id: string;
  name: string;
  tenantId: string;
  auditId: string;
  totalRecommendations: number;
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

// ── vCIO Report Types ───────────────────────────────────────────────

export interface VCIOReportData {
  tenantId: string;
  auditId: string;
  /** License optimization data */
  licenseData: {
    totalUsers: number;
    totalMonthlyCost: number;
    wasteFindings: WasteFinding[];
    recommendations: OptimizationRecommendation[];
    totalSavings: { monthly: number; annual: number };
  };
  /** AEGIS IAR cross-reference data (optional) */
  iarData?: {
    riskFlags: IARRiskFlag[];
    securityScore: number;
    lastReviewDate: Date;
  };
}

export interface IARRiskFlag {
  flagType: string;
  severity: WasteSeverity;
  userPrincipalName: string;
  description: string;
  suppressed: boolean;
  suppressionReason?: string;
}

// ── Dashboard Types ─────────────────────────────────────────────────

export interface PortfolioSummary {
  totalTenants: number;
  totalLicenseSpend: number;
  totalIdentifiedSavings: number;
  optimizationRate: number;
  tenantSummaries: TenantDashboardEntry[];
}

export interface TenantDashboardEntry {
  tenantId: string;
  tenantName: string;
  userCount: number;
  monthlySpend: number;
  identifiedSavings: number;
  wastePercentage: number;
  lastAuditDate: Date | null;
  optimizationStatus: "not_started" | "in_progress" | "optimized" | "needs_review";
}

// ── Audit Types ─────────────────────────────────────────────────────

export type AuditStatus = "pending" | "running" | "completed" | "failed";

export interface AuditConfig {
  thresholds: WasteThresholds;
  includeActivityData: boolean;
  includeMailboxData: boolean;
  includeIARData: boolean;
}

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  thresholds: DEFAULT_THRESHOLDS,
  includeActivityData: true,
  includeMailboxData: true,
  includeIARData: false,
};
