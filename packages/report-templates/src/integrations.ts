/**
 * Cross-app integration types for QBR/ABR templates.
 *
 * Midas → Caelum: QBR roadmap gaps become SoW line items
 * Midas → Cavalier: Partners distribute branded templates to their clients
 * AEGIS → Midas: Security findings feed QBR security section
 */

// ── Midas → Caelum: QBR-to-SoW Pipeline ───────────────────────────

/**
 * A roadmap item from a QBR that can be converted into a SoW line item.
 * Caelum imports this type to ingest QBR recommendations as SoW sections.
 */
export interface QbrToSowItem {
  /** Source QBR client ID */
  sourceClientId: string;
  /** Source QBR generation timestamp */
  sourceQbrDate: string;
  /** Roadmap item title → becomes SoW section heading */
  title: string;
  /** Priority from QBR → maps to SoW urgency */
  priority: "Critical" | "High" | "Medium" | "Low";
  /** Current status */
  status: string;
  /** Target quarter */
  quarter: string;
  /** Estimated cost range from QBR */
  estimatedCost?: string;
  /** Business problem statement → becomes SoW justification */
  businessProblem?: string;
  /** Security category (if from security gap) */
  securityCategory?: string;
  /** Points at stake (if from security gap) */
  securityPointsAtStake?: number;
  /** Source: manual roadmap item or security gap */
  source: "manual" | "security_gap";
}

/**
 * Convert QBR roadmap items into Caelum SoW-ingestible format.
 */
export function qbrItemsToSowItems(
  clientId: string,
  qbrDate: string,
  roadmapItems: Array<{
    title: string;
    status: string;
    priority: string;
    quarter: string;
    cost?: string;
    businessProblem?: string;
    source?: string;
    controlId?: string;
    category?: string;
    pointsAtStake?: number;
  }>,
): QbrToSowItem[] {
  return roadmapItems
    .filter((item) => item.status !== "Completed")
    .map((item) => ({
      sourceClientId: clientId,
      sourceQbrDate: qbrDate,
      title: item.title,
      priority: (item.priority as QbrToSowItem["priority"]) || "Medium",
      status: item.status,
      quarter: item.quarter,
      estimatedCost: item.cost,
      businessProblem: item.businessProblem,
      securityCategory: item.category,
      securityPointsAtStake: item.pointsAtStake,
      source: item.source === "security_gap" ? "security_gap" : "manual",
    }));
}

// ── Midas → Cavalier: Partner Template Config ──────────────────────

/**
 * Configuration for how a Cavalier partner distributes
 * QBR/ABR templates to their clients.
 */
export interface PartnerTemplateConfig {
  /** Partner's tenant ID */
  tenantId: string;
  /** Brand key (maps to template set) */
  brandKey: string;
  /** Default report tier for this partner's clients */
  defaultTier: "smb" | "enterprise";
  /** Whether partner can access ABR templates */
  abrEnabled: boolean;
  /** Custom stack overrides (partner may use different tools) */
  stackOverrides?: Partial<{
    psa: string;
    rmm: string;
    edr: string;
    itdr: string;
    mfa: string;
    dns: string;
  }>;
  /** Whether partner can download blank templates for manual fill */
  manualTemplateAccess: boolean;
  /** Whether partner can use the hydration engine (requires data integration) */
  automatedExportAccess: boolean;
}

// ── AEGIS → Midas: Security Findings ───────────────────────────────

/**
 * Security finding from AEGIS that feeds into the QBR security section.
 * Midas imports AEGIS findings to populate the Cavaridge Adjusted Score.
 */
export interface AegisSecurityFinding {
  /** AEGIS finding ID */
  findingId: string;
  /** Client tenant ID */
  clientTenantId: string;
  /** Finding category */
  category: string;
  /** Severity */
  severity: "critical" | "high" | "medium" | "low" | "info";
  /** Finding title */
  title: string;
  /** Description */
  description: string;
  /** Remediation recommendation */
  remediation: string;
  /** Score impact (points at stake) */
  scoreImpact: number;
  /** Source system */
  source: "sentinelone" | "huntress" | "guardz" | "atakama" | "duo" | "m365" | "extension";
  /** Detection timestamp */
  detectedAt: string;
}
