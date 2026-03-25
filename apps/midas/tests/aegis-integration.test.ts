/**
 * AEGIS Integration — Unit Tests
 *
 * Tests the cross-app integration between AEGIS and Midas
 * for Adjusted Score consumption and QBR data assembly.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeAegisScore,
  filterFindingsForQbr,
  buildAegisQbrData,
} from "../server/integrations/aegis";
import type {
  AegisScorePayload,
  AegisSecurityFinding,
} from "@shared/types/aegis-integration";

// ── Test Fixtures ────────────────────────────────────────────────────

function makeScorePayload(overrides: Partial<AegisScorePayload> = {}): AegisScorePayload {
  return {
    clientId: "client-1",
    tenantId: "org-1",
    capturedAt: "2026-03-24T00:00:00.000Z",
    adjustedScore: 78,
    nativeScore: 52,
    nativeMaxScore: 100,
    signals: [
      { source: "Microsoft Secure Score", weight: 0.25, rawScore: 52, weightedScore: 13 },
      { source: "Browser Security", weight: 0.20, rawScore: 85, weightedScore: 17 },
      { source: "Credential Hygiene", weight: 0.15, rawScore: 70, weightedScore: 10.5 },
    ],
    compensatingBonus: 4,
    browserSecurityScore: 85,
    dnsComplianceScore: 90,
    credentialHygieneScore: 70,
    shadowItRiskScore: 45,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<AegisSecurityFinding> = {}): AegisSecurityFinding {
  return {
    findingId: crypto.randomUUID(),
    tenantId: "org-1",
    clientId: "client-1",
    category: "endpoint_protection",
    severity: "high",
    title: "Test Finding",
    description: "A test security finding.",
    remediation: "Fix the thing.",
    source: "scanner",
    detectedAt: "2026-03-20T00:00:00.000Z",
    resolvedAt: null,
    pointsAtStake: 10,
    ...overrides,
  };
}

// ── Score Normalization ─────────────────────────────────────────────

describe("Normalize AEGIS Score", () => {
  it("should extract all score components", () => {
    const payload = makeScorePayload();
    const result = normalizeAegisScore(payload);

    expect(result.adjustedScore).toBe(78);
    expect(result.nativeScore).toBe(52);
    expect(result.browserSecurityScore).toBe(85);
    expect(result.dnsComplianceScore).toBe(90);
    expect(result.credentialHygieneScore).toBe(70);
    expect(result.shadowItRiskScore).toBe(45);
    expect(result.compensatingBonus).toBe(4);
  });

  it("should handle null optional scores", () => {
    const payload = makeScorePayload({
      browserSecurityScore: null,
      dnsComplianceScore: null,
      credentialHygieneScore: null,
      shadowItRiskScore: null,
    });
    const result = normalizeAegisScore(payload);

    expect(result.browserSecurityScore).toBeNull();
    expect(result.dnsComplianceScore).toBeNull();
  });
});

// ── Finding Filtering ───────────────────────────────────────────────

describe("Filter Findings for QBR", () => {
  it("should include only critical and high unresolved findings", () => {
    const findings: AegisSecurityFinding[] = [
      makeFinding({ severity: "critical", resolvedAt: null }),
      makeFinding({ severity: "high", resolvedAt: null }),
      makeFinding({ severity: "medium", resolvedAt: null }),
      makeFinding({ severity: "low", resolvedAt: null }),
      makeFinding({ severity: "high", resolvedAt: "2026-03-22T00:00:00.000Z" }),
    ];

    const result = filterFindingsForQbr(findings);

    expect(result).toHaveLength(2);
    expect(result[0].severity).toBe("critical");
    expect(result[1].severity).toBe("high");
  });

  it("should return empty array for no relevant findings", () => {
    const findings: AegisSecurityFinding[] = [
      makeFinding({ severity: "low", resolvedAt: null }),
      makeFinding({ severity: "info", resolvedAt: null }),
    ];

    const result = filterFindingsForQbr(findings);
    expect(result).toHaveLength(0);
  });

  it("should exclude resolved findings", () => {
    const findings: AegisSecurityFinding[] = [
      makeFinding({ severity: "critical", resolvedAt: "2026-03-22T00:00:00.000Z" }),
    ];

    const result = filterFindingsForQbr(findings);
    expect(result).toHaveLength(0);
  });
});

// ── QBR Data Assembly ───────────────────────────────────────────────

describe("Build AEGIS QBR Data", () => {
  it("should count resolved since last QBR", () => {
    const score = makeScorePayload();
    const findings: AegisSecurityFinding[] = [
      makeFinding({ severity: "critical", resolvedAt: null }),
      makeFinding({ severity: "high", resolvedAt: "2026-03-22T00:00:00.000Z" }),
      makeFinding({ severity: "medium", resolvedAt: "2026-03-21T00:00:00.000Z" }),
      makeFinding({ severity: "low", resolvedAt: "2026-01-01T00:00:00.000Z" }),
    ];

    const result = buildAegisQbrData(score, findings, "2026-03-15T00:00:00.000Z");

    expect(result.unresolvedCount).toBe(1);
    expect(result.resolvedSinceLastQbr).toBe(2); // two resolved after March 15
  });

  it("should handle no previous QBR date", () => {
    const score = makeScorePayload();
    const findings: AegisSecurityFinding[] = [
      makeFinding({ severity: "high", resolvedAt: "2026-03-22T00:00:00.000Z" }),
    ];

    const result = buildAegisQbrData(score, findings);
    expect(result.resolvedSinceLastQbr).toBe(0);
  });
});
