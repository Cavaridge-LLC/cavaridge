/**
 * CVG-AEGIS — Compensating Controls Engine
 *
 * Manages detection and evaluation of compensating security controls
 * (SentinelOne, Duo, Proofpoint, etc.) that suppress or downgrade risk flags.
 *
 * Auto-detected via tenant-intel signals or manually overridden by MSP Admin.
 * Feeds into both:
 *   - Cavaridge Adjusted Score (bonus points)
 *   - IAR Contextual Intelligence Engine (flag suppression)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ControlDefinition {
  controlType: string;
  name: string;
  vendor: string;
  description: string;
  category: "mfa" | "endpoint" | "email" | "identity" | "network" | "dlp" | "backup";
  defaultBonusPoints: number;
  /** IAR flag types this control can suppress or downgrade */
  flagSuppressions: FlagSuppression[];
  /** Signal sources used for auto-detection */
  detectionSignals: string[];
}

export interface FlagSuppression {
  flagType: string;
  action: "suppress" | "downgrade";
  /** Severity to downgrade to (only for action=downgrade) */
  targetSeverity?: "low" | "medium" | "info";
  reason: string;
}

export interface DetectedControl {
  controlType: string;
  name: string;
  vendor: string;
  isDetected: boolean;
  detectionMethod: "auto" | "manual";
  bonusPoints: number;
  flagSuppressions: FlagSuppression[];
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Default Controls Catalog
// ---------------------------------------------------------------------------

export const CONTROLS_CATALOG: ControlDefinition[] = [
  {
    controlType: "sentinelone_edr",
    name: "SentinelOne EDR",
    vendor: "SentinelOne",
    description: "Endpoint detection and response providing advanced threat protection",
    category: "endpoint",
    defaultBonusPoints: 1.5,
    flagSuppressions: [],
    detectionSignals: ["intune_inventory", "service_principals", "saas_discovery"],
  },
  {
    controlType: "crowdstrike_edr",
    name: "CrowdStrike Falcon",
    vendor: "CrowdStrike",
    description: "Cloud-native endpoint protection platform",
    category: "endpoint",
    defaultBonusPoints: 1.5,
    flagSuppressions: [],
    detectionSignals: ["intune_inventory", "service_principals"],
  },
  {
    controlType: "duo_mfa",
    name: "Duo Security MFA",
    vendor: "Cisco",
    description: "Multi-factor authentication across applications",
    category: "mfa",
    defaultBonusPoints: 2.0,
    flagSuppressions: [
      {
        flagType: "password_never_expires",
        action: "suppress",
        reason: "MFA enforced via Duo — password-only authentication mitigated per NIST 800-63B",
      },
      {
        flagType: "inactive_licensed_90d",
        action: "downgrade",
        targetSeverity: "low",
        reason: "MFA enforced — unauthorized access vector mitigated",
      },
    ],
    detectionSignals: ["service_principals", "conditional_access_policies"],
  },
  {
    controlType: "entra_id_mfa",
    name: "Entra ID MFA",
    vendor: "Microsoft",
    description: "Native Microsoft Entra ID multi-factor authentication",
    category: "mfa",
    defaultBonusPoints: 1.5,
    flagSuppressions: [
      {
        flagType: "password_never_expires",
        action: "suppress",
        reason: "MFA enforced via Entra ID — password-only attack vector mitigated per NIST 800-63B",
      },
      {
        flagType: "inactive_licensed_90d",
        action: "downgrade",
        targetSeverity: "low",
        reason: "MFA enforced — unauthorized access vector mitigated",
      },
    ],
    detectionSignals: ["conditional_access_policies", "auth_methods"],
  },
  {
    controlType: "proofpoint_email",
    name: "Proofpoint Email Security",
    vendor: "Proofpoint",
    description: "Advanced email threat protection and phishing prevention",
    category: "email",
    defaultBonusPoints: 1.0,
    flagSuppressions: [],
    detectionSignals: ["mx_records", "service_principals"],
  },
  {
    controlType: "conditional_access",
    name: "Conditional Access Policies",
    vendor: "Microsoft",
    description: "Azure AD / Entra ID conditional access policies enforcing sign-in requirements",
    category: "identity",
    defaultBonusPoints: 1.0,
    flagSuppressions: [
      {
        flagType: "password_never_expires",
        action: "suppress",
        reason: "Conditional Access policies enforce additional auth factors beyond password",
      },
    ],
    detectionSignals: ["conditional_access_policies"],
  },
  {
    controlType: "datto_backup",
    name: "Datto BCDR",
    vendor: "Kaseya",
    description: "Business continuity and disaster recovery with verified backup",
    category: "backup",
    defaultBonusPoints: 0.5,
    flagSuppressions: [],
    detectionSignals: ["saas_discovery", "service_principals"],
  },
  {
    controlType: "mimecast_email",
    name: "Mimecast Email Security",
    vendor: "Mimecast",
    description: "Cloud email security with advanced threat protection",
    category: "email",
    defaultBonusPoints: 1.0,
    flagSuppressions: [],
    detectionSignals: ["mx_records"],
  },
];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Evaluate which compensating controls are active for a tenant.
 * Merges auto-detected signals with manual overrides.
 */
export function evaluateCompensatingControls(
  autoDetected: Array<{ controlType: string; metadata?: Record<string, unknown> }>,
  manualOverrides: Array<{ controlType: string; enabled: boolean; bonusPoints?: number }>,
): DetectedControl[] {
  const results: DetectedControl[] = [];

  for (const definition of CONTROLS_CATALOG) {
    const autoMatch = autoDetected.find(d => d.controlType === definition.controlType);
    const manualOverride = manualOverrides.find(o => o.controlType === definition.controlType);

    // Manual override takes precedence
    if (manualOverride !== undefined) {
      results.push({
        controlType: definition.controlType,
        name: definition.name,
        vendor: definition.vendor,
        isDetected: manualOverride.enabled,
        detectionMethod: "manual",
        bonusPoints: manualOverride.enabled
          ? (manualOverride.bonusPoints ?? definition.defaultBonusPoints)
          : 0,
        flagSuppressions: manualOverride.enabled ? definition.flagSuppressions : [],
        metadata: autoMatch?.metadata ?? {},
      });
    } else if (autoMatch) {
      results.push({
        controlType: definition.controlType,
        name: definition.name,
        vendor: definition.vendor,
        isDetected: true,
        detectionMethod: "auto",
        bonusPoints: definition.defaultBonusPoints,
        flagSuppressions: definition.flagSuppressions,
        metadata: autoMatch.metadata ?? {},
      });
    } else {
      results.push({
        controlType: definition.controlType,
        name: definition.name,
        vendor: definition.vendor,
        isDetected: false,
        detectionMethod: "auto",
        bonusPoints: 0,
        flagSuppressions: [],
        metadata: {},
      });
    }
  }

  return results;
}

/**
 * Get the total compensating controls bonus, capped at maxBonus.
 */
export function calculateCompensatingBonus(
  controls: DetectedControl[],
  maxBonus: number = 5,
): number {
  const total = controls
    .filter(c => c.isDetected)
    .reduce((sum, c) => sum + c.bonusPoints, 0);
  return Math.min(maxBonus, Math.round(total * 10) / 10);
}

/**
 * Get all flag suppressions from active controls.
 */
export function getActiveSuppressions(controls: DetectedControl[]): FlagSuppression[] {
  return controls
    .filter(c => c.isDetected)
    .flatMap(c => c.flagSuppressions);
}

/**
 * Get the catalog of all available compensating controls.
 */
export function getControlsCatalog(): ControlDefinition[] {
  return CONTROLS_CATALOG;
}
