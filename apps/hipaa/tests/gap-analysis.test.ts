/**
 * CVG-HIPAA — Unit Tests: Gap Analysis Generation
 *
 * Tests the deterministic generateGapAnalysis function that produces
 * compliance gap items from assessment control records.
 */

import { describe, it, expect } from "vitest";
import { generateGapAnalysis, type AssessmentControl } from "../shared/models/hipaa";

function makeControl(overrides: Partial<AssessmentControl> = {}): AssessmentControl {
  return {
    id: "ctrl-001",
    assessmentId: "assessment-001",
    controlRef: "164.308(a)(1)",
    controlName: "Security Management Process",
    category: "administrative",
    safeguardType: "standard",
    currentState: "not_implemented",
    findingDetail: null,
    likelihood: 3,
    impact: 4,
    riskScore: 12,
    riskLevel: "high",
    riskTreatment: null,
    evidenceNotes: null,
    tenantId: "tenant-001",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("generateGapAnalysis", () => {
  it("should return empty array when all controls are implemented", () => {
    const controls = [
      makeControl({ currentState: "implemented", controlRef: "164.308(a)(1)" }),
      makeControl({ currentState: "implemented", controlRef: "164.308(a)(2)" }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps).toHaveLength(0);
  });

  it("should include non-implemented controls in gaps", () => {
    const controls = [
      makeControl({ currentState: "not_implemented", controlRef: "164.308(a)(1)", controlName: "Security Management Process" }),
      makeControl({ currentState: "implemented", controlRef: "164.308(a)(2)" }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].controlRef).toBe("164.308(a)(1)");
    expect(gaps[0].score).toBe("non_compliant");
  });

  it("should include partially implemented controls in gaps", () => {
    const controls = [
      makeControl({ currentState: "partial", controlRef: "164.308(a)(3)", controlName: "Workforce Security" }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].score).toBe("partially_compliant");
    expect(gaps[0].recommendation).toContain("Complete the implementation");
  });

  it("should sort gaps by risk score descending", () => {
    const controls = [
      makeControl({ currentState: "not_implemented", controlRef: "164.308(a)(1)", riskScore: 5 }),
      makeControl({ currentState: "not_implemented", controlRef: "164.308(a)(2)", riskScore: 20 }),
      makeControl({ currentState: "partial", controlRef: "164.308(a)(3)", riskScore: 12 }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps).toHaveLength(3);
    expect(gaps[0].riskScore).toBe(20);
    expect(gaps[1].riskScore).toBe(12);
    expect(gaps[2].riskScore).toBe(5);
  });

  it("should assign correct priority based on risk level", () => {
    const controls = [
      makeControl({ currentState: "not_implemented", riskLevel: "critical", riskScore: 20 }),
      makeControl({ currentState: "not_implemented", riskLevel: "high", riskScore: 12, controlRef: "164.308(a)(2)" }),
      makeControl({ currentState: "not_implemented", riskLevel: "medium", riskScore: 8, controlRef: "164.308(a)(3)" }),
      makeControl({ currentState: "not_implemented", riskLevel: "low", riskScore: 3, controlRef: "164.308(a)(4)" }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps[0].priority).toBe("critical");
    expect(gaps[1].priority).toBe("high");
    expect(gaps[2].priority).toBe("medium");
    expect(gaps[3].priority).toBe("low");
  });

  it("should generate appropriate recommendations for not_implemented controls", () => {
    const controls = [
      makeControl({
        currentState: "not_implemented",
        controlRef: "164.312(a)(1)",
        controlName: "Access Control",
      }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps[0].recommendation).toContain("Implement");
    expect(gaps[0].recommendation).toContain("Access Control");
    expect(gaps[0].recommendation).toContain("164.312(a)(1)");
  });

  it("should generate appropriate recommendations for partial controls", () => {
    const controls = [
      makeControl({
        currentState: "partial",
        controlRef: "164.310(a)(1)",
        controlName: "Facility Access Controls",
      }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps[0].recommendation).toContain("Complete the implementation");
    expect(gaps[0].recommendation).toContain("Facility Access Controls");
  });

  it("should preserve finding details in gap items", () => {
    const controls = [
      makeControl({
        currentState: "not_implemented",
        findingDetail: "No risk analysis has been conducted in the past 3 years",
      }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps[0].findingDetail).toBe("No risk analysis has been conducted in the past 3 years");
  });

  it("should include all three safeguard categories", () => {
    const controls = [
      makeControl({ currentState: "not_implemented", category: "administrative", controlRef: "164.308(a)(1)", riskScore: 15 }),
      makeControl({ currentState: "not_implemented", category: "physical", controlRef: "164.310(a)(1)", riskScore: 10 }),
      makeControl({ currentState: "not_implemented", category: "technical", controlRef: "164.312(a)(1)", riskScore: 20 }),
    ];

    const gaps = generateGapAnalysis(controls);
    const categories = gaps.map(g => g.category);
    expect(categories).toContain("administrative");
    expect(categories).toContain("physical");
    expect(categories).toContain("technical");
  });

  it("should handle controls with null risk scores", () => {
    const controls = [
      makeControl({ currentState: "not_implemented", riskScore: null, riskLevel: null }),
    ];

    const gaps = generateGapAnalysis(controls);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].riskScore).toBeNull();
    expect(gaps[0].priority).toBe("low");
  });
});
