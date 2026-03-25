/**
 * CVG-CAVALIER — Commission Calculation Engine
 *
 * Calculates commissions on deal close based on commission structures.
 * Handles one-time and recurring commissions, tier-based rates,
 * and bonus thresholds.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface CommissionStructureInput {
  id: string;
  productCode: string;
  partnerTier: string;
  commissionPercent: string;
  recurringPercent: string | null;
  recurringMonths: number | null;
  bonusThreshold: string | null;
  bonusPercent: string | null;
}

export interface CommissionCalculationInput {
  dealId: string;
  partnerId: string;
  productCode: string;
  dealValue: number;
  partnerTier: string;
  partnerTotalRevenue?: number;
}

export interface CommissionCalculationResult {
  dealId: string;
  partnerId: string;
  productCode: string;
  dealValue: number;
  commissionPercent: number;
  commissionAmount: number;
  bonusApplied: boolean;
  bonusAmount: number;
  totalCommission: number;
  recurringCommissions: RecurringCommission[];
  structureId: string | null;
}

export interface RecurringCommission {
  month: number;
  percent: number;
  amount: number;
}

// ─── Commission Engine ──────────────────────────────────────────────────

/**
 * Calculate commission for a single deal using the matching commission structure.
 * If no structure matches, returns zero commission.
 */
export function calculateCommission(
  input: CommissionCalculationInput,
  structures: CommissionStructureInput[],
): CommissionCalculationResult {
  // Find matching structure for product + tier
  const structure = structures.find(
    (s) => s.productCode === input.productCode && s.partnerTier === input.partnerTier,
  );

  if (!structure) {
    return {
      dealId: input.dealId,
      partnerId: input.partnerId,
      productCode: input.productCode,
      dealValue: input.dealValue,
      commissionPercent: 0,
      commissionAmount: 0,
      bonusApplied: false,
      bonusAmount: 0,
      totalCommission: 0,
      recurringCommissions: [],
      structureId: null,
    };
  }

  const commissionPercent = parseFloat(structure.commissionPercent);
  const baseCommission = roundCurrency(input.dealValue * (commissionPercent / 100));

  // Check bonus threshold
  let bonusApplied = false;
  let bonusAmount = 0;
  if (
    structure.bonusThreshold &&
    structure.bonusPercent &&
    input.partnerTotalRevenue !== undefined &&
    input.partnerTotalRevenue >= parseFloat(structure.bonusThreshold)
  ) {
    bonusApplied = true;
    bonusAmount = roundCurrency(input.dealValue * (parseFloat(structure.bonusPercent) / 100));
  }

  // Calculate recurring commissions
  const recurringCommissions: RecurringCommission[] = [];
  const recurringPercent = structure.recurringPercent ? parseFloat(structure.recurringPercent) : 0;
  const recurringMonths = structure.recurringMonths ?? 0;

  if (recurringPercent > 0 && recurringMonths > 0) {
    for (let month = 1; month <= recurringMonths; month++) {
      const amount = roundCurrency(input.dealValue * (recurringPercent / 100));
      recurringCommissions.push({ month, percent: recurringPercent, amount });
    }
  }

  const totalCommission = baseCommission + bonusAmount;

  return {
    dealId: input.dealId,
    partnerId: input.partnerId,
    productCode: input.productCode,
    dealValue: input.dealValue,
    commissionPercent,
    commissionAmount: baseCommission,
    bonusApplied,
    bonusAmount,
    totalCommission,
    recurringCommissions,
    structureId: structure.id,
  };
}

/**
 * Calculate commissions for multiple products in a single deal.
 */
export function calculateDealCommissions(
  inputs: CommissionCalculationInput[],
  structures: CommissionStructureInput[],
): CommissionCalculationResult[] {
  return inputs.map((input) => calculateCommission(input, structures));
}

/**
 * Summarize total commissions for a partner across multiple deals.
 */
export function summarizeCommissions(results: CommissionCalculationResult[]): {
  totalDealValue: number;
  totalOneTimeCommission: number;
  totalBonusCommission: number;
  totalRecurringMonthly: number;
  totalCommission: number;
  dealCount: number;
} {
  let totalDealValue = 0;
  let totalOneTimeCommission = 0;
  let totalBonusCommission = 0;
  let totalRecurringMonthly = 0;

  for (const result of results) {
    totalDealValue += result.dealValue;
    totalOneTimeCommission += result.commissionAmount;
    totalBonusCommission += result.bonusAmount;
    if (result.recurringCommissions.length > 0) {
      totalRecurringMonthly += result.recurringCommissions[0].amount;
    }
  }

  return {
    totalDealValue: roundCurrency(totalDealValue),
    totalOneTimeCommission: roundCurrency(totalOneTimeCommission),
    totalBonusCommission: roundCurrency(totalBonusCommission),
    totalRecurringMonthly: roundCurrency(totalRecurringMonthly),
    totalCommission: roundCurrency(totalOneTimeCommission + totalBonusCommission),
    dealCount: results.length,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
