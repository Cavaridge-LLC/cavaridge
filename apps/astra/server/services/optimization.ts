/**
 * Optimization Recommendations Service — CVG-ASTRA
 *
 * Generates AI-powered license optimization recommendations via Ducky/Spaniel.
 * Takes waste detection findings and produces actionable recommendations
 * with cost savings calculations.
 */

import { createSpanielClient } from "@cavaridge/spaniel";
import type {
  WasteFinding,
  WasteDetectionResult,
  OptimizationRecommendation,
  RecommendationType,
  WasteSeverity,
} from "../types/index.js";
import { findLicenseInfo } from "../sku-map.js";

const APP_CODE = "CVG-ASTRA";
const spanielClient = createSpanielClient(APP_CODE);

export interface GenerateRecommendationsInput {
  wasteResult: WasteDetectionResult;
  strategy?: "balanced" | "maximize_savings" | "maximize_security";
}

export interface GenerateRecommendationsOutput {
  recommendations: OptimizationRecommendation[];
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  narrative: string;
}

/**
 * Generate AI-powered optimization recommendations from waste findings.
 * Uses Spaniel (via Ducky) for intelligent analysis.
 */
export async function generateRecommendations(
  input: GenerateRecommendationsInput,
): Promise<GenerateRecommendationsOutput> {
  const { wasteResult, strategy = "balanced" } = input;

  // Build deterministic recommendations for clear-cut cases
  const deterministicRecs = buildDeterministicRecommendations(wasteResult.findings);

  // Use AI for complex/nuanced recommendations
  const aiRecs = await generateAIRecommendations(wasteResult, strategy);

  // Merge, deduplicate by userId
  const allRecs = mergeDeduplicate(deterministicRecs, aiRecs);

  const totalMonthlySavings = allRecs.reduce((sum, r) => sum + r.monthlySavings, 0);

  return {
    recommendations: allRecs,
    totalMonthlySavings: Math.round(totalMonthlySavings * 100) / 100,
    totalAnnualSavings: Math.round(totalMonthlySavings * 12 * 100) / 100,
    narrative: buildNarrative(allRecs, totalMonthlySavings, strategy),
  };
}

// ── Deterministic Recommendations ───────────────────────────────────

function buildDeterministicRecommendations(findings: WasteFinding[]): OptimizationRecommendation[] {
  const recs: OptimizationRecommendation[] = [];

  for (const finding of findings) {
    switch (finding.category) {
      case "disabled_account":
        recs.push(buildRec(finding, "removal", [], 0,
          `Remove all licenses from disabled account "${finding.userDisplayName}" — immediate cost recovery`,
          "critical",
        ));
        break;

      case "unused":
        if (finding.daysSinceLastActivity !== null && finding.daysSinceLastActivity >= 180) {
          recs.push(buildRec(finding, "removal", [], 0,
            `No activity in ${finding.daysSinceLastActivity} days — recommend license removal pending HR review`,
            "high",
          ));
        } else {
          // Downgrade to F3 for soft-inactive users
          const f3Cost = 8;
          recs.push(buildRec(finding, "downgrade", ["Microsoft 365 F3"], f3Cost,
            `${finding.daysSinceLastActivity ?? "Unknown"} days inactive — downgrade to F3 to maintain account access at minimal cost`,
            "medium",
          ));
        }
        break;

      case "duplicate":
        // Remove the lower-tier license
        const overlap = findOverlapLicense(finding.currentLicenses);
        if (overlap) {
          const remaining = finding.currentLicenses.filter(l => l !== overlap.lower);
          const remainingCost = remaining.reduce((sum, l) => sum + findLicenseInfo(l).cost, 0);
          recs.push(buildRec(finding, "removal", remaining, remainingCost,
            `Remove redundant "${overlap.lower}" — capabilities already covered by "${overlap.higher}"`,
            "high",
          ));
        }
        break;

      case "underutilized":
        // E5 → E3 downgrade
        if (finding.currentLicenses.some(l => l.includes("E5"))) {
          const e3Licenses = finding.currentLicenses.map(l =>
            l.includes("Microsoft 365 E5") ? "Microsoft 365 E3" :
            l.includes("Office 365 E5") ? "Office 365 E3" : l,
          );
          const e3Cost = e3Licenses.reduce((sum, l) => sum + findLicenseInfo(l).cost, 0);
          recs.push(buildRec(finding, "downgrade", e3Licenses, e3Cost,
            `Using ${finding.activeServiceCount}/${finding.totalServiceCount} services — E3 covers all active usage`,
            "medium",
          ));
        }
        break;
    }
  }

  return recs;
}

// ── AI-Powered Recommendations ──────────────────────────────────────

async function generateAIRecommendations(
  wasteResult: WasteDetectionResult,
  strategy: string,
): Promise<OptimizationRecommendation[]> {
  // Skip AI if no API key or very few findings
  if (!process.env.OPENROUTER_API_KEY || wasteResult.findings.length === 0) {
    return [];
  }

  const systemPrompt = `You are an M365 licensing optimization specialist working within the Ducky Intelligence platform (by Cavaridge).
Analyze the waste detection findings and generate additional optimization recommendations that the deterministic engine may have missed.

Focus on:
- License consolidation opportunities across departments
- Group-based licensing recommendations
- Seasonal/project-based license management
- Cross-product optimization (e.g., standalone add-ons included in higher tiers)

Strategy: ${strategy}

Return a JSON array of recommendations. Each object must have:
{
  "userId": "string",
  "userDisplayName": "string",
  "userPrincipalName": "string",
  "type": "downgrade|removal|consolidation|upgrade|reassignment",
  "currentLicenses": ["string"],
  "recommendedLicenses": ["string"],
  "currentMonthlyCost": number,
  "recommendedMonthlyCost": number,
  "rationale": "string",
  "riskLevel": "critical|high|medium|low|info"
}

Only include recommendations not already covered by the waste findings. Return [] if no additional recommendations.`;

  const userPrompt = `Waste Detection Summary:
- Total users: ${wasteResult.totalUsers}
- Total monthly cost: $${wasteResult.totalMonthlyCost.toFixed(2)}
- Unused licenses: ${wasteResult.summary.unusedLicenseCount}
- Underutilized: ${wasteResult.summary.underutilizedCount}
- Duplicates: ${wasteResult.summary.duplicateCount}
- Disabled accounts: ${wasteResult.summary.disabledAccountCount}
- Total wasted monthly: $${wasteResult.summary.totalWastedMonthlyCost.toFixed(2)}

Top findings:
${wasteResult.findings.slice(0, 20).map(f =>
  `- ${f.userDisplayName} (${f.userPrincipalName}): ${f.category} — ${f.description} [$${f.currentMonthlyCost}/mo]`
).join("\n")}`;

  try {
    const response = await spanielClient.chat.completions.create({
      model: "anthropic/claude-sonnet-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((r: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      userId: String(r.userId ?? ""),
      userDisplayName: String(r.userDisplayName ?? ""),
      userPrincipalName: String(r.userPrincipalName ?? ""),
      type: String(r.type ?? "consolidation") as RecommendationType,
      currentLicenses: Array.isArray(r.currentLicenses) ? r.currentLicenses.map(String) : [],
      recommendedLicenses: Array.isArray(r.recommendedLicenses) ? r.recommendedLicenses.map(String) : [],
      currentMonthlyCost: Number(r.currentMonthlyCost ?? 0),
      recommendedMonthlyCost: Number(r.recommendedMonthlyCost ?? 0),
      monthlySavings: Number(r.currentMonthlyCost ?? 0) - Number(r.recommendedMonthlyCost ?? 0),
      annualSavings: (Number(r.currentMonthlyCost ?? 0) - Number(r.recommendedMonthlyCost ?? 0)) * 12,
      rationale: String(r.rationale ?? ""),
      riskLevel: String(r.riskLevel ?? "medium") as WasteSeverity,
      status: "pending" as const,
    }));
  } catch (err) {
    console.error("[optimization] AI recommendation generation failed:", err);
    return [];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildRec(
  finding: WasteFinding,
  type: RecommendationType,
  recommendedLicenses: string[],
  recommendedCost: number,
  rationale: string,
  riskLevel: WasteSeverity,
): OptimizationRecommendation {
  const savings = finding.currentMonthlyCost - recommendedCost;
  return {
    id: crypto.randomUUID(),
    userId: finding.userId,
    userDisplayName: finding.userDisplayName,
    userPrincipalName: finding.userPrincipalName,
    type,
    currentLicenses: finding.currentLicenses,
    recommendedLicenses,
    currentMonthlyCost: finding.currentMonthlyCost,
    recommendedMonthlyCost: recommendedCost,
    monthlySavings: Math.round(savings * 100) / 100,
    annualSavings: Math.round(savings * 12 * 100) / 100,
    rationale,
    riskLevel,
    status: "pending",
  };
}

function findOverlapLicense(licenses: string[]): { higher: string; lower: string } | null {
  const OVERLAPPING = [
    { higher: "Microsoft 365 E5", lower: "Microsoft 365 E3" },
    { higher: "Microsoft 365 E5", lower: "Office 365 E3" },
    { higher: "Microsoft 365 E5", lower: "Office 365 E1" },
    { higher: "Microsoft 365 E3", lower: "Office 365 E1" },
    { higher: "Office 365 E5", lower: "Office 365 E3" },
    { higher: "Enterprise Mobility + Security E5", lower: "Enterprise Mobility + Security E3" },
  ];

  const licenseSet = new Set(licenses);
  for (const pair of OVERLAPPING) {
    if (licenseSet.has(pair.higher) && licenseSet.has(pair.lower)) {
      return pair;
    }
  }
  return null;
}

function mergeDeduplicate(
  deterministic: OptimizationRecommendation[],
  ai: OptimizationRecommendation[],
): OptimizationRecommendation[] {
  const seen = new Set<string>();
  const result: OptimizationRecommendation[] = [];

  // Deterministic takes priority
  for (const rec of deterministic) {
    const key = `${rec.userId}:${rec.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(rec);
    }
  }

  for (const rec of ai) {
    const key = `${rec.userId}:${rec.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(rec);
    }
  }

  return result;
}

function buildNarrative(
  recs: OptimizationRecommendation[],
  totalMonthlySavings: number,
  strategy: string,
): string {
  if (recs.length === 0) {
    return "No optimization opportunities identified. License assignments appear well-aligned with usage patterns.";
  }

  const removals = recs.filter(r => r.type === "removal").length;
  const downgrades = recs.filter(r => r.type === "downgrade").length;
  const consolidations = recs.filter(r => r.type === "consolidation").length;

  const parts: string[] = [
    `Analysis identified ${recs.length} optimization ${recs.length === 1 ? "opportunity" : "opportunities"} with a combined potential savings of $${totalMonthlySavings.toFixed(2)}/month ($${(totalMonthlySavings * 12).toFixed(2)}/year).`,
  ];

  if (removals > 0) parts.push(`${removals} license ${removals === 1 ? "removal" : "removals"} recommended.`);
  if (downgrades > 0) parts.push(`${downgrades} license ${downgrades === 1 ? "downgrade" : "downgrades"} recommended.`);
  if (consolidations > 0) parts.push(`${consolidations} consolidation ${consolidations === 1 ? "opportunity" : "opportunities"} identified.`);

  parts.push(`Strategy applied: ${strategy}.`);

  return parts.join(" ");
}
