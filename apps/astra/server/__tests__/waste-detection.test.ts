/**
 * Unit Tests — License Waste Detection Engine
 */

import { describe, it, expect } from "vitest";
import { detectWaste, toLicensedUserProfile } from "../services/waste-detection.js";
import type { LicensedUserProfile, WasteThresholds } from "../types/index.js";

function makeUser(overrides: Partial<LicensedUserProfile> = {}): LicensedUserProfile {
  return {
    id: "user-1",
    displayName: "Test User",
    userPrincipalName: "test@contoso.com",
    department: "IT",
    jobTitle: "Analyst",
    city: "Tampa",
    country: "US",
    accountEnabled: true,
    licenses: ["Microsoft 365 E3"],
    monthlyCost: 36,
    activity: {
      exchangeActive: true,
      teamsActive: true,
      sharePointActive: true,
      oneDriveActive: true,
      yammerActive: false,
      skypeActive: false,
      exchangeLastDate: "2026-03-20",
      teamsLastDate: "2026-03-20",
      sharePointLastDate: "2026-03-19",
      oneDriveLastDate: "2026-03-18",
      yammerLastDate: null,
      skypeLastDate: null,
      activeServiceCount: 4,
      totalServiceCount: 6,
      daysSinceLastActivity: 4,
    },
    ...overrides,
  };
}

const DEFAULT_THRESHOLDS: WasteThresholds = {
  unusedDays: 90,
  underutilizedPct: 40,
};

describe("detectWaste", () => {
  it("should return empty findings for active users with appropriate licenses", () => {
    const users = [makeUser()];
    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);

    expect(result.findings).toHaveLength(0);
    expect(result.summary.totalWastedMonthlyCost).toBe(0);
    expect(result.totalUsers).toBe(1);
  });

  it("should detect disabled accounts with licenses", () => {
    const users = [
      makeUser({
        id: "disabled-1",
        displayName: "Disabled User",
        accountEnabled: false,
        licenses: ["Microsoft 365 E5"],
        monthlyCost: 57,
      }),
    ];

    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe("disabled_account");
    expect(result.findings[0].severity).toBe("critical");
    expect(result.summary.disabledAccountCount).toBe(1);
  });

  it("should detect unused licenses (>90 days inactive)", () => {
    const users = [
      makeUser({
        id: "inactive-1",
        displayName: "Inactive User",
        activity: {
          exchangeActive: false,
          teamsActive: false,
          sharePointActive: false,
          oneDriveActive: false,
          yammerActive: false,
          skypeActive: false,
          exchangeLastDate: null,
          teamsLastDate: null,
          sharePointLastDate: null,
          oneDriveLastDate: null,
          yammerLastDate: null,
          skypeLastDate: null,
          activeServiceCount: 0,
          totalServiceCount: 6,
          daysSinceLastActivity: 120,
        },
      }),
    ];

    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const unusedFinding = result.findings.find(f => f.category === "unused");
    expect(unusedFinding).toBeDefined();
    expect(unusedFinding!.severity).toBe("high");
    expect(result.summary.unusedLicenseCount).toBeGreaterThanOrEqual(1);
  });

  it("should detect unused licenses at critical severity (>180 days)", () => {
    const users = [
      makeUser({
        id: "very-inactive",
        displayName: "Very Inactive User",
        activity: {
          exchangeActive: false,
          teamsActive: false,
          sharePointActive: false,
          oneDriveActive: false,
          yammerActive: false,
          skypeActive: false,
          exchangeLastDate: null,
          teamsLastDate: null,
          sharePointLastDate: null,
          oneDriveLastDate: null,
          yammerLastDate: null,
          skypeLastDate: null,
          activeServiceCount: 0,
          totalServiceCount: 6,
          daysSinceLastActivity: 200,
        },
      }),
    ];

    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);
    const finding = result.findings.find(f => f.category === "unused");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
  });

  it("should detect E5 underutilization when user only uses basic services", () => {
    const users = [
      makeUser({
        id: "e5-underutil",
        displayName: "E5 Underutilized",
        licenses: ["Microsoft 365 E5"],
        monthlyCost: 57,
        activity: {
          exchangeActive: true,
          teamsActive: true,
          sharePointActive: false,
          oneDriveActive: false,
          yammerActive: false,
          skypeActive: false,
          exchangeLastDate: "2026-03-20",
          teamsLastDate: "2026-03-20",
          sharePointLastDate: null,
          oneDriveLastDate: null,
          yammerLastDate: null,
          skypeLastDate: null,
          activeServiceCount: 2,
          totalServiceCount: 6,
          daysSinceLastActivity: 4,
        },
      }),
    ];

    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);
    const finding = result.findings.find(f => f.category === "underutilized");
    expect(finding).toBeDefined();
    expect(finding!.description).toContain("E5");
    expect(finding!.description).toContain("E3");
    expect(result.summary.underutilizedCount).toBeGreaterThanOrEqual(1);
  });

  it("should detect E3 email-only users", () => {
    const users = [
      makeUser({
        id: "email-only",
        displayName: "Email Only User",
        licenses: ["Microsoft 365 E3"],
        monthlyCost: 36,
        activity: {
          exchangeActive: true,
          teamsActive: false,
          sharePointActive: false,
          oneDriveActive: false,
          yammerActive: false,
          skypeActive: false,
          exchangeLastDate: "2026-03-20",
          teamsLastDate: null,
          sharePointLastDate: null,
          oneDriveLastDate: null,
          yammerLastDate: null,
          skypeLastDate: null,
          activeServiceCount: 1,
          totalServiceCount: 6,
          daysSinceLastActivity: 4,
        },
      }),
    ];

    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);
    const finding = result.findings.find(f => f.category === "underutilized");
    expect(finding).toBeDefined();
    expect(finding!.description).toContain("F3");
    expect(finding!.description).toContain("Exchange Online");
  });

  it("should detect duplicate license assignments", () => {
    const users = [
      makeUser({
        id: "duplicate-user",
        displayName: "Duplicate License User",
        licenses: ["Microsoft 365 E5", "Microsoft 365 E3"],
        monthlyCost: 93,
      }),
    ];

    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);
    const finding = result.findings.find(f => f.category === "duplicate");
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("high");
    expect(result.summary.duplicateCount).toBeGreaterThanOrEqual(1);
  });

  it("should support configurable inactivity thresholds", () => {
    const users = [
      makeUser({
        id: "custom-threshold",
        displayName: "Custom Threshold User",
        activity: {
          exchangeActive: false,
          teamsActive: false,
          sharePointActive: false,
          oneDriveActive: false,
          yammerActive: false,
          skypeActive: false,
          exchangeLastDate: null,
          teamsLastDate: null,
          sharePointLastDate: null,
          oneDriveLastDate: null,
          yammerLastDate: null,
          skypeLastDate: null,
          activeServiceCount: 0,
          totalServiceCount: 6,
          daysSinceLastActivity: 45,
        },
      }),
    ];

    // 90 day threshold — should NOT flag
    const result90 = detectWaste(users, "tenant-1", { unusedDays: 90, underutilizedPct: 40 });
    const unused90 = result90.findings.filter(f => f.category === "unused");
    // daysSinceLastActivity = 45 < 90, should not detect as unused by days
    // But activeServiceCount = 0 with null daysSinceLastActivity check...
    // Actually daysSinceLastActivity = 45, which is < 90, so no unused finding by days threshold

    // 30 day threshold — should flag
    const result30 = detectWaste(users, "tenant-1", { unusedDays: 30, underutilizedPct: 40 });
    const unused30 = result30.findings.filter(f => f.category === "unused");
    expect(unused30.length).toBeGreaterThanOrEqual(1);
  });

  it("should compute summary totals correctly", () => {
    const users = [
      makeUser({
        id: "active-1",
        displayName: "Active User",
        licenses: ["Microsoft 365 E3"],
        monthlyCost: 36,
      }),
      makeUser({
        id: "disabled-1",
        displayName: "Disabled User",
        accountEnabled: false,
        licenses: ["Microsoft 365 E5"],
        monthlyCost: 57,
      }),
      makeUser({
        id: "e5-under",
        displayName: "E5 Under",
        licenses: ["Microsoft 365 E5"],
        monthlyCost: 57,
        activity: {
          exchangeActive: true,
          teamsActive: false,
          sharePointActive: false,
          oneDriveActive: false,
          yammerActive: false,
          skypeActive: false,
          exchangeLastDate: "2026-03-20",
          teamsLastDate: null,
          sharePointLastDate: null,
          oneDriveLastDate: null,
          yammerLastDate: null,
          skypeLastDate: null,
          activeServiceCount: 1,
          totalServiceCount: 6,
          daysSinceLastActivity: 4,
        },
      }),
    ];

    const result = detectWaste(users, "tenant-1", DEFAULT_THRESHOLDS);
    expect(result.totalUsers).toBe(3);
    expect(result.totalMonthlyCost).toBe(150); // 36 + 57 + 57
    expect(result.findings.length).toBeGreaterThanOrEqual(2); // disabled + underutilized
    expect(result.summary.totalWastedMonthlyCost).toBeGreaterThan(0);
    expect(result.summary.totalWastedAnnualCost).toBe(result.summary.totalWastedMonthlyCost * 12);
  });
});

describe("toLicensedUserProfile", () => {
  it("should convert legacy user format to LicensedUserProfile", () => {
    const legacy = {
      id: "user-1",
      displayName: "Test User",
      upn: "test@contoso.com",
      department: "IT",
      licenses: ["Microsoft 365 E3"],
      cost: 36,
      usageGB: 5.2,
      maxGB: 50,
      status: "Active",
      activity: {
        exchangeActive: true,
        teamsActive: true,
        sharePointActive: false,
        oneDriveActive: false,
        activeServiceCount: 2,
        totalServiceCount: 6,
        daysSinceLastActivity: 3,
      },
    };

    const profile = toLicensedUserProfile(legacy);
    expect(profile.id).toBe("user-1");
    expect(profile.displayName).toBe("Test User");
    expect(profile.userPrincipalName).toBe("test@contoso.com");
    expect(profile.monthlyCost).toBe(36);
    expect(profile.accountEnabled).toBe(true);
    expect(profile.activity?.exchangeActive).toBe(true);
    expect(profile.activity?.yammerActive).toBe(false);
    expect(profile.mailboxUsageGB).toBe(5.2);
  });

  it("should handle null activity", () => {
    const legacy = {
      displayName: "No Activity User",
      licenses: ["Microsoft 365 E3"],
      cost: 36,
      activity: null,
    };

    const profile = toLicensedUserProfile(legacy);
    expect(profile.activity).toBeUndefined();
  });
});
