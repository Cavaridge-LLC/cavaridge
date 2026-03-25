/**
 * Budget Rollup Calculations — Unit Tests
 *
 * Tests deterministic budget rollup logic for CapEx/OpEx
 * projections by quarter and year.
 */

import { describe, it, expect } from "vitest";
import {
  calculateQuarterlyRollup,
  calculateAnnualRollup,
  calculateBudgetRollup,
} from "../server/modules/budget/calculator";
import type { BudgetItemRecord } from "@shared/schema";

// ── Test Fixture ────────────────────────────────────────────────────

function makeBudgetItem(overrides: Partial<BudgetItemRecord> = {}): BudgetItemRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: "org-1",
    clientId: "client-1",
    projectId: null,
    roadmapId: null,
    title: "Test Budget Item",
    description: null,
    expenseType: "capex",
    category: "infrastructure",
    plannedAmount: "1000",
    actualAmount: null,
    quarter: "Q1",
    fiscalYear: 2026,
    isRecurring: 0,
    recurringInterval: null,
    vendor: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Quarterly Rollup ────────────────────────────────────────────────

describe("Quarterly Rollup", () => {
  it("should calculate CapEx and OpEx separately", () => {
    const items: BudgetItemRecord[] = [
      makeBudgetItem({ expenseType: "capex", plannedAmount: "5000", actualAmount: "4800", quarter: "Q1", fiscalYear: 2026 }),
      makeBudgetItem({ expenseType: "opex", plannedAmount: "2000", actualAmount: "2100", quarter: "Q1", fiscalYear: 2026 }),
      makeBudgetItem({ expenseType: "capex", plannedAmount: "3000", actualAmount: "3200", quarter: "Q1", fiscalYear: 2026 }),
    ];

    const result = calculateQuarterlyRollup(items, "Q1", 2026);

    expect(result.plannedCapex).toBe(8000);
    expect(result.actualCapex).toBe(8000);
    expect(result.plannedOpex).toBe(2000);
    expect(result.actualOpex).toBe(2100);
    expect(result.plannedTotal).toBe(10000);
    expect(result.actualTotal).toBe(10100);
    expect(result.variance).toBe(100);
  });

  it("should return zeros for empty quarter", () => {
    const result = calculateQuarterlyRollup([], "Q1", 2026);

    expect(result.plannedCapex).toBe(0);
    expect(result.actualCapex).toBe(0);
    expect(result.plannedOpex).toBe(0);
    expect(result.actualOpex).toBe(0);
    expect(result.plannedTotal).toBe(0);
    expect(result.actualTotal).toBe(0);
    expect(result.variance).toBe(0);
    expect(result.variancePct).toBe(0);
  });

  it("should filter to correct quarter and year", () => {
    const items: BudgetItemRecord[] = [
      makeBudgetItem({ plannedAmount: "5000", quarter: "Q1", fiscalYear: 2026 }),
      makeBudgetItem({ plannedAmount: "3000", quarter: "Q2", fiscalYear: 2026 }),
      makeBudgetItem({ plannedAmount: "7000", quarter: "Q1", fiscalYear: 2027 }),
    ];

    const result = calculateQuarterlyRollup(items, "Q1", 2026);
    expect(result.plannedTotal).toBe(5000);
  });

  it("should handle null actual amounts as zero", () => {
    const items: BudgetItemRecord[] = [
      makeBudgetItem({ plannedAmount: "5000", actualAmount: null, quarter: "Q1", fiscalYear: 2026 }),
    ];

    const result = calculateQuarterlyRollup(items, "Q1", 2026);
    expect(result.actualTotal).toBe(0);
    expect(result.variance).toBe(-5000);
  });

  it("should calculate variance percentage correctly", () => {
    const items: BudgetItemRecord[] = [
      makeBudgetItem({ plannedAmount: "10000", actualAmount: "12000", quarter: "Q1", fiscalYear: 2026 }),
    ];

    const result = calculateQuarterlyRollup(items, "Q1", 2026);
    expect(result.variancePct).toBe(20); // (12000-10000)/10000 = 20%
  });
});

// ── Annual Rollup ───────────────────────────────────────────────────

describe("Annual Rollup", () => {
  it("should aggregate all 4 quarters", () => {
    const items: BudgetItemRecord[] = [
      makeBudgetItem({ plannedAmount: "1000", actualAmount: "1000", quarter: "Q1", fiscalYear: 2026 }),
      makeBudgetItem({ plannedAmount: "2000", actualAmount: "2000", quarter: "Q2", fiscalYear: 2026 }),
      makeBudgetItem({ plannedAmount: "3000", actualAmount: "3000", quarter: "Q3", fiscalYear: 2026 }),
      makeBudgetItem({ plannedAmount: "4000", actualAmount: "4000", quarter: "Q4", fiscalYear: 2026 }),
    ];

    const result = calculateAnnualRollup(items, 2026);

    expect(result.plannedTotal).toBe(10000);
    expect(result.actualTotal).toBe(10000);
    expect(result.quarters).toHaveLength(4);
    expect(result.quarters[0].quarter).toBe("Q1");
    expect(result.quarters[3].quarter).toBe("Q4");
  });

  it("should handle mixed CapEx/OpEx across quarters", () => {
    const items: BudgetItemRecord[] = [
      makeBudgetItem({ expenseType: "capex", plannedAmount: "10000", quarter: "Q1", fiscalYear: 2026 }),
      makeBudgetItem({ expenseType: "opex", plannedAmount: "5000", quarter: "Q1", fiscalYear: 2026 }),
      makeBudgetItem({ expenseType: "capex", plannedAmount: "8000", quarter: "Q3", fiscalYear: 2026 }),
      makeBudgetItem({ expenseType: "opex", plannedAmount: "5000", quarter: "Q3", fiscalYear: 2026 }),
    ];

    const result = calculateAnnualRollup(items, 2026);

    expect(result.plannedCapex).toBe(18000);
    expect(result.plannedOpex).toBe(10000);
    expect(result.plannedTotal).toBe(28000);
  });
});

// ── Full Budget Summary ─────────────────────────────────────────────

describe("Budget Summary", () => {
  it("should aggregate across multiple fiscal years", () => {
    const items: BudgetItemRecord[] = [
      makeBudgetItem({ plannedAmount: "10000", actualAmount: "10000", quarter: "Q1", fiscalYear: 2026 }),
      makeBudgetItem({ plannedAmount: "15000", actualAmount: "14000", quarter: "Q1", fiscalYear: 2027 }),
    ];

    const result = calculateBudgetRollup(items, "client-1", null);

    expect(result.annuals).toHaveLength(2);
    expect(result.grandTotalPlanned).toBe(25000);
    expect(result.grandTotalActual).toBe(24000);
    expect(result.grandTotalVariance).toBe(-1000);
  });

  it("should return empty summary for no items", () => {
    const result = calculateBudgetRollup([], "client-1", null);

    expect(result.annuals).toHaveLength(0);
    expect(result.grandTotalPlanned).toBe(0);
    expect(result.grandTotalActual).toBe(0);
  });
});
