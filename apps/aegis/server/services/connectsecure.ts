/**
 * CVG-AEGIS — ConnectSecure Integration
 *
 * Data model and API stubs for ingesting ConnectSecure vulnerability scan data.
 * Maps ConnectSecure findings to AEGIS internal risk model.
 *
 * Phase 1: API stubs with type definitions.
 * Phase 2: Full ConnectSecure API integration.
 */

// ---------------------------------------------------------------------------
// ConnectSecure API Types (external)
// ---------------------------------------------------------------------------

export interface ConnectSecureVulnerability {
  id: string;
  cve?: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  cvssScore?: number;
  affectedAsset: string;
  assetType: "workstation" | "server" | "network_device" | "cloud_resource";
  firstDetected: string;
  lastDetected: string;
  status: "open" | "remediated" | "accepted" | "false_positive";
  remediationSteps?: string;
}

export interface ConnectSecureComplianceResult {
  frameworkId: string;
  frameworkName: string;
  controlId: string;
  controlName: string;
  status: "pass" | "fail" | "partial" | "not_applicable";
  evidence?: string;
  checkedAt: string;
}

export interface ConnectSecureScanPayload {
  scanId: string;
  scanType: "vulnerability" | "compliance" | "full";
  target: string;
  status: "completed" | "failed" | "partial";
  scannedAt: string;
  vulnerabilities: ConnectSecureVulnerability[];
  complianceResults: ConnectSecureComplianceResult[];
  summary: {
    totalAssets: number;
    totalVulnerabilities: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    complianceScore: number;
  };
}

// ---------------------------------------------------------------------------
// Internal Risk Model Mapping
// ---------------------------------------------------------------------------

export interface AegisRiskFinding {
  source: "connectsecure";
  sourceId: string;
  type: "vulnerability" | "compliance_gap" | "configuration";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  affectedAsset: string;
  cvssScore: number | null;
  cve: string | null;
  frameworkMapping: string[];
  remediationPriority: number;
  metadata: Record<string, unknown>;
}

/**
 * Map ConnectSecure severity to AEGIS internal severity.
 */
function mapSeverity(csSeverity: string): AegisRiskFinding["severity"] {
  switch (csSeverity) {
    case "critical": return "critical";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    default: return "info";
  }
}

/**
 * Calculate remediation priority score (0-100, higher = more urgent).
 */
function calculatePriority(vuln: ConnectSecureVulnerability): number {
  let priority = 0;

  // CVSS score contribution (0-40)
  if (vuln.cvssScore) {
    priority += (vuln.cvssScore / 10) * 40;
  }

  // Severity contribution (0-30)
  const severityScores: Record<string, number> = {
    critical: 30, high: 20, medium: 10, low: 5, informational: 0,
  };
  priority += severityScores[vuln.severity] ?? 0;

  // Asset type contribution (0-20)
  const assetScores: Record<string, number> = {
    server: 20, cloud_resource: 15, network_device: 10, workstation: 5,
  };
  priority += assetScores[vuln.assetType] ?? 0;

  // Age penalty (0-10) — older vulns get higher priority
  const daysSinceDetected = Math.floor(
    (Date.now() - new Date(vuln.firstDetected).getTime()) / (1000 * 60 * 60 * 24)
  );
  priority += Math.min(10, daysSinceDetected / 30 * 10);

  return Math.min(100, Math.round(priority));
}

/**
 * Map ConnectSecure scan data to AEGIS internal risk model.
 */
export function mapToAegisRiskModel(payload: ConnectSecureScanPayload): AegisRiskFinding[] {
  const findings: AegisRiskFinding[] = [];

  // Map vulnerabilities
  for (const vuln of payload.vulnerabilities) {
    if (vuln.status === "remediated" || vuln.status === "false_positive") continue;

    findings.push({
      source: "connectsecure",
      sourceId: vuln.id,
      type: "vulnerability",
      severity: mapSeverity(vuln.severity),
      title: vuln.title,
      description: vuln.description,
      affectedAsset: vuln.affectedAsset,
      cvssScore: vuln.cvssScore ?? null,
      cve: vuln.cve ?? null,
      frameworkMapping: mapToFrameworks(vuln),
      remediationPriority: calculatePriority(vuln),
      metadata: {
        assetType: vuln.assetType,
        firstDetected: vuln.firstDetected,
        lastDetected: vuln.lastDetected,
        remediationSteps: vuln.remediationSteps,
      },
    });
  }

  // Map compliance gaps
  for (const compliance of payload.complianceResults) {
    if (compliance.status === "pass" || compliance.status === "not_applicable") continue;

    findings.push({
      source: "connectsecure",
      sourceId: `${compliance.frameworkId}:${compliance.controlId}`,
      type: "compliance_gap",
      severity: compliance.status === "fail" ? "high" : "medium",
      title: `${compliance.frameworkName} — ${compliance.controlId}: ${compliance.controlName}`,
      description: `Compliance check ${compliance.status} for ${compliance.controlName}.`,
      affectedAsset: payload.target,
      cvssScore: null,
      cve: null,
      frameworkMapping: [compliance.frameworkId],
      remediationPriority: compliance.status === "fail" ? 70 : 40,
      metadata: {
        frameworkId: compliance.frameworkId,
        controlId: compliance.controlId,
        evidence: compliance.evidence,
        checkedAt: compliance.checkedAt,
      },
    });
  }

  return findings.sort((a, b) => b.remediationPriority - a.remediationPriority);
}

/**
 * Map vulnerability to compliance frameworks based on type.
 */
function mapToFrameworks(vuln: ConnectSecureVulnerability): string[] {
  const frameworks: string[] = [];

  // All vulnerabilities map to NIST CSF
  frameworks.push("NIST-CSF");

  // Severity-based mapping
  if (vuln.severity === "critical" || vuln.severity === "high") {
    frameworks.push("CIS-Controls-v8");
  }

  // Asset-type based mapping
  if (vuln.assetType === "server" || vuln.assetType === "cloud_resource") {
    frameworks.push("SOC2");
  }

  return frameworks;
}

/**
 * Calculate a composite risk score from ConnectSecure data (0-100, lower = more risky).
 * Used to feed into the Cavaridge Adjusted Score.
 */
export function calculateConnectSecureRiskScore(payload: ConnectSecureScanPayload): number {
  if (payload.summary.totalAssets === 0) return 50; // No data

  let score = 100;

  // Penalty for open vulnerabilities (per asset)
  const vulnPerAsset = payload.summary.totalVulnerabilities / Math.max(1, payload.summary.totalAssets);
  score -= Math.min(30, vulnPerAsset * 5);

  // Severity penalties
  score -= payload.summary.criticalCount * 10;
  score -= payload.summary.highCount * 5;
  score -= payload.summary.mediumCount * 2;
  score -= payload.summary.lowCount * 0.5;

  // Compliance score contribution
  score = score * 0.7 + payload.summary.complianceScore * 0.3;

  return Math.max(0, Math.min(100, Math.round(score)));
}
