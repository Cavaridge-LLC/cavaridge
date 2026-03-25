/**
 * CVG-CAVALIER — Deal Conflict Detection
 *
 * Detects when multiple partners attempt to register deals
 * for the same prospect. Matches on:
 * 1. Exact domain match (highest confidence)
 * 2. Company name fuzzy match
 * 3. Prospect email domain match
 */

export interface DealConflictCandidate {
  id: string;
  partnerId: string;
  prospectCompany: string;
  prospectDomain: string | null;
  prospectEmail: string | null;
  status: string;
  createdAt: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictType: "domain" | "company" | "email_domain" | null;
  conflictingDeal: DealConflictCandidate | null;
  confidence: number;
}

/**
 * Check a new deal registration against existing deals for conflicts.
 */
export function detectConflict(
  newDeal: {
    prospectCompany: string;
    prospectDomain?: string | null;
    prospectEmail?: string | null;
  },
  existingDeals: DealConflictCandidate[],
  excludePartnerId: string,
): ConflictResult {
  // Filter out deals from the same partner and deals that are lost/expired
  const activeDealsByOthers = existingDeals.filter(
    (d) =>
      d.partnerId !== excludePartnerId &&
      d.status !== "lost" &&
      d.status !== "expired",
  );

  if (activeDealsByOthers.length === 0) {
    return { hasConflict: false, conflictType: null, conflictingDeal: null, confidence: 0 };
  }

  // 1. Exact domain match (highest priority)
  if (newDeal.prospectDomain) {
    const domainNorm = normalizeDomain(newDeal.prospectDomain);
    for (const existing of activeDealsByOthers) {
      if (existing.prospectDomain && normalizeDomain(existing.prospectDomain) === domainNorm) {
        return {
          hasConflict: true,
          conflictType: "domain",
          conflictingDeal: existing,
          confidence: 1.0,
        };
      }
    }
  }

  // 2. Email domain match
  if (newDeal.prospectEmail) {
    const emailDomain = extractEmailDomain(newDeal.prospectEmail);
    if (emailDomain && !isGenericEmailDomain(emailDomain)) {
      for (const existing of activeDealsByOthers) {
        if (existing.prospectDomain && normalizeDomain(existing.prospectDomain) === emailDomain) {
          return {
            hasConflict: true,
            conflictType: "email_domain",
            conflictingDeal: existing,
            confidence: 0.9,
          };
        }
        if (existing.prospectEmail) {
          const existingDomain = extractEmailDomain(existing.prospectEmail);
          if (existingDomain === emailDomain) {
            return {
              hasConflict: true,
              conflictType: "email_domain",
              conflictingDeal: existing,
              confidence: 0.85,
            };
          }
        }
      }
    }
  }

  // 3. Company name fuzzy match
  const newCompanyNorm = normalizeCompanyName(newDeal.prospectCompany);
  for (const existing of activeDealsByOthers) {
    const existingNorm = normalizeCompanyName(existing.prospectCompany);
    const similarity = computeSimilarity(newCompanyNorm, existingNorm);
    if (similarity >= 0.85) {
      return {
        hasConflict: true,
        conflictType: "company",
        conflictingDeal: existing,
        confidence: similarity,
      };
    }
  }

  return { hasConflict: false, conflictType: null, conflictingDeal: null, confidence: 0 };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^(www\.)+/, "").trim();
}

function extractEmailDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  return normalizeDomain(parts[1]);
}

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "aol.com", "icloud.com", "protonmail.com", "mail.com",
  "live.com", "msn.com", "me.com",
]);

function isGenericEmailDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|group|holdings?|enterprises?|solutions?|technologies?|services?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple character-level similarity (Sørensen-Dice coefficient on bigrams).
 * Returns 0–1 where 1 is identical.
 */
export function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}
