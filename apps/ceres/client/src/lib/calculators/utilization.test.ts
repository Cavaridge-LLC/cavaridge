import { describe, it, expect } from "vitest";
import {
  calculateUtilization,
  getClinicalGroupings,
  type PDGMInputs,
} from "./utilization";

// ---------------------------------------------------------------------------
// getClinicalGroupings
// ---------------------------------------------------------------------------

describe("getClinicalGroupings", () => {
  it("returns all 13 clinical groupings", () => {
    const groupings = getClinicalGroupings();
    expect(groupings.length).toBe(13);
  });

  it("each grouping has a value and label", () => {
    const groupings = getClinicalGroupings();
    for (const g of groupings) {
      expect(g.value).toBeTruthy();
      expect(g.label).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// calculateUtilization — Normal cases
// ---------------------------------------------------------------------------

describe("calculateUtilization — normal range", () => {
  it("reports normal for visits within expected range", () => {
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_Cardiac_Circulatory",
      functionalLevel: "medium",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 8,
      period: 1,
    });
    expect(result.severity).toBe("normal");
    expect(result.findings.some((f) => f.category === "Utilization" && f.severity === "normal")).toBe(true);
  });

  it("returns correct PDGM group label", () => {
    const result = calculateUtilization({
      clinicalGrouping: "Wound",
      functionalLevel: "high",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 15,
      period: 1,
    });
    expect(result.pdgmGroup).toBe("Wound");
  });
});

// ---------------------------------------------------------------------------
// calculateUtilization — LUPA risk
// ---------------------------------------------------------------------------

describe("calculateUtilization — LUPA", () => {
  it("flags critical severity for visits below LUPA threshold", () => {
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_Endocrine",
      functionalLevel: "low",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 1,
      period: 1,
    });
    expect(result.severity).toBe("critical");
    expect(result.findings.some((f) => f.category === "LUPA Risk")).toBe(true);
  });

  it("zero visits triggers LUPA", () => {
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_Other",
      functionalLevel: "medium",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 0,
      period: 1,
    });
    expect(result.severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// calculateUtilization — Over-utilization
// ---------------------------------------------------------------------------

describe("calculateUtilization — over-utilization", () => {
  it("flags high severity when visits exceed expected range", () => {
    // MMTA_Endocrine low functional: expected 3-7
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_Endocrine",
      functionalLevel: "low",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 12,
      period: 1,
    });
    expect(["high", "critical"]).toContain(result.severity);
    expect(result.findings.some((f) => f.category === "Over-Utilization" || f.category === "High Utilization Flag")).toBe(true);
  });

  it("flags critical for very high visit counts (high utilization flag)", () => {
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_Behavioral",
      functionalLevel: "low",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 20,
      period: 1,
    });
    expect(result.severity).toBe("critical");
    expect(result.findings.some((f) => f.category === "High Utilization Flag")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateUtilization — Comorbidity adjustments
// ---------------------------------------------------------------------------

describe("calculateUtilization — comorbidity", () => {
  it("high comorbidity increases expected visit range", () => {
    const base: PDGMInputs = {
      clinicalGrouping: "MMTA_Cardiac_Circulatory",
      functionalLevel: "medium",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 10,
      period: 1,
    };

    const noComorbidity = calculateUtilization(base);
    const highComorbidity = calculateUtilization({
      ...base,
      comorbidityAdjustment: "high",
    });

    expect(highComorbidity.expectedVisitRange.high).toBeGreaterThan(noComorbidity.expectedVisitRange.high);
  });

  it("comorbidity finding is present when adjustment is applied", () => {
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_GI_GU",
      functionalLevel: "medium",
      comorbidityAdjustment: "low",
      admissionSource: "community",
      timing: "early",
      actualVisits: 8,
      period: 1,
    });
    expect(result.findings.some((f) => f.category === "Comorbidity")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateUtilization — Timing & admission source
// ---------------------------------------------------------------------------

describe("calculateUtilization — timing and admission", () => {
  it("late timing (recert) reduces expected range", () => {
    const base: PDGMInputs = {
      clinicalGrouping: "Neuro_Rehab",
      functionalLevel: "medium",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 12,
      period: 1,
    };

    const early = calculateUtilization(base);
    const late = calculateUtilization({ ...base, timing: "late" });

    expect(late.expectedVisitRange.high).toBeLessThanOrEqual(early.expectedVisitRange.high);
  });

  it("institutional + early increases expected range", () => {
    const base: PDGMInputs = {
      clinicalGrouping: "Complex_Nursing",
      functionalLevel: "high",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 15,
      period: 1,
    };

    const community = calculateUtilization(base);
    const institutional = calculateUtilization({
      ...base,
      admissionSource: "institutional",
    });

    expect(institutional.expectedVisitRange.high).toBeGreaterThanOrEqual(community.expectedVisitRange.high);
  });
});

// ---------------------------------------------------------------------------
// calculateUtilization — Period 2 pattern
// ---------------------------------------------------------------------------

describe("calculateUtilization — period 2", () => {
  it("flags elevated pattern for high visit count in period 2", () => {
    // Wound high functional: expected 10-22
    // High visit count in period 2 should be flagged
    const result = calculateUtilization({
      clinicalGrouping: "Wound",
      functionalLevel: "high",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 20,
      period: 2,
    });
    expect(result.findings.some((f) => f.category === "Period 2 Pattern")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateUtilization — utilization ratio
// ---------------------------------------------------------------------------

describe("calculateUtilization — utilization ratio", () => {
  it("ratio is 1.0 when actual equals expected midpoint", () => {
    // MMTA_Cardiac medium: expected 5-12, midpoint 8.5
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_Cardiac_Circulatory",
      functionalLevel: "medium",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 9, // close to midpoint of 8.5
      period: 1,
    });
    expect(result.utilizationRatio).toBeGreaterThan(0.9);
    expect(result.utilizationRatio).toBeLessThan(1.2);
  });

  it("ratio is 0 when actual visits is 0", () => {
    const result = calculateUtilization({
      clinicalGrouping: "MMTA_Other",
      functionalLevel: "low",
      comorbidityAdjustment: "none",
      admissionSource: "community",
      timing: "early",
      actualVisits: 0,
      period: 1,
    });
    expect(result.utilizationRatio).toBe(0);
  });
});
