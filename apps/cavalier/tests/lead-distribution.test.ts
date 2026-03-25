/**
 * CVG-CAVALIER — Lead Distribution Engine Tests
 */
import { describe, it, expect } from "vitest";
import {
  rankPartnersForLead,
  selectRoundRobin,
  type PartnerCandidate,
} from "../server/services/leads/distribution";

const PARTNERS: PartnerCandidate[] = [
  {
    id: "p-1",
    companyName: "TechPro Solutions",
    tier: "gold",
    geography: "Northeast US",
    specializations: ["CVG-AEGIS", "CVG-MIDAS"],
    roundRobinWeight: 3,
    status: "active",
  },
  {
    id: "p-2",
    companyName: "CloudFirst MSP",
    tier: "silver",
    geography: "Southeast US",
    specializations: ["CVG-VESPAR", "CVG-ASTRA"],
    roundRobinWeight: 2,
    status: "active",
  },
  {
    id: "p-3",
    companyName: "SecureNet Partners",
    tier: "platinum",
    geography: "Northeast US",
    specializations: ["CVG-AEGIS", "CVG-HIPAA"],
    roundRobinWeight: 5,
    status: "active",
  },
  {
    id: "p-4",
    companyName: "Inactive Corp",
    tier: "registered",
    geography: "Northeast US",
    specializations: [],
    roundRobinWeight: 1,
    status: "suspended",
  },
];

describe("Lead Distribution Engine", () => {
  describe("rankPartnersForLead", () => {
    it("ranks by geography match", () => {
      const ranked = rankPartnersForLead(
        { geography: "Northeast US" },
        PARTNERS,
      );

      // Should exclude inactive partner (p-4)
      expect(ranked).toHaveLength(3);

      // p-3 and p-1 are in Northeast US, should rank highest
      const northeastPartners = ranked.filter(
        (r) => r.partnerId === "p-1" || r.partnerId === "p-3",
      );
      expect(northeastPartners.length).toBe(2);
      expect(northeastPartners[0].score).toBeGreaterThan(ranked[2].score);
    });

    it("ranks by specialization match", () => {
      const ranked = rankPartnersForLead(
        { productInterest: ["CVG-AEGIS"] },
        PARTNERS,
      );

      // p-1 and p-3 have CVG-AEGIS
      const aegisPartners = ranked.filter(
        (r) => r.partnerId === "p-1" || r.partnerId === "p-3",
      );
      expect(aegisPartners.length).toBe(2);
      expect(aegisPartners.every((p) => p.score > ranked[2].score)).toBe(true);
    });

    it("gives higher tier score to platinum", () => {
      const ranked = rankPartnersForLead({ }, PARTNERS);

      const platinumPartner = ranked.find((r) => r.partnerId === "p-3");
      const silverPartner = ranked.find((r) => r.partnerId === "p-2");

      expect(platinumPartner!.score).toBeGreaterThan(silverPartner!.score);
    });

    it("excludes inactive partners", () => {
      const ranked = rankPartnersForLead({ }, PARTNERS);

      expect(ranked.find((r) => r.partnerId === "p-4")).toBeUndefined();
    });

    it("handles empty partner list", () => {
      const ranked = rankPartnersForLead(
        { geography: "Northeast US" },
        [],
      );
      expect(ranked).toHaveLength(0);
    });

    it("combines geography and specialization scores", () => {
      const ranked = rankPartnersForLead(
        { geography: "Northeast US", productInterest: ["CVG-AEGIS"] },
        PARTNERS,
      );

      // p-3 has both geography match AND specialization match AND highest tier
      expect(ranked[0].partnerId).toBe("p-3");
    });
  });

  describe("selectRoundRobin", () => {
    it("selects first partner when no previous assignment", () => {
      const ranked = rankPartnersForLead(
        { geography: "Northeast US", productInterest: ["CVG-AEGIS"] },
        PARTNERS,
      );

      const selected = selectRoundRobin(ranked, null);
      expect(selected).not.toBeNull();
      // Should be first in ranked list
      expect(selected!.partnerId).toBe(ranked[0].partnerId);
    });

    it("rotates to next partner in top group", () => {
      const ranked = rankPartnersForLead(
        { geography: "Northeast US", productInterest: ["CVG-AEGIS"] },
        PARTNERS,
      );

      // If last was p-3 (first in ranked), next should be different
      const selected = selectRoundRobin(ranked, "p-3");
      expect(selected).not.toBeNull();
      // Should not be p-3 again (unless only one in top group)
      if (ranked.length > 1 && ranked[1].score >= ranked[0].score - 10) {
        expect(selected!.partnerId).not.toBe("p-3");
      }
    });

    it("handles single partner", () => {
      const ranked = [
        { partnerId: "p-1", partnerName: "Solo", score: 50, reasons: [] },
      ];

      const selected = selectRoundRobin(ranked, null);
      expect(selected!.partnerId).toBe("p-1");

      const selectedAgain = selectRoundRobin(ranked, "p-1");
      expect(selectedAgain!.partnerId).toBe("p-1");
    });

    it("handles empty ranked list", () => {
      const selected = selectRoundRobin([], null);
      expect(selected).toBeNull();
    });

    it("wraps around when last partner was the last in group", () => {
      const ranked = [
        { partnerId: "p-1", partnerName: "A", score: 50, reasons: [] },
        { partnerId: "p-2", partnerName: "B", score: 48, reasons: [] },
        { partnerId: "p-3", partnerName: "C", score: 45, reasons: [] },
      ];

      const selected = selectRoundRobin(ranked, "p-3");
      // p-3 is last (index 2), should wrap to p-1 (index 0)
      expect(selected!.partnerId).toBe("p-1");
    });
  });
});
