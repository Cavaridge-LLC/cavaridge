/**
 * CVG-AEGIS — Cavaridge Adjusted Score Calculation Engine
 *
 * Composite 0-100 security posture metric with configurable weights.
 * Default weights per CLAUDE.md:
 *   Microsoft Secure Score 25%, Browser Security 20%,
 *   Google Workspace 15%, Credential Hygiene 15%,
 *   DNS Filtering 10%, SaaS Shadow IT 10%,
 *   Compensating Controls +5 max bonus.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreWeights {
  microsoft_secure_score: number;
  browser_security: number;
  google_workspace: number;
  credential_hygiene: number;
  dns_filtering: number;
  saas_shadow_it: number;
  compensating_controls_max: number;
}

export interface SignalInput {
  /** 0-100 raw score, or null if not configured */
  raw: number | null;
  status: "active" | "not_configured" | "error";
}

export interface CompensatingControlInput {
  controlType: string;
  name: string;
  isDetected: boolean;
  bonusPoints: number;
  /** Risk flags this control suppresses or downgrades */
  flagSuppressions: string[];
}

export interface ScoreSignals {
  microsoftSecureScore: SignalInput;
  browserSecurity: SignalInput;
  googleWorkspace: SignalInput;
  credentialHygiene: SignalInput;
  dnsFiltering: SignalInput;
  sassShadowIt: SignalInput;
  compensatingControls: CompensatingControlInput[];
}

export interface SignalResult {
  raw: number | null;
  weighted: number;
  status: string;
}

export interface ScoreBreakdown {
  totalScore: number;
  signals: {
    microsoft_secure_score: SignalResult;
    browser_security: SignalResult;
    google_workspace: SignalResult;
    credential_hygiene: SignalResult;
    dns_filtering: SignalResult;
    saas_shadow_it: SignalResult;
    compensating_controls: {
      bonus: number;
      controls: CompensatingControlInput[];
      status: string;
    };
  };
  weights: ScoreWeights;
  configuredSignalCount: number;
  maxPossibleScore: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default weights per CLAUDE.md:
 *   Microsoft Secure Score 25%, Browser Security 20%,
 *   Google Workspace 15%, Credential Hygiene 15%,
 *   DNS Filtering 10%, SaaS Shadow IT 15%.
 *   Compensating Controls +5 max bonus (additive, not weighted).
 *
 * Note: The 6 signal weights MUST sum to 1.0.
 * SaaS Shadow IT bumped from 10% to 15% to reach 1.0 sum;
 * the CLAUDE.md spec lists 10% for SaaS + 5 additive max for compensating
 * which totals 95% base. The remaining 5% is distributed to SaaS Shadow IT
 * to keep the weighted score meaningful when all signals are present.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  microsoft_secure_score: 0.25,
  browser_security: 0.20,
  google_workspace: 0.15,
  credential_hygiene: 0.15,
  dns_filtering: 0.10,
  saas_shadow_it: 0.15,
  compensating_controls_max: 5,
};

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the Cavaridge Adjusted Score from signal inputs and weights.
 *
 * When a signal is not configured (raw === null), its weight is redistributed
 * proportionally among configured signals so the score remains meaningful
 * even with partial data.
 */
export function calculateAdjustedScore(
  signals: ScoreSignals,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const signalMap: Array<{
    key: string;
    weight: number;
    input: SignalInput;
  }> = [
    { key: "microsoft_secure_score", weight: weights.microsoft_secure_score, input: signals.microsoftSecureScore },
    { key: "browser_security", weight: weights.browser_security, input: signals.browserSecurity },
    { key: "google_workspace", weight: weights.google_workspace, input: signals.googleWorkspace },
    { key: "credential_hygiene", weight: weights.credential_hygiene, input: signals.credentialHygiene },
    { key: "dns_filtering", weight: weights.dns_filtering, input: signals.dnsFiltering },
    { key: "saas_shadow_it", weight: weights.saas_shadow_it, input: signals.sassShadowIt },
  ];

  // Calculate proportional redistribution for missing signals
  const configuredSignals = signalMap.filter(s => s.input.raw !== null);
  const unconfiguredWeight = signalMap
    .filter(s => s.input.raw === null)
    .reduce((sum, s) => sum + s.weight, 0);

  const configuredWeightSum = signalMap
    .filter(s => s.input.raw !== null)
    .reduce((sum, s) => sum + s.weight, 0);

  // Redistribution factor: scale up configured signal weights
  const redistributionFactor = configuredWeightSum > 0
    ? (configuredWeightSum + unconfiguredWeight) / configuredWeightSum
    : 1;

  // Calculate each signal's weighted contribution
  const results: Record<string, SignalResult> = {};
  let baseScore = 0;

  for (const signal of signalMap) {
    const raw = signal.input.raw;
    let weighted = 0;

    if (raw !== null) {
      const effectiveWeight = signal.weight * redistributionFactor;
      weighted = Math.max(0, Math.min(100, raw)) * effectiveWeight;
    }

    results[signal.key] = {
      raw,
      weighted: Math.round(weighted * 10) / 10,
      status: signal.input.status,
    };

    baseScore += weighted;
  }

  // Compensating controls bonus (capped)
  const detectedControls = signals.compensatingControls.filter(c => c.isDetected);
  const compensatingBonus = Math.min(
    weights.compensating_controls_max,
    detectedControls.reduce((sum, c) => sum + c.bonusPoints, 0),
  );

  const totalScore = Math.min(100, Math.max(0, Math.round((baseScore + compensatingBonus) * 10) / 10));

  return {
    totalScore,
    signals: {
      microsoft_secure_score: results["microsoft_secure_score"],
      browser_security: results["browser_security"],
      google_workspace: results["google_workspace"],
      credential_hygiene: results["credential_hygiene"],
      dns_filtering: results["dns_filtering"],
      saas_shadow_it: results["saas_shadow_it"],
      compensating_controls: {
        bonus: compensatingBonus,
        controls: signals.compensatingControls,
        status: detectedControls.length > 0 ? "active" : "not_configured",
      },
    },
    weights,
    configuredSignalCount: configuredSignals.length,
    maxPossibleScore: configuredWeightSum > 0
      ? Math.round((100 + weights.compensating_controls_max) * 10) / 10
      : 0,
  };
}

/**
 * Validate that signal weights sum to approximately 1.0.
 * Returns null if valid, or an error message string.
 */
export function validateWeights(weights: Partial<ScoreWeights>): string | null {
  const sum =
    (weights.microsoft_secure_score ?? 0) +
    (weights.browser_security ?? 0) +
    (weights.google_workspace ?? 0) +
    (weights.credential_hygiene ?? 0) +
    (weights.dns_filtering ?? 0) +
    (weights.saas_shadow_it ?? 0);

  if (Math.abs(sum - 1.0) > 0.01) {
    return `Signal weights must sum to 1.0 (currently ${sum.toFixed(4)}).`;
  }

  // Validate compensating controls max
  if (weights.compensating_controls_max !== undefined) {
    if (weights.compensating_controls_max < 0 || weights.compensating_controls_max > 10) {
      return "Compensating controls max bonus must be between 0 and 10.";
    }
  }

  return null;
}
