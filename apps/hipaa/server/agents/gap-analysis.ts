/**
 * Gap Analysis Pipeline
 *
 * ComplianceCheckerAgent → RiskScorerAgent → ReportGeneratorAgent
 * Analyzes assessment controls to identify compliance gaps and score risks.
 */

import { ComplianceCheckerAgent } from "@cavaridge/agents/compliance-checker";
import { RiskScorerAgent } from "@cavaridge/agents/risk-scorer";
import { createHipaaContext } from "./context";
import { db } from "../db";
import { assessmentControls } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const complianceChecker = new ComplianceCheckerAgent({ appCode: "CVG-HIPAA" });
const riskScorer = new RiskScorerAgent({ appCode: "CVG-HIPAA" });

export async function runGapAnalysis(tenantId: string, userId: string, assessmentId: string) {
  const context = createHipaaContext(tenantId, userId, {
    agentId: "gap-analysis",
    agentName: "HIPAA Gap Analysis Pipeline",
  });

  // Load controls — tenant-scoped for defense-in-depth
  const controls = await db.select().from(assessmentControls)
    .where(and(eq(assessmentControls.assessmentId, assessmentId), eq(assessmentControls.tenantId, tenantId)));

  if (controls.length === 0) {
    return { gaps: [], score: { compositeScore: 0, riskLevel: "low" as const } };
  }

  // Step 1: Compliance check
  const currentState = controls.map(c => ({
    controlRef: c.controlRef,
    controlName: c.controlName,
    category: c.category,
    currentState: c.currentState,
    findingDetail: c.findingDetail || "",
    riskScore: c.riskScore || 0,
  }));

  const complianceResult = await complianceChecker.runWithAudit({
    data: {
      standardName: "HIPAA Security Rule (45 CFR 164.308-312)",
      currentState: currentState as any,
      systemPrompt: "Analyze the following HIPAA Security Rule assessment controls. Identify compliance gaps where controls are 'not_implemented' or 'partial'. For each gap, specify the category, current state, expected state (fully implemented per HIPAA requirements), severity (critical/high/medium/low), and remediation notes. Return JSON with gaps array, summary, and overallCompliance percentage.",
      userPrompt: `Assessment has ${controls.length} controls. Current state breakdown: ${controls.filter(c => c.currentState === "implemented").length} implemented, ${controls.filter(c => c.currentState === "partial").length} partial, ${controls.filter(c => c.currentState === "not_implemented").length} not implemented.\n\nControls:\n${currentState.map(c => `[${c.category}] ${c.controlRef} ${c.controlName}: ${c.currentState}${c.findingDetail ? ` - ${c.findingDetail}` : ""}`).join("\n")}`,
    },
    context,
  });

  // Step 2: Risk scoring
  const findings = controls
    .filter(c => c.currentState !== "implemented")
    .map(c => ({
      title: `${c.controlRef} ${c.controlName}`,
      severity: c.riskLevel || "medium",
      pillar: c.category,
      description: c.findingDetail || "",
    }));

  const riskResult = await riskScorer.runWithAudit({
    data: {
      findings,
      weights: { administrative: 0.4, physical: 0.25, technical: 0.35 },
      generateNarrative: true,
      systemPrompt: "Generate a concise risk narrative for a HIPAA Security Rule assessment. Highlight the most critical gaps and their potential impact on ePHI security. Focus on actionable insights.",
    },
    context,
  });

  return {
    gaps: complianceResult.result.gaps,
    complianceSummary: complianceResult.result.summary,
    overallCompliance: complianceResult.result.overallCompliance,
    score: riskResult.result,
  };
}
