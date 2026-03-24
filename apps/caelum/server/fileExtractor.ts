import fs from "fs";
import path from "path";

export async function extractFileContent(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  try {
    if (ext === ".pdf") {
      const pdfParse = (await import("pdf-parse") as any).default;
      const data = await pdfParse(buffer);
      return data.text.trim();
    }

    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }

    if (ext === ".xlsx" || ext === ".xls") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
      }
      return sheets.join("\n\n").trim();
    }

    if (ext === ".csv") {
      return buffer.toString("utf-8").trim();
    }

    if ([".txt", ".md", ".json", ".xml", ".yaml", ".yml", ".log", ".ini", ".conf", ".cfg", ".env", ".html", ".htm", ".css", ".js", ".ts", ".py", ".sh", ".bat", ".ps1", ".sql"].includes(ext)) {
      return buffer.toString("utf-8").trim();
    }

    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(ext)) {
      return `[Image file: ${originalName} — Image content cannot be directly extracted as text. The user has uploaded this image for reference.]`;
    }

    return buffer.toString("utf-8").trim();
  } catch (err: any) {
    return `[Could not extract content from ${originalName}: ${err.message}]`;
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
}
