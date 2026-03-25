import { storage, requireAuth, verifyDealAccess, param, type AuthenticatedRequest } from './_helpers';
import { generateDealPDF, generateDealCSV, generateExecutiveSummaryPDF, type ProgressCallback } from "../report-export";
import { generateDealExcel } from "../excel-export";
import crypto from "crypto";
import { type Express } from "express";

export function registerReportRoutes(app: Express) {
// ──────── REPORT EXPORT (tenant scoped + deal access) ────────

const handleDocxExport = async (req: AuthenticatedRequest, res: any) => {
  try {
    const buffer = await generateDealPDF(param(req.params.id));
    const deal = await storage.getDeal(param(req.params.id));
    const filename = `MERIDIAN_${(deal?.targetName || "deal").replace(/[^a-zA-Z0-9]/g, "_")}_Report.docx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("DOCX export failed:", error);
    res.status(500).json({ message: error.message || "Failed to generate DOCX report" });
  }
};

const handleExecutiveDocxExport = async (req: AuthenticatedRequest, res: any) => {
  try {
    const buffer = await generateExecutiveSummaryPDF(param(req.params.id));
    const deal = await storage.getDeal(param(req.params.id));
    const filename = `MERIDIAN_${(deal?.targetName || "deal").replace(/[^a-zA-Z0-9]/g, "_")}_Executive_Summary.docx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Executive DOCX export failed:", error);
    res.status(500).json({ message: error.message || "Failed to generate executive summary DOCX" });
  }
};

app.get("/api/deals/:id/export/docx", requireAuth as any, verifyDealAccess as any, handleDocxExport as any);
app.get("/api/deals/:id/export/executive-docx", requireAuth as any, verifyDealAccess as any, handleExecutiveDocxExport as any);

app.get("/api/deals/:id/export/pdf", requireAuth as any, verifyDealAccess as any, (req: AuthenticatedRequest, res: any) => {
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", `</api/deals/${param(req.params.id)}/export/docx>; rel="successor-version"`);
  return handleDocxExport(req, res);
});

app.get("/api/deals/:id/export/executive-pdf", requireAuth as any, verifyDealAccess as any, (req: AuthenticatedRequest, res: any) => {
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", `</api/deals/${param(req.params.id)}/export/executive-docx>; rel="successor-version"`);
  return handleExecutiveDocxExport(req, res);
});

app.get("/api/deals/:id/export/csv", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const csv = await generateDealCSV(param(req.params.id));
    const deal = await storage.getDeal(param(req.params.id));
    const filename = `MERIDIAN_${(deal?.targetName || "deal").replace(/[^a-zA-Z0-9]/g, "_")}_Data.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    console.error("CSV export failed:", error);
    res.status(500).json({ message: error.message || "Failed to generate CSV export" });
  }
});

app.post("/api/deals/:id/export/excel", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const deal = await storage.getDeal(param(req.params.id));
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    const buffer = await generateDealExcel(param(req.params.id));
    const dateStr = new Date().toISOString().split("T")[0];
    const safeName = (deal.targetName || "deal").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${safeName}-IT-Assessment-${dateStr}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Excel export failed:", error);
    res.status(500).json({ message: error.message || "Failed to generate Excel export" });
  }
});

const reportTempStore = new Map<string, { buffer: Buffer; filename: string; createdAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of reportTempStore) {
    if (now - val.createdAt > 5 * 60 * 1000) reportTempStore.delete(key);
  }
}, 60 * 1000);

const handleDocxStream = async (req: AuthenticatedRequest, res: any) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const onProgress: ProgressCallback = (step, total, label) => {
      sendEvent({ type: "progress", step, total, label });
    };

    const buffer = await generateDealPDF(param(req.params.id), onProgress);
    const deal = await storage.getDeal(param(req.params.id));
    const filename = `MERIDIAN_${(deal?.targetName || "deal").replace(/[^a-zA-Z0-9]/g, "_")}_Report.docx`;
    const jobId = crypto.randomUUID();
    reportTempStore.set(jobId, { buffer, filename, createdAt: Date.now() });

    sendEvent({
      type: "complete",
      report: {
        jobId,
        filename,
        fileSize: buffer.length,
        downloadUrl: `/api/reports/temp/${jobId}`,
      },
    });
    res.end();
  } catch (error: any) {
    console.error("DOCX stream failed:", error);
    sendEvent({ type: "error", message: error.message || "Failed to generate DOCX report" });
    res.end();
  }
};

const handleExecutiveDocxStream = async (req: AuthenticatedRequest, res: any) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const onProgress: ProgressCallback = (step, total, label) => {
      sendEvent({ type: "progress", step, total, label });
    };

    const buffer = await generateExecutiveSummaryPDF(param(req.params.id), onProgress);
    const deal = await storage.getDeal(param(req.params.id));
    const filename = `MERIDIAN_${(deal?.targetName || "deal").replace(/[^a-zA-Z0-9]/g, "_")}_Executive_Summary.docx`;
    const jobId = crypto.randomUUID();
    reportTempStore.set(jobId, { buffer, filename, createdAt: Date.now() });

    sendEvent({
      type: "complete",
      report: {
        jobId,
        filename,
        fileSize: buffer.length,
        downloadUrl: `/api/reports/temp/${jobId}`,
      },
    });
    res.end();
  } catch (error: any) {
    console.error("Executive DOCX stream failed:", error);
    sendEvent({ type: "error", message: error.message || "Failed to generate executive summary DOCX" });
    res.end();
  }
};

app.post("/api/deals/:id/export/docx-stream", requireAuth as any, verifyDealAccess as any, handleDocxStream as any);
app.post("/api/deals/:id/export/executive-docx-stream", requireAuth as any, verifyDealAccess as any, handleExecutiveDocxStream as any);

app.post("/api/deals/:id/export/pdf-stream", requireAuth as any, verifyDealAccess as any, (req: AuthenticatedRequest, res: any) => {
  res.setHeader("Deprecation", "true");
  return handleDocxStream(req, res);
});

app.post("/api/deals/:id/export/executive-pdf-stream", requireAuth as any, verifyDealAccess as any, (req: AuthenticatedRequest, res: any) => {
  res.setHeader("Deprecation", "true");
  return handleExecutiveDocxStream(req, res);
});

app.get("/api/reports/temp/:jobId", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  const entry = reportTempStore.get(param(req.params.jobId));
  if (!entry) {
    return res.status(404).json({ message: "Report not found or expired" });
  }
  const isDocx = entry.filename.endsWith(".docx");
  res.setHeader("Content-Type", isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${entry.filename}"`);
  res.send(entry.buffer);
  reportTempStore.delete(param(req.params.jobId));
});
}
