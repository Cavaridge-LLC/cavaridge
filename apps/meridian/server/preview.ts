import sharp from "sharp";
import JSZip from "jszip";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { simpleParser } from "mailparser";
import { ObjectStorageService, ObjectNotFoundError } from "./replit_integrations/object_storage";
import { storage } from "./storage";
import type { Document } from "@shared/schema";
import fs from "fs";
import path from "path";

const CACHE_DIR = "/tmp/preview-cache";
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "tiff", "svg", "bmp"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const TEXT_EXTENSIONS: Record<string, string> = {
  md: "markdown", txt: "text", log: "text", cfg: "text", conf: "text",
  ini: "text", env: "text",
  json: "json", xml: "xml", yaml: "yaml", yml: "yaml",
  csv: "csv", tsv: "csv", html: "html", htm: "html", css: "css",
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  py: "python", sh: "bash", bash: "bash", sql: "sql",
  rb: "ruby", go: "go", rs: "rust", java: "java",
  c: "c", cpp: "cpp", h: "c", ps1: "powershell", bat: "text", cmd: "text",
};
const DOCX_EXTENSIONS = new Set(["docx", "doc"]);
const XLSX_EXTENSIONS = new Set(["xlsx", "xls"]);
const PPTX_EXTENSIONS = new Set(["pptx", "ppt"]);
const EMAIL_EXTENSIONS = new Set(["eml", "msg"]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "text/markdown": "md",
  "text/plain": "txt",
  "text/html": "html",
  "text/css": "css",
  "text/csv": "csv",
  "text/xml": "xml",
  "application/json": "json",
  "application/xml": "xml",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-yaml": "yaml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "message/rfc822": "eml",
};

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function resolveFileExtension(filename: string, fileType?: string | null): string {
  let ext = getFileExtension(filename);

  if (!ext || ext === filename.toLowerCase() || ext.includes("/")) {
    if (fileType && MIME_TO_EXTENSION[fileType.toLowerCase()]) {
      return MIME_TO_EXTENSION[fileType.toLowerCase()];
    }
    if (fileType && !fileType.includes("/")) {
      return fileType.toLowerCase();
    }
  }

  if (fileType && MIME_TO_EXTENSION[fileType.toLowerCase()]) {
    const mimeExt = MIME_TO_EXTENSION[fileType.toLowerCase()];
    if (mimeExt !== ext && classifyExtension(ext) === "unsupported") {
      return mimeExt;
    }
  }

  return ext || "unknown";
}

function classifyExtension(ext: string): string {
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (PDF_EXTENSIONS.has(ext)) return "pdf";
  if (TEXT_EXTENSIONS[ext]) return "text";
  if (DOCX_EXTENSIONS.has(ext)) return "html";
  if (XLSX_EXTENSIONS.has(ext)) return "spreadsheet";
  if (PPTX_EXTENSIONS.has(ext)) return "slides";
  if (EMAIL_EXTENSIONS.has(ext)) return "email";
  return "unsupported";
}

export function getPreviewType(filename: string, fileType?: string | null): string {
  const ext = resolveFileExtension(filename, fileType);
  return classifyExtension(ext);
}

const MIME_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", tiff: "image/tiff", svg: "image/svg+xml",
  pdf: "application/pdf",
};

interface ImageSize { width: number; height: number; }
const SIZE_LIMITS: Record<string, ImageSize> = {
  thumb: { width: 200, height: 200 },
  medium: { width: 800, height: 800 },
  full: { width: 4096, height: 4096 },
};

async function getFileBuffer(doc: Document): Promise<Buffer | null> {
  const objectStorage = new ObjectStorageService();
  try {
    if (doc.objectPath) {
      const file = await objectStorage.getObjectEntityFile(doc.objectPath);
      const [content] = await file.download();
      return content;
    }
    if (doc.parentArchiveId) {
      const parent = await storage.getDocument(doc.parentArchiveId);
      if (!parent?.objectPath) return null;
      const archiveFile = await objectStorage.getObjectEntityFile(parent.objectPath);
      const [archiveContent] = await archiveFile.download();
      const ext = getFileExtension(parent.filename);
      if (ext === "zip") {
        const zip = await JSZip.loadAsync(archiveContent);
        const entryPath = doc.folderPath || doc.filename;
        const entry = zip.file(entryPath);
        if (entry) {
          return Buffer.from(await entry.async("nodebuffer"));
        }
      }
      return null;
    }
    return null;
  } catch (err) {
    console.error(`[preview] Error getting file buffer for ${doc.filename}:`, err);
    return null;
  }
}

export async function generateImagePreview(
  doc: Document,
  size: string = "medium"
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const ext = getFileExtension(doc.filename);
  const contentType = MIME_TYPES[ext] || "image/jpeg";
  const sizeConfig = SIZE_LIMITS[size] || SIZE_LIMITS.medium;

  const cacheKey = `${doc.id}_${size}`;
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.jpg`);

  if (size !== "full" && fs.existsSync(cachePath)) {
    return { buffer: fs.readFileSync(cachePath), contentType: "image/jpeg" };
  }

  const buffer = await getFileBuffer(doc);
  if (!buffer) return null;

  if (size === "full") {
    return { buffer, contentType };
  }

  if (ext === "svg") {
    return { buffer, contentType: "image/svg+xml" };
  }

  try {
    const resized = await sharp(buffer)
      .resize(sizeConfig.width, sizeConfig.height, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    fs.writeFileSync(cachePath, resized);
    return { buffer: resized, contentType: "image/jpeg" };
  } catch (err) {
    console.error(`[preview] Sharp resize error for ${doc.filename}:`, err);
    return { buffer, contentType };
  }
}

export async function generatePdfPreview(doc: Document): Promise<Buffer | null> {
  return getFileBuffer(doc);
}

export async function generateTextPreview(doc: Document): Promise<{ content: string; language: string } | null> {
  const ext = getFileExtension(doc.filename);
  const language = TEXT_EXTENSIONS[ext] || "text";

  if (doc.extractedText) {
    return { content: doc.extractedText, language };
  }

  const buffer = await getFileBuffer(doc);
  if (!buffer) return null;
  return { content: buffer.toString("utf-8"), language };
}

export async function generateDocxPreview(doc: Document): Promise<{ html: string } | null> {
  const meta = doc.metadataJson as any;
  if (meta?.preview_html && meta?.preview_hash === doc.contentHash) {
    return { html: meta.preview_html };
  }

  const buffer = await getFileBuffer(doc);
  if (!buffer) return null;

  try {
    const result = await mammoth.convertToHtml({ buffer });
    return { html: result.value };
  } catch (err) {
    console.error(`[preview] DOCX conversion error for ${doc.filename}:`, err);
    return null;
  }
}

export async function generateXlsxPreview(doc: Document): Promise<{ html: string; sheets: string[] } | null> {
  const meta = doc.metadataJson as any;
  if (meta?.preview_tables && meta?.preview_hash === doc.contentHash) {
    return { html: meta.preview_tables, sheets: meta.preview_sheets || [] };
  }

  const buffer = await getFileBuffer(doc);
  if (!buffer) return null;

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheets: string[] = [];
    const htmlParts: string[] = [];

    workbook.eachSheet((sheet) => {
      const sheetName = sheet.name;
      sheets.push(sheetName);
      let tableHtml = `<table id="sheet-${sheetName}">`;
      sheet.eachRow((row) => {
        tableHtml += "<tr>";
        const values = Array.isArray(row.values) ? (row.values as any[]).slice(1) : [];
        for (const cell of values) {
          const cellStr = cell != null ? String(cell) : "";
          tableHtml += `<td>${cellStr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`;
        }
        tableHtml += "</tr>";
      });
      tableHtml += "</table>";
      htmlParts.push(`<div data-sheet="${sheetName}">${tableHtml}</div>`);
    });

    return { html: htmlParts.join("\n"), sheets };
  } catch (err) {
    console.error(`[preview] XLSX conversion error for ${doc.filename}:`, err);
    return null;
  }
}

export async function generatePptxPreview(doc: Document): Promise<{ slides: Array<{ number: number; text: string }> } | null> {
  if (doc.extractedText) {
    const slides = doc.extractedText.split(/\n---\n|\nSlide \d+/i).filter(Boolean).map((text, i) => ({
      number: i + 1,
      text: text.trim(),
    }));
    return { slides };
  }
  return null;
}

export async function generateEmailPreview(doc: Document): Promise<{
  from: string; to: string; subject: string; date: string; body_html: string; body_text: string;
} | null> {
  const buffer = await getFileBuffer(doc);
  if (!buffer) return null;

  try {
    const parsed = await simpleParser(buffer);
    return {
      from: parsed.from?.text || "",
      to: (Array.isArray(parsed.to) ? parsed.to.map(a => a.text).join(", ") : parsed.to?.text) || "",
      subject: parsed.subject || "",
      date: parsed.date?.toISOString() || "",
      body_html: parsed.html || "",
      body_text: parsed.text || "",
    };
  } catch (err) {
    console.error(`[preview] Email parse error for ${doc.filename}:`, err);
    return null;
  }
}

export function getDocumentMetadata(doc: Document, chunkCount: number, findingCount: number) {
  const ext = resolveFileExtension(doc.filename, doc.fileType);
  let previewType = getPreviewType(doc.filename, doc.fileType);
  if (previewType === "unsupported" && doc.extractedText) {
    previewType = "fallback";
  }
  const meta = doc.metadataJson as any;

  return {
    id: doc.id,
    filename: doc.filename,
    file_type: ext,
    file_size: doc.fileSize,
    classification: doc.classification,
    extraction_status: doc.extractionStatus,
    preview_type: previewType,
    text_length: doc.textLength,
    chunk_count: chunkCount,
    finding_count: findingCount,
    content_hash: doc.contentHash,
    created_at: doc.createdAt,
    parent_archive_id: doc.parentArchiveId,
    folder_path: doc.folderPath,
    deal_id: doc.dealId,
    vision_analysis: meta?.vision_result || null,
    extracted_text_preview: doc.extractedText?.slice(0, 500) || null,
  };
}

export function clearPreviewCache(documentId: string) {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      if (f.startsWith(documentId)) {
        fs.unlinkSync(path.join(CACHE_DIR, f));
      }
    }
  } catch {}
}
