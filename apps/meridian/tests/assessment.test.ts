/**
 * Meridian — Assessment Framework Unit Tests
 *
 * Tests for risk classification, evidence tagging, risk score computation,
 * and assessment section ordering.
 */

import { describe, it, expect } from "vitest";

// ── Risk Score Computation ────────────────────────────────────────────

// Inline the pure functions to test them without DB dependencies.
// These mirror the logic in server/services/assessment-service.ts.

type RiskSeverity = "critical" | "high" | "medium" | "low";
type RiskLikelihood = "almost_certain" | "likely" | "possible" | "unlikely" | "rare";

const SEVERITY_SCORES: Record<RiskSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 1,
};

const LIKELIHOOD_SCORES: Record<RiskLikelihood, number> = {
  almost_certain: 5,
  likely: 4,
  possible: 3,
  unlikely: 2,
  rare: 1,
};

function computeRiskScore(severity: RiskSeverity, likelihood: RiskLikelihood): number {
  return SEVERITY_SCORES[severity] * LIKELIHOOD_SCORES[likelihood];
}

function classifyRiskScore(score: number): RiskSeverity {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

interface RiskEntry {
  riskScore: number;
  status: string;
}

function computeOverallRisk(entries: RiskEntry[]): RiskSeverity | null {
  if (entries.length === 0) return null;
  const openEntries = entries.filter(e => e.status === "open" || e.status === "in_progress");
  if (openEntries.length === 0) return "low";
  const maxScore = Math.max(...openEntries.map(e => e.riskScore));
  return classifyRiskScore(maxScore);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Risk Score Computation", () => {
  it("computes maximum risk score (critical x almost_certain = 25)", () => {
    expect(computeRiskScore("critical", "almost_certain")).toBe(25);
  });

  it("computes minimum risk score (low x rare = 1)", () => {
    expect(computeRiskScore("low", "rare")).toBe(1);
  });

  it("computes high x likely = 16", () => {
    expect(computeRiskScore("high", "likely")).toBe(16);
  });

  it("computes medium x possible = 9", () => {
    expect(computeRiskScore("medium", "possible")).toBe(9);
  });

  it("computes critical x unlikely = 10", () => {
    expect(computeRiskScore("critical", "unlikely")).toBe(10);
  });

  it("computes low x almost_certain = 5", () => {
    expect(computeRiskScore("low", "almost_certain")).toBe(5);
  });
});

describe("Risk Score Classification", () => {
  it("classifies score 25 as critical", () => {
    expect(classifyRiskScore(25)).toBe("critical");
  });

  it("classifies score 20 as critical", () => {
    expect(classifyRiskScore(20)).toBe("critical");
  });

  it("classifies score 16 as high", () => {
    expect(classifyRiskScore(16)).toBe("high");
  });

  it("classifies score 12 as high", () => {
    expect(classifyRiskScore(12)).toBe("high");
  });

  it("classifies score 9 as medium", () => {
    expect(classifyRiskScore(9)).toBe("medium");
  });

  it("classifies score 6 as medium", () => {
    expect(classifyRiskScore(6)).toBe("medium");
  });

  it("classifies score 5 as low", () => {
    expect(classifyRiskScore(5)).toBe("low");
  });

  it("classifies score 1 as low", () => {
    expect(classifyRiskScore(1)).toBe("low");
  });

  it("classifies score 0 as low", () => {
    expect(classifyRiskScore(0)).toBe("low");
  });
});

describe("Overall Risk Rating", () => {
  it("returns null for empty entries", () => {
    expect(computeOverallRisk([])).toBeNull();
  });

  it("returns low when all entries are resolved", () => {
    expect(computeOverallRisk([
      { riskScore: 25, status: "resolved" },
      { riskScore: 16, status: "mitigated" },
    ])).toBe("low");
  });

  it("returns critical when highest open entry is critical", () => {
    expect(computeOverallRisk([
      { riskScore: 25, status: "open" },
      { riskScore: 9, status: "open" },
    ])).toBe("critical");
  });

  it("returns high when highest open entry is high", () => {
    expect(computeOverallRisk([
      { riskScore: 16, status: "open" },
      { riskScore: 25, status: "resolved" },
    ])).toBe("high");
  });

  it("considers in_progress entries as active", () => {
    expect(computeOverallRisk([
      { riskScore: 20, status: "in_progress" },
      { riskScore: 6, status: "open" },
    ])).toBe("critical");
  });

  it("returns medium for mid-range risk", () => {
    expect(computeOverallRisk([
      { riskScore: 9, status: "open" },
      { riskScore: 4, status: "open" },
    ])).toBe("medium");
  });
});

// ── Evidence Tagging ──────────────────────────────────────────────────

type EvidenceTag = "OBSERVED" | "REPRESENTED" | "UNVERIFIED";

function isValidEvidenceTag(tag: string): tag is EvidenceTag {
  return ["OBSERVED", "REPRESENTED", "UNVERIFIED"].includes(tag);
}

function getEvidenceConfidenceLevel(tag: EvidenceTag): number {
  switch (tag) {
    case "OBSERVED": return 1.0;
    case "REPRESENTED": return 0.6;
    case "UNVERIFIED": return 0.2;
  }
}

function computeSectionEvidenceConfidence(tags: EvidenceTag[]): number {
  if (tags.length === 0) return 0;
  const total = tags.reduce((sum, tag) => sum + getEvidenceConfidenceLevel(tag), 0);
  return Math.round((total / tags.length) * 100) / 100;
}

describe("Evidence Tagging", () => {
  it("validates OBSERVED as valid evidence tag", () => {
    expect(isValidEvidenceTag("OBSERVED")).toBe(true);
  });

  it("validates REPRESENTED as valid evidence tag", () => {
    expect(isValidEvidenceTag("REPRESENTED")).toBe(true);
  });

  it("validates UNVERIFIED as valid evidence tag", () => {
    expect(isValidEvidenceTag("UNVERIFIED")).toBe(true);
  });

  it("rejects invalid evidence tags", () => {
    expect(isValidEvidenceTag("observed")).toBe(false);
    expect(isValidEvidenceTag("unknown")).toBe(false);
    expect(isValidEvidenceTag("")).toBe(false);
  });

  it("OBSERVED has highest confidence level (1.0)", () => {
    expect(getEvidenceConfidenceLevel("OBSERVED")).toBe(1.0);
  });

  it("REPRESENTED has moderate confidence level (0.6)", () => {
    expect(getEvidenceConfidenceLevel("REPRESENTED")).toBe(0.6);
  });

  it("UNVERIFIED has lowest confidence level (0.2)", () => {
    expect(getEvidenceConfidenceLevel("UNVERIFIED")).toBe(0.2);
  });

  it("computes section confidence from mixed evidence tags", () => {
    const tags: EvidenceTag[] = ["OBSERVED", "REPRESENTED", "UNVERIFIED"];
    expect(computeSectionEvidenceConfidence(tags)).toBe(0.6);
  });

  it("returns full confidence for all OBSERVED evidence", () => {
    const tags: EvidenceTag[] = ["OBSERVED", "OBSERVED", "OBSERVED"];
    expect(computeSectionEvidenceConfidence(tags)).toBe(1.0);
  });

  it("returns zero confidence for empty evidence set", () => {
    expect(computeSectionEvidenceConfidence([])).toBe(0);
  });
});

// ── Assessment Section Ordering ───────────────────────────────────────

const ASSESSMENT_SECTIONS = [
  { id: "executive_summary", order: 1, name: "Executive Summary" },
  { id: "infrastructure_architecture", order: 2, name: "Infrastructure & Architecture" },
  { id: "cybersecurity_posture", order: 3, name: "Cybersecurity Posture" },
  { id: "application_landscape", order: 4, name: "Application Landscape" },
  { id: "data_governance", order: 5, name: "Data Assets & Governance" },
  { id: "cloud_services", order: 6, name: "Cloud Services & SaaS" },
  { id: "it_operations", order: 7, name: "IT Operations & Support" },
  { id: "compliance_regulatory", order: 8, name: "Compliance & Regulatory" },
  { id: "technology_talent", order: 9, name: "Technology Organization & Talent" },
  { id: "integration_complexity", order: 10, name: "Integration Complexity" },
  { id: "capex_projections", order: 11, name: "CapEx Projections & Cost Analysis" },
  { id: "risk_summary", order: 12, name: "Risk Summary & Recommendations" },
] as const;

describe("Assessment Section Framework", () => {
  it("has exactly 12 sections", () => {
    expect(ASSESSMENT_SECTIONS.length).toBe(12);
  });

  it("sections are ordered sequentially from 1 to 12", () => {
    ASSESSMENT_SECTIONS.forEach((section, index) => {
      expect(section.order).toBe(index + 1);
    });
  });

  it("starts with Executive Summary", () => {
    expect(ASSESSMENT_SECTIONS[0].id).toBe("executive_summary");
  });

  it("ends with Risk Summary & Recommendations", () => {
    expect(ASSESSMENT_SECTIONS[11].id).toBe("risk_summary");
  });

  it("every section has a unique id", () => {
    const ids = ASSESSMENT_SECTIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every section has a non-empty name", () => {
    ASSESSMENT_SECTIONS.forEach(section => {
      expect(section.name.length).toBeGreaterThan(0);
    });
  });

  it("includes Infrastructure & Architecture section", () => {
    const found = ASSESSMENT_SECTIONS.find(s => s.id === "infrastructure_architecture");
    expect(found).toBeDefined();
    expect(found!.order).toBe(2);
  });

  it("includes Cybersecurity Posture section", () => {
    const found = ASSESSMENT_SECTIONS.find(s => s.id === "cybersecurity_posture");
    expect(found).toBeDefined();
    expect(found!.order).toBe(3);
  });

  it("includes CapEx Projections section", () => {
    const found = ASSESSMENT_SECTIONS.find(s => s.id === "capex_projections");
    expect(found).toBeDefined();
    expect(found!.order).toBe(11);
  });
});

// ── Existing helpers from _helpers.ts ─────────────────────────────────

// Mirror the functions from routes/_helpers.ts for testing

const SEVERITY_PENALTIES: Record<string, number> = {
  critical: 0.8,
  high: 0.5,
  medium: 0.25,
  low: 0.1,
};

function computeFindingScore(findingsForPillar: Array<{ severity: string; status: string }>): number {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findingsForPillar) {
    if (f.status === "open" || f.status === "acknowledged") {
      const sev = f.severity as keyof typeof counts;
      if (sev in counts) counts[sev]++;
    }
  }

  let score = 5.0;
  score -= counts.critical * 0.8;
  score -= counts.high * 0.5;
  const mediumPenalty = Math.min(counts.medium, 5) * 0.25 +
                        Math.max(0, counts.medium - 5) * 0.10;
  score -= mediumPenalty;
  const lowPenalty = Math.min(counts.low, 3) * 0.1 +
                     Math.max(0, counts.low - 3) * 0.03;
  score -= lowPenalty;

  return Math.max(1.0, Math.round(score * 100) / 100);
}

function getEvidenceTier(docCount: number): { confidence: number; scoreCap: number; label: string } {
  if (docCount === 0) return { confidence: 0.0, scoreCap: 3.0, label: "insufficient" };
  if (docCount <= 2) return { confidence: 0.25, scoreCap: 4.0, label: "low" };
  if (docCount <= 5) return { confidence: 0.65, scoreCap: 4.8, label: "moderate" };
  return { confidence: 1.0, scoreCap: 5.0, label: "high" };
}

describe("Finding Score Computation (existing helpers)", () => {
  it("returns 5.0 for no findings", () => {
    expect(computeFindingScore([])).toBe(5.0);
  });

  it("deducts 0.8 per critical open finding", () => {
    expect(computeFindingScore([
      { severity: "critical", status: "open" },
    ])).toBe(4.2);
  });

  it("deducts 0.5 per high open finding", () => {
    expect(computeFindingScore([
      { severity: "high", status: "open" },
    ])).toBe(4.5);
  });

  it("ignores resolved findings", () => {
    expect(computeFindingScore([
      { severity: "critical", status: "resolved" },
      { severity: "high", status: "mitigated" },
    ])).toBe(5.0);
  });

  it("does not go below 1.0", () => {
    const manyFindings = Array.from({ length: 20 }, () => ({ severity: "critical", status: "open" }));
    expect(computeFindingScore(manyFindings)).toBe(1.0);
  });

  it("counts acknowledged findings as active", () => {
    expect(computeFindingScore([
      { severity: "critical", status: "acknowledged" },
    ])).toBe(4.2);
  });
});

describe("Evidence Tier Classification (existing helpers)", () => {
  it("0 documents = insufficient", () => {
    const tier = getEvidenceTier(0);
    expect(tier.label).toBe("insufficient");
    expect(tier.scoreCap).toBe(3.0);
    expect(tier.confidence).toBe(0.0);
  });

  it("1-2 documents = low", () => {
    const tier = getEvidenceTier(2);
    expect(tier.label).toBe("low");
    expect(tier.scoreCap).toBe(4.0);
    expect(tier.confidence).toBe(0.25);
  });

  it("3-5 documents = moderate", () => {
    const tier = getEvidenceTier(4);
    expect(tier.label).toBe("moderate");
    expect(tier.scoreCap).toBe(4.8);
    expect(tier.confidence).toBe(0.65);
  });

  it("6+ documents = high", () => {
    const tier = getEvidenceTier(10);
    expect(tier.label).toBe("high");
    expect(tier.scoreCap).toBe(5.0);
    expect(tier.confidence).toBe(1.0);
  });
});
