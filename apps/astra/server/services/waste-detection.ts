/**
 * License Waste Detection Engine — CVG-ASTRA
 *
 * Deterministic analysis of M365 license assignments to identify:
 * - Unused licenses (no sign-in for configurable period)
 * - Underutilized licenses (E5 user only using E3 features)
 * - Duplicate license assignments
 * - Licenses on disabled/deleted accounts
 *
 * No LLM calls — pure business logic.
 */

import type {
  LicensedUserProfile,
  WasteFinding,
  WasteDetectionResult,
  WasteDetectionSummary,
  WasteCategory,
  WasteSeverity,
  WasteThresholds,
} from "../types/index.js";
import { DEFAULT_THRESHOLDS } from "../types/index.js";
import { findLicenseInfo } from "../sku-map.js";

// ── Premium SKU tiers ───────────────────────────────────────────────

const E5_SKUS = new Set([
  "Microsoft 365 E5",
  "Office 365 E5",
  "Microsoft 365 E5 Security",
  "Microsoft 365 E5 Compliance",
]);

const E3_SKUS = new Set([
  "Microsoft 365 E3",
  "Office 365 E3",
]);

const PREMIUM_SKUS = new Set([
  ...E5_SKUS,
  "Microsoft 365 Business Premium",
  "Enterprise Mobility + Security E5",
  "Entra ID P2",
]);

/** Services available in E3 but not requiring E5 */
const E3_SERVICES = new Set([
  "exchange",
  "teams",
  "sharepoint",
  "onedrive",
]);

// ── Duplicate detection pairs ───────────────────────────────────────

const OVERLAPPING_LICENSES: Array<{ higher: string; lower: string }> = [
  { higher: "Microsoft 365 E5", lower: "Microsoft 365 E3" },
  { higher: "Microsoft 365 E5", lower: "Office 365 E3" },
  { higher: "Microsoft 365 E5", lower: "Office 365 E1" },
  { higher: "Microsoft 365 E3", lower: "Office 365 E1" },
  { higher: "Microsoft 365 Business Premium", lower: "Microsoft 365 Business Standard" },
  { higher: "Microsoft 365 Business Premium", lower: "Microsoft 365 Business Basic" },
  { higher: "Microsoft 365 Business Standard", lower: "Microsoft 365 Business Basic" },
  { higher: "Office 365 E5", lower: "Office 365 E3" },
  { higher: "Office 365 E5", lower: "Office 365 E1" },
  { higher: "Office 365 E3", lower: "Office 365 E1" },
  { higher: "Enterprise Mobility + Security E5", lower: "Enterprise Mobility + Security E3" },
  { higher: "Entra ID P2", lower: "Entra ID P1" },
  { higher: "Defender for Endpoint P2", lower: "Defender for Endpoint P1" },
];

// ── Core Analysis ───────────────────────────────────────────────────

export function detectWaste(
  users: LicensedUserProfile[],
  tenantId: string,
  thresholds: WasteThresholds = DEFAULT_THRESHOLDS,
): WasteDetectionResult {
  const findings: WasteFinding[] = [];

  for (const user of users) {
    // 1. Disabled / deleted account with licenses
    if (!user.accountEnabled && user.licenses.length > 0) {
      findings.push(buildFinding(user, "disabled_account", "critical",
        `License assigned to disabled account: ${user.licenses.join(", ")}`,
        ["Account is disabled but retains license assignments"],
      ));
      continue; // Don't double-count disabled accounts
    }

    // 2. Unused — no activity for configurable period
    const inactivityFindings = detectUnused(user, thresholds);
    findings.push(...inactivityFindings);

    // 3. Underutilized — premium license with basic usage
    const underutilFindings = detectUnderutilized(user, thresholds);
    findings.push(...underutilFindings);

    // 4. Duplicate — overlapping license assignments
    const duplicateFindings = detectDuplicates(user);
    findings.push(...duplicateFindings);
  }

  const summary = buildSummary(findings);

  return {
    tenantId,
    analyzedAt: new Date(),
    totalUsers: users.length,
    totalMonthlyCost: users.reduce((sum, u) => sum + u.monthlyCost, 0),
    findings,
    summary,
    thresholds,
  };
}

// ── Unused Detection ────────────────────────────────────────────────

function detectUnused(
  user: LicensedUserProfile,
  thresholds: WasteThresholds,
): WasteFinding[] {
  const findings: WasteFinding[] = [];
  const activity = user.activity;

  if (!activity) return findings;

  const daysInactive = activity.daysSinceLastActivity;

  if (daysInactive !== null && daysInactive >= thresholds.unusedDays) {
    const severity: WasteSeverity = daysInactive >= 180 ? "critical" : daysInactive >= 90 ? "high" : "medium";
    findings.push(buildFinding(user, "unused", severity,
      `No activity in ${daysInactive} days across any M365 service`,
      [
        `Last activity: ${daysInactive} days ago`,
        `Active services: ${activity.activeServiceCount}/${activity.totalServiceCount}`,
        `Threshold: ${thresholds.unusedDays} days`,
      ],
    ));
  } else if (activity.activeServiceCount === 0 && daysInactive === null) {
    findings.push(buildFinding(user, "unused", "high",
      "No recorded activity across any M365 service in reporting period",
      ["Zero active services detected", "No last activity date available"],
    ));
  }

  return findings;
}

// ── Underutilized Detection ─────────────────────────────────────────

function detectUnderutilized(
  user: LicensedUserProfile,
  thresholds: WasteThresholds,
): WasteFinding[] {
  const findings: WasteFinding[] = [];
  const activity = user.activity;

  if (!activity) return findings;

  // Check if user has E5 but only uses E3 features
  const hasE5 = user.licenses.some(l => E5_SKUS.has(l));
  if (hasE5) {
    const usesOnlyBasicServices =
      activity.activeServiceCount <= 3 &&
      !usesAdvancedFeatures(activity);

    if (usesOnlyBasicServices) {
      const e5Cost = user.monthlyCost;
      const e3Cost = 36; // E3 standard price
      const savings = e5Cost - e3Cost;

      if (savings > 0) {
        findings.push(buildFinding(user, "underutilized", "high",
          `E5 license ($${e5Cost}/mo) but only uses ${activity.activeServiceCount} basic services — E3 ($${e3Cost}/mo) would suffice`,
          [
            `Active services: ${activity.activeServiceCount}/${activity.totalServiceCount}`,
            `Exchange: ${activity.exchangeActive ? "active" : "inactive"}`,
            `Teams: ${activity.teamsActive ? "active" : "inactive"}`,
            `SharePoint: ${activity.sharePointActive ? "active" : "inactive"}`,
            `OneDrive: ${activity.oneDriveActive ? "active" : "inactive"}`,
            `No advanced security/compliance features detected in use`,
            `Potential savings: $${savings.toFixed(2)}/mo`,
          ],
        ));
      }
    }
  }

  // Check if user has E3 but only uses email
  const hasE3 = user.licenses.some(l => E3_SKUS.has(l));
  if (hasE3 && !hasE5) {
    const emailOnly = activity.exchangeActive &&
      !activity.teamsActive &&
      !activity.sharePointActive &&
      !activity.oneDriveActive;

    if (emailOnly) {
      const currentCost = user.monthlyCost;
      const f3PlusExchangeCost = 8 + 4; // F3 + Exchange Online Plan 1
      const savings = currentCost - f3PlusExchangeCost;

      if (savings > 0) {
        findings.push(buildFinding(user, "underutilized", "medium",
          `E3 license but only uses Exchange (email) — F3 + Exchange Online Plan 1 would save $${savings.toFixed(2)}/mo`,
          [
            `Only Exchange active out of ${activity.totalServiceCount} licensed services`,
            `Current cost: $${currentCost.toFixed(2)}/mo`,
            `Recommended: F3 ($8/mo) + Exchange Online Plan 1 ($4/mo) = $12/mo`,
          ],
        ));
      }
    }
  }

  // Generic underutilization: using < threshold% of licensed services
  if (activity.totalServiceCount > 0) {
    const utilizationPct = (activity.activeServiceCount / activity.totalServiceCount) * 100;
    if (utilizationPct > 0 && utilizationPct < thresholds.underutilizedPct && !hasE5) {
      // Only flag if not already caught by E5/E3 checks above
      const alreadyFlagged = findings.length > 0;
      if (!alreadyFlagged) {
        findings.push(buildFinding(user, "underutilized", "low",
          `Using ${activity.activeServiceCount}/${activity.totalServiceCount} licensed services (${utilizationPct.toFixed(0)}%)`,
          [
            `Service utilization: ${utilizationPct.toFixed(0)}%`,
            `Threshold: ${thresholds.underutilizedPct}%`,
          ],
        ));
      }
    }
  }

  return findings;
}

// ── Duplicate Detection ─────────────────────────────────────────────

function detectDuplicates(user: LicensedUserProfile): WasteFinding[] {
  const findings: WasteFinding[] = [];
  const licenseSet = new Set(user.licenses);

  for (const pair of OVERLAPPING_LICENSES) {
    if (licenseSet.has(pair.higher) && licenseSet.has(pair.lower)) {
      const lowerInfo = findLicenseInfo(pair.lower);
      findings.push(buildFinding(user, "duplicate", "high",
        `Duplicate license: has both "${pair.higher}" and "${pair.lower}" — remove ${pair.lower}`,
        [
          `"${pair.higher}" includes all capabilities of "${pair.lower}"`,
          `Removing "${pair.lower}" saves $${lowerInfo.cost.toFixed(2)}/mo`,
        ],
      ));
    }
  }

  return findings;
}

// ── Helpers ─────────────────────────────────────────────────────────

function usesAdvancedFeatures(activity: {
  exchangeActive: boolean;
  teamsActive: boolean;
  sharePointActive: boolean;
  oneDriveActive: boolean;
}): boolean {
  // In a real implementation, we'd check for eDiscovery, DLP, Advanced Threat Protection usage
  // via Graph API. For now, if they use 4+ services they likely benefit from E5 features.
  const count = [activity.exchangeActive, activity.teamsActive, activity.sharePointActive, activity.oneDriveActive]
    .filter(Boolean).length;
  return count >= 4;
}

function buildFinding(
  user: LicensedUserProfile,
  category: WasteCategory,
  severity: WasteSeverity,
  description: string,
  evidence: string[],
): WasteFinding {
  let estimatedWastedCost = user.monthlyCost;

  if (category === "underutilized") {
    // Waste is the difference between current and recommended
    if (user.licenses.some(l => E5_SKUS.has(l))) {
      estimatedWastedCost = user.monthlyCost - 36; // E3 cost
    } else if (user.licenses.some(l => E3_SKUS.has(l))) {
      estimatedWastedCost = user.monthlyCost - 12; // F3+Exchange
    } else {
      estimatedWastedCost = user.monthlyCost * 0.3; // Estimate 30% waste
    }
  }

  if (category === "duplicate") {
    // Waste is the cost of the redundant lower-tier license
    const lowerLicense = evidence[0]?.match(/"([^"]+)" includes/)?.[0];
    estimatedWastedCost = user.monthlyCost * 0.3; // Conservative estimate
  }

  return {
    userId: user.id,
    userDisplayName: user.displayName,
    userPrincipalName: user.userPrincipalName,
    category,
    severity,
    currentLicenses: user.licenses,
    currentMonthlyCost: user.monthlyCost,
    estimatedWastedCost: Math.max(0, estimatedWastedCost),
    description,
    evidence,
    daysSinceLastActivity: user.activity?.daysSinceLastActivity ?? null,
    activeServiceCount: user.activity?.activeServiceCount ?? 0,
    totalServiceCount: user.activity?.totalServiceCount ?? 0,
  };
}

function buildSummary(findings: WasteFinding[]): WasteDetectionSummary {
  const bySeverity: Record<WasteSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  let totalWasted = 0;
  let unused = 0;
  let underutilized = 0;
  let duplicate = 0;
  let disabled = 0;

  for (const f of findings) {
    bySeverity[f.severity]++;
    totalWasted += f.estimatedWastedCost;

    switch (f.category) {
      case "unused": unused++; break;
      case "underutilized": underutilized++; break;
      case "duplicate": duplicate++; break;
      case "disabled_account": disabled++; break;
    }
  }

  return {
    totalWastedMonthlyCost: Math.round(totalWasted * 100) / 100,
    totalWastedAnnualCost: Math.round(totalWasted * 12 * 100) / 100,
    unusedLicenseCount: unused,
    underutilizedCount: underutilized,
    duplicateCount: duplicate,
    disabledAccountCount: disabled,
    findingsBySeverity: bySeverity,
  };
}

// ── Utility: Convert legacy user data to LicensedUserProfile ────────

export function toLicensedUserProfile(legacyUser: {
  id?: string;
  displayName: string;
  upn?: string;
  userPrincipalName?: string;
  department?: string;
  jobTitle?: string;
  city?: string;
  country?: string;
  licenses: string[];
  cost: number;
  usageGB?: number;
  maxGB?: number;
  status?: string;
  activity?: {
    exchangeActive: boolean;
    teamsActive: boolean;
    sharePointActive: boolean;
    oneDriveActive: boolean;
    yammerActive?: boolean;
    skypeActive?: boolean;
    exchangeLastDate?: string | null;
    teamsLastDate?: string | null;
    sharePointLastDate?: string | null;
    oneDriveLastDate?: string | null;
    yammerLastDate?: string | null;
    skypeLastDate?: string | null;
    activeServiceCount: number;
    totalServiceCount: number;
    daysSinceLastActivity: number | null;
  } | null;
}): LicensedUserProfile {
  return {
    id: legacyUser.id ?? crypto.randomUUID(),
    displayName: legacyUser.displayName,
    userPrincipalName: legacyUser.upn ?? legacyUser.userPrincipalName ?? "",
    department: legacyUser.department ?? "Unassigned",
    jobTitle: legacyUser.jobTitle ?? "",
    city: legacyUser.city ?? "",
    country: legacyUser.country ?? "",
    accountEnabled: legacyUser.status !== "Disabled",
    licenses: legacyUser.licenses,
    monthlyCost: legacyUser.cost,
    mailboxUsageGB: legacyUser.usageGB,
    mailboxQuotaGB: legacyUser.maxGB,
    activity: legacyUser.activity ? {
      exchangeActive: legacyUser.activity.exchangeActive,
      teamsActive: legacyUser.activity.teamsActive,
      sharePointActive: legacyUser.activity.sharePointActive,
      oneDriveActive: legacyUser.activity.oneDriveActive,
      yammerActive: legacyUser.activity.yammerActive ?? false,
      skypeActive: legacyUser.activity.skypeActive ?? false,
      exchangeLastDate: legacyUser.activity.exchangeLastDate ?? null,
      teamsLastDate: legacyUser.activity.teamsLastDate ?? null,
      sharePointLastDate: legacyUser.activity.sharePointLastDate ?? null,
      oneDriveLastDate: legacyUser.activity.oneDriveLastDate ?? null,
      yammerLastDate: legacyUser.activity.yammerLastDate ?? null,
      skypeLastDate: legacyUser.activity.skypeLastDate ?? null,
      activeServiceCount: legacyUser.activity.activeServiceCount,
      totalServiceCount: legacyUser.activity.totalServiceCount,
      daysSinceLastActivity: legacyUser.activity.daysSinceLastActivity,
    } : undefined,
  };
}
