/**
 * QBR Report Types — CVG-MIDAS
 *
 * Extended QBR report types with full section support
 * for DOCX generation.
 */

import type { QbrSecuritySection, QbrPackage } from "./security-scoring";
import type { LicenseUtilizationSummary, UserMetricsSummary, SecurityConfigSummary } from "./tenant-intel-integration";
import type { AegisQbrData } from "./aegis-integration";
import type { QuarterlyRollup } from "./budget";

// ── QBR Report Record ───────────────────────────────────────────────

export interface QbrReport {
  id: string;
  tenantId: string;
  clientId: string;
  title: string;
  quarter: string;
  fiscalYear: number;
  status: "draft" | "generated" | "reviewed" | "delivered";
  generatedBy: string;
  generatedAt: Date;
  deliveredAt: Date | null;
  reportJson: QbrReportData;
  createdAt: Date;
  updatedAt: Date;
}

// ── Full QBR Report Data ────────────────────────────────────────────

export interface QbrReportData {
  clientId: string;
  clientName: string;
  quarter: string;
  fiscalYear: number;
  generatedAt: string;

  /** Executive Summary — AI-generated narrative */
  executiveSummary: string;

  /** Security Posture — Adjusted Score + trend */
  security: QbrSecuritySection | null;

  /** AEGIS integration data (if available) */
  aegis: AegisQbrData | null;

  /** Infrastructure Health */
  infrastructure: InfrastructureHealthSection | null;

  /** License Optimization */
  licenseOptimization: LicenseOptimizationSection | null;

  /** Roadmap Progress */
  roadmapProgress: RoadmapProgressSection;

  /** Budget Summary */
  budgetSummary: QuarterlyRollup | null;

  /** Recommendations */
  recommendations: QbrRecommendation[];

  /** Next Steps / Action Items */
  nextSteps: string[];
}

// ── Section: Infrastructure Health ──────────────────────────────────

export interface InfrastructureHealthSection {
  userMetrics: UserMetricsSummary | null;
  securityConfig: SecurityConfigSummary | null;
  highlights: string[];
}

// ── Section: License Optimization ───────────────────────────────────

export interface LicenseOptimizationSection {
  summary: LicenseUtilizationSummary | null;
  savingsOpportunity: number | null;
  recommendations: string[];
}

// ── Section: Roadmap Progress ───────────────────────────────────────

export interface RoadmapProgressSection {
  totalProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  completionPct: number;
  items: Array<{
    title: string;
    status: string;
    priority: string;
    quarter: string;
    source: string;
  }>;
}

// ── Recommendation ──────────────────────────────────────────────────

export interface QbrRecommendation {
  title: string;
  description: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  estimatedCost: string | null;
  estimatedTimeline: string | null;
  source: "security" | "license" | "infrastructure" | "roadmap" | "ai";
}
