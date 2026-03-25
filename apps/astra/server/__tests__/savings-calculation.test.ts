/**
 * Unit Tests — Savings Calculations
 */

import { describe, it, expect } from "vitest";
import { findLicenseInfo } from "../sku-map.js";

describe("findLicenseInfo", () => {
  it("should resolve standard SKU part numbers", () => {
    expect(findLicenseInfo("SPE_E5")).toEqual({ name: "Microsoft 365 E5", cost: 57 });
    expect(findLicenseInfo("SPE_E3")).toEqual({ name: "Microsoft 365 E3", cost: 36 });
    expect(findLicenseInfo("STANDARDPACK")).toEqual({ name: "Office 365 E1", cost: 10 });
  });

  it("should resolve case-insensitive display names", () => {
    expect(findLicenseInfo("Microsoft 365 E5")).toEqual({ name: "Microsoft 365 E5", cost: 57 });
    expect(findLicenseInfo("microsoft 365 e5")).toEqual({ name: "Microsoft 365 E5", cost: 57 });
  });

  it("should resolve business tier SKUs", () => {
    expect(findLicenseInfo("SPB")).toEqual({ name: "Microsoft 365 Business Premium", cost: 22 });
    expect(findLicenseInfo("O365_BUSINESS_ESSENTIALS")).toEqual({ name: "Microsoft 365 Business Basic", cost: 6 });
  });

  it("should resolve add-on SKUs", () => {
    expect(findLicenseInfo("ATP_ENTERPRISE")).toEqual({ name: "Defender for Office 365 P1", cost: 2 });
    expect(findLicenseInfo("MCOEV")).toEqual({ name: "Teams Phone System", cost: 8 });
    expect(findLicenseInfo("POWER_BI_PRO")).toEqual({ name: "Power BI Pro", cost: 10 });
  });

  it("should return zero cost for free licenses", () => {
    expect(findLicenseInfo("TEAMS_EXPLORATORY").cost).toBe(0);
    expect(findLicenseInfo("FLOW_FREE").cost).toBe(0);
    expect(findLicenseInfo("POWER_BI_STANDARD").cost).toBe(0);
  });

  it("should return zero cost for unknown SKUs", () => {
    const result = findLicenseInfo("COMPLETELY_UNKNOWN_SKU_12345");
    expect(result.cost).toBe(0);
    expect(result.name).toBe("COMPLETELY_UNKNOWN_SKU_12345");
  });

  it("should handle Copilot SKUs", () => {
    expect(findLicenseInfo("MICROSOFT_365_COPILOT")).toEqual({ name: "Microsoft 365 Copilot", cost: 30 });
  });
});

describe("savings calculations", () => {
  it("should calculate E5 to E3 downgrade savings correctly", () => {
    const e5 = findLicenseInfo("SPE_E5");
    const e3 = findLicenseInfo("SPE_E3");
    const monthlySavings = e5.cost - e3.cost;
    expect(monthlySavings).toBe(21); // $57 - $36
    expect(monthlySavings * 12).toBe(252); // Annual
  });

  it("should calculate E3 to F3+Exchange downgrade savings", () => {
    const e3 = findLicenseInfo("SPE_E3");
    const f3 = findLicenseInfo("M365_F3");
    const exchangeP1 = findLicenseInfo("EXCHANGESTANDARD");
    const newCost = f3.cost + exchangeP1.cost;
    const monthlySavings = e3.cost - newCost;
    expect(newCost).toBe(12); // $8 + $4
    expect(monthlySavings).toBe(24); // $36 - $12
  });

  it("should calculate Business Premium to Standard downgrade savings", () => {
    const premium = findLicenseInfo("SPB");
    const standard = findLicenseInfo("O365_BUSINESS_PREMIUM");
    const monthlySavings = premium.cost - standard.cost;
    expect(monthlySavings).toBe(9.5); // $22 - $12.50
  });

  it("should calculate portfolio-level savings for multiple users", () => {
    const users = [
      { sku: "SPE_E5", count: 5 },   // 5 * $57 = $285
      { sku: "SPE_E3", count: 20 },   // 20 * $36 = $720
      { sku: "SPB", count: 10 },       // 10 * $22 = $220
    ];

    const currentMonthly = users.reduce((sum, u) => {
      return sum + findLicenseInfo(u.sku).cost * u.count;
    }, 0);

    expect(currentMonthly).toBe(1225); // $285 + $720 + $220

    // If we downgrade 3 E5 users to E3: saves $21 * 3 = $63/mo
    const savingsFromE5Downgrade = 21 * 3;
    expect(savingsFromE5Downgrade).toBe(63);
    expect(savingsFromE5Downgrade * 12).toBe(756); // Annual
  });

  it("should handle license removal savings (disabled accounts)", () => {
    const e5Cost = findLicenseInfo("SPE_E5").cost;
    const e3Cost = findLicenseInfo("SPE_E3").cost;

    // 2 disabled E5 + 1 disabled E3 = full cost recovered
    const monthlySavings = (e5Cost * 2) + (e3Cost * 1);
    expect(monthlySavings).toBe(150); // $114 + $36
    expect(monthlySavings * 12).toBe(1800); // Annual
  });
});
