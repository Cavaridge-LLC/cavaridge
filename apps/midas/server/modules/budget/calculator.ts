/**
 * Budget Calculator — deterministic rollup calculations.
 *
 * CapEx/OpEx projections per roadmap item.
 * Roll-up by quarter and year. Planned vs actual.
 */

import type { BudgetItemRecord } from "@shared/schema";
import type {
  QuarterlyRollup,
  AnnualRollup,
  BudgetSummary,
} from "@shared/types/budget";

/**
 * Calculate quarterly rollup from budget items.
 */
export function calculateQuarterlyRollup(
  items: BudgetItemRecord[],
  quarter: string,
  fiscalYear: number,
): QuarterlyRollup {
  const filtered = items.filter(
    (i) => i.quarter === quarter && i.fiscalYear === fiscalYear,
  );

  let plannedCapex = 0;
  let actualCapex = 0;
  let plannedOpex = 0;
  let actualOpex = 0;

  for (const item of filtered) {
    const planned = Number(item.plannedAmount) || 0;
    const actual = Number(item.actualAmount) || 0;

    if (item.expenseType === "capex") {
      plannedCapex += planned;
      actualCapex += actual;
    } else {
      plannedOpex += planned;
      actualOpex += actual;
    }
  }

  const plannedTotal = plannedCapex + plannedOpex;
  const actualTotal = actualCapex + actualOpex;
  const variance = actualTotal - plannedTotal;
  const variancePct = plannedTotal > 0
    ? Math.round((variance / plannedTotal) * 100)
    : 0;

  return {
    quarter,
    fiscalYear,
    plannedCapex,
    actualCapex,
    plannedOpex,
    actualOpex,
    plannedTotal,
    actualTotal,
    variance,
    variancePct,
  };
}

/**
 * Calculate annual rollup from budget items.
 */
export function calculateAnnualRollup(
  items: BudgetItemRecord[],
  fiscalYear: number,
): AnnualRollup {
  const yearItems = items.filter((i) => i.fiscalYear === fiscalYear);
  const quarters = ["Q1", "Q2", "Q3", "Q4"];

  const quarterlyRollups = quarters.map((q) =>
    calculateQuarterlyRollup(yearItems, q, fiscalYear),
  );

  let plannedCapex = 0;
  let actualCapex = 0;
  let plannedOpex = 0;
  let actualOpex = 0;

  for (const qr of quarterlyRollups) {
    plannedCapex += qr.plannedCapex;
    actualCapex += qr.actualCapex;
    plannedOpex += qr.plannedOpex;
    actualOpex += qr.actualOpex;
  }

  const plannedTotal = plannedCapex + plannedOpex;
  const actualTotal = actualCapex + actualOpex;
  const variance = actualTotal - plannedTotal;
  const variancePct = plannedTotal > 0
    ? Math.round((variance / plannedTotal) * 100)
    : 0;

  return {
    fiscalYear,
    plannedCapex,
    actualCapex,
    plannedOpex,
    actualOpex,
    plannedTotal,
    actualTotal,
    variance,
    variancePct,
    quarters: quarterlyRollups,
  };
}

/**
 * Calculate full budget summary across all years.
 */
export function calculateBudgetRollup(
  items: BudgetItemRecord[],
  clientId: string,
  roadmapId: string | null,
): BudgetSummary {
  const years = Array.from(new Set(items.map((i) => i.fiscalYear))).sort();
  const annuals = years.map((y) => calculateAnnualRollup(items, y));

  let grandTotalPlanned = 0;
  let grandTotalActual = 0;

  for (const annual of annuals) {
    grandTotalPlanned += annual.plannedTotal;
    grandTotalActual += annual.actualTotal;
  }

  return {
    clientId,
    roadmapId,
    annuals,
    grandTotalPlanned,
    grandTotalActual,
    grandTotalVariance: grandTotalActual - grandTotalPlanned,
  };
}
