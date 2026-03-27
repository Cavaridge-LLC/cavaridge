import type { Express, Request, Response, NextFunction } from "express";
import PDFDocument from "pdfkit";

// =============================================================================
// Types
// =============================================================================

interface QuickCheckGap {
  id: number;
  text: string;
  reference: string;
  category: string;
}

interface QuickCheckBody {
  answers: Record<string, boolean>;
  lead: {
    name: string;
    email: string;
    company: string;
    role?: string;
  };
  score: number;
  groupScores: Record<string, number>;
  gaps: QuickCheckGap[];
  recommendations: string[];
}

// =============================================================================
// Color helpers
// =============================================================================

const CAVARIDGE_BLUE = "#2E5090";
const DARK_TEXT = "#1A1A1A";
const GRAY_TEXT = "#6B7280";
const TABLE_HEADER_BG = "#2E5090";
const TABLE_ROW_BAND = "#F2F6FA";
const TABLE_BORDER = "#BFBFBF";

function riskColor(score: number): string {
  if (score <= 40) return "#EF4444";
  if (score <= 60) return "#F97316";
  if (score <= 80) return "#EAB308";
  return "#22C55E";
}

function riskLabel(score: number): string {
  if (score <= 40) return "Critical";
  if (score <= 60) return "High";
  if (score <= 80) return "Medium";
  return "Low";
}

// =============================================================================
// PDF Generation
// =============================================================================

function generatePDF(data: QuickCheckBody): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: "HIPAA Quick-Check Assessment Report",
        Author: "Cavaridge, LLC",
        Subject: "HIPAA Security Rule Compliance Assessment",
        Creator: "Cavaridge HIPAA Risk Assessment Platform",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftMargin = doc.page.margins.left;

    // =========================================================================
    // Header
    // =========================================================================
    doc
      .rect(0, 0, doc.page.width, 100)
      .fill(CAVARIDGE_BLUE);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#FFFFFF")
      .text("HIPAA Quick-Check Assessment Report", leftMargin, 30, {
        width: pageWidth,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#D1D5DB")
      .text("Cavaridge, LLC | Powered by Ducky Intelligence", leftMargin, 60, {
        width: pageWidth,
        align: "center",
      });

    doc.moveDown(3);
    const afterHeader = 120;
    doc.y = afterHeader;

    // =========================================================================
    // Assessment Details
    // =========================================================================
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(CAVARIDGE_BLUE)
      .text("Assessment Details", leftMargin);

    doc.moveDown(0.5);

    const detailsData = [
      ["Date", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
      ["Organization", data.lead.company],
      ["Prepared For", data.lead.name],
      ["Email", data.lead.email],
    ];
    if (data.lead.role) {
      detailsData.push(["Role", data.lead.role]);
    }

    doc.font("Helvetica").fontSize(10).fillColor(DARK_TEXT);
    for (const [label, value] of detailsData) {
      doc
        .font("Helvetica-Bold")
        .text(`${label}: `, leftMargin, doc.y, { continued: true })
        .font("Helvetica")
        .text(value);
    }

    doc.moveDown(1.5);

    // =========================================================================
    // Overall Score
    // =========================================================================
    const scoreY = doc.y;
    const scoreBoxHeight = 80;
    const color = riskColor(data.score);
    const label = riskLabel(data.score);

    doc
      .roundedRect(leftMargin, scoreY, pageWidth, scoreBoxHeight, 8)
      .lineWidth(2)
      .strokeColor(color)
      .fillAndStroke("#FAFAFA", color);

    doc
      .font("Helvetica-Bold")
      .fontSize(36)
      .fillColor(color)
      .text(`${data.score}`, leftMargin, scoreY + 12, {
        width: pageWidth / 2,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(GRAY_TEXT)
      .text("out of 100", leftMargin, scoreY + 52, {
        width: pageWidth / 2,
        align: "center",
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(color)
      .text(`${label} Risk`, leftMargin + pageWidth / 2, scoreY + 18, {
        width: pageWidth / 2,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(GRAY_TEXT)
      .text(
        data.score <= 40
          ? "Significant compliance gaps requiring immediate attention"
          : data.score <= 60
            ? "Notable gaps requiring priority remediation"
            : data.score <= 80
              ? "Reasonable posture with areas for improvement"
              : "Strong compliance posture — continue monitoring",
        leftMargin + pageWidth / 2,
        scoreY + 44,
        { width: pageWidth / 2, align: "center" },
      );

    doc.y = scoreY + scoreBoxHeight + 20;

    // =========================================================================
    // Category Breakdown Table
    // =========================================================================
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(CAVARIDGE_BLUE)
      .text("Category Breakdown", leftMargin);

    doc.moveDown(0.5);

    const colWidths = [pageWidth * 0.40, pageWidth * 0.15, pageWidth * 0.15, pageWidth * 0.30];
    const rowHeight = 24;
    let tableY = doc.y;

    // Header row
    doc
      .rect(leftMargin, tableY, pageWidth, rowHeight)
      .fill(TABLE_HEADER_BG);

    const headers = ["Safeguard Category", "Weight", "Score", "Risk Level"];
    let colX = leftMargin;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF");
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX + 6, tableY + 7, { width: colWidths[i] - 12 });
      colX += colWidths[i];
    }
    tableY += rowHeight;

    const weights: Record<string, string> = {
      Administrative: "40%",
      Physical: "15%",
      Technical: "35%",
      "Breach Notification": "10%",
    };

    const groupOrder = ["Administrative", "Physical", "Technical", "Breach Notification"];
    let rowIdx = 0;
    for (const group of groupOrder) {
      const score = data.groupScores[group] ?? 0;
      const rowColor = rowIdx % 2 === 0 ? "#FFFFFF" : TABLE_ROW_BAND;

      doc
        .rect(leftMargin, tableY, pageWidth, rowHeight)
        .fill(rowColor);

      // Borders
      doc.lineWidth(0.5).strokeColor(TABLE_BORDER);
      doc
        .moveTo(leftMargin, tableY + rowHeight)
        .lineTo(leftMargin + pageWidth, tableY + rowHeight)
        .stroke();

      colX = leftMargin;
      const rowData = [
        `${group} Safeguards`,
        weights[group],
        `${score}%`,
        riskLabel(score),
      ];
      if (group === "Breach Notification") {
        rowData[0] = "Breach Notification";
      }

      doc.font("Helvetica").fontSize(9).fillColor(DARK_TEXT);
      for (let i = 0; i < rowData.length; i++) {
        if (i === 3) {
          doc.fillColor(riskColor(score));
        }
        doc.text(rowData[i], colX + 6, tableY + 7, { width: colWidths[i] - 12 });
        if (i === 3) {
          doc.fillColor(DARK_TEXT);
        }
        colX += colWidths[i];
      }

      tableY += rowHeight;
      rowIdx++;
    }

    doc.y = tableY + 20;

    // =========================================================================
    // Gap Analysis
    // =========================================================================
    if (data.gaps.length > 0) {
      // Check if we need a new page
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(CAVARIDGE_BLUE)
        .text("Gap Analysis", leftMargin);

      doc.moveDown(0.5);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GRAY_TEXT)
        .text(`${data.gaps.length} of 20 controls were identified as non-compliant:`, leftMargin);

      doc.moveDown(0.5);

      for (const gap of data.gaps) {
        // Check page break
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }

        const gapY = doc.y;
        doc
          .roundedRect(leftMargin, gapY, pageWidth, 1, 0)
          .fill(TABLE_BORDER);

        doc.y = gapY + 6;

        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(DARK_TEXT)
          .text(gap.text, leftMargin + 10, doc.y, { width: pageWidth - 20 });

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(GRAY_TEXT)
          .text(`${gap.reference} | ${gap.category}`, leftMargin + 10, doc.y + 2, {
            width: pageWidth - 20,
          });

        doc.moveDown(0.5);
      }

      doc.moveDown(0.5);
    }

    // =========================================================================
    // Recommendations
    // =========================================================================
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(CAVARIDGE_BLUE)
      .text("Recommendations", leftMargin);

    doc.moveDown(0.5);

    for (let i = 0; i < data.recommendations.length; i++) {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(CAVARIDGE_BLUE)
        .text(`${i + 1}. `, leftMargin, doc.y, { continued: true })
        .font("Helvetica")
        .fillColor(DARK_TEXT)
        .text(data.recommendations[i], { width: pageWidth - 20 });

      doc.moveDown(0.3);
    }

    // =========================================================================
    // Scoring Methodology
    // =========================================================================
    doc.moveDown(1);

    if (doc.y > doc.page.height - 150) {
      doc.addPage();
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(CAVARIDGE_BLUE)
      .text("Scoring Methodology", leftMargin);

    doc.moveDown(0.5);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GRAY_TEXT)
      .text(
        "The overall score is a weighted composite of four safeguard categories as defined by the HIPAA Security Rule. " +
        "Technical Safeguards (45 CFR \u00A7164.312) carry the highest weight at 35% due to their direct impact on ePHI protection. " +
        "Administrative Safeguards (45 CFR \u00A7164.308) account for 40% as the broadest category. " +
        "Physical Safeguards (45 CFR \u00A7164.310) contribute 15%, and Breach Notification (45 CFR \u00A7164.400-414) contributes 10%.",
        leftMargin,
        doc.y,
        { width: pageWidth },
      );

    doc.moveDown(0.5);

    doc.text(
      "Risk levels: Critical (0-40), High (41-60), Medium (61-80), Low (81-100).",
      leftMargin,
      doc.y,
      { width: pageWidth },
    );

    // =========================================================================
    // Disclaimer
    // =========================================================================
    doc.moveDown(2);

    if (doc.y > doc.page.height - 120) {
      doc.addPage();
    }

    doc
      .rect(leftMargin, doc.y, pageWidth, 1)
      .fill(TABLE_BORDER);

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(DARK_TEXT)
      .text("Disclaimer", leftMargin);

    doc.moveDown(0.3);

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(GRAY_TEXT)
      .text(
        "This is a preliminary self-assessment tool and does not constitute legal advice or a comprehensive HIPAA risk analysis " +
        "as required by 45 CFR \u00A7164.308(a)(1)(ii)(A). The results are based solely on the responses provided and may not " +
        "reflect the actual state of your organization's compliance. A full risk analysis conducted by qualified professionals, " +
        "including evaluation of all implementation specifications, documentation review, and technical testing, is required for " +
        "HIPAA compliance. Cavaridge, LLC makes no warranties regarding the accuracy or completeness of this assessment. " +
        "No data from this assessment is stored or retained.",
        leftMargin,
        doc.y,
        { width: pageWidth },
      );

    // =========================================================================
    // Footer
    // =========================================================================
    doc.moveDown(1.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GRAY_TEXT)
      .text("Powered by Ducky Intelligence. \u00A9 " + new Date().getFullYear() + " Cavaridge, LLC. All rights reserved.", leftMargin, doc.y, {
        width: pageWidth,
        align: "center",
      });

    doc.end();
  });
}

// =============================================================================
// Route Registration
// =============================================================================

export function registerQuickCheckRoutes(app: Express) {
  app.post(
    "/api/v1/hipaa/quickcheck",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as QuickCheckBody;

        // Basic validation
        if (
          !body.answers ||
          typeof body.score !== "number" ||
          !body.groupScores ||
          !Array.isArray(body.gaps) ||
          !Array.isArray(body.recommendations) ||
          !body.lead?.name ||
          !body.lead?.email ||
          !body.lead?.company
        ) {
          return res.status(400).json({ error: "Invalid request body" });
        }

        // Score bounds check
        if (body.score < 0 || body.score > 100) {
          return res.status(400).json({ error: "Score must be between 0 and 100" });
        }

        const pdfBuffer = await generatePDF(body);

        const filename = `HIPAA-QuickCheck-Report-${new Date().toISOString().slice(0, 10)}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", pdfBuffer.length.toString());
        res.send(pdfBuffer);
      } catch (err) {
        next(err);
      }
    },
  );
}
