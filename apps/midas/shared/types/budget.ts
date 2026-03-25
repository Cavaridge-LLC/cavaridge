/**
 * Budget Planning Types — CVG-MIDAS
 *
 * CapEx/OpEx projections per roadmap item.
 * Roll-up by quarter and year. Planned vs actual.
 */

import type { ExpenseType } from "./roadmap";

// ── Budget Line Item ────────────────────────────────────────────────

export interface BudgetItem {
  id: string;
  tenantId: string;
  clientId: string;
  projectId: string | null;
  roadmapId: string | null;
  title: string;
  description: string | null;
  expenseType: ExpenseType;
  category: string;
  plannedAmount: number;
  actualAmount: number | null;
  quarter: string;
  fiscalYear: number;
  isRecurring: boolean;
  recurringInterval: "monthly" | "quarterly" | "annually" | null;
  vendor: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Budget Roll-up ──────────────────────────────────────────────────

export interface QuarterlyRollup {
  quarter: string;
  fiscalYear: number;
  plannedCapex: number;
  actualCapex: number;
  plannedOpex: number;
  actualOpex: number;
  plannedTotal: number;
  actualTotal: number;
  variance: number;
  variancePct: number;
}

export interface AnnualRollup {
  fiscalYear: number;
  plannedCapex: number;
  actualCapex: number;
  plannedOpex: number;
  actualOpex: number;
  plannedTotal: number;
  actualTotal: number;
  variance: number;
  variancePct: number;
  quarters: QuarterlyRollup[];
}

export interface BudgetSummary {
  clientId: string;
  roadmapId: string | null;
  annuals: AnnualRollup[];
  grandTotalPlanned: number;
  grandTotalActual: number;
  grandTotalVariance: number;
}

// ── Budget Calculation Input ────────────────────────────────────────

export interface BudgetRollupInput {
  items: BudgetItem[];
  fiscalYear?: number;
}
