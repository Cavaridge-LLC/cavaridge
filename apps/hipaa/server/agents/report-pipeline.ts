/**
 * Report Pipeline
 *
 * Generates structured report content using the Report Generator agent.
 * Content is stored as JSON in assessment_reports for later rendering.
 */

import { ReportGeneratorAgent } from "@cavaridge/agents/report-generator";
import { createHipaaContext } from "./context";

const reportGenerator = new ReportGeneratorAgent({ appCode: "CVG-HIPAA" });

export async function runReportPipeline(
  tenantId: string,
  userId: string,
  reportType: string,
  assessmentData: {
    title: string;
    framework: string;
    totalControls: number;
    implemented: number;
    partial: number;
    notImplemented: number;
    findings: Array<{
      controlRef: string;
      controlName: string;
      category: string;
      riskLevel: string;
      findingDetail: string;
    }>;
  },
) {
  const context = createHipaaContext(tenantId, userId, {
    agentId: "report-pipeline",
    agentName: "HIPAA Report Pipeline",
  });

  const complianceRate = assessmentData.totalControls > 0
    ? Math.round((assessmentData.implemented / assessmentData.totalControls) * 100)
    : 0;

  const taskTypeMap: Record<string, "executive_summary" | "pillar_narrative" | "recommendations" | "consolidation"> = {
    executive_summary: "executive_summary",
    detailed: "pillar_narrative",
    gap_analysis: "recommendations",
    risk_register: "consolidation",
  };

  const output = await reportGenerator.runWithAudit({
    data: {
      taskType: taskTypeMap[reportType] ?? "executive_summary",
      systemPrompt: `Generate a ${reportType.replace("_", " ")} report for a HIPAA Security Rule risk assessment. Use professional healthcare compliance language. Do not include any actual PHI.`,
      userPrompt: `App: HIPAA Risk Assessment\nAssessment: ${assessmentData.title}\nFramework: ${assessmentData.framework}\nCompliance Rate: ${complianceRate}%\nControls: ${assessmentData.totalControls} total (${assessmentData.implemented} implemented, ${assessmentData.partial} partial, ${assessmentData.notImplemented} not implemented)\n\nTop findings:\n${assessmentData.findings.slice(0, 10).map(f => `[${f.riskLevel?.toUpperCase()}] ${f.controlRef} ${f.controlName} (${f.category}): ${f.findingDetail || "No detail provided"}`).join("\n")}`,
    },
    context,
  });

  return output.result;
}
