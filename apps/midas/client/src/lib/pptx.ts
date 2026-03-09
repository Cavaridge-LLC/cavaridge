import pptxgen from "pptxgenjs";

export type ExecutiveSnapshot = {
  engagementScore: number;
  goalsAligned: number;
  riskLevel: "Low" | "Moderate" | "Elevated" | "High";
  budgetTotal: number;
  adoptionPercent: number;
  roiStatus: "On track" | "At risk" | "Behind";
};

export type RoadmapInitiative = {
  quarter: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  cost?: string;
  businessProblem?: string;
};

export type PptxReportInput = {
  clientName: string;
  timeframeLabel: string;
  snapshot: ExecutiveSnapshot;
  initiatives: RoadmapInitiative[];
  executiveSummary?: string;
  preparedBy?: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const C = {
  darkNavy: "0F172A",
  navy: "1E293B",
  slate700: "334155",
  slate500: "64748B",
  slate400: "94A3B8",
  slate200: "E2E8F0",
  slate100: "F1F5F9",
  white: "FFFFFF",
  blue600: "2563EB",
  blue500: "3B82F6",
  blue400: "60A5FA",
  blue100: "DBEAFE",
  blue50: "EFF6FF",
  green600: "16A34A",
  green500: "22C55E",
  green100: "DCFCE7",
  amber600: "D97706",
  amber500: "F59E0B",
  amber100: "FEF3C7",
  red600: "DC2626",
  red500: "EF4444",
  red100: "FEE2E2",
  purple600: "9333EA",
  purple500: "A855F7",
  purple100: "F3E8FF",
  cyan500: "06B6D4",
  cyan100: "CFFAFE",
};

const TEAM_COLORS: Record<string, string> = {
  Infrastructure: C.blue500,
  Cloud: C.purple500,
  Security: C.red500,
  Strategy: C.amber500,
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: C.red600,
  High: C.amber600,
  Medium: C.blue600,
  Low: C.slate500,
};

const STATUS_LABELS: Record<string, { color: string; bg: string }> = {
  Completed: { color: C.green600, bg: C.green100 },
  "In Progress": { color: C.blue600, bg: C.blue100 },
  Planned: { color: C.slate700, bg: C.slate100 },
  Proposed: { color: C.slate500, bg: C.slate200 },
};

function addFooter(slide: any, pageNum: number, totalPages: number) {
  slide.addShape("line", {
    x: 0.6,
    y: 7.15,
    w: 12.13,
    h: 0,
    line: { color: C.slate200, width: 0.75 },
  });
  slide.addText("CONFIDENTIAL", {
    x: 0.6,
    y: 7.22,
    w: 3.0,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 8,
    bold: true,
    color: C.slate400,
  });
  slide.addText(`Page ${pageNum} of ${totalPages}`, {
    x: 10.0,
    y: 7.22,
    w: 2.73,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 8,
    color: C.slate400,
    align: "right",
  });
}

export function buildBoardPptx(input: PptxReportInput) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = input.preparedBy || "Midas by Cavaridge, LLC";
  pptx.company = "";
  pptx.subject = "Strategic Technology Roadmap";
  pptx.title = `${input.clientName} — Strategic Technology Roadmap`;

  const quarters = Array.from(new Set(input.initiatives.map((i) => i.quarter))).sort();
  const totalPages = 6;

  // ═══════════════════════════════════════════════════════════════════
  // SLIDE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════
  const s1 = pptx.addSlide();

  s1.addShape("rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: { type: "solid", color: C.darkNavy },
  });

  s1.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.14,
    h: "100%",
    fill: { type: "solid", color: C.blue500 },
  });

  s1.addShape("rect", {
    x: 0,
    y: 5.4,
    w: "100%",
    h: 0.06,
    fill: { type: "solid", color: C.blue500 },
  });

  s1.addText("STRATEGIC\nTECHNOLOGY ROADMAP", {
    x: 1.0,
    y: 1.6,
    w: 11.0,
    h: 2.0,
    fontFace: "Aptos Display",
    fontSize: 44,
    bold: true,
    color: C.white,
    lineSpacingMultiple: 1.1,
  });

  s1.addText(input.clientName.toUpperCase(), {
    x: 1.0,
    y: 3.6,
    w: 11.0,
    h: 0.6,
    fontFace: "Aptos",
    fontSize: 22,
    bold: true,
    color: C.blue400,
  });

  s1.addText(input.timeframeLabel, {
    x: 1.0,
    y: 4.2,
    w: 11.0,
    h: 0.5,
    fontFace: "Aptos",
    fontSize: 16,
    color: C.slate400,
  });

  s1.addText(`Prepared ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, {
    x: 1.0,
    y: 5.7,
    w: 6.0,
    h: 0.4,
    fontFace: "Aptos",
    fontSize: 12,
    color: C.slate500,
  });

  s1.addText(input.preparedBy || "Your vCIO Advisory Team", {
    x: 7.0,
    y: 5.7,
    w: 5.73,
    h: 0.4,
    fontFace: "Aptos",
    fontSize: 12,
    color: C.slate400,
    align: "right",
  });

  s1.addText("This document is confidential and intended for internal strategic planning purposes.", {
    x: 1.0,
    y: 6.3,
    w: 11.73,
    h: 0.4,
    fontFace: "Aptos",
    fontSize: 9,
    color: C.slate700,
  });

  s1.addText("\u00A9 2026 Cavaridge, LLC. All rights reserved.", {
    x: 1.0,
    y: 6.7,
    w: 11.73,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 8,
    color: C.slate700,
  });

  // ═══════════════════════════════════════════════════════════════════
  // SLIDE 2 — EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const s2 = pptx.addSlide();
  s2.background = { color: C.white };

  s2.addShape("rect", { x: 0, y: 0, w: "100%", h: 1.15, fill: { type: "solid", color: C.darkNavy } });
  s2.addShape("rect", { x: 0, y: 1.15, w: "100%", h: 0.05, fill: { type: "solid", color: C.blue500 } });

  s2.addText("EXECUTIVE SUMMARY", {
    x: 0.7,
    y: 0.25,
    w: 8.0,
    h: 0.65,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: C.white,
  });

  s2.addText(input.clientName, {
    x: 9.5,
    y: 0.35,
    w: 3.73,
    h: 0.45,
    fontFace: "Aptos",
    fontSize: 13,
    color: C.slate400,
    align: "right",
  });

  const summaryText =
    input.executiveSummary ||
    `This strategic roadmap outlines ${input.initiatives.length} initiatives across ${quarters.length} quarters, designed to strengthen ${input.clientName}'s technology posture, reduce operational risk, and align IT investments with business objectives.\n\nKey priorities include risk reduction, infrastructure modernization, and building a scalable foundation for growth. Each initiative has been assessed for business impact, cost, and strategic alignment.`;

  s2.addShape("roundRect", {
    x: 0.7,
    y: 1.5,
    w: 7.8,
    h: 2.4,
    fill: { type: "solid", color: C.blue50 },
    line: { color: C.blue100, width: 1 },
  } as any);

  s2.addText("STRATEGIC OVERVIEW", {
    x: 1.0,
    y: 1.65,
    w: 7.2,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: C.blue600,
  });

  s2.addText(summaryText, {
    x: 1.0,
    y: 2.0,
    w: 7.2,
    h: 1.8,
    fontFace: "Aptos",
    fontSize: 11,
    color: C.slate700,
    lineSpacingMultiple: 1.4,
    valign: "top",
  });

  const riskColor =
    input.snapshot.riskLevel === "Low" ? C.green600 : input.snapshot.riskLevel === "Moderate" ? C.amber600 : input.snapshot.riskLevel === "Elevated" ? C.amber600 : C.red600;
  const riskBg =
    input.snapshot.riskLevel === "Low" ? C.green100 : input.snapshot.riskLevel === "Moderate" ? C.amber100 : input.snapshot.riskLevel === "Elevated" ? C.amber100 : C.red100;
  const roiColor = input.snapshot.roiStatus === "On track" ? C.green600 : C.amber600;
  const roiBg = input.snapshot.roiStatus === "On track" ? C.green100 : C.amber100;

  const sideKpis: Array<{ label: string; value: string; accent: string; bg: string }> = [
    { label: "ENGAGEMENT", value: `${input.snapshot.engagementScore}/100`, accent: C.green600, bg: C.green100 },
    { label: "GOALS ALIGNED", value: `${input.snapshot.goalsAligned}`, accent: C.blue600, bg: C.blue100 },
    { label: "RISK LEVEL", value: input.snapshot.riskLevel, accent: riskColor, bg: riskBg },
    { label: "BUDGET", value: money(input.snapshot.budgetTotal), accent: C.purple600, bg: C.purple100 },
    { label: "ADOPTION", value: `${input.snapshot.adoptionPercent}%`, accent: C.cyan500, bg: C.cyan100 },
    { label: "ROI STATUS", value: input.snapshot.roiStatus, accent: roiColor, bg: roiBg },
  ];

  sideKpis.forEach((k, idx) => {
    const x = 9.0;
    const y = 1.5 + idx * 0.72;
    s2.addShape("roundRect", {
      x,
      y,
      w: 3.73,
      h: 0.62,
      fill: { type: "solid", color: k.bg },
      line: { color: k.bg },
    } as any);

    s2.addShape("rect", {
      x,
      y,
      w: 0.1,
      h: 0.62,
      fill: { type: "solid", color: k.accent },
    });

    s2.addText(k.label, {
      x: x + 0.22,
      y: y + 0.06,
      w: 2.0,
      h: 0.22,
      fontFace: "Aptos",
      fontSize: 8,
      bold: true,
      color: k.accent,
    });

    s2.addText(k.value, {
      x: x + 0.22,
      y: y + 0.28,
      w: 3.3,
      h: 0.28,
      fontFace: "Aptos Display",
      fontSize: 16,
      bold: true,
      color: C.darkNavy,
    });
  });

  const byTeam = input.initiatives.reduce(
    (acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const byStatus = input.initiatives.reduce(
    (acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statsY = 4.2;

  s2.addText("INITIATIVES BY SERVICE AREA", {
    x: 0.7,
    y: statsY,
    w: 5.0,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    color: C.slate700,
  });

  Object.entries(byTeam).forEach(([team, count], idx) => {
    const y = statsY + 0.4 + idx * 0.42;
    const barMax = 4.5;
    const barW = (count / input.initiatives.length) * barMax;
    const color = TEAM_COLORS[team] || C.slate500;

    s2.addText(team, {
      x: 0.7,
      y,
      w: 2.0,
      h: 0.32,
      fontFace: "Aptos",
      fontSize: 10,
      color: C.slate700,
    });

    s2.addShape("roundRect", {
      x: 2.8,
      y: y + 0.05,
      w: barMax,
      h: 0.22,
      fill: { type: "solid", color: C.slate100 },
    } as any);

    s2.addShape("roundRect", {
      x: 2.8,
      y: y + 0.05,
      w: Math.max(0.15, barW),
      h: 0.22,
      fill: { type: "solid", color: color },
    } as any);

    s2.addText(`${count}`, {
      x: 2.8 + barW + 0.12,
      y,
      w: 0.5,
      h: 0.32,
      fontFace: "Aptos",
      fontSize: 10,
      bold: true,
      color: C.slate700,
    });
  });

  s2.addText("INITIATIVES BY STATUS", {
    x: 9.0,
    y: statsY + 0.5,
    w: 3.73,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    color: C.slate700,
  });

  Object.entries(byStatus).forEach(([status, count], idx) => {
    const y = statsY + 0.9 + idx * 0.42;
    const st = STATUS_LABELS[status] || { color: C.slate500, bg: C.slate100 };

    s2.addShape("roundRect", {
      x: 9.0,
      y: y + 0.02,
      w: 0.28,
      h: 0.28,
      fill: { type: "solid", color: st.bg },
    } as any);

    s2.addShape("ellipse", {
      x: 9.06,
      y: y + 0.08,
      w: 0.16,
      h: 0.16,
      fill: { type: "solid", color: st.color },
    });

    s2.addText(`${status}: ${count}`, {
      x: 9.4,
      y,
      w: 3.0,
      h: 0.32,
      fontFace: "Aptos",
      fontSize: 10,
      color: C.slate700,
    });
  });

  addFooter(s2, 2, totalPages);

  // ═══════════════════════════════════════════════════════════════════
  // SLIDE 3 — RISK & SECURITY POSTURE
  // ═══════════════════════════════════════════════════════════════════
  const s3 = pptx.addSlide();
  s3.background = { color: C.white };

  s3.addShape("rect", { x: 0, y: 0, w: "100%", h: 1.15, fill: { type: "solid", color: C.darkNavy } });
  s3.addShape("rect", { x: 0, y: 1.15, w: "100%", h: 0.05, fill: { type: "solid", color: C.blue500 } });

  s3.addText("RISK & SECURITY POSTURE", {
    x: 0.7,
    y: 0.25,
    w: 8.0,
    h: 0.65,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: C.white,
  });

  const securityInitiatives = input.initiatives.filter((i) => i.category === "Security");
  const criticalCount = input.initiatives.filter((i) => i.priority === "Critical").length;
  const highCount = input.initiatives.filter((i) => i.priority === "High").length;
  const completedCount = input.initiatives.filter((i) => i.status === "Completed").length;

  s3.addShape("roundRect", {
    x: 0.7,
    y: 1.5,
    w: 3.8,
    h: 2.6,
    fill: { type: "solid", color: riskBg },
    line: { color: riskBg },
  } as any);

  s3.addShape("rect", {
    x: 0.7,
    y: 1.5,
    w: 0.12,
    h: 2.6,
    fill: { type: "solid", color: riskColor },
  });

  s3.addText("OVERALL RISK ASSESSMENT", {
    x: 1.05,
    y: 1.65,
    w: 3.2,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: riskColor,
  });

  s3.addText(input.snapshot.riskLevel.toUpperCase(), {
    x: 1.05,
    y: 2.0,
    w: 3.2,
    h: 0.6,
    fontFace: "Aptos Display",
    fontSize: 36,
    bold: true,
    color: C.darkNavy,
  });

  const riskNarrative =
    input.snapshot.riskLevel === "Low"
      ? "Security posture is strong with minimal exposure. Continue monitoring and proactive patching."
      : input.snapshot.riskLevel === "Elevated"
        ? "Several areas require attention to reduce exposure. Priority should be given to identity security, backup validation, and compliance readiness."
        : "Immediate action is needed. Critical vulnerabilities or compliance gaps have been identified that could impact operations.";

  s3.addText(riskNarrative, {
    x: 1.05,
    y: 2.7,
    w: 3.2,
    h: 1.2,
    fontFace: "Aptos",
    fontSize: 10,
    color: C.slate700,
    lineSpacingMultiple: 1.4,
    valign: "top",
  });

  const riskMetrics = [
    { label: "Critical Initiatives", value: `${criticalCount}`, color: C.red600, bg: C.red100 },
    { label: "High Priority", value: `${highCount}`, color: C.amber600, bg: C.amber100 },
    { label: "Security Initiatives", value: `${securityInitiatives.length}`, color: C.blue600, bg: C.blue100 },
    { label: "Completed", value: `${completedCount}`, color: C.green600, bg: C.green100 },
  ];

  riskMetrics.forEach((m, idx) => {
    const x = 5.0 + (idx % 2) * 4.0;
    const y = 1.5 + Math.floor(idx / 2) * 1.4;

    s3.addShape("roundRect", {
      x,
      y,
      w: 3.73,
      h: 1.2,
      fill: { type: "solid", color: C.slate100 },
      line: { color: C.slate200, width: 0.5 },
    } as any);

    s3.addShape("rect", {
      x,
      y,
      w: 0.1,
      h: 1.2,
      fill: { type: "solid", color: m.color },
    });

    s3.addText(m.label.toUpperCase(), {
      x: x + 0.25,
      y: y + 0.15,
      w: 3.3,
      h: 0.25,
      fontFace: "Aptos",
      fontSize: 9,
      bold: true,
      color: C.slate500,
    });

    s3.addText(m.value, {
      x: x + 0.25,
      y: y + 0.45,
      w: 3.3,
      h: 0.6,
      fontFace: "Aptos Display",
      fontSize: 36,
      bold: true,
      color: m.color,
    });
  });

  s3.addText("KEY SECURITY INITIATIVES", {
    x: 0.7,
    y: 4.4,
    w: 12.0,
    h: 0.35,
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    color: C.slate700,
  });

  const secItems = securityInitiatives.length > 0 ? securityInitiatives : input.initiatives.filter((i) => i.priority === "Critical" || i.priority === "High").slice(0, 4);

  secItems.slice(0, 4).forEach((it, idx) => {
    const y = 4.9 + idx * 0.55;
    const st = STATUS_LABELS[it.status] || STATUS_LABELS["Planned"];

    s3.addShape("roundRect", {
      x: 0.7,
      y,
      w: 12.0,
      h: 0.45,
      fill: { type: "solid", color: C.white },
      line: { color: C.slate200, width: 0.5 },
    } as any);

    s3.addShape("rect", {
      x: 0.7,
      y,
      w: 0.08,
      h: 0.45,
      fill: { type: "solid", color: PRIORITY_COLORS[it.priority] || C.slate500 },
    });

    s3.addText(it.title, {
      x: 0.95,
      y,
      w: 4.5,
      h: 0.45,
      fontFace: "Aptos",
      fontSize: 10,
      bold: true,
      color: C.darkNavy,
    });

    s3.addText(it.quarter, {
      x: 5.5,
      y,
      w: 1.5,
      h: 0.45,
      fontFace: "Aptos",
      fontSize: 10,
      color: C.slate500,
    });

    s3.addText(it.priority, {
      x: 7.0,
      y,
      w: 1.5,
      h: 0.45,
      fontFace: "Aptos",
      fontSize: 10,
      bold: true,
      color: PRIORITY_COLORS[it.priority] || C.slate500,
    });

    s3.addShape("roundRect", {
      x: 9.0,
      y: y + 0.1,
      w: 1.5,
      h: 0.25,
      fill: { type: "solid", color: st.bg },
    } as any);

    s3.addText(it.status, {
      x: 9.0,
      y: y + 0.1,
      w: 1.5,
      h: 0.25,
      fontFace: "Aptos",
      fontSize: 8,
      bold: true,
      color: st.color,
      align: "center",
    });
  });

  addFooter(s3, 3, totalPages);

  // ═══════════════════════════════════════════════════════════════════
  // SLIDE 4 — QUARTERLY ROADMAP (visual timeline)
  // ═══════════════════════════════════════════════════════════════════
  const s4 = pptx.addSlide();
  s4.background = { color: C.white };

  s4.addShape("rect", { x: 0, y: 0, w: "100%", h: 1.15, fill: { type: "solid", color: C.darkNavy } });
  s4.addShape("rect", { x: 0, y: 1.15, w: "100%", h: 0.05, fill: { type: "solid", color: C.blue500 } });

  s4.addText("QUARTERLY INITIATIVE ROADMAP", {
    x: 0.7,
    y: 0.25,
    w: 8.0,
    h: 0.65,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: C.white,
  });

  s4.addText(`${input.initiatives.length} initiatives across ${quarters.length} quarters`, {
    x: 9.5,
    y: 0.35,
    w: 3.23,
    h: 0.45,
    fontFace: "Aptos",
    fontSize: 11,
    color: C.slate400,
    align: "right",
  });

  const colW = (12.0) / Math.max(1, quarters.length);
  const timelineY = 1.5;

  s4.addShape("rect", {
    x: 0.7,
    y: timelineY + 0.45,
    w: 12.0,
    h: 0.04,
    fill: { type: "solid", color: C.blue500 },
  });

  quarters.forEach((q, qi) => {
    const x = 0.7 + qi * colW;

    s4.addShape("ellipse", {
      x: x + colW / 2 - 0.12,
      y: timelineY + 0.35,
      w: 0.24,
      h: 0.24,
      fill: { type: "solid", color: C.blue500 },
    });

    s4.addText(q, {
      x,
      y: timelineY,
      w: colW,
      h: 0.35,
      fontFace: "Aptos Display",
      fontSize: 14,
      bold: true,
      color: C.darkNavy,
      align: "center",
    });

    const items = input.initiatives.filter((i) => i.quarter === q).slice(0, 5);

    items.forEach((it, ii) => {
      const cardY = timelineY + 0.75 + ii * 0.95;
      const teamColor = TEAM_COLORS[it.category] || C.slate500;
      const st = STATUS_LABELS[it.status] || STATUS_LABELS["Planned"];

      s4.addShape("roundRect", {
        x: x + 0.08,
        y: cardY,
        w: colW - 0.16,
        h: 0.82,
        fill: { type: "solid", color: C.white },
        line: { color: C.slate200, width: 0.75 },
        shadow: { type: "outer", blur: 3, offset: 1, opacity: 0.15, color: "000000" } as any,
      } as any);

      s4.addShape("rect", {
        x: x + 0.08,
        y: cardY,
        w: 0.08,
        h: 0.82,
        fill: { type: "solid", color: teamColor },
      });

      s4.addText(it.title, {
        x: x + 0.24,
        y: cardY + 0.08,
        w: colW - 0.48,
        h: 0.3,
        fontFace: "Aptos",
        fontSize: 9,
        bold: true,
        color: C.darkNavy,
      });

      s4.addShape("roundRect", {
        x: x + 0.24,
        y: cardY + 0.42,
        w: 1.0,
        h: 0.22,
        fill: { type: "solid", color: st.bg },
      } as any);

      s4.addText(it.status, {
        x: x + 0.24,
        y: cardY + 0.42,
        w: 1.0,
        h: 0.22,
        fontFace: "Aptos",
        fontSize: 7,
        bold: true,
        color: st.color,
        align: "center",
      });

      if (it.cost) {
        s4.addText(it.cost, {
          x: x + 1.35,
          y: cardY + 0.42,
          w: colW - 1.6,
          h: 0.22,
          fontFace: "Aptos",
          fontSize: 8,
          bold: true,
          color: C.slate500,
          align: "right",
        });
      }
    });
  });

  const legendY = 6.4;
  s4.addText("SERVICE AREAS:", {
    x: 0.7,
    y: legendY,
    w: 1.6,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: C.slate500,
  });

  Object.entries(TEAM_COLORS).forEach(([team, color], idx) => {
    const x = 2.4 + idx * 2.2;
    s4.addShape("roundRect", {
      x,
      y: legendY + 0.06,
      w: 0.2,
      h: 0.2,
      fill: { type: "solid", color: color },
    } as any);

    s4.addText(team, {
      x: x + 0.28,
      y: legendY,
      w: 1.8,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 9,
      color: C.slate700,
    });
  });

  addFooter(s4, 4, totalPages);

  // ═══════════════════════════════════════════════════════════════════
  // SLIDE 5 — BUDGET & INVESTMENT SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const s5 = pptx.addSlide();
  s5.background = { color: C.white };

  s5.addShape("rect", { x: 0, y: 0, w: "100%", h: 1.15, fill: { type: "solid", color: C.darkNavy } });
  s5.addShape("rect", { x: 0, y: 1.15, w: "100%", h: 0.05, fill: { type: "solid", color: C.blue500 } });

  s5.addText("BUDGET & INVESTMENT SUMMARY", {
    x: 0.7,
    y: 0.25,
    w: 8.0,
    h: 0.65,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: C.white,
  });

  const budgetCards = [
    { label: "TOTAL BUDGET", value: money(input.snapshot.budgetTotal), icon: "$", color: C.blue600, bg: C.blue50 },
    { label: "ADOPTION RATE", value: `${input.snapshot.adoptionPercent}%`, icon: "%", color: C.green600, bg: C.green100 },
    { label: "ROI STATUS", value: input.snapshot.roiStatus, icon: "^", color: roiColor, bg: roiBg },
  ];

  budgetCards.forEach((bc, idx) => {
    const x = 0.7 + idx * 4.1;
    s5.addShape("roundRect", {
      x,
      y: 1.5,
      w: 3.85,
      h: 1.5,
      fill: { type: "solid", color: bc.bg },
      line: { color: bc.bg },
    } as any);

    s5.addShape("rect", {
      x,
      y: 1.5,
      w: 0.12,
      h: 1.5,
      fill: { type: "solid", color: bc.color },
    });

    s5.addText(bc.label, {
      x: x + 0.3,
      y: 1.65,
      w: 3.3,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 10,
      bold: true,
      color: bc.color,
    });

    s5.addText(bc.value, {
      x: x + 0.3,
      y: 2.0,
      w: 3.3,
      h: 0.8,
      fontFace: "Aptos Display",
      fontSize: 32,
      bold: true,
      color: C.darkNavy,
    });
  });

  s5.addText("INVESTMENT BY QUARTER", {
    x: 0.7,
    y: 3.3,
    w: 12.0,
    h: 0.4,
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    color: C.slate700,
  });

  quarters.forEach((q, qi) => {
    const x = 0.7 + qi * 3.05;
    const qItems = input.initiatives.filter((i) => i.quarter === q);

    s5.addShape("roundRect", {
      x,
      y: 3.8,
      w: 2.85,
      h: 3.0,
      fill: { type: "solid", color: C.slate100 },
      line: { color: C.slate200, width: 0.5 },
    } as any);

    s5.addText(q, {
      x: x + 0.15,
      y: 3.95,
      w: 2.55,
      h: 0.35,
      fontFace: "Aptos Display",
      fontSize: 13,
      bold: true,
      color: C.darkNavy,
    });

    s5.addText(`${qItems.length} initiative${qItems.length !== 1 ? "s" : ""}`, {
      x: x + 0.15,
      y: 4.3,
      w: 2.55,
      h: 0.25,
      fontFace: "Aptos",
      fontSize: 9,
      color: C.slate500,
    });

    qItems.slice(0, 4).forEach((it, ii) => {
      const iy = 4.7 + ii * 0.5;

      s5.addText(it.title, {
        x: x + 0.15,
        y: iy,
        w: 1.8,
        h: 0.25,
        fontFace: "Aptos",
        fontSize: 9,
        color: C.slate700,
      });

      s5.addText(it.cost || "TBD", {
        x: x + 1.8,
        y: iy,
        w: 0.9,
        h: 0.25,
        fontFace: "Aptos",
        fontSize: 9,
        bold: true,
        color: C.blue600,
        align: "right",
      });
    });
  });

  addFooter(s5, 5, totalPages);

  // ═══════════════════════════════════════════════════════════════════
  // SLIDE 6 — NEXT STEPS & RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════
  const s6 = pptx.addSlide();
  s6.background = { color: C.white };

  s6.addShape("rect", { x: 0, y: 0, w: "100%", h: 1.15, fill: { type: "solid", color: C.darkNavy } });
  s6.addShape("rect", { x: 0, y: 1.15, w: "100%", h: 0.05, fill: { type: "solid", color: C.blue500 } });

  s6.addText("NEXT STEPS & RECOMMENDATIONS", {
    x: 0.7,
    y: 0.25,
    w: 8.0,
    h: 0.65,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: C.white,
  });

  const recommendations = [
    {
      title: "Approve Q1-Q2 Initiative Budget",
      desc: `Approve the ${money(input.snapshot.budgetTotal)} investment plan to maintain momentum on critical security and infrastructure projects.`,
      icon: "1",
      color: C.blue600,
    },
    {
      title: "Prioritize Risk Reduction",
      desc: `With risk currently at "${input.snapshot.riskLevel}", focus on security hardening (MFA, backup validation, endpoint protection) before expansion projects.`,
      icon: "2",
      color: C.red600,
    },
    {
      title: "Drive Technology Adoption",
      desc: `Current adoption is at ${input.snapshot.adoptionPercent}%. Invest in change management and training to ensure deployed solutions deliver full ROI.`,
      icon: "3",
      color: C.green600,
    },
    {
      title: "Schedule Quarterly Progress Review",
      desc: "Book the next QBR to review progress, adjust priorities, and maintain strategic alignment with evolving business needs.",
      icon: "4",
      color: C.purple600,
    },
  ];

  recommendations.forEach((r, idx) => {
    const y = 1.55 + idx * 1.35;

    s6.addShape("roundRect", {
      x: 0.7,
      y,
      w: 12.0,
      h: 1.15,
      fill: { type: "solid", color: C.white },
      line: { color: C.slate200, width: 0.75 },
      shadow: { type: "outer", blur: 3, offset: 1, opacity: 0.1, color: "000000" } as any,
    } as any);

    s6.addShape("ellipse", {
      x: 1.0,
      y: y + 0.25,
      w: 0.65,
      h: 0.65,
      fill: { type: "solid", color: r.color },
    });

    s6.addText(r.icon, {
      x: 1.0,
      y: y + 0.25,
      w: 0.65,
      h: 0.65,
      fontFace: "Aptos Display",
      fontSize: 22,
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
    });

    s6.addText(r.title, {
      x: 1.9,
      y: y + 0.15,
      w: 10.5,
      h: 0.4,
      fontFace: "Aptos Display",
      fontSize: 14,
      bold: true,
      color: C.darkNavy,
    });

    s6.addText(r.desc, {
      x: 1.9,
      y: y + 0.55,
      w: 10.5,
      h: 0.5,
      fontFace: "Aptos",
      fontSize: 11,
      color: C.slate500,
      lineSpacingMultiple: 1.3,
    });
  });

  s6.addShape("roundRect", {
    x: 0.7,
    y: 7.0,
    w: 12.0,
    h: 0.0,
    fill: { type: "solid", color: C.blue500 },
  } as any);

  s6.addShape("rect", {
    x: 0.7,
    y: 6.95,
    w: 12.0,
    h: 0.04,
    fill: { type: "solid", color: C.blue500 },
  });

  addFooter(s6, 6, totalPages);

  return pptx;
}
