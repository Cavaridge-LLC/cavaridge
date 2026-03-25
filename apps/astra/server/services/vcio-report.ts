/**
 * vCIO Report Service — CVG-ASTRA
 *
 * Generates combined license optimization + security posture reports.
 * Cross-references with AEGIS IAR data for unified vCIO deliverables.
 */

import { createSpanielClient } from "@cavaridge/spaniel";
import type {
  VCIOReportData,
  WasteFinding,
  OptimizationRecommendation,
  IARRiskFlag,
} from "../types/index.js";

const APP_CODE = "CVG-ASTRA";
const spanielClient = createSpanielClient(APP_CODE);

export interface VCIOReportOutput {
  title: string;
  content: string;
  sections: VCIOSection[];
  generatedAt: Date;
}

export interface VCIOSection {
  heading: string;
  content: string;
  order: number;
}

/**
 * Generate a comprehensive vCIO report combining license and security data.
 */
export async function generateVCIOReport(
  data: VCIOReportData,
): Promise<VCIOReportOutput> {
  const { licenseData, iarData } = data;

  const systemPrompt = `You are a senior vCIO consultant delivering a combined Microsoft 365 license optimization and security posture report via the Ducky Intelligence platform (by Cavaridge).

Write a professional, data-driven executive briefing in Markdown format.

The report MUST include these sections:
1. Executive Summary — 3-4 sentences highlighting key findings and savings
2. License Optimization Analysis — waste findings, recommendations, projected savings
3. ${iarData ? "Security Posture Cross-Reference — AEGIS IAR findings correlated with license data" : "Security Considerations — license-related security observations"}
4. Implementation Roadmap — phased approach (Quick Wins → Strategic Changes → Monitoring)
5. Financial Summary — current spend, projected spend, total savings, 3-year impact
6. Recommended Next Steps — prioritized action items

Rules:
- Reference specific users by name when discussing recommendations
- All dollar figures precise to 2 decimal places
- Use Markdown tables for financial comparisons
- Tone: authoritative but accessible, board-ready
- Every claim backed by data from the analysis`;

  const userPrompt = buildReportPrompt(data);

  const sections: VCIOSection[] = [];

  // Try AI generation; fall back to deterministic template
  try {
    if (process.env.OPENROUTER_API_KEY) {
      const response = await spanielClient.chat.completions.create({
        model: "anthropic/claude-sonnet-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content ?? "";
      return {
        title: `M365 License Optimization — vCIO Report`,
        content,
        sections: parseMarkdownSections(content),
        generatedAt: new Date(),
      };
    }
  } catch (err) {
    console.error("[vcio-report] AI generation failed, using template:", err);
  }

  // Deterministic fallback
  return buildDeterministicReport(data);
}

// ── Prompt Builder ──────────────────────────────────────────────────

function buildReportPrompt(data: VCIOReportData): string {
  const { licenseData, iarData } = data;
  const lines: string[] = [];

  lines.push("=== LICENSE DATA ===");
  lines.push(`Total Users: ${licenseData.totalUsers}`);
  lines.push(`Current Monthly Spend: $${licenseData.totalMonthlyCost.toFixed(2)}`);
  lines.push(`Current Annual Spend: $${(licenseData.totalMonthlyCost * 12).toFixed(2)}`);
  lines.push(`Waste Findings: ${licenseData.wasteFindings.length}`);
  lines.push(`Total Identified Savings: $${licenseData.totalSavings.monthly.toFixed(2)}/mo ($${licenseData.totalSavings.annual.toFixed(2)}/yr)`);
  lines.push("");

  lines.push("=== WASTE FINDINGS ===");
  for (const f of licenseData.wasteFindings.slice(0, 30)) {
    lines.push(`- ${f.userDisplayName} | ${f.category} | ${f.severity} | $${f.currentMonthlyCost}/mo | ${f.description}`);
  }
  lines.push("");

  lines.push("=== RECOMMENDATIONS ===");
  for (const r of licenseData.recommendations.slice(0, 30)) {
    lines.push(`- ${r.userDisplayName} | ${r.type} | ${r.currentLicenses.join(", ")} → ${r.recommendedLicenses.join(", ")} | Saves $${r.monthlySavings.toFixed(2)}/mo | ${r.rationale}`);
  }

  if (iarData) {
    lines.push("");
    lines.push("=== AEGIS IAR SECURITY DATA ===");
    lines.push(`Security Score: ${iarData.securityScore}`);
    lines.push(`Last Review: ${iarData.lastReviewDate.toISOString()}`);
    lines.push(`Risk Flags: ${iarData.riskFlags.length}`);
    for (const flag of iarData.riskFlags.slice(0, 20)) {
      lines.push(`- ${flag.userPrincipalName} | ${flag.flagType} | ${flag.severity} | ${flag.description}${flag.suppressed ? " (SUPPRESSED)" : ""}`);
    }
  }

  return lines.join("\n");
}

// ── Deterministic Fallback ──────────────────────────────────────────

function buildDeterministicReport(data: VCIOReportData): VCIOReportOutput {
  const { licenseData, iarData } = data;
  const sections: VCIOSection[] = [];
  const lines: string[] = [];

  // Executive Summary
  lines.push("# M365 License Optimization — vCIO Report");
  lines.push("");
  lines.push(`*Generated: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}*`);
  lines.push("*Prepared by: Ducky Intelligence — Powered by Cavaridge*");
  lines.push("");

  lines.push("## 1. Executive Summary");
  lines.push("");
  lines.push(`Analysis of ${licenseData.totalUsers} licensed users identified **$${licenseData.totalSavings.monthly.toFixed(2)}/month** ($${licenseData.totalSavings.annual.toFixed(2)}/year) in optimization opportunities across ${licenseData.wasteFindings.length} findings. Current monthly spend is $${licenseData.totalMonthlyCost.toFixed(2)}.`);
  lines.push("");

  sections.push({ heading: "Executive Summary", content: lines.slice(5).join("\n"), order: 1 });

  // Waste Analysis
  lines.push("## 2. License Optimization Analysis");
  lines.push("");
  lines.push("| Category | Count | Est. Monthly Waste |");
  lines.push("|----------|-------|--------------------|");

  const byCat: Record<string, { count: number; cost: number }> = {};
  for (const f of licenseData.wasteFindings) {
    if (!byCat[f.category]) byCat[f.category] = { count: 0, cost: 0 };
    byCat[f.category].count++;
    byCat[f.category].cost += f.estimatedWastedCost;
  }
  for (const [cat, info] of Object.entries(byCat)) {
    lines.push(`| ${cat} | ${info.count} | $${info.cost.toFixed(2)} |`);
  }
  lines.push("");

  // Recommendations
  lines.push("## 3. Recommendations");
  lines.push("");
  lines.push("| User | Action | Current | Recommended | Monthly Savings |");
  lines.push("|------|--------|---------|-------------|-----------------|");
  for (const r of licenseData.recommendations.slice(0, 20)) {
    lines.push(`| ${r.userDisplayName} | ${r.type} | ${r.currentLicenses.join(", ")} | ${r.recommendedLicenses.join(", ") || "Remove all"} | $${r.monthlySavings.toFixed(2)} |`);
  }
  lines.push("");

  // IAR Cross-reference
  if (iarData) {
    lines.push("## 4. Security Posture Cross-Reference (AEGIS IAR)");
    lines.push("");
    lines.push(`Security Score: **${iarData.securityScore}** | Last Review: ${iarData.lastReviewDate.toISOString().split("T")[0]}`);
    lines.push("");
    if (iarData.riskFlags.length > 0) {
      lines.push("| User | Risk Flag | Severity | License Impact |");
      lines.push("|------|-----------|----------|----------------|");
      for (const flag of iarData.riskFlags.filter(f => !f.suppressed).slice(0, 15)) {
        const licenseRec = licenseData.recommendations.find(r => r.userPrincipalName === flag.userPrincipalName);
        const impact = licenseRec ? `${licenseRec.type}: saves $${licenseRec.monthlySavings.toFixed(2)}/mo` : "No license change needed";
        lines.push(`| ${flag.userPrincipalName} | ${flag.flagType} | ${flag.severity} | ${impact} |`);
      }
    }
    lines.push("");
  }

  // Financial Summary
  lines.push("## 5. Financial Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Current Monthly Spend | $${licenseData.totalMonthlyCost.toFixed(2)} |`);
  lines.push(`| Projected Monthly Spend | $${(licenseData.totalMonthlyCost - licenseData.totalSavings.monthly).toFixed(2)} |`);
  lines.push(`| Monthly Savings | $${licenseData.totalSavings.monthly.toFixed(2)} |`);
  lines.push(`| Annual Savings | $${licenseData.totalSavings.annual.toFixed(2)} |`);
  lines.push(`| 3-Year Projected Savings | $${(licenseData.totalSavings.annual * 3).toFixed(2)} |`);
  lines.push("");

  lines.push("---");
  lines.push("*Powered by Ducky Intelligence.*");

  const content = lines.join("\n");

  return {
    title: "M365 License Optimization — vCIO Report",
    content,
    sections,
    generatedAt: new Date(),
  };
}

// ── Markdown Section Parser ─────────────────────────────────────────

function parseMarkdownSections(content: string): VCIOSection[] {
  const sections: VCIOSection[] = [];
  const parts = content.split(/^## /m);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const newlineIdx = part.indexOf("\n");
    const heading = newlineIdx > 0 ? part.slice(0, newlineIdx).trim() : part.trim();
    const body = newlineIdx > 0 ? part.slice(newlineIdx + 1).trim() : "";
    sections.push({ heading, content: body, order: i });
  }

  return sections;
}
