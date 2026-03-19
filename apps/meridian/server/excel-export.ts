import ExcelJS from "exceljs";
import { storage } from "./storage";
import { getBrandingForReport } from "./report-branding";

const LIFECYCLE_LABELS: Record<string, string> = {
  screening: "Screening",
  assessment: "Assessment",
  day1_readiness: "Day-1 Ready",
  integration: "Integration",
  monitoring: "Monitoring",
};

const letterGrade = (score: number): string => {
  if (score >= 4.5) return "A";
  if (score >= 4.0) return "A-";
  if (score >= 3.5) return "B+";
  if (score >= 3.0) return "B";
  if (score >= 2.5) return "B-";
  if (score >= 2.0) return "C+";
  if (score >= 1.5) return "C";
  if (score >= 1.0) return "D";
  return "F";
};

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const SEVERITY_FILLS: Record<string, string> = {
  CRITICAL: "FFFF0000",
  HIGH: "FFFF8C00",
  MEDIUM: "FFFFD700",
  LOW: "FF90EE90",
};

const formatBytes = (bytes: number | null): string => {
  if (!bytes) return "—";
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

function applyHeaderStyle(row: ExcelJS.Row, headerColor: string) {
  const argb = headerColor.replace("#", "FF");
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF333333" } },
    };
  });
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 50);
  });
}

function setupPrintLandscape(sheet: ExcelJS.Worksheet) {
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
}

export async function generateDealExcel(dealId: string): Promise<Buffer> {
  const deal = await storage.getDeal(dealId);
  if (!deal) throw new Error("Deal not found");

  const [pillars, findings, docs, techStack, baselines] = await Promise.all([
    storage.getPillarsByDeal(dealId).then(r => r || []),
    storage.getFindingsByDeal(dealId).then(r => r || []),
    storage.getDocumentsByDeal(dealId).then(r => r || []),
    storage.getTechStackByDeal(dealId).then(r => r || []),
    storage.getBaselineComparisonsByDeal(dealId).then(r => r || []),
  ]);

  let playbookPhases: any[] = [];
  let playbookTasks: any[] = [];
  try {
    playbookPhases = (await storage.getPlaybookPhasesByDeal(dealId)) || [];
    playbookTasks = (await storage.getPlaybookTasksByDeal(dealId)) || [];
  } catch {}

  const branding = await getBrandingForReport(deal.tenantId || "");
  const headerColor = branding.primaryColor || "#1a56db";

  const pillarMap: Record<string, string> = {};
  (pillars || []).forEach((p) => (pillarMap[p.id] = p.pillarName));

  const compositeScore = deal.compositeScore ? parseFloat(String(deal.compositeScore)) : 0;
  const compositeGrade = letterGrade(compositeScore / 20);
  const score5 = compositeScore / 20;

  const wb = new ExcelJS.Workbook();
  wb.creator = branding.companyName;
  wb.created = new Date();

  buildExecutiveSummary(wb, deal, pillars, findings, compositeScore, score5, compositeGrade, headerColor);
  buildFindingsRegister(wb, findings, pillarMap, headerColor);
  buildCostEstimates(wb, findings, baselines, playbookTasks, headerColor);
  buildDocumentInventory(wb, docs, headerColor);
  buildPillarDetail(wb, pillars, findings, docs, headerColor);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildExecutiveSummary(
  wb: ExcelJS.Workbook,
  deal: any,
  pillars: any[],
  findings: any[],
  compositeScore: number,
  score5: number,
  compositeGrade: string,
  headerColor: string
) {
  const ws = wb.addWorksheet("Executive Summary");
  setupPrintLandscape(ws);

  ws.getCell("A1").value = deal.targetName;
  ws.getCell("A1").font = { bold: true, size: 18 };
  ws.getCell("A2").value = `Assessment Date: ${new Date().toLocaleDateString()} | Lifecycle: ${LIFECYCLE_LABELS[(deal as any).lifecycleStage || "assessment"] || "Assessment"}`;
  ws.getCell("A2").font = { size: 11, color: { argb: "FF666666" } };

  ws.getCell("A4").value = "Overall Score";
  ws.getCell("A4").font = { bold: true, size: 14 };
  ws.getCell("B4").value = `${compositeScore.toFixed(1)} / 100 (${compositeGrade})`;
  ws.getCell("B4").font = { size: 14, bold: true };

  const pillarHeaderRow = 6;
  const headers = ["Pillar", "Score (1-5)", "Grade", "Evidence Count", "Confidence"];
  const hRow = ws.getRow(pillarHeaderRow);
  headers.forEach((h, i) => (hRow.getCell(i + 1).value = h));
  applyHeaderStyle(hRow, headerColor);

  const safePillars = pillars || [];
  safePillars.forEach((p, idx) => {
    const r = ws.getRow(pillarHeaderRow + 1 + idx);
    const pScore = p.score ? parseFloat(String(p.score)) : 0;
    r.getCell(1).value = p.pillarName;
    r.getCell(2).value = pScore;
    r.getCell(2).numFmt = "0.0";
    r.getCell(3).value = letterGrade(pScore);
    r.getCell(4).value = p.documentCount || 0;
    r.getCell(5).value = p.confidenceLabel || "insufficient";
  });

  const recRow = pillarHeaderRow + safePillars.length + 2;
  ws.getCell(`A${recRow}`).value = "Recommendation";
  ws.getCell(`A${recRow}`).font = { bold: true, size: 13 };
  const recText =
    compositeScore >= 80 ? "PROCEED — Low IT risk identified."
    : compositeScore >= 60 ? "PROCEED WITH CONDITIONS — Moderate IT risks require attention before close."
    : compositeScore >= 40 ? "PROCEED WITH CAUTION — Significant IT risks that need remediation planning."
    : "DO NOT PROCEED — Critical IT risks that may materially impact deal value.";
  ws.getCell(`A${recRow + 1}`).value = recText;

  const topRow = recRow + 3;
  ws.getCell(`A${topRow}`).value = "Top Findings by Severity";
  ws.getCell(`A${topRow}`).font = { bold: true, size: 13 };

  const sorted = [...(findings || [])].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  sorted.slice(0, 5).forEach((f, i) => {
    ws.getCell(`A${topRow + 1 + i}`).value = `[${f.severity}] ${f.title}`;
    ws.getCell(`A${topRow + 1 + i}`).font = { size: 10 };
  });

  autoWidth(ws);
}

function buildFindingsRegister(
  wb: ExcelJS.Workbook,
  findings: any[],
  pillarMap: Record<string, string>,
  headerColor: string
) {
  const ws = wb.addWorksheet("Findings Register");
  setupPrintLandscape(ws);

  const headers = [
    "Finding ID", "Title", "Pillar", "Severity", "Status",
    "Description", "Business Impact", "Remediation", "Timeline",
    "Est. Cost", "Evidence Source", "Confidence",
  ];

  const hRow = ws.getRow(1);
  headers.forEach((h, i) => (hRow.getCell(i + 1).value = h));
  applyHeaderStyle(hRow, headerColor);

  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  const safeFindings = findings || [];
  safeFindings.forEach((f, idx) => {
    const r = ws.getRow(idx + 2);
    r.getCell(1).value = f.id.slice(-8);
    r.getCell(2).value = f.title;
    r.getCell(3).value = pillarMap[f.pillarId || ""] || "—";
    r.getCell(4).value = f.severity;
    r.getCell(5).value = f.status;
    r.getCell(6).value = f.description || "—";
    r.getCell(7).value = f.impactEstimate || "—";
    r.getCell(8).value = f.remediationNotes || "—";
    r.getCell(9).value = "—";
    r.getCell(10).value = "—";
    r.getCell(11).value = f.sourceDocumentId ? `Doc ${f.sourceDocumentId.slice(-8)}` : `${f.sourceCount || 0} sources`;
    r.getCell(12).value = "—";

    const fill = SEVERITY_FILLS[f.severity];
    if (fill) {
      r.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      if (f.severity === "MEDIUM" || f.severity === "LOW") {
        r.getCell(4).font = { color: { argb: "FF000000" } };
      } else {
        r.getCell(4).font = { color: { argb: "FFFFFFFF" }, bold: true };
      }
    }
  });

  ws.autoFilter = { from: "A1", to: `L${safeFindings.length + 1}` };
  autoWidth(ws);
}

function buildCostEstimates(
  wb: ExcelJS.Workbook,
  findings: any[],
  baselines: any[],
  playbookTasks: any[],
  headerColor: string
) {
  const ws = wb.addWorksheet("Cost Estimates");
  setupPrintLandscape(ws);

  const HOURLY_RATE = 175;

  ws.getCell("A1").value = "Capital Expenditure (CapEx)";
  ws.getCell("A1").font = { bold: true, size: 13 };

  const capexHeaders = ["Item", "One-Time Cost", "Notes"];
  const capexHRow = ws.getRow(2);
  capexHeaders.forEach((h, i) => (capexHRow.getCell(i + 1).value = h));
  applyHeaderStyle(capexHRow, headerColor);

  let capexRow = 3;
  let totalCapex = 0;

  (baselines || []).filter((b) => b.estimatedCost).forEach((b) => {
    const r = ws.getRow(capexRow++);
    const cost = parseFloat(String(b.estimatedCost).replace(/[^0-9.]/g, "")) || 0;
    totalCapex += cost;
    r.getCell(1).value = b.standardName;
    r.getCell(2).value = cost;
    r.getCell(2).numFmt = "$#,##0";
    r.getCell(3).value = b.remediationNote || b.gapSeverity;
  });

  if (capexRow === 3) {
    const r = ws.getRow(capexRow++);
    r.getCell(1).value = "No CapEx items identified";
    r.getCell(1).font = { italic: true, color: { argb: "FF999999" } };
  }

  capexRow++;
  ws.getCell(`A${capexRow}`).value = "Operational Expenditure (OpEx)";
  ws.getCell(`A${capexRow}`).font = { bold: true, size: 13 };

  const opexHRow = ws.getRow(capexRow + 1);
  ["Item", "Monthly Cost", "Annual Cost", "Notes"].forEach((h, i) => (opexHRow.getCell(i + 1).value = h));
  applyHeaderStyle(opexHRow, headerColor);

  let opexRow = capexRow + 2;
  let totalAnnualOpex = 0;

  const safeTasks = playbookTasks || [];
  if (safeTasks.length > 0) {
    const taskHours = safeTasks.length * 8;
    const laborCost = taskHours * HOURLY_RATE;
    totalAnnualOpex += laborCost;
    const r = ws.getRow(opexRow++);
    r.getCell(1).value = `Integration Labor (${safeTasks.length} tasks × 8 hrs × $${HOURLY_RATE}/hr)`;
    r.getCell(2).value = Math.round(laborCost / 12);
    r.getCell(2).numFmt = "$#,##0";
    r.getCell(3).value = laborCost;
    r.getCell(3).numFmt = "$#,##0";
    r.getCell(4).value = "Estimated from playbook tasks";
  } else {
    const r = ws.getRow(opexRow++);
    r.getCell(1).value = "No OpEx items identified";
    r.getCell(1).font = { italic: true, color: { argb: "FF999999" } };
  }

  opexRow += 2;
  ws.getCell(`A${opexRow}`).value = "Summary";
  ws.getCell(`A${opexRow}`).font = { bold: true, size: 13 };

  const sumHRow = ws.getRow(opexRow + 1);
  ["Metric", "Amount"].forEach((h, i) => (sumHRow.getCell(i + 1).value = h));
  applyHeaderStyle(sumHRow, headerColor);

  const tco3yr = totalCapex + totalAnnualOpex * 3;
  [
    ["Total CapEx", totalCapex],
    ["Total Annual OpEx", totalAnnualOpex],
    ["3-Year TCO", tco3yr],
  ].forEach(([label, val], i) => {
    const r = ws.getRow(opexRow + 2 + i);
    r.getCell(1).value = label as string;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = val as number;
    r.getCell(2).numFmt = "$#,##0";
  });

  autoWidth(ws);
}

function buildDocumentInventory(
  wb: ExcelJS.Workbook,
  docs: any[],
  headerColor: string
) {
  const ws = wb.addWorksheet("Document Inventory");
  setupPrintLandscape(ws);

  const headers = ["Filename", "Classification", "Pillars", "Upload Date", "File Size", "Confidence"];
  const hRow = ws.getRow(1);
  headers.forEach((h, i) => (hRow.getCell(i + 1).value = h));
  applyHeaderStyle(hRow, headerColor);

  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  const safeDocs = docs || [];
  safeDocs.forEach((d, idx) => {
    const r = ws.getRow(idx + 2);
    r.getCell(1).value = d.filename;
    r.getCell(2).value = d.classification || "Unclassified";
    r.getCell(3).value = "—";
    r.getCell(4).value = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—";
    r.getCell(5).value = formatBytes(d.fileSize);
    r.getCell(6).value = d.extractionStatus || "pending";
  });

  ws.autoFilter = { from: "A1", to: `F${safeDocs.length + 1}` };
  autoWidth(ws);
}

function buildPillarDetail(
  wb: ExcelJS.Workbook,
  pillars: any[],
  findings: any[],
  docs: any[],
  headerColor: string
) {
  const ws = wb.addWorksheet("Pillar Detail");
  setupPrintLandscape(ws);

  let row = 1;

  const safePillarsDetail = pillars || [];
  const safeFindingsDetail = findings || [];
  safePillarsDetail.forEach((p) => {
    const pScore = p.score ? parseFloat(String(p.score)) : 0;
    const pFindings = safeFindingsDetail.filter((f) => f.pillarId === p.id);

    ws.getCell(`A${row}`).value = p.pillarName;
    ws.getCell(`A${row}`).font = { bold: true, size: 14 };
    row++;

    ws.getCell(`A${row}`).value = `Score: ${pScore.toFixed(1)} / 5.0 (${letterGrade(pScore)}) | Evidence: ${p.documentCount || 0} docs | Confidence: ${p.confidenceLabel || "insufficient"}`;
    ws.getCell(`A${row}`).font = { size: 10, color: { argb: "FF666666" } };
    row += 2;

    if (pFindings.length > 0) {
      const fhRow = ws.getRow(row);
      ["Severity", "Title", "Status", "Description"].forEach((h, i) => (fhRow.getCell(i + 1).value = h));
      applyHeaderStyle(fhRow, headerColor);
      row++;

      pFindings.forEach((f) => {
        const r = ws.getRow(row++);
        r.getCell(1).value = f.severity;
        r.getCell(2).value = f.title;
        r.getCell(3).value = f.status;
        r.getCell(4).value = f.description || "—";

        const fill = SEVERITY_FILLS[f.severity];
        if (fill) {
          r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
          if (f.severity === "CRITICAL" || f.severity === "HIGH") {
            r.getCell(1).font = { color: { argb: "FFFFFFFF" }, bold: true };
          }
        }
      });
    } else {
      ws.getCell(`A${row}`).value = "No findings for this pillar.";
      ws.getCell(`A${row}`).font = { italic: true, color: { argb: "FF999999" } };
      row++;
    }

    row += 2;
  });

  autoWidth(ws);
}
