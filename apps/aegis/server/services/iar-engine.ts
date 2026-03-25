/**
 * CVG-AEGIS — Identity Access Review (IAR) Engine
 *
 * Deterministic risk flag engine for M365 user analysis.
 * Two tiers:
 *   - Freemium: base severity flags only (8 flags per CLAUDE.md)
 *   - Full: Contextual Intelligence Engine (3 layers)
 *
 * CRITICAL: Reports never frame findings as MSP negligence.
 */

import type { FlagSuppression, DetectedControl } from "./compensating-controls.js";

// ---------------------------------------------------------------------------
// Types — M365 User Record
// ---------------------------------------------------------------------------

export interface M365UserRecord {
  userPrincipalName: string;
  displayName: string;
  accountEnabled: boolean;
  assignedLicenses: string[];
  lastSignInDateTime: string | null;
  createdDateTime: string;
  userType: string;
  mfaRegistered?: boolean;
  passwordNeverExpires?: boolean;
  accountType?: "user" | "service" | "room" | "shared";
  /** Days since last activity */
  daysSinceActivity?: number;
}

// ---------------------------------------------------------------------------
// Types — IAR Flags
// ---------------------------------------------------------------------------

export type FlagSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface IarRiskFlag {
  flagType: string;
  userPrincipalName: string;
  displayName: string;
  baseSeverity: FlagSeverity;
  adjustedSeverity: FlagSeverity | null;
  adjustmentReason: string | null;
  isSuppressed: boolean;
  suppressionReason: string | null;
  detail: string;
  metadata: Record<string, unknown>;
}

export interface IarResult {
  userCount: number;
  flags: IarRiskFlag[];
  flagCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  executiveSummary: string;
}

// ---------------------------------------------------------------------------
// Types — Business Context (Full Tier)
// ---------------------------------------------------------------------------

export interface TenantBusinessContext {
  industryVertical: string | null;
  isMAActive: boolean;
  isMultiSite: boolean;
  isContractorHeavy: boolean;
  vendorDensity: "low" | "normal" | "high";
  employeeCount: number | null;
}

// ---------------------------------------------------------------------------
// Flag Type Constants
// ---------------------------------------------------------------------------

export const IAR_FLAG_TYPES = {
  BLOCKED_BUT_LICENSED: "blocked_but_licensed",
  EXTERNAL_WITH_LICENSE: "external_with_license",
  INACTIVE_LICENSED_180D: "inactive_licensed_180d",
  NO_MFA_REGISTERED: "no_mfa_registered",
  INACTIVE_LICENSED_90D: "inactive_licensed_90d",
  LICENSED_NO_ACTIVITY: "licensed_no_activity",
  PASSWORD_NEVER_EXPIRES: "password_never_expires",
  STALE_EXTERNAL_GUEST: "stale_external_guest",
} as const;

// ---------------------------------------------------------------------------
// Base Severity Flag Engine (Freemium + Full Tier)
// ---------------------------------------------------------------------------

/**
 * Compute base risk flags from M365 user records.
 * Deterministic — no LLM calls.
 */
export function computeBaseFlags(users: M365UserRecord[]): IarRiskFlag[] {
  const flags: IarRiskFlag[] = [];

  for (const user of users) {
    const hasLicense = user.assignedLicenses.length > 0;
    const isBlocked = !user.accountEnabled;
    const isExternal = user.userType === "Guest" || user.userType === "#EXT#";
    const daysSinceActivity = user.daysSinceActivity ?? calculateDaysSinceActivity(user.lastSignInDateTime);
    const isServiceAccount = user.accountType === "service" || user.accountType === "room" || user.accountType === "shared";

    // 1. Blocked but Licensed — always High
    if (isBlocked && hasLicense) {
      flags.push({
        flagType: IAR_FLAG_TYPES.BLOCKED_BUT_LICENSED,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "high",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: `Account is blocked/disabled but still has ${user.assignedLicenses.length} license(s) assigned. This represents wasted license spend.`,
        metadata: { licenseCount: user.assignedLicenses.length },
      });
    }

    // 2. External with License — High
    if (isExternal && hasLicense) {
      flags.push({
        flagType: IAR_FLAG_TYPES.EXTERNAL_WITH_LICENSE,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "high",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: `External/guest account has ${user.assignedLicenses.length} license(s) assigned. External users typically should not consume paid licenses.`,
        metadata: { userType: user.userType, licenseCount: user.assignedLicenses.length },
      });
    }

    // 3. Inactive Licensed >180d — High
    if (hasLicense && !isBlocked && daysSinceActivity > 180) {
      flags.push({
        flagType: IAR_FLAG_TYPES.INACTIVE_LICENSED_180D,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "high",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: `Licensed account has been inactive for ${daysSinceActivity} days (>180). Significant license waste and potential security risk from dormant account.`,
        metadata: { daysSinceActivity, licenseCount: user.assignedLicenses.length },
      });
    }

    // 4. No MFA Registered (Graph only) — High
    if (user.mfaRegistered === false && !isBlocked) {
      flags.push({
        flagType: IAR_FLAG_TYPES.NO_MFA_REGISTERED,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "high",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: "Account has no MFA methods registered. This is a critical security gap.",
        metadata: {},
      });
    }

    // 5. Inactive Licensed >90d — Medium
    if (hasLicense && !isBlocked && daysSinceActivity > 90 && daysSinceActivity <= 180) {
      flags.push({
        flagType: IAR_FLAG_TYPES.INACTIVE_LICENSED_90D,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "medium",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: `Licensed account has been inactive for ${daysSinceActivity} days (>90). Review whether license is still needed.`,
        metadata: { daysSinceActivity, licenseCount: user.assignedLicenses.length },
      });
    }

    // 6. Licensed — No Activity Data — Medium
    if (hasLicense && !isBlocked && user.lastSignInDateTime === null && !isServiceAccount) {
      flags.push({
        flagType: IAR_FLAG_TYPES.LICENSED_NO_ACTIVITY,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "medium",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: "Licensed account has no recorded sign-in activity data. Unable to determine usage status.",
        metadata: { accountType: user.accountType ?? "user" },
      });
    }

    // Suppress if service/room/shared account
    if (hasLicense && user.lastSignInDateTime === null && isServiceAccount) {
      // Do not flag — service/room/shared accounts are expected to have no user sign-in data
    }

    // 7. Password Never Expires — Medium
    if (user.passwordNeverExpires === true && !isBlocked) {
      flags.push({
        flagType: IAR_FLAG_TYPES.PASSWORD_NEVER_EXPIRES,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "medium",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: "Password is set to never expire. While NIST 800-63B discourages mandatory rotation, this should be paired with MFA enforcement.",
        metadata: {},
      });
    }

    // 8. Stale External Guest — Low
    if (isExternal && !hasLicense && daysSinceActivity > 90) {
      flags.push({
        flagType: IAR_FLAG_TYPES.STALE_EXTERNAL_GUEST,
        userPrincipalName: user.userPrincipalName,
        displayName: user.displayName,
        baseSeverity: "low",
        adjustedSeverity: null,
        adjustmentReason: null,
        isSuppressed: false,
        suppressionReason: null,
        detail: `External guest account has been inactive for ${daysSinceActivity} days. Consider removing if no longer needed.`,
        metadata: { daysSinceActivity, userType: user.userType },
      });
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Contextual Intelligence Engine (Full Tier)
// ---------------------------------------------------------------------------

/**
 * Layer 1: Compensating Control Awareness
 * Pulls tenant-intel signals and auto-adjusts flag severity.
 */
export function applyCompensatingControlAdjustments(
  flags: IarRiskFlag[],
  activeControls: DetectedControl[],
): IarRiskFlag[] {
  const suppressions: FlagSuppression[] = activeControls
    .filter(c => c.isDetected)
    .flatMap(c => c.flagSuppressions);

  return flags.map(flag => {
    const applicableSuppressions = suppressions.filter(s => s.flagType === flag.flagType);

    if (applicableSuppressions.length === 0) return flag;

    // Check for suppress actions first
    const suppression = applicableSuppressions.find(s => s.action === "suppress");
    if (suppression) {
      return {
        ...flag,
        isSuppressed: true,
        suppressionReason: suppression.reason,
      };
    }

    // Then check for downgrade actions
    const downgrade = applicableSuppressions.find(s => s.action === "downgrade");
    if (downgrade && downgrade.targetSeverity) {
      return {
        ...flag,
        adjustedSeverity: downgrade.targetSeverity,
        adjustmentReason: downgrade.reason,
      };
    }

    return flag;
  });
}

/**
 * Layer 2: Business Context Modifiers
 * Calibrates what "normal" looks like based on tenant profile.
 */
export function applyBusinessContextModifiers(
  flags: IarRiskFlag[],
  context: TenantBusinessContext,
): IarRiskFlag[] {
  return flags.map(flag => {
    // If already suppressed, skip
    if (flag.isSuppressed) return flag;

    switch (flag.flagType) {
      case IAR_FLAG_TYPES.EXTERNAL_WITH_LICENSE: {
        // Contractor-heavy tenants: downgrade external-with-license to Low
        if (context.isContractorHeavy) {
          return {
            ...flag,
            adjustedSeverity: flag.adjustedSeverity ?? "low",
            adjustmentReason: flag.adjustmentReason
              ?? "Tenant profile indicates contractor-heavy model — external licensed accounts are expected",
          };
        }
        break;
      }

      case IAR_FLAG_TYPES.STALE_EXTERNAL_GUEST: {
        // M&A active or high vendor density: downgrade to Info
        if (context.isMAActive || context.vendorDensity === "high") {
          return {
            ...flag,
            adjustedSeverity: flag.adjustedSeverity ?? "info",
            adjustmentReason: flag.adjustmentReason
              ?? (context.isMAActive
                ? "Tenant is M&A-active — elevated guest account count is expected"
                : "Tenant has high vendor density — external guest accounts are expected"),
          };
        }
        break;
      }

      default:
        break;
    }

    return flag;
  });
}

/**
 * Layer 3: Report Tone Engine
 * Generates executive summary with appropriate framing.
 * CRITICAL: Never frames findings as MSP negligence.
 */
export function generateExecutiveSummary(
  flags: IarRiskFlag[],
  userCount: number,
  tier: "freemium" | "full",
): string {
  const activeFlags = flags.filter(f => !f.isSuppressed);
  const effectiveSeverity = (f: IarRiskFlag) => f.adjustedSeverity ?? f.baseSeverity;

  const high = activeFlags.filter(f => effectiveSeverity(f) === "high" || effectiveSeverity(f) === "critical").length;
  const medium = activeFlags.filter(f => effectiveSeverity(f) === "medium").length;
  const low = activeFlags.filter(f => effectiveSeverity(f) === "low" || effectiveSeverity(f) === "info").length;

  const suppressedCount = flags.filter(f => f.isSuppressed).length;
  const totalFindings = activeFlags.length;

  // Determine overall posture
  const isStrongPosture = high === 0 && medium <= 2;
  const isWeakPosture = high >= 3;

  let summary = "";

  if (isStrongPosture) {
    // Lead with positives
    summary = `Identity Access Review of ${userCount} user account(s) indicates a strong security posture. `;
    if (totalFindings === 0) {
      summary += "No significant findings were identified. ";
    } else {
      summary += `${totalFindings} observation(s) were identified, primarily housekeeping items. `;
    }
    if (suppressedCount > 0 && tier === "full") {
      summary += `${suppressedCount} potential finding(s) were offset by confirmed compensating controls. `;
    }
  } else if (isWeakPosture) {
    // Lead with priorities — but frame as remediation opportunities, not negligence
    summary = `Identity Access Review of ${userCount} user account(s) identified ${high} high-priority finding(s) that should be addressed promptly. `;
    if (medium > 0) {
      summary += `An additional ${medium} medium-priority item(s) were noted for review. `;
    }
    summary += "These findings represent opportunities to strengthen the tenant's identity security posture. ";
  } else {
    // Balanced framing
    summary = `Identity Access Review of ${userCount} user account(s) identified ${totalFindings} finding(s) across the environment. `;
    if (high > 0) {
      summary += `${high} item(s) are flagged as high priority. `;
    }
    if (medium > 0) {
      summary += `${medium} item(s) are medium priority. `;
    }
  }

  if (tier === "freemium") {
    summary += "Note: This analysis uses base severity levels only. Additional environmental context (MFA providers, conditional access policies, business context) may adjust finding severity. Upgrade to full-tier AEGIS for contextual intelligence.";
  }

  return summary.trim();
}

/**
 * Run the complete IAR analysis pipeline.
 */
export function runIarAnalysis(
  users: M365UserRecord[],
  options: {
    tier: "freemium" | "full";
    activeControls?: DetectedControl[];
    businessContext?: TenantBusinessContext;
  },
): IarResult {
  // Step 1: Compute base flags
  let flags = computeBaseFlags(users);

  // Step 2: Apply contextual intelligence (full tier only)
  if (options.tier === "full") {
    if (options.activeControls) {
      flags = applyCompensatingControlAdjustments(flags, options.activeControls);
    }
    if (options.businessContext) {
      flags = applyBusinessContextModifiers(flags, options.businessContext);
    }
  }

  // Step 3: Generate executive summary
  const executiveSummary = generateExecutiveSummary(flags, users.length, options.tier);

  // Count severities (using effective severity)
  const activeFlags = flags.filter(f => !f.isSuppressed);
  const effectiveSeverity = (f: IarRiskFlag) => f.adjustedSeverity ?? f.baseSeverity;

  return {
    userCount: users.length,
    flags,
    flagCount: activeFlags.length,
    highSeverityCount: activeFlags.filter(f =>
      effectiveSeverity(f) === "high" || effectiveSeverity(f) === "critical"
    ).length,
    mediumSeverityCount: activeFlags.filter(f => effectiveSeverity(f) === "medium").length,
    lowSeverityCount: activeFlags.filter(f =>
      effectiveSeverity(f) === "low" || effectiveSeverity(f) === "info"
    ).length,
    executiveSummary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateDaysSinceActivity(lastSignIn: string | null): number {
  if (!lastSignIn) return 999; // Treat null as very stale
  const lastDate = new Date(lastSignIn);
  const now = new Date();
  return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}
