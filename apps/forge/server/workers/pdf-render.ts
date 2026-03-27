/**
 * PDF Render Worker
 *
 * Generates PDF from ContentPayload using two strategies:
 *
 * 1. Primary: HTML → PDF via Puppeteer (if available on the platform)
 * 2. Fallback: HTML string-based PDF with proper formatting
 *
 * Uses the existing HTML render engine for consistent styling, then
 * converts to PDF via headless Chrome when Puppeteer is installed,
 * or falls back to a minimal PDF generator for environments without
 * Chrome (CI, lightweight Railway containers).
 */

import { renderHtml } from './html-render';
import type { ProjectSpec, ContentPayload } from '@shared/models/pipeline';

/**
 * Render a PDF from the content payload.
 * Attempts Puppeteer first, falls back to minimal PDF if unavailable.
 */
export async function renderPdf(spec: ProjectSpec, content: ContentPayload): Promise<Buffer> {
  const html = renderHtml(spec, content);

  // Try Puppeteer (available when chromium is installed)
  try {
    return await renderWithPuppeteer(html, spec);
  } catch {
    // Fallback: generate a minimal but valid PDF from HTML content
    return renderMinimalPdf(spec, content);
  }
}

/**
 * Puppeteer-based HTML → PDF conversion.
 * Produces high-fidelity PDFs with CSS support, pagination, headers/footers.
 */
async function renderWithPuppeteer(html: string, spec: ProjectSpec): Promise<Buffer> {
  // Dynamic import — puppeteer may not be installed in all environments
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1in', right: '0.75in', bottom: '1in', left: '0.75in' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:9px; color:#666; width:100%; text-align:center; padding:5px 20px;">
          <span>${escapeHtmlForPdf(spec.title)}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size:9px; color:#666; width:100%; display:flex; justify-content:space-between; padding:5px 20px;">
          <span>Powered by Ducky Intelligence</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Minimal PDF generator — produces a valid PDF without external dependencies.
 * Uses PDF 1.4 spec with basic text rendering. Not pixel-perfect but functional.
 */
function renderMinimalPdf(spec: ProjectSpec, content: ContentPayload): Buffer {
  const lines: string[] = [];
  const pageWidth = 595; // A4 width in points
  const pageHeight = 842; // A4 height in points
  const margin = 72; // 1 inch margins
  const lineHeight = 14;
  const maxLineWidth = pageWidth - margin * 2;
  const charsPerLine = Math.floor(maxLineWidth / 6); // ~6pt per char at 10pt font

  // Flatten content into lines
  lines.push(spec.title);
  lines.push('');
  lines.push(`Audience: ${spec.audience} | Tone: ${spec.tone}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const section of content.sections) {
    lines.push(section.title.toUpperCase());
    lines.push('');

    // Word-wrap the content
    const plainText = section.content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    for (const paragraph of plainText.split('\n')) {
      if (paragraph.trim() === '') { lines.push(''); continue; }
      const words = paragraph.split(' ');
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > charsPerLine) {
          lines.push(currentLine.trim());
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('Powered by Ducky Intelligence.');

  // Build PDF objects
  const objects: string[] = [];
  const objectOffsets: number[] = [];
  let offset = 0;

  function addObject(content: string): number {
    const num = objects.length + 1;
    objectOffsets.push(offset);
    const obj = `${num} 0 obj\n${content}\nendobj\n`;
    objects.push(obj);
    offset += obj.length;
    return num;
  }

  // Calculate pages
  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['(empty document)']);

  // Obj 1: Catalog
  addObject('<< /Type /Catalog /Pages 2 0 R >>');

  // Obj 2: Pages (placeholder — will be patched)
  const pagesObjNum = objects.length + 1;
  const pageObjNums: number[] = [];
  // Reserve the Pages object spot
  addObject('PLACEHOLDER');

  // Obj 3: Font
  const fontObjNum = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  // Create page objects
  for (let p = 0; p < pages.length; p++) {
    const pageLines = pages[p];

    // Build content stream
    let stream = 'BT\n';
    stream += `/F1 10 Tf\n`;
    stream += `${margin} ${pageHeight - margin} Td\n`;

    for (const line of pageLines) {
      const escaped = line
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

      // Check if it's a title/heading (all caps or first line)
      if (line === lines[0]) {
        stream += `/F1 16 Tf\n`;
        stream += `(${escaped}) Tj\n`;
        stream += `0 -${lineHeight * 1.5} Td\n`;
        stream += `/F1 10 Tf\n`;
      } else if (line === line.toUpperCase() && line.length > 2 && line !== '---') {
        stream += `/F1 12 Tf\n`;
        stream += `(${escaped}) Tj\n`;
        stream += `0 -${lineHeight * 1.2} Td\n`;
        stream += `/F1 10 Tf\n`;
      } else {
        stream += `(${escaped}) Tj\n`;
        stream += `0 -${lineHeight} Td\n`;
      }
    }

    stream += 'ET\n';
    const streamBytes = Buffer.from(stream, 'utf-8');

    // Content stream object
    const streamObjNum = addObject(
      `<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`,
    );

    // Page object
    const pageObjNum = addObject(
      `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>`,
    );
    pageObjNums.push(pageObjNum);
  }

  // Patch Pages object
  const kidsStr = pageObjNums.map(n => `${n} 0 R`).join(' ');
  objects[pagesObjNum - 1] = `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>\nendobj\n`;

  // Recalculate offsets
  let recalcOffset = 0;
  for (let i = 0; i < objects.length; i++) {
    objectOffsets[i] = recalcOffset;
    recalcOffset += objects[i].length;
  }

  // Build the PDF
  const header = '%PDF-1.4\n';
  const body = objects.join('');
  const xrefOffset = header.length + body.length;

  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) {
    const off = header.length + objectOffsets[i];
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, 'utf-8');
}

function escapeHtmlForPdf(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
