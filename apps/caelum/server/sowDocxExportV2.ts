/**
 * Caelum Statement of Work — DOCX Export Generator v2.0
 * Spec: SOW-MASTER-SPEC-v2.0.md (2026-03-10)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 *
 * Replaces the generateDocx / generateDocxDetailed / generateDocxSummary
 * functions in the existing sowExport.ts.
 * Provider name and branding are resolved per-tenant via tenantConfig.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
} from "docx";
import type { SowDocumentV2, SowLaborRowMultiRole, SowLaborRowSingleRole } from "../shared/models/sow";
import type { TenantConfig } from "./tenantConfigLoader";

// ── Design Tokens ──────────────────────────────────────────

const C = {
  navy: "1F3864",
  blue: "2E75B6",
  lightBlue: "D6E4F0",
  white: "FFFFFF",
  black: "000000",
  gray: "888888",
  lightGray: "CCCCCC",
  veryLightGray: "F2F2F2",
};

const FONT = "Arial";
const W = 9360; // Content width: 8.5" - 2×1" margins in DXA

const bdr = { style: BorderStyle.SINGLE, size: 1, color: C.lightGray };
const borders = { top: bdr, bottom: bdr, left: bdr, right: bdr };
const noBdr = { style: BorderStyle.NONE, size: 0, color: C.white };
const noBorders = { top: noBdr, bottom: noBdr, left: noBdr, right: noBdr };
const pad = { top: 80, bottom: 80, left: 120, right: 120 };

// ── Helpers ─────────────────────────────────────────────────

function hCell(text: string, width: number, align = AlignmentType.LEFT): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders, margins: pad,
    shading: { fill: C.navy, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: C.white })] })],
  });
}

function bCell(text: string, width: number, opts: { bold?: boolean; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; shaded?: boolean; italic?: boolean } = {}): TableCell {
  const { bold = false, color = C.black, align = AlignmentType.LEFT, shaded = false, italic = false } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders, margins: pad,
    shading: { fill: shaded ? C.lightBlue : C.white, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, font: FONT, size: 20, bold, color, italics: italic })] })],
  });
}

function lvRow(label: string, value: string, shaded: boolean): TableRow {
  return new TableRow({ children: [
    new TableCell({
      width: { size: 2400, type: WidthType.DXA }, borders, margins: pad,
      shading: { fill: shaded ? C.lightBlue : C.veryLightGray, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: 20, bold: true, color: C.navy })] })],
    }),
    new TableCell({
      width: { size: 3600, type: WidthType.DXA }, borders, margins: pad,
      shading: { fill: shaded ? C.lightBlue : C.white, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: value, font: FONT, size: 20 })] })],
    }),
  ] });
}

function secHead(n: string | number, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: `${n}. ${title}`, font: FONT, size: 28, bold: true, color: C.navy })],
  });
}

function subHead(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: C.blue })],
  });
}

function para(text: string, opts: { italic?: boolean; bold?: boolean; spacing?: object } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120, ...opts.spacing },
    children: [new TextRun({ text, font: FONT, size: 22, italics: opts.italic, bold: opts.bold })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, font: FONT, size: 20 })],
  });
}

function numbered(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, font: FONT, size: 20 })],
  });
}

function spacer(s = 120): Paragraph {
  return new Paragraph({ spacing: { after: s }, children: [] });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function currency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function sigBlock(entityName: string): TableCell {
  return new TableCell({
    width: { size: 4680, type: WidthType.DXA }, borders: noBorders,
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: [
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: entityName, font: FONT, size: 20, bold: true, color: C.navy })] }),
      new Paragraph({ spacing: { after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.lightGray, space: 2 } }, children: [new TextRun({ text: " ", font: FONT, size: 20 })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Authorized Signature", font: FONT, size: 16, color: C.gray, italics: true })] }),
      new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: "Printed Name: ", font: FONT, size: 18, color: C.gray }),
        new TextRun({ text: "_______________________________", font: FONT, size: 18, color: C.lightGray }),
      ] }),
      new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: "Title: ", font: FONT, size: 18, color: C.gray }),
        new TextRun({ text: "_______________________________", font: FONT, size: 18, color: C.lightGray }),
      ] }),
      new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: "Date: ", font: FONT, size: 18, color: C.gray }),
        new TextRun({ text: "_______________________________", font: FONT, size: 18, color: C.lightGray }),
      ] }),
    ],
  });
}

// ── Main Generator ──────────────────────────────────────────

export async function generateDocxV2(sow: SowDocumentV2, _tc?: TenantConfig): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // ── Section 1: Summary ──
  children.push(secHead(1, "Summary"));
  children.push(para(sow.summary));
  if (sow.summaryBoundaryNote) {
    children.push(para(sow.summaryBoundaryNote, { italic: true }));
  }

  // ── Section 2: Proposed Solution ──
  children.push(pageBreak());
  children.push(secHead(2, "Proposed Solution"));
  children.push(para(sow.proposedSolution.overview));

  if (sow.proposedSolution.subsections?.length) {
    for (const sub of sow.proposedSolution.subsections) {
      children.push(subHead(`${sub.number} ${sub.title}`));
      children.push(para(sub.narrative));
    }
  }

  if (sow.proposedSolution.componentsTable?.length) {
    children.push(subHead("Infrastructure Components"));
    const ct = sow.proposedSolution.componentsTable;
    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: [2800, 6560],
      rows: [
        new TableRow({ children: [hCell("Component", 2800), hCell("Description", 6560)] }),
        ...ct.map((c, i) => new TableRow({ children: [
          bCell(c.component, 2800, { bold: true, shaded: i % 2 === 1 }),
          bCell(c.description, 6560, { shaded: i % 2 === 1 }),
        ] })),
      ],
    }));
    children.push(spacer(200));
  }

  if (sow.proposedSolution.includedItemsTable?.length) {
    children.push(subHead("Included Hardware / Software"));
    const items = sow.proposedSolution.includedItemsTable;
    let subtotal = 0;
    const rows = items.map((li, i) => {
      subtotal += li.extPrice;
      return new TableRow({ children: [
        bCell(li.description, 4000, { shaded: i % 2 === 1 }),
        bCell(currency(li.unitPrice), 1500, { align: AlignmentType.RIGHT, shaded: i % 2 === 1 }),
        bCell(String(li.qty), 1000, { align: AlignmentType.CENTER, shaded: i % 2 === 1 }),
        bCell(currency(li.extPrice), 1860, { align: AlignmentType.RIGHT, shaded: i % 2 === 1 }),
      ] });
    });
    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: [4000, 1500, 1000, 1860],
      rows: [
        new TableRow({ children: [hCell("Description", 4000), hCell("Unit Price", 1500), hCell("Qty", 1000), hCell("Ext. Price", 1860)] }),
        ...rows,
        new TableRow({ children: [
          bCell("", 4000), bCell("", 1500),
          bCell("Subtotal", 1000, { bold: true }),
          bCell(currency(subtotal), 1860, { bold: true, align: AlignmentType.RIGHT }),
        ] }),
      ],
    }));
    children.push(spacer(200));
  }

  if (sow.proposedSolution.keyDeliverables?.length) {
    children.push(subHead("Key Deliverables"));
    for (const d of sow.proposedSolution.keyDeliverables) children.push(numbered(d));
  }

  if (sow.proposedSolution.exclusionNotes?.length) {
    children.push(spacer(120));
    children.push(para("This Scope of Work does not include:", { bold: true }));
    for (const e of sow.proposedSolution.exclusionNotes) children.push(bullet(e));
    children.push(para("These items, if required, will be addressed under separate Scopes of Work.", { italic: true }));
  }

  // ── Section 3: Prerequisites ──
  children.push(pageBreak());
  children.push(secHead(3, "Prerequisites"));
  children.push(para("The following conditions must be met prior to project commencement. Delays in meeting these prerequisites may impact the project timeline and/or require a change order."));
  for (const p of sow.prerequisites) children.push(numbered(p));

  // ── Section 4: Project Management ──
  children.push(secHead(4, "Project Management"));

  if (sow.projectManagement.siteAddress) {
    children.push(subHead("Site Address"));
    for (const line of sow.projectManagement.siteAddress.split("\n")) {
      children.push(para(line));
    }
  }

  if (sow.projectManagement.contacts?.length) {
    for (const c of sow.projectManagement.contacts) {
      children.push(subHead(c.role));
      const rows: TableRow[] = [
        new TableRow({ children: [bCell("Name:", 1600, { bold: true }), bCell(c.name, 3400)] }),
      ];
      if (c.title) rows.push(new TableRow({ children: [bCell("Title:", 1600, { bold: true, shaded: true }), bCell(c.title, 3400, { shaded: true })] }));
      if (c.email) rows.push(new TableRow({ children: [bCell("Email:", 1600, { bold: true }), bCell(c.email, 3400)] }));
      if (c.phone) rows.push(new TableRow({ children: [bCell("Phone:", 1600, { bold: true, shaded: true }), bCell(c.phone, 3400, { shaded: true })] }));
      children.push(new Table({ width: { size: 5000, type: WidthType.DXA }, columnWidths: [1600, 3400], rows }));
      children.push(spacer(120));
    }
  }

  children.push(subHead("Project Management Tasks"));
  for (const t of sow.projectManagement.pmTasks) children.push(bullet(t));

  // ── Section 5: High-Level Project Outline ──
  children.push(pageBreak());
  children.push(secHead(5, "High-Level Project Outline"));

  for (const phase of sow.phases) {
    // Phase heading with blue underline
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blue, space: 4 } },
      children: [new TextRun({ text: `Phase ${phase.number}: ${phase.title}`, font: FONT, size: 24, bold: true, color: C.navy })],
    }));

    // Estimated hours
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "Estimated Hours: ", font: FONT, size: 20, bold: true, color: C.blue }),
        new TextRun({ text: String(phase.estimatedHours), font: FONT, size: 20 }),
      ],
    }));

    // Objective
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Objective: ", font: FONT, size: 20, bold: true, color: C.navy }),
        new TextRun({ text: phase.objective, font: FONT, size: 20 }),
      ],
    }));

    // Tasks
    children.push(new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: "Tasks", font: FONT, size: 20, bold: true, color: C.blue })],
    }));
    for (const t of phase.tasks) children.push(bullet(t));

    // Deliverables
    children.push(new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: "Deliverables", font: FONT, size: 20, bold: true, color: C.blue })],
    }));
    for (const d of phase.deliverables) children.push(bullet(d));
    children.push(spacer(200));
  }

  // ── Section 6: Caveats & Risks ──
  children.push(pageBreak());
  children.push(secHead(6, "Caveats & Risks"));

  if (sow.caveatsRisks.exclusions.length) {
    children.push(subHead("6.1 Scope Exclusions"));
    for (const e of sow.caveatsRisks.exclusions) children.push(bullet(e));
  }

  if (sow.caveatsRisks.assumptions.length) {
    children.push(subHead("6.2 Assumptions"));
    for (const a of sow.caveatsRisks.assumptions) children.push(bullet(a));
  }

  if (sow.caveatsRisks.risks.length) {
    children.push(subHead("6.3 Risks"));
    const riskRows = sow.caveatsRisks.risks.map((r, i) => new TableRow({ children: [
      bCell(r.risk, 3120, { shaded: i % 2 === 1 }),
      bCell(r.impact, 3120, { shaded: i % 2 === 1 }),
      bCell(r.mitigation, 3120, { shaded: i % 2 === 1 }),
    ] }));
    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120],
      rows: [
        new TableRow({ children: [hCell("Risk", 3120), hCell("Impact", 3120), hCell("Mitigation", 3120)] }),
        ...riskRows,
      ],
    }));
    children.push(spacer(200));
  }

  children.push(subHead("6.4 Change Control"));
  children.push(para(sow.caveatsRisks.changeControl, { italic: true }));

  // ── Section 7: Completion Criteria ──
  children.push(secHead(7, "Completion Criteria"));
  children.push(para("This project will be considered complete when all of the following conditions have been met:"));
  for (const c of sow.completionCriteria) children.push(bullet(c));
  children.push(spacer(120));
  children.push(para(
    `Upon receipt of written sign-off, the project will be formally closed. Any issues or requests identified after sign-off will be handled through standard ${sow.cover.provider.replace(", LLC", "")} support channels or scoped as a separate engagement.`,
    { italic: true }
  ));

  // ── Section 8: Approval ──
  children.push(pageBreak());
  children.push(secHead(8, "Approval"));
  children.push(para(
    sow.approval.preamble ||
    "By signing below, the authorized representatives acknowledge they have reviewed this Statement of Work and agree to the scope, deliverables, prerequisites, and exclusions outlined herein. Work will commence upon receipt of signed approval."
  ));

  if (sow.approval.quoteSummary?.length) {
    children.push(subHead("Quote Summary"));
    children.push(new Table({
      width: { size: 6000, type: WidthType.DXA }, columnWidths: [4000, 2000],
      rows: [
        new TableRow({ children: [hCell("Description", 4000), hCell("Amount", 2000)] }),
        ...sow.approval.quoteSummary.map((q, i) => new TableRow({ children: [
          bCell(q.description, 4000, { shaded: i % 2 === 1, bold: q.description.toUpperCase().includes("TOTAL") }),
          bCell(q.amount, 2000, { align: AlignmentType.RIGHT, shaded: i % 2 === 1, bold: q.description.toUpperCase().includes("TOTAL") }),
        ] })),
      ],
    }));
    children.push(spacer(300));
  }

  children.push(spacer(200));
  children.push(new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [4680, 4680],
    rows: [new TableRow({ children: [sigBlock(sow.approval.clientEntity), sigBlock(sow.approval.providerEntity)] })],
  }));

  // ── Section 9: Estimated Labor Hours ──
  children.push(pageBreak());
  children.push(secHead(9, "Estimated Labor Hours"));
  children.push(para("The following table provides estimated labor hours by role for this engagement. Actual hours will be billed on a time-and-materials basis."));
  children.push(spacer(120));

  if (sow.laborHours.format === "multi_role") {
    const rates = sow.laborHours.rates || { standard: 185, senior: 225, emergency: 285 };
    const colW = [3000, 1500, 1500, 1360, 2000];
    const rows = sow.laborHours.rows as SowLaborRowMultiRole[];
    let tStd = 0, tSr = 0, tHrs = 0, tCost = 0;

    const dataRows = rows.map((r, i) => {
      tStd += r.standardHours || 0; tSr += r.seniorHours || 0; tHrs += r.totalHours; tCost += r.estCost;
      const s = i % 2 === 1;
      return new TableRow({ children: [
        bCell(r.phase, colW[0], { shaded: s }),
        bCell(String(r.standardHours || 0), colW[1], { align: AlignmentType.CENTER, shaded: s }),
        bCell(String(r.seniorHours || 0), colW[2], { align: AlignmentType.CENTER, shaded: s }),
        bCell(String(r.totalHours), colW[3], { bold: true, align: AlignmentType.CENTER, shaded: s }),
        bCell(currency(r.estCost), colW[4], { align: AlignmentType.RIGHT, shaded: s }),
      ] });
    });

    // Totals row with navy background
    const totalsRow = new TableRow({ children: colW.map((w, i) => {
      const vals = ["TOTALS", String(tStd), String(tSr), String(tHrs), currency(tCost)];
      const aligns = [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.RIGHT];
      return new TableCell({
        width: { size: w, type: WidthType.DXA }, borders, margins: pad,
        shading: { fill: C.navy, type: ShadingType.CLEAR },
        children: [new Paragraph({ alignment: aligns[i], children: [new TextRun({ text: vals[i], font: FONT, size: 20, bold: true, color: C.white })] })],
      });
    }) });

    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: colW,
      rows: [
        new TableRow({ children: [
          hCell("Task / Phase", colW[0]),
          hCell(`Standard ($${rates.standard}/hr)`, colW[1]),
          hCell(`Senior ($${rates.senior}/hr)`, colW[2]),
          hCell("Hours Total", colW[3]),
          hCell("Est. Labor Cost", colW[4]),
        ] }),
        ...dataRows,
        totalsRow,
      ],
    }));
  } else {
    const colW = [3500, 1500, 2360, 2000];
    const rows = sow.laborHours.rows as SowLaborRowSingleRole[];
    let tHrs = 0, tCost = 0;

    const dataRows = rows.map((r, i) => {
      tHrs += r.hours; tCost += r.hours * r.rate;
      const s = i % 2 === 1;
      return new TableRow({ children: [
        bCell(r.phase, colW[0], { shaded: s }),
        bCell(String(r.hours), colW[1], { align: AlignmentType.CENTER, shaded: s }),
        bCell(r.role, colW[2], { shaded: s }),
        bCell(`$${r.rate}/hr`, colW[3], { align: AlignmentType.RIGHT, shaded: s }),
      ] });
    });

    const totalsRow = new TableRow({ children: [
      new TableCell({ width: { size: colW[0], type: WidthType.DXA }, borders, margins: pad, shading: { fill: C.navy, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "TOTALS", font: FONT, size: 20, bold: true, color: C.white })] })] }),
      new TableCell({ width: { size: colW[1], type: WidthType.DXA }, borders, margins: pad, shading: { fill: C.navy, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(tHrs), font: FONT, size: 20, bold: true, color: C.white })] })] }),
      new TableCell({ width: { size: colW[2], type: WidthType.DXA }, borders, margins: pad, shading: { fill: C.navy, type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] }),
      new TableCell({ width: { size: colW[3], type: WidthType.DXA }, borders, margins: pad, shading: { fill: C.navy, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: currency(tCost), font: FONT, size: 20, bold: true, color: C.white })] })] }),
    ] });

    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: colW,
      rows: [
        new TableRow({ children: [hCell("Phase", colW[0]), hCell("Hours", colW[1]), hCell("Role", colW[2]), hCell("Rate", colW[3])] }),
        ...dataRows,
        totalsRow,
      ],
    }));
  }

  children.push(spacer(200));

  if (sow.laborHours.notes?.length) {
    children.push(para("Notes:", { bold: true }));
    for (const n of sow.laborHours.notes) children.push(bullet(n));
  }

  // ── Assemble Document ─────────────────────────────────────

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: FONT, color: C.navy },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: FONT, color: C.blue },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [
      // Cover page
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          spacer(2400), spacer(2400),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
            children: [new TextRun({ text: "STATEMENT OF WORK", font: FONT, size: 44, bold: true, color: C.navy })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.blue, space: 8 } }, children: [] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
            children: [new TextRun({ text: sow.cover.projectName, font: FONT, size: 32, bold: true, color: C.blue })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
            children: [new TextRun({ text: `${sow.cover.client}${sow.cover.facility ? ` \u2014 ${sow.cover.facility}` : ""}`, font: FONT, size: 26, color: C.gray })] }),
          new Table({
            width: { size: 6000, type: WidthType.DXA }, columnWidths: [2400, 3600],
            alignment: AlignmentType.CENTER,
            rows: [
              lvRow("Client", sow.cover.client, false),
              ...(sow.cover.facility ? [lvRow("Facility", sow.cover.facility, true)] : []),
              lvRow("Provider", sow.cover.provider, !sow.cover.facility),
              lvRow("Billing Model", sow.cover.billingModel, !!sow.cover.facility),
              lvRow("Document Date", sow.cover.documentDate, !sow.cover.facility),
              lvRow("Version", sow.cover.version, !!sow.cover.facility),
              lvRow("Classification", sow.cover.classification, !sow.cover.facility),
              ...(sow.cover.quoteNumber ? [lvRow("Quote #", sow.cover.quoteNumber, !!sow.cover.facility)] : []),
            ],
          }),
          spacer(400),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
            children: [new TextRun({
              text: `CONFIDENTIAL \u2014 This document is proprietary to ${sow.cover.provider} and intended solely for the above-referenced organization.`,
              font: FONT, size: 16, italics: true, color: C.gray,
            })] }),
        ],
      },
      // Body
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({ children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [
              new TextRun({ text: `${sow.cover.client} \u2014 ${sow.cover.projectName}`, font: FONT, size: 16, italics: true, color: C.gray }),
            ] }),
          ] }),
        },
        footers: {
          default: new Footer({ children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [
              new TextRun({ text: "Page ", font: FONT, size: 16, color: C.gray }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: C.gray }),
              new TextRun({ text: ` | Version ${sow.cover.version} | CONFIDENTIAL`, font: FONT, size: 16, color: C.gray }),
            ] }),
          ] }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
