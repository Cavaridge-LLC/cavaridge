/**
 * CVG-AEGIS — IAR Engine Tests
 */
import { describe, it, expect } from "vitest";
import {
  computeBaseFlags,
  applyCompensatingControlAdjustments,
  applyBusinessContextModifiers,
  generateExecutiveSummary,
  runIarAnalysis,
  IAR_FLAG_TYPES,
  type M365UserRecord,
  type IarRiskFlag,
  type TenantBusinessContext,
} from "../server/services/iar-engine";
import { evaluateCompensatingControls } from "../server/services/compensating-controls";

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<M365UserRecord> = {}): M365UserRecord => ({
  userPrincipalName: "user@example.com",
  displayName: "Test User",
  accountEnabled: true,
  assignedLicenses: ["Microsoft 365 Business Premium"],
  lastSignInDateTime: new Date().toISOString(),
  createdDateTime: new Date().toISOString(),
  userType: "Member",
  ...overrides,
});

// ---------------------------------------------------------------------------
// computeBaseFlags
// ---------------------------------------------------------------------------

describe("computeBaseFlags", () => {
  it("returns empty for healthy user", () => {
    const flags = computeBaseFlags([makeUser()]);
    expect(flags.length).toBe(0);
  });

  it("flags blocked but licensed user as high severity", () => {
    const user = makeUser({ accountEnabled: false });
    const flags = computeBaseFlags([user]);

    const match = flags.find(f => f.flagType === IAR_FLAG_TYPES.BLOCKED_BUT_LICENSED);
    expect(match).toBeDefined();
    expect(match!.baseSeverity).toBe("high");
  });

  it("flags external user with license as high severity", () => {
    const user = makeUser({ userType: "Guest" });
    const flags = computeBaseFlags([user]);

    const match = flags.find(f => f.flagType === IAR_FLAG_TYPES.EXTERNAL_WITH_LICENSE);
    expect(match).toBeDefined();
    expect(match!.baseSeverity).toBe("high");
  });

  it("flags inactive >180d licensed user as high severity", () => {
    const user = makeUser({
      daysSinceActivity: 200,
      lastSignInDateTime: new Date(Date.now() - 200 * 86400000).toISOString(),
    });
    const flags = computeBaseFlags([user]);

    const match = flags.find(f => f.flagType === IAR_FLAG_TYPES.INACTIVE_LICENSED_180D);
    expect(match).toBeDefined();
    expect(match!.baseSeverity).toBe("high");
  });

  it("flags no MFA registered as high severity", () => {
    const user = makeUser({ mfaRegistered: false });
    const flags = computeBaseFlags([user]);

    const match = flags.find(f => f.flagType === IAR_FLAG_TYPES.NO_MFA_REGISTERED);
    expect(match).toBeDefined();
    expect(match!.baseSeverity).toBe("high");
  });

  it("flags inactive >90d licensed user as medium severity", () => {
    const user = makeUser({
      daysSinceActivity: 120,
      lastSignInDateTime: new Date(Date.now() - 120 * 86400000).toISOString(),
    });
    const flags = computeBaseFlags([user]);

    const match = flags.find(f => f.flagType === IAR_FLAG_TYPES.INACTIVE_LICENSED_90D);
    expect(match).toBeDefined();
    expect(match!.baseSeverity).toBe("medium");
  });

  it("flags licensed user with no activity data as medium", () => {
    const user = makeUser({ lastSignInDateTime: null });
    const flags = computeBaseFlags([user]);

    // Should get INACTIVE_LICENSED_180D (since daysSinceActivity defaults to 999) and LICENSED_NO_ACTIVITY
    const noActivityFlag = flags.find(f => f.flagType === IAR_FLAG_TYPES.LICENSED_NO_ACTIVITY);
    expect(noActivityFlag).toBeDefined();
    expect(noActivityFlag!.baseSeverity).toBe("medium");
  });

  it("suppresses no-activity flag for service accounts", () => {
    const user = makeUser({ lastSignInDateTime: null, accountType: "service" });
    const flags = computeBaseFlags([user]);

    const noActivityFlag = flags.find(f => f.flagType === IAR_FLAG_TYPES.LICENSED_NO_ACTIVITY);
    expect(noActivityFlag).toBeUndefined();
  });

  it("flags password never expires as medium severity", () => {
    const user = makeUser({ passwordNeverExpires: true });
    const flags = computeBaseFlags([user]);

    const match = flags.find(f => f.flagType === IAR_FLAG_TYPES.PASSWORD_NEVER_EXPIRES);
    expect(match).toBeDefined();
    expect(match!.baseSeverity).toBe("medium");
  });

  it("flags stale external guest as low severity", () => {
    const user = makeUser({
      userType: "Guest",
      assignedLicenses: [],
      daysSinceActivity: 120,
    });
    const flags = computeBaseFlags([user]);

    const match = flags.find(f => f.flagType === IAR_FLAG_TYPES.STALE_EXTERNAL_GUEST);
    expect(match).toBeDefined();
    expect(match!.baseSeverity).toBe("low");
  });

  it("handles multiple flags for a single user", () => {
    const user = makeUser({
      accountEnabled: false,
      passwordNeverExpires: true,
    });
    const flags = computeBaseFlags([user]);

    // Blocked but licensed (high) — password never expires should NOT fire because account is blocked
    const blockedFlag = flags.find(f => f.flagType === IAR_FLAG_TYPES.BLOCKED_BUT_LICENSED);
    expect(blockedFlag).toBeDefined();
  });

  it("processes multiple users", () => {
    const users = [
      makeUser({ userPrincipalName: "healthy@example.com" }),
      makeUser({ userPrincipalName: "blocked@example.com", accountEnabled: false }),
      makeUser({ userPrincipalName: "guest@example.com", userType: "Guest" }),
    ];
    const flags = computeBaseFlags(users);
    expect(flags.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// applyCompensatingControlAdjustments
// ---------------------------------------------------------------------------

describe("applyCompensatingControlAdjustments", () => {
  it("suppresses password_never_expires when Duo MFA is detected", () => {
    const flags: IarRiskFlag[] = [{
      flagType: IAR_FLAG_TYPES.PASSWORD_NEVER_EXPIRES,
      userPrincipalName: "user@example.com",
      displayName: "Test User",
      baseSeverity: "medium",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "Password never expires",
      metadata: {},
    }];

    const controls = evaluateCompensatingControls(
      [{ controlType: "duo_mfa" }],
      [],
    );

    const adjusted = applyCompensatingControlAdjustments(flags, controls);
    expect(adjusted[0].isSuppressed).toBe(true);
    expect(adjusted[0].suppressionReason).toContain("MFA");
  });

  it("downgrades inactive_licensed_90d when MFA is enforced", () => {
    const flags: IarRiskFlag[] = [{
      flagType: IAR_FLAG_TYPES.INACTIVE_LICENSED_90D,
      userPrincipalName: "user@example.com",
      displayName: "Test User",
      baseSeverity: "medium",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "Inactive 120 days",
      metadata: {},
    }];

    const controls = evaluateCompensatingControls(
      [{ controlType: "duo_mfa" }],
      [],
    );

    const adjusted = applyCompensatingControlAdjustments(flags, controls);
    expect(adjusted[0].adjustedSeverity).toBe("low");
    expect(adjusted[0].isSuppressed).toBe(false);
  });

  it("does not modify flags without matching suppressions", () => {
    const flags: IarRiskFlag[] = [{
      flagType: IAR_FLAG_TYPES.BLOCKED_BUT_LICENSED,
      userPrincipalName: "user@example.com",
      displayName: "Test User",
      baseSeverity: "high",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "Blocked but licensed",
      metadata: {},
    }];

    const controls = evaluateCompensatingControls(
      [{ controlType: "duo_mfa" }],
      [],
    );

    const adjusted = applyCompensatingControlAdjustments(flags, controls);
    expect(adjusted[0].isSuppressed).toBe(false);
    expect(adjusted[0].adjustedSeverity).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyBusinessContextModifiers
// ---------------------------------------------------------------------------

describe("applyBusinessContextModifiers", () => {
  const defaultContext: TenantBusinessContext = {
    industryVertical: "technology",
    isMAActive: false,
    isMultiSite: false,
    isContractorHeavy: false,
    vendorDensity: "normal",
    employeeCount: 50,
  };

  it("downgrades external_with_license for contractor-heavy tenants", () => {
    const flags: IarRiskFlag[] = [{
      flagType: IAR_FLAG_TYPES.EXTERNAL_WITH_LICENSE,
      userPrincipalName: "contractor@vendor.com",
      displayName: "Contractor",
      baseSeverity: "high",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "External with license",
      metadata: {},
    }];

    const context = { ...defaultContext, isContractorHeavy: true };
    const adjusted = applyBusinessContextModifiers(flags, context);

    expect(adjusted[0].adjustedSeverity).toBe("low");
    expect(adjusted[0].adjustmentReason).toContain("contractor");
  });

  it("downgrades stale_external_guest for M&A-active tenants", () => {
    const flags: IarRiskFlag[] = [{
      flagType: IAR_FLAG_TYPES.STALE_EXTERNAL_GUEST,
      userPrincipalName: "vendor@partner.com",
      displayName: "Vendor",
      baseSeverity: "low",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "Stale guest",
      metadata: {},
    }];

    const context = { ...defaultContext, isMAActive: true };
    const adjusted = applyBusinessContextModifiers(flags, context);

    expect(adjusted[0].adjustedSeverity).toBe("info");
    expect(adjusted[0].adjustmentReason).toContain("M&A");
  });

  it("downgrades stale_external_guest for high vendor density", () => {
    const flags: IarRiskFlag[] = [{
      flagType: IAR_FLAG_TYPES.STALE_EXTERNAL_GUEST,
      userPrincipalName: "vendor@partner.com",
      displayName: "Vendor",
      baseSeverity: "low",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "Stale guest",
      metadata: {},
    }];

    const context = { ...defaultContext, vendorDensity: "high" as const };
    const adjusted = applyBusinessContextModifiers(flags, context);

    expect(adjusted[0].adjustedSeverity).toBe("info");
  });

  it("skips already-suppressed flags", () => {
    const flags: IarRiskFlag[] = [{
      flagType: IAR_FLAG_TYPES.EXTERNAL_WITH_LICENSE,
      userPrincipalName: "user@example.com",
      displayName: "User",
      baseSeverity: "high",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: true,
      suppressionReason: "Already suppressed",
      detail: "External",
      metadata: {},
    }];

    const context = { ...defaultContext, isContractorHeavy: true };
    const adjusted = applyBusinessContextModifiers(flags, context);

    // Should remain suppressed, not downgraded
    expect(adjusted[0].isSuppressed).toBe(true);
    expect(adjusted[0].adjustedSeverity).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// generateExecutiveSummary
// ---------------------------------------------------------------------------

describe("generateExecutiveSummary", () => {
  it("generates positive framing for strong posture", () => {
    const flags: IarRiskFlag[] = [];
    const summary = generateExecutiveSummary(flags, 50, "full");
    expect(summary).toContain("strong security posture");
  });

  it("generates priority framing for weak posture", () => {
    const highFlags: IarRiskFlag[] = Array(5).fill(null).map((_, i) => ({
      flagType: "test",
      userPrincipalName: `user${i}@example.com`,
      displayName: `User ${i}`,
      baseSeverity: "high" as const,
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "Test",
      metadata: {},
    }));

    const summary = generateExecutiveSummary(highFlags, 50, "full");
    expect(summary).toContain("high-priority");
    // CRITICAL: never mentions negligence
    expect(summary.toLowerCase()).not.toContain("negligent");
    expect(summary.toLowerCase()).not.toContain("negligence");
  });

  it("includes freemium disclaimer for freemium tier", () => {
    const summary = generateExecutiveSummary([], 10, "freemium");
    expect(summary).toContain("base severity levels only");
    expect(summary).toContain("Upgrade");
  });

  it("mentions compensating controls offset for full tier", () => {
    const flags: IarRiskFlag[] = [
      {
        flagType: "test",
        userPrincipalName: "user@example.com",
        displayName: "User",
        baseSeverity: "medium",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: true,
        suppressionReason: "MFA",
        detail: "Test",
        metadata: {},
      },
    ];

    const summary = generateExecutiveSummary(flags, 20, "full");
    expect(summary).toContain("compensating controls");
  });

  it("never frames findings as MSP negligence", () => {
    const manyFlags: IarRiskFlag[] = Array(10).fill(null).map((_, i) => ({
      flagType: "test",
      userPrincipalName: `user${i}@example.com`,
      displayName: `User ${i}`,
      baseSeverity: (i < 5 ? "high" : "medium") as "high" | "medium",
      adjustedSeverity: null,
      adjustmentReason: null,
      isSuppressed: false,
      suppressionReason: null,
      detail: "Test",
      metadata: {},
    }));

    const summary = generateExecutiveSummary(manyFlags, 100, "full");
    const lowerSummary = summary.toLowerCase();

    expect(lowerSummary).not.toContain("negligent");
    expect(lowerSummary).not.toContain("negligence");
    expect(lowerSummary).not.toContain("mismanag");
    expect(lowerSummary).not.toContain("failure");

    // Should frame as opportunities
    expect(summary).toContain("opportunities");
  });
});

// ---------------------------------------------------------------------------
// runIarAnalysis (integration)
// ---------------------------------------------------------------------------

describe("runIarAnalysis", () => {
  it("runs freemium analysis with base flags only", () => {
    const users = [
      makeUser({ accountEnabled: false }), // blocked_but_licensed
      makeUser({ userPrincipalName: "guest@vendor.com", userType: "Guest" }), // external_with_license
      makeUser({ userPrincipalName: "healthy@example.com" }), // no flags
    ];

    const result = runIarAnalysis(users, { tier: "freemium" });

    expect(result.userCount).toBe(3);
    expect(result.flagCount).toBeGreaterThanOrEqual(2);
    expect(result.highSeverityCount).toBeGreaterThanOrEqual(2);
    expect(result.executiveSummary).toBeTruthy();
    expect(result.executiveSummary).toContain("base severity");
  });

  it("runs full analysis with compensating controls and context", () => {
    const users = [
      makeUser({ passwordNeverExpires: true }), // should be suppressed by Duo
      makeUser({ userPrincipalName: "vendor@partner.com", userType: "Guest", assignedLicenses: [], daysSinceActivity: 120 }), // should be downgraded for M&A
    ];

    const controls = evaluateCompensatingControls(
      [{ controlType: "duo_mfa" }],
      [],
    );

    const result = runIarAnalysis(users, {
      tier: "full",
      activeControls: controls,
      businessContext: {
        industryVertical: "healthcare",
        isMAActive: true,
        isMultiSite: false,
        isContractorHeavy: false,
        vendorDensity: "normal",
        employeeCount: 200,
      },
    });

    // Password never expires should be suppressed
    const passwordFlag = result.flags.find(f => f.flagType === IAR_FLAG_TYPES.PASSWORD_NEVER_EXPIRES);
    if (passwordFlag) {
      expect(passwordFlag.isSuppressed).toBe(true);
    }

    // Stale guest should be downgraded for M&A active
    const guestFlag = result.flags.find(f => f.flagType === IAR_FLAG_TYPES.STALE_EXTERNAL_GUEST);
    if (guestFlag) {
      expect(guestFlag.adjustedSeverity).toBe("info");
    }

    expect(result.executiveSummary).not.toContain("base severity levels only");
  });
});
