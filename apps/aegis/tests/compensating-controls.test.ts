/**
 * CVG-AEGIS — Compensating Controls Engine Tests
 */
import { describe, it, expect } from "vitest";
import {
  evaluateCompensatingControls,
  calculateCompensatingBonus,
  getActiveSuppressions,
  getControlsCatalog,
  CONTROLS_CATALOG,
} from "../server/services/compensating-controls";

describe("evaluateCompensatingControls", () => {
  it("returns all catalog controls with detected status", () => {
    const result = evaluateCompensatingControls([], []);
    expect(result.length).toBe(CONTROLS_CATALOG.length);
    expect(result.every(c => !c.isDetected)).toBe(true);
  });

  it("marks auto-detected controls", () => {
    const autoDetected = [
      { controlType: "duo_mfa", metadata: { source: "service_principals" } },
    ];

    const result = evaluateCompensatingControls(autoDetected, []);
    const duo = result.find(c => c.controlType === "duo_mfa");

    expect(duo).toBeDefined();
    expect(duo!.isDetected).toBe(true);
    expect(duo!.detectionMethod).toBe("auto");
    expect(duo!.bonusPoints).toBe(2.0);
  });

  it("manual override takes precedence over auto-detection", () => {
    const autoDetected = [
      { controlType: "duo_mfa" },
    ];
    const manualOverrides = [
      { controlType: "duo_mfa", enabled: false },
    ];

    const result = evaluateCompensatingControls(autoDetected, manualOverrides);
    const duo = result.find(c => c.controlType === "duo_mfa");

    expect(duo!.isDetected).toBe(false);
    expect(duo!.detectionMethod).toBe("manual");
    expect(duo!.bonusPoints).toBe(0);
  });

  it("manual override can set custom bonus points", () => {
    const manualOverrides = [
      { controlType: "sentinelone_edr", enabled: true, bonusPoints: 3.0 },
    ];

    const result = evaluateCompensatingControls([], manualOverrides);
    const s1 = result.find(c => c.controlType === "sentinelone_edr");

    expect(s1!.isDetected).toBe(true);
    expect(s1!.bonusPoints).toBe(3.0);
  });

  it("includes flag suppressions for detected controls", () => {
    const autoDetected = [
      { controlType: "duo_mfa" },
    ];

    const result = evaluateCompensatingControls(autoDetected, []);
    const duo = result.find(c => c.controlType === "duo_mfa");

    expect(duo!.flagSuppressions.length).toBeGreaterThan(0);
    expect(duo!.flagSuppressions.some(s => s.flagType === "password_never_expires")).toBe(true);
  });

  it("clears flag suppressions for disabled controls", () => {
    const manualOverrides = [
      { controlType: "duo_mfa", enabled: false },
    ];

    const result = evaluateCompensatingControls([], manualOverrides);
    const duo = result.find(c => c.controlType === "duo_mfa");

    expect(duo!.flagSuppressions.length).toBe(0);
  });
});

describe("calculateCompensatingBonus", () => {
  it("sums bonus points from detected controls", () => {
    const controls = evaluateCompensatingControls(
      [{ controlType: "duo_mfa" }, { controlType: "sentinelone_edr" }],
      [],
    );

    const bonus = calculateCompensatingBonus(controls);
    expect(bonus).toBe(3.5); // 2.0 + 1.5
  });

  it("caps bonus at maxBonus", () => {
    const controls = evaluateCompensatingControls(
      [
        { controlType: "duo_mfa" },
        { controlType: "sentinelone_edr" },
        { controlType: "proofpoint_email" },
        { controlType: "conditional_access" },
        { controlType: "datto_backup" },
      ],
      [],
    );

    const bonus = calculateCompensatingBonus(controls, 5);
    expect(bonus).toBeLessThanOrEqual(5);
  });

  it("returns 0 when no controls detected", () => {
    const controls = evaluateCompensatingControls([], []);
    const bonus = calculateCompensatingBonus(controls);
    expect(bonus).toBe(0);
  });
});

describe("getActiveSuppressions", () => {
  it("returns suppressions from all active controls", () => {
    const controls = evaluateCompensatingControls(
      [{ controlType: "duo_mfa" }, { controlType: "entra_id_mfa" }],
      [],
    );

    const suppressions = getActiveSuppressions(controls);
    expect(suppressions.length).toBeGreaterThan(0);

    const passwordSuppressions = suppressions.filter(s => s.flagType === "password_never_expires");
    expect(passwordSuppressions.length).toBe(2); // Both Duo and Entra suppress this
  });

  it("returns empty for no active controls", () => {
    const controls = evaluateCompensatingControls([], []);
    const suppressions = getActiveSuppressions(controls);
    expect(suppressions.length).toBe(0);
  });
});

describe("getControlsCatalog", () => {
  it("returns the full catalog", () => {
    const catalog = getControlsCatalog();
    expect(catalog.length).toBe(CONTROLS_CATALOG.length);
    expect(catalog.every(c => c.controlType && c.name && c.vendor)).toBe(true);
  });
});
