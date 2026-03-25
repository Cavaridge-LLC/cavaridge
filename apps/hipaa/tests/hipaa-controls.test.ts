/**
 * CVG-HIPAA — Unit Tests: HIPAA Security Rule Control Library
 *
 * Validates the completeness and structure of the HIPAA Security Rule
 * control mapping against 45 CFR 164.308, 164.310, 164.312.
 */

import { describe, it, expect } from "vitest";
import { HIPAA_SECURITY_CONTROLS, flattenControls } from "../server/data/hipaa-security-controls";

describe("HIPAA Security Controls Library", () => {
  it("should contain all three safeguard categories", () => {
    const categories = [...new Set(HIPAA_SECURITY_CONTROLS.map(c => c.category))];
    expect(categories).toContain("administrative");
    expect(categories).toContain("physical");
    expect(categories).toContain("technical");
  });

  it("should have 9 Administrative Safeguards (164.308)", () => {
    const admin = HIPAA_SECURITY_CONTROLS.filter(c => c.category === "administrative");
    expect(admin.length).toBe(9);
    expect(admin.every(c => c.ref.startsWith("164.308"))).toBe(true);
  });

  it("should have 4 Physical Safeguards (164.310)", () => {
    const physical = HIPAA_SECURITY_CONTROLS.filter(c => c.category === "physical");
    expect(physical.length).toBe(4);
    expect(physical.every(c => c.ref.startsWith("164.310"))).toBe(true);
  });

  it("should have 5 Technical Safeguards (164.312)", () => {
    const technical = HIPAA_SECURITY_CONTROLS.filter(c => c.category === "technical");
    expect(technical.length).toBe(5);
    expect(technical.every(c => c.ref.startsWith("164.312"))).toBe(true);
  });

  it("should have 18 total standards", () => {
    expect(HIPAA_SECURITY_CONTROLS.length).toBe(18);
  });

  it("every control should have required fields", () => {
    for (const control of HIPAA_SECURITY_CONTROLS) {
      expect(control.ref).toBeTruthy();
      expect(control.standard).toBeTruthy();
      expect(control.category).toBeTruthy();
      expect(typeof control.required).toBe("boolean");
      expect(control.description).toBeTruthy();
      expect(Array.isArray(control.specifications)).toBe(true);
    }
  });

  it("every specification should have required fields", () => {
    for (const control of HIPAA_SECURITY_CONTROLS) {
      for (const spec of control.specifications) {
        expect(spec.ref).toBeTruthy();
        expect(spec.name).toBeTruthy();
        expect(typeof spec.required).toBe("boolean");
        expect(spec.description).toBeTruthy();
      }
    }
  });

  it("should have both required and addressable implementation specifications", () => {
    const allSpecs = HIPAA_SECURITY_CONTROLS.flatMap(c => c.specifications);
    const requiredSpecs = allSpecs.filter(s => s.required);
    const addressableSpecs = allSpecs.filter(s => !s.required);

    expect(requiredSpecs.length).toBeGreaterThan(0);
    expect(addressableSpecs.length).toBeGreaterThan(0);
  });

  it("Security Management Process should have 4 specifications", () => {
    const smp = HIPAA_SECURITY_CONTROLS.find(c => c.ref === "164.308(a)(1)");
    expect(smp).toBeDefined();
    expect(smp!.specifications.length).toBe(4);
    expect(smp!.specifications[0].name).toBe("Risk Analysis");
    expect(smp!.specifications[0].required).toBe(true);
  });
});

describe("flattenControls", () => {
  it("should produce a flat list of standards and specifications", () => {
    const items = flattenControls();
    expect(items.length).toBeGreaterThan(18); // At least 18 standards + their specs
  });

  it("should mark specifications with parentRef", () => {
    const items = flattenControls();
    const specs = items.filter(i => i.parentRef);
    expect(specs.length).toBeGreaterThan(0);

    // Every spec's parentRef should match a standard's ref
    const standardRefs = new Set(items.filter(i => !i.parentRef).map(i => i.ref));
    for (const spec of specs) {
      expect(standardRefs.has(spec.parentRef!)).toBe(true);
    }
  });

  it("should have unique refs for all items", () => {
    const items = flattenControls();
    const refs = items.map(i => i.ref);
    const uniqueRefs = new Set(refs);
    expect(uniqueRefs.size).toBe(refs.length);
  });

  it("every item should have category, name, required flag", () => {
    const items = flattenControls();
    for (const item of items) {
      expect(["administrative", "physical", "technical"]).toContain(item.category);
      expect(item.name).toBeTruthy();
      expect(typeof item.required).toBe("boolean");
      expect(item.description).toBeTruthy();
    }
  });
});
