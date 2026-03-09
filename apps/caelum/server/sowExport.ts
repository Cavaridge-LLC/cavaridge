import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableCell,
  TableRow,
  Table,
  WidthType,
  BorderStyle,
  ShadingType,
  Tab,
  TabStopType,
  TabStopPosition,
} from "docx";
import type { TenantConfig } from "./tenantConfigLoader";

const DEFAULT_TENANT_CONFIG: TenantConfig = {
  vendorName: "Dedicated IT",
  vendorAbbreviation: "DIT",
  parentCompany: "Cavaridge, LLC",
  appName: "Caelum",
  confidentialFooter: "Dedicated IT \u2014 Confidential",
  vendorSignatureLabel: "Dedicated IT Representative:",
  rateCard: [],
  mandatoryPmTasks: [],
  scopeTypeAddOns: [],
};

const LAYOUT = {
  PAGE_WIDTH: 612,
  PAGE_HEIGHT: 792,
  MARGIN: { top: 55, bottom: 50, left: 54, right: 54 },
  FOOTER_HEIGHT: 30,
  get CONTENT_WIDTH() { return this.PAGE_WIDTH - this.MARGIN.left - this.MARGIN.right; },
  get USABLE_BOTTOM() { return this.PAGE_HEIGHT - this.MARGIN.bottom - this.FOOTER_HEIGHT; },
  FONT: {
    TITLE: { size: 24, font: 'Helvetica-Bold' },
    SECTION_LABEL: { size: 9, font: 'Helvetica-Bold' },
    SECTION_TITLE: { size: 14, font: 'Helvetica-Bold' },
    SUBSECTION: { size: 10.5, font: 'Helvetica-Bold' },
    BODY: { size: 9.5, font: 'Helvetica' },
    SMALL: { size: 8.5, font: 'Helvetica' },
    CAPTION: { size: 7.5, font: 'Helvetica' },
    FOOTER: { size: 7, font: 'Helvetica' },
  },
  SECTION_GAP: 20,
  SUBSECTION_GAP: 12,
  PARA_GAP: 8,
  LINE_HEIGHT: 1.4,
  BULLET_INDENT: 16,
  PHASE_GUTTER: 18,
  COLOR: {
    PRIMARY: '#0f172a',
    BODY: '#334155',
    MUTED: '#64748b',
    LIGHT: '#94a3b8',
    ACCENT: '#2563eb',
    BORDER: '#e2e8f0',
    BG_ALT: '#f8fafc',
    BG_TOTAL: '#f1f5f9',
    WHITE: '#ffffff',
    RISK_HIGH: '#dc2626',
    RISK_MEDIUM: '#d97706',
    RISK_LOW: '#16a34a',
  },
} as const;

function ensureSpace(doc: InstanceType<typeof PDFDocument>, needed: number): void {
  const remaining = LAYOUT.USABLE_BOTTOM - doc.y;
  if (remaining < needed) {
    doc.addPage();
    addHeaderBar(doc);
    doc.y = LAYOUT.MARGIN.top;
  }
}

function addHeaderBar(doc: InstanceType<typeof PDFDocument>): void {
  doc.save();
  doc.rect(0, 0, LAYOUT.PAGE_WIDTH, 3).fill(LAYOUT.COLOR.PRIMARY);
  doc.restore();
}

function renderCoverPage(doc: InstanceType<typeof PDFDocument>, sow: any, tenantConfig: TenantConfig = DEFAULT_TENANT_CONFIG): void {
  doc.rect(0, 0, LAYOUT.PAGE_WIDTH, 8).fill(LAYOUT.COLOR.PRIMARY);

  doc.font('Helvetica').fontSize(11).fillColor(LAYOUT.COLOR.MUTED);
  doc.text(tenantConfig.vendorName, 0, 80, { align: 'center', width: LAYOUT.PAGE_WIDTH });

  doc.moveTo(LAYOUT.PAGE_WIDTH * 0.3, 100)
     .lineTo(LAYOUT.PAGE_WIDTH * 0.7, 100)
     .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();

  doc.font('Helvetica-Bold').fontSize(22).fillColor(LAYOUT.COLOR.PRIMARY);
  doc.text(sow.title || 'Scope of Work', LAYOUT.MARGIN.left, 130, {
    align: 'center',
    width: LAYOUT.CONTENT_WIDTH,
  });

  if (sow.subtitle) {
    doc.font('Helvetica').fontSize(10.5).fillColor(LAYOUT.COLOR.BODY);
    doc.text(sow.subtitle, LAYOUT.MARGIN.left, doc.y + 10, {
      align: 'center',
      width: LAYOUT.CONTENT_WIDTH,
    });
  }

  if (sow.scopeType) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(LAYOUT.COLOR.ACCENT);
    doc.text(`Scope Type: ${sow.scopeType}`, 0, doc.y + 14, {
      align: 'center',
      width: LAYOUT.PAGE_WIDTH,
    });
  }

  const metaY = LAYOUT.PAGE_HEIGHT - 200;

  doc.font('Helvetica').fontSize(9).fillColor(LAYOUT.COLOR.MUTED);
  doc.text('PREPARED FOR', 0, metaY, { align: 'center', width: LAYOUT.PAGE_WIDTH });

  doc.font('Helvetica-Bold').fontSize(14).fillColor(LAYOUT.COLOR.PRIMARY);
  const clientName = sow.clientName || sow.projectManagement?.siteAddress?.split(',')[0] || sow.title?.split(' - ')[0] || sow.title?.split('/')[0]?.trim() || 'Client';
  doc.text(clientName, 0, metaY + 18, { align: 'center', width: LAYOUT.PAGE_WIDTH });

  if (sow.projectManagement?.siteAddress) {
    doc.font('Helvetica').fontSize(9).fillColor(LAYOUT.COLOR.BODY);
    doc.text(sow.projectManagement.siteAddress, 0, metaY + 38, {
      align: 'center',
      width: LAYOUT.PAGE_WIDTH,
    });
  }

  doc.font('Helvetica').fontSize(9).fillColor(LAYOUT.COLOR.MUTED);
  doc.text('DATE', 0, metaY + 62, { align: 'center', width: LAYOUT.PAGE_WIDTH });

  doc.font('Helvetica').fontSize(11).fillColor(LAYOUT.COLOR.PRIMARY);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(dateStr, 0, metaY + 78, { align: 'center', width: LAYOUT.PAGE_WIDTH });

  doc.rect(0, LAYOUT.PAGE_HEIGHT - 8, LAYOUT.PAGE_WIDTH, 8).fill(LAYOUT.COLOR.PRIMARY);

  doc.font('Helvetica').fontSize(7).fillColor(LAYOUT.COLOR.LIGHT);
  doc.text('CONFIDENTIAL -- This document contains proprietary information.', 0, LAYOUT.PAGE_HEIGHT - 22, {
    align: 'center',
    width: LAYOUT.PAGE_WIDTH,
  });
}

function renderSectionHeader(doc: InstanceType<typeof PDFDocument>, num: number | string, title: string): void {
  ensureSpace(doc, 50);

  if (doc.y > LAYOUT.MARGIN.top + 10) {
    doc.y += LAYOUT.SECTION_GAP;
    ensureSpace(doc, 50);
  }

  const x = LAYOUT.MARGIN.left;

  doc.font(LAYOUT.FONT.SECTION_LABEL.font)
     .fontSize(LAYOUT.FONT.SECTION_LABEL.size)
     .fillColor(LAYOUT.COLOR.ACCENT);
  doc.text(`SECTION ${num}`, x, doc.y, { width: LAYOUT.CONTENT_WIDTH });

  doc.font(LAYOUT.FONT.SECTION_TITLE.font)
     .fontSize(LAYOUT.FONT.SECTION_TITLE.size)
     .fillColor(LAYOUT.COLOR.PRIMARY);
  doc.text(title, x, doc.y + 2, { width: LAYOUT.CONTENT_WIDTH });

  const lineY = doc.y + 4;
  doc.moveTo(x, lineY).lineTo(x + LAYOUT.CONTENT_WIDTH, lineY)
     .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.75).stroke();

  doc.y = lineY + 12;
}

function renderBodyText(doc: InstanceType<typeof PDFDocument>, text: string): void {
  doc.font(LAYOUT.FONT.BODY.font)
     .fontSize(LAYOUT.FONT.BODY.size)
     .fillColor(LAYOUT.COLOR.BODY);
  doc.text(text, LAYOUT.MARGIN.left, doc.y, {
    width: LAYOUT.CONTENT_WIDTH,
    lineGap: 3,
  });
  doc.y += LAYOUT.PARA_GAP;
}

function renderBulletList(doc: InstanceType<typeof PDFDocument>, items: string[], bullet = '-'): void {
  const x = LAYOUT.MARGIN.left;
  const textX = x + LAYOUT.BULLET_INDENT;
  const textWidth = LAYOUT.CONTENT_WIDTH - LAYOUT.BULLET_INDENT;

  items.forEach(item => {
    doc.font(LAYOUT.FONT.BODY.font).fontSize(LAYOUT.FONT.BODY.size);
    const itemH = doc.heightOfString(item, { width: textWidth, lineGap: 2 }) + 4;
    ensureSpace(doc, Math.min(itemH, 20));
    const startY = doc.y;

    doc.fillColor(LAYOUT.COLOR.MUTED);
    doc.text(bullet, x, startY, { continued: false });

    doc.fillColor(LAYOUT.COLOR.BODY);
    doc.text(item, textX, startY, { width: textWidth, lineGap: 2 });

    doc.y += 3;
  });
}

function renderSubsectionHeader(doc: InstanceType<typeof PDFDocument>, title: string): void {
  ensureSpace(doc, 30);
  doc.y += LAYOUT.SUBSECTION_GAP;

  doc.font(LAYOUT.FONT.SUBSECTION.font)
     .fontSize(LAYOUT.FONT.SUBSECTION.size)
     .fillColor(LAYOUT.COLOR.PRIMARY);
  doc.text(title, LAYOUT.MARGIN.left, doc.y, { width: LAYOUT.CONTENT_WIDTH });
  doc.y += 6;
}

interface TableOptions {
  headerBg?: string;
  headerColor?: string;
  fontSize?: number;
  rowHeight?: number;
  headerHeight?: number;
  lastRowIsTotal?: boolean;
  colAligns?: ('left' | 'right' | 'center')[];
}

function renderStyledTable(
  doc: InstanceType<typeof PDFDocument>,
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[],
  options: TableOptions = {}
): void {
  const {
    headerBg = LAYOUT.COLOR.PRIMARY,
    headerColor = LAYOUT.COLOR.WHITE,
    fontSize = 8.5,
    rowHeight = 22,
    headerHeight = 26,
    lastRowIsTotal = false,
    colAligns,
  } = options;

  const x = LAYOUT.MARGIN.left;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  const totalHeight = headerHeight + (rows.length * rowHeight) + 4;
  if (totalHeight < LAYOUT.USABLE_BOTTOM - LAYOUT.MARGIN.top) {
    ensureSpace(doc, totalHeight);
  }

  function drawHeader(startY: number) {
    doc.rect(x, startY, tableWidth, headerHeight).fill(headerBg);

    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(headerColor);
    let cellX = x;
    headers.forEach((h, i) => {
      const align = colAligns?.[i] || 'left';
      doc.text(h, cellX + 8, startY + headerHeight / 2 - fontSize / 2, {
        width: colWidths[i] - 16,
        align,
        lineBreak: false,
      });
      cellX += colWidths[i];
    });

    return startY + headerHeight;
  }

  let y = drawHeader(doc.y);

  rows.forEach((row, rowIdx) => {
    const isTotal = lastRowIsTotal && rowIdx === rows.length - 1;
    const isAlt = rowIdx % 2 === 1;

    doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    let maxCellH = rowHeight;
    row.forEach((cell, i) => {
      const cellStr = String(cell ?? '');
      const h = doc.heightOfString(cellStr, { width: colWidths[i] - 16, lineGap: 1 }) + 8;
      if (h > maxCellH) maxCellH = h;
    });
    const dynamicRowH = Math.max(rowHeight, maxCellH);

    if (y + dynamicRowH > LAYOUT.USABLE_BOTTOM) {
      doc.addPage();
      addHeaderBar(doc);
      y = drawHeader(LAYOUT.MARGIN.top);
    }

    if (isTotal) {
      doc.rect(x, y, tableWidth, dynamicRowH).fill(LAYOUT.COLOR.BG_TOTAL);
    } else if (isAlt) {
      doc.rect(x, y, tableWidth, dynamicRowH).fill(LAYOUT.COLOR.BG_ALT);
    }

    doc.moveTo(x, y + dynamicRowH).lineTo(x + tableWidth, y + dynamicRowH)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.25).stroke();

    doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(fontSize)
       .fillColor(LAYOUT.COLOR.BODY);

    let cellX = x;
    row.forEach((cell, i) => {
      const cellStr = String(cell ?? '');
      const align = colAligns?.[i] || 'left';
      doc.text(cellStr, cellX + 8, y + 4, {
        width: colWidths[i] - 16,
        align,
        lineGap: 1,
      });
      cellX += colWidths[i];
    });

    y += dynamicRowH;
  });

  doc.moveTo(x, y).lineTo(x + tableWidth, y)
     .strokeColor(LAYOUT.COLOR.PRIMARY).lineWidth(1).stroke();

  doc.y = y + 12;
}

function measureItems(doc: InstanceType<typeof PDFDocument>, items: string[], width: number, fs: number): number[] {
  return items.map(item => {
    doc.font('Helvetica').fontSize(fs);
    return doc.heightOfString(item, { width: width - 12, lineGap: 1 }) + 4;
  });
}

function renderPhaseBlock(doc: InstanceType<typeof PDFDocument>, phase: any, phaseNum: number): void {
  const x = LAYOUT.MARGIN.left;
  const halfWidth = (LAYOUT.CONTENT_WIDTH - LAYOUT.PHASE_GUTTER) / 2;
  const rightX = x + halfWidth + LAYOUT.PHASE_GUTTER;
  const fs = 8.5;

  const tasks: string[] = phase.tasks || [];
  const deliverables: string[] = phase.deliverables || [];

  const taskHeights = measureItems(doc, tasks, halfWidth, fs);
  const delivHeights = measureItems(doc, deliverables, halfWidth, fs);

  const totalTaskH = taskHeights.reduce((a, b) => a + b, 0);
  const totalDelivH = delivHeights.reduce((a, b) => a + b, 0);
  const columnH = Math.max(totalTaskH, totalDelivH);

  const phaseName = phase.phase || phase.name || phase.title || '';
  const phaseLabel = /^Phase\s+\d+/i.test(phaseName) ? phaseName : `Phase ${phaseNum}: ${phaseName}`;

  doc.font('Helvetica-Bold').fontSize(10.5);
  const titleH = doc.heightOfString(phaseLabel, { width: LAYOUT.CONTENT_WIDTH }) + 4;
  const objectiveH = phase.objective ? doc.heightOfString(phase.objective, { width: LAYOUT.CONTENT_WIDTH }) + 8 : 0;
  const headerH = titleH + objectiveH + 22;
  const totalBlock = headerH + columnH + 16;

  const pageAvail = LAYOUT.USABLE_BOTTOM - LAYOUT.MARGIN.top;
  if (totalBlock <= pageAvail * 0.9) {
    ensureSpace(doc, totalBlock);
  } else {
    ensureSpace(doc, Math.min(headerH + 60, pageAvail));
  }

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(LAYOUT.COLOR.PRIMARY);
  doc.text(phaseLabel, x, doc.y, { width: LAYOUT.CONTENT_WIDTH });

  if (phase.objective) {
    doc.font('Helvetica-Oblique').fontSize(fs).fillColor(LAYOUT.COLOR.MUTED);
    doc.text(phase.objective, x, doc.y + 2, { width: LAYOUT.CONTENT_WIDTH });
  }

  doc.y += 6;

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(LAYOUT.COLOR.MUTED);
  doc.text('TASKS', x, doc.y);
  doc.text('DELIVERABLES', rightX, doc.y);

  const colStartY = doc.y + 12;

  let taskY = colStartY;
  let delivY = colStartY;

  const pageBreakSync = (targetY: number): number => {
    if (targetY + 16 > LAYOUT.USABLE_BOTTOM) {
      doc.addPage();
      addHeaderBar(doc);
      return LAYOUT.MARGIN.top;
    }
    return targetY;
  };

  tasks.forEach((task, i) => {
    taskY = pageBreakSync(taskY);
    doc.font('Helvetica').fontSize(fs);
    doc.fillColor(LAYOUT.COLOR.MUTED).text('>', x, taskY, { continued: false });
    doc.fillColor(LAYOUT.COLOR.BODY);
    doc.text(task, x + 12, taskY, { width: halfWidth - 12, lineGap: 1 });
    taskY = doc.y + 4;
  });

  let currentPageForDeliv = colStartY;
  deliverables.forEach((deliv, i) => {
    currentPageForDeliv = pageBreakSync(currentPageForDeliv);
    if (currentPageForDeliv === LAYOUT.MARGIN.top && delivY !== LAYOUT.MARGIN.top) {
      delivY = LAYOUT.MARGIN.top;
    } else {
      delivY = currentPageForDeliv;
    }

    doc.font('Helvetica').fontSize(fs);
    doc.fillColor(LAYOUT.COLOR.ACCENT).text('*', rightX, delivY, { continued: false });
    doc.fillColor(LAYOUT.COLOR.BODY);
    doc.text(deliv, rightX + 12, delivY, { width: halfWidth - 12, lineGap: 1 });
    currentPageForDeliv = doc.y + 4;
    delivY = currentPageForDeliv;
  });

  doc.y = Math.max(taskY, delivY) + 6;

  doc.moveTo(x, doc.y).lineTo(x + LAYOUT.CONTENT_WIDTH, doc.y)
     .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.25).stroke();
  doc.y += 6;
}

function renderRiskBlock(doc: InstanceType<typeof PDFDocument>, risk: any, tenantConfig: TenantConfig = DEFAULT_TENANT_CONFIG): void {
  const x = LAYOUT.MARGIN.left;
  const halfWidth = (LAYOUT.CONTENT_WIDTH - LAYOUT.PHASE_GUTTER) / 2;

  ensureSpace(doc, 100);

  const likelihood = risk.likelihood || 'Medium';
  const severityColor = likelihood === 'High' ? LAYOUT.COLOR.RISK_HIGH
    : likelihood === 'Medium' ? LAYOUT.COLOR.RISK_MEDIUM
    : LAYOUT.COLOR.RISK_LOW;

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(LAYOUT.COLOR.PRIMARY);
  doc.text(risk.risk || risk.title || risk.name || '', x, doc.y, { width: LAYOUT.CONTENT_WIDTH - 60 });

  const badgeY = doc.y - 12;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(severityColor);
  doc.text(`[${likelihood}]`, x + LAYOUT.CONTENT_WIDTH - 55, badgeY > LAYOUT.MARGIN.top ? badgeY : doc.y, {
    width: 55,
    align: 'right',
  });

  if (risk.impact) {
    doc.font('Helvetica').fontSize(8.5).fillColor(LAYOUT.COLOR.BODY);
    doc.text(`Impact: ${risk.impact}`, x, doc.y + 4, { width: LAYOUT.CONTENT_WIDTH });
  }

  doc.y += 6;

  const rightX = x + halfWidth + LAYOUT.PHASE_GUTTER;
  const mitigStartY = doc.y;

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(LAYOUT.COLOR.MUTED);
  doc.text(`MITIGATION (${tenantConfig.vendorName.toUpperCase()})`, x, mitigStartY);
  doc.font('Helvetica').fontSize(8.5).fillColor(LAYOUT.COLOR.BODY);
  doc.text(risk.mitigationDIT || risk.vendorMitigation || risk.mitigationVendor || '', x, mitigStartY + 12, {
    width: halfWidth,
    lineGap: 1,
  });
  const leftEnd = doc.y;

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(LAYOUT.COLOR.MUTED);
  doc.text('MITIGATION (CLIENT)', rightX, mitigStartY);
  doc.font('Helvetica').fontSize(8.5).fillColor(LAYOUT.COLOR.BODY);
  doc.text(risk.mitigationClient || risk.clientMitigation || '', rightX, mitigStartY + 12, {
    width: halfWidth,
    lineGap: 1,
  });
  const rightEnd = doc.y;

  doc.y = Math.max(leftEnd, rightEnd) + 4;

  if (risk.decision) {
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(LAYOUT.COLOR.MUTED);
    doc.text(`Decision: ${risk.decision}`, x, doc.y, { width: LAYOUT.CONTENT_WIDTH });
  }

  doc.y += 6;

  doc.moveTo(x, doc.y).lineTo(x + LAYOUT.CONTENT_WIDTH, doc.y)
     .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.25).stroke();
  doc.y += 6;
}

function renderWorkloadTable(doc: InstanceType<typeof PDFDocument>, estimate: any): void {
  const x = LAYOUT.MARGIN.left;
  const fs = 8.5;
  const headerH = 26;
  const pad = 8;
  const cols = [
    { header: 'ROLE', width: 100, align: 'left' as const },
    { header: 'RATE', width: 50, align: 'right' as const },
    { header: 'HOURS', width: 50, align: 'right' as const },
    { header: 'SUBTOTAL', width: 65, align: 'right' as const },
    { header: 'DESCRIPTION', width: LAYOUT.CONTENT_WIDTH - 265, align: 'left' as const },
  ];
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  function drawHeader(startY: number) {
    doc.rect(x, startY, tableWidth, headerH).fill(LAYOUT.COLOR.PRIMARY);
    doc.font('Helvetica-Bold').fontSize(fs).fillColor(LAYOUT.COLOR.WHITE);
    let cx = x;
    cols.forEach(col => {
      doc.text(col.header, cx + pad, startY + headerH / 2 - fs / 2, {
        width: col.width - pad * 2,
        align: col.align,
        lineBreak: false,
      });
      cx += col.width;
    });
    return startY + headerH;
  }

  let y = drawHeader(doc.y);

  let totalHours = 0;
  let totalCost = 0;

  (estimate.lineItems || []).forEach((li: any, idx: number) => {
    const sub = (li.rate || 0) * (li.hours || 0);
    totalHours += li.hours || 0;
    totalCost += sub;

    const desc = li.description || '';
    doc.font('Helvetica').fontSize(fs);
    const descWidth = cols[4].width - pad * 2;
    const descHeight = doc.heightOfString(desc, { width: descWidth, lineGap: 1 });
    const rowH = Math.max(22, descHeight + 10);

    if (y + rowH > LAYOUT.USABLE_BOTTOM) {
      doc.addPage();
      addHeaderBar(doc);
      y = drawHeader(LAYOUT.MARGIN.top);
    }

    if (idx % 2 === 1) {
      doc.rect(x, y, tableWidth, rowH).fill(LAYOUT.COLOR.BG_ALT);
    }

    doc.moveTo(x, y + rowH).lineTo(x + tableWidth, y + rowH)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.25).stroke();

    const cellValues = [
      li.role || '',
      li.rate ? `$${li.rate}` : '',
      String(li.hours || ''),
      `$${sub.toLocaleString()}`,
    ];

    doc.font('Helvetica').fontSize(fs).fillColor(LAYOUT.COLOR.BODY);
    let cx = x;
    cellValues.forEach((val, i) => {
      doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs).fillColor(LAYOUT.COLOR.BODY);
      doc.text(val, cx + pad, y + 6, {
        width: cols[i].width - pad * 2,
        align: cols[i].align,
        lineBreak: false,
      });
      cx += cols[i].width;
    });

    doc.font('Helvetica').fontSize(fs).fillColor(LAYOUT.COLOR.BODY);
    doc.text(desc, cx + pad, y + 6, {
      width: descWidth,
      lineGap: 1,
    });

    y += rowH;
  });

  doc.rect(x, y, tableWidth, 24).fill(LAYOUT.COLOR.BG_TOTAL);
  doc.moveTo(x, y + 24).lineTo(x + tableWidth, y + 24)
     .strokeColor(LAYOUT.COLOR.PRIMARY).lineWidth(1).stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor(LAYOUT.COLOR.PRIMARY);
  doc.text('TOTAL', x + pad, y + 7, { width: cols[0].width - pad * 2 });

  let cx = x + cols[0].width + cols[1].width;
  doc.text(String(totalHours), cx + pad, y + 7, {
    width: cols[2].width - pad * 2,
    align: 'right',
    lineBreak: false,
  });
  cx += cols[2].width;
  doc.fillColor(LAYOUT.COLOR.ACCENT);
  doc.text(`$${totalCost.toLocaleString()}`, cx + pad, y + 7, {
    width: cols[3].width - pad * 2,
    align: 'right',
    lineBreak: false,
  });

  doc.y = y + 36;

  if (estimate.notes) {
    doc.font('Helvetica').fontSize(7).fillColor(LAYOUT.COLOR.LIGHT);
    doc.text(estimate.notes, LAYOUT.MARGIN.left, doc.y, { width: LAYOUT.CONTENT_WIDTH });
    doc.y += 8;
  }
}

export async function generatePdf(sow: any, tc?: TenantConfig): Promise<Buffer> {
  const tenantConfig = tc || DEFAULT_TENANT_CONFIG;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: LAYOUT.MARGIN.top, bottom: LAYOUT.MARGIN.bottom, left: LAYOUT.MARGIN.left, right: LAYOUT.MARGIN.right },
      bufferPages: true,
      info: {
        Title: sow.title || 'Scope of Work',
        Author: tenantConfig.vendorName,
        Creator: 'Caelum',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderCoverPage(doc, sow, tenantConfig);

    doc.addPage();
    addHeaderBar(doc);
    doc.y = LAYOUT.MARGIN.top;

    if (sow.summary) {
      renderSectionHeader(doc, 1, 'SUMMARY');
      renderBodyText(doc, sow.summary);
    }

    if (sow.solution) {
      renderSectionHeader(doc, 2, 'PROPOSED SOLUTION');
      renderBodyText(doc, sow.solution);
    }

    if (sow.prerequisites || sow.responsibilityMatrix?.length) {
      renderSectionHeader(doc, 3, 'PREREQUISITES');

      if (sow.responsibilityMatrix?.length) {
        if (sow.accessPrerequisites?.length) {
          renderSubsectionHeader(doc, 'ACCESS AND READINESS (CLIENT PROVIDED)');
          renderBulletList(doc, sow.accessPrerequisites, '-');
        }

        renderSubsectionHeader(doc, 'RESPONSIBILITIES');
        const matrixCols = [140, Math.floor((LAYOUT.CONTENT_WIDTH - 140) / 2), Math.floor((LAYOUT.CONTENT_WIDTH - 140) / 2)];
        renderStyledTable(
          doc,
          ['Area', 'Client Responsibilities', `${tenantConfig.vendorName} Responsibilities`],
          sow.responsibilityMatrix.map((r: any) => [r.area || '', r.client || '', r.dit || '']),
          matrixCols,
          { fontSize: 8, rowHeight: 28, headerHeight: 24, colAligns: ['left', 'left', 'left'] },
        );

        if (sow.prerequisites?.thirdPartyResponsibilities?.length) {
          renderSubsectionHeader(doc, 'THIRD-PARTY RESPONSIBILITIES');
          renderBulletList(doc, sow.prerequisites.thirdPartyResponsibilities, '-');
        }
      } else if (sow.prerequisites) {
        if (sow.prerequisites.clientResponsibilities?.length) {
          renderSubsectionHeader(doc, 'CLIENT RESPONSIBILITIES');
          renderBulletList(doc, sow.prerequisites.clientResponsibilities, '-');
        }
        if (sow.prerequisites.vendorResponsibilities?.length) {
          renderSubsectionHeader(doc, `VENDOR RESPONSIBILITIES (${tenantConfig.vendorName.toUpperCase()})`);
          renderBulletList(doc, sow.prerequisites.vendorResponsibilities, '-');
        }
        if (sow.prerequisites.thirdPartyResponsibilities?.length) {
          renderSubsectionHeader(doc, 'THIRD-PARTY RESPONSIBILITIES');
          renderBulletList(doc, sow.prerequisites.thirdPartyResponsibilities, '-');
        }
      }
    }

    if (sow.dependencies?.length) {
      renderSectionHeader(doc, 4, 'DEPENDENCIES');
      renderBulletList(doc, sow.dependencies, '!');
    }

    if (sow.projectManagement) {
      renderSectionHeader(doc, 5, 'PROJECT MANAGEMENT');

      if (sow.projectManagement.siteAddress) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(LAYOUT.COLOR.PRIMARY);
        doc.text('Site Address: ', LAYOUT.MARGIN.left, doc.y, { continued: true });
        doc.font('Helvetica').fillColor(LAYOUT.COLOR.BODY);
        doc.text(sow.projectManagement.siteAddress);
        doc.y += 8;
      }

      if (sow.projectManagement.siteInfo) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(LAYOUT.COLOR.PRIMARY);
        doc.text('Connectivity: ', LAYOUT.MARGIN.left, doc.y, { continued: true });
        doc.font('Helvetica').fillColor(LAYOUT.COLOR.BODY);
        doc.text(sow.projectManagement.siteInfo);
        doc.y += 6;
      }

      if (sow.projectManagement.pocs?.length) {
        renderSubsectionHeader(doc, 'POINTS OF CONTACT');
        renderBulletList(doc, sow.projectManagement.pocs, '-');
      }

      if (sow.projectManagement.tasks?.length) {
        renderSubsectionHeader(doc, 'PROJECT MANAGEMENT TASKS');
        renderBulletList(doc, sow.projectManagement.tasks, '-');
      }
    }

    if (sow.outline?.length) {
      renderSectionHeader(doc, 6, 'HIGH-LEVEL PROJECT OUTLINE');
      sow.outline.forEach((phase: any, i: number) => {
        renderPhaseBlock(doc, phase, i + 1);
      });
    }

    if (sow.caveatsAndRisks) {
      renderSectionHeader(doc, 7, 'CAVEATS / RISKS');

      if (sow.caveatsAndRisks.assumptions?.length) {
        renderSubsectionHeader(doc, 'ASSUMPTIONS');
        renderBulletList(doc, sow.caveatsAndRisks.assumptions, '-');
      }

      if (sow.caveatsAndRisks.risks?.length) {
        renderSubsectionHeader(doc, 'RISKS');
        sow.caveatsAndRisks.risks.forEach((risk: any) => renderRiskBlock(doc, risk, tenantConfig));
      }
    }

    if (sow.changeControl) {
      renderSectionHeader(doc, 8, 'CHANGE CONTROL');
      renderBodyText(doc, sow.changeControl);
    }

    if (sow.completionCriteria?.length) {
      renderSectionHeader(doc, 9, 'ACCEPTANCE CRITERIA');
      renderBulletList(doc, sow.completionCriteria, '[ ]');
    }

    renderSectionHeader(doc, 10, 'APPROVAL');
    ensureSpace(doc, 160);
    renderBodyText(doc, sow.approval || 'By signing below, the client acknowledges they have read, understand, and agree to the terms, responsibilities, deliverables, and estimated costs outlined in this Scope of Work.');
    doc.y += 20;

    const sigX = LAYOUT.MARGIN.left;

    doc.font('Helvetica').fontSize(8).fillColor(LAYOUT.COLOR.MUTED);
    doc.text('Client Approver Name / Title:', sigX, doc.y);
    doc.y += 2;
    doc.moveTo(sigX + 150, doc.y).lineTo(sigX + LAYOUT.CONTENT_WIDTH, doc.y)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();
    doc.y += 16;

    doc.text('Signature:', sigX, doc.y);
    doc.moveTo(sigX + 60, doc.y + 10).lineTo(sigX + 280, doc.y + 10)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();
    doc.text('Date:', sigX + 320, doc.y);
    doc.moveTo(sigX + 350, doc.y + 10).lineTo(sigX + LAYOUT.CONTENT_WIDTH, doc.y + 10)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();
    doc.y += 30;

    doc.font('Helvetica').fontSize(8).fillColor(LAYOUT.COLOR.MUTED);
    doc.text(tenantConfig.vendorSignatureLabel, sigX, doc.y);
    doc.y += 2;
    doc.moveTo(sigX + 150, doc.y).lineTo(sigX + LAYOUT.CONTENT_WIDTH, doc.y)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();
    doc.y += 16;

    doc.text('Signature:', sigX, doc.y);
    doc.moveTo(sigX + 60, doc.y + 10).lineTo(sigX + 280, doc.y + 10)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();
    doc.text('Date:', sigX + 320, doc.y);
    doc.moveTo(sigX + 350, doc.y + 10).lineTo(sigX + LAYOUT.CONTENT_WIDTH, doc.y + 10)
       .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();
    doc.y += 20;

    if (sow.outOfScope?.length) {
      renderSectionHeader(doc, 11, 'OUT OF SCOPE');
      renderBulletList(doc, sow.outOfScope, 'x');
    }

    if (sow.workloadEstimate?.lineItems?.length) {
      renderSectionHeader(doc, 12, 'WORKLOAD ESTIMATE');
      renderWorkloadTable(doc, sow.workloadEstimate);
    }

    const range = doc.bufferedPageRange();
    const totalContentPages = range.count - 1;

    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);

      if (i === 0) continue;

      const pageNum = i;
      const footerY = LAYOUT.PAGE_HEIGHT - LAYOUT.MARGIN.bottom + 5;

      doc.moveTo(LAYOUT.MARGIN.left, footerY)
         .lineTo(LAYOUT.MARGIN.left + LAYOUT.CONTENT_WIDTH, footerY)
         .strokeColor(LAYOUT.COLOR.BORDER).lineWidth(0.5).stroke();

      doc.font('Helvetica').fontSize(7).fillColor(LAYOUT.COLOR.LIGHT);
      doc.text(tenantConfig.confidentialFooter, LAYOUT.MARGIN.left, footerY + 6, {
        width: LAYOUT.CONTENT_WIDTH / 2,
        lineBreak: false,
      });

      doc.text(`Page ${pageNum} of ${totalContentPages}`, LAYOUT.MARGIN.left + LAYOUT.CONTENT_WIDTH / 2, footerY + 6, {
        width: LAYOUT.CONTENT_WIDTH / 2,
        align: 'right',
        lineBreak: false,
      });
    }

    doc.end();
  });
}

export async function generateDocx(sow: any, style: 'summary' | 'detailed' = 'summary', tc?: TenantConfig): Promise<Buffer> {
  const tenantConfig = tc || DEFAULT_TENANT_CONFIG;
  if (style === 'detailed') return generateDocxDetailed(sow, tenantConfig);
  return generateDocxSummary(sow, tenantConfig);
}

async function generateDocxDetailed(sow: any, tenantConfig: TenantConfig): Promise<Buffer> {
  const children: Paragraph[] = [];

  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const addSectionHeading = (text: string) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: "FFFFFF", font: "Calibri" })],
      spacing: { before: 360, after: 120 },
      shading: { type: ShadingType.SOLID, color: "0F172A", fill: "0F172A" },
      indent: { left: 100, right: 100 },
    }));
  };

  const addPara = (text: string) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: text || "", size: 19, color: "334155", font: "Calibri" })],
      spacing: { after: 120 },
      indent: { left: 100 },
    }));
  };

  const addBulletItem = (text: string, color: string = "334155") => {
    children.push(new Paragraph({
      children: [new TextRun({ text: text || "", size: 19, color, font: "Calibri" })],
      bullet: { level: 0 },
      spacing: { after: 40 },
      indent: { left: 300 },
    }));
  };

  const addSubheading = (text: string) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: "0F172A", font: "Calibri" })],
      spacing: { before: 240, after: 80 },
      indent: { left: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" } },
    }));
  };

  const addLabelValue = (label: string, value: string) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: label + ": ", bold: true, size: 19, color: "0F172A", font: "Calibri" }),
        new TextRun({ text: value || "", size: 19, color: "334155", font: "Calibri" }),
      ],
      spacing: { after: 60 },
      indent: { left: 200 },
    }));
  };

  if (sow.title) {
    children.push(new Paragraph({
      children: [new TextRun({ text: sow.title, bold: true, size: 32, color: "0F172A", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 60 },
      shading: { type: ShadingType.SOLID, color: "F8FAFC", fill: "F8FAFC" },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" } },
    }));
  }
  if (sow.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: sow.subtitle, size: 22, color: "64748B", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }));
  }
  if (sow.scopeType) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `Scope Type: ${sow.scopeType}`, italics: true, size: 18, color: "64748B", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }));
  }

  addSectionHeading("1. Summary");
  addPara(sow.summary);

  addSectionHeading("2. Proposed Solution");
  addPara(sow.solution);

  addSectionHeading("3. Prerequisites");
  if (sow.prerequisites?.clientResponsibilities?.length) {
    addSubheading("Client Responsibilities");
    for (const item of sow.prerequisites.clientResponsibilities) addBulletItem(item);
  }
  if (sow.prerequisites?.vendorResponsibilities?.length) {
    addSubheading(`Vendor Responsibilities (${tenantConfig.vendorName})`);
    for (const item of sow.prerequisites.vendorResponsibilities) addBulletItem(item);
  }
  if (sow.prerequisites?.thirdPartyResponsibilities?.length) {
    addSubheading("Third-Party Responsibilities");
    for (const item of sow.prerequisites.thirdPartyResponsibilities) addBulletItem(item);
  }

  addSectionHeading("4. Dependencies");
  for (const item of (sow.dependencies || [])) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: "\u26A0 ", size: 19, color: "B45309", font: "Calibri" }),
        new TextRun({ text: item || "", size: 19, color: "92400E", font: "Calibri" }),
      ],
      spacing: { after: 40 },
      indent: { left: 200 },
      shading: { type: ShadingType.SOLID, color: "FFFBEB", fill: "FFFBEB" },
    }));
  }

  addSectionHeading("5. Project Management");
  if (sow.projectManagement?.siteAddress) addLabelValue("Site Address", sow.projectManagement.siteAddress);
  if (sow.projectManagement?.siteInfo) addLabelValue("Connectivity", sow.projectManagement.siteInfo);
  if (sow.projectManagement?.pocs?.length) {
    addSubheading("Points of Contact");
    for (const poc of sow.projectManagement.pocs) addBulletItem(poc);
  }
  if (sow.projectManagement?.tasks?.length) {
    addSubheading("Project Management Tasks");
    for (const task of sow.projectManagement.tasks) addBulletItem(task);
  }

  addSectionHeading("6. High-Level Project Outline");
  for (const phase of (sow.outline || [])) {
    children.push(new Paragraph({
      children: [new TextRun({ text: phase.phase || "", bold: true, size: 22, color: "1E40AF", font: "Calibri" })],
      spacing: { before: 240, after: 60 },
      shading: { type: ShadingType.SOLID, color: "EFF6FF", fill: "EFF6FF" },
      indent: { left: 100 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 6, color: "3B82F6" },
        top: noBorder, bottom: noBorder, right: noBorder,
      },
    }));

    if (phase.objective) {
      children.push(new Paragraph({
        children: [new TextRun({ text: phase.objective, italics: true, size: 18, color: "64748B", font: "Calibri" })],
        spacing: { after: 80 },
        indent: { left: 300 },
      }));
    }

    if (phase.tasks?.length) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "TASKS", bold: true, size: 16, color: "64748B", font: "Calibri" })],
        spacing: { before: 80, after: 40 },
        indent: { left: 300 },
      }));
      for (const t of phase.tasks) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "\u203A ", bold: true, size: 19, color: "3B82F6", font: "Calibri" }),
            new TextRun({ text: t, size: 19, color: "334155", font: "Calibri" }),
          ],
          spacing: { after: 30 },
          indent: { left: 400 },
        }));
      }
    }

    if (phase.deliverables?.length) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "DELIVERABLES", bold: true, size: 16, color: "64748B", font: "Calibri" })],
        spacing: { before: 80, after: 40 },
        indent: { left: 300 },
      }));
      for (const d of phase.deliverables) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "\u2713 ", bold: true, size: 19, color: "16A34A", font: "Calibri" }),
            new TextRun({ text: d, size: 19, color: "334155", font: "Calibri" }),
          ],
          spacing: { after: 30 },
          indent: { left: 400 },
        }));
      }
    }
  }

  addSectionHeading("7. Caveats / Risks");
  if (sow.caveatsAndRisks?.assumptions?.length) {
    addSubheading("Assumptions");
    for (const a of sow.caveatsAndRisks.assumptions) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "\u2022 " + a, size: 19, color: "1E40AF", font: "Calibri" })],
        spacing: { after: 30 },
        indent: { left: 200 },
        shading: { type: ShadingType.SOLID, color: "EFF6FF", fill: "EFF6FF" },
      }));
    }
  }

  if (sow.caveatsAndRisks?.risks?.length) {
    addSubheading("Risks");
    for (const risk of sow.caveatsAndRisks.risks) {
      const likelihood = risk.likelihood || "Medium";
      const lColors: Record<string, string> = { "High": "DC2626", "Medium": "D97706", "Low": "16A34A" };
      const lColor = lColors[likelihood] || lColors["Medium"];

      children.push(new Paragraph({
        children: [
          new TextRun({ text: (risk.risk || ""), bold: true, size: 20, color: "0F172A", font: "Calibri" }),
          new TextRun({ text: `  [${likelihood}]`, bold: true, size: 18, color: lColor, font: "Calibri" }),
        ],
        spacing: { before: 200, after: 40 },
        indent: { left: 200 },
        shading: { type: ShadingType.SOLID, color: "F8FAFC", fill: "F8FAFC" },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: lColor },
          top: noBorder, bottom: noBorder, right: noBorder,
        },
      }));

      addLabelValue("Impact", risk.impact);

      if (risk.mitigationDIT) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `Mitigation (${tenantConfig.vendorName}): `, bold: true, size: 18, color: "1D4ED8", font: "Calibri" }),
            new TextRun({ text: risk.mitigationDIT, size: 18, color: "334155", font: "Calibri" }),
          ],
          spacing: { after: 40 },
          indent: { left: 300 },
          shading: { type: ShadingType.SOLID, color: "EFF6FF", fill: "EFF6FF" },
        }));
      }

      if (risk.mitigationClient) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "Mitigation (Client): ", bold: true, size: 18, color: "B45309", font: "Calibri" }),
            new TextRun({ text: risk.mitigationClient, size: 18, color: "334155", font: "Calibri" }),
          ],
          spacing: { after: 40 },
          indent: { left: 300 },
          shading: { type: ShadingType.SOLID, color: "FFFBEB", fill: "FFFBEB" },
        }));
      }

      addLabelValue("Decision", risk.decision);
    }
  }

  if (sow.changeControl) {
    addSectionHeading("8. Change Control");
    addPara(sow.changeControl);
  }

  if (sow.completionCriteria?.length) {
    addSectionHeading("9. Acceptance Criteria");
    for (const item of sow.completionCriteria) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "\u2610 ", size: 19, color: "64748B", font: "Calibri" }),
          new TextRun({ text: item, size: 19, color: "334155", font: "Calibri" }),
        ],
        spacing: { after: 40 },
        indent: { left: 200 },
      }));
    }
  }

  addSectionHeading("10. Approval");
  addPara(sow.approval);

  children.push(new Paragraph({ spacing: { before: 500 } }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Client Approver Name / Title: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Signature: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
      new TextRun({ text: "    Date: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "____________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 400 },
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: `${tenantConfig.vendorSignatureLabel} `, size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Signature: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
      new TextRun({ text: "    Date: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "____________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 200 },
  }));

  if (sow.outOfScope?.length) {
    addSectionHeading("11. Out of Scope");
    for (const item of sow.outOfScope) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "\u2717 ", bold: true, size: 19, color: "DC2626", font: "Calibri" }),
          new TextRun({ text: item, size: 19, color: "DC2626", font: "Calibri" }),
        ],
        spacing: { after: 40 },
        indent: { left: 200 },
      }));
    }
  }

  if (sow.workloadEstimate?.lineItems?.length) {
    addSectionHeading("12. Workload Estimate");
    let totalHours = 0, totalCost = 0;
    const headerRow = new TableRow({
      children: ["Role", "Rate", "Hours", "Subtotal", "Description"].map((h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h.toUpperCase(), bold: true, size: 16, color: "FFFFFF", font: "Calibri" })], alignment: h === "Role" || h === "Description" ? AlignmentType.LEFT : AlignmentType.RIGHT })],
          shading: { type: ShadingType.SOLID, color: "0F172A", fill: "0F172A" },
          width: h === "Role" ? { size: 2200, type: WidthType.DXA } : h === "Description" ? { size: 3500, type: WidthType.DXA } : { size: 1100, type: WidthType.DXA },
        })
      ),
    });
    const dataRows = sow.workloadEstimate.lineItems.map((li: any, i: number) => {
      const sub = (li.rate || 0) * (li.hours || 0);
      totalHours += li.hours || 0;
      totalCost += sub;
      const bgColor = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: li.role || "", size: 18, font: "Calibri", bold: true })] })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${li.rate}`, size: 18, font: "Calibri", color: "64748B" })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(li.hours), size: 18, font: "Calibri" })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${sub.toLocaleString()}`, size: 18, font: "Calibri", bold: true })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: li.description || "", size: 18, font: "Calibri", color: "64748B" })] })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor } }),
        ],
      });
    });
    const totalRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL", size: 20, font: "Calibri", bold: true })] })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" } }),
        new TableCell({ children: [new Paragraph({ children: [], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(totalHours), size: 20, font: "Calibri", bold: true })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${totalCost.toLocaleString()}`, size: 22, font: "Calibri", bold: true, color: "1D4ED8" })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" } }),
        new TableCell({ children: [new Paragraph({ children: [] })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" } }),
      ],
    });
    children.push(new Table({
      rows: [headerRow, ...dataRows, totalRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
    if (sow.workloadEstimate.notes) {
      children.push(new Paragraph({
        children: [new TextRun({ text: sow.workloadEstimate.notes, size: 16, font: "Calibri", color: "64748B", italics: true })],
        spacing: { before: 100, after: 80 },
        indent: { left: 100 },
      }));
    }
  }

  const docxDoc = new Document({
    sections: [{
      children,
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
    }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
        },
      },
    },
  });

  return Buffer.from(await Packer.toBuffer(docxDoc));
}

async function generateDocxSummary(sow: any, tenantConfig: TenantConfig): Promise<Buffer> {
  const children: Paragraph[] = [];

  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const addHeading = (text: string) => {
    children.push(new Paragraph({
      children: [new TextRun({ text, bold: true, size: 24, color: "0F172A", font: "Calibri" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" } },
    }));
  };

  const addPara = (text: string) => {
    if (!text) return;
    const lines = text.split(/\n\n|\n/);
    for (const line of lines) {
      const trimmed = line.replace(/^[-•]\s*/, '').trim();
      if (!trimmed) continue;
      const isBullet = /^[-•]/.test(line.trim());
      if (isBullet) {
        children.push(new Paragraph({
          children: [new TextRun({ text: trimmed, size: 20, color: "334155", font: "Calibri" })],
          bullet: { level: 0 },
          spacing: { after: 60 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: trimmed, size: 20, color: "334155", font: "Calibri" })],
          spacing: { after: 120 },
        }));
      }
    }
  };

  const addBulletItem = (text: string) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: text || "", size: 20, color: "334155", font: "Calibri" })],
      bullet: { level: 0 },
      spacing: { after: 60 },
    }));
  };

  const addSubheading = (text: string) => {
    children.push(new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, color: "0F172A", font: "Calibri" })],
      spacing: { before: 200, after: 80 },
    }));
  };

  if (sow.title) {
    children.push(new Paragraph({
      children: [new TextRun({ text: sow.title, bold: true, size: 28, color: "0F172A", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 80 },
    }));
  }
  if (sow.scopeType) {
    const scopeLabel = sow.subtitle
      ? `${sow.scopeType} Scope of Work (${sow.subtitle})`
      : `${sow.scopeType} Scope of Work`;
    children.push(new Paragraph({
      children: [new TextRun({ text: scopeLabel, size: 20, color: "64748B", font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));
  }

  addHeading("Summary");
  addPara(sow.summary);

  addHeading("Proposed Solution");
  addPara(sow.solution);

  addHeading("Prerequisites");

  const hasMatrix = sow.responsibilityMatrix?.length > 0;

  if (hasMatrix) {
    if (sow.accessPrerequisites?.length) {
      addSubheading("Access and Readiness (Client Provided)");
      for (const item of sow.accessPrerequisites) addBulletItem(item);
    }

    addSubheading("Responsibilities");

    const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
    const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    const matrixHeaderRow = new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Area", bold: true, size: 18, color: "FFFFFF", font: "Calibri" })] })],
          shading: { type: ShadingType.SOLID, color: "0F172A", fill: "0F172A" },
          width: { size: 2000, type: WidthType.DXA },
          borders: cellBorders,
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Client Responsibilities", bold: true, size: 18, color: "FFFFFF", font: "Calibri" })] })],
          shading: { type: ShadingType.SOLID, color: "0F172A", fill: "0F172A" },
          width: { size: 3800, type: WidthType.DXA },
          borders: cellBorders,
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `${tenantConfig.vendorName} Responsibilities`, bold: true, size: 18, color: "FFFFFF", font: "Calibri" })] })],
          shading: { type: ShadingType.SOLID, color: "0F172A", fill: "0F172A" },
          width: { size: 3800, type: WidthType.DXA },
          borders: cellBorders,
        }),
      ],
    });

    const matrixRows = sow.responsibilityMatrix.map((row: any, i: number) => {
      const bgColor = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.area || "", bold: true, size: 18, color: "0F172A", font: "Calibri" })] })],
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
            borders: cellBorders,
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.client || "", size: 18, color: "334155", font: "Calibri" })] })],
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
            borders: cellBorders,
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: row.dit || "", size: 18, color: "334155", font: "Calibri" })] })],
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
            borders: cellBorders,
          }),
        ],
      });
    });

    children.push(new Table({
      rows: [matrixHeaderRow, ...matrixRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    if (sow.prerequisites?.thirdPartyResponsibilities?.length) {
      children.push(new Paragraph({ spacing: { before: 160 } }));
      addSubheading("Third-Party Responsibilities");
      for (const item of sow.prerequisites.thirdPartyResponsibilities) addBulletItem(item);
    }
  } else {
    if (sow.prerequisites?.clientResponsibilities?.length) {
      addSubheading("Client Responsibilities");
      for (const item of sow.prerequisites.clientResponsibilities) addBulletItem(item);
    }
    if (sow.prerequisites?.vendorResponsibilities?.length) {
      addSubheading(`Vendor Responsibilities (${tenantConfig.vendorName})`);
      for (const item of sow.prerequisites.vendorResponsibilities) addBulletItem(item);
    }
    if (sow.prerequisites?.thirdPartyResponsibilities?.length) {
      addSubheading("Third-Party Responsibilities");
      for (const item of sow.prerequisites.thirdPartyResponsibilities) addBulletItem(item);
    }
  }

  addHeading("High-Level Project Outline");
  for (const phase of (sow.outline || [])) {
    const phaseName = phase.phase || "";
    children.push(new Paragraph({
      children: [new TextRun({ text: phaseName, bold: true, size: 22, color: "0F172A", font: "Calibri" })],
      spacing: { before: 200, after: 60 },
    }));

    for (const t of (phase.tasks || [])) {
      children.push(new Paragraph({
        children: [new TextRun({ text: t, size: 20, color: "334155", font: "Calibri" })],
        bullet: { level: 0 },
        spacing: { after: 40 },
      }));
    }
  }

  addHeading("Project Management");
  if (sow.projectManagement?.siteAddress) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: "Site: ", bold: true, size: 20, color: "0F172A", font: "Calibri" }),
        new TextRun({ text: sow.projectManagement.siteAddress, size: 20, color: "334155", font: "Calibri" }),
      ],
      spacing: { after: 60 },
    }));
  }
  if (sow.projectManagement?.pocs?.length) {
    addSubheading("Points of Contact");
    for (const poc of sow.projectManagement.pocs) addBulletItem(poc);
  }
  if (sow.projectManagement?.tasks?.length) {
    addSubheading("Required PM Tasks");
    for (const task of sow.projectManagement.tasks) addBulletItem(task);
  }

  addHeading("Caveats/Risks");
  const riskBullets: string[] = [];
  if (sow.caveatsAndRisks?.risks?.length) {
    for (const risk of sow.caveatsAndRisks.risks) {
      let bullet = risk.risk || "";
      if (risk.impact) bullet += `: ${risk.impact.charAt(0).toLowerCase()}${risk.impact.slice(1)}`;
      riskBullets.push(bullet);
    }
  }
  if (sow.caveatsAndRisks?.assumptions?.length) {
    for (const a of sow.caveatsAndRisks.assumptions) {
      if (!riskBullets.some(b => b.toLowerCase().includes(a.toLowerCase().substring(0, 30)))) {
        riskBullets.push(a);
      }
    }
  }
  for (const bullet of riskBullets) addBulletItem(bullet);

  addHeading("Acceptance Criteria");
  if (sow.completionCriteria?.length) {
    for (const item of sow.completionCriteria) addBulletItem(item);
  }

  addHeading("Approval");
  addPara(sow.approval || `By approving this Scope of Work, the Client authorizes ${tenantConfig.vendorName} to perform the tasks described herein.`);

  children.push(new Paragraph({ spacing: { before: 500 } }));

  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Client Approver Name / Title: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Signature: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
      new TextRun({ text: "    Date: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "____________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 400 },
  }));

  children.push(new Paragraph({
    children: [
      new TextRun({ text: `${tenantConfig.vendorSignatureLabel} `, size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Signature: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "_________________________________", size: 20, color: "94A3B8", font: "Calibri" }),
      new TextRun({ text: "    Date: ", size: 20, color: "334155", font: "Calibri" }),
      new TextRun({ text: "____________", size: 20, color: "94A3B8", font: "Calibri" }),
    ],
    spacing: { after: 200 },
  }));

  if (sow.workloadEstimate?.lineItems?.length) {
    addHeading("Workload Estimate");
    let totalHours = 0, totalCost = 0;
    const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
    const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    const headerRow = new TableRow({
      children: ["Role", "Rate", "Hours", "Subtotal", "Description"].map((h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: "FFFFFF", font: "Calibri" })], alignment: h === "Role" || h === "Description" ? AlignmentType.LEFT : AlignmentType.RIGHT })],
          shading: { type: ShadingType.SOLID, color: "0F172A", fill: "0F172A" },
          borders: cellBorders,
          width: h === "Role" ? { size: 2200, type: WidthType.DXA } : h === "Description" ? { size: 3500, type: WidthType.DXA } : { size: 1100, type: WidthType.DXA },
        })
      ),
    });
    const dataRows = sow.workloadEstimate.lineItems.map((li: any, i: number) => {
      const sub = (li.rate || 0) * (li.hours || 0);
      totalHours += li.hours || 0;
      totalCost += sub;
      const bgColor = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: li.role || "", size: 18, font: "Calibri", bold: true })] })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor }, borders: cellBorders }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${li.rate}`, size: 18, font: "Calibri", color: "64748B" })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor }, borders: cellBorders }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(li.hours), size: 18, font: "Calibri" })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor }, borders: cellBorders }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${sub.toLocaleString()}`, size: 18, font: "Calibri", bold: true })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor }, borders: cellBorders }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: li.description || "", size: 18, font: "Calibri", color: "64748B" })] })], shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor }, borders: cellBorders }),
        ],
      });
    });
    const totalRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL", size: 18, font: "Calibri", bold: true })] })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, borders: cellBorders }),
        new TableCell({ children: [new Paragraph({ children: [] })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, borders: cellBorders }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(totalHours), size: 18, font: "Calibri", bold: true })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, borders: cellBorders }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${totalCost.toLocaleString()}`, size: 18, font: "Calibri", bold: true, color: "1D4ED8" })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, borders: cellBorders }),
        new TableCell({ children: [new Paragraph({ children: [] })], shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, borders: cellBorders }),
      ],
    });
    children.push(new Table({
      rows: [headerRow, ...dataRows, totalRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
    if (sow.workloadEstimate.notes) {
      children.push(new Paragraph({
        children: [new TextRun({ text: sow.workloadEstimate.notes, size: 18, font: "Calibri", color: "64748B", italics: true })],
        spacing: { before: 100, after: 80 },
      }));
    }
  }

  const docxDoc = new Document({
    sections: [{
      children,
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
    }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
        },
      },
    },
  });

  return Buffer.from(await Packer.toBuffer(docxDoc));
}
