/**
 * CVG-MIDAS — AEGIS Integration Service
 *
 * Fetches security posture data from AEGIS for QBR generation.
 * Cross-app integration: AEGIS -> Midas (Security findings -> QBR line items).
 *
 * Data flow:
 *   AEGIS Cavaridge Adjusted Score + findings + browser telemetry
 *   -> structured QbrSecurityData
 *   -> consumed by qbr-security-section.ts for report generation
 *
 * Both apps share the same Supabase instance, so this module queries
 * the aegis schema directly rather than making HTTP calls.
 */

import * as storage from "../../storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QbrSecurityData {
  tenantId: string;
  clientId: string;
  fetchedAt: Date;

  /** Cavaridge Adjusted Score (0-100) */
  adjustedScore: AdjustedScoreSnapshot;

  /** Top security findings ranked by severity */
  topFindings: SecurityFinding[];

  /** Browser security compliance percentage (0-100) */
  browserSecurityCompliancePct: number | null;

  /** Count of unsanctioned SaaS applications discovered */
  sasShadowItAppCount: number;

  /** Credential hygiene score (0-100) */
  credentialHygieneScore: number | null;

  /** Previous quarter score for trend analysis */
  previousQuarterScore: PreviousQuarterScore | null;

  /** Active compensating controls */
  compensatingControls: CompensatingControlSummary[];

  /** Summary metrics for dashboard cards */
  summaryMetrics: SecuritySummaryMetrics;
}

export interface AdjustedScoreSnapshot {
  totalScore: number;
  grade: string;
  signalBreakdown: Array<{
    signal: string;
    rawScore: number | null;
    weightedContribution: number;
    status: string;
  }>;
  calculatedAt: Date;
}

export interface SecurityFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  description: string;
  affectedAsset: string;
  remediationRecommendation: string;
  estimatedEffort: "low" | "medium" | "high";
  cisControl?: string;
  detectedAt: Date;
}

export interface PreviousQuarterScore {
  totalScore: number;
  grade: string;
  calculatedAt: Date;
  delta: number;
  trend: "improving" | "declining" | "stable";
}

export interface CompensatingControlSummary {
  controlType: string;
  name: string;
  vendor: string;
  bonusPoints: number;
  detectionMethod: "auto" | "manual";
}

export interface SecuritySummaryMetrics {
  totalDevices: number;
  activeExtensions: number;
  extensionCoveragePct: number;
  totalSecurityFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  mfaAdoptionPct: number | null;
  dnsFilteringEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch AEGIS security data for a specific client's QBR.
 *
 * Queries the aegis schema in the shared Supabase database to retrieve:
 *  - Latest Cavaridge Adjusted Score and signal breakdown
 *  - Top 5 security findings by severity
 *  - Browser security compliance metrics
 *  - SaaS shadow IT discovery count
 *  - Credential hygiene score
 *  - Previous quarter score for trend comparison
 *  - Active compensating controls
 *
 * @param tenantId - MSP tenant ID (the org generating the QBR)
 * @param clientId - Client tenant ID (the client the QBR is for)
 */
export async function fetchAegisDataForQbr(
  tenantId: string,
  clientId: string,
): Promise<QbrSecurityData> {
  const db = getDb();
  const now = new Date();

  // ── Fetch latest Adjusted Score ───────────────────────────────────
  const scoreResult = await db.execute({
    sql: `
      SELECT
        total_score,
        microsoft_secure_score_raw, microsoft_secure_score_weighted,
        browser_security_raw, browser_security_weighted,
        google_workspace_raw, google_workspace_weighted,
        credential_hygiene_raw, credential_hygiene_weighted,
        dns_filtering_raw, dns_filtering_weighted,
        saas_shadow_it_raw, saas_shadow_it_weighted,
        compensating_controls_bonus, compensating_controls,
        weight_config, calculated_at
      FROM aegis.adjusted_scores
      WHERE tenant_id = $1 AND client_tenant_id = $2
      ORDER BY calculated_at DESC
      LIMIT 1
    `,
    params: [tenantId, clientId],
  } as any);

  const scoreRow = (scoreResult as any)?.[0];

  const adjustedScore: AdjustedScoreSnapshot = scoreRow
    ? {
        totalScore: parseFloat(scoreRow.total_score),
        grade: numericToGrade(parseFloat(scoreRow.total_score)),
        signalBreakdown: [
          { signal: "microsoft_secure_score", rawScore: parseNullable(scoreRow.microsoft_secure_score_raw), weightedContribution: parseFloat(scoreRow.microsoft_secure_score_weighted) || 0, status: scoreRow.microsoft_secure_score_raw !== null ? "active" : "not_configured" },
          { signal: "browser_security", rawScore: parseNullable(scoreRow.browser_security_raw), weightedContribution: parseFloat(scoreRow.browser_security_weighted) || 0, status: scoreRow.browser_security_raw !== null ? "active" : "not_configured" },
          { signal: "google_workspace", rawScore: parseNullable(scoreRow.google_workspace_raw), weightedContribution: parseFloat(scoreRow.google_workspace_weighted) || 0, status: scoreRow.google_workspace_raw !== null ? "active" : "not_configured" },
          { signal: "credential_hygiene", rawScore: parseNullable(scoreRow.credential_hygiene_raw), weightedContribution: parseFloat(scoreRow.credential_hygiene_weighted) || 0, status: scoreRow.credential_hygiene_raw !== null ? "active" : "not_configured" },
          { signal: "dns_filtering", rawScore: parseNullable(scoreRow.dns_filtering_raw), weightedContribution: parseFloat(scoreRow.dns_filtering_weighted) || 0, status: scoreRow.dns_filtering_raw !== null ? "active" : "not_configured" },
          { signal: "saas_shadow_it", rawScore: parseNullable(scoreRow.saas_shadow_it_raw), weightedContribution: parseFloat(scoreRow.saas_shadow_it_weighted) || 0, status: scoreRow.saas_shadow_it_raw !== null ? "active" : "not_configured" },
        ],
        calculatedAt: new Date(scoreRow.calculated_at),
      }
    : {
        totalScore: 0,
        grade: "F",
        signalBreakdown: [],
        calculatedAt: now,
      };

  // ── Fetch top 5 security findings ─────────────────────────────────
  const findingsResult = await db.execute({
    sql: `
      SELECT id, severity, category, title, description,
             affected_asset, remediation_recommendation,
             estimated_effort, cis_control, detected_at
      FROM aegis.security_findings
      WHERE tenant_id = $1
        AND (client_tenant_id = $2 OR client_tenant_id IS NULL)
        AND status != 'resolved'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          WHEN 'info' THEN 5
        END ASC,
        detected_at DESC
      LIMIT 5
    `,
    params: [tenantId, clientId],
  } as any);

  const topFindings: SecurityFinding[] = ((findingsResult ?? []) as any[]).map((r: any) => ({
    id: r.id,
    severity: r.severity,
    category: r.category ?? "general",
    title: r.title,
    description: r.description,
    affectedAsset: r.affected_asset ?? "Environment",
    remediationRecommendation: r.remediation_recommendation ?? "Review and remediate per security policy.",
    estimatedEffort: r.estimated_effort ?? "medium",
    cisControl: r.cis_control ?? undefined,
    detectedAt: new Date(r.detected_at),
  }));

  // ── Browser security compliance ───────────────────────────────────
  const deviceResult = await db.execute({
    sql: `
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'active')::int as active,
        COUNT(*) FILTER (WHERE last_seen_at > now() - interval '7 days')::int as recent
      FROM aegis.devices
      WHERE tenant_id = $1
    `,
    params: [clientId],
  } as any);

  const devices = (deviceResult as any)?.[0] ?? { total: 0, active: 0, recent: 0 };
  const browserSecurityCompliancePct = devices.total > 0
    ? Math.round(((devices.active / devices.total) * 50 + (devices.recent / devices.total) * 50) * 10) / 10
    : null;

  // ── SaaS shadow IT count ──────────────────────────────────────────
  const saasResult = await db.execute({
    sql: `
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE classification = 'unsanctioned')::int as unsanctioned,
        COUNT(*) FILTER (WHERE classification = 'unclassified')::int as unclassified
      FROM aegis.saas_applications
      WHERE tenant_id = $1
    `,
    params: [clientId],
  } as any);

  const saasRow = (saasResult as any)?.[0] ?? { total: 0, unsanctioned: 0, unclassified: 0 };
  const sasShadowItAppCount = (saasRow.unsanctioned ?? 0) + (saasRow.unclassified ?? 0);

  // ── Credential hygiene ────────────────────────────────────────────
  const credentialHygieneScore = scoreRow?.credential_hygiene_raw !== null
    ? parseFloat(scoreRow?.credential_hygiene_raw) || null
    : null;

  // ── Previous quarter score (90 days ago window) ───────────────────
  const previousQuarterScore = await fetchPreviousQuarterScore(db, tenantId, clientId, now);

  // ── Compensating controls ─────────────────────────────────────────
  const controlsResult = await db.execute({
    sql: `
      SELECT control_type, name, vendor, bonus_points, detection_method
      FROM aegis.compensating_controls
      WHERE tenant_id = $1 AND enabled = true
    `,
    params: [clientId],
  } as any);

  const compensatingControls: CompensatingControlSummary[] =
    ((controlsResult ?? []) as any[]).map((r: any) => ({
      controlType: r.control_type,
      name: r.name,
      vendor: r.vendor,
      bonusPoints: parseFloat(r.bonus_points) || 0,
      detectionMethod: r.detection_method ?? "auto",
    }));

  // ── All findings count for summary metrics ────────────────────────
  const allFindingsResult = await db.execute({
    sql: `
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE severity = 'critical')::int as critical,
        COUNT(*) FILTER (WHERE severity = 'high')::int as high,
        COUNT(*) FILTER (WHERE severity = 'medium')::int as medium
      FROM aegis.security_findings
      WHERE tenant_id = $1
        AND (client_tenant_id = $2 OR client_tenant_id IS NULL)
        AND status != 'resolved'
    `,
    params: [tenantId, clientId],
  } as any);

  const allFindings = (allFindingsResult as any)?.[0] ?? { total: 0, critical: 0, high: 0, medium: 0 };

  // ── MFA adoption from tenant-intel ────────────────────────────────
  const mfaResult = await db.execute({
    sql: `
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE mfa_enabled = true)::int as mfa_enabled
      FROM tenant_intel.user_directory
      WHERE tenant_id = $1 AND account_enabled = true
    `,
    params: [clientId],
  } as any);

  const mfaRow = (mfaResult as any)?.[0];
  const mfaAdoptionPct = mfaRow && mfaRow.total > 0
    ? Math.round((mfaRow.mfa_enabled / mfaRow.total) * 1000) / 10
    : null;

  // ── DNS filtering status ──────────────────────────────────────────
  const dnsFilteringEnabled = scoreRow?.dns_filtering_raw !== null;

  const summaryMetrics: SecuritySummaryMetrics = {
    totalDevices: devices.total,
    activeExtensions: devices.active,
    extensionCoveragePct: devices.total > 0 ? Math.round((devices.active / devices.total) * 100) : 0,
    totalSecurityFindings: allFindings.total,
    criticalFindings: allFindings.critical,
    highFindings: allFindings.high,
    mediumFindings: allFindings.medium,
    mfaAdoptionPct,
    dnsFilteringEnabled,
  };

  return {
    tenantId,
    clientId,
    fetchedAt: now,
    adjustedScore,
    topFindings,
    browserSecurityCompliancePct,
    sasShadowItAppCount,
    credentialHygieneScore,
    previousQuarterScore,
    compensatingControls,
    summaryMetrics,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Lazy import of the shared Supabase DB connection.
 * Midas and AEGIS share the same Supabase instance.
 */
function getDb() {
  // Use dynamic require to import from midas storage which wraps the DB
  // In production, this resolves to the same postgres connection pool
  const { sql } = require("../../db") as {
    sql: {
      execute: (q: { sql: string; params: unknown[] }) => Promise<unknown[]>;
    };
  };
  return sql;
}

async function fetchPreviousQuarterScore(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  clientId: string,
  now: Date,
): Promise<PreviousQuarterScore | null> {
  // Look for a score from ~90 days ago (previous quarter)
  const prevResult = await db.execute({
    sql: `
      SELECT total_score, calculated_at
      FROM aegis.score_history
      WHERE tenant_id = $1
        AND (client_tenant_id = $2 OR client_tenant_id IS NULL)
        AND recorded_at < now() - interval '60 days'
      ORDER BY recorded_at DESC
      LIMIT 1
    `,
    params: [tenantId, clientId],
  } as any);

  const prevRow = (prevResult as any)?.[0];
  if (!prevRow) return null;

  const prevScore = parseFloat(prevRow.total_score);
  const currentScore = parseFloat(
    ((await db.execute({
      sql: `SELECT total_score FROM aegis.score_history WHERE tenant_id = $1 AND (client_tenant_id = $2 OR client_tenant_id IS NULL) ORDER BY recorded_at DESC LIMIT 1`,
      params: [tenantId, clientId],
    } as any)) as any)?.[0]?.total_score ?? "0",
  );

  const delta = Math.round((currentScore - prevScore) * 10) / 10;

  return {
    totalScore: prevScore,
    grade: numericToGrade(prevScore),
    calculatedAt: new Date(prevRow.calculated_at ?? prevRow.recorded_at),
    delta,
    trend: delta > 2 ? "improving" : delta < -2 ? "declining" : "stable",
  };
}

function numericToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function parseNullable(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// QBR Security Section — Higher-level API consumed by QBR report generation
// ---------------------------------------------------------------------------

export interface QbrSecuritySection {
  tenantId: string;
  adjustedScore: number;
  scoreRating: "Strong" | "Good" | "Needs Improvement" | "At Risk";
  scoreTrend: "improving" | "stable" | "declining";
  previousScore: number | null;
  signalBreakdown: Array<{
    signal: string;
    score: number;
    weight: number;
    contribution: number;
  }>;
  topFindings: Array<{
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    recommendation: string;
    affectedAssets: number;
  }>;
  compensatingControls: Array<{
    name: string;
    detected: boolean;
    bonusApplied: number;
  }>;
  recommendations: Array<{
    priority: number;
    title: string;
    impact: string;
    effort: "low" | "medium" | "high";
    estimatedCost?: string;
  }>;
  saasInventory: {
    total: number;
    sanctioned: number;
    unsanctioned: number;
    highRisk: number;
  };
  credentialRisk: {
    breachedAccounts: number;
    weakPasswords: number;
    noMfa: number;
    reusedPasswords: number;
  };
  generatedAt: string;
}

/**
 * Map a numeric score (0-100) to a human-readable rating.
 */
function scoreToRating(
  score: number,
): "Strong" | "Good" | "Needs Improvement" | "At Risk" {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "At Risk";
}

/**
 * Build the full QBR security section for a tenant.
 *
 * Aggregates the Cavaridge Adjusted Score, top findings, compensating
 * controls, SaaS inventory, credential risk, and actionable recommendations
 * into a single structure suitable for QBR report rendering.
 *
 * @param tenantId - MSP or client tenant ID
 */
export async function getQbrSecuritySection(
  tenantId: string,
): Promise<QbrSecuritySection> {
  const db = getDb();
  const now = new Date();

  // Fetch latest score
  const scoreResult = await db.execute({
    sql: `
      SELECT
        total_score,
        microsoft_secure_score_raw, microsoft_secure_score_weighted,
        browser_security_raw, browser_security_weighted,
        google_workspace_raw, google_workspace_weighted,
        credential_hygiene_raw, credential_hygiene_weighted,
        dns_filtering_raw, dns_filtering_weighted,
        saas_shadow_it_raw, saas_shadow_it_weighted,
        compensating_controls_bonus, compensating_controls,
        weight_config, calculated_at
      FROM aegis.adjusted_scores
      WHERE tenant_id = $1
      ORDER BY calculated_at DESC
      LIMIT 1
    `,
    params: [tenantId],
  } as any);

  const scoreRow = (scoreResult as any)?.[0];
  const totalScore = scoreRow ? parseFloat(scoreRow.total_score) : 0;

  // Build signal breakdown
  const signalBreakdown = scoreRow
    ? buildSignalBreakdown(scoreRow)
    : [];

  // Fetch previous score for trend
  const prevResult = await db.execute({
    sql: `
      SELECT total_score, recorded_at
      FROM aegis.score_history
      WHERE tenant_id = $1 AND recorded_at < now() - interval '30 days'
      ORDER BY recorded_at DESC
      LIMIT 1
    `,
    params: [tenantId],
  } as any);

  const prevRow = (prevResult as any)?.[0];
  const previousScore = prevRow ? parseFloat(prevRow.total_score) : null;
  const delta = previousScore !== null ? totalScore - previousScore : 0;
  const scoreTrend: "improving" | "stable" | "declining" =
    delta > 2 ? "improving" : delta < -2 ? "declining" : "stable";

  // Top findings with affected asset counts
  const findingsResult = await db.execute({
    sql: `
      SELECT
        severity, title, description,
        remediation_recommendation,
        estimated_effort,
        COALESCE(affected_asset_count, 1) as affected_assets
      FROM aegis.security_findings
      WHERE tenant_id = $1 AND status != 'resolved'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1 WHEN 'high' THEN 2
          WHEN 'medium' THEN 3 WHEN 'low' THEN 4
        END ASC,
        detected_at DESC
      LIMIT 10
    `,
    params: [tenantId],
  } as any);

  const topFindings = ((findingsResult ?? []) as any[]).map((r: any) => ({
    severity: r.severity as "critical" | "high" | "medium" | "low",
    title: r.title,
    description: r.description,
    recommendation:
      r.remediation_recommendation ??
      "Review and remediate per security policy.",
    affectedAssets: parseInt(r.affected_assets) || 1,
  }));

  // Compensating controls
  const controlsResult = await db.execute({
    sql: `
      SELECT name, enabled, bonus_points
      FROM aegis.compensating_controls
      WHERE tenant_id = $1
    `,
    params: [tenantId],
  } as any);

  const compensatingControls = ((controlsResult ?? []) as any[]).map(
    (r: any) => ({
      name: r.name,
      detected: r.enabled === true,
      bonusApplied: r.enabled ? parseFloat(r.bonus_points) || 0 : 0,
    }),
  );

  // SaaS inventory
  const saasResult = await db.execute({
    sql: `
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE classification = 'sanctioned')::int as sanctioned,
        COUNT(*) FILTER (WHERE classification = 'unsanctioned')::int as unsanctioned,
        COUNT(*) FILTER (WHERE risk_level = 'high')::int as high_risk
      FROM aegis.saas_applications
      WHERE tenant_id = $1
    `,
    params: [tenantId],
  } as any);

  const saasRow = (saasResult as any)?.[0] ?? {};
  const saasInventory = {
    total: saasRow.total ?? 0,
    sanctioned: saasRow.sanctioned ?? 0,
    unsanctioned: saasRow.unsanctioned ?? 0,
    highRisk: saasRow.high_risk ?? 0,
  };

  // Credential risk
  const credResult = await db.execute({
    sql: `
      SELECT
        COUNT(*) FILTER (WHERE is_breached = true)::int as breached,
        COUNT(*) FILTER (WHERE password_strength = 'weak')::int as weak_passwords,
        COUNT(*) FILTER (WHERE mfa_enabled = false)::int as no_mfa,
        COUNT(*) FILTER (WHERE is_reused = true)::int as reused
      FROM aegis.credential_hygiene
      WHERE tenant_id = $1
    `,
    params: [tenantId],
  } as any);

  const credRow = (credResult as any)?.[0] ?? {};
  const credentialRisk = {
    breachedAccounts: credRow.breached ?? 0,
    weakPasswords: credRow.weak_passwords ?? 0,
    noMfa: credRow.no_mfa ?? 0,
    reusedPasswords: credRow.reused ?? 0,
  };

  // Build recommendations from findings and gaps
  const recommendations = buildRecommendations(
    topFindings,
    saasInventory,
    credentialRisk,
    compensatingControls,
    totalScore,
  );

  return {
    tenantId,
    adjustedScore: totalScore,
    scoreRating: scoreToRating(totalScore),
    scoreTrend,
    previousScore,
    signalBreakdown,
    topFindings,
    compensatingControls,
    recommendations,
    saasInventory,
    credentialRisk,
    generatedAt: now.toISOString(),
  };
}

/**
 * Retrieve historical score data for trend charting.
 *
 * Returns monthly score snapshots for the specified number of months,
 * ordered chronologically (oldest first).
 *
 * @param tenantId - Tenant ID
 * @param months  - Number of months of history to retrieve (default 12)
 */
export async function getScoreTrend(
  tenantId: string,
  months: number = 12,
): Promise<
  Array<{
    month: string;
    score: number;
    grade: string;
    delta: number | null;
  }>
> {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT
        to_char(date_trunc('month', recorded_at), 'YYYY-MM') as month,
        AVG(total_score)::numeric(5,1) as avg_score,
        MAX(recorded_at) as latest_at
      FROM aegis.score_history
      WHERE tenant_id = $1
        AND recorded_at >= now() - ($2 || ' months')::interval
      GROUP BY date_trunc('month', recorded_at)
      ORDER BY date_trunc('month', recorded_at) ASC
    `,
    params: [tenantId, String(months)],
  } as any);

  const rows = ((result ?? []) as any[]).map((r: any) => ({
    month: r.month,
    score: parseFloat(r.avg_score) || 0,
  }));

  // Calculate deltas between consecutive months
  return rows.map((row, idx) => ({
    month: row.month,
    score: row.score,
    grade: numericToGrade(row.score),
    delta: idx > 0 ? Math.round((row.score - rows[idx - 1].score) * 10) / 10 : null,
  }));
}

/**
 * Retrieve the highest-impact remediation items for a tenant.
 *
 * Returns findings + generated recommendations sorted by priority,
 * limited to the specified count. Designed for executive-level
 * "top actions to take" summaries.
 *
 * @param tenantId - Tenant ID
 * @param limit    - Maximum number of items to return (default 5)
 */
export async function getTopRemediation(
  tenantId: string,
  limit: number = 5,
): Promise<
  Array<{
    priority: number;
    title: string;
    description: string;
    impact: string;
    effort: "low" | "medium" | "high";
    estimatedCost: string | null;
    source: "finding" | "recommendation";
  }>
> {
  const db = getDb();

  // Fetch top unresolved findings
  const findingsResult = await db.execute({
    sql: `
      SELECT
        severity, title, description,
        remediation_recommendation, estimated_effort
      FROM aegis.security_findings
      WHERE tenant_id = $1 AND status != 'resolved'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1 WHEN 'high' THEN 2
          WHEN 'medium' THEN 3 WHEN 'low' THEN 4
        END ASC,
        detected_at DESC
      LIMIT $2
    `,
    params: [tenantId, limit],
  } as any);

  const items: Array<{
    priority: number;
    title: string;
    description: string;
    impact: string;
    effort: "low" | "medium" | "high";
    estimatedCost: string | null;
    source: "finding" | "recommendation";
  }> = [];

  let priority = 1;

  for (const r of (findingsResult ?? []) as any[]) {
    const severity = r.severity as string;
    const effort = (r.estimated_effort ?? "medium") as "low" | "medium" | "high";

    items.push({
      priority: priority++,
      title: r.title,
      description: r.description,
      impact: severity === "critical"
        ? "Eliminates critical security gap"
        : severity === "high"
        ? "Addresses high-priority risk"
        : "Reduces overall risk posture",
      effort,
      estimatedCost: effort === "low"
        ? "$0 - $500"
        : effort === "medium"
        ? "$500 - $5,000"
        : "$5,000+",
      source: "finding",
    });

    if (items.length >= limit) break;
  }

  // If we have room, add gap-based recommendations
  if (items.length < limit) {
    const scoreResult = await db.execute({
      sql: `
        SELECT dns_filtering_raw, saas_shadow_it_raw, browser_security_raw
        FROM aegis.adjusted_scores
        WHERE tenant_id = $1
        ORDER BY calculated_at DESC
        LIMIT 1
      `,
      params: [tenantId],
    } as any);

    const row = (scoreResult as any)?.[0];

    if (row && row.dns_filtering_raw === null && items.length < limit) {
      items.push({
        priority: priority++,
        title: "Enable DNS Filtering",
        description:
          "DNS filtering is not configured. Cloudflare Gateway provides category-based blocking and malware domain prevention. Free tier covers up to 50 seats.",
        impact: "+5-10 points on Cavaridge Adjusted Score",
        effort: "low",
        estimatedCost: "$0 - $150/mo",
        source: "recommendation",
      });
    }

    if (row && row.browser_security_raw === null && items.length < limit) {
      items.push({
        priority: priority++,
        title: "Deploy AEGIS Browser Extension",
        description:
          "Browser extension not deployed. Provides real-time phishing detection, SaaS shadow IT discovery, and credential monitoring.",
        impact: "+5-15 points on Cavaridge Adjusted Score",
        effort: "medium",
        estimatedCost: "$2.50 - $7.00/endpoint/mo",
        source: "recommendation",
      });
    }
  }

  return items.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Internal helpers for QbrSecuritySection
// ---------------------------------------------------------------------------

function buildSignalBreakdown(
  scoreRow: any,
): Array<{ signal: string; score: number; weight: number; contribution: number }> {
  const signals: Array<{
    signal: string;
    rawKey: string;
    weightedKey: string;
    defaultWeight: number;
  }> = [
    { signal: "Microsoft Secure Score", rawKey: "microsoft_secure_score_raw", weightedKey: "microsoft_secure_score_weighted", defaultWeight: 0.25 },
    { signal: "Browser Security Compliance", rawKey: "browser_security_raw", weightedKey: "browser_security_weighted", defaultWeight: 0.20 },
    { signal: "Google Workspace Security Health", rawKey: "google_workspace_raw", weightedKey: "google_workspace_weighted", defaultWeight: 0.15 },
    { signal: "Credential Hygiene", rawKey: "credential_hygiene_raw", weightedKey: "credential_hygiene_weighted", defaultWeight: 0.15 },
    { signal: "DNS Filtering Compliance", rawKey: "dns_filtering_raw", weightedKey: "dns_filtering_weighted", defaultWeight: 0.10 },
    { signal: "SaaS Shadow IT Risk", rawKey: "saas_shadow_it_raw", weightedKey: "saas_shadow_it_weighted", defaultWeight: 0.15 },
  ];

  const weights = scoreRow.weight_config
    ? (typeof scoreRow.weight_config === "string"
        ? JSON.parse(scoreRow.weight_config)
        : scoreRow.weight_config)
    : null;

  return signals.map((s) => {
    const raw = parseNullable(scoreRow[s.rawKey]);
    const weighted = parseFloat(scoreRow[s.weightedKey]) || 0;
    const weight = weights?.[s.rawKey.replace("_raw", "")] ?? s.defaultWeight;

    return {
      signal: s.signal,
      score: raw ?? 0,
      weight,
      contribution: weighted,
    };
  });
}

function buildRecommendations(
  findings: Array<{ severity: string; title: string; recommendation: string }>,
  saas: { unsanctioned: number; highRisk: number },
  creds: { breachedAccounts: number; noMfa: number },
  controls: Array<{ detected: boolean }>,
  score: number,
): Array<{
  priority: number;
  title: string;
  impact: string;
  effort: "low" | "medium" | "high";
  estimatedCost?: string;
}> {
  const recs: Array<{
    priority: number;
    title: string;
    impact: string;
    effort: "low" | "medium" | "high";
    estimatedCost?: string;
  }> = [];

  let priority = 1;

  // Critical/high findings first
  const criticalFindings = findings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  for (const f of criticalFindings.slice(0, 3)) {
    recs.push({
      priority: priority++,
      title: `Remediate: ${f.title}`,
      impact: `Resolves ${f.severity}-severity finding`,
      effort: "medium",
    });
  }

  // MFA gaps
  if (creds.noMfa > 0) {
    recs.push({
      priority: priority++,
      title: `Enforce MFA for ${creds.noMfa} account(s)`,
      impact: "Eliminates credential-based attack vector",
      effort: "low",
      estimatedCost: "$0 - $6,000/yr",
    });
  }

  // Breached credentials
  if (creds.breachedAccounts > 0) {
    recs.push({
      priority: priority++,
      title: `Reset ${creds.breachedAccounts} breached credential(s)`,
      impact: "Removes known-compromised access",
      effort: "low",
      estimatedCost: "$0",
    });
  }

  // Shadow IT
  if (saas.unsanctioned > 5) {
    recs.push({
      priority: priority++,
      title: `Audit ${saas.unsanctioned} unsanctioned SaaS application(s)`,
      impact: "Reduces shadow IT risk and data sprawl",
      effort: "medium",
      estimatedCost: "$2,000 - $5,000",
    });
  }

  return recs;
}
