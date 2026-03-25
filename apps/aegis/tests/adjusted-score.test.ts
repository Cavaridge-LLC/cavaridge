/**
 * CVG-AEGIS — Adjusted Score Calculation Tests
 */
import { describe, it, expect } from "vitest";
import {
  calculateAdjustedScore,
  validateWeights,
  DEFAULT_WEIGHTS,
  type ScoreSignals,
  type ScoreWeights,
} from "../server/services/adjusted-score";

describe("calculateAdjustedScore", () => {
  const fullSignals: ScoreSignals = {
    microsoftSecureScore: { raw: 80, status: "active" },
    browserSecurity: { raw: 70, status: "active" },
    googleWorkspace: { raw: 60, status: "active" },
    credentialHygiene: { raw: 90, status: "active" },
    dnsFiltering: { raw: 85, status: "active" },
    sassShadowIt: { raw: 75, status: "active" },
    compensatingControls: [],
  };

  it("calculates total score from all active signals", () => {
    const result = calculateAdjustedScore(fullSignals);

    // Expected: 80*0.25 + 70*0.20 + 60*0.15 + 90*0.15 + 85*0.10 + 75*0.15
    // = 20 + 14 + 9 + 13.5 + 8.5 + 11.25 = 76.25
    expect(result.totalScore).toBeCloseTo(76.3, 0);
    expect(result.configuredSignalCount).toBe(6);
  });

  it("returns 0 when all signals are null", () => {
    const emptySignals: ScoreSignals = {
      microsoftSecureScore: { raw: null, status: "not_configured" },
      browserSecurity: { raw: null, status: "not_configured" },
      googleWorkspace: { raw: null, status: "not_configured" },
      credentialHygiene: { raw: null, status: "not_configured" },
      dnsFiltering: { raw: null, status: "not_configured" },
      sassShadowIt: { raw: null, status: "not_configured" },
      compensatingControls: [],
    };

    const result = calculateAdjustedScore(emptySignals);
    expect(result.totalScore).toBe(0);
    expect(result.configuredSignalCount).toBe(0);
  });

  it("redistributes weight when some signals are missing", () => {
    const partialSignals: ScoreSignals = {
      microsoftSecureScore: { raw: 80, status: "active" },
      browserSecurity: { raw: null, status: "not_configured" },
      googleWorkspace: { raw: null, status: "not_configured" },
      credentialHygiene: { raw: null, status: "not_configured" },
      dnsFiltering: { raw: null, status: "not_configured" },
      sassShadowIt: { raw: 80, status: "active" },
      compensatingControls: [],
    };

    const result = calculateAdjustedScore(partialSignals);

    // Only MS Secure (0.25) and SaaS (0.15) are configured
    // Total configured weight = 0.40
    // Redistribution factor = 1.0 / 0.40 = 2.5
    // MS: 80 * 0.25 * 2.5 = 50
    // SaaS: 80 * 0.15 * 2.5 = 30
    // Total: 80
    expect(result.totalScore).toBeCloseTo(80, 0);
    expect(result.configuredSignalCount).toBe(2);
  });

  it("adds compensating controls bonus", () => {
    const signalsWithControls: ScoreSignals = {
      ...fullSignals,
      compensatingControls: [
        { controlType: "duo_mfa", name: "Duo MFA", isDetected: true, bonusPoints: 2.0, flagSuppressions: [] },
        { controlType: "sentinelone_edr", name: "SentinelOne", isDetected: true, bonusPoints: 1.5, flagSuppressions: [] },
      ],
    };

    const result = calculateAdjustedScore(signalsWithControls);
    const baseResult = calculateAdjustedScore(fullSignals);

    expect(result.totalScore).toBeGreaterThan(baseResult.totalScore);
    expect(result.signals.compensating_controls.bonus).toBe(3.5);
  });

  it("caps compensating controls bonus at max", () => {
    const signalsWithManyControls: ScoreSignals = {
      ...fullSignals,
      compensatingControls: [
        { controlType: "duo_mfa", name: "Duo", isDetected: true, bonusPoints: 2.0, flagSuppressions: [] },
        { controlType: "sentinelone", name: "S1", isDetected: true, bonusPoints: 2.0, flagSuppressions: [] },
        { controlType: "proofpoint", name: "PP", isDetected: true, bonusPoints: 2.0, flagSuppressions: [] },
      ],
    };

    const result = calculateAdjustedScore(signalsWithManyControls, DEFAULT_WEIGHTS);
    expect(result.signals.compensating_controls.bonus).toBeLessThanOrEqual(DEFAULT_WEIGHTS.compensating_controls_max);
  });

  it("clamps score to 0-100 range", () => {
    const perfectSignals: ScoreSignals = {
      microsoftSecureScore: { raw: 100, status: "active" },
      browserSecurity: { raw: 100, status: "active" },
      googleWorkspace: { raw: 100, status: "active" },
      credentialHygiene: { raw: 100, status: "active" },
      dnsFiltering: { raw: 100, status: "active" },
      sassShadowIt: { raw: 100, status: "active" },
      compensatingControls: [
        { controlType: "all", name: "All", isDetected: true, bonusPoints: 5, flagSuppressions: [] },
      ],
    };

    const result = calculateAdjustedScore(perfectSignals);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it("handles negative raw values by clamping to 0", () => {
    const negativeSignals: ScoreSignals = {
      microsoftSecureScore: { raw: -10, status: "active" },
      browserSecurity: { raw: 50, status: "active" },
      googleWorkspace: { raw: null, status: "not_configured" },
      credentialHygiene: { raw: null, status: "not_configured" },
      dnsFiltering: { raw: null, status: "not_configured" },
      sassShadowIt: { raw: null, status: "not_configured" },
      compensatingControls: [],
    };

    const result = calculateAdjustedScore(negativeSignals);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
  });

  it("uses custom weights when provided", () => {
    const customWeights: ScoreWeights = {
      microsoft_secure_score: 0.40,
      browser_security: 0.10,
      google_workspace: 0.10,
      credential_hygiene: 0.10,
      dns_filtering: 0.10,
      saas_shadow_it: 0.20,
      compensating_controls_max: 3,
    };

    const result = calculateAdjustedScore(fullSignals, customWeights);
    expect(result.weights).toEqual(customWeights);
    // MS Secure has higher weight now, so score should shift
    expect(result.totalScore).toBeDefined();
  });

  it("ignores undetected compensating controls", () => {
    const signalsWithInactive: ScoreSignals = {
      ...fullSignals,
      compensatingControls: [
        { controlType: "duo_mfa", name: "Duo", isDetected: false, bonusPoints: 2.0, flagSuppressions: [] },
        { controlType: "sentinelone", name: "S1", isDetected: false, bonusPoints: 1.5, flagSuppressions: [] },
      ],
    };

    const result = calculateAdjustedScore(signalsWithInactive);
    expect(result.signals.compensating_controls.bonus).toBe(0);
  });
});

describe("validateWeights", () => {
  it("returns null for valid weights", () => {
    expect(validateWeights(DEFAULT_WEIGHTS)).toBeNull();
  });

  it("returns error when weights do not sum to 1.0", () => {
    const bad = { ...DEFAULT_WEIGHTS, microsoft_secure_score: 0.50 };
    const error = validateWeights(bad);
    expect(error).toBeTruthy();
    expect(error).toContain("sum to 1.0");
  });

  it("returns error for compensating_controls_max > 10", () => {
    const bad = { ...DEFAULT_WEIGHTS, compensating_controls_max: 15 };
    const error = validateWeights(bad);
    expect(error).toBeTruthy();
    expect(error).toContain("between 0 and 10");
  });

  it("allows compensating_controls_max of 0", () => {
    const valid = { ...DEFAULT_WEIGHTS, compensating_controls_max: 0 };
    expect(validateWeights(valid)).toBeNull();
  });
});
