/**
 * Home Health Over-Utilization Calculator — Pure Calculation Logic
 *
 * Based on PDGM (Patient-Driven Groupings Model) clinical groupings.
 * All functions are deterministic, pure TypeScript — no DOM, no React, no API calls.
 *
 * References:
 * - CMS PDGM Fact Sheet
 * - Home Health PPS Final Rule CY 2026
 * - LUPA thresholds per clinical grouping
 */

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export type ClinicalGrouping =
  | "MMTA_Surgical_Aftercare"
  | "MMTA_Cardiac_Circulatory"
  | "MMTA_Endocrine"
  | "MMTA_GI_GU"
  | "MMTA_Infectious_Disease"
  | "MMTA_Other"
  | "MMTA_Neuro_Rehab"
  | "MMTA_Respiratory"
  | "MMTA_Skin"
  | "MMTA_Behavioral"
  | "Neuro_Rehab"
  | "Wound"
  | "Complex_Nursing";

export type FunctionalLevel = "low" | "medium" | "high";

export type ComorbidityAdjustment = "none" | "low" | "high";

export type AdmissionSource = "community" | "institutional";

export type TimingCategory = "early" | "late";

export interface PDGMInputs {
  clinicalGrouping: ClinicalGrouping;
  functionalLevel: FunctionalLevel;
  comorbidityAdjustment: ComorbidityAdjustment;
  admissionSource: AdmissionSource;
  timing: TimingCategory;
  actualVisits: number;
  period: 1 | 2;
}

export type UtilizationSeverity = "normal" | "elevated" | "high" | "critical";

export interface UtilizationResult {
  pdgmGroup: string;
  expectedVisitRange: { low: number; high: number };
  lupaThreshold: number;
  actualVisits: number;
  utilizationRatio: number;
  severity: UtilizationSeverity;
  findings: UtilizationFinding[];
  period: 1 | 2;
}

export interface UtilizationFinding {
  category: string;
  severity: UtilizationSeverity;
  message: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// PDGM Expected Visit Ranges (per 30-day period)
//
// These are approximate expected visit ranges based on CMS PDGM groupings.
// In practice, the exact case-mix weights vary by year. These ranges represent
// typical utilization patterns that CMS considers reasonable.
// ---------------------------------------------------------------------------

interface GroupingConfig {
  label: string;
  expectedVisits: Record<FunctionalLevel, { low: number; high: number }>;
  lupaThreshold: number;
  highUtilizationFlag: number;
}

const GROUPING_CONFIGS: Record<ClinicalGrouping, GroupingConfig> = {
  MMTA_Surgical_Aftercare: {
    label: "MMTA - Surgical Aftercare",
    expectedVisits: {
      low: { low: 4, high: 10 },
      medium: { low: 6, high: 14 },
      high: { low: 8, high: 18 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 20,
  },
  MMTA_Cardiac_Circulatory: {
    label: "MMTA - Cardiac/Circulatory",
    expectedVisits: {
      low: { low: 3, high: 8 },
      medium: { low: 5, high: 12 },
      high: { low: 7, high: 16 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 18,
  },
  MMTA_Endocrine: {
    label: "MMTA - Endocrine",
    expectedVisits: {
      low: { low: 3, high: 7 },
      medium: { low: 4, high: 10 },
      high: { low: 6, high: 14 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 16,
  },
  MMTA_GI_GU: {
    label: "MMTA - GI/GU",
    expectedVisits: {
      low: { low: 3, high: 8 },
      medium: { low: 5, high: 11 },
      high: { low: 6, high: 15 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 17,
  },
  MMTA_Infectious_Disease: {
    label: "MMTA - Infectious Disease",
    expectedVisits: {
      low: { low: 4, high: 9 },
      medium: { low: 6, high: 13 },
      high: { low: 8, high: 18 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 20,
  },
  MMTA_Other: {
    label: "MMTA - Other",
    expectedVisits: {
      low: { low: 3, high: 7 },
      medium: { low: 4, high: 10 },
      high: { low: 6, high: 14 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 16,
  },
  MMTA_Neuro_Rehab: {
    label: "MMTA - Neuro/Rehab",
    expectedVisits: {
      low: { low: 4, high: 10 },
      medium: { low: 6, high: 14 },
      high: { low: 8, high: 18 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 20,
  },
  MMTA_Respiratory: {
    label: "MMTA - Respiratory",
    expectedVisits: {
      low: { low: 3, high: 8 },
      medium: { low: 5, high: 12 },
      high: { low: 7, high: 16 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 18,
  },
  MMTA_Skin: {
    label: "MMTA - Skin",
    expectedVisits: {
      low: { low: 4, high: 10 },
      medium: { low: 6, high: 14 },
      high: { low: 9, high: 20 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 22,
  },
  MMTA_Behavioral: {
    label: "MMTA - Behavioral Health",
    expectedVisits: {
      low: { low: 3, high: 7 },
      medium: { low: 4, high: 10 },
      high: { low: 5, high: 12 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 14,
  },
  Neuro_Rehab: {
    label: "Neuro/Rehab",
    expectedVisits: {
      low: { low: 5, high: 12 },
      medium: { low: 8, high: 18 },
      high: { low: 10, high: 24 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 26,
  },
  Wound: {
    label: "Wound",
    expectedVisits: {
      low: { low: 5, high: 12 },
      medium: { low: 8, high: 18 },
      high: { low: 10, high: 22 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 24,
  },
  Complex_Nursing: {
    label: "Complex Nursing",
    expectedVisits: {
      low: { low: 6, high: 14 },
      medium: { low: 9, high: 20 },
      high: { low: 12, high: 26 },
    },
    lupaThreshold: 2,
    highUtilizationFlag: 28,
  },
};

// ---------------------------------------------------------------------------
// Comorbidity adjustment multipliers
// ---------------------------------------------------------------------------

const COMORBIDITY_MULTIPLIERS: Record<ComorbidityAdjustment, number> = {
  none: 1.0,
  low: 1.12,
  high: 1.25,
};

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

/**
 * Get all available clinical groupings with labels.
 */
export function getClinicalGroupings(): { value: ClinicalGrouping; label: string }[] {
  return Object.entries(GROUPING_CONFIGS).map(([value, config]) => ({
    value: value as ClinicalGrouping,
    label: config.label,
  }));
}

/**
 * Calculate utilization analysis for a given PDGM configuration.
 */
export function calculateUtilization(inputs: PDGMInputs): UtilizationResult {
  const config = GROUPING_CONFIGS[inputs.clinicalGrouping];
  const baseRange = config.expectedVisits[inputs.functionalLevel];
  const comorbidityMultiplier = COMORBIDITY_MULTIPLIERS[inputs.comorbidityAdjustment];

  // Adjust expected range for comorbidity
  const adjustedRange = {
    low: Math.round(baseRange.low * comorbidityMultiplier),
    high: Math.round(baseRange.high * comorbidityMultiplier),
  };

  // Institutional admissions typically have higher visit needs in early period
  if (inputs.admissionSource === "institutional" && inputs.timing === "early") {
    adjustedRange.low = Math.round(adjustedRange.low * 1.1);
    adjustedRange.high = Math.round(adjustedRange.high * 1.15);
  }

  // Late timing (recertification) typically has lower visit expectations
  if (inputs.timing === "late") {
    adjustedRange.low = Math.max(2, Math.round(adjustedRange.low * 0.8));
    adjustedRange.high = Math.round(adjustedRange.high * 0.85);
  }

  // Calculate utilization ratio (actual vs expected midpoint)
  const expectedMidpoint = (adjustedRange.low + adjustedRange.high) / 2;
  const utilizationRatio = expectedMidpoint > 0 ? inputs.actualVisits / expectedMidpoint : 0;

  // Determine severity
  const adjustedHighFlag = Math.round(config.highUtilizationFlag * comorbidityMultiplier);
  const severity = determineSeverity(inputs.actualVisits, adjustedRange, adjustedHighFlag, config.lupaThreshold);

  // Generate findings
  const findings = generateFindings(inputs, adjustedRange, adjustedHighFlag, config.lupaThreshold, utilizationRatio);

  return {
    pdgmGroup: config.label,
    expectedVisitRange: adjustedRange,
    lupaThreshold: config.lupaThreshold,
    actualVisits: inputs.actualVisits,
    utilizationRatio,
    severity,
    findings,
    period: inputs.period,
  };
}

function determineSeverity(
  actual: number,
  range: { low: number; high: number },
  highFlag: number,
  lupaThreshold: number
): UtilizationSeverity {
  if (actual < lupaThreshold) return "critical";
  if (actual >= highFlag) return "critical";
  if (actual > range.high) return "high";
  if (actual > range.high * 0.9 || actual < range.low) return "elevated";
  return "normal";
}

function generateFindings(
  inputs: PDGMInputs,
  range: { low: number; high: number },
  highFlag: number,
  lupaThreshold: number,
  ratio: number
): UtilizationFinding[] {
  const findings: UtilizationFinding[] = [];
  const actual = inputs.actualVisits;

  // LUPA check
  if (actual < lupaThreshold) {
    findings.push({
      category: "LUPA Risk",
      severity: "critical",
      message: `Only ${actual} visit(s) in Period ${inputs.period} — below LUPA threshold of ${lupaThreshold}`,
      detail:
        "Low Utilization Payment Adjustment (LUPA) applies when visits fall below the threshold. " +
        "The agency will receive a per-visit payment instead of the full PDGM case-mix adjusted amount.",
    });
  }

  // Under-utilization
  if (actual >= lupaThreshold && actual < range.low) {
    findings.push({
      category: "Under-Utilization",
      severity: "elevated",
      message: `${actual} visits is below the expected range of ${range.low}–${range.high} for this grouping`,
      detail:
        "Visit count is below typical utilization for this clinical grouping and functional level. " +
        "Ensure clinical needs are being adequately met.",
    });
  }

  // Normal range
  if (actual >= range.low && actual <= range.high) {
    findings.push({
      category: "Utilization",
      severity: "normal",
      message: `${actual} visits is within the expected range of ${range.low}–${range.high}`,
    });
  }

  // Over-utilization warning
  if (actual > range.high && actual < highFlag) {
    findings.push({
      category: "Over-Utilization",
      severity: "high",
      message: `${actual} visits exceeds the expected range of ${range.low}–${range.high}`,
      detail:
        "Visit count is above typical utilization for this grouping. Ensure documentation supports " +
        "the clinical necessity of each visit. May attract ADR (Additional Documentation Request) review.",
    });
  }

  // High utilization flag
  if (actual >= highFlag) {
    findings.push({
      category: "High Utilization Flag",
      severity: "critical",
      message: `${actual} visits triggers the high utilization flag (threshold: ${highFlag})`,
      detail:
        "This visit count significantly exceeds expected utilization and may trigger Targeted Probe " +
        "and Educate (TPE) review or an ADR. Ensure thorough documentation of medical necessity " +
        "for every visit.",
    });
  }

  // Period-specific guidance
  if (inputs.period === 1 && inputs.timing === "early") {
    findings.push({
      category: "Timing",
      severity: "normal",
      message: "Early episode (initial certification) — front-loading visits is expected under PDGM",
    });
  }

  if (inputs.period === 2 && actual > range.high * 0.8) {
    findings.push({
      category: "Period 2 Pattern",
      severity: "elevated",
      message: "High visit count in Period 2 — ensure tapering pattern is documented",
      detail:
        "CMS expects visit frequency to generally decrease across the episode. " +
        "High Period 2 utilization should be supported by documented clinical changes.",
    });
  }

  // Comorbidity note
  if (inputs.comorbidityAdjustment !== "none") {
    findings.push({
      category: "Comorbidity",
      severity: "normal",
      message: `Comorbidity adjustment (${inputs.comorbidityAdjustment}) increases expected visit range`,
    });
  }

  return findings;
}
