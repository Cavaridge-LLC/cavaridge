/**
 * PPTX Hydration Engine
 *
 * Takes a QbrHydrationInput and a template .pptx file, then populates
 * all placeholder fields (___ and [bracketed] text) with live data.
 *
 * Uses pptxgenjs to build a fresh deck that mirrors the template structure
 * but fills in real values from the QbrPackage and journey data.
 *
 * Architecture note: Templates are pre-designed .pptx files with ___
 * placeholders and data source annotations. The hydration engine reads
 * the template to determine structure, then generates a new .pptx with
 * the same layout but populated data. This avoids the complexity of
 * XML-level template manipulation and gives us full control via pptxgenjs.
 */

import pptxgen from "pptxgenjs";
import type { QbrHydrationInput, TenantBranding, JourneyMetric } from "./types";

// ── Design Tokens (matching template design system) ────────────────

function brandColors(branding: TenantBranding) {
  const isDIT = branding.brandKey === "dit";
  return {
    dark: isDIT ? "1B2755" : "1A1F36",
    darker: isDIT ? "0F1738" : "0E1224",
    mid: isDIT ? "1F2E62" : "242B4A",
    primary: branding.primaryColor,
    accent: branding.accentColor,
    white: "FFFFFF",
    darkGrey: "333333",
    medGrey: "666677",
    lightBg: isDIT ? "F5F7FA" : "F5F4F8",
    footerText: isDIT ? "5A6485" : "5A607A",
  };
}

// ── Slide Builders ─────────────────────────────────────────────────

function addCoverSlide(
  pptx: InstanceType<typeof pptxgen>,
  input: QbrHydrationInput,
  c: ReturnType<typeof brandColors>,
) {
  const s = pptx.addSlide();
  s.background = { color: c.dark };

  // Left accent bar
  s.addShape("rect", { x: 0, y: 0, w: 0.05, h: "100%", fill: { color: c.primary } });
  s.addShape("rect", { x: 0.05, y: 0, w: 0.02, h: "100%", fill: { color: c.accent } });

  // Company name
  s.addText(input.branding.companyName.toUpperCase(), {
    x: 0.8, y: 0.8, w: 8, h: 0.5,
    fontFace: "Open Sans", fontSize: 14, bold: true, color: c.accent,
  });

  // Title
  const isABR = input.template.reportType === "abr";
  const titleText = isABR
    ? `Annual Business Review\n${input.quarter} ${input.fiscalYear || ""}`
    : `Quarterly Business Review\n${input.quarter}`;
  s.addText(titleText, {
    x: 0.8, y: 1.5, w: 8, h: 1.5,
    fontFace: "Open Sans", fontSize: 36, bold: true, color: c.white,
    lineSpacingMultiple: 1.15,
  });

  // Client name
  s.addText(`Prepared for ${input.clientName}`, {
    x: 0.8, y: 3.5, w: 8, h: 0.5,
    fontFace: "Open Sans", fontSize: 14, color: c.white,
  });

  // Footer
  const date = input.preparedDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  s.addText(`${date}  |  ${input.preparedBy || input.branding.companyName}`, {
    x: 0.8, y: 5.0, w: 8, h: 0.3,
    fontFace: "Open Sans", fontSize: 10, color: c.medGrey,
  });

  addSlideFooter(s, input.branding, c);
}

function addJourneySlide(
  pptx: InstanceType<typeof pptxgen>,
  input: QbrHydrationInput,
  c: ReturnType<typeof brandColors>,
) {
  if (!input.journey?.metrics.length) return;

  const s = pptx.addSlide();
  s.background = { color: c.white };

  const isABR = input.template.reportType === "abr";
  const title = isABR ? "ANNUAL IT JOURNEY" : "YOUR IT JOURNEY";
  const subtitle = isABR
    ? "Full-year progress: Day 1 through Year-End"
    : "Where you started  →  Where you are  →  Where you're going";

  s.addText(title, {
    x: 0.8, y: 0.35, w: 8, h: 0.4,
    fontFace: "Open Sans", fontSize: 22, bold: true, color: c.primary,
  });
  s.addShape("rect", { x: 0.8, y: 0.75, w: 1.2, h: 0.03, fill: { color: c.primary } });
  s.addText(subtitle, {
    x: 0.8, y: 0.85, w: 8, h: 0.3,
    fontFace: "Open Sans", fontSize: 12, color: c.medGrey,
  });

  // Column headers
  const metrics = input.journey.metrics;

  if (isABR) {
    const cols = ["BASELINE", "Q1", "Q2", "Q3", "Q4 / EOY"];
    const colW = 1.3;
    const startX = 2.4;
    cols.forEach((label, i) => {
      const accent = i === 0 ? c.primary : i === 4 ? c.accent : c.medGrey;
      s.addShape("roundRect", {
        x: startX + i * (colW + 0.1), y: 1.2, w: colW, h: 0.35,
        fill: { color: accent },
      } as any);
      s.addText(label, {
        x: startX + i * (colW + 0.1), y: 1.22, w: colW, h: 0.3,
        fontFace: "Open Sans", fontSize: 9, bold: true, color: c.white, align: "center",
      });
    });

    // Metric rows
    metrics.forEach((m, ri) => {
      const ry = 1.7 + ri * 0.35;
      if (ri % 2 === 0) {
        s.addShape("rect", { x: 0.3, y: ry, w: 9.4, h: 0.35, fill: { color: c.lightBg } });
      }
      s.addText(m.label, {
        x: 0.4, y: ry + 0.02, w: 1.8, h: 0.18,
        fontFace: "Open Sans", fontSize: 8.5, bold: true, color: c.darkGrey,
      });
      s.addText(m.source, {
        x: 0.4, y: ry + 0.18, w: 1.8, h: 0.14,
        fontFace: "Open Sans", fontSize: 6, color: c.medGrey,
      });
      const vals = [m.baseline, m.q1, m.q2, m.q3, m.q4];
      vals.forEach((v, ci) => {
        s.addText(String(v ?? "___"), {
          x: startX + ci * (colW + 0.1), y: ry + 0.04, w: colW, h: 0.25,
          fontFace: "Open Sans", fontSize: 11, bold: true,
          color: ci === 0 ? c.primary : ci === 4 ? c.accent : c.medGrey,
          align: "center",
        });
      });
    });
  } else {
    // QBR: 3-column layout
    const cols = ["BASELINE", "LAST QUARTER", "THIS QUARTER"];
    const colW = 2.0;
    const startX = 2.2;
    cols.forEach((label, i) => {
      const accent = i === 0 ? c.primary : i === 1 ? c.medGrey : c.accent;
      s.addShape("roundRect", {
        x: startX + i * (colW + 0.15), y: 1.2, w: colW, h: 0.4,
        fill: { color: accent },
      } as any);
      s.addText(label, {
        x: startX + i * (colW + 0.15), y: 1.25, w: colW, h: 0.3,
        fontFace: "Open Sans", fontSize: 10, bold: true, color: c.white, align: "center",
      });
    });

    metrics.forEach((m, ri) => {
      const ry = 1.75 + ri * 0.38;
      if (ri % 2 === 0) {
        s.addShape("rect", { x: 0.3, y: ry, w: 9.4, h: 0.38, fill: { color: c.lightBg } });
      }
      s.addText(m.label, {
        x: 0.4, y: ry + 0.03, w: 1.6, h: 0.18,
        fontFace: "Open Sans", fontSize: 9.5, bold: true, color: c.darkGrey,
      });
      s.addText(m.source, {
        x: 0.4, y: ry + 0.2, w: 1.6, h: 0.14,
        fontFace: "Open Sans", fontSize: 6.5, color: c.medGrey,
      });
      const vals = [m.baseline, m.lastQuarter, m.thisQuarter];
      const colors = [c.primary, c.medGrey, c.accent];
      vals.forEach((v, ci) => {
        s.addText(String(v ?? "___"), {
          x: startX + ci * (colW + 0.15), y: ry + 0.06, w: colW, h: 0.25,
          fontFace: "Open Sans", fontSize: 13, bold: true, color: colors[ci], align: "center",
        });
      });
    });
  }

  addSlideFooter(s, input.branding, c);
}

function addSecuritySlide(
  pptx: InstanceType<typeof pptxgen>,
  input: QbrHydrationInput,
  c: ReturnType<typeof brandColors>,
) {
  if (!input.security) return;
  const sec = input.security;

  const s = pptx.addSlide();
  s.background = { color: c.white };

  addSlideHeader(s, "SECURITY POSTURE", input.branding, c);

  // KPI cards
  const kpis = [
    { label: "Secure Score", value: `${sec.secureScore}/${sec.secureScoreMax}`, source: input.branding.stack.securityCenter },
    { label: "Duo MFA", value: `${sec.mfaAdoption}%`, source: input.branding.stack.mfa },
    { label: "EDR Coverage", value: `${sec.edrCoverage}%`, source: input.branding.stack.edr },
    { label: "Patch Compliance", value: `${sec.patchCompliance}%`, source: input.branding.stack.rmm },
  ];

  kpis.forEach((k, i) => {
    const kx = 0.6 + i * 2.5;
    s.addShape("roundRect", {
      x: kx, y: 1.5, w: 2.2, h: 1.3,
      fill: { color: c.lightBg },
      line: { color: "E0E4EB", width: 0.75 },
    } as any);
    s.addShape("rect", { x: kx, y: 1.5, w: 2.2, h: 0.04, fill: { color: c.primary } });
    s.addText(k.value, {
      x: kx, y: 1.7, w: 2.2, h: 0.5,
      fontFace: "Open Sans", fontSize: 24, bold: true, color: c.primary, align: "center",
    });
    s.addText(k.label, {
      x: kx, y: 2.2, w: 2.2, h: 0.25,
      fontFace: "Open Sans", fontSize: 10, bold: true, color: c.darkGrey, align: "center",
    });
    s.addText(k.source, {
      x: kx, y: 2.45, w: 2.2, h: 0.2,
      fontFace: "Open Sans", fontSize: 7, color: c.medGrey, align: "center",
    });
  });

  // Talking points
  if (sec.talkingPoints.length) {
    s.addText("Key Findings", {
      x: 0.6, y: 3.1, w: 9, h: 0.3,
      fontFace: "Open Sans", fontSize: 12, bold: true, color: c.primary,
    });
    const tpText = sec.talkingPoints.map((t) => `•  ${t}`).join("\n");
    s.addText(tpText, {
      x: 0.8, y: 3.4, w: 9, h: 1.5,
      fontFace: "Open Sans", fontSize: 9, color: c.darkGrey, lineSpacingMultiple: 1.5,
    });
  }

  addSlideFooter(s, input.branding, c);
}

function addRoadmapSlide(
  pptx: InstanceType<typeof pptxgen>,
  input: QbrHydrationInput,
  c: ReturnType<typeof brandColors>,
) {
  if (!input.roadmapItems.length) return;

  const s = pptx.addSlide();
  s.background = { color: c.white };

  addSlideHeader(s, "STRATEGIC IT ROADMAP", input.branding, c);

  const rows: any[][] = [
    [
      { text: "Initiative", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
      { text: "Priority", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
      { text: "Status", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
      { text: "Quarter", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
      { text: "Est. Cost", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
    ],
  ];

  input.roadmapItems.slice(0, 12).forEach((item, i) => {
    const bg = i % 2 === 0 ? c.lightBg : c.white;
    rows.push([
      { text: item.title, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
      { text: item.priority, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
      { text: item.status, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
      { text: item.quarter, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
      { text: item.cost || "TBD", options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
    ]);
  });

  s.addTable(rows, {
    x: 0.6, y: 1.4, w: 9.0,
    fontFace: "Open Sans",
    border: { type: "solid", color: "E0E4EB", pt: 0.5 },
    colW: [3.5, 1.2, 1.2, 1.2, 1.2],
  } as any);

  addSlideFooter(s, input.branding, c);
}

function addActionItemsSlide(
  pptx: InstanceType<typeof pptxgen>,
  input: QbrHydrationInput,
  c: ReturnType<typeof brandColors>,
) {
  const s = pptx.addSlide();
  s.background = { color: c.white };

  addSlideHeader(s, "ACTION ITEMS & NEXT STEPS", input.branding, c);

  const rows: any[][] = [
    [
      { text: "Action", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
      { text: "Owner", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
      { text: "Due", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
      { text: "Status", options: { bold: true, fontSize: 8, color: c.white, fill: { color: c.primary } } },
    ],
  ];

  const items = input.actionItems?.length
    ? input.actionItems
    : [
        { action: "[Action item — fill during meeting]", owner: "[Name]", dueDate: "[Date]", status: "Open" },
        { action: "[Action item]", owner: "[Name]", dueDate: "[Date]", status: "Open" },
        { action: "[Action item]", owner: "[Name]", dueDate: "[Date]", status: "Open" },
      ];

  items.forEach((item, i) => {
    const bg = i % 2 === 0 ? c.lightBg : c.white;
    rows.push([
      { text: item.action, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
      { text: item.owner, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
      { text: item.dueDate, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
      { text: item.status, options: { fontSize: 8, color: c.darkGrey, fill: { color: bg } } },
    ]);
  });

  s.addTable(rows, {
    x: 0.6, y: 1.4, w: 9.0,
    fontFace: "Open Sans",
    border: { type: "solid", color: "E0E4EB", pt: 0.5 },
    colW: [4.5, 1.8, 1.5, 1.2],
  } as any);

  addSlideFooter(s, input.branding, c);
}

function addClosingSlide(
  pptx: InstanceType<typeof pptxgen>,
  input: QbrHydrationInput,
  c: ReturnType<typeof brandColors>,
) {
  const s = pptx.addSlide();
  s.background = { color: c.dark };

  s.addShape("rect", { x: 0, y: 0, w: 0.05, h: "100%", fill: { color: c.accent } });
  s.addShape("rect", { x: 0.05, y: 0, w: 0.02, h: "100%", fill: { color: c.primary } });

  s.addText("Thank You", {
    x: 0.8, y: 1.5, w: 8, h: 1.0,
    fontFace: "Open Sans", fontSize: 44, bold: true, color: c.white,
  });
  s.addText("Questions & Discussion", {
    x: 0.8, y: 2.5, w: 8, h: 0.5,
    fontFace: "Open Sans", fontSize: 18, color: c.accent,
  });
  s.addText(`${input.preparedBy || "[Your Name]"}  |  ${input.branding.companyName}`, {
    x: 0.8, y: 3.5, w: 8, h: 0.3,
    fontFace: "Open Sans", fontSize: 13, color: c.white,
  });

  addSlideFooter(s, input.branding, c);
}

// ── Helpers ────────────────────────────────────────────────────────

function addSlideHeader(
  slide: any,
  title: string,
  branding: TenantBranding,
  c: ReturnType<typeof brandColors>,
) {
  slide.addText(title, {
    x: 0.8, y: 0.35, w: 8, h: 0.5,
    fontFace: "Open Sans", fontSize: 18, bold: true, color: c.primary,
  });
  slide.addShape("rect", { x: 0.8, y: 0.82, w: 1.2, h: 0.03, fill: { color: c.primary } });
}

function addSlideFooter(
  slide: any,
  branding: TenantBranding,
  c: ReturnType<typeof brandColors>,
) {
  slide.addShape("rect", { x: 0, y: 5.2, w: "100%", h: 0.35, fill: { color: c.darker } });
  slide.addShape("rect", { x: 0, y: 5.2, w: "50%", h: 0.015, fill: { color: c.primary } });
  slide.addShape("rect", { x: "50%", y: 5.2, w: "50%", h: 0.015, fill: { color: c.accent } });

  slide.addText(`© ${new Date().getFullYear()} ${branding.copyrightHolder}. All rights reserved.`, {
    x: 0.4, y: 5.25, w: 3.5, h: 0.25,
    fontFace: "Open Sans", fontSize: 7, color: c.footerText,
  });
  slide.addText("CONFIDENTIAL & PROPRIETARY", {
    x: 3.5, y: 5.25, w: 3.0, h: 0.25,
    fontFace: "Open Sans", fontSize: 6.5, bold: true, color: c.footerText, align: "center",
  });
  const rightText = branding.footerTagline || branding.website;
  slide.addText(rightText, {
    x: 7.0, y: 5.25, w: 2.8, h: 0.25,
    fontFace: "Open Sans", fontSize: 7, color: c.footerText, align: "right",
  });
}

// ── Main Export ────────────────────────────────────────────────────

/**
 * Generate a fully-populated QBR/ABR PPTX from live data.
 * Returns a pptxgenjs instance — call .write() or .writeFile() on it.
 */
export function hydrateReport(input: QbrHydrationInput): InstanceType<typeof pptxgen> {
  const c = brandColors(input.branding);

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = input.preparedBy || input.branding.companyName;
  pptx.company = input.branding.companyName;
  pptx.title = `${input.clientName} — ${input.template.reportType === "abr" ? "Annual" : "Quarterly"} Business Review`;

  addCoverSlide(pptx, input, c);
  addJourneySlide(pptx, input, c);
  addSecuritySlide(pptx, input, c);
  addRoadmapSlide(pptx, input, c);
  addActionItemsSlide(pptx, input, c);
  addClosingSlide(pptx, input, c);

  return pptx;
}
