/**
 * CVG-CAVALIER — Lead Distribution Engine
 *
 * Distributes inbound leads to partners using weighted round-robin
 * based on geography, specialization, and tier.
 */

export interface PartnerCandidate {
  id: string;
  companyName: string;
  tier: string;
  geography: string | null;
  specializations: string[];
  roundRobinWeight: number;
  status: string;
}

export interface LeadInput {
  geography?: string | null;
  productInterest?: string[];
}

export interface DistributionResult {
  partnerId: string;
  partnerName: string;
  score: number;
  reasons: string[];
}

// Tier weights for scoring
const TIER_WEIGHTS: Record<string, number> = {
  platinum: 4,
  gold: 3,
  silver: 2,
  registered: 1,
};

/**
 * Rank and select partners for a lead using weighted scoring.
 *
 * Scoring factors:
 * 1. Geography match (+40 points)
 * 2. Specialization overlap (+30 points max)
 * 3. Tier weight (+20 points max)
 * 4. Round-robin weight (+10 points max)
 *
 * Returns ranked list of partners. Caller picks the top one
 * or applies round-robin from the top candidates.
 */
export function rankPartnersForLead(
  lead: LeadInput,
  partners: PartnerCandidate[],
): DistributionResult[] {
  // Only consider active partners
  const activePartners = partners.filter((p) => p.status === "active");

  if (activePartners.length === 0) {
    return [];
  }

  const results: DistributionResult[] = [];

  for (const partner of activePartners) {
    let score = 0;
    const reasons: string[] = [];

    // Geography match
    if (lead.geography && partner.geography) {
      if (normalizeGeo(partner.geography) === normalizeGeo(lead.geography)) {
        score += 40;
        reasons.push(`Geography match: ${lead.geography}`);
      }
    }

    // Specialization overlap
    if (lead.productInterest && lead.productInterest.length > 0 && partner.specializations.length > 0) {
      const overlap = lead.productInterest.filter((p) =>
        partner.specializations.some((s) => s.toLowerCase() === p.toLowerCase()),
      );
      if (overlap.length > 0) {
        const specScore = Math.min(30, (overlap.length / lead.productInterest.length) * 30);
        score += specScore;
        reasons.push(`Specialization match: ${overlap.join(", ")}`);
      }
    }

    // Tier weight
    const tierWeight = TIER_WEIGHTS[partner.tier] ?? 1;
    const tierScore = (tierWeight / 4) * 20;
    score += tierScore;
    reasons.push(`Tier: ${partner.tier} (${tierScore.toFixed(0)} pts)`);

    // Round-robin weight (normalized to 0-10)
    const rrWeight = Math.min(10, partner.roundRobinWeight * 2);
    score += rrWeight;

    results.push({
      partnerId: partner.id,
      partnerName: partner.companyName,
      score: Math.round(score * 100) / 100,
      reasons,
    });
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Select the next partner using weighted round-robin from the top-scoring group.
 * Takes the top N partners (those within 10 points of the highest score)
 * and rotates among them based on lastPartnerId.
 */
export function selectRoundRobin(
  ranked: DistributionResult[],
  lastPartnerId: string | null,
): DistributionResult | null {
  if (ranked.length === 0) return null;
  if (ranked.length === 1) return ranked[0];

  const topScore = ranked[0].score;
  const topGroup = ranked.filter((r) => r.score >= topScore - 10);

  if (!lastPartnerId) {
    return topGroup[0];
  }

  // Find the last partner's index and pick the next one
  const lastIndex = topGroup.findIndex((r) => r.partnerId === lastPartnerId);
  const nextIndex = (lastIndex + 1) % topGroup.length;
  return topGroup[nextIndex];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function normalizeGeo(geo: string): string {
  return geo.toLowerCase().trim();
}
