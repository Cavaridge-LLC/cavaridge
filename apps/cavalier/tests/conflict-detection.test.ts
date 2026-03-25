/**
 * CVG-CAVALIER — Deal Conflict Detection Tests
 */
import { describe, it, expect } from "vitest";
import {
  detectConflict,
  computeSimilarity,
  type DealConflictCandidate,
} from "../server/services/deals/conflict-detection";

const EXISTING_DEALS: DealConflictCandidate[] = [
  {
    id: "deal-1",
    partnerId: "partner-a",
    prospectCompany: "Acme Corporation",
    prospectDomain: "acme.com",
    prospectEmail: "john@acme.com",
    status: "registered",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "deal-2",
    partnerId: "partner-b",
    prospectCompany: "Beta Technologies LLC",
    prospectDomain: "betatech.io",
    prospectEmail: null,
    status: "qualified",
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "deal-3",
    partnerId: "partner-c",
    prospectCompany: "Gamma Health Services",
    prospectDomain: null,
    prospectEmail: "info@gammahealth.com",
    status: "lost",
    createdAt: "2025-12-01T00:00:00Z",
  },
];

describe("Deal Conflict Detection", () => {
  describe("detectConflict", () => {
    it("detects exact domain match", () => {
      const result = detectConflict(
        { prospectCompany: "ACME Corp", prospectDomain: "acme.com" },
        EXISTING_DEALS,
        "partner-x",
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe("domain");
      expect(result.confidence).toBe(1.0);
      expect(result.conflictingDeal?.id).toBe("deal-1");
    });

    it("detects domain match with www prefix normalization", () => {
      const result = detectConflict(
        { prospectCompany: "Acme", prospectDomain: "www.acme.com" },
        EXISTING_DEALS,
        "partner-x",
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe("domain");
    });

    it("detects email domain match", () => {
      const result = detectConflict(
        { prospectCompany: "Acme", prospectEmail: "sales@acme.com" },
        EXISTING_DEALS,
        "partner-x",
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe("email_domain");
    });

    it("ignores generic email domains (gmail, etc.)", () => {
      const result = detectConflict(
        { prospectCompany: "SomeCompany", prospectEmail: "user@gmail.com" },
        [
          {
            ...EXISTING_DEALS[0],
            prospectEmail: "other@gmail.com",
            prospectDomain: null,
          },
        ],
        "partner-x",
      );

      // Should not match on gmail.com
      expect(result.conflictType).not.toBe("email_domain");
    });

    it("detects fuzzy company name match", () => {
      const result = detectConflict(
        { prospectCompany: "Acme Corp" },
        EXISTING_DEALS,
        "partner-x",
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe("company");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("does not flag same partner's deals as conflict", () => {
      const result = detectConflict(
        { prospectCompany: "Acme Corporation", prospectDomain: "acme.com" },
        EXISTING_DEALS,
        "partner-a", // Same partner that owns deal-1
      );

      expect(result.hasConflict).toBe(false);
    });

    it("ignores lost deals", () => {
      const result = detectConflict(
        { prospectCompany: "Gamma Health Services" },
        EXISTING_DEALS,
        "partner-x",
      );

      // deal-3 is lost, should not conflict
      expect(result.hasConflict).toBe(false);
    });

    it("returns no conflict for completely new prospect", () => {
      const result = detectConflict(
        { prospectCompany: "Totally New Company XYZ", prospectDomain: "newco.com" },
        EXISTING_DEALS,
        "partner-x",
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflictType).toBeNull();
    });

    it("handles empty existing deals", () => {
      const result = detectConflict(
        { prospectCompany: "Anything", prospectDomain: "any.com" },
        [],
        "partner-x",
      );

      expect(result.hasConflict).toBe(false);
    });
  });

  describe("computeSimilarity", () => {
    it("returns 1.0 for identical strings", () => {
      expect(computeSimilarity("hello", "hello")).toBe(1);
    });

    it("returns 0 for completely different strings", () => {
      expect(computeSimilarity("abc", "xyz")).toBe(0);
    });

    it("returns high similarity for near-identical strings", () => {
      const sim = computeSimilarity("acme corporation", "acme corp");
      expect(sim).toBeGreaterThan(0.6);
    });

    it("returns low similarity for unrelated strings", () => {
      const sim = computeSimilarity("alpha industries", "beta technologies");
      expect(sim).toBeLessThan(0.5);
    });

    it("handles single-character strings", () => {
      expect(computeSimilarity("a", "b")).toBe(0);
    });
  });
});
