import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  PageBreak, TableOfContents, Header, Footer, PageNumber, NumberFormat,
  Tab, TabStopType, TabStopPosition,
  type ITableCellOptions, type IParagraphOptions,
} from "docx";
import { storage } from "./storage";
import {
  consolidateFindings,
  generateExecutiveSummary,
  generatePillarNarrative,
  type ConsolidatedFinding,
  type ExecutiveSummary,
  type PillarNarrative,
} from "./report-ai";
import { getBrandingForReport, type ReportBranding } from "./report-branding";

const COLORS = {
  primary: "3B82F6",
  success: "10B981",
  warning: "F59E0B",
  danger: "EF4444",
  purple: "8B5CF6",
  dark: "1A1D23",
  text: "1a1a2e",
  textSecondary: "334155",
  muted: "6B7280",
  light: "F3F4F6",
  lightBorder: "e2e8f0",
  tableStripe: "fafafa",
  cyan: "06B6D4",
  white: "FFFFFF",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: COLORS.danger,
  high: "DC2626",
  medium: COLORS.warning,
  low: COLORS.primary,
  info: COLORS.muted,
};

const GAP_COLORS: Record<string, string> = {
  critical: COLORS.danger,
  high: "DC2626",
  medium: COLORS.warning,
  low: COLORS.primary,
  aligned: COLORS.success,
};

const CONFIDENCE_COLORS: Record<string, string> = {
  insufficient: COLORS.muted,
  low: COLORS.warning,
  moderate: COLORS.primary,
  high: COLORS.success,
};

function scoreColor(score: number): string {
  if (score >= 4.0) return COLORS.success;
  if (score >= 3.0) return COLORS.warning;
  return COLORS.danger;
}

function riskLabel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: "INSUFFICIENT DATA", color: COLORS.muted };
  const pct = (score / 5.0) * 100;
  if (pct >= 80) return { label: "LOW RISK", color: COLORS.success };
  if (pct >= 60) return { label: "MODERATE RISK", color: COLORS.warning };
  return { label: "HIGH RISK", color: COLORS.danger };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function csvEscape(val: string | null | undefined): string {
  if (val == null) return "";
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

function makeCell(text: string, opts?: {
  bold?: boolean; color?: string; shading?: string; width?: number;
  font?: string; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  columnSpan?: number;
}): TableCell {
  const cellOpts: ITableCellOptions = {
    children: [
      new Paragraph({
        alignment: opts?.alignment,
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            color: opts?.color || COLORS.text,
            font: opts?.font || "Calibri",
            size: opts?.size || 18,
          }),
        ],
      }),
    ],
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts?.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
    columnSpan: opts?.columnSpan,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  };
  return new TableCell(cellOpts);
}

function makeHeaderCell(text: string, width?: number): TableCell {
  return makeCell(text, { bold: true, color: COLORS.text, shading: COLORS.light, width, size: 18 });
}

function makeTable(headers: { text: string; width?: number }[], rows: { text: string; color?: string; bold?: boolean }[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(h => makeHeaderCell(h.text, h.width)),
    tableHeader: true,
  });

  const dataRows = rows.map((row, rowIdx) =>
    new TableRow({
      children: row.map((cell, colIdx) =>
        makeCell(cell.text, {
          color: cell.color,
          bold: cell.bold,
          width: headers[colIdx]?.width,
          shading: rowIdx % 2 === 1 ? COLORS.tableStripe : undefined,
        })
      ),
    })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function sectionHeading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1, color?: string): Paragraph {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 200 },
    children: [
      new TextRun({
        text,
        bold: true,
        color: color || COLORS.text,
        font: "Calibri",
        size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22,
      }),
    ],
  });
}

function bodyText(text: string, opts?: { color?: string; bold?: boolean; italic?: boolean; size?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        color: opts?.color || COLORS.text,
        bold: opts?.bold,
        italics: opts?.italic,
        font: "Calibri",
        size: opts?.size || 20,
      }),
    ],
  });
}

function bulletPoint(text: string, color?: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    bullet: { level: 0 },
    children: [
      new TextRun({
        text,
        color: color || COLORS.text,
        font: "Calibri",
        size: 20,
      }),
    ],
  });
}

function calloutBox(text: string, borderColor: string): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 150 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
    },
    shading: { type: ShadingType.SOLID, color: "f8fafc" },
    indent: { left: 200 },
    children: [
      new TextRun({
        text,
        color: COLORS.text,
        font: "Calibri",
        size: 20,
      }),
    ],
  });
}

function severityBadgeText(severity: string): TextRun {
  const color = SEVERITY_COLORS[severity] || COLORS.muted;
  return new TextRun({
    text: `[${severity.toUpperCase()}]`,
    bold: true,
    color,
    font: "Calibri",
    size: 18,
  });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

export type ProgressCallback = (step: number, total: number, label: string) => void;

function getCopyrightText(branding: ReportBranding, orgName?: string): string {
  if (branding.reportFooterText && branding.reportFooterText !== "Prepared by MERIDIAN") {
    return branding.reportFooterText;
  }
  const year = new Date().getFullYear();
  const name = orgName || branding.companyName || "MERIDIAN";
  return `\u00A9 ${year} ${name}. All rights reserved.`;
}

export async function generateDealDOCX(dealId: string, onProgress?: ProgressCallback): Promise<Buffer> {
  const progress = onProgress || (() => {});

  progress(1, 9, "Compiling deal data...");
  const deal = await storage.getDeal(dealId);
  if (!deal) throw new Error("Deal not found");

  let org: any = null;
  let branding: ReportBranding;
  try {
    if (deal.tenantId) {
      org = await storage.getOrganization(deal.tenantId);
      branding = await getBrandingForReport(deal.tenantId);
    } else {
      branding = await getBrandingForReport("");
    }
  } catch {
    branding = await getBrandingForReport("");
  }
  const copyrightText = getCopyrightText(branding, org?.name);

  const [pillars, findings, documents, techStack, comparisons, phases, tasks, nodes, connections] = await Promise.all([
    storage.getPillarsByDeal(dealId),
    storage.getFindingsByDeal(dealId),
    storage.getDocumentsByDeal(dealId),
    storage.getTechStackByDeal(dealId),
    storage.getBaselineComparisonsByDeal(dealId),
    storage.getPlaybookPhasesByDeal(dealId),
    storage.getPlaybookTasksByDeal(dealId),
    storage.getTopologyNodesByDeal(dealId),
    storage.getTopologyConnectionsByDeal(dealId),
  ]);

  progress(2, 9, "Consolidating findings...");
  const consolidation = await consolidateFindings(findings);
  const consolidated = consolidation?.consolidated_findings || findings.map(f => ({
    title: f.title,
    severity: f.severity,
    description: f.description || "",
    evidence_count: f.sourceCount || 1,
    source_images: f.sourceDocuments || [],
    business_impact: f.impactEstimate || "",
    remediation: f.remediationNotes || "",
    estimated_cost: "",
    original_finding_ids: [f.id],
  }));

  progress(3, 9, "Writing executive summary...");
  const [execSummary, ...pillarNarratives] = await Promise.all([
    generateExecutiveSummary(deal, consolidated, pillars, techStack, comparisons, phases),
    ...pillars.map(p => {
      const pillarFindings = consolidated.filter(cf => {
        const matchingOriginal = findings.filter(f => cf.original_finding_ids.includes(f.id));
        return matchingOriginal.some(f => f.pillarId === p.id);
      });
      return generatePillarNarrative(p, pillarFindings.length > 0 ? pillarFindings : consolidated.slice(0, 5), techStack, comparisons);
    }),
  ]);

  progress(4, 9, "Analyzing risk pillars...");

  const compositeScore = deal.compositeScore ? Number(deal.compositeScore) : null;
  const compositeScoreOf5 = compositeScore !== null ? compositeScore / 20 : null;
  const risk = riskLabel(compositeScoreOf5);
  const criticalFindings = consolidated.filter(f => f.severity === "critical");
  const highFindings = consolidated.filter(f => f.severity === "high");
  const mediumFindings = consolidated.filter(f => f.severity === "medium");
  const lowFindings = consolidated.filter(f => f.severity === "low" || f.severity === "info");

  progress(5, 9, "Assessing technology stack...");
  progress(6, 9, "Building integration roadmap...");
  progress(7, 9, "Generating recommendations...");
  progress(8, 9, "Assembling report layout...");

  const DN = deal.targetName;
  const sections: (Paragraph | Table | TableOfContents)[] = [];

  sections.push(
    new Paragraph({ spacing: { before: 2000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "MERIDIAN", font: "Calibri", size: 28, color: COLORS.primary, bold: true, characterSpacing: 120 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: "M&A IT Intelligence Platform", font: "Calibri", size: 20, color: COLORS.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "IT Due Diligence", font: "Calibri", size: 56, bold: true, color: COLORS.text })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: "Assessment Report", font: "Calibri", size: 56, bold: true, color: COLORS.primary })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: deal.targetName, font: "Calibri", size: 40, bold: true, color: COLORS.text })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: `${deal.industry || "Technology"} Sector`, font: "Calibri", size: 22, color: COLORS.muted })],
    }),
  );

  const coverTable = new Table({
    rows: [
      new TableRow({
        children: [
          makeCell("Deal Code", { bold: true, color: COLORS.muted, size: 16 }),
          makeCell(deal.dealCode, { size: 20 }),
          makeCell("Stage", { bold: true, color: COLORS.muted, size: 16 }),
          makeCell(deal.stage || "Assessment", { size: 20 }),
        ],
      }),
      new TableRow({
        children: [
          makeCell("Prepared For", { bold: true, color: COLORS.muted, size: 16 }),
          makeCell(org?.name || "Organization", { size: 20 }),
          makeCell("Date", { bold: true, color: COLORS.muted, size: 16 }),
          makeCell(formatDate(new Date()), { size: 20 }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
  sections.push(coverTable);

  sections.push(
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [
        new TextRun({ text: `Findings: ${findings.length}`, font: "Calibri", size: 20, color: COLORS.warning, bold: true }),
        new TextRun({ text: "  |  ", font: "Calibri", size: 20, color: COLORS.muted }),
        new TextRun({ text: `Documents: ${documents.length}`, font: "Calibri", size: 20, color: COLORS.primary, bold: true }),
        new TextRun({ text: "  |  ", font: "Calibri", size: 20, color: COLORS.muted }),
        new TextRun({ text: `Tech Items: ${techStack.length}`, font: "Calibri", size: 20, color: COLORS.cyan, bold: true }),
        new TextRun({ text: "  |  ", font: "Calibri", size: 20, color: COLORS.muted }),
        new TextRun({ text: `Pillars: ${pillars.length}`, font: "Calibri", size: 20, color: COLORS.purple, bold: true }),
      ],
    }),
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "CONFIDENTIAL — This document contains proprietary information. Unauthorized distribution is prohibited.", font: "Calibri", size: 16, color: COLORS.muted, italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: copyrightText, font: "Calibri", size: 16, color: COLORS.muted })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
      children: [new TextRun({ text: "Table of Contents", font: "Calibri", size: 36, bold: true, color: COLORS.text })],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  sections.push(sectionHeading("1. Executive Summary", HeadingLevel.HEADING_1, COLORS.primary));

  const scoreDisplay = compositeScoreOf5 !== null ? compositeScoreOf5.toFixed(1) : "N/A";
  sections.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Composite Score: ${scoreDisplay} / 5.0`, font: "Calibri", size: 28, bold: true, color: risk.color }),
        new TextRun({ text: `  (${compositeScore !== null ? compositeScore.toFixed(1) : "N/A"}/100)`, font: "Calibri", size: 22, color: COLORS.muted }),
        new TextRun({ text: `    ${risk.label}`, font: "Calibri", size: 24, bold: true, color: risk.color }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Confidence: ${(deal.overallConfidence || "insufficient").toUpperCase()}`, font: "Calibri", size: 20, color: COLORS.muted }),
      ],
    }),
  );

  const sevSummary = new Table({
    rows: [
      new TableRow({
        children: [
          makeHeaderCell("Severity"),
          makeHeaderCell("Count"),
        ],
      }),
      ...[
        { label: "Critical", count: criticalFindings.length, color: COLORS.danger },
        { label: "High", count: highFindings.length, color: "DC2626" },
        { label: "Medium", count: mediumFindings.length, color: COLORS.warning },
        { label: "Low / Info", count: lowFindings.length, color: COLORS.primary },
      ].map(s =>
        new TableRow({
          children: [
            makeCell(s.label, { bold: true, color: s.color }),
            makeCell(String(s.count), { bold: true, color: s.color }),
          ],
        })
      ),
    ],
    width: { size: 40, type: WidthType.PERCENTAGE },
  });
  sections.push(sevSummary, spacer());

  if (execSummary) {
    sections.push(
      sectionHeading("Investment Verdict", HeadingLevel.HEADING_2),
      calloutBox(execSummary.investment_verdict || "Assessment Pending", risk.color),
    );

    if (execSummary.target_profile) {
      sections.push(
        sectionHeading("Target Profile", HeadingLevel.HEADING_2),
        bodyText(execSummary.target_profile),
      );
    }

    const keyRisks = Array.isArray(execSummary.key_risk_findings) ? execSummary.key_risk_findings : [];
    if (keyRisks.length > 0) {
      sections.push(sectionHeading("Key Risk Findings", HeadingLevel.HEADING_2));
      for (const bullet of keyRisks) {
        sections.push(bulletPoint(bullet));
      }
    }

    if (execSummary.evidence_confidence_warning) {
      sections.push(calloutBox(execSummary.evidence_confidence_warning, COLORS.warning));
    }

    if (execSummary.cost_timeline_snapshot) {
      sections.push(
        sectionHeading("Cost & Timeline", HeadingLevel.HEADING_2),
        bodyText(execSummary.cost_timeline_snapshot),
      );
    }

    const conditions = Array.isArray(execSummary.conditions_before_close) ? execSummary.conditions_before_close : [];
    if (conditions.length > 0) {
      sections.push(sectionHeading("Conditions Before Close", HeadingLevel.HEADING_2, COLORS.danger));
      conditions.forEach((cond, i) => {
        sections.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `${i + 1}. `, font: "Calibri", size: 20, bold: true, color: COLORS.danger }),
              new TextRun({ text: cond, font: "Calibri", size: 20, color: COLORS.text }),
            ],
          })
        );
      });
    }
  } else {
    sections.push(
      bodyText(
        `IT due diligence assessment for ${deal.targetName} in the ${deal.industry || "unspecified"} sector. ` +
        `${deal.facilityCount || 0} facilities, ${deal.userCount || 0} users. ` +
        `${deal.documentsUploaded || 0} documents uploaded, ${deal.documentsAnalyzed || 0} analyzed. ` +
        `Composite score: ${compositeScore !== null ? compositeScore.toFixed(1) + "/100" : "N/A"}.`
      ),
    );
  }

  sections.push(sectionHeading("Evidence Coverage", HeadingLevel.HEADING_2));
  sections.push(makeTable(
    [{ text: "Pillar" }, { text: "Score" }, { text: "Confidence" }, { text: "Docs" }, { text: "Cap" }],
    pillars.map(p => {
      const pScore = p.score ? Number(p.score) : 0;
      const confLabel = (p.confidenceLabel || "insufficient");
      return [
        { text: p.pillarName },
        { text: pScore.toFixed(1), color: scoreColor(pScore), bold: true },
        { text: confLabel.toUpperCase(), color: CONFIDENCE_COLORS[confLabel] || COLORS.muted, bold: true },
        { text: String(p.documentCount || 0) },
        { text: p.scoreCap ? Number(p.scoreCap).toFixed(1) : "N/A" },
      ];
    })
  ));

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("2. Risk Score Overview", HeadingLevel.HEADING_1, COLORS.purple));

  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: scoreDisplay, font: "Calibri", size: 56, bold: true, color: risk.color }),
        new TextRun({ text: " / 5.0", font: "Calibri", size: 32, color: COLORS.muted }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: risk.label, font: "Calibri", size: 28, bold: true, color: risk.color })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `Composite: ${compositeScore !== null ? compositeScore.toFixed(1) : "N/A"}/100  |  Confidence: ${(deal.overallConfidence || "insufficient").toUpperCase()}`, font: "Calibri", size: 18, color: COLORS.muted })],
    }),
  );

  sections.push(sectionHeading("Pillar Breakdown", HeadingLevel.HEADING_2));
  sections.push(makeTable(
    [{ text: "Pillar" }, { text: "Score" }, { text: "Weight" }, { text: "Findings" }, { text: "Confidence" }],
    pillars.map(p => {
      const pScore = p.score ? Number(p.score) : 0;
      return [
        { text: p.pillarName },
        { text: `${pScore.toFixed(1)} / 5.0`, color: scoreColor(pScore), bold: true },
        { text: p.weight ? `${(Number(p.weight) * 100).toFixed(0)}%` : "N/A" },
        { text: String(p.findingCount || 0) },
        { text: (p.confidenceLabel || "insufficient").toUpperCase(), color: CONFIDENCE_COLORS[p.confidenceLabel || "insufficient"] || COLORS.muted, bold: true },
      ];
    })
  ));

  sections.push(
    spacer(),
    bodyText(
      "Scores are calculated from document analysis, finding severity, and evidence confidence. " +
      "Each pillar's score is capped based on evidence coverage: insufficient evidence caps scores at 3.0/5.0.",
      { italic: true, color: COLORS.muted, size: 18 }
    ),
  );

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("3. Pillar Assessments", HeadingLevel.HEADING_1, COLORS.purple));

  for (let pi = 0; pi < pillars.length; pi++) {
    const p = pillars[pi];
    const pScore = p.score ? Number(p.score) : 0;
    const narrative = pillarNarratives[pi] as PillarNarrative | null;

    sections.push(
      sectionHeading(`${p.pillarName} — ${pScore.toFixed(1)} / 5.0`, HeadingLevel.HEADING_2, scoreColor(pScore)),
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `${p.documentCount || 0} docs  |  ${p.findingCount || 0} findings  |  Weight: ${p.weight ? (Number(p.weight) * 100).toFixed(0) : "N/A"}%  |  Confidence: `, font: "Calibri", size: 18, color: COLORS.muted }),
          new TextRun({ text: (p.confidenceLabel || "insufficient").toUpperCase(), font: "Calibri", size: 18, bold: true, color: CONFIDENCE_COLORS[p.confidenceLabel || "insufficient"] || COLORS.muted }),
        ],
      }),
    );

    if (narrative) {
      sections.push(bodyText(narrative.assessment_summary || narrative.summary));

      if (narrative.strengths.length > 0) {
        sections.push(
          new Paragraph({
            spacing: { before: 100, after: 80 },
            children: [new TextRun({ text: "\u2713 Strengths", font: "Calibri", size: 20, bold: true, color: COLORS.success })],
          }),
        );
        for (const s of narrative.strengths) {
          sections.push(bulletPoint(s));
        }
      }

      if (narrative.concerns.length > 0) {
        sections.push(
          new Paragraph({
            spacing: { before: 100, after: 80 },
            children: [new TextRun({ text: "\u2717 Concerns", font: "Calibri", size: 20, bold: true, color: COLORS.danger })],
          }),
        );
        for (const c of narrative.concerns) {
          sections.push(bulletPoint(c));
        }
      }

      if (narrative.remediation_priority) {
        sections.push(
          new Paragraph({
            spacing: { before: 100, after: 80 },
            children: [
              new TextRun({ text: "Remediation: ", font: "Calibri", size: 20, bold: true, color: COLORS.primary }),
              new TextRun({ text: narrative.remediation_priority, font: "Calibri", size: 20, color: COLORS.text }),
            ],
          }),
        );
      }

      if (narrative.evidence_confidence_note) {
        sections.push(bodyText(narrative.evidence_confidence_note, { italic: true, color: COLORS.muted, size: 18 }));
      }
    } else {
      const pillarFindings = findings.filter(f => f.pillarId === p.id);
      if (pillarFindings.length > 0) {
        sections.push(bodyText(`This pillar has ${pillarFindings.length} findings. Score is ${pScore < 3.0 ? "below threshold — remediation needed" : "within acceptable range"}.`));
      } else {
        sections.push(bodyText("No findings recorded for this pillar.", { color: COLORS.muted }));
      }
    }

    if (pScore < 3.0) {
      sections.push(calloutBox(`WARNING: ${p.pillarName} scores ${pScore.toFixed(1)}/5.0, below the 3.0 threshold. Immediate attention required.`, COLORS.danger));
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("4. Consolidated Findings Register", HeadingLevel.HEADING_1, COLORS.danger));

  if (consolidation) {
    const cs = (consolidation as any).consolidation_summary;
    if (cs) {
      sections.push(bodyText(
        `${cs.original_count || consolidation.total_original || 0} individual findings consolidated into ${cs.consolidated_count || consolidation.total_consolidated || 0} risk themes${cs.groups_merged ? ` (${cs.groups_merged} groups merged)` : ""}.`,
        { color: COLORS.muted }
      ));
    } else {
      sections.push(bodyText(
        `${consolidation.total_original || findings.length} individual findings consolidated into ${consolidation.total_consolidated || consolidated.length} risk themes.`,
        { color: COLORS.muted }
      ));
    }
  }

  sections.push(makeTable(
    [{ text: "Severity" }, { text: "Count" }, { text: "Key Themes" }],
    [
      { label: "Critical", count: criticalFindings.length, color: COLORS.danger, themes: criticalFindings.map(f => f.title).join(", ") || "None" },
      { label: "High", count: highFindings.length, color: "DC2626", themes: highFindings.map(f => f.title).join(", ") || "None" },
      { label: "Medium", count: mediumFindings.length, color: COLORS.warning, themes: mediumFindings.slice(0, 3).map(f => f.title).join(", ") || "None" },
      { label: "Low", count: lowFindings.length, color: COLORS.primary, themes: lowFindings.slice(0, 2).map(f => f.title).join(", ") || "None" },
    ].map(row => [
      { text: row.label.toUpperCase(), color: row.color, bold: true },
      { text: String(row.count) },
      { text: row.themes.length > 80 ? row.themes.slice(0, 77) + "..." : row.themes },
    ])
  ));

  sections.push(spacer());

  const renderDetailedFinding = (f: ConsolidatedFinding, idx: number) => {
    sections.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightBorder } },
        children: [
          severityBadgeText(f.severity),
          new TextRun({ text: `  ${f.title}`, font: "Calibri", size: 22, bold: true, color: COLORS.text }),
        ],
      }),
    );
    if (f.description) {
      sections.push(
        new Paragraph({ spacing: { after: 60 }, children: [
          new TextRun({ text: "Description: ", font: "Calibri", size: 18, bold: true, color: COLORS.textSecondary }),
          new TextRun({ text: f.description, font: "Calibri", size: 18, color: COLORS.text }),
        ]}),
      );
    }
    if (f.business_impact) {
      sections.push(
        new Paragraph({ spacing: { after: 60 }, children: [
          new TextRun({ text: "Business Impact: ", font: "Calibri", size: 18, bold: true, color: COLORS.purple }),
          new TextRun({ text: f.business_impact, font: "Calibri", size: 18, color: COLORS.text }),
        ]}),
      );
    }
    if (f.remediation) {
      sections.push(
        new Paragraph({ spacing: { after: 60 }, children: [
          new TextRun({ text: "Remediation: ", font: "Calibri", size: 18, bold: true, color: COLORS.cyan }),
          new TextRun({ text: f.remediation, font: "Calibri", size: 18, color: COLORS.text }),
        ]}),
      );
    }
    if (f.estimated_cost) {
      sections.push(
        new Paragraph({ spacing: { after: 60 }, children: [
          new TextRun({ text: "Timeline / Cost: ", font: "Calibri", size: 18, bold: true, color: COLORS.success }),
          new TextRun({ text: f.estimated_cost, font: "Calibri", size: 18, color: COLORS.text }),
        ]}),
      );
    }
    sections.push(
      new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: "Evidence: ", font: "Calibri", size: 18, bold: true, color: COLORS.muted }),
        new TextRun({ text: `${f.evidence_count} source${f.evidence_count !== 1 ? "s" : ""} — ${f.source_images?.length ? f.source_images.join(", ") : "Document analysis"}`, font: "Calibri", size: 18, color: COLORS.muted }),
      ]}),
    );
  };

  if (criticalFindings.length > 0) {
    sections.push(sectionHeading("Critical Findings", HeadingLevel.HEADING_2, COLORS.danger));
    criticalFindings.forEach((f, i) => renderDetailedFinding(f, i));
  }
  if (highFindings.length > 0) {
    sections.push(sectionHeading("High Findings", HeadingLevel.HEADING_2, "DC2626"));
    highFindings.forEach((f, i) => renderDetailedFinding(f, i));
  }
  if (mediumFindings.length > 0) {
    sections.push(sectionHeading("Medium Findings", HeadingLevel.HEADING_2, COLORS.warning));
    sections.push(makeTable(
      [{ text: "#" }, { text: "Finding Theme" }, { text: "Evidence" }, { text: "Impact" }, { text: "Est. Cost" }],
      mediumFindings.map((f, i) => [
        { text: String(i + 1) },
        { text: f.title.slice(0, 60) },
        { text: `${f.evidence_count} src` },
        { text: (f.business_impact || "").slice(0, 40) },
        { text: f.estimated_cost || "TBD" },
      ])
    ));
  }
  if (lowFindings.length > 0) {
    sections.push(sectionHeading("Low / Info Findings", HeadingLevel.HEADING_2, COLORS.primary));
    for (const f of lowFindings) {
      sections.push(bulletPoint(f.title));
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("5. Technology Stack", HeadingLevel.HEADING_1, COLORS.cyan));

  if (techStack.length === 0) {
    sections.push(calloutBox("No technology stack items detected. Run 'Extract Tech Stack' from the Infra view to populate.", COLORS.primary));
  } else {
    const categories: Record<string, typeof techStack> = {};
    for (const item of techStack) {
      const cat = item.category || "Other";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    sections.push(bodyText(`${techStack.length} technologies detected across ${Object.keys(categories).length} categories`, { color: COLORS.muted }));

    sections.push(makeTable(
      [{ text: "Category" }, { text: "Technology" }, { text: "Version" }, { text: "Status" }, { text: "Confidence" }],
      Object.entries(categories).sort((a, b) => a[0].localeCompare(b[0])).flatMap(([cat, items]) =>
        items.map(item => {
          const isEOL = item.status === "eol" || item.status === "deprecated";
          const statusColor = isEOL ? COLORS.danger : item.status === "current" ? COLORS.success : COLORS.muted;
          return [
            { text: cat, bold: true, color: COLORS.purple },
            { text: item.itemName, color: isEOL ? COLORS.danger : COLORS.text },
            { text: item.version || "N/A", color: COLORS.muted },
            { text: (item.status || "unknown").toUpperCase(), color: statusColor, bold: true },
            { text: item.confidence || "N/A" },
          ];
        })
      )
    ));
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("6. Baseline Alignment", HeadingLevel.HEADING_1, COLORS.warning));

  if (comparisons.length === 0) {
    sections.push(calloutBox("Baseline comparison pending. Configure an acquirer technology baseline profile in MERIDIAN Settings to enable gap analysis against target environment.", COLORS.primary));
  } else {
    const aligned = comparisons.filter(c => c.gapSeverity === "aligned").length;
    const gaps = comparisons.length - aligned;

    sections.push(bodyText(`${comparisons.length} standards evaluated  |  ${aligned} aligned  |  ${gaps} gaps identified`, { color: COLORS.muted }));

    const tierGroups = [
      { label: "REQUIRED STANDARDS", color: COLORS.danger, items: comparisons.filter(c => c.priority === "required") },
      { label: "RECOMMENDED STANDARDS", color: COLORS.warning, items: comparisons.filter(c => (c.priority || "recommended") === "recommended") },
      { label: "OPTIONAL STANDARDS", color: COLORS.muted, items: comparisons.filter(c => c.priority === "optional") },
    ];

    for (const tier of tierGroups) {
      if (tier.items.length === 0) continue;
      const tierAligned = tier.items.filter(c => c.gapSeverity === "aligned").length;
      sections.push(sectionHeading(`${tier.label} (${tierAligned} of ${tier.items.length} aligned)`, HeadingLevel.HEADING_3, tier.color));

      sections.push(makeTable(
        [{ text: "Standard" }, { text: "Current State" }, { text: "Gap" }, { text: "Remediation" }, { text: "Est. Cost" }],
        tier.items.map(comp => {
          const gapColor = GAP_COLORS[comp.gapSeverity] || COLORS.muted;
          return [
            { text: (comp.standardName || "").slice(0, 35) },
            { text: (comp.currentState || "Not detected").slice(0, 30) },
            { text: (comp.gapSeverity || "unknown").toUpperCase(), color: gapColor, bold: true },
            { text: (comp.remediationNote || "").slice(0, 35) },
            { text: comp.estimatedCost || "TBD" },
          ];
        })
      ));
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("7. Integration Roadmap", HeadingLevel.HEADING_1, COLORS.success));

  if (phases.length === 0) {
    sections.push(calloutBox("Integration playbook not yet generated. Use 'Generate Playbook' from the Playbook view to create a phased integration plan based on deal intelligence.", COLORS.primary));
  } else {
    const sortedPhases = [...phases].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const totalTasks = tasks.length;
    const criticalPathTasks = tasks.filter(t => t.isCriticalPath).length;

    sections.push(bodyText(`${sortedPhases.length} phases  |  ${totalTasks} tasks  |  ${criticalPathTasks} critical path tasks`, { color: COLORS.muted }));

    sections.push(makeTable(
      [{ text: "Phase" }, { text: "Timeline" }, { text: "Status" }],
      sortedPhases.map(phase => [
        { text: phase.phaseName, bold: true },
        { text: phase.timeRange },
        { text: phase.status.toUpperCase(), color: phase.status === "completed" ? COLORS.success : phase.status === "in-progress" ? COLORS.primary : COLORS.muted, bold: true },
      ])
    ));
    sections.push(spacer());

    for (const phase of sortedPhases) {
      sections.push(sectionHeading(phase.phaseName, HeadingLevel.HEADING_2));
      sections.push(bodyText(`${phase.timeRange}  |  ${phase.status.toUpperCase()}`, { color: COLORS.muted, size: 18 }));

      const phaseTasks = tasks.filter(t => t.phaseId === phase.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      if (phaseTasks.length > 0) {
        sections.push(makeTable(
          [{ text: "Priority" }, { text: "Task" }, { text: "Status" }],
          phaseTasks.map(task => {
            const isCritical = task.isCriticalPath;
            const statusColor = task.status === "completed" ? COLORS.success : task.status === "in-progress" ? COLORS.primary : COLORS.muted;
            return [
              { text: isCritical ? "CRITICAL" : "", bold: true, color: isCritical ? COLORS.danger : COLORS.text },
              { text: task.taskName.slice(0, 70) },
              { text: task.status.toUpperCase(), color: statusColor, bold: true },
            ];
          })
        ));
      }
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("8. Network Topology", HeadingLevel.HEADING_1, COLORS.primary));

  if (nodes.length === 0 && connections.length === 0) {
    sections.push(calloutBox("No network topology data available. Use 'Extract Topology' from the Infra view to AI-reconstruct the network diagram from uploaded documents.", COLORS.primary));
  } else {
    sections.push(bodyText(`${nodes.length} nodes  |  ${connections.length} connections`, { color: COLORS.muted }));

    const layerOrder: Record<string, number> = {
      acquirer: 0, internet: 0, cloud: 1,
      target_hq: 2, datacenter: 2,
      firewall: 3, switch: 3, server: 3, vpn: 3, wan_link: 3,
      facility: 4,
    };
    const layerLabels: Record<string, string> = {
      "0": "External / Acquirer",
      "1": "Cloud Services",
      "2": "Core Infrastructure",
      "3": "Network / Security",
      "4": "Facilities",
    };

    const layerGroups: Record<string, typeof nodes> = {};
    for (const n of nodes) {
      const layer = String(layerOrder[n.nodeType] ?? 3);
      if (!layerGroups[layer]) layerGroups[layer] = [];
      layerGroups[layer].push(n);
    }

    for (const [layer, layerNodes] of Object.entries(layerGroups).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      sections.push(sectionHeading(layerLabels[layer] || `Layer ${layer}`, HeadingLevel.HEADING_3));
      sections.push(makeTable(
        [{ text: "Node" }, { text: "Type" }, { text: "Details" }, { text: "Status" }],
        layerNodes.map(n => {
          const statusColor = n.status === "healthy" ? COLORS.success : n.status === "warning" ? COLORS.warning : n.status === "critical" ? COLORS.danger : COLORS.muted;
          return [
            { text: n.label, bold: true },
            { text: n.nodeType },
            { text: n.sublabel || "" },
            { text: (n.status || "unknown").toUpperCase(), color: statusColor, bold: true },
          ];
        })
      ));
    }

    if (connections.length > 0) {
      sections.push(sectionHeading("Connections", HeadingLevel.HEADING_2));
      sections.push(makeTable(
        [{ text: "Type" }, { text: "Description" }, { text: "Bandwidth" }, { text: "Status" }],
        connections.map(c => {
          const cColor = c.status === "healthy" ? COLORS.success : c.status === "warning" ? COLORS.warning : c.status === "critical" ? COLORS.danger : COLORS.muted;
          return [
            { text: c.connectionType, bold: true },
            { text: c.label || "Connection" },
            { text: c.bandwidth || "N/A", color: COLORS.muted },
            { text: (c.status || "unknown").toUpperCase(), color: cColor, bold: true },
          ];
        })
      ));
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("9. Infrastructure Summary", HeadingLevel.HEADING_1, COLORS.cyan));

  if (techStack.length === 0) {
    sections.push(calloutBox("No infrastructure data available. Run 'Extract Tech Stack' from the Infra view to populate network, application, and security control inventories.", COLORS.primary));
  } else {
    const INFRA_CAT_MAP: Record<string, string> = {
      "Networking": "network", "Security": "security", "Telephony": "network", "Endpoints": "network",
      "EHR / Clinical": "applications", "Line of Business Apps": "applications", "Productivity": "applications",
      "Cloud Services": "applications", "Other": "applications",
      "Identity & Access": "security", "Backup & DR": "security", "Monitoring": "security",
    };

    const networkItems = techStack.filter(t => INFRA_CAT_MAP[t.category] === "network");
    const appItems = techStack.filter(t => INFRA_CAT_MAP[t.category] === "applications");
    const securityItems = techStack.filter(t => INFRA_CAT_MAP[t.category] === "security");

    const renderInfraTable = (title: string, items: typeof techStack) => {
      if (items.length === 0) return;
      sections.push(sectionHeading(title, HeadingLevel.HEADING_2));
      sections.push(makeTable(
        [{ text: "Component" }, { text: "Solution" }, { text: "Version" }, { text: "Status" }],
        items.map(item => {
          const isEOL = item.status === "eol" || item.status === "deprecated";
          const statusColor = isEOL ? COLORS.danger : item.status === "current" ? COLORS.success : COLORS.muted;
          return [
            { text: item.category },
            { text: item.itemName, color: isEOL ? COLORS.danger : COLORS.text },
            { text: item.version || "N/A", color: COLORS.muted },
            { text: (item.status || "unknown").toUpperCase(), color: statusColor, bold: true },
          ];
        })
      ));
    };

    renderInfraTable("Network Infrastructure", networkItems);
    renderInfraTable("Applications", appItems);
    renderInfraTable("Security Controls", securityItems);

    if (networkItems.length === 0 && appItems.length === 0 && securityItems.length === 0) {
      sections.push(bodyText("Technology stack items detected but could not be categorized into infrastructure tables. See the Technology Stack section for full details.", { color: COLORS.muted }));
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("10. Cost Estimates", HeadingLevel.HEADING_1, COLORS.success));

  {
    const findingCosts = consolidated.filter(f => f.estimated_cost && f.estimated_cost.trim() !== "");
    const gapCosts = comparisons.filter(c => c.estimatedCost && c.estimatedCost.trim() !== "" && c.gapSeverity !== "aligned");
    const hasCostSummary = execSummary && execSummary.cost_timeline_snapshot && typeof execSummary.cost_timeline_snapshot === "string";

    if (findingCosts.length === 0 && gapCosts.length === 0 && !hasCostSummary) {
      sections.push(calloutBox("Cost estimates are not yet available. Upload documents and generate findings with remediation costs to populate this section.", COLORS.primary));
    } else {
      if (findingCosts.length > 0) {
        sections.push(sectionHeading("Remediation CapEx — Finding-Based Costs", HeadingLevel.HEADING_2));
        sections.push(makeTable(
          [{ text: "#" }, { text: "Finding" }, { text: "Severity" }, { text: "Estimated Cost" }],
          findingCosts.map((f) => {
            const globalIdx = consolidated.indexOf(f);
            const fId = globalIdx >= 0 ? `F${String(globalIdx + 1).padStart(3, "0")}` : "F---";
            return [
              { text: fId, bold: true, color: COLORS.muted },
              { text: f.title.slice(0, 60) },
              { text: f.severity.toUpperCase(), color: SEVERITY_COLORS[f.severity] || COLORS.muted, bold: true },
              { text: f.estimated_cost, bold: true },
            ];
          })
        ));
      }

      if (gapCosts.length > 0) {
        sections.push(sectionHeading("Alignment OpEx — Baseline Gap Remediation", HeadingLevel.HEADING_2));
        sections.push(makeTable(
          [{ text: "Standard" }, { text: "Gap" }, { text: "Remediation" }, { text: "Estimated Cost" }],
          gapCosts.map(g => {
            const gapColor = GAP_COLORS[g.gapSeverity] || COLORS.muted;
            return [
              { text: (g.standardName || "").slice(0, 35) },
              { text: (g.gapSeverity || "").toUpperCase(), color: gapColor, bold: true },
              { text: (g.remediationNote || "").slice(0, 40) },
              { text: g.estimatedCost || "TBD", bold: true },
            ];
          })
        ));
      }

      if (hasCostSummary) {
        sections.push(sectionHeading("Cost & Timeline Summary", HeadingLevel.HEADING_2));
        sections.push(calloutBox(execSummary!.cost_timeline_snapshot!, COLORS.success));
      }
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("11. Follow-Up Items", HeadingLevel.HEADING_1, COLORS.warning));

  {
    const followUpItems: Array<{ item: string; priority: string; timeline: string; owner: string }> = [];

    if (execSummary && Array.isArray(execSummary.conditions_before_close)) {
      execSummary.conditions_before_close.forEach(cond => {
        followUpItems.push({ item: cond, priority: "CRITICAL", timeline: "Before Close", owner: "Deal Team" });
      });
    }

    const critHighForFollowUp = consolidated.filter(f => f.severity === "critical" || f.severity === "high");
    critHighForFollowUp.forEach(f => {
      if (!followUpItems.some(fi => fi.item.includes(f.title.slice(0, 30)))) {
        followUpItems.push({
          item: `Remediate: ${f.title}`,
          priority: f.severity === "critical" ? "CRITICAL" : "HIGH",
          timeline: f.severity === "critical" ? "Day 1" : "0-30 Days",
          owner: "IT Integration",
        });
      }
    });

    const insufficientPillars = pillars.filter(p => (p.confidenceLabel || "insufficient") === "insufficient");
    if (insufficientPillars.length > 0) {
      followUpItems.push({
        item: `Obtain additional documentation for: ${insufficientPillars.map(p => p.pillarName).join(", ")}`,
        priority: "HIGH",
        timeline: "Before Close",
        owner: "Deal Team",
      });
    }

    if (followUpItems.length === 0) {
      sections.push(bodyText("No follow-up items identified. Generate findings or configure AI analysis for actionable follow-ups.", { color: COLORS.muted }));
    } else {
      sections.push(makeTable(
        [{ text: "#" }, { text: "Action Item" }, { text: "Priority" }, { text: "Timeline" }, { text: "Owner" }],
        followUpItems.map((fi, i) => {
          const prioColor = fi.priority === "CRITICAL" ? COLORS.danger : fi.priority === "HIGH" ? "DC2626" : COLORS.warning;
          return [
            { text: String(i + 1) },
            { text: fi.item.slice(0, 70) },
            { text: fi.priority, color: prioColor, bold: true },
            { text: fi.timeline, color: COLORS.muted },
            { text: fi.owner, color: COLORS.muted },
          ];
        })
      ));
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("12. Deal Risks & Positive Observations", HeadingLevel.HEADING_1, COLORS.danger));

  {
    sections.push(sectionHeading("Deal Risks", HeadingLevel.HEADING_2, COLORS.danger));

    const dealRisks: string[] = [];
    if (execSummary && Array.isArray(execSummary.key_risk_findings)) {
      dealRisks.push(...execSummary.key_risk_findings);
    }
    if (dealRisks.length === 0) {
      consolidated.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 7).forEach(f => {
        dealRisks.push(`[${f.severity.toUpperCase()}] ${f.title}${f.business_impact ? " — " + f.business_impact.slice(0, 100) : ""}`);
      });
    }

    if (dealRisks.length === 0) {
      sections.push(bodyText("No material deal risks identified at this stage.", { color: COLORS.muted }));
    } else {
      for (const r of dealRisks) {
        sections.push(bulletPoint(r, COLORS.danger));
      }
    }

    sections.push(spacer());
    sections.push(sectionHeading("Positive Observations", HeadingLevel.HEADING_2, COLORS.success));

    const positives: string[] = [];
    for (const pn of pillarNarratives) {
      if (pn && pn.strengths) {
        for (const s of pn.strengths) {
          if (!s.toLowerCase().includes("no material strengths") && !s.toLowerCase().includes("insufficient")) {
            positives.push(s);
          }
        }
      }
    }
    const alignedCount = comparisons.filter(c => c.gapSeverity === "aligned").length;
    if (alignedCount > 0) {
      positives.push(`${alignedCount} of ${comparisons.length} baseline standards are fully aligned with acquirer requirements.`);
    }
    if (techStack.filter(t => t.status === "current").length > 0) {
      const currentCount = techStack.filter(t => t.status === "current").length;
      positives.push(`${currentCount} of ${techStack.length} detected technologies are on current/supported versions.`);
    }

    if (positives.length === 0) {
      sections.push(bodyText("Positive observations pending additional document analysis.", { color: COLORS.muted }));
    } else {
      for (const pos of positives.slice(0, 10)) {
        sections.push(bulletPoint(pos, COLORS.success));
      }
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("13. Recommendations & Next Steps", HeadingLevel.HEADING_1, COLORS.primary));

  if (execSummary) {
    const recConditions = Array.isArray(execSummary.conditions_before_close) ? execSummary.conditions_before_close : [];
    if (recConditions.length > 0) {
      sections.push(sectionHeading("Immediate Priorities (0-30 Days)", HeadingLevel.HEADING_2));
      recConditions.forEach((cond, i) => {
        sections.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `${i + 1}. `, font: "Calibri", size: 20, bold: true, color: COLORS.danger }),
              new TextRun({ text: cond, font: "Calibri", size: 20, color: COLORS.text }),
            ],
          })
        );
      });
    }

    sections.push(sectionHeading("Integration Timeline", HeadingLevel.HEADING_2));
    if (phases.length > 0) {
      sections.push(bodyText(
        `The integration roadmap consists of ${phases.length} phases spanning approximately 90-120 days. ` +
        `${tasks.filter(t => t.isCriticalPath).length} critical path tasks have been identified that directly impact the overall timeline.`
      ));
    } else {
      sections.push(bodyText("Detailed integration timeline pending playbook generation.", { color: COLORS.muted }));
    }
  } else {
    sections.push(bodyText("AI-generated recommendations require OPENROUTER_API_KEY. Configure it in Doppler or .env.", { color: COLORS.muted }));
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("Appendix A: Full Findings Register", HeadingLevel.HEADING_1, COLORS.muted));

  sections.push(bodyText(`All ${findings.length} original findings (un-consolidated)`, { color: COLORS.muted, size: 18 }));

  if (findings.length > 0) {
    sections.push(makeTable(
      [{ text: "Severity" }, { text: "Title" }, { text: "Status" }, { text: "Sources" }],
      findings.map(f => [
        { text: f.severity.toUpperCase(), color: SEVERITY_COLORS[f.severity] || COLORS.muted, bold: true },
        { text: f.title.slice(0, 70) },
        { text: (f.status || "open").toUpperCase(), color: COLORS.muted },
        { text: String(f.sourceCount || 0) },
      ])
    ));
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("Appendix B: Document Inventory", HeadingLevel.HEADING_1, COLORS.muted));

  sections.push(bodyText(`${documents.length} documents  |  ${formatBytes(documents.reduce((s, d) => s + (d.fileSize || 0), 0))} total`, { color: COLORS.muted, size: 18 }));

  if (documents.length > 0) {
    sections.push(makeTable(
      [{ text: "Filename" }, { text: "Type" }, { text: "Classification" }, { text: "Size" }, { text: "Status" }],
      documents.map(d => {
        const exColor = d.extractionStatus === "completed" ? COLORS.success : d.extractionStatus === "failed" ? COLORS.danger : COLORS.muted;
        return [
          { text: (d.originalFilename || d.filename || "").slice(0, 35) },
          { text: d.fileType || "-" },
          { text: d.classification || "-" },
          { text: d.fileSize ? formatBytes(d.fileSize) : "-" },
          { text: d.extractionStatus || "-", color: exColor },
        ];
      })
    ));
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("Appendix C: Methodology & Glossary", HeadingLevel.HEADING_1, COLORS.muted));

  sections.push(sectionHeading("Scoring Methodology", HeadingLevel.HEADING_2));
  sections.push(bodyText(
    "MERIDIAN calculates risk scores using a multi-dimensional assessment framework. " +
    "Each of six risk pillars is scored from 0.0 to 5.0 based on finding severity distribution. " +
    "Scores are weighted by industry-specific relevance factors and capped based on evidence confidence. " +
    "The composite score (0-100) is a weighted average of all pillar scores, scaled to percentage."
  ));

  sections.push(sectionHeading("Evidence Confidence Model", HeadingLevel.HEADING_2));
  sections.push(makeTable(
    [{ text: "Tier" }, { text: "Documents" }, { text: "Score Cap" }, { text: "Description" }],
    [
      [{ text: "Insufficient" }, { text: "0 documents" }, { text: "3.0" }, { text: "No evidence available" }],
      [{ text: "Low" }, { text: "1-2 documents" }, { text: "4.0" }, { text: "Minimal evidence" }],
      [{ text: "Moderate" }, { text: "3-5 documents" }, { text: "4.8" }, { text: "Adequate evidence" }],
      [{ text: "High" }, { text: "6+ documents" }, { text: "5.0" }, { text: "Strong evidence (uncapped)" }],
    ]
  ));

  sections.push(sectionHeading("Glossary", HeadingLevel.HEADING_2));
  const glossary = [
    ["Composite Score", "Overall IT health score (0-100). >=80 Low Risk, 60-79 Moderate Risk, <60 High Risk."],
    ["Pillar Score", "Individual assessment dimension score (0-5.0). >=4.0 Strong, 3.0-3.9 Moderate, <3.0 Weak."],
    ["Evidence Confidence", "Percentage reflecting how much evidence supports the pillar score."],
    ["Score Cap", "Maximum achievable score for a pillar given current evidence coverage."],
    ["Finding Severity", "Critical: immediate action. High: significant risk. Medium: notable concern. Low: minor issue."],
    ["Gap Severity", "Critical: fundamental misalignment. High: significant gap. Medium: moderate deviation. Aligned: meets standard."],
    ["Critical Path", "Task that directly impacts the overall integration timeline."],
    ["Monte Carlo", "Statistical simulation running 10,000 cost iterations to produce probability distributions."],
  ];
  for (const [term, def] of glossary) {
    sections.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${term}`, font: "Calibri", size: 20, bold: true, color: COLORS.text }),
          new TextRun({ text: ` \u2014 ${def}`, font: "Calibri", size: 20, color: COLORS.muted }),
        ],
      })
    );
  }

  sections.push(spacer());
  sections.push(sectionHeading("Disclaimer", HeadingLevel.HEADING_2));
  sections.push(bodyText(
    "This report is generated by the MERIDIAN M&A IT Intelligence Platform based on automated analysis of uploaded documents and extracted data. " +
    "The findings, scores, and recommendations contained herein are derived from algorithmic assessment and should be reviewed by qualified " +
    "professionals before making investment or integration decisions. MERIDIAN does not guarantee the accuracy or completeness of the analysis. " +
    "This document contains confidential and proprietary information intended solely for authorized recipients. " +
    "Unauthorized distribution, reproduction, or disclosure of this material is strictly prohibited.\n\n" +
    copyrightText,
    { italic: true, color: COLORS.muted, size: 18 }
  ));

  sections.push(spacer());
  sections.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightBorder } },
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: "Prepared By", font: "Calibri", size: 24, bold: true, color: COLORS.text })],
    }),
  );

  const preparedByOrg = org?.name || "MERIDIAN Platform";
  sections.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: preparedByOrg, font: "Calibri", size: 24, bold: true, color: COLORS.text })],
    }),
    bodyText("IT Due Diligence — M&A Intelligence", { color: COLORS.muted }),
    bodyText(`Report Date: ${formatDate(new Date())}`),
    bodyText(`Deal: ${DN}  |  Code: ${deal.dealCode}`),
    bodyText("Generated by MERIDIAN M&A IT Intelligence Platform", { italic: true, color: COLORS.muted, size: 18 }),
  );

  const doc = new Document({
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20, color: COLORS.text },
        },
        heading1: {
          run: { font: "Calibri", size: 32, bold: true, color: COLORS.text },
          paragraph: { spacing: { before: 360, after: 200 } },
        },
        heading2: {
          run: { font: "Calibri", size: 26, bold: true, color: COLORS.text },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading3: {
          run: { font: "Calibri", size: 22, bold: true, color: COLORS.text },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          size: { width: 12240, height: 15840 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({ text: "MERIDIAN", font: "Calibri", size: 16, bold: true, color: COLORS.primary }),
                new TextRun({ text: `  \u2014  ${DN} \u2014 IT Due Diligence`, font: "Calibri", size: 14, color: COLORS.muted }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `MERIDIAN \u2014 Confidential \u2014 ${copyrightText} \u2014 Page `, font: "Calibri", size: 14, color: COLORS.muted }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 14, color: COLORS.muted }),
                new TextRun({ text: " of ", font: "Calibri", size: 14, color: COLORS.muted }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 14, color: COLORS.muted }),
              ],
            }),
          ],
        }),
      },
      children: sections,
    }],
  });

  progress(9, 9, "Rendering final document...");
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

export async function generateExecutiveSummaryDOCX(dealId: string, onProgress?: ProgressCallback): Promise<Buffer> {
  const progress = onProgress || (() => {});

  progress(1, 5, "Compiling deal data...");
  const deal = await storage.getDeal(dealId);
  if (!deal) throw new Error("Deal not found");

  let org: any = null;
  let branding: ReportBranding;
  try {
    if (deal.tenantId) {
      org = await storage.getOrganization(deal.tenantId);
      branding = await getBrandingForReport(deal.tenantId);
    } else {
      branding = await getBrandingForReport("");
    }
  } catch {
    branding = await getBrandingForReport("");
  }
  const copyrightText = getCopyrightText(branding, org?.name);

  const [pillars, findings, techStack, comparisons, phases, tasks] = await Promise.all([
    storage.getPillarsByDeal(dealId),
    storage.getFindingsByDeal(dealId),
    storage.getTechStackByDeal(dealId),
    storage.getBaselineComparisonsByDeal(dealId),
    storage.getPlaybookPhasesByDeal(dealId),
    storage.getPlaybookTasksByDeal(dealId),
  ]);

  progress(2, 5, "Consolidating findings...");
  const consolidation = await consolidateFindings(findings);
  const consolidated = consolidation?.consolidated_findings || [];

  progress(3, 5, "Generating executive analysis...");
  const execSummary = await generateExecutiveSummary(deal, consolidated, pillars, techStack, comparisons, phases);

  const compositeScore = deal.compositeScore ? Number(deal.compositeScore) : null;
  const compositeScoreOf5 = compositeScore !== null ? compositeScore / 20 : null;
  const risk = riskLabel(compositeScoreOf5);

  progress(4, 5, "Building document layout...");

  const DN = deal.targetName;
  const sections: (Paragraph | Table | TableOfContents)[] = [];

  sections.push(
    new Paragraph({ spacing: { before: 3000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "MERIDIAN", font: "Calibri", size: 48, bold: true, color: COLORS.primary })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: "EXECUTIVE SUMMARY", font: "Calibri", size: 24, color: COLORS.muted, characterSpacing: 120 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: deal.targetName, font: "Calibri", size: 44, bold: true, color: COLORS.text })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Industry: ${deal.industry || "N/A"}  |  Deal Code: ${deal.dealCode}`, font: "Calibri", size: 22, color: COLORS.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: `Prepared for: ${org?.name || "Organization"}`, font: "Calibri", size: 22, color: COLORS.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `Assessment Date: ${formatDate(new Date())}`, font: "Calibri", size: 22, color: COLORS.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "This document contains confidential information. Distribution is restricted to authorized recipients.", font: "Calibri", size: 16, color: COLORS.muted, italics: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: copyrightText, font: "Calibri", size: 16, color: COLORS.muted })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  const totalFindings = findings.length;
  const critHighCount = findings.filter(f => f.severity === "critical" || f.severity === "high").length;
  const docsAnalyzed = deal.documentsAnalyzed || 0;
  const techCount = techStack.length;

  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: compositeScoreOf5 !== null ? compositeScoreOf5.toFixed(1) : "N/A", font: "Calibri", size: 56, bold: true, color: risk.color }),
        new TextRun({ text: " / 5.0", font: "Calibri", size: 32, color: COLORS.muted }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: risk.label, font: "Calibri", size: 28, bold: true, color: risk.color })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: "Composite IT Risk Score", font: "Calibri", size: 18, color: COLORS.muted })],
    }),
  );

  const metricsTable = new Table({
    rows: [
      new TableRow({
        children: [
          makeCell("Composite Score", { bold: true, color: COLORS.muted, size: 16, alignment: AlignmentType.CENTER }),
          makeCell("Total Findings", { bold: true, color: COLORS.muted, size: 16, alignment: AlignmentType.CENTER }),
          makeCell("Critical / High", { bold: true, color: COLORS.muted, size: 16, alignment: AlignmentType.CENTER }),
          makeCell("Docs Analyzed", { bold: true, color: COLORS.muted, size: 16, alignment: AlignmentType.CENTER }),
          makeCell("Tech Items", { bold: true, color: COLORS.muted, size: 16, alignment: AlignmentType.CENTER }),
          makeCell("Evidence Coverage", { bold: true, color: COLORS.muted, size: 16, alignment: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          makeCell(compositeScore !== null ? compositeScore.toFixed(0) : "N/A", { bold: true, color: risk.color, size: 28, alignment: AlignmentType.CENTER }),
          makeCell(String(totalFindings), { bold: true, color: COLORS.text, size: 28, alignment: AlignmentType.CENTER }),
          makeCell(String(critHighCount), { bold: true, color: critHighCount > 0 ? COLORS.danger : COLORS.success, size: 28, alignment: AlignmentType.CENTER }),
          makeCell(String(docsAnalyzed), { bold: true, color: COLORS.primary, size: 28, alignment: AlignmentType.CENTER }),
          makeCell(String(techCount), { bold: true, color: COLORS.cyan, size: 28, alignment: AlignmentType.CENTER }),
          makeCell(`${Math.round((pillars.filter(p => (p.confidenceLabel || "insufficient") !== "insufficient").length / Math.max(pillars.length, 1)) * 100)}%`, { bold: true, color: COLORS.success, size: 28, alignment: AlignmentType.CENTER }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
  sections.push(metricsTable, spacer());

  if (execSummary) {
    sections.push(
      sectionHeading("Investment Verdict", HeadingLevel.HEADING_2),
      calloutBox(execSummary.investment_verdict || "Assessment Pending", risk.color),
    );

    if (execSummary.target_profile) {
      sections.push(
        sectionHeading("Target Profile", HeadingLevel.HEADING_2),
        bodyText(execSummary.target_profile),
      );
    }

    const execKeyRisks = Array.isArray(execSummary.key_risk_findings) ? execSummary.key_risk_findings : [];
    if (execKeyRisks.length > 0) {
      sections.push(sectionHeading("Key Risk Findings", HeadingLevel.HEADING_2, COLORS.danger));
      for (const bullet of execKeyRisks) {
        sections.push(bulletPoint(bullet));
      }
    }

    if (execSummary.evidence_confidence_warning) {
      sections.push(calloutBox(execSummary.evidence_confidence_warning, COLORS.warning));
    }

    const execConditions = Array.isArray(execSummary.conditions_before_close) ? execSummary.conditions_before_close : [];
    if (execConditions.length > 0) {
      sections.push(sectionHeading("Conditions Before Close", HeadingLevel.HEADING_2, COLORS.warning));
      execConditions.forEach((cond, i) => {
        sections.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `${i + 1}. `, font: "Calibri", size: 20, bold: true, color: COLORS.primary }),
              new TextRun({ text: cond, font: "Calibri", size: 20, color: COLORS.text }),
            ],
          })
        );
      });
    }
  } else {
    sections.push(
      bodyText(`IT due diligence assessment for ${deal.targetName}. Composite score: ${compositeScore !== null ? compositeScore.toFixed(1) + "/100" : "N/A"}.`),
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(sectionHeading("Pillar Score Overview", HeadingLevel.HEADING_2));

  sections.push(makeTable(
    [{ text: "Pillar" }, { text: "Score" }, { text: "Confidence" }, { text: "Documents" }, { text: "Score Cap" }],
    pillars.map(p => {
      const pScore = p.score ? Number(p.score) : 0;
      const confLabel = (p.confidenceLabel || "insufficient");
      return [
        { text: p.pillarName },
        { text: `${pScore.toFixed(1)} / 5.0`, color: scoreColor(pScore), bold: true },
        { text: confLabel.toUpperCase(), color: CONFIDENCE_COLORS[confLabel] || COLORS.muted, bold: true },
        { text: String(p.documentCount || 0) },
        { text: p.scoreCap ? Number(p.scoreCap).toFixed(1) : "N/A" },
      ];
    })
  ));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20, color: COLORS.text },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          size: { width: 12240, height: 15840 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({ text: "MERIDIAN", font: "Calibri", size: 16, bold: true, color: COLORS.primary }),
                new TextRun({ text: `  \u2014  ${DN} \u2014 Executive Summary`, font: "Calibri", size: 14, color: COLORS.muted }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `MERIDIAN \u2014 Executive Summary \u2014 ${copyrightText} \u2014 Page `, font: "Calibri", size: 14, color: COLORS.muted }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 14, color: COLORS.muted }),
                new TextRun({ text: " of ", font: "Calibri", size: 14, color: COLORS.muted }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 14, color: COLORS.muted }),
              ],
            }),
          ],
        }),
      },
      children: sections,
    }],
  });

  progress(5, 5, "Rendering final document...");
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

export { generateDealDOCX as generateDealPDF, generateExecutiveSummaryDOCX as generateExecutiveSummaryPDF };

export async function generateDealCSV(dealId: string): Promise<string> {
  const deal = await storage.getDeal(dealId);
  if (!deal) throw new Error("Deal not found");

  const [pillars, findings, documents, techStack, comparisons, phases, tasks, nodes, connections] = await Promise.all([
    storage.getPillarsByDeal(dealId),
    storage.getFindingsByDeal(dealId),
    storage.getDocumentsByDeal(dealId),
    storage.getTechStackByDeal(dealId),
    storage.getBaselineComparisonsByDeal(dealId),
    storage.getPlaybookPhasesByDeal(dealId),
    storage.getPlaybookTasksByDeal(dealId),
    storage.getTopologyNodesByDeal(dealId),
    storage.getTopologyConnectionsByDeal(dealId),
  ]);

  const lines: string[] = [];

  lines.push("MERIDIAN M&A IT Intelligence Report - Full Data Export");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("=== DEAL METADATA ===");
  lines.push("Field,Value");
  lines.push(`"Target Name",${csvEscape(deal.targetName)}`);
  lines.push(`"Industry",${csvEscape(deal.industry)}`);
  lines.push(`"Deal Code",${csvEscape(deal.dealCode)}`);
  lines.push(`"Stage",${csvEscape(deal.stage)}`);
  lines.push(`"Status",${csvEscape(deal.status)}`);
  lines.push(`"Facility Count",${csvEscape(String(deal.facilityCount || 0))}`);
  lines.push(`"User Count",${csvEscape(String(deal.userCount || 0))}`);
  lines.push(`"Estimated Integration Cost",${csvEscape(deal.estimatedIntegrationCost)}`);
  lines.push(`"Composite Score",${csvEscape(deal.compositeScore ? String(deal.compositeScore) : "N/A")}`);
  lines.push(`"Overall Confidence",${csvEscape(deal.overallConfidence)}`);
  lines.push(`"Documents Uploaded",${csvEscape(String(deal.documentsUploaded || 0))}`);
  lines.push(`"Documents Analyzed",${csvEscape(String(deal.documentsAnalyzed || 0))}`);
  lines.push(`"Created At",${csvEscape(deal.createdAt ? new Date(deal.createdAt).toISOString() : "")}`);
  lines.push("");

  lines.push("=== RISK PILLARS ===");
  lines.push("Pillar Name,Score,Weight,Finding Count,Evidence Confidence,Confidence Label,Document Count,Score Cap");
  for (const p of pillars) {
    lines.push([
      csvEscape(p.pillarName),
      p.score || "",
      p.weight || "",
      String(p.findingCount || 0),
      p.evidenceConfidence || "",
      csvEscape(p.confidenceLabel),
      String(p.documentCount || 0),
      p.scoreCap || "",
    ].join(","));
  }
  lines.push("");

  lines.push("=== FINDINGS ===");
  lines.push("Title,Severity,Status,Description,Impact Estimate,Remediation Notes,Source Count,Created At");
  for (const f of findings) {
    lines.push([
      csvEscape(f.title),
      csvEscape(f.severity),
      csvEscape(f.status),
      csvEscape(f.description),
      csvEscape(f.impactEstimate),
      csvEscape(f.remediationNotes),
      String(f.sourceCount || 0),
      csvEscape(f.createdAt ? new Date(f.createdAt).toISOString() : ""),
    ].join(","));
  }
  lines.push("");

  lines.push("=== TECHNOLOGY STACK ===");
  lines.push("Category,Item Name,Version,Status,Confidence");
  for (const t of techStack) {
    lines.push([
      csvEscape(t.category),
      csvEscape(t.itemName),
      csvEscape(t.version),
      csvEscape(t.status),
      csvEscape(t.confidence),
    ].join(","));
  }
  lines.push("");

  lines.push("=== BASELINE COMPARISONS ===");
  lines.push("Standard Name,Current State,Gap Severity,Remediation Note,Estimated Cost");
  for (const c of comparisons) {
    lines.push([
      csvEscape(c.standardName),
      csvEscape(c.currentState),
      csvEscape(c.gapSeverity),
      csvEscape(c.remediationNote),
      csvEscape(c.estimatedCost),
    ].join(","));
  }
  lines.push("");

  lines.push("=== PLAYBOOK PHASES ===");
  lines.push("Phase Name,Time Range,Status,Sort Order");
  for (const p of phases.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))) {
    lines.push([
      csvEscape(p.phaseName),
      csvEscape(p.timeRange),
      csvEscape(p.status),
      String(p.sortOrder || 0),
    ].join(","));
  }
  lines.push("");

  lines.push("=== PLAYBOOK TASKS ===");
  lines.push("Task Name,Phase ID,Is Critical Path,Status,Sort Order");
  for (const t of tasks) {
    lines.push([
      csvEscape(t.taskName),
      csvEscape(t.phaseId),
      t.isCriticalPath ? "Yes" : "No",
      csvEscape(t.status),
      String(t.sortOrder || 0),
    ].join(","));
  }
  lines.push("");

  lines.push("=== DOCUMENT INVENTORY ===");
  lines.push("Filename,Original Filename,File Type,File Size,Classification,Upload Status,Page Count,Text Length,Extraction Status,Created At");
  for (const d of documents) {
    lines.push([
      csvEscape(d.filename),
      csvEscape(d.originalFilename),
      csvEscape(d.fileType),
      String(d.fileSize || 0),
      csvEscape(d.classification),
      csvEscape(d.uploadStatus),
      String(d.pageCount || 0),
      String(d.textLength || 0),
      csvEscape(d.extractionStatus),
      csvEscape(d.createdAt ? new Date(d.createdAt).toISOString() : ""),
    ].join(","));
  }
  lines.push("");

  lines.push("=== TOPOLOGY NODES ===");
  lines.push("Node Type,Label,Sublabel,Status");
  for (const n of nodes) {
    lines.push([
      csvEscape(n.nodeType),
      csvEscape(n.label),
      csvEscape(n.sublabel),
      csvEscape(n.status),
    ].join(","));
  }
  lines.push("");

  lines.push("=== TOPOLOGY CONNECTIONS ===");
  lines.push("Connection Type,Label,Bandwidth,Status");
  for (const c of connections) {
    lines.push([
      csvEscape(c.connectionType),
      csvEscape(c.label),
      csvEscape(c.bandwidth),
      csvEscape(c.status),
    ].join(","));
  }

  return lines.join("\n");
}
