/**
 * CVG-HIPAA — Unit Tests: Safeguard Scoring & Risk Level Computation
 *
 * Tests the deterministic computeRiskLevel function and controlStateToScore mapping.
 */

import { describe, it, expect } from "vitest";
import { computeRiskLevel, controlStateToScore } from "../shared/models/hipaa";

describe("computeRiskLevel", () => {
  it("should compute correct score as likelihood * impact", () => {
    expect(computeRiskLevel(1, 1).score).toBe(1);
    expect(computeRiskLevel(3, 4).score).toBe(12);
    expect(computeRiskLevel(5, 5).score).toBe(25);
    expect(computeRiskLevel(2, 3).score).toBe(6);
  });

  it("should classify scores 1-5 as low", () => {
    expect(computeRiskLevel(1, 1).level).toBe("low");
    expect(computeRiskLevel(1, 5).level).toBe("low");
    expect(computeRiskLevel(5, 1).level).toBe("low");
    expect(computeRiskLevel(1, 3).level).toBe("low");
  });

  it("should classify scores 6-10 as medium", () => {
    expect(computeRiskLevel(2, 3).level).toBe("medium");
    expect(computeRiskLevel(2, 4).level).toBe("medium");
    expect(computeRiskLevel(2, 5).level).toBe("medium");
    expect(computeRiskLevel(3, 2).level).toBe("medium");
  });

  it("should classify scores 11-15 as high", () => {
    expect(computeRiskLevel(3, 4).level).toBe("high");
    expect(computeRiskLevel(3, 5).level).toBe("high");
    expect(computeRiskLevel(5, 3).level).toBe("high");
  });

  it("should classify scores 16-25 as critical", () => {
    expect(computeRiskLevel(4, 4).level).toBe("critical");
    expect(computeRiskLevel(5, 4).level).toBe("critical");
    expect(computeRiskLevel(4, 5).level).toBe("critical");
    expect(computeRiskLevel(5, 5).level).toBe("critical");
  });

  it("should return both score and level in result object", () => {
    const result = computeRiskLevel(3, 5);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("level");
    expect(result.score).toBe(15);
    expect(result.level).toBe("high");
  });

  // Boundary tests
  it("should handle boundary at score=5 (low)", () => {
    const result = computeRiskLevel(1, 5);
    expect(result.score).toBe(5);
    expect(result.level).toBe("low");
  });

  it("should handle boundary at score=6 (medium)", () => {
    const result = computeRiskLevel(2, 3);
    expect(result.score).toBe(6);
    expect(result.level).toBe("medium");
  });

  it("should handle boundary at score=11 (high)", () => {
    // 11 is the boundary
    // There's no direct L*I=11 with integers, but let's verify the closest
    const result = computeRiskLevel(3, 4);
    expect(result.score).toBe(12);
    expect(result.level).toBe("high");
  });

  it("should handle boundary at score=16 (critical)", () => {
    const result = computeRiskLevel(4, 4);
    expect(result.score).toBe(16);
    expect(result.level).toBe("critical");
  });
});

describe("controlStateToScore", () => {
  it("should map 'implemented' to 'compliant'", () => {
    expect(controlStateToScore("implemented")).toBe("compliant");
  });

  it("should map 'partial' to 'partially_compliant'", () => {
    expect(controlStateToScore("partial")).toBe("partially_compliant");
  });

  it("should map 'not_implemented' to 'non_compliant'", () => {
    expect(controlStateToScore("not_implemented")).toBe("non_compliant");
  });

  it("should map unknown states to 'not_applicable'", () => {
    expect(controlStateToScore("")).toBe("not_applicable");
    expect(controlStateToScore("unknown")).toBe("not_applicable");
  });
});
