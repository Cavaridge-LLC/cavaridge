/**
 * CVG-CAVALIER — AI Partner Matching via Ducky
 *
 * Uses the Ducky Intelligence app-query API to match
 * prospects with the best-fit channel partner.
 * All LLM calls route through Spaniel via Ducky.
 */
import { chatCompletion, hasAICapability } from "@cavaridge/spaniel";
import type { ChatMessage } from "@cavaridge/spaniel";

const APP_CODE = "CVG-CAVALIER";

export interface PartnerMatchInput {
  tenantId: string;
  userId: string;
  prospect: {
    company: string;
    industry?: string;
    geography?: string;
    size?: string;
    needs?: string[];
    budget?: string;
  };
  partners: Array<{
    id: string;
    companyName: string;
    tier: string;
    geography: string | null;
    specializations: unknown[];
    certifications: unknown[];
    dealsWon: number;
    totalRevenue: string;
  }>;
}

export interface PartnerMatchResult {
  rankings: Array<{
    partnerId: string;
    partnerName: string;
    score: number;
    reasoning: string;
  }>;
  recommendation: string;
  aiPowered: boolean;
}

/**
 * Use Ducky Intelligence to match a prospect with the best-fit partner.
 * Falls back to rule-based scoring if AI is not available.
 */
export async function matchPartnerToProspect(
  input: PartnerMatchInput,
): Promise<PartnerMatchResult> {
  if (!hasAICapability() || input.partners.length === 0) {
    return fallbackMatch(input);
  }

  const systemPrompt = `You are Ducky, the AI reasoning engine for Cavaridge's channel partner platform.
Your task is to match a prospect with the best-fit channel partner.

Evaluate each partner based on:
1. Geography alignment (40% weight)
2. Specialization/industry fit (30% weight)
3. Partner tier and track record (20% weight)
4. Capacity and certification relevance (10% weight)

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "rankings": [
    { "partnerId": "...", "partnerName": "...", "score": 0-100, "reasoning": "..." }
  ],
  "recommendation": "Brief recommendation text"
}`;

  const userMessage = `Match this prospect to the best partner:

PROSPECT:
${JSON.stringify(input.prospect, null, 2)}

AVAILABLE PARTNERS:
${JSON.stringify(input.partners, null, 2)}`;

  try {
    const messages: ChatMessage[] = [{ role: "user", content: userMessage }];

    const response = await chatCompletion({
      tenantId: input.tenantId,
      userId: input.userId,
      appCode: APP_CODE,
      taskType: "analysis",
      system: systemPrompt,
      messages,
      options: {
        temperature: 0.3,
        maxTokens: 2048,
      },
    });

    if (response.status === "error") {
      return fallbackMatch(input);
    }

    const parsed = JSON.parse(response.content);
    return {
      rankings: parsed.rankings ?? [],
      recommendation: parsed.recommendation ?? "",
      aiPowered: true,
    };
  } catch {
    // AI call failed — fall back to rule-based
    return fallbackMatch(input);
  }
}

/**
 * Rule-based fallback when AI is unavailable.
 */
function fallbackMatch(input: PartnerMatchInput): PartnerMatchResult {
  const tierScores: Record<string, number> = {
    platinum: 25,
    gold: 20,
    silver: 15,
    registered: 10,
  };

  const rankings = input.partners.map((partner) => {
    let score = 0;
    const reasons: string[] = [];

    // Geography
    if (input.prospect.geography && partner.geography) {
      if (partner.geography.toLowerCase().includes(input.prospect.geography.toLowerCase())) {
        score += 40;
        reasons.push("Geography match");
      }
    }

    // Tier
    score += tierScores[partner.tier] ?? 10;
    reasons.push(`Tier: ${partner.tier}`);

    // Track record
    if (partner.dealsWon > 10) {
      score += 15;
      reasons.push("Strong deal history");
    } else if (partner.dealsWon > 5) {
      score += 10;
      reasons.push("Good deal history");
    }

    return {
      partnerId: partner.id,
      partnerName: partner.companyName,
      score,
      reasoning: reasons.join("; "),
    };
  });

  rankings.sort((a, b) => b.score - a.score);

  return {
    rankings,
    recommendation: rankings.length > 0
      ? `Recommended: ${rankings[0].partnerName} (score: ${rankings[0].score})`
      : "No eligible partners found.",
    aiPowered: false,
  };
}
