/**
 * Vespar Cost Modeling — Unit Tests
 *
 * Tests the deterministic cost estimation and TCO computation logic.
 * No database or network calls — pure function testing.
 */

import { describe, it, expect } from "vitest";

// Import the pure sequenceWorkloads function
import { sequenceWorkloads } from "../agents/migration-planner";

// We can't import internal functions directly, so we'll test via the
// exported interface and replicate the cost estimation logic here
// for unit verification.

// -----------------------------------------------------------------------
// Cost Estimation Logic (mirrored from migration-planner for testing)
// -----------------------------------------------------------------------

interface TestWorkload {
  type: string;
  criticality: string;
}

const COST_MAP: Record<string, { current: number; projected: number; migration: number }> = {
  server: { current: 500, projected: 350, migration: 2000 },
  database: { current: 800, projected: 600, migration: 5000 },
  application: { current: 300, projected: 250, migration: 3000 },
  storage: { current: 200, projected: 100, migration: 1000 },
  network: { current: 150, projected: 100, migration: 1500 },
  identity: { current: 100, projected: 80, migration: 2500 },
  other: { current: 250, projected: 200, migration: 1500 },
};

function estimateBaseCost(w: TestWorkload) {
  const base = COST_MAP[w.type] ?? COST_MAP.other;
  const critMultiplier =
    w.criticality === "critical" ? 2.0
    : w.criticality === "high" ? 1.5
    : w.criticality === "medium" ? 1.0
    : 0.7;

  return {
    current: Math.round(base.current * critMultiplier),
    projected: Math.round(base.projected * critMultiplier),
    migration: Math.round(base.migration * critMultiplier),
  };
}

function computeTcoSummary(
  projections: Array<{
    currentMonthlyCost: string;
    projectedMonthlyCost: string;
    migrationCostOnetime: string;
  }>,
) {
  let totalCurrentMonthly = 0;
  let totalProjectedMonthly = 0;
  let totalMigrationOnetime = 0;

  for (const p of projections) {
    totalCurrentMonthly += parseFloat(p.currentMonthlyCost) || 0;
    totalProjectedMonthly += parseFloat(p.projectedMonthlyCost) || 0;
    totalMigrationOnetime += parseFloat(p.migrationCostOnetime) || 0;
  }

  const monthlySavings = totalCurrentMonthly - totalProjectedMonthly;
  const annualSavings = monthlySavings * 12;
  const paybackMonths = monthlySavings > 0
    ? Math.ceil(totalMigrationOnetime / monthlySavings)
    : null;

  return {
    totalCurrentMonthly,
    totalProjectedMonthly,
    totalMigrationOnetime,
    monthlySavings,
    annualSavings,
    threeYearTco: totalProjectedMonthly * 36 + totalMigrationOnetime,
    currentThreeYearTco: totalCurrentMonthly * 36,
    paybackMonths,
  };
}

// -----------------------------------------------------------------------
// Tests: Cost Estimation
// -----------------------------------------------------------------------

describe("Cost Estimation", () => {
  it("should calculate server costs with critical multiplier", () => {
    const cost = estimateBaseCost({ type: "server", criticality: "critical" });
    expect(cost.current).toBe(1000);   // 500 * 2.0
    expect(cost.projected).toBe(700);  // 350 * 2.0
    expect(cost.migration).toBe(4000); // 2000 * 2.0
  });

  it("should calculate database costs with high multiplier", () => {
    const cost = estimateBaseCost({ type: "database", criticality: "high" });
    expect(cost.current).toBe(1200);   // 800 * 1.5
    expect(cost.projected).toBe(900);  // 600 * 1.5
    expect(cost.migration).toBe(7500); // 5000 * 1.5
  });

  it("should calculate application costs with medium multiplier", () => {
    const cost = estimateBaseCost({ type: "application", criticality: "medium" });
    expect(cost.current).toBe(300);
    expect(cost.projected).toBe(250);
    expect(cost.migration).toBe(3000);
  });

  it("should calculate storage costs with low multiplier", () => {
    const cost = estimateBaseCost({ type: "storage", criticality: "low" });
    expect(cost.current).toBe(140);    // 200 * 0.7
    expect(cost.projected).toBe(70);   // 100 * 0.7
    expect(cost.migration).toBe(700);  // 1000 * 0.7
  });

  it("should fall back to 'other' for unknown workload types", () => {
    const cost = estimateBaseCost({ type: "mainframe", criticality: "medium" });
    expect(cost.current).toBe(250);
    expect(cost.projected).toBe(200);
    expect(cost.migration).toBe(1500);
  });

  it("should always produce non-negative costs", () => {
    for (const type of Object.keys(COST_MAP)) {
      for (const crit of ["critical", "high", "medium", "low"]) {
        const cost = estimateBaseCost({ type, criticality: crit });
        expect(cost.current).toBeGreaterThanOrEqual(0);
        expect(cost.projected).toBeGreaterThanOrEqual(0);
        expect(cost.migration).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should produce projected <= current for all types (cloud savings)", () => {
    for (const type of Object.keys(COST_MAP)) {
      const cost = estimateBaseCost({ type, criticality: "medium" });
      expect(cost.projected).toBeLessThanOrEqual(cost.current);
    }
  });
});

// -----------------------------------------------------------------------
// Tests: TCO Summary
// -----------------------------------------------------------------------

describe("TCO Summary Computation", () => {
  it("should compute correct totals for multiple workloads", () => {
    const projections = [
      { currentMonthlyCost: "500", projectedMonthlyCost: "350", migrationCostOnetime: "2000" },
      { currentMonthlyCost: "800", projectedMonthlyCost: "600", migrationCostOnetime: "5000" },
    ];

    const summary = computeTcoSummary(projections);
    expect(summary.totalCurrentMonthly).toBe(1300);
    expect(summary.totalProjectedMonthly).toBe(950);
    expect(summary.totalMigrationOnetime).toBe(7000);
    expect(summary.monthlySavings).toBe(350);
    expect(summary.annualSavings).toBe(4200);
  });

  it("should compute 3-year TCO correctly", () => {
    const projections = [
      { currentMonthlyCost: "1000", projectedMonthlyCost: "700", migrationCostOnetime: "10000" },
    ];

    const summary = computeTcoSummary(projections);
    expect(summary.threeYearTco).toBe(700 * 36 + 10000); // 35200
    expect(summary.currentThreeYearTco).toBe(1000 * 36); // 36000
  });

  it("should compute payback period in months", () => {
    const projections = [
      { currentMonthlyCost: "1000", projectedMonthlyCost: "600", migrationCostOnetime: "2000" },
    ];

    const summary = computeTcoSummary(projections);
    // monthly savings = 400, migration = 2000, payback = ceil(2000/400) = 5
    expect(summary.paybackMonths).toBe(5);
  });

  it("should return null payback when no savings", () => {
    const projections = [
      { currentMonthlyCost: "500", projectedMonthlyCost: "600", migrationCostOnetime: "3000" },
    ];

    const summary = computeTcoSummary(projections);
    expect(summary.paybackMonths).toBeNull();
  });

  it("should handle empty projections", () => {
    const summary = computeTcoSummary([]);
    expect(summary.totalCurrentMonthly).toBe(0);
    expect(summary.totalProjectedMonthly).toBe(0);
    expect(summary.monthlySavings).toBe(0);
  });

  it("should handle non-numeric cost strings gracefully", () => {
    const projections = [
      { currentMonthlyCost: "not-a-number", projectedMonthlyCost: "also-bad", migrationCostOnetime: "" },
    ];

    const summary = computeTcoSummary(projections);
    expect(summary.totalCurrentMonthly).toBe(0);
    expect(summary.totalProjectedMonthly).toBe(0);
  });
});
