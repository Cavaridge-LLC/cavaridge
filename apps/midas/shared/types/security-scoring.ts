/**
 * Security Scoring Types — CVG-MIDAS
 *
 * All TypeScript interfaces for the Cavaridge Adjusted Score engine,
 * compensating controls, SecurityAdvisor agent, and QBR output.
 */

// ── Security Categories ──────────────────────────────────────────────

export type SecurityCategory =
  | "identity_mfa"
  | "identity_access"
  | "email_protection"
  | "endpoint_protection"
  | "data_protection"
  | "backup_recovery"
  | "device_management"
  | "network_security"
  | "application_security"
  | "logging_monitoring";

export type ScoreConfidence = "high" | "medium" | "low";
export type CompensationLevel = "full" | "partial";
export type ControlStatus = "implemented" | "compensated" | "partial" | "real_gap" | "not_applicable";
export type OverrideType = "confirm_auto" | "manual_add" | "reject_auto" | "set_partial";

// ── Detection Signals ────────────────────────────────────────────────

export interface DetectionSignal {
  signalType:
    | "app_registration"
    | "service_principal"
    | "installed_agent"
    | "dns_record"
    | "conditional_access"
    | "manual";
  signalPattern: string;
}

// ── Compensating Controls ────────────────────────────────────────────

export interface ThirdPartyProduct {
  productName: string;
  vendorName: string;
  detectionSignals: DetectionSignal[];
  satisfiesIntent: string;
}

export interface CompensatingControlMapping {
  id: string;
  nativeControlId: string;
  nativeControlName: string;
  vendor: "microsoft" | "google";
  category: SecurityCategory;
  thirdPartyProducts: ThirdPartyProduct[];
  compensationLevel: CompensationLevel;
  notes?: string;
  lastVerified: Date;
}

// ── MSP Overrides ────────────────────────────────────────────────────

export interface MSPOverride {
  id: string;
  organizationId: string;
  clientId: string;
  nativeControlId: string;
  overrideType: OverrideType;
  thirdPartyProduct: string;
  compensationLevel: CompensationLevel | "none";
  notes: string;
  setBy: string;
  setAt: Date;
  expiresAt?: Date;
}

// ── Native Controls (input from tenant-intel / AEGIS) ────────────────

export interface NativeControl {
  controlId: string;
  controlName: string;
  vendor: "microsoft" | "google";
  category: SecurityCategory;
  maxScore: number;
  currentScore: number;
  isImplemented: boolean;
  isNotApplicable: boolean;
  vendorRecommendation?: string;
}

// ── Match Results ────────────────────────────────────────────────────

export interface MatchResult {
  controlId: string;
  controlName: string;
  category: SecurityCategory;
  status: ControlStatus;
  compensationLevel?: CompensationLevel;
  thirdPartyProduct?: string;
  confidence: ScoreConfidence;
  source: "auto_detected" | "msp_override" | "catalog_match" | "native";
  maxScore: number;
  awardedScore: number;
}

// ── Score Report ─────────────────────────────────────────────────────

export interface CategoryScore {
  category: SecurityCategory;
  nativeScore: number;
  adjustedScore: number;
  maxScore: number;
  gapCount: number;
  compensatedCount: number;
}

export interface ScoredControl {
  controlId: string;
  controlName: string;
  category: SecurityCategory;
  vendor: "microsoft" | "google";
  maxScore: number;
  nativeScore: number;
  adjustedScore: number;
  status: ControlStatus;
  compensatingProduct?: string;
  confidence: ScoreConfidence;
}

export interface RealGap {
  controlId: string;
  controlName: string;
  category: SecurityCategory;
  pointsAtStake: number;
  vendorRecommendation: string;
  mspRecommendation?: string;
  estimatedEffort: "low" | "medium" | "high";
  roadmapPriority: number;
}

export interface CompensatedDetail {
  controlId: string;
  controlName: string;
  category: SecurityCategory;
  thirdPartyProduct: string;
  compensationLevel: CompensationLevel;
  confidence: ScoreConfidence;
  pointsAwarded: number;
}

export interface ScoreTrendPoint {
  date: string;
  nativeScore: number;
  adjustedScore: number;
}

export interface ScoreTrend {
  dataPoints: ScoreTrendPoint[];
  trendDirection: "improving" | "stable" | "declining";
  significantChanges: string[];
}

export interface AdjustedSecurityScoreReport {
  tenantId: string;
  clientId: string;
  generatedAt: string;
  vendor: "microsoft" | "google";

  nativeScore: number;
  nativeMaxScore: number;
  adjustedScore: number;
  adjustedMaxScore: number;
  scoreDelta: number;

  categories: CategoryScore[];
  controls: ScoredControl[];
  realGaps: RealGap[];
  compensatedControls: CompensatedDetail[];

  trend?: ScoreTrend;
}

// ── SecurityAdvisor Agent Types ──────────────────────────────────────

export interface PrioritizedGap extends RealGap {
  rank: number;
  reasoning: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  estimatedTimeframe: string;
}

export interface WhatIfScenario {
  gapsResolved: string[];
  currentScore: number;
  projectedScore: number;
  scoreDelta: number;
  narrative: string;
}

export interface SecurityAdvisorInput {
  tenantId: string;
  clientId: string;
  scoreReport: AdjustedSecurityScoreReport;
  clientContext?: string;
  focus?: SecurityCategory[];
}

export interface SecurityAdvisorOutput {
  executiveSummary: string;
  prioritizedGaps: PrioritizedGap[];
  whatIfScenarios: WhatIfScenario[];
  quarterOverQuarterNarrative: string;
  talkingPoints: string[];
}

// ── QBR Package ──────────────────────────────────────────────────────

export interface QbrSecuritySection {
  headlineNative: number;
  headlineAdjusted: number;
  headlineDelta: number;
  categories: CategoryScore[];
  topGaps: PrioritizedGap[];
  trend?: ScoreTrend;
  talkingPoints: string[];
  whatIfScenarios: WhatIfScenario[];
}

export interface QbrPackage {
  clientId: string;
  clientName: string;
  generatedAt: string;
  security?: QbrSecuritySection;
  executiveSummary: string;
  roadmapItems: Array<{
    title: string;
    status: string;
    priority: string;
    quarter: string;
    source: string;
  }>;
  nextSteps: string[];
}
