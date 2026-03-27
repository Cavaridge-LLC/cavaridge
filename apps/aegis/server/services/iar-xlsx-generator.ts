/**
 * CVG-AEGIS — IAR XLSX Report Generator
 *
 * Generates branded 5-tab XLSX report for Identity Access Reviews.
 * Ports Python prototype (docs/prototypes/aegis-identity-review/process.py)
 * to production TypeScript using ExcelJS.
 *
 * Branding: Cavaridge standards per CLAUDE.md
 * Output: Buffer (for HTTP response streaming)
 */
import ExcelJS from "exceljs";
import type { IarResult, IarRiskFlag, M365UserRecord } from "./iar-engine.js";

// =============================================================================
// CONSTANTS — Cavaridge Brand Standards
// =============================================================================

const BLUE_HDR = "2E5090";
const BAND_HEX = "F2F6FA";
const BORDER_HEX = "BFBFBF";
const FONT_NAME = "Arial";
const RED_BG = "FFF0F0";
const AMBER_BG = "FFF3E0";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_HEX } },
  bottom: { style: "thin", color: { argb: BORDER_HEX } },
  left: { style: "thin", color: { argb: BORDER_HEX } },
  right: { style: "thin", color: { argb: BORDER_HEX } },
};

// =============================================================================
// HELPERS
// =============================================================================

interface EnrichedUser extends M365UserRecord {
  isBlocked: boolean;
  isLicensed: boolean;
  isExternal: boolean;
  licenseStatus: string;
  daysSinceCreated: number | null;
  riskFlags: string;
}

function enrichUsers(
  users: M365UserRecord[],
  flags: IarRiskFlag[]
): EnrichedUser[] {
  const flagsByUpn = new Map<string, string[]>();
  for (const flag of flags) {
    const key = flag.userPrincipalName.toLowerCase();
    if (!flagsByUpn.has(key)) flagsByUpn.set(key, []);
    flagsByUpn.get(key)!.push(flag.flagType.replace(/_/g, " "));
  }

  return users.map((u) => {
    const upnLower = u.userPrincipalName.toLowerCase();
    const isExternal = upnLower.includes("#ext#");
    const isLicensed = u.assignedLicenses.length > 0;
    const isBlocked = !u.accountEnabled;
    const createdDate = u.createdDateTime ? new Date(u.createdDateTime) : null;
    const daysSinceCreated = createdDate
      ? Math.floor((Date.now() - createdDate.getTime()) / 86400000)
      : null;

    return {
      ...u,
      isBlocked,
      isLicensed,
      isExternal,
      licenseStatus: isLicensed ? u.assignedLicenses.join(" + ") : "Unlicensed",
      daysSinceCreated,
      riskFlags: flagsByUpn.get(upnLower)?.join("; ") ?? "None",
    };
  });
}

function styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number) {
  const row = ws.getRow(rowNum);
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_HDR } };
    cell.font = { name: FONT_NAME, bold: true, color: { argb: "FFFFFF" }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = THIN_BORDER;
  });
  row.height = 24;
}

function styleDataRows(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  riskColIdx?: number
) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    const isEven = (r - startRow) % 2 === 0;
    const riskVal = riskColIdx ? row.getCell(riskColIdx).value : null;
    const hasRisk = riskVal && String(riskVal) !== "None";

    row.eachCell((cell) => {
      cell.font = { name: FONT_NAME, size: 9 };
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle", wrapText: true };
      if (hasRisk) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? BAND_HEX : "FFFFFF" },
        };
      }
    });
  }
}

function writeDataSheet(
  ws: ExcelJS.Worksheet,
  data: Record<string, unknown>[],
  columns: { header: string; key: string; width: number }[],
  options: { riskKey?: string; tabColor?: string } = {}
) {
  if (options.tabColor) {
    ws.properties.tabColor = { argb: options.tabColor };
  }

  // Headers
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  styleHeaderRow(ws, 1);

  // Data rows
  for (const item of data) {
    const rowData: Record<string, unknown> = {};
    for (const col of columns) {
      const val = item[col.key];
      if (val instanceof Date) {
        rowData[col.key] = val.toISOString().split("T")[0];
      } else if (val === null || val === undefined) {
        rowData[col.key] = "";
      } else {
        rowData[col.key] = val;
      }
    }
    ws.addRow(rowData);
  }

  const dataEnd = data.length + 1;
  const riskColIdx = options.riskKey
    ? columns.findIndex((c) => c.key === options.riskKey) + 1
    : undefined;
  styleDataRows(ws, 2, dataEnd, riskColIdx);

  // Freeze header + auto-filter
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: dataEnd, column: columns.length },
  };
}

// =============================================================================
// EXECUTIVE SUMMARY
// =============================================================================

function buildExecutiveSummary(
  ws: ExcelJS.Worksheet,
  enriched: EnrichedUser[],
  result: IarResult,
  tenantName: string,
  preparedBy: string
) {
  ws.properties.tabColor = { argb: BLUE_HDR };

  // Title
  ws.mergeCells("A1:E1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${tenantName} — Microsoft 365 User Security Analysis`;
  titleCell.font = { name: FONT_NAME, bold: true, size: 14, color: { argb: BLUE_HDR } };

  ws.getCell("A2").value = `Report Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
  ws.getCell("A2").font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "1A1A1A" } };

  ws.getCell("A3").value = `Prepared by: ${preparedBy}`;
  ws.getCell("A3").font = { name: FONT_NAME, italic: true, size: 10, color: { argb: "555555" } };

  // Metrics
  const total = enriched.length;
  const members = enriched.filter((u) => !u.isExternal).length;
  const externals = enriched.filter((u) => u.isExternal).length;
  const licensed = enriched.filter((u) => u.isLicensed).length;
  const unlicensed = enriched.filter((u) => !u.isLicensed).length;
  const blocked = enriched.filter((u) => u.isBlocked).length;
  const blockedLicensed = enriched.filter((u) => u.isBlocked && u.isLicensed).length;
  const extLicensed = enriched.filter((u) => u.isExternal && u.isLicensed).length;
  const flagged = enriched.filter((u) => u.riskFlags !== "None").length;
  const inactive90 = enriched.filter(
    (u) => u.isLicensed && u.daysSinceActivity != null && u.daysSinceActivity > 90
  ).length;
  const inactive180 = enriched.filter(
    (u) => u.isLicensed && u.daysSinceActivity != null && u.daysSinceActivity > 180
  ).length;

  const metrics: [string, string | number, string][] = [
    ["Metric", "Count", "Notes"],
    ["Total User Objects", total, "Includes members, guests, system/room accounts"],
    ["Internal Members", members, "Accounts with internal UPN"],
    ["External Guests", externals, "Accounts with #EXT# in UPN"],
    ["Licensed Users", licensed, "Users with at least one M365 license assigned"],
    ["Unlicensed Users", unlicensed, "No license assigned"],
    ["Sign-In Blocked", blocked, "Credential block enabled"],
    ["Blocked but Still Licensed", blockedLicensed, "⚠ Immediate action — wasted licenses"],
    ["External Guests with Licenses", extLicensed, "⚠ Review — external users should rarely hold licenses"],
    ["Licensed Users Inactive >90 Days", inactive90, "⚠ Potential reclamation candidates"],
    ["Licensed Users Inactive >180 Days", inactive180, "⚠ Strong reclamation candidates"],
    ["Total Users with Risk Flags", flagged, "Users appearing on Flagged Users tab"],
  ];

  const startRow = 5;
  for (let i = 0; i < metrics.length; i++) {
    const r = startRow + i;
    ws.getCell(r, 1).value = metrics[i][0];
    ws.getCell(r, 2).value = metrics[i][1];
    ws.getCell(r, 3).value = metrics[i][2];
  }

  styleHeaderRow(ws, startRow);
  for (let r = startRow + 1; r < startRow + metrics.length; r++) {
    const isEven = (r - startRow) % 2 === 0;
    const notes = String(ws.getCell(r, 3).value ?? "");
    const isWarning = notes.includes("⚠");

    for (let c = 1; c <= 3; c++) {
      const cell = ws.getCell(r, c);
      cell.font = c === 1
        ? { name: FONT_NAME, bold: true, size: 9 }
        : { name: FONT_NAME, size: 9 };
      cell.border = THIN_BORDER;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isWarning ? AMBER_BG : isEven ? BAND_HEX : "FFFFFF" },
      };
    }
  }

  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 65;

  // Recommendations
  const recRow = startRow + metrics.length + 2;
  ws.getCell(recRow, 1).value = "Key Recommendations";
  ws.getCell(recRow, 1).font = { name: FONT_NAME, bold: true, size: 11, color: { argb: "1A1A1A" } };

  const recs = [
    "Remove licenses from all blocked accounts to reclaim spend immediately.",
    "Review all external guest accounts with assigned licenses — revoke unless business-justified.",
    "Disable or delete licensed accounts inactive for 180+ days after stakeholder confirmation.",
    "Investigate licensed accounts with no activity data — may be service accounts or misconfigured.",
    "Implement a recurring quarterly user access review cadence.",
    "Purge stale external guest accounts (>180 days, unlicensed, no activity).",
  ];

  for (let i = 0; i < recs.length; i++) {
    const cell = ws.getCell(recRow + 1 + i, 1);
    cell.value = `${i + 1}. ${recs[i]}`;
    cell.font = { name: FONT_NAME, size: 9 };
    ws.mergeCells(recRow + 1 + i, 1, recRow + 1 + i, 3);
  }

  // Footer
  const footerRow = recRow + recs.length + 3;
  ws.getCell(footerRow, 1).value = "Generated by AEGIS Identity Review — Powered by Ducky Intelligence.";
  ws.getCell(footerRow, 1).font = { name: FONT_NAME, italic: true, size: 9, color: { argb: "888888" } };
  ws.mergeCells(footerRow, 1, footerRow, 3);
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export async function generateIarXlsx(
  result: IarResult,
  users: M365UserRecord[],
  options: { tenantName?: string; preparedBy?: string } = {}
): Promise<Buffer> {
  const tenantName = options.tenantName ?? "Microsoft 365 Tenant";
  const preparedBy = options.preparedBy ?? "AEGIS Identity Review";

  const enriched = enrichUsers(users, result.flags);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cavaridge, LLC";
  wb.created = new Date();

  // Tab 1: Executive Summary
  const wsSummary = wb.addWorksheet("Executive Summary");
  buildExecutiveSummary(wsSummary, enriched, result, tenantName, preparedBy);

  // Tab 2: All Users
  const wsAll = wb.addWorksheet("All Users");
  writeDataSheet(
    wsAll,
    enriched as unknown as Record<string, unknown>[],
    [
      { header: "Display Name", key: "displayName", width: 30 },
      { header: "User Type", key: "userType", width: 15 },
      { header: "Sign-In Blocked", key: "isBlocked", width: 16 },
      { header: "Is Licensed", key: "isLicensed", width: 12 },
      { header: "License Status", key: "licenseStatus", width: 35 },
      { header: "Created", key: "createdDateTime", width: 14 },
      { header: "Last Activity", key: "lastSignInDateTime", width: 14 },
      { header: "Days Inactive", key: "daysSinceActivity", width: 12 },
      { header: "Risk Flags", key: "riskFlags", width: 40 },
      { header: "User Principal Name", key: "userPrincipalName", width: 45 },
    ],
    { riskKey: "riskFlags", tabColor: "4472C4" }
  );

  // Tab 3: Flagged Users
  const wsFlagged = wb.addWorksheet("Flagged Users");
  const flaggedUsers = enriched.filter((u) => u.riskFlags !== "None");
  writeDataSheet(
    wsFlagged,
    flaggedUsers as unknown as Record<string, unknown>[],
    [
      { header: "Display Name", key: "displayName", width: 30 },
      { header: "User Type", key: "userType", width: 15 },
      { header: "Risk Flags", key: "riskFlags", width: 45 },
      { header: "Sign-In Blocked", key: "isBlocked", width: 16 },
      { header: "Is Licensed", key: "isLicensed", width: 12 },
      { header: "License Status", key: "licenseStatus", width: 35 },
      { header: "Last Activity", key: "lastSignInDateTime", width: 14 },
      { header: "Days Inactive", key: "daysSinceActivity", width: 12 },
      { header: "User Principal Name", key: "userPrincipalName", width: 45 },
    ],
    { riskKey: "riskFlags", tabColor: "FF4444" }
  );

  // Tab 4: External Guests
  const wsExternal = wb.addWorksheet("External Guests");
  const externals = enriched.filter((u) => u.isExternal);
  writeDataSheet(
    wsExternal,
    externals as unknown as Record<string, unknown>[],
    [
      { header: "Display Name", key: "displayName", width: 30 },
      { header: "Sign-In Blocked", key: "isBlocked", width: 16 },
      { header: "Is Licensed", key: "isLicensed", width: 12 },
      { header: "License Status", key: "licenseStatus", width: 35 },
      { header: "Created", key: "createdDateTime", width: 14 },
      { header: "Account Age (Days)", key: "daysSinceCreated", width: 14 },
      { header: "Last Activity", key: "lastSignInDateTime", width: 14 },
      { header: "Days Inactive", key: "daysSinceActivity", width: 12 },
      { header: "Risk Flags", key: "riskFlags", width: 40 },
      { header: "User Principal Name", key: "userPrincipalName", width: 50 },
    ],
    { riskKey: "riskFlags", tabColor: "FFA500" }
  );

  // Tab 5: License Breakdown
  const wsLicense = wb.addWorksheet("License Breakdown");
  const licensedUsers = enriched.filter((u) => u.isLicensed);
  writeDataSheet(
    wsLicense,
    licensedUsers as unknown as Record<string, unknown>[],
    [
      { header: "Display Name", key: "displayName", width: 30 },
      { header: "User Type", key: "userType", width: 15 },
      { header: "Sign-In Blocked", key: "isBlocked", width: 16 },
      { header: "License Status", key: "licenseStatus", width: 40 },
      { header: "Last Activity", key: "lastSignInDateTime", width: 14 },
      { header: "Days Inactive", key: "daysSinceActivity", width: 12 },
    ],
    { tabColor: "00B050" }
  );

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
