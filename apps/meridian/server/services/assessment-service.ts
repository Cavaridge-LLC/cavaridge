/**
 * Meridian — Assessment Service
 *
 * Business logic for the IT Due Diligence Assessment framework.
 * 12-section assessment model with evidence tagging, risk classification,
 * and risk matrix generation.
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db";
import {
  assessments,
  assessmentSections,
  evidenceItems,
  riskMatrixEntries,
  assessmentTenantData,
  ASSESSMENT_SECTIONS,
  type Assessment,
  type InsertAssessment,
  type AssessmentSection,
  type InsertAssessmentSection,
  type EvidenceItem,
  type InsertEvidenceItem,
  type RiskMatrixEntry,
  type InsertRiskMatrixEntry,
  type AssessmentTenantData,
  type InsertAssessmentTenantData,
  type RiskSeverity,
  type RiskLikelihood,
} from "@shared/schema";

// ── Risk Score Calculation ────────────────────────────────────────────

const SEVERITY_SCORES: Record<RiskSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 1,
};

const LIKELIHOOD_SCORES: Record<RiskLikelihood, number> = {
  almost_certain: 5,
  likely: 4,
  possible: 3,
  unlikely: 2,
  rare: 1,
};

/**
 * Compute risk score from severity x likelihood (1–25 scale).
 */
export function computeRiskScore(severity: RiskSeverity, likelihood: RiskLikelihood): number {
  return SEVERITY_SCORES[severity] * LIKELIHOOD_SCORES[likelihood];
}

/**
 * Classify a risk score into a severity label.
 */
export function classifyRiskScore(score: number): RiskSeverity {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

/**
 * Determine overall risk rating from all risk matrix entries.
 */
export function computeOverallRisk(entries: RiskMatrixEntry[]): RiskSeverity | null {
  if (entries.length === 0) return null;
  const openEntries = entries.filter(e => e.status === "open" || e.status === "in_progress");
  if (openEntries.length === 0) return "low";
  const maxScore = Math.max(...openEntries.map(e => e.riskScore));
  return classifyRiskScore(maxScore);
}

// ── Assessment CRUD ───────────────────────────────────────────────────

export async function createAssessment(data: InsertAssessment): Promise<Assessment> {
  const [assessment] = await db.insert(assessments).values(data).returning();
  // Auto-create the 12 standard sections
  for (const section of ASSESSMENT_SECTIONS) {
    await db.insert(assessmentSections).values({
      assessmentId: assessment.id,
      sectionKey: section.id,
      sectionName: section.name,
      sectionOrder: section.order,
      status: "not_started",
      evidenceTag: "UNVERIFIED",
    });
  }
  return assessment;
}

export async function getAssessment(id: string): Promise<Assessment | undefined> {
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
  return assessment;
}

export async function getAssessmentsByTenant(tenantId: string): Promise<Assessment[]> {
  return db.select().from(assessments)
    .where(eq(assessments.tenantId, tenantId))
    .orderBy(desc(assessments.createdAt));
}

export async function getAssessmentsByDeal(dealId: string): Promise<Assessment[]> {
  return db.select().from(assessments)
    .where(eq(assessments.dealId, dealId))
    .orderBy(desc(assessments.createdAt));
}

export async function updateAssessment(id: string, data: Partial<InsertAssessment>): Promise<Assessment> {
  const [updated] = await db.update(assessments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(assessments.id, id))
    .returning();
  return updated;
}

// ── Assessment Sections ───────────────────────────────────────────────

export async function getAssessmentSections(assessmentId: string): Promise<AssessmentSection[]> {
  return db.select().from(assessmentSections)
    .where(eq(assessmentSections.assessmentId, assessmentId))
    .orderBy(assessmentSections.sectionOrder);
}

export async function getAssessmentSection(id: string): Promise<AssessmentSection | undefined> {
  const [section] = await db.select().from(assessmentSections).where(eq(assessmentSections.id, id));
  return section;
}

export async function updateAssessmentSection(
  id: string,
  data: Partial<InsertAssessmentSection>
): Promise<AssessmentSection> {
  const [updated] = await db.update(assessmentSections)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(assessmentSections.id, id))
    .returning();

  // Update the parent assessment's completed section count
  if (data.status === "complete") {
    const section = updated;
    const allSections = await getAssessmentSections(section.assessmentId);
    const completedCount = allSections.filter(s => s.status === "complete").length;
    await updateAssessment(section.assessmentId, {
      completedSections: completedCount,
      status: completedCount === allSections.length ? "complete" : "in_progress",
    } as Partial<InsertAssessment>);
  }

  return updated;
}

// ── Evidence Items ────────────────────────────────────────────────────

export async function createEvidenceItem(data: InsertEvidenceItem): Promise<EvidenceItem> {
  const [item] = await db.insert(evidenceItems).values(data).returning();
  return item;
}

export async function getEvidenceBySection(sectionId: string): Promise<EvidenceItem[]> {
  return db.select().from(evidenceItems)
    .where(eq(evidenceItems.sectionId, sectionId))
    .orderBy(desc(evidenceItems.collectedAt));
}

export async function getEvidenceByAssessment(assessmentId: string): Promise<EvidenceItem[]> {
  return db.select().from(evidenceItems)
    .where(eq(evidenceItems.assessmentId, assessmentId))
    .orderBy(desc(evidenceItems.collectedAt));
}

export async function updateEvidenceItem(id: string, data: Partial<InsertEvidenceItem>): Promise<EvidenceItem> {
  const [updated] = await db.update(evidenceItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(evidenceItems.id, id))
    .returning();
  return updated;
}

export async function deleteEvidenceItem(id: string): Promise<void> {
  await db.delete(evidenceItems).where(eq(evidenceItems.id, id));
}

// ── Risk Matrix ───────────────────────────────────────────────────────

export async function createRiskMatrixEntry(data: InsertRiskMatrixEntry): Promise<RiskMatrixEntry> {
  const [entry] = await db.insert(riskMatrixEntries).values(data).returning();
  return entry;
}

export async function getRiskMatrix(assessmentId: string): Promise<RiskMatrixEntry[]> {
  return db.select().from(riskMatrixEntries)
    .where(eq(riskMatrixEntries.assessmentId, assessmentId))
    .orderBy(desc(riskMatrixEntries.riskScore));
}

export async function updateRiskMatrixEntry(id: string, data: Partial<InsertRiskMatrixEntry>): Promise<RiskMatrixEntry> {
  const [updated] = await db.update(riskMatrixEntries)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(riskMatrixEntries.id, id))
    .returning();
  return updated;
}

export async function deleteRiskMatrixEntry(id: string): Promise<void> {
  await db.delete(riskMatrixEntries).where(eq(riskMatrixEntries.id, id));
}

/**
 * Auto-generate risk matrix entries from findings attached to an assessment's deal.
 * Maps finding severity to risk matrix entries with computed scores.
 */
export async function generateRiskMatrixFromFindings(
  assessmentId: string,
  findingsList: Array<{ id: string; severity: string; title: string; description: string | null; impactEstimate: string | null }>
): Promise<RiskMatrixEntry[]> {
  const results: RiskMatrixEntry[] = [];

  for (const finding of findingsList) {
    const severity = (finding.severity as RiskSeverity) || "medium";
    const likelihood: RiskLikelihood = severity === "critical" ? "likely"
      : severity === "high" ? "possible"
      : severity === "medium" ? "possible"
      : "unlikely";
    const riskScore = computeRiskScore(severity, likelihood);

    const entry = await createRiskMatrixEntry({
      assessmentId,
      findingId: finding.id,
      title: finding.title,
      description: finding.description,
      severity,
      likelihood,
      riskScore,
      capexEstimateLow: finding.impactEstimate ? parseInt(finding.impactEstimate, 10) || null : null,
      capexEstimateHigh: finding.impactEstimate ? Math.round((parseInt(finding.impactEstimate, 10) || 0) * 1.5) || null : null,
      status: "open",
      evidenceTag: "UNVERIFIED",
    });
    results.push(entry);
  }

  // Update overall risk rating on the assessment
  const overallRisk = computeOverallRisk(results);
  if (overallRisk) {
    await updateAssessment(assessmentId, { overallRiskRating: overallRisk } as Partial<InsertAssessment>);
  }

  return results;
}

// ── Assessment Tenant Data ────────────────────────────────────────────

export async function saveAssessmentTenantData(data: InsertAssessmentTenantData): Promise<AssessmentTenantData> {
  const [item] = await db.insert(assessmentTenantData).values(data).returning();
  return item;
}

export async function getAssessmentTenantData(assessmentId: string): Promise<AssessmentTenantData | undefined> {
  const [item] = await db.select().from(assessmentTenantData)
    .where(eq(assessmentTenantData.assessmentId, assessmentId));
  return item;
}

// ── Dashboard Metrics ─────────────────────────────────────────────────

export interface AssessmentDashboardMetrics {
  totalAssessments: number;
  assessmentsByStatus: Record<string, number>;
  riskDistribution: Record<string, number>;
  avgCompletionPct: number;
  totalCapexEstimateLow: number;
  totalCapexEstimateHigh: number;
  recentAssessments: Assessment[];
}

export async function getDashboardMetrics(tenantId: string): Promise<AssessmentDashboardMetrics> {
  const allAssessments = await getAssessmentsByTenant(tenantId);

  const assessmentsByStatus: Record<string, number> = {};
  const riskDistribution: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let totalCompletionPct = 0;

  for (const a of allAssessments) {
    assessmentsByStatus[a.status] = (assessmentsByStatus[a.status] || 0) + 1;
    if (a.overallRiskRating) {
      riskDistribution[a.overallRiskRating] = (riskDistribution[a.overallRiskRating] || 0) + 1;
    }
    const pct = a.totalSections ? ((a.completedSections ?? 0) / a.totalSections) * 100 : 0;
    totalCompletionPct += pct;
  }

  // Sum CapEx estimates across all open risk matrix entries
  let totalCapexLow = 0;
  let totalCapexHigh = 0;
  for (const a of allAssessments) {
    const matrix = await getRiskMatrix(a.id);
    for (const entry of matrix) {
      if (entry.status === "open" || entry.status === "in_progress") {
        totalCapexLow += entry.capexEstimateLow ?? 0;
        totalCapexHigh += entry.capexEstimateHigh ?? 0;
      }
    }
  }

  return {
    totalAssessments: allAssessments.length,
    assessmentsByStatus,
    riskDistribution,
    avgCompletionPct: allAssessments.length > 0 ? Math.round(totalCompletionPct / allAssessments.length) : 0,
    totalCapexEstimateLow: totalCapexLow,
    totalCapexEstimateHigh: totalCapexHigh,
    recentAssessments: allAssessments.slice(0, 5),
  };
}
