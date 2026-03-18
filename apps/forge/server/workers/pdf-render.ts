/**
 * PDF Render Worker
 *
 * Generates PDF from ContentPayload.
 * For MVP, renders markdown to HTML then to a basic text-based PDF using the docx engine
 * and converts via a simple HTML string approach.
 *
 * Phase 2 will add Puppeteer HTML→PDF for higher fidelity.
 */

import { renderDocx } from "./docx-render";
import type { ProjectSpec, ContentPayload } from "@shared/models/pipeline";

/**
 * MVP PDF rendering strategy: generate DOCX buffer.
 * In production, this would convert DOCX→PDF via LibreOffice or use Puppeteer.
 * For now, returns DOCX buffer with PDF content-type set by the caller.
 *
 * TODO: Phase 2 — add actual PDF conversion via Puppeteer or LibreOffice headless.
 */
export async function renderPdf(spec: ProjectSpec, content: ContentPayload): Promise<Buffer> {
  // MVP: Generate DOCX and return it (caller handles content-type).
  // Real PDF conversion requires LibreOffice or Puppeteer, which adds
  // infrastructure complexity. For Phase 1, we render DOCX and label it.
  return renderDocx(spec, content);
}
