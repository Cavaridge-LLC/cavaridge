/**
 * CVG-ASTRA — AEGIS IAR Integration Service
 *
 * Consumes Identity Access Review data from AEGIS to extract license waste
 * insights and generate license optimization reports for vCIO deliverables.
 *
 * Cross-app integration: AEGIS (IAR) -> Astra (License waste -> vCIO reports)
 *
 * Data flow:
 *   AEGIS IAR reviews (blocked-but-licensed, inactive, external with license)
 *   -> IarLicenseInsights (structured waste analysis)
 *   -> LicenseReport (actionable optimization report)
 *
 * Both apps share the same Supabase instance, so this module queries
 * the aegis schema directly.
 */

// ---------------------------------------------------------------------------
// Types — IAR License Insights
// ---------------------------------------------------------------------------

export interface IarLicenseInsights {
  tenantId: string;
  fetchedAt: Date;
  sourceReviewId: string | null;
  sourceReviewDate: Date | null;

  /** Total user counts */
  totalUsers: number;
  totalLicensedUsers: number;
  totalActiveUsers: number;

  /** Waste categories from IAR flags */
  blockedButLicensed: IarWasteCategory;
  inactiveOver90d: IarWasteCategory;
  inactiveOver180d: IarWasteCategory;
  externalWithLicense: IarWasteCategory;
  licensedNoActivity: IarWasteCategory;

  /** Aggregate waste metrics */
  totalWasteUsers: number;
  totalWastePct: number;
  estimatedMonthlyWaste: number;
  estimatedAnnualWaste: number;

  /** Per-user waste details for remediation */
  wasteDetails: IarWasteDetail[];

  /** Delta from previous review (if available) */
  delta: IarDelta | null;
}

export interface IarWasteCategory {
  count: number;
  users: Array<{
    userPrincipalName: string;
    displayName: string;
    detail: string;
  }>;
  estimatedMonthlyCost: number;
}

export interface IarWasteDetail {
  userPrincipalName: string;
  displayName: string;
  flagType: string;
  severity: string;
  adjustedSeverity: string | null;
  isSuppressed: boolean;
  suppressionReason: string | null;
  detail: string;
  licenseCount: number;
  estimatedMonthlyCost: number;
  recommendedAction: "disable" | "downgrade" | "remove_license" | "review";
}

export interface IarDelta {
  previousReviewId: string;
  previousReviewDate: Date;
  newWasteFlags: number;
  resolvedWasteFlags: number;
  wasteUsersDelta: number;
  wasteCostDelta: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Types — License Optimization Report
// ---------------------------------------------------------------------------

export interface LicenseReport {
  tenantId: string;
  generatedAt: Date;
  executiveSummary: string;

  /** Grouped actions by type */
  actionGroups: LicenseActionGroup[];

  /** Per-user recommended actions sorted by savings impact */
  actions: LicenseAction[];

  /** Aggregate savings */
  savings: LicenseSavingsSummary;

  /** Astra upgrade positioning */
  upgradeCallToAction: UpgradeCallToAction;
}

export interface LicenseActionGroup {
  actionType: "disable" | "downgrade" | "remove_license" | "review";
  label: string;
  description: string;
  userCount: number;
  estimatedMonthlySavings: number;
  estimatedAnnualSavings: number;
}

export interface LicenseAction {
  priority: number;
  userPrincipalName: string;
  displayName: string;
  action: "disable" | "downgrade" | "remove_license" | "review";
  rationale: string;
  currentState: string;
  estimatedMonthlySavings: number;
  riskLevel: "none" | "low" | "medium";
  flagType: string;
}

export interface LicenseSavingsSummary {
  immediateMonthly: number;
  immediateAnnual: number;
  reviewMonthly: number;
  reviewAnnual: number;
  totalMonthly: number;
  totalAnnual: number;
}

export interface UpgradeCallToAction {
  headline: string;
  description: string;
  features: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Average M365 license cost per user per month (used for waste estimation) */
const AVG_LICENSE_COST_PER_USER = 22; // Approximate blended cost across E3/E5/Business

/** IAR flag types that represent direct license waste */
const LICENSE_WASTE_FLAGS = new Set([
  "blocked_but_licensed",
  "external_with_license",
  "inactive_licensed_180d",
  "inactive_licensed_90d",
  "licensed_no_activity",
]);

// ---------------------------------------------------------------------------
// Main: Fetch IAR License Data
// ---------------------------------------------------------------------------

/**
 * Fetch and analyze IAR review data to extract license waste insights.
 *
 * Queries the latest full-tier IAR review for the tenant and extracts
 * license-relevant risk flags (blocked-but-licensed, inactive, external).
 * Estimates waste cost based on average license pricing.
 *
 * @param tenantId - Client tenant ID to analyze
 */
export async function fetchIarLicenseData(
  tenantId: string,
): Promise<IarLicenseInsights> {
  const db = getDb();
  const now = new Date();

  // ── Fetch latest full-tier IAR review ─────────────────────────────
  const reviewResult = await db.execute({
    sql: `
      SELECT id, user_count, flag_count,
             high_severity_count, medium_severity_count, low_severity_count,
             completed_at, created_at
      FROM aegis.iar_reviews
      WHERE tenant_id = $1 AND tier = 'full' AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `,
    params: [tenantId],
  } as any);

  const review = (reviewResult as any)?.[0];

  if (!review) {
    return buildEmptyInsights(tenantId, now);
  }

  // ── Fetch all license-waste-relevant flags from this review ───────
  const flagsResult = await db.execute({
    sql: `
      SELECT flag_type, user_principal_name, display_name,
             base_severity, adjusted_severity, is_suppressed,
             suppression_reason, detail, metadata
      FROM aegis.iar_flags
      WHERE review_id = $1 AND tenant_id = $2
        AND flag_type = ANY($3)
      ORDER BY
        CASE base_severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END ASC
    `,
    params: [review.id, tenantId, Array.from(LICENSE_WASTE_FLAGS)],
  } as any);

  const flags = (flagsResult ?? []) as any[];

  // ── Categorize waste ──────────────────────────────────────────────
  const blockedButLicensed = buildWasteCategory(flags, "blocked_but_licensed");
  const inactiveOver180d = buildWasteCategory(flags, "inactive_licensed_180d");
  const inactiveOver90d = buildWasteCategory(flags, "inactive_licensed_90d");
  const externalWithLicense = buildWasteCategory(flags, "external_with_license");
  const licensedNoActivity = buildWasteCategory(flags, "licensed_no_activity");

  // ── Build per-user waste details ──────────────────────────────────
  const wasteDetails: IarWasteDetail[] = flags
    .filter((f: any) => !f.is_suppressed)
    .map((f: any) => {
      const licenseCount = (f.metadata as any)?.licenseCount ?? 1;
      return {
        userPrincipalName: f.user_principal_name,
        displayName: f.display_name,
        flagType: f.flag_type,
        severity: f.base_severity,
        adjustedSeverity: f.adjusted_severity,
        isSuppressed: f.is_suppressed,
        suppressionReason: f.suppression_reason,
        detail: f.detail,
        licenseCount,
        estimatedMonthlyCost: licenseCount * AVG_LICENSE_COST_PER_USER,
        recommendedAction: flagToAction(f.flag_type),
      };
    });

  // ── Compute aggregates ────────────────────────────────────────────
  const nonSuppressedFlags = flags.filter((f: any) => !f.is_suppressed);
  const uniqueWasteUsers = new Set(nonSuppressedFlags.map((f: any) => f.user_principal_name));
  const totalWasteUsers = uniqueWasteUsers.size;
  const totalLicensedUsers = review.user_count ?? 0;
  const totalWastePct = totalLicensedUsers > 0
    ? Math.round((totalWasteUsers / totalLicensedUsers) * 1000) / 10
    : 0;

  const estimatedMonthlyWaste = wasteDetails.reduce((sum, d) => sum + d.estimatedMonthlyCost, 0);

  // ── Fetch delta from previous review ──────────────────────────────
  const delta = await fetchIarDelta(db, tenantId, review.id, totalWasteUsers, estimatedMonthlyWaste);

  // ── Count active users (total - blocked - inactive180) ────────────
  const totalActiveUsers = Math.max(
    0,
    totalLicensedUsers - blockedButLicensed.count - inactiveOver180d.count,
  );

  return {
    tenantId,
    fetchedAt: now,
    sourceReviewId: review.id,
    sourceReviewDate: new Date(review.completed_at ?? review.created_at),
    totalUsers: totalLicensedUsers,
    totalLicensedUsers,
    totalActiveUsers,
    blockedButLicensed,
    inactiveOver90d,
    inactiveOver180d,
    externalWithLicense,
    licensedNoActivity,
    totalWasteUsers,
    totalWastePct,
    estimatedMonthlyWaste: Math.round(estimatedMonthlyWaste * 100) / 100,
    estimatedAnnualWaste: Math.round(estimatedMonthlyWaste * 12 * 100) / 100,
    wasteDetails,
    delta,
  };
}

// ---------------------------------------------------------------------------
// Main: Generate License Optimization Report
// ---------------------------------------------------------------------------

/**
 * Generate a structured license optimization report from IAR data.
 *
 * Produces actionable recommendations sorted by savings impact:
 *  - Disable: blocked accounts with licenses
 *  - Remove license: inactive >180d accounts
 *  - Downgrade/Remove: external guests with licenses
 *  - Review: inactive 90-180d and no-activity accounts
 *
 * @param data - IarLicenseInsights from fetchIarLicenseData()
 */
export function generateLicenseOptimizationReport(
  data: IarLicenseInsights,
): LicenseReport {
  const now = new Date();

  // ── Build per-user actions sorted by savings ──────────────────────
  const actions: LicenseAction[] = data.wasteDetails
    .filter(d => !d.isSuppressed)
    .map((d, idx) => ({
      priority: idx + 1, // Re-assigned below after sort
      userPrincipalName: d.userPrincipalName,
      displayName: d.displayName,
      action: d.recommendedAction,
      rationale: d.detail,
      currentState: `${d.licenseCount} license(s), flagged: ${d.flagType.replace(/_/g, " ")}`,
      estimatedMonthlySavings: d.estimatedMonthlyCost,
      riskLevel: actionToRisk(d.recommendedAction),
      flagType: d.flagType,
    }))
    .sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings)
    .map((action, idx) => ({ ...action, priority: idx + 1 }));

  // ── Group actions by type ─────────────────────────────────────────
  const actionGroups = buildActionGroups(actions);

  // ── Compute savings ───────────────────────────────────────────────
  const immediateActions = actions.filter(a => a.action !== "review");
  const reviewActions = actions.filter(a => a.action === "review");

  const immediateMonthly = immediateActions.reduce((sum, a) => sum + a.estimatedMonthlySavings, 0);
  const reviewMonthly = reviewActions.reduce((sum, a) => sum + a.estimatedMonthlySavings, 0);

  const savings: LicenseSavingsSummary = {
    immediateMonthly: round2(immediateMonthly),
    immediateAnnual: round2(immediateMonthly * 12),
    reviewMonthly: round2(reviewMonthly),
    reviewAnnual: round2(reviewMonthly * 12),
    totalMonthly: round2(immediateMonthly + reviewMonthly),
    totalAnnual: round2((immediateMonthly + reviewMonthly) * 12),
  };

  // ── Executive summary ─────────────────────────────────────────────
  const executiveSummary = buildExecutiveSummary(data, savings, actions);

  // ── Astra upgrade CTA ─────────────────────────────────────────────
  const upgradeCallToAction: UpgradeCallToAction = {
    headline: "Unlock Full License Optimization with Astra",
    description: "This report identifies waste from AEGIS Identity Access Review data. Astra provides continuous license optimization with automated detection, downgrade recommendations, and cost tracking across your entire M365 portfolio.",
    features: [
      "Continuous license utilization monitoring (not just point-in-time IAR)",
      "SKU-level downgrade recommendations (E5 -> E3, E3 -> F3+Exchange)",
      "Duplicate license detection across overlapping SKUs",
      "Per-service usage analysis (Exchange, Teams, SharePoint, OneDrive)",
      "Automated vCIO reports with quarter-over-quarter cost trends",
      "Portfolio-wide dashboard across all managed tenants",
    ],
  };

  return {
    tenantId: data.tenantId,
    generatedAt: now,
    executiveSummary,
    actionGroups,
    actions,
    savings,
    upgradeCallToAction,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDb() {
  // Both Astra and AEGIS share the same Supabase instance
  const { sql } = require("../../db") as {
    sql: {
      execute: (q: { sql: string; params: unknown[] }) => Promise<unknown[]>;
    };
  };
  return sql;
}

function buildEmptyInsights(tenantId: string, now: Date): IarLicenseInsights {
  const emptyCategory: IarWasteCategory = { count: 0, users: [], estimatedMonthlyCost: 0 };
  return {
    tenantId,
    fetchedAt: now,
    sourceReviewId: null,
    sourceReviewDate: null,
    totalUsers: 0,
    totalLicensedUsers: 0,
    totalActiveUsers: 0,
    blockedButLicensed: emptyCategory,
    inactiveOver90d: emptyCategory,
    inactiveOver180d: emptyCategory,
    externalWithLicense: emptyCategory,
    licensedNoActivity: emptyCategory,
    totalWasteUsers: 0,
    totalWastePct: 0,
    estimatedMonthlyWaste: 0,
    estimatedAnnualWaste: 0,
    wasteDetails: [],
    delta: null,
  };
}

function buildWasteCategory(
  flags: any[],
  flagType: string,
): IarWasteCategory {
  const matching = flags.filter(
    (f: any) => f.flag_type === flagType && !f.is_suppressed,
  );

  return {
    count: matching.length,
    users: matching.map((f: any) => ({
      userPrincipalName: f.user_principal_name,
      displayName: f.display_name,
      detail: f.detail,
    })),
    estimatedMonthlyCost: matching.length * AVG_LICENSE_COST_PER_USER,
  };
}

function flagToAction(flagType: string): "disable" | "downgrade" | "remove_license" | "review" {
  switch (flagType) {
    case "blocked_but_licensed":
      return "remove_license";
    case "inactive_licensed_180d":
      return "disable";
    case "external_with_license":
      return "remove_license";
    case "inactive_licensed_90d":
      return "review";
    case "licensed_no_activity":
      return "review";
    default:
      return "review";
  }
}

function actionToRisk(action: string): "none" | "low" | "medium" {
  switch (action) {
    case "remove_license":
      return "none"; // Removing license from blocked/external is safe
    case "disable":
      return "low"; // Disabling 180d+ inactive is low risk
    case "review":
      return "medium"; // Needs human review before action
    default:
      return "medium";
  }
}

function buildActionGroups(actions: LicenseAction[]): LicenseActionGroup[] {
  const groups: Map<string, LicenseAction[]> = new Map();

  for (const action of actions) {
    const existing = groups.get(action.action) ?? [];
    existing.push(action);
    groups.set(action.action, existing);
  }

  const groupDefs: Record<string, { label: string; description: string }> = {
    disable: {
      label: "Disable Accounts",
      description: "Accounts inactive for 180+ days. Disable the account and remove license assignments. Low risk — these accounts show no sign-in activity for an extended period.",
    },
    remove_license: {
      label: "Remove Licenses",
      description: "Blocked accounts and external guests with paid license assignments. Removing these licenses recovers immediate cost with no operational impact.",
    },
    downgrade: {
      label: "Downgrade Licenses",
      description: "Users with premium licenses (E5) who only use basic features. Downgrade to a lower SKU to reduce cost while maintaining required functionality.",
    },
    review: {
      label: "Review Required",
      description: "Accounts with moderate inactivity (90-180 days) or missing activity data. Requires human review to determine if the license is still needed.",
    },
  };

  const result: LicenseActionGroup[] = [];

  for (const [actionType, actionList] of groups) {
    const def = groupDefs[actionType] ?? { label: actionType, description: "" };
    const monthlySavings = actionList.reduce((sum, a) => sum + a.estimatedMonthlySavings, 0);

    result.push({
      actionType: actionType as LicenseActionGroup["actionType"],
      label: def.label,
      description: def.description,
      userCount: actionList.length,
      estimatedMonthlySavings: round2(monthlySavings),
      estimatedAnnualSavings: round2(monthlySavings * 12),
    });
  }

  // Sort: remove_license first (immediate, no risk), then disable, then review
  const sortOrder: Record<string, number> = {
    remove_license: 1,
    disable: 2,
    downgrade: 3,
    review: 4,
  };

  return result.sort(
    (a, b) => (sortOrder[a.actionType] ?? 99) - (sortOrder[b.actionType] ?? 99),
  );
}

function buildExecutiveSummary(
  data: IarLicenseInsights,
  savings: LicenseSavingsSummary,
  actions: LicenseAction[],
): string {
  if (data.totalWasteUsers === 0) {
    return `Identity Access Review analysis of ${data.totalLicensedUsers} licensed user(s) identified no license waste. All licenses are actively utilized. No optimization actions recommended at this time.`;
  }

  const parts: string[] = [];

  parts.push(
    `Identity Access Review analysis of ${data.totalLicensedUsers} licensed user(s) identified ${data.totalWasteUsers} account(s) (${data.totalWastePct}%) with potential license waste.`,
  );

  const immediateActions = actions.filter(a => a.action !== "review");
  const reviewActions = actions.filter(a => a.action === "review");

  if (immediateActions.length > 0) {
    parts.push(
      `${immediateActions.length} account(s) can be remediated immediately, recovering an estimated $${savings.immediateMonthly.toFixed(2)}/month ($${savings.immediateAnnual.toFixed(2)}/year).`,
    );
  }

  if (reviewActions.length > 0) {
    parts.push(
      `${reviewActions.length} additional account(s) require review before action, representing up to $${savings.reviewMonthly.toFixed(2)}/month in potential savings.`,
    );
  }

  if (data.blockedButLicensed.count > 0) {
    parts.push(
      `${data.blockedButLicensed.count} blocked/disabled account(s) still have active license assignments — this is the highest-priority waste category.`,
    );
  }

  if (data.delta) {
    parts.push(data.delta.summary);
  }

  return parts.join(" ");
}

async function fetchIarDelta(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  currentReviewId: string,
  currentWasteUsers: number,
  currentMonthlyWaste: number,
): Promise<IarDelta | null> {
  const deltaResult = await db.execute({
    sql: `
      SELECT d.previous_review_id, d.new_flags, d.resolved_flags, d.summary,
             r.completed_at as prev_completed_at, r.user_count as prev_user_count
      FROM aegis.iar_deltas d
      JOIN aegis.iar_reviews r ON r.id = d.previous_review_id
      WHERE d.current_review_id = $1 AND d.tenant_id = $2
      LIMIT 1
    `,
    params: [currentReviewId, tenantId],
  } as any);

  const deltaRow = (deltaResult as any)?.[0];
  if (!deltaRow) return null;

  // Count waste flags in previous review
  const prevWasteResult = await db.execute({
    sql: `
      SELECT COUNT(DISTINCT user_principal_name)::int as waste_users
      FROM aegis.iar_flags
      WHERE review_id = $1 AND tenant_id = $2
        AND flag_type = ANY($3)
        AND is_suppressed = false
    `,
    params: [deltaRow.previous_review_id, tenantId, Array.from(LICENSE_WASTE_FLAGS)],
  } as any);

  const prevWasteUsers = (prevWasteResult as any)?.[0]?.waste_users ?? 0;
  const prevMonthlyWaste = prevWasteUsers * AVG_LICENSE_COST_PER_USER;
  const wasteUsersDelta = currentWasteUsers - prevWasteUsers;
  const wasteCostDelta = round2(currentMonthlyWaste - prevMonthlyWaste);

  const newFlags = typeof deltaRow.new_flags === "string"
    ? JSON.parse(deltaRow.new_flags).length
    : Array.isArray(deltaRow.new_flags) ? deltaRow.new_flags.length : 0;
  const resolvedFlags = typeof deltaRow.resolved_flags === "string"
    ? JSON.parse(deltaRow.resolved_flags).length
    : Array.isArray(deltaRow.resolved_flags) ? deltaRow.resolved_flags.length : 0;

  let summary: string;
  if (wasteUsersDelta > 0) {
    summary = `Compared to the previous review, ${wasteUsersDelta} additional user(s) with license waste were identified (${newFlags} new flag(s), ${resolvedFlags} resolved).`;
  } else if (wasteUsersDelta < 0) {
    summary = `Compared to the previous review, ${Math.abs(wasteUsersDelta)} fewer user(s) with license waste were identified — indicating successful remediation (${resolvedFlags} resolved, ${newFlags} new).`;
  } else {
    summary = `License waste user count is unchanged from the previous review (${newFlags} new flag(s), ${resolvedFlags} resolved).`;
  }

  return {
    previousReviewId: deltaRow.previous_review_id,
    previousReviewDate: new Date(deltaRow.prev_completed_at),
    newWasteFlags: newFlags,
    resolvedWasteFlags: resolvedFlags,
    wasteUsersDelta,
    wasteCostDelta,
    summary,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// vCIO Dashboard API — Higher-level facade for Astra dashboards
// ---------------------------------------------------------------------------

export interface VcioDashboardData {
  tenantId: string;
  licenseWaste: {
    totalLicenses: number;
    activeUsers: number;
    inactiveUsers: number;
    blockedWithLicense: number;
    estimatedWaste: number;
    annualSavings: number;
  };
  userPosture: {
    totalUsers: number;
    mfaEnabled: number;
    mfaDisabled: number;
    externalGuests: number;
    staleAccounts: number;
    adminAccounts: number;
  };
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    topRisks: Array<{ flag: string; count: number; severity: string }>;
  };
  recommendations: Array<{
    priority: number;
    action: string;
    impact: string;
    savings: number;
  }>;
  executiveSummary: string;
  generatedAt: string;
}

export interface LicenseOptimizationOverview {
  tenantId: string;
  totalLicenseCost: number;
  potentialSavings: number;
  savingsPercentage: number;
  breakdown: Array<{
    licenseName: string;
    assigned: number;
    active: number;
    wasted: number;
    monthlyCost: number;
    wastedCost: number;
  }>;
  subscriptionAlerts: Array<{
    name: string;
    alertType: string;
    severity: string;
    detail: string;
  }>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// getVcioDashboard
// ---------------------------------------------------------------------------

/**
 * Build a vCIO dashboard from IAR data for executive reporting.
 *
 * Aggregates license waste, user posture, and risk findings from the
 * latest AEGIS IAR review into a structure optimized for Astra's
 * vCIO dashboard components.
 *
 * @param tenantId - Client tenant ID
 */
export async function getVcioDashboard(
  tenantId: string,
): Promise<VcioDashboardData> {
  const now = new Date();

  // Leverage existing fetchIarLicenseData
  const iarData = await fetchIarLicenseData(tenantId);

  if (!iarData.sourceReviewId) {
    return {
      tenantId,
      licenseWaste: {
        totalLicenses: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        blockedWithLicense: 0,
        estimatedWaste: 0,
        annualSavings: 0,
      },
      userPosture: {
        totalUsers: 0,
        mfaEnabled: 0,
        mfaDisabled: 0,
        externalGuests: 0,
        staleAccounts: 0,
        adminAccounts: 0,
      },
      riskSummary: { critical: 0, high: 0, medium: 0, low: 0, topRisks: [] },
      recommendations: [],
      executiveSummary: "No IAR review data available. Conduct an Identity Access Review to establish a baseline.",
      generatedAt: now.toISOString(),
    };
  }

  const db = getDb();

  // ── License waste from IAR data ─────────────────────────────────────
  const licenseWaste = {
    totalLicenses: iarData.totalLicensedUsers,
    activeUsers: iarData.totalActiveUsers,
    inactiveUsers: iarData.inactiveOver90d.count + iarData.inactiveOver180d.count,
    blockedWithLicense: iarData.blockedButLicensed.count,
    estimatedWaste: iarData.estimatedMonthlyWaste,
    annualSavings: iarData.estimatedAnnualWaste,
  };

  // ── User posture from IAR review snapshot ────────────────────────────
  const postureResult = await db.execute({
    sql: `
      SELECT
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE mfa_registered = true)::int as mfa_enabled,
        COUNT(*) FILTER (WHERE mfa_registered = false OR mfa_registered IS NULL)::int as mfa_disabled,
        COUNT(*) FILTER (WHERE user_type IN ('Guest', '#EXT#'))::int as external_guests,
        COUNT(*) FILTER (WHERE days_since_activity >= 90 AND account_enabled = true)::int as stale_accounts,
        COUNT(*) FILTER (WHERE is_admin = true)::int as admin_accounts
      FROM aegis.iar_user_snapshots
      WHERE review_id = $1
    `,
    params: [iarData.sourceReviewId],
  } as any);

  const pRow = (postureResult as any)?.[0] ?? {};
  const userPosture = {
    totalUsers: parseInt(pRow.total_users) || iarData.totalUsers,
    mfaEnabled: parseInt(pRow.mfa_enabled) || 0,
    mfaDisabled: parseInt(pRow.mfa_disabled) || 0,
    externalGuests: parseInt(pRow.external_guests) || iarData.externalWithLicense.count,
    staleAccounts: parseInt(pRow.stale_accounts) || 0,
    adminAccounts: parseInt(pRow.admin_accounts) || 0,
  };

  // ── Risk summary from IAR flags ──────────────────────────────────────
  const riskResult = await db.execute({
    sql: `
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(adjusted_severity, base_severity) = 'critical')::int as critical,
        COUNT(*) FILTER (WHERE COALESCE(adjusted_severity, base_severity) = 'high')::int as high,
        COUNT(*) FILTER (WHERE COALESCE(adjusted_severity, base_severity) = 'medium')::int as medium,
        COUNT(*) FILTER (WHERE COALESCE(adjusted_severity, base_severity) IN ('low', 'info'))::int as low
      FROM aegis.iar_flags
      WHERE review_id = $1 AND is_suppressed = false
    `,
    params: [iarData.sourceReviewId],
  } as any);

  const rRow = (riskResult as any)?.[0] ?? {};

  // Top risk flag types
  const topRiskResult = await db.execute({
    sql: `
      SELECT
        flag_type,
        COUNT(*)::int as count,
        MAX(COALESCE(adjusted_severity, base_severity)) as severity
      FROM aegis.iar_flags
      WHERE review_id = $1 AND is_suppressed = false
      GROUP BY flag_type
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `,
    params: [iarData.sourceReviewId],
  } as any);

  const topRisks = ((topRiskResult ?? []) as any[]).map((r: any) => ({
    flag: r.flag_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    count: parseInt(r.count) || 0,
    severity: r.severity ?? "medium",
  }));

  const riskSummary = {
    critical: parseInt(rRow.critical) || 0,
    high: parseInt(rRow.high) || 0,
    medium: parseInt(rRow.medium) || 0,
    low: parseInt(rRow.low) || 0,
    topRisks,
  };

  // ── Build recommendations ────────────────────────────────────────────
  const recommendations: VcioDashboardData["recommendations"] = [];
  let priority = 1;

  if (licenseWaste.blockedWithLicense > 0) {
    const savings = round2(licenseWaste.blockedWithLicense * AVG_LICENSE_COST_PER_USER * 12);
    recommendations.push({
      priority: priority++,
      action: `Remove licenses from ${licenseWaste.blockedWithLicense} blocked/disabled account(s)`,
      impact: "Immediate license cost reduction with zero operational impact",
      savings,
    });
  }

  if (licenseWaste.inactiveUsers > 0) {
    const savings = round2(licenseWaste.inactiveUsers * AVG_LICENSE_COST_PER_USER * 12 * 0.7);
    recommendations.push({
      priority: priority++,
      action: `Review ${licenseWaste.inactiveUsers} inactive licensed account(s) for deprovisioning`,
      impact: "Recovers licenses from dormant accounts, reduces attack surface",
      savings,
    });
  }

  if (userPosture.mfaDisabled > 0) {
    recommendations.push({
      priority: priority++,
      action: `Enable MFA for ${userPosture.mfaDisabled} account(s) without MFA registration`,
      impact: "Addresses critical identity security gap per NIST 800-63B",
      savings: 0,
    });
  }

  if (userPosture.externalGuests > 10) {
    recommendations.push({
      priority: priority++,
      action: `Audit ${userPosture.externalGuests} external guest account(s)`,
      impact: "Reduces external attack surface and potential data exposure",
      savings: 0,
    });
  }

  if (userPosture.staleAccounts > 0) {
    recommendations.push({
      priority: priority++,
      action: `Investigate ${userPosture.staleAccounts} stale account(s) inactive 90+ days`,
      impact: "Eliminates dormant account risk, may recover additional licenses",
      savings: 0,
    });
  }

  // ── Executive summary ─────────────────────────────────────────────────
  const report = generateLicenseOptimizationReport(iarData);
  const executiveSummary = report.executiveSummary;

  return {
    tenantId,
    licenseWaste,
    userPosture,
    riskSummary,
    recommendations,
    executiveSummary,
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// getLicenseOptimization
// ---------------------------------------------------------------------------

/**
 * Generate a license optimization overview for the Astra dashboard.
 *
 * Combines IAR waste analysis with subscription-level intelligence
 * (when available) to produce per-SKU breakdown and subscription alerts.
 *
 * @param tenantId - Client tenant ID
 */
export async function getLicenseOptimization(
  tenantId: string,
): Promise<LicenseOptimizationOverview> {
  const now = new Date();
  const iarData = await fetchIarLicenseData(tenantId);
  const report = generateLicenseOptimizationReport(iarData);

  // Build breakdown from action groups + waste details
  const licenseMap = new Map<string, {
    assigned: number;
    active: number;
    wasted: number;
    monthlyCost: number;
    wastedCost: number;
  }>();

  for (const detail of iarData.wasteDetails) {
    // Group by flag type as license category (simplified; production uses SKU mapping)
    const key = detail.flagType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const existing = licenseMap.get(key) ?? {
      assigned: 0,
      active: 0,
      wasted: 0,
      monthlyCost: 0,
      wastedCost: 0,
    };
    existing.wasted += 1;
    existing.wastedCost += detail.estimatedMonthlyCost;
    licenseMap.set(key, existing);
  }

  const breakdown = Array.from(licenseMap.entries()).map(([name, data]) => ({
    licenseName: name,
    assigned: data.assigned + data.wasted,
    active: data.active,
    wasted: data.wasted,
    monthlyCost: round2(data.monthlyCost + data.wastedCost),
    wastedCost: round2(data.wastedCost),
  }));

  // Subscription alerts — fetch from review if available
  const subscriptionAlerts: LicenseOptimizationOverview["subscriptionAlerts"] = [];

  if (iarData.sourceReviewId) {
    const db = getDb();
    const alertResult = await db.execute({
      sql: `
        SELECT subscription_name, alert_type, severity, detail
        FROM aegis.iar_subscription_alerts
        WHERE review_id = $1
        ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
      `,
      params: [iarData.sourceReviewId],
    } as any);

    for (const r of ((alertResult ?? []) as any[])) {
      subscriptionAlerts.push({
        name: r.subscription_name,
        alertType: r.alert_type,
        severity: r.severity,
        detail: r.detail,
      });
    }
  }

  return {
    tenantId,
    totalLicenseCost: round2(iarData.totalLicensedUsers * AVG_LICENSE_COST_PER_USER),
    potentialSavings: report.savings.totalMonthly,
    savingsPercentage: iarData.totalLicensedUsers > 0
      ? round2((report.savings.totalMonthly / (iarData.totalLicensedUsers * AVG_LICENSE_COST_PER_USER)) * 100)
      : 0,
    breakdown,
    subscriptionAlerts,
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// getExecutiveNarrative
// ---------------------------------------------------------------------------

/**
 * Generate a plain-text executive narrative for vCIO presentations.
 *
 * Combines license waste, user posture, and risk findings into a 2-4 paragraph
 * narrative suitable for executive audiences. Follows the IAR Report Tone Engine:
 * never frames findings as MSP negligence.
 *
 * @param tenantId - Client tenant ID
 */
export async function getExecutiveNarrative(
  tenantId: string,
): Promise<string> {
  const dashboard = await getVcioDashboard(tenantId);
  const optimization = await getLicenseOptimization(tenantId);
  const { licenseWaste, userPosture, riskSummary } = dashboard;

  const paragraphs: string[] = [];

  // Paragraph 1: License overview
  if (licenseWaste.totalLicenses > 0) {
    const wasteRate = licenseWaste.totalLicenses > 0
      ? Math.round(
          ((licenseWaste.inactiveUsers + licenseWaste.blockedWithLicense) /
            licenseWaste.totalLicenses) *
            100,
        )
      : 0;

    paragraphs.push(
      `Identity Access Review of ${licenseWaste.totalLicenses} licensed account(s) identified ` +
        `${licenseWaste.activeUsers} active user(s) and ` +
        `${licenseWaste.inactiveUsers + licenseWaste.blockedWithLicense} account(s) ` +
        `representing potential license optimization opportunities (${wasteRate}% of assignments). ` +
        `Estimated annual savings from license right-sizing: ` +
        `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(licenseWaste.annualSavings)}.`,
    );
  } else {
    paragraphs.push(
      "No IAR review data is available for this tenant. An Identity Access Review should be " +
        "conducted to establish a license optimization baseline.",
    );
  }

  // Paragraph 2: Security posture
  if (riskSummary.critical > 0 || riskSummary.high > 0) {
    let postureParagraph =
      `The review identified ${riskSummary.critical + riskSummary.high} high-priority finding(s) ` +
      `that should be addressed promptly. `;
    if (userPosture.mfaDisabled > 0) {
      postureParagraph += `${userPosture.mfaDisabled} account(s) lack MFA enrollment, representing a significant access control gap. `;
    }
    if (userPosture.staleAccounts > 0) {
      postureParagraph += `${userPosture.staleAccounts} stale account(s) should be reviewed for deprovisioning. `;
    }
    postureParagraph += "These findings represent opportunities to strengthen the organization's identity security posture.";
    paragraphs.push(postureParagraph);
  } else if (riskSummary.medium > 0) {
    paragraphs.push(
      `${riskSummary.medium} medium-priority observation(s) were noted, primarily housekeeping items. ` +
        "The overall identity security posture is satisfactory with minor areas for improvement.",
    );
  } else {
    paragraphs.push(
      "No significant identity security concerns were identified. The tenant demonstrates " +
        "strong user account hygiene and license management practices.",
    );
  }

  // Paragraph 3: Subscription intelligence (if available)
  if (optimization.subscriptionAlerts.length > 0) {
    const expiringCount = optimization.subscriptionAlerts.filter(
      (a) => a.alertType === "expiring_soon",
    ).length;
    const overProvCount = optimization.subscriptionAlerts.filter(
      (a) => a.alertType === "over_provisioned",
    ).length;

    const parts: string[] = [];
    if (expiringCount > 0) parts.push(`${expiringCount} subscription(s) approaching renewal`);
    if (overProvCount > 0) parts.push(`${overProvCount} subscription(s) identified as over-provisioned`);

    if (parts.length > 0) {
      paragraphs.push(
        `Subscription-level analysis reveals ${parts.join(" and ")}. ` +
          "Reviewing these before the next billing cycle can reduce unnecessary spend.",
      );
    }
  }

  // Paragraph 4: Top recommendation
  if (dashboard.recommendations.length > 0) {
    const top = dashboard.recommendations[0];
    const savingsStr = top.savings > 0
      ? `, projected savings: $${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(top.savings)}/year`
      : "";
    paragraphs.push(
      `Top recommendation: ${top.action} (estimated impact: ${top.impact}${savingsStr}).`,
    );
  }

  return paragraphs.join("\n\n");
}
