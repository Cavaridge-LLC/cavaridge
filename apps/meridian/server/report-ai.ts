import { chatCompletion, hasAICapability } from "./openrouter";

export interface ConsolidatedFinding {
  title: string;
  severity: string;
  description: string;
  evidence_count: number;
  source_images: string[];
  business_impact: string;
  remediation: string;
  estimated_cost: string;
  original_finding_ids: string[];
}

export interface ConsolidationResult {
  consolidated_findings: ConsolidatedFinding[];
  total_original: number;
  total_consolidated: number;
}

export interface ExecutiveSummary {
  investment_verdict?: string;
  verdict_reasoning?: string;
  key_risk_findings?: string[];
  conditions_before_close?: string[];
  positive_observations?: string[];
  estimated_total_cost?: string;
  estimated_timeline?: string;
  overall_risk_level?: string;
  target_profile?: string;
  cost_timeline_snapshot?: string;
  evidence_confidence_warning?: string;
}

export interface PillarNarrative {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
}

export async function consolidateFindings(findings: any[]): Promise<ConsolidationResult | null> {
  if (!hasAICapability()) return null;
  if (!findings.length) return null;

  try {
    const findingsList = findings.map((f, i) => ({
      id: f.id,
      index: i + 1,
      title: f.title,
      severity: f.severity,
      description: f.description,
      pillar: f.pillar,
      businessImpact: f.businessImpact,
      remediation: f.remediation,
      estimatedCost: f.estimatedCost,
    }));

    const responseText = await chatCompletion({
      task: "reportGeneration",
      maxTokens: 4096,
      system: `You are an expert IT due diligence analyst consolidating findings for an investment committee report.

Group related findings together, merge duplicates, and create a consolidated register.

For each consolidated finding, provide:
{
  "title": "Clear, professional title",
  "severity": "critical|high|medium|low",
  "description": "Comprehensive description combining all related findings",
  "evidence_count": <number of original findings merged>,
  "source_images": [],
  "business_impact": "How this affects the deal and business operations",
  "remediation": "Recommended remediation steps",
  "estimated_cost": "Cost estimate for remediation",
  "original_finding_ids": ["id1", "id2"]
}

Respond with JSON only:
{
  "consolidated_findings": [...],
  "total_original": <number>,
  "total_consolidated": <number>
}`,
      messages: [
        { role: "user", content: `Consolidate these ${findings.length} findings:\n\n${JSON.stringify(findingsList, null, 2)}` },
      ],
    });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as ConsolidationResult;
  } catch (err: any) {
    console.error("[report-ai] Consolidation failed:", err.message);
    return null;
  }
}

export async function generateExecutiveSummary(
  deal: any,
  consolidatedFindings: ConsolidatedFinding[],
  pillars: any[],
  techStack: any[],
  comparisons: any[],
  phases: any[],
): Promise<ExecutiveSummary | null> {
  if (!hasAICapability()) return null;

  try {
    const pillarSummary = pillars.map(p => `${p.name}: ${p.score}/5.0 (${p.evidenceConfidence || "unknown"} confidence)`).join("\n");
    const findingSummary = consolidatedFindings.slice(0, 10).map(f => `[${f.severity.toUpperCase()}] ${f.title}`).join("\n");
    const techCount = techStack.length;
    const gapCount = comparisons.filter(c => c.gapSeverity === "critical" || c.gapSeverity === "high").length;

    const responseText = await chatCompletion({
      task: "reportGeneration",
      maxTokens: 2048,
      system: `You are a senior IT due diligence advisor writing an executive summary for an investment committee.

Based on the deal data, provide a concise executive assessment.

Respond with JSON only:
{
  "investment_verdict": "PROCEED|PROCEED WITH CONDITIONS|CAUTION|DO NOT PROCEED",
  "verdict_reasoning": "2-3 sentence justification",
  "key_risk_findings": ["finding 1", "finding 2", ...up to 7],
  "conditions_before_close": ["condition 1", "condition 2", "condition 3"],
  "positive_observations": ["observation 1", "observation 2"],
  "estimated_total_cost": "$X-Y range",
  "estimated_timeline": "X-Y months",
  "overall_risk_level": "Low|Medium|High|Critical"
}`,
      messages: [
        {
          role: "user",
          content: `Deal: ${deal.targetName} (${deal.industry})
Stage: ${deal.stage}
Facilities: ${deal.facilityCount || 0}, Users: ${deal.userCount || 0}

Pillar Scores:
${pillarSummary}

Key Findings (${consolidatedFindings.length} total):
${findingSummary}

Tech Stack: ${techCount} items detected
Baseline Gaps: ${gapCount} critical/high gaps
Integration Phases: ${phases.length} planned`,
        },
      ],
    });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as ExecutiveSummary;
  } catch (err: any) {
    console.error("[report-ai] Executive summary generation failed:", err.message);
    return null;
  }
}

export async function generatePillarNarrative(
  pillar: any,
  findings: any[],
  techStack: any[],
): Promise<PillarNarrative | null> {
  if (!hasAICapability()) return null;

  try {
    const pillarFindings = findings.filter(f => f.pillar === pillar.name);
    const findingSummary = pillarFindings.slice(0, 8).map(f => `[${f.severity?.toUpperCase()}] ${f.title}: ${(f.description || "").slice(0, 200)}`).join("\n");

    const relevantTech = techStack.filter(t => {
      const cat = (t.category || "").toLowerCase();
      const pname = (pillar.name || "").toLowerCase();
      if (pname.includes("infrastructure")) return ["networking", "endpoints", "cloud services", "telephony", "backup & dr"].some(c => cat.includes(c.toLowerCase()));
      if (pname.includes("security") || pname.includes("cyber")) return ["security", "identity & access"].some(c => cat.includes(c.toLowerCase()));
      return false;
    });

    const techSummary = relevantTech.slice(0, 10).map(t => `${t.productName} (${t.category})`).join(", ");

    const responseText = await chatCompletion({
      task: "reportGeneration",
      maxTokens: 1500,
      system: `You are an IT due diligence analyst writing a pillar assessment narrative.

Respond with JSON only:
{
  "summary": "2-3 paragraph narrative assessment of this pillar",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`,
      messages: [
        {
          role: "user",
          content: `Pillar: ${pillar.name}
Score: ${pillar.score}/5.0
Weight: ${pillar.weight}
Evidence Confidence: ${pillar.evidenceConfidence || "unknown"}

Findings (${pillarFindings.length}):
${findingSummary || "No findings recorded"}

Related Technology: ${techSummary || "None detected"}`,
        },
      ],
    });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as PillarNarrative;
  } catch (err: any) {
    console.error("[report-ai] Pillar narrative failed:", err.message);
    return null;
  }
}

export async function generateRecommendations(
  deal: any,
  findings: any[],
  pillars: any[],
  techStack: any[],
  comparisons: any[],
): Promise<string[] | null> {
  if (!hasAICapability()) return null;

  try {
    const criticalFindings = findings.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 5);
    const lowPillars = pillars.filter(p => parseFloat(p.score) < 3.0).map(p => p.name);
    const criticalGaps = comparisons.filter(c => c.gapSeverity === "critical").slice(0, 3);

    const responseText = await chatCompletion({
      task: "reportGeneration",
      maxTokens: 1500,
      system: `You are a senior IT due diligence advisor providing actionable recommendations for an M&A deal.

Provide 5-8 prioritized recommendations based on the findings.

Respond with JSON only:
{
  "recommendations": ["recommendation 1", "recommendation 2", ...]
}`,
      messages: [
        {
          role: "user",
          content: `Deal: ${deal.targetName}
Critical/High Findings: ${criticalFindings.map(f => f.title).join(", ") || "None"}
Low-scoring Pillars: ${lowPillars.join(", ") || "None"}
Critical Baseline Gaps: ${criticalGaps.map(g => g.category).join(", ") || "None"}
Tech Stack Size: ${techStack.length} items`,
        },
      ],
    });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.recommendations || null;
  } catch (err: any) {
    console.error("[report-ai] Recommendations failed:", err.message);
    return null;
  }
}
