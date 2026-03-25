/**
 * CVG-CAVALIER — Commission Engine Tests
 *
 * Unit tests for commission calculation logic.
 */
import { describe, it, expect } from "vitest";
import {
  calculateCommission,
  calculateDealCommissions,
  summarizeCommissions,
  type CommissionStructureInput,
  type CommissionCalculationInput,
} from "../server/services/commission/engine";

const STRUCTURES: CommissionStructureInput[] = [
  {
    id: "struct-1",
    productCode: "CVG-AEGIS",
    partnerTier: "registered",
    commissionPercent: "10",
    recurringPercent: "5",
    recurringMonths: "12" as any,
    bonusThreshold: null,
    bonusPercent: null,
  },
  {
    id: "struct-2",
    productCode: "CVG-AEGIS",
    partnerTier: "silver",
    commissionPercent: "15",
    recurringPercent: "7",
    recurringMonths: "12" as any,
    bonusThreshold: "100000",
    bonusPercent: "2",
  },
  {
    id: "struct-3",
    productCode: "CVG-AEGIS",
    partnerTier: "gold",
    commissionPercent: "20",
    recurringPercent: "10",
    recurringMonths: "12" as any,
    bonusThreshold: "50000",
    bonusPercent: "3",
  },
  {
    id: "struct-4",
    productCode: "CVG-MIDAS",
    partnerTier: "gold",
    commissionPercent: "18",
    recurringPercent: null,
    recurringMonths: null,
    bonusThreshold: null,
    bonusPercent: null,
  },
];

describe("Commission Engine", () => {
  describe("calculateCommission", () => {
    it("calculates basic commission for registered tier", () => {
      const input: CommissionCalculationInput = {
        dealId: "deal-1",
        partnerId: "partner-1",
        productCode: "CVG-AEGIS",
        dealValue: 10000,
        partnerTier: "registered",
      };

      const result = calculateCommission(input, STRUCTURES);

      expect(result.commissionPercent).toBe(10);
      expect(result.commissionAmount).toBe(1000);
      expect(result.totalCommission).toBe(1000);
      expect(result.bonusApplied).toBe(false);
      expect(result.structureId).toBe("struct-1");
    });

    it("calculates recurring commissions", () => {
      const input: CommissionCalculationInput = {
        dealId: "deal-1",
        partnerId: "partner-1",
        productCode: "CVG-AEGIS",
        dealValue: 10000,
        partnerTier: "registered",
      };

      const result = calculateCommission(input, STRUCTURES);

      expect(result.recurringCommissions).toHaveLength(12);
      expect(result.recurringCommissions[0].percent).toBe(5);
      expect(result.recurringCommissions[0].amount).toBe(500);
    });

    it("applies bonus when revenue exceeds threshold", () => {
      const input: CommissionCalculationInput = {
        dealId: "deal-2",
        partnerId: "partner-2",
        productCode: "CVG-AEGIS",
        dealValue: 20000,
        partnerTier: "gold",
        partnerTotalRevenue: 75000, // Above 50k threshold
      };

      const result = calculateCommission(input, STRUCTURES);

      expect(result.commissionPercent).toBe(20);
      expect(result.commissionAmount).toBe(4000);
      expect(result.bonusApplied).toBe(true);
      expect(result.bonusAmount).toBe(600); // 3% of 20000
      expect(result.totalCommission).toBe(4600);
    });

    it("does not apply bonus when below threshold", () => {
      const input: CommissionCalculationInput = {
        dealId: "deal-3",
        partnerId: "partner-3",
        productCode: "CVG-AEGIS",
        dealValue: 20000,
        partnerTier: "gold",
        partnerTotalRevenue: 30000, // Below 50k threshold
      };

      const result = calculateCommission(input, STRUCTURES);

      expect(result.bonusApplied).toBe(false);
      expect(result.bonusAmount).toBe(0);
      expect(result.totalCommission).toBe(4000);
    });

    it("returns zero commission for unmatched product/tier", () => {
      const input: CommissionCalculationInput = {
        dealId: "deal-4",
        partnerId: "partner-4",
        productCode: "CVG-UNKNOWN",
        dealValue: 10000,
        partnerTier: "registered",
      };

      const result = calculateCommission(input, STRUCTURES);

      expect(result.commissionPercent).toBe(0);
      expect(result.commissionAmount).toBe(0);
      expect(result.totalCommission).toBe(0);
      expect(result.structureId).toBeNull();
    });

    it("handles product without recurring commission", () => {
      const input: CommissionCalculationInput = {
        dealId: "deal-5",
        partnerId: "partner-5",
        productCode: "CVG-MIDAS",
        dealValue: 15000,
        partnerTier: "gold",
      };

      const result = calculateCommission(input, STRUCTURES);

      expect(result.commissionPercent).toBe(18);
      expect(result.commissionAmount).toBe(2700);
      expect(result.recurringCommissions).toHaveLength(0);
    });

    it("rounds currency values correctly", () => {
      const input: CommissionCalculationInput = {
        dealId: "deal-6",
        partnerId: "partner-6",
        productCode: "CVG-AEGIS",
        dealValue: 33.33,
        partnerTier: "registered",
      };

      const result = calculateCommission(input, STRUCTURES);

      // 33.33 * 0.10 = 3.333 → rounded to 3.33
      expect(result.commissionAmount).toBe(3.33);
    });
  });

  describe("calculateDealCommissions", () => {
    it("calculates commissions for multiple products", () => {
      const inputs: CommissionCalculationInput[] = [
        { dealId: "deal-1", partnerId: "p-1", productCode: "CVG-AEGIS", dealValue: 10000, partnerTier: "gold" },
        { dealId: "deal-1", partnerId: "p-1", productCode: "CVG-MIDAS", dealValue: 5000, partnerTier: "gold" },
      ];

      const results = calculateDealCommissions(inputs, STRUCTURES);

      expect(results).toHaveLength(2);
      expect(results[0].commissionAmount).toBe(2000);
      expect(results[1].commissionAmount).toBe(900);
    });
  });

  describe("summarizeCommissions", () => {
    it("summarizes totals across multiple results", () => {
      const inputs: CommissionCalculationInput[] = [
        { dealId: "deal-1", partnerId: "p-1", productCode: "CVG-AEGIS", dealValue: 10000, partnerTier: "gold" },
        { dealId: "deal-2", partnerId: "p-1", productCode: "CVG-MIDAS", dealValue: 5000, partnerTier: "gold" },
      ];

      const results = calculateDealCommissions(inputs, STRUCTURES);
      const summary = summarizeCommissions(results);

      expect(summary.totalDealValue).toBe(15000);
      expect(summary.totalOneTimeCommission).toBe(2900); // 2000 + 900
      expect(summary.dealCount).toBe(2);
      expect(summary.totalRecurringMonthly).toBe(1000); // Only AEGIS has recurring
    });

    it("handles empty results", () => {
      const summary = summarizeCommissions([]);

      expect(summary.totalDealValue).toBe(0);
      expect(summary.totalCommission).toBe(0);
      expect(summary.dealCount).toBe(0);
    });
  });
});
