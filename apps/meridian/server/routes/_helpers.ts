import { storage } from "../storage";
import { organizations, auditLog, isPlatformRole, findings, documents, documentChunks, documentClassifications, pillars } from "@shared/schema";
import { eq, inArray, sql as dsql, and, ne } from "drizzle-orm";
import { db } from "../db";
import { type AuthenticatedRequest, requireAuth, logAudit, verifyDealAccess, requirePlatformRole, requirePlatformOwner } from "../auth";
import { createSupabaseAdminClient } from "@cavaridge/auth/server";
import { hasPermission, getAccessibleDeals, hasAccessToDeal, type Permission } from "../permissions";
import { checkPlanLimit, incrementUsage, getUsageSummary, PLAN_LIMITS, getNextTier, tierLabel, limitLabel, type PlanTier } from "../plan-limits";
import crypto from "crypto";
import { readFileSync } from "fs";
import path from "path";

export { storage, organizations, auditLog, isPlatformRole, findings, documents, documentChunks, documentClassifications, pillars };
export { eq, inArray, dsql, and, ne };
export { db };
export { requireAuth, logAudit, verifyDealAccess, requirePlatformRole, requirePlatformOwner, createSupabaseAdminClient };
export type { AuthenticatedRequest };
export { hasPermission, getAccessibleDeals, hasAccessToDeal };
export type { Permission };
export { checkPlanLimit, incrementUsage, getUsageSummary, PLAN_LIMITS, getNextTier, tierLabel, limitLabel };
export type { PlanTier };
export { crypto, readFileSync, path };

export const INDUSTRY_WEIGHTS: Record<string, Record<string, number>> = {
  "Healthcare": { "Infrastructure & Architecture": 0.15, "Cybersecurity Posture": 0.20, "Regulatory Compliance": 0.25, "Integration Complexity": 0.15, "Technology Org & Talent": 0.10, "Data Assets & Governance": 0.15 },
  "Financial Services": { "Infrastructure & Architecture": 0.15, "Cybersecurity Posture": 0.20, "Regulatory Compliance": 0.25, "Integration Complexity": 0.15, "Technology Org & Talent": 0.10, "Data Assets & Governance": 0.15 },
  "Manufacturing": { "Infrastructure & Architecture": 0.20, "Cybersecurity Posture": 0.25, "Regulatory Compliance": 0.15, "Integration Complexity": 0.20, "Technology Org & Talent": 0.10, "Data Assets & Governance": 0.10 },
  "Technology/SaaS": { "Infrastructure & Architecture": 0.20, "Cybersecurity Posture": 0.15, "Regulatory Compliance": 0.15, "Integration Complexity": 0.20, "Technology Org & Talent": 0.20, "Data Assets & Governance": 0.10 },
  "Retail": { "Infrastructure & Architecture": 0.20, "Cybersecurity Posture": 0.15, "Regulatory Compliance": 0.20, "Integration Complexity": 0.20, "Technology Org & Talent": 0.10, "Data Assets & Governance": 0.15 },
  "Professional Services": { "Infrastructure & Architecture": 0.15, "Cybersecurity Posture": 0.15, "Regulatory Compliance": 0.15, "Integration Complexity": 0.20, "Technology Org & Talent": 0.20, "Data Assets & Governance": 0.15 },
};

export const PILLAR_NAMES = [
  "Infrastructure & Architecture",
  "Cybersecurity Posture",
  "Regulatory Compliance",
  "Integration Complexity",
  "Technology Org & Talent",
  "Data Assets & Governance",
];

export const SEVERITY_PENALTIES: Record<string, number> = {
  critical: 0.8,
  high: 0.5,
  medium: 0.25,
  low: 0.1,
};

export const PILLAR_CLASSIFICATION_MAP: Record<string, string[]> = {
  "Infrastructure & Architecture": ["Network Documentation", "Asset Inventory", "Infrastructure & Architecture", "Backup & DR"],
  "Cybersecurity Posture": ["Security Assessment", "Identity & Access"],
  "Regulatory Compliance": ["Compliance Documentation", "IT Policy"],
  "Integration Complexity": ["Clinical Systems", "OT/ICS Systems", "Application Inventory"],
  "Technology Org & Talent": ["Organization & Staffing", "IT Financial"],
  "Data Assets & Governance": ["Vendor Contract"],
};

export function computeFindingScore(findingsForPillar: Array<{ severity: string; status: string }>): number {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findingsForPillar) {
    if (f.status === "open" || f.status === "acknowledged") {
      const sev = f.severity as keyof typeof counts;
      if (sev in counts) counts[sev]++;
    }
  }

  let score = 5.0;
  score -= counts.critical * 0.8;
  score -= counts.high * 0.5;
  const mediumPenalty = Math.min(counts.medium, 5) * 0.25 +
                        Math.max(0, counts.medium - 5) * 0.10;
  score -= mediumPenalty;
  const lowPenalty = Math.min(counts.low, 3) * 0.1 +
                     Math.max(0, counts.low - 3) * 0.03;
  score -= lowPenalty;

  return Math.max(1.0, Math.round(score * 100) / 100);
}

export function getEvidenceTier(docCount: number): { confidence: number; scoreCap: number; label: string } {
  if (docCount === 0) return { confidence: 0.0, scoreCap: 3.0, label: "insufficient" };
  if (docCount <= 2) return { confidence: 0.25, scoreCap: 4.0, label: "low" };
  if (docCount <= 5) return { confidence: 0.65, scoreCap: 4.8, label: "moderate" };
  return { confidence: 1.0, scoreCap: 5.0, label: "high" };
}

export function countDocumentsForPillar(
  pillarName: string,
  allDocuments: Array<{ classification: string | null }>
): number {
  const classifications = PILLAR_CLASSIFICATION_MAP[pillarName] || [];
  return allDocuments.filter((d) => d.classification && classifications.includes(d.classification)).length;
}

export function computeCompositeScore(
  pillarScores: Array<{ score: number; weight: number }>,
  criticalOpenCount: number
): number {
  const weightedSum = pillarScores.reduce((s, p) => s + p.score * p.weight, 0);
  const penalty = Math.max(0.70, 1.0 - 0.05 * criticalOpenCount);
  return Math.round(weightedSum * penalty * 10) / 10;
}

export function compositeToPercent(composite: number): number {
  return Math.min(100, Math.max(0, Math.round((composite / 5) * 100)));
}

export function computeOverallConfidence(
  pillarLabels: string[]
): string {
  const total = pillarLabels.length;
  const insufficientCount = pillarLabels.filter((l) => l === "insufficient").length;
  const lowCount = pillarLabels.filter((l) => l === "low").length;
  const weakCount = insufficientCount + lowCount;

  if (insufficientCount === total) return "insufficient";
  if (weakCount > total / 2) return "low";
  if (weakCount > 0) return "moderate";
  return "high";
}

export async function recalculateDealScores(dealId: string, _industry?: string): Promise<void> {
  const allPillars = await storage.getPillarsByDeal(dealId);
  const allFindings = await storage.getFindingsByDeal(dealId);
  const allDocuments = await storage.getDocumentsByDeal(dealId);

  for (const pillar of allPillars) {
    const pillarFindings = allFindings.filter((f) => f.pillarId === pillar.id);
    const findingScore = computeFindingScore(pillarFindings);
    const docCount = countDocumentsForPillar(pillar.pillarName, allDocuments);
    const tier = getEvidenceTier(docCount);
    const finalScore = Math.round(Math.min(findingScore, tier.scoreCap) * 100) / 100;

    await storage.updatePillar(pillar.id, {
      score: String(finalScore),
      findingCount: pillarFindings.length,
      evidenceConfidence: String(tier.confidence),
      confidenceLabel: tier.label,
      documentCount: docCount,
      scoreCap: String(tier.scoreCap),
    });
  }

  const updatedPillars = await storage.getPillarsByDeal(dealId);
  const criticalOpen = allFindings.filter(
    (f) => f.severity === "critical" && f.status === "open"
  ).length;
  const compositeRaw = computeCompositeScore(
    updatedPillars.map((p) => ({ score: Number(p.score), weight: Number(p.weight) })),
    criticalOpen
  );
  const compositePercent = compositeToPercent(compositeRaw);

  const overallConfidence = computeOverallConfidence(
    updatedPillars.map((p) => p.confidenceLabel || "insufficient")
  );

  await storage.updateDeal(dealId, {
    compositeScore: String(compositePercent),
    overallConfidence,
  });
}

export function requirePerm(action: Permission) {
  return (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!hasPermission(req.user, action)) return res.status(403).json({ message: "Insufficient permissions" });
    next();
  };
}

export function readVersion() {
  try {
    const versionPath = path.resolve(process.cwd(), "version.json");
    return JSON.parse(readFileSync(versionPath, "utf-8"));
  } catch {
    return { major: 2, minor: 0, patch: 0, build: 0, timestamp: new Date().toISOString() };
  }
}
