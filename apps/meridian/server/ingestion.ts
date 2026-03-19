import { createHash } from "crypto";
import { createRequire } from "module";
import { storage } from "./storage";
import { ObjectStorageService } from "./services/object-storage";
import AdmZip from "adm-zip";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { simpleParser } from "mailparser";
import {
  chatCompletion as spanielChat,
  hasAICapability,
} from "@cavaridge/spaniel";
import { analyzeImage, checkImageSize, hasVisionCapability, isImageFile, type VisionResult, CLASSIFICATION_TO_PILLAR } from "./vision";
import { classifyDocumentAI } from "./document-classifier";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const objectStorageService = new ObjectStorageService();

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024;
const MAX_ZIP_DEPTH = 3;
const MAX_FILENAME_LENGTH = 100;

const HIDDEN_PATTERNS = [
  /^\./,
  /__MACOSX\//,
  /\.DS_Store$/,
  /Thumbs\.db$/i,
];

const CONTENT_CLASSIFICATION_RULES: Array<{ pattern: RegExp; classification: string }> = [
  { pattern: /HIPAA|compliance officer|risk assessment|audit finding/i, classification: "Compliance Documentation" },
  { pattern: /vulnerability|pentest|penetration test|CVE-|CVSS/i, classification: "Security Assessment" },
  { pattern: /network diagram|VLAN|subnet|firewall rule|topology/i, classification: "Network Documentation" },
  { pattern: /service level agreement|SLA|master service|terms and conditions/i, classification: "Vendor Contract" },
  { pattern: /password policy|acceptable use|incident response|disaster recovery/i, classification: "IT Policy" },
  { pattern: /asset tag|serial number|inventory|hardware list/i, classification: "Asset Inventory" },
  { pattern: /org chart|headcount|job description|IT staff/i, classification: "Organization & Staffing" },
  { pattern: /budget|forecast|IT spend|cost center/i, classification: "IT Financial" },
  { pattern: /backup|recovery point|RTO|RPO|business continuity/i, classification: "Backup & DR" },
  { pattern: /Active Directory|Entra|SSO|MFA|identity/i, classification: "Identity & Access" },
  { pattern: /EHR|EMR|HL7|FHIR|clinical|patient/i, classification: "Clinical Systems" },
  { pattern: /SCADA|PLC|OT|ICS|manufacturing execution/i, classification: "OT/ICS Systems" },
];

const FILENAME_CLASSIFICATION_RULES: Array<{ pattern: RegExp; classification: string }> = [
  { pattern: /security|pentest|vulnerability|penetration|threat|soc2|soc-2/i, classification: "Security Assessment" },
  { pattern: /network|topology|firewall|vpn|dns|dhcp|subnet|routing/i, classification: "Network Documentation" },
  { pattern: /compliance|regulation|hipaa|gdpr|pci|sox|audit|certification/i, classification: "Compliance Documentation" },
  { pattern: /contract|agreement|msa|sla|nda|terms|license/i, classification: "Vendor Contract" },
  { pattern: /policy|procedure|handbook|standard|guideline|governance/i, classification: "IT Policy" },
  { pattern: /inventory|asset|hardware|software|cmdb|catalog/i, classification: "Asset Inventory" },
  { pattern: /architecture|infrastructure|diagram|design|blueprint/i, classification: "Network Documentation" },
  { pattern: /financial|budget|cost|revenue|forecast|pricing/i, classification: "IT Financial" },
  { pattern: /data|database|migration|schema|backup|recovery/i, classification: "Backup & DR" },
  { pattern: /hr|personnel|org.?chart|employee|talent|team/i, classification: "Organization & Staffing" },
];

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "log", "cfg", "conf", "json", "xml", "yaml", "yml",
  "csv", "tsv", "ini", "env", "sh", "bat", "ps1", "sql",
  "html", "htm", "css", "js", "ts", "py", "toml", "rst", "rtf",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "tiff", "bmp", "svg", "ico", "webp"]);

const BINARY_EXTENSIONS = new Set([
  "exe", "dll", "dmg", "pkg", "msi", "iso", "bin", "dat", "bak", "tmp", "lock",
  "mp3", "mp4", "wav", "avi", "mov", "mkv", "wmv",
  "ttf", "otf", "woff", "woff2",
  "rar", "7z", "tar", "gz", "bz2",
]);

const GOOGLE_DRIVE_EXTENSIONS = new Set(["gdoc", "gsheet", "gslides", "gmap", "gdraw"]);

const SPLIT_ARCHIVE_PATTERN = /\.(zip\.\d+|z\d+|part\d+\.rar)$/i;

function classifyByContent(text: string): string | null {
  for (const rule of CONTENT_CLASSIFICATION_RULES) {
    if (rule.pattern.test(text)) {
      return rule.classification;
    }
  }
  return null;
}

function classifyByFilename(filename: string): string {
  for (const rule of FILENAME_CLASSIFICATION_RULES) {
    if (rule.pattern.test(filename)) {
      return rule.classification;
    }
  }
  return "Unclassified";
}

function classifyDocument(text: string | null, filename: string): string {
  if (text && text.length > 10) {
    const contentClass = classifyByContent(text);
    if (contentClass) return contentClass;
  }
  return classifyByFilename(filename);
}

function computeHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function isHiddenFile(path: string): boolean {
  return HIDDEN_PATTERNS.some((p) => p.test(path));
}

function truncateFilename(filename: string): { truncated: string; original: string | null } {
  if (filename.length <= MAX_FILENAME_LENGTH) {
    return { truncated: filename, original: null };
  }
  const lastDot = filename.lastIndexOf(".");
  const ext = lastDot > 0 ? filename.slice(lastDot) : "";
  if (ext.length >= MAX_FILENAME_LENGTH) {
    return { truncated: filename.slice(0, MAX_FILENAME_LENGTH), original: filename };
  }
  const maxNameLen = MAX_FILENAME_LENGTH - ext.length;
  const truncated = filename.slice(0, Math.max(1, maxNameLen)) + ext;
  return { truncated, original: filename };
}

async function downloadFromObjectStorage(objectPath: string): Promise<Buffer> {
  const file = await objectStorageService.getObjectEntityFile(objectPath);
  const [content] = await file.download();
  return content;
}

async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; metadata: Record<string, any> }> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text || "";
    const metadata: Record<string, any> = { pageCount: data.numpages };
    if (!text.trim()) {
      metadata.note = "Scanned PDF — OCR required for full analysis";
    }
    return { text, metadata };
  } catch (err: any) {
    return { text: "", metadata: { error: err.message } };
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<{ text: string; metadata: Record<string, any> }> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || "";
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    return { text, metadata: { paragraphCount: paragraphs.length } };
  } catch (err: any) {
    return { text: "", metadata: { error: err.message } };
  }
}

async function extractTextFromXlsx(buffer: Buffer): Promise<{ text: string; metadata: Record<string, any> }> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheetNames: string[] = [];
    const parts: string[] = [];
    const sheetInfo: Record<string, number> = {};
    workbook.eachSheet((sheet) => {
      const name = sheet.name;
      sheetNames.push(name);
      let rowCount = 0;
      parts.push(`Sheet: ${name}`);
      sheet.eachRow((row) => {
        rowCount++;
        const values = Array.isArray(row.values) ? (row.values as any[]).slice(1) : [];
        parts.push(values.map((v: any) => (v != null ? String(v) : "")).join("\t"));
      });
      sheetInfo[name] = rowCount;
      parts.push("");
    });
    return {
      text: parts.join("\n"),
      metadata: { sheetNames, sheetRowCounts: sheetInfo },
    };
  } catch (err: any) {
    return { text: "", metadata: { error: err.message } };
  }
}

function extractTextFromCsv(buffer: Buffer, extension: string): { text: string; metadata: Record<string, any> } {
  const text = buffer.toString("utf-8");
  const delimiter = extension === "tsv" ? "\t" : ",";
  const lines = text.split("\n").filter(Boolean);
  const headers = lines[0]?.split(delimiter).map((h) => h.trim()) || [];
  return {
    text,
    metadata: { rowCount: lines.length - 1, columns: headers },
  };
}

function extractTextFromPptx(buffer: Buffer): { text: string; metadata: Record<string, any> } {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const slideTexts: string[] = [];
    const slideEntries = entries
      .filter((e) => e.entryName.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || "0");
        const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || "0");
        return numA - numB;
      });
    for (const entry of slideEntries) {
      const xml = entry.getData().toString("utf-8");
      const texts = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g)?.map((m) => {
        return m.replace(/<[^>]+>/g, "");
      }) || [];
      if (texts.length > 0) {
        slideTexts.push(texts.join(" "));
      }
    }
    return {
      text: slideTexts.join("\n\n"),
      metadata: { slideCount: slideEntries.length },
    };
  } catch (err: any) {
    return { text: "", metadata: { error: err.message } };
  }
}

async function extractTextFromEmail(buffer: Buffer): Promise<{ text: string; metadata: Record<string, any> }> {
  try {
    const parsed = await simpleParser(buffer);
    const parts: string[] = [];
    if (parsed.subject) parts.push(`Subject: ${parsed.subject}`);
    if (parsed.from?.text) parts.push(`From: ${parsed.from.text}`);
    if (parsed.to) {
      const toText = typeof parsed.to === "string" ? parsed.to : (parsed.to as any)?.text || "";
      parts.push(`To: ${toText}`);
    }
    if (parsed.date) parts.push(`Date: ${parsed.date.toISOString()}`);
    parts.push("");
    if (parsed.text) {
      parts.push(parsed.text);
    } else if (parsed.html) {
      parts.push(parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }
    const attachments = parsed.attachments?.map((a) => ({
      filename: a.filename || "unknown",
      size: a.size,
      contentType: a.contentType,
    })) || [];
    return {
      text: parts.join("\n"),
      metadata: { subject: parsed.subject, attachments },
    };
  } catch (err: any) {
    return { text: "", metadata: { error: err.message } };
  }
}

function extractGoogleDriveLink(buffer: Buffer, filename: string): { text: string; metadata: Record<string, any> } {
  try {
    const content = buffer.toString("utf-8");
    const json = JSON.parse(content);
    const url = json.url || json.doc_id || JSON.stringify(json);
    return {
      text: `Google Docs link: ${url} — original file must be downloaded from Google Drive for full content extraction.`,
      metadata: { fileType: "google_drive_link", url, originalFilename: filename },
    };
  } catch {
    return {
      text: `Google Drive file: ${filename} — could not parse link. Original file must be downloaded from Google Drive.`,
      metadata: { fileType: "google_drive_link", originalFilename: filename },
    };
  }
}

async function extractText(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; metadata: Record<string, any>; status?: string }> {
  const ext = getExtension(filename);

  if (GOOGLE_DRIVE_EXTENSIONS.has(ext)) {
    const result = extractGoogleDriveLink(buffer, filename);
    return { ...result, status: "extracted" };
  }

  if (BINARY_EXTENSIONS.has(ext)) {
    return { text: "", metadata: { fileType: "binary" }, status: "stored" };
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    return {
      text: "[Image file — visual analysis pending]",
      metadata: { fileType: "image" },
      status: "image_pending",
    };
  }

  if (ext === "pdf") return extractTextFromPDF(buffer);
  if (ext === "docx" || ext === "doc") return extractTextFromDocx(buffer);
  if (ext === "xlsx" || ext === "xls") return await extractTextFromXlsx(buffer);
  if (ext === "csv" || ext === "tsv") return extractTextFromCsv(buffer, ext);
  if (ext === "pptx") return extractTextFromPptx(buffer);
  if (ext === "eml" || ext === "msg") return extractTextFromEmail(buffer);

  if (TEXT_EXTENSIONS.has(ext)) {
    const text = buffer.toString("utf-8");
    return { text, metadata: { fileType: "text" } };
  }

  try {
    const text = buffer.toString("utf-8");
    const nonPrintable = (text.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
    if (nonPrintable / text.length < 0.1 && text.length > 0) {
      return { text, metadata: { fileType: "text_fallback" } };
    }
  } catch {}

  return { text: "", metadata: { fileType: "unknown" }, status: "stored" };
}

function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  if (!text || text.length <= chunkSize) return text ? [text] : [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }
    const sentenceEnd = text.lastIndexOf(".", end);
    const questionEnd = text.lastIndexOf("?", end);
    const exclEnd = text.lastIndexOf("!", end);
    const newlineEnd = text.lastIndexOf("\n", end);
    const breakPoint = Math.max(sentenceEnd, questionEnd, exclEnd, newlineEnd);
    if (breakPoint > start + chunkSize * 0.3) {
      end = breakPoint + 1;
    }
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

async function runAIClassification(
  docId: string,
  dealId: string,
  filename: string,
  mimeType: string,
  textContent: string,
): Promise<void> {
  try {
    const deal = await storage.getDeal(dealId);
    if (!deal) return;
    const tenantId = deal.organizationId || "unknown";

    const result = await classifyDocumentAI(filename, mimeType, textContent);

    const existing = await storage.getDocumentClassification(docId);
    if (existing) {
      await storage.updateDocumentClassification(existing.id, {
        documentType: result.documentType,
        pillarInfrastructure: result.pillars.infrastructure,
        pillarSecurity: result.pillars.security,
        pillarOperations: result.pillars.operations,
        pillarCompliance: result.pillars.compliance,
        pillarScalability: result.pillars.scalability,
        pillarStrategy: result.pillars.strategy,
        confidence: String(result.confidence),
        classificationReasoning: result.reasoning,
      });
    } else {
      await storage.createDocumentClassification({
        documentId: docId,
        dealId,
        tenantId,
        documentType: result.documentType,
        pillarInfrastructure: result.pillars.infrastructure,
        pillarSecurity: result.pillars.security,
        pillarOperations: result.pillars.operations,
        pillarCompliance: result.pillars.compliance,
        pillarScalability: result.pillars.scalability,
        pillarStrategy: result.pillars.strategy,
        confidence: String(result.confidence),
        classificationReasoning: result.reasoning,
      });
    }
    console.log(`[AI-classify] ${filename} → ${result.documentType} (${result.confidence})`);
  } catch (err: any) {
    console.error(`[AI-classify] Failed for ${filename}:`, err.message);
  }
}

async function extractFindingsFromText(
  docId: string,
  dealId: string,
  filename: string,
  textContent: string,
  classification: string,
): Promise<void> {
  if (!hasAICapability()) {
    console.warn(`[finding-extract] Skipping ${filename}: no OPENROUTER_API_KEY configured (set in Doppler or .env)`);
    return;
  }
  if (!textContent || textContent.trim().length < 100) {
    console.warn(`[finding-extract] Skipping ${filename}: text too short (${textContent?.length || 0} chars)`);
    return;
  }

  try {
    const excerpt = textContent.slice(0, 8000);

    console.log(`[finding-extract] Sending AI request for ${filename} (excerpt: ${textContent.slice(0, 8000).length} chars, classification: ${classification})`);
    const spanielResponse = await spanielChat({
      tenantId: "system",
      userId: "system",
      appCode: "CVG-MER",
      taskType: "extraction",
      system: `You are an IT due diligence analyst reviewing documents for M&A transactions. Extract concrete risk findings from the document content provided.

For each finding, provide:
- title: Short descriptive title (max 120 chars)
- severity: One of "critical", "high", "medium", "low"
- description: Detailed description of the issue
- business_impact: How this could affect the deal or business operations
- remediation: Recommended fix or action
- pillar: Which assessment pillar this relates to. Must be one of: "Infrastructure & Architecture", "Cybersecurity Posture", "Regulatory Compliance", "Integration Complexity", "Technology Org & Talent", "Data Assets & Governance"

Only extract findings that represent actual risks, gaps, or concerns. Do NOT create findings for positive observations. Focus on:
- Security vulnerabilities or gaps
- Infrastructure weaknesses
- Compliance issues
- Outdated or end-of-life technology
- Missing redundancy or backup gaps
- Vendor risks or contract issues
- Staffing or process gaps
- Data governance concerns

Respond in JSON only, no markdown:
{"findings": [...]}

If there are no meaningful findings, respond: {"findings": []}`,
      messages: [{
        role: "user",
        content: `Document: ${filename}\nClassification: ${classification}\n\nContent:\n${excerpt}`,
      }],
      options: { maxTokens: 2000, fallbackEnabled: true },
    });
    const responseText = spanielResponse.content;

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[finding-extract] No JSON found in AI response for ${filename}`);
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const aiFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
    console.log(`[finding-extract] AI returned ${aiFindings.length} findings for ${filename}`);
    if (aiFindings.length === 0) return;

    const pillars = await storage.getPillarsByDeal(dealId);

    let created = 0;
    for (const f of aiFindings.slice(0, 10)) {
      const severity = ["critical", "high", "medium", "low"].includes(f.severity) ? f.severity : "medium";
      const pillarName = f.pillar || CLASSIFICATION_TO_PILLAR[classification] || "Infrastructure & Architecture";
      const pillar = pillars.find(p => p.pillarName === pillarName);

      const description = [
        f.description || "",
        f.business_impact ? `\nBusiness Impact: ${f.business_impact}` : "",
        f.remediation ? `\nRemediation: ${f.remediation}` : "",
        `\n\n[Auto-extracted from document: ${filename}]`,
      ].join("");

      await storage.createFinding({
        dealId,
        pillarId: pillar?.id || null,
        severity,
        title: (f.title || "Untitled finding").slice(0, 120),
        description,
        sourceDocuments: [filename],
        sourceCount: 1,
        sourceDocumentId: docId,
        status: "open",
      });
      created++;
    }

    if (created > 0) {
      console.log(`[finding-extract] ${filename} → ${created} findings auto-extracted`);
      try {
        const { recalculateDealScores } = await import("./routes");
        await recalculateDealScores(dealId);
      } catch {}
    }
  } catch (err: any) {
    console.error(`[finding-extract] Failed for ${filename}:`, err.message, err.status || "", err.code || "");
  }
}

async function processExtractedFile(
  buffer: Buffer,
  filename: string,
  docId: string,
  dealId: string
): Promise<void> {
  try {
    await storage.updateDocument(docId, { extractionStatus: "extracting" });

    const { text, metadata, status } = await extractText(buffer, filename);

    if (status === "image_pending") {
      await processImageFile(buffer, filename, docId, dealId);
      return;
    }

    if (status === "stored") {
      await storage.updateDocument(docId, {
        extractedText: text || null,
        textLength: text ? text.length : 0,
        extractionStatus: "stored",
        classification: classifyDocument(text, filename),
        metadataJson: metadata,
      });
      return;
    }

    const classification = classifyDocument(text, filename);

    await storage.updateDocument(docId, {
      extractedText: text,
      textLength: text.length,
      extractionStatus: status || "extracted",
      classification,
      metadataJson: metadata,
      pageCount: metadata.pageCount || null,
    });

    if (text && text.length > 10) {
      const chunks = chunkText(text);
      for (let i = 0; i < chunks.length; i++) {
        await storage.createDocumentChunk({
          documentId: docId,
          dealId,
          chunkIndex: i,
          chunkText: chunks[i],
          chunkTokens: Math.round(chunks[i].length / 4),
          metadataJson: {
            documentClassification: classification,
            dealId,
          },
        });
      }
    }

    console.log(`[auto-findings] Calling extraction for ${filename} (textLength=${text.length}, classification=${classification})`);
    extractFindingsFromText(docId, dealId, filename, text, classification).catch((err: any) => {
      console.error(`[auto-findings] Failed for ${filename}:`, err.message);
    });
    runAIClassification(docId, dealId, filename, metadata.mimeType || "application/octet-stream", text).catch(() => {});
  } catch (err: any) {
    console.error(`Extraction failed for ${filename}:`, err.message);
    await storage.updateDocument(docId, {
      extractionStatus: "failed",
      extractionError: err.message || "Unknown extraction error",
    });
  }
}

async function processImageFile(
  buffer: Buffer,
  filename: string,
  docId: string,
  dealId: string
): Promise<void> {
  const sizeCheck = checkImageSize(buffer.length);
  if (!sizeCheck.ok) {
    await storage.updateDocument(docId, {
      extractedText: `[Image file — ${sizeCheck.reason}]`,
      textLength: 0,
      extractionStatus: sizeCheck.status || "stored",
      classification: "Unclassified",
      metadataJson: { fileType: "image", skipReason: sizeCheck.reason },
    });
    return;
  }

  if (!hasVisionCapability()) {
    await storage.updateDocument(docId, {
      extractedText: "[Image file — OPENROUTER_API_KEY not configured. Set in Doppler or .env to enable image analysis.]",
      textLength: 0,
      extractionStatus: "stored",
      classification: classifyByFilename(filename),
      metadataJson: { fileType: "image", visionStatus: "no_api_key" },
    });
    return;
  }

  try {
    const result = await analyzeImage(buffer, filename);
    if (!result) {
      await storage.updateDocument(docId, {
        extractedText: "[Image file — vision analysis unavailable]",
        textLength: 0,
        extractionStatus: "stored",
        classification: classifyByFilename(filename),
        metadataJson: { fileType: "image", visionStatus: "unavailable" },
      });
      return;
    }

    await applyVisionResult(docId, dealId, filename, result);
  } catch (err: any) {
    console.error(`Vision analysis failed for ${filename}:`, err.message);
    await storage.updateDocument(docId, {
      extractedText: "[Image file — vision analysis failed]",
      textLength: 0,
      extractionStatus: "vision_failed",
      extractionError: err.message,
      classification: classifyByFilename(filename),
      metadataJson: { fileType: "image", visionError: err.message },
    });
  }
}

export async function applyVisionResult(
  docId: string,
  dealId: string,
  filename: string,
  result: VisionResult
): Promise<{ findingsCreated: number }> {
  const extractedText = result.description + "\n\nEXTRACTED TEXT:\n" + result.extracted_text;
  const classification = result.classification || "Unclassified";

  await storage.updateDocument(docId, {
    extractedText,
    textLength: extractedText.length,
    extractionStatus: "extracted",
    classification,
    metadataJson: {
      fileType: "image",
      vision_analysis: result,
      vision_findings: result.findings,
      vision_provider: result.provider,
    },
  });

  const chunks = chunkText(extractedText);
  for (let i = 0; i < chunks.length; i++) {
    await storage.createDocumentChunk({
      documentId: docId,
      dealId,
      chunkIndex: i,
      chunkText: chunks[i],
      chunkTokens: Math.round(chunks[i].length / 4),
      metadataJson: {
        documentClassification: classification,
        dealId,
        sourceType: "image_vision",
      },
    });
  }

  runAIClassification(docId, dealId, filename, "image/*", extractedText).catch(() => {});

  let findingsCreated = 0;
  const mediumOrHigher = result.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium"
  );

  if (mediumOrHigher.length > 0) {
    const pillarName = CLASSIFICATION_TO_PILLAR[classification] || "Infrastructure & Architecture";
    const pillars = await storage.getPillarsByDeal(dealId);
    const pillar = pillars.find((p) => p.pillarName === pillarName);

    for (const finding of mediumOrHigher) {
      const title = finding.observation.slice(0, 120);
      const description = `${finding.observation}\n\nRisk Relevance: ${finding.risk_relevance}\n\n[Auto-detected from image analysis: ${filename}]`;

      await storage.createFinding({
        dealId,
        pillarId: pillar?.id || null,
        severity: finding.severity,
        title,
        description,
        sourceDocuments: [filename],
        sourceCount: 1,
        sourceDocumentId: docId,
        status: "open",
      });
      findingsCreated++;
    }
  }

  return { findingsCreated };
}

async function processZipArchive(
  buffer: Buffer,
  parentDocId: string,
  dealId: string,
  depth: number = 0
): Promise<{ processed: number; total: number; failed: number; skipped: number }> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (err: any) {
    console.error(`Cannot open ZIP archive:`, err.message);
    await storage.updateDocument(parentDocId, {
      extractionStatus: "failed",
      extractionError: `Could not extract archive: ${err.message}`,
    });
    return { processed: 0, total: 0, failed: 1, skipped: 0 };
  }

  let entries: any[];
  try {
    entries = zip.getEntries();
  } catch (err: any) {
    console.error(`Cannot read ZIP entries:`, err.message);
    await storage.updateDocument(parentDocId, {
      extractionStatus: "failed",
      extractionError: `Archive may be corrupted: ${err.message}`,
    });
    return { processed: 0, total: 0, failed: 1, skipped: 0 };
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;
  let total = 0;
  const childFiles: Array<{ entry: any; folderPath: string }> = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (isHiddenFile(entry.entryName)) continue;
    total++;
    childFiles.push({ entry, folderPath: entry.entryName });
  }

  await storage.updateDocument(parentDocId, {
    metadataJson: { totalFiles: total, archiveSize: buffer.length, extractionDepth: depth },
  });

  for (const { entry, folderPath } of childFiles) {
    try {
      const rawFilename = folderPath.split("/").pop() || folderPath;
      const ext = getExtension(rawFilename);

      if (SPLIT_ARCHIVE_PATTERN.test(rawFilename)) {
        console.log(`Split archive detected — manual reassembly required: ${rawFilename}`);
        const { truncated, original } = truncateFilename(rawFilename);
        const skipDoc = await storage.createDocument({
          dealId,
          filename: truncated,
          originalFilename: original,
          fileType: ext,
          fileSize: 0,
          folderPath,
          parentArchiveId: parentDocId,
          extractionStatus: "skipped",
          extractionError: "Split archive part — requires manual reassembly",
          uploadStatus: "uploaded",
        });
        skipped++;
        continue;
      }

      let fileBuffer: Buffer;
      try {
        fileBuffer = entry.getData();
      } catch (entryErr: any) {
        console.error(`Error reading ZIP entry ${folderPath}: ${entryErr.message}`);
        const { truncated, original } = truncateFilename(rawFilename);
        await storage.createDocument({
          dealId,
          filename: truncated,
          originalFilename: original,
          fileType: ext,
          fileSize: 0,
          folderPath,
          parentArchiveId: parentDocId,
          extractionStatus: "failed",
          extractionError: `Could not read entry: ${entryErr.message}`,
          uploadStatus: "uploaded",
        });
        failed++;
        continue;
      }

      if (fileBuffer.length === 0) {
        const { truncated, original } = truncateFilename(rawFilename);
        await storage.createDocument({
          dealId,
          filename: truncated,
          originalFilename: original,
          fileType: "application/octet-stream",
          fileSize: 0,
          objectPath: "",
          parentArchiveId: parentDocId,
          folderPath: rawFilename,
          extractionStatus: "skipped",
          extractionError: "Empty file (zero bytes)",
          uploadStatus: "uploaded",
        });
        skipped++;
        continue;
      }

      if (fileBuffer.length > MAX_FILE_SIZE) {
        const { truncated, original } = truncateFilename(rawFilename);
        await storage.createDocument({
          dealId,
          filename: truncated,
          originalFilename: original,
          fileType: ext,
          fileSize: fileBuffer.length,
          folderPath,
          parentArchiveId: parentDocId,
          extractionStatus: "skipped",
          extractionError: "File exceeds 50MB size limit",
          uploadStatus: "uploaded",
        });
        skipped++;
        continue;
      }

      const hash = computeHash(fileBuffer);
      const existing = await storage.getDocumentByHash(dealId, hash);
      if (existing) {
        processed++;
        continue;
      }

      const { truncated, original } = truncateFilename(rawFilename);
      const childDoc = await storage.createDocument({
        dealId,
        filename: truncated,
        originalFilename: original,
        fileType: ext,
        fileSize: fileBuffer.length,
        folderPath,
        parentArchiveId: parentDocId,
        contentHash: hash,
        extractionStatus: "pending",
        uploadStatus: "uploaded",
      });

      if (ext === "zip" && depth < MAX_ZIP_DEPTH) {
        await storage.updateDocument(childDoc.id, { extractionStatus: "extracting" });
        try {
          const result = await processZipArchive(fileBuffer, childDoc.id, dealId, depth + 1);
          await storage.updateDocument(childDoc.id, {
            extractionStatus: "extracted",
            metadataJson: { totalFiles: result.total, nested: true, processedFiles: result.processed },
          });
          processed += result.processed;
          failed += result.failed;
          skipped += result.skipped;
        } catch (zipErr: any) {
          await storage.updateDocument(childDoc.id, {
            extractionStatus: "failed",
            extractionError: `Nested ZIP error: ${zipErr.message}`,
          });
          failed++;
        }
      } else if (ext === "zip" && depth >= MAX_ZIP_DEPTH) {
        await storage.updateDocument(childDoc.id, {
          extractionStatus: "skipped",
          extractionError: "Nested ZIP exceeds maximum depth of 3 levels",
        });
        skipped++;
      } else if (GOOGLE_DRIVE_EXTENSIONS.has(ext)) {
        const gdResult = extractGoogleDriveLink(fileBuffer, rawFilename);
        await storage.updateDocument(childDoc.id, {
          extractedText: gdResult.text,
          textLength: gdResult.text.length,
          extractionStatus: "extracted",
          classification: "External Link",
          metadataJson: gdResult.metadata,
        });
        processed++;
      } else {
        await processExtractedFile(fileBuffer, rawFilename, childDoc.id, dealId);
        processed++;
      }
    } catch (err: any) {
      console.error(`Error processing ZIP entry ${folderPath}:`, err.message);
      failed++;
    }
  }

  return { processed, total, failed, skipped };
}

export async function ingestDocument(
  dealId: string,
  filename: string,
  fileType: string,
  fileSize: number,
  objectPath: string
): Promise<{ document: any; isDuplicate: boolean; archiveResult?: { processed: number; total: number; failed: number; skipped: number } }> {
  if (fileSize > MAX_FILE_SIZE && !filename.toLowerCase().endsWith(".zip")) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  if (fileSize > MAX_ARCHIVE_SIZE && filename.toLowerCase().endsWith(".zip")) {
    throw new Error(`Archive exceeds maximum size of ${MAX_ARCHIVE_SIZE / 1024 / 1024}MB`);
  }

  const buffer = await downloadFromObjectStorage(objectPath);
  const hash = computeHash(buffer);

  const existing = await storage.getDocumentByHash(dealId, hash);
  if (existing) {
    return { document: existing, isDuplicate: true };
  }

  const ext = getExtension(filename);
  const isArchive = ext === "zip";
  const { truncated, original } = truncateFilename(filename);

  const doc = await storage.createDocument({
    dealId,
    filename: truncated,
    originalFilename: original,
    fileType: fileType || ext,
    fileSize,
    objectPath,
    contentHash: hash,
    extractionStatus: isArchive ? "extracting" : "pending",
    uploadStatus: "uploaded",
  });

  if (isArchive) {
    let archiveResult: { processed: number; total: number; failed: number; skipped: number };
    try {
      archiveResult = await processZipArchive(buffer, doc.id, dealId);
    } catch (err: any) {
      console.error(`ZIP processing failed:`, err.message);
      archiveResult = { processed: 0, total: 0, failed: 1, skipped: 0 };
      await storage.updateDocument(doc.id, {
        extractionStatus: "failed",
        extractionError: `Archive processing error: ${err.message}`,
      });
    }

    if (archiveResult.failed === 0 || archiveResult.processed > 0) {
      await storage.updateDocument(doc.id, {
        extractionStatus: archiveResult.failed > 0 ? "extracted" : "extracted",
        metadataJson: {
          totalFiles: archiveResult.total,
          processedFiles: archiveResult.processed,
          failedFiles: archiveResult.failed,
          skippedFiles: archiveResult.skipped,
        },
      });
    }

    const allDocs = await storage.getDocumentsByDeal(dealId);
    const analyzed = allDocs.filter((d) => ["extracted", "stored"].includes(d.extractionStatus)).length;
    await storage.updateDeal(dealId, {
      documentsUploaded: allDocs.length,
      documentsAnalyzed: analyzed,
    });

    return { document: doc, isDuplicate: false, archiveResult };
  } else {
    await processExtractedFile(buffer, filename, doc.id, dealId);

    const allDocs = await storage.getDocumentsByDeal(dealId);
    const analyzed = allDocs.filter((d) => ["extracted", "stored"].includes(d.extractionStatus)).length;
    await storage.updateDeal(dealId, {
      documentsUploaded: allDocs.length,
      documentsAnalyzed: analyzed,
    });

    return { document: await storage.getDocument(doc.id), isDuplicate: false };
  }
}

export async function reprocessDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = await storage.getDocument(documentId);
    if (!doc) return { success: false, error: "Document not found" };

    await storage.updateDocument(documentId, {
      extractionStatus: "pending",
      extractionError: null,
    });

    if (doc.objectPath) {
      const buffer = await downloadFromObjectStorage(doc.objectPath);
      await processExtractedFile(buffer, doc.originalFilename || doc.filename, documentId, doc.dealId!);
    } else if (doc.parentArchiveId) {
      const parent = await storage.getDocument(doc.parentArchiveId);
      if (parent?.objectPath) {
        const archiveBuffer = await downloadFromObjectStorage(parent.objectPath);
        try {
          const zip = new AdmZip(archiveBuffer);
          const entry = zip.getEntries().find((e) => {
            const entryFilename = e.entryName.split("/").pop() || e.entryName;
            return e.entryName === doc.folderPath || entryFilename === doc.filename;
          });
          if (entry) {
            const fileBuffer = entry.getData();
            await processExtractedFile(fileBuffer, doc.originalFilename || doc.filename, documentId, doc.dealId!);
          } else {
            await storage.updateDocument(documentId, {
              extractionStatus: "failed",
              extractionError: "Could not locate file in parent archive",
            });
            return { success: false, error: "File not found in archive" };
          }
        } catch (err: any) {
          await storage.updateDocument(documentId, {
            extractionStatus: "failed",
            extractionError: err.message,
          });
          return { success: false, error: err.message };
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    await storage.updateDocument(documentId, {
      extractionStatus: "failed",
      extractionError: err.message,
    });
    return { success: false, error: err.message };
  }
}

export async function getDocumentStats(dealId: string): Promise<{
  totalFiles: number;
  analyzed: number;
  failed: number;
  chunksIndexed: number;
  pending: number;
  skipped: number;
  stored: number;
}> {
  const docs = await storage.getDocumentsByDeal(dealId);
  const chunksIndexed = await storage.getChunkCountByDeal(dealId);
  return {
    totalFiles: docs.length,
    analyzed: docs.filter((d) => d.extractionStatus === "extracted" || d.extractionStatus === "stored").length,
    failed: docs.filter((d) => d.extractionStatus === "failed").length,
    chunksIndexed,
    pending: docs.filter((d) => d.extractionStatus === "pending" || d.extractionStatus === "extracting").length,
    skipped: docs.filter((d) => d.extractionStatus === "skipped").length,
    stored: docs.filter((d) => d.extractionStatus === "stored").length,
  };
}
