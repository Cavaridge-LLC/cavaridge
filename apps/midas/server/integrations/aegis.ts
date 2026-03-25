/**
 * AEGIS Integration — consumes Cavaridge Adjusted Score and findings.
 *
 * Cross-app data flow: CVG-AEGIS → CVG-MIDAS
 * Security findings + Adjusted Score → QBR line items.
 */

import type {
  AegisScorePayload,
  AegisSecurityFinding,
  AegisQbrData,
} from "@shared/types/aegis-integration";

/**
 * Transform AEGIS score signals into Midas-compatible format.
 * In production this will call the AEGIS API; for now we define
 * the interface and accept pre-fetched data.
 */
export function normalizeAegisScore(payload: AegisScorePayload): {
  adjustedScore: number;
  nativeScore: number;
  browserSecurityScore: number | null;
  dnsComplianceScore: number | null;
  credentialHygieneScore: number | null;
  shadowItRiskScore: number | null;
  compensatingBonus: number;
} {
  return {
    adjustedScore: payload.adjustedScore,
    nativeScore: payload.nativeScore,
    browserSecurityScore: payload.browserSecurityScore,
    dnsComplianceScore: payload.dnsComplianceScore,
    credentialHygieneScore: payload.credentialHygieneScore,
    shadowItRiskScore: payload.shadowItRiskScore,
    compensatingBonus: payload.compensatingBonus,
  };
}

/**
 * Filter AEGIS findings by severity for QBR inclusion.
 * Only critical and high findings make it into QBR reports.
 */
export function filterFindingsForQbr(
  findings: AegisSecurityFinding[],
): AegisSecurityFinding[] {
  return findings
    .filter((f) => f.resolvedAt === null)
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
}

/**
 * Build AEGIS QBR data section from score and findings.
 */
export function buildAegisQbrData(
  score: AegisScorePayload,
  findings: AegisSecurityFinding[],
  previousQbrDate?: string,
): AegisQbrData {
  const unresolvedFindings = findings.filter((f) => f.resolvedAt === null);
  const resolvedSinceLastQbr = previousQbrDate
    ? findings.filter(
        (f) => f.resolvedAt !== null && f.resolvedAt > previousQbrDate,
      ).length
    : 0;

  return {
    score,
    findings: filterFindingsForQbr(findings),
    unresolvedCount: unresolvedFindings.length,
    resolvedSinceLastQbr,
  };
}
