/**
 * Caelum Statement of Work — DOCX Export Generator v2.1
 * Spec: SOW-MASTER-SPEC-v2_1.md (2026-03-12)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 *
 * Generates v2.1-compliant DOCX documents from the canonical SowDocumentV2 shape.
 * Provider name and branding are resolved per-tenant via tenantConfig.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
} from "docx";
import type { SowDocumentV2, SowLaborRowV21, SowLaborRowMultiRole, SowLaborRowSingleRole } from "../shared/models/sow";
import { isV21LaborRow } from "../shared/models/sow";
import type { TenantConfig } from "./tenantConfigLoader";

// ── Design Tokens (v2.1 LOCKED palette) ─────────────────────

const C = {
  blue: "2E5090",        // H1 headings, table headers, accent, cover title rules
  darkText: "1A1A1A",    // H2 headings, phase titles
  bodyText: "333333",    // Body text
  white: "FFFFFF",
  gray: "666666",        // Subtitle, meta text, footer/header
  borderGray: "BFBFBF",  // Table / cell borders
  bandingBlue: "F2F6FA", // Alternating row banding
};

const FONT = "Arial";
const W = 9360; // Content width: 8.5" - 2×1" margins in DXA

const bdr = { style: BorderStyle.SINGLE, size: 1, color: C.borderGray };
const borders = { top: bdr, bottom: bdr, left: bdr, right: bdr };
const noBdr = { style: BorderStyle.NONE, size: 0, color: C.white };
const noBorders = { top: noBdr, bottom: noBdr, left: noBdr, right: noBdr };
const pad = { top: 80, bottom: 80, left: 120, right: 120 };

// ── Helpers ─────────────────────────────────────────────────

function hCell(text: string, width: number, align = AlignmentType.LEFT): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders, margins: pad,
    shading: { fill: C.blue, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: C.white })] })],
  });
}

function bCell(text: string, width: number, opts: { bold?: boolean; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; shaded?: boolean; italic?: boolean } = {}): TableCell {
  const { bold = false, color = C.bodyText, align = AlignmentType.LEFT, shaded = false, italic = false } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders, margins: pad,
    shading: { fill: shaded ? C.bandingBlue : C.white, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, font: FONT, size: 20, bold, color, italics: italic })] })],
  });
}

function coverRow(label: string, value: string, shaded: boolean): TableRow {
  return new TableRow({ children: [
    new TableCell({
      width: { size: 2800, type: WidthType.DXA }, borders, margins: pad,
      shading: { fill: shaded ? C.bandingBlue : C.white, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: 20, bold: true, color: C.bodyText })] })],
    }),
    new TableCell({
      width: { size: 6560, type: WidthType.DXA }, borders, margins: pad,
      shading: { fill: shaded ? C.bandingBlue : C.white, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: value, font: FONT, size: 20, color: C.bodyText })] })],
    }),
  ] });
}

function secHead(n: string | number, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: `${n}. ${title}`, font: FONT, size: 28, bold: true, color: C.blue })],
  });
}

function subHead(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: C.darkText })],
  });
}

function para(text: string, opts: { italic?: boolean; bold?: boolean; spacing?: object } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120, ...opts.spacing },
    children: [new TextRun({ text, font: FONT, size: 22, color: C.bodyText, italics: opts.italic, bold: opts.bold })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, font: FONT, size: 20, color: C.bodyText })],
  });
}

function numbered(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, font: FONT, size: 20, color: C.bodyText })],
  });
}

function spacer(s = 120): Paragraph {
  return new Paragraph({ spacing: { after: s }, children: [] });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function stackedSignatureBlock(entityLabel: string, entityName: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 300, after: 200 }, children: [
      new TextRun({ text: `${entityLabel} — ${entityName}`, font: FONT, size: 22, bold: true, color: C.darkText }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      new TextRun({ text: "____________________________________________", font: FONT, size: 20, color: C.borderGray }),
    ] }),
    new Paragraph({ spacing: { after: 200 }, children: [
      new TextRun({ text: "Authorized Signature", font: FONT, size: 16, color: C.gray, italics: true }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      new TextRun({ text: "Printed Name: ___________________________", font: FONT, size: 18, color: C.gray }),
    ] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      new TextRun({ text: "Date: _______________", font: FONT, size: 18, color: C.gray }),
    ] }),
  ];
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
    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: [4000, 2000, 1360, 2000],
      rows: [
        new TableRow({ children: [hCell("Description", 4000), hCell("Unit Price", 2000), hCell("Qty", 1360), hCell("Ext. Price", 2000)] }),
        ...items.map((li, i) => new TableRow({ children: [
          bCell(li.description, 4000, { shaded: i % 2 === 1 }),
          bCell(`$${li.unitPrice.toLocaleString()}`, 2000, { align: AlignmentType.RIGHT, shaded: i % 2 === 1 }),
          bCell(String(li.qty), 1360, { align: AlignmentType.CENTER, shaded: i % 2 === 1 }),
          bCell(`$${li.extPrice.toLocaleString()}`, 2000, { align: AlignmentType.RIGHT, shaded: i % 2 === 1 }),
        ] })),
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
  children.push(para("The following conditions must be met prior to project commencement."));
  for (const p of sow.prerequisites) children.push(numbered(p));
  children.push(spacer(80));
  children.push(para("Delays in meeting these prerequisites may impact the project timeline and/or require a change order.", { italic: true }));

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
      if (c.notes) rows.push(new TableRow({ children: [bCell("Notes:", 1600, { bold: true }), bCell(c.notes, 3400, { italic: true })] }));
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
    // Phase heading
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blue, space: 4 } },
      children: [new TextRun({ text: `Phase ${phase.number}: ${phase.title}`, font: FONT, size: 24, bold: true, color: C.darkText })],
    }));

    // Objective
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Objective: ", font: FONT, size: 20, bold: true, color: C.blue }),
        new TextRun({ text: phase.objective, font: FONT, size: 20, color: C.bodyText }),
      ],
    }));

    // Tasks
    children.push(new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: "Tasks", font: FONT, size: 20, bold: true, color: C.darkText })],
    }));
    for (const t of phase.tasks) children.push(bullet(t));

    // Deliverables
    children.push(new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: "Deliverables", font: FONT, size: 20, bold: true, color: C.darkText })],
    }));
    for (const d of phase.deliverables) children.push(bullet(d));
    children.push(spacer(200));
  }

  // ── Section 6: Caveats & Risks ──
  children.push(pageBreak());
  children.push(secHead(6, "Caveats and Risks"));

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
    `Upon receipt of written sign-off, the project will be formally closed. Any issues or requests identified after sign-off will be handled through standard ${sow.cover.provider} support channels or scoped as a separate engagement.`,
    { italic: true }
  ));

  // ── Dynamic section numbering for Approval (optional) + Labor Hours ──
  let sectionNum = 8;

  if (sow.approval) {
    children.push(pageBreak());
    children.push(secHead(sectionNum, "Approval"));
    children.push(para(
      sow.approval.preamble ||
      `By signing below, the authorized representatives acknowledge they have reviewed this Scope of Work and agree to the terms, deliverables, prerequisites, and exclusions outlined herein.`
    ));
    children.push(para(
      `This document constitutes the complete scope for the ${sow.cover.projectName} at ${sow.cover.facility || sow.cover.client}. Work will commence upon receipt of signed approval.`,
      { italic: true }
    ));

    children.push(...stackedSignatureBlock("Client", sow.approval.clientEntity));
    children.push(...stackedSignatureBlock("Provider", sow.approval.providerEntity));
    sectionNum++;
  }

  // ── Estimated Labor Hours ──
  children.push(pageBreak());
  children.push(secHead(sectionNum, "Estimated Labor Hours"));
  children.push(spacer(120));

  const laborColW = [2800, 4360, 2200];

  // v2.1 rendering
  if (sow.laborHours.format === "v2.1" && sow.laborHours.rows.length && isV21LaborRow(sow.laborHours.rows[0])) {
    const v21Rows = sow.laborHours.rows as SowLaborRowV21[];
    const dataRows = v21Rows.map((r, i) => new TableRow({ children: [
      bCell(r.role, laborColW[0], { bold: true, shaded: i % 2 === 1 }),
      bCell(r.scope, laborColW[1], { shaded: i % 2 === 1 }),
      bCell(r.hoursRange, laborColW[2], { align: AlignmentType.CENTER, shaded: i % 2 === 1 }),
    ] }));

    // Totals row
    if (sow.laborHours.totalHoursRange) {
      dataRows.push(new TableRow({ children: [
        bCell("Total Estimated Hours", laborColW[0], { bold: true }),
        bCell("", laborColW[1]),
        bCell(sow.laborHours.totalHoursRange, laborColW[2], { bold: true, align: AlignmentType.CENTER }),
      ] }));
    }

    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: laborColW,
      rows: [
        new TableRow({ children: [
          hCell("Role", laborColW[0]),
          hCell("Scope of Involvement", laborColW[1]),
          hCell("Est. Hours", laborColW[2]),
        ] }),
        ...dataRows,
      ],
    }));
  }
  // Legacy fallback: single_role (strip pricing, render what we can)
  else if (sow.laborHours.format === "single_role") {
    const rows = sow.laborHours.rows as SowLaborRowSingleRole[];
    const dataRows = rows.map((r, i) => new TableRow({ children: [
      bCell(r.role || r.phase, laborColW[0], { bold: true, shaded: i % 2 === 1 }),
      bCell(r.phase, laborColW[1], { shaded: i % 2 === 1 }),
      bCell(String(r.hours), laborColW[2], { align: AlignmentType.CENTER, shaded: i % 2 === 1 }),
    ] }));

    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: laborColW,
      rows: [
        new TableRow({ children: [
          hCell("Role", laborColW[0]),
          hCell("Scope of Involvement", laborColW[1]),
          hCell("Est. Hours", laborColW[2]),
        ] }),
        ...dataRows,
      ],
    }));
  }
  // Legacy fallback: multi_role (strip pricing, render what we can)
  else if (sow.laborHours.format === "multi_role") {
    const rows = sow.laborHours.rows as SowLaborRowMultiRole[];
    const dataRows = rows.map((r, i) => new TableRow({ children: [
      bCell(r.phase, laborColW[0], { bold: true, shaded: i % 2 === 1 }),
      bCell("", laborColW[1], { shaded: i % 2 === 1 }),
      bCell(String(r.totalHours), laborColW[2], { align: AlignmentType.CENTER, shaded: i % 2 === 1 }),
    ] }));

    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: laborColW,
      rows: [
        new TableRow({ children: [
          hCell("Role", laborColW[0]),
          hCell("Scope of Involvement", laborColW[1]),
          hCell("Est. Hours", laborColW[2]),
        ] }),
        ...dataRows,
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
      default: { document: { run: { font: FONT, size: 22, color: C.bodyText } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: FONT, color: C.blue },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: FONT, color: C.darkText },
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
          // Vendor name header (18pt, blue, centered, bold)
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
            children: [new TextRun({ text: sow.cover.provider, font: FONT, size: 36, bold: true, color: C.blue })] }),
          // Subtitle: "Scope of Work" (14pt, gray, centered)
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
            children: [new TextRun({ text: "Scope of Work", font: FONT, size: 28, color: C.gray })] }),
          // Project title with blue top/bottom rules (16pt, dark, bold, centered)
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
            border: {
              top: { style: BorderStyle.SINGLE, size: 12, color: C.blue, space: 8 },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: C.blue, space: 8 },
            },
            children: [new TextRun({ text: sow.cover.projectName, font: FONT, size: 32, bold: true, color: C.darkText })] }),
          // Client line (13pt, blue, bold, centered)
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
            children: [new TextRun({ text: `${sow.cover.client}${sow.cover.facility ? ` — ${sow.cover.facility}` : ""}`, font: FONT, size: 26, bold: true, color: C.blue })] }),
          // Cover table (2800 / 6560 DXA)
          new Table({
            width: { size: W, type: WidthType.DXA }, columnWidths: [2800, 6560],
            alignment: AlignmentType.CENTER,
            rows: [
              coverRow("Client", sow.cover.client, false),
              ...(sow.cover.facility ? [coverRow("Facility", sow.cover.facility, true)] : []),
              coverRow("Provider", sow.cover.provider, !sow.cover.facility),
              coverRow("Billing Model", sow.cover.billingModel, !!sow.cover.facility),
              coverRow("Document Date", sow.cover.documentDate, !sow.cover.facility),
              coverRow("Version", sow.cover.version, !!sow.cover.facility),
              coverRow("Classification", sow.cover.classification, !sow.cover.facility),
              ...(sow.cover.quoteNumber ? [coverRow("Quote #", sow.cover.quoteNumber, !!sow.cover.facility)] : []),
              ...(sow.cover.expirationDate ? [coverRow("Expiration", sow.cover.expirationDate, !sow.cover.facility)] : []),
            ],
          }),
          spacer(400),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
            children: [new TextRun({
              text: `CONFIDENTIAL — This document is proprietary to ${sow.cover.provider} and intended solely for the above-referenced organization.`,
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
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.blue, space: 2 } },
              children: [
                new TextRun({
                  text: `${sow.cover.facility || sow.cover.client} — ${sow.cover.projectName}`,
                  font: FONT, size: 16, italics: true, color: C.gray,
                }),
              ],
            }),
          ] }),
        },
        footers: {
          default: new Footer({ children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.blue, space: 2 } },
              children: [
                new TextRun({ text: "Page ", font: FONT, size: 16, color: C.gray }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: C.gray }),
                new TextRun({ text: ` | ${sow.cover.provider} | Confidential`, font: FONT, size: 16, color: C.gray }),
              ],
            }),
          ] }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
