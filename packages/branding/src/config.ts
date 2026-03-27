import type { TenantBranding, AppBranding } from "./types";
import { DUCKY_MASCOT_SVG_LIGHT, DUCKY_FAVICON_SVG } from "./assets/ducky-mascot";
import {
  CERES_FREQUENCY_FAVICON,
  CERES_UTILIZATION_FAVICON,
  CERES_OASIS_FAVICON,
  CERES_DISCIPLINE_FAVICON,
  CERES_COMPLIANCE_FAVICON,
} from "./assets/favicons";

// ── Default Cavaridge platform branding ──────────────────────────────

export const DEFAULT_BRANDING: TenantBranding = {
  tenantId: "cavaridge",
  name: "Cavaridge",
  mascot: {
    svgContent: DUCKY_MASCOT_SVG_LIGHT,
    alt: "Ducky — Cavaridge Intelligence mascot",
  },
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {},
  },
  colors: {
    primary: "#2563EB",
    accent: "#F5A623",
    amber: "#F59E0B",
  },
  footer: {
    tagline: "Powered by Ducky Intelligence.",
    copyright: "Cavaridge, LLC",
  },
};

// ── Per-app branding configs ─────────────────────────────────────────

export const CERES_BRANDING: AppBranding = {
  appName: "Ceres",
  appDescription: "Free Nursing Toolkit",
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {
      "frequency-calculator": CERES_FREQUENCY_FAVICON,
      "utilization-calculator": CERES_UTILIZATION_FAVICON,
      "oasis-timing": CERES_OASIS_FAVICON,
      "discipline-planner": CERES_DISCIPLINE_FAVICON,
      "compliance-checklist": CERES_COMPLIANCE_FAVICON,
    },
  },
};

export const CAELUM_BRANDING: AppBranding = {
  appName: "Caelum",
  appDescription: "Statement of Work Builder",
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {},
  },
};

export const HIPAA_BRANDING: AppBranding = {
  appName: "HIPAA Risk Assessment",
  appDescription: "Healthcare Compliance Assessments",
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {},
  },
};

export const FORGE_BRANDING: AppBranding = {
  appName: "Forge",
  appDescription: "Autonomous Content Creation Platform",
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {},
  },
};

export const AEGIS_BRANDING: AppBranding = {
  appName: "Aegis",
  appDescription: "Security Posture & Browser Security Platform",
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {},
  },
};

export const MERIDIAN_BRANDING: AppBranding = {
  appName: "Meridian",
  appDescription: "M&A IT Intelligence Platform",
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {},
  },
};

export const MIDAS_BRANDING: AppBranding = {
  appName: "Midas",
  appDescription: "IT Roadmap / QBR Platform",
  favicon: {
    default: DUCKY_FAVICON_SVG,
    tools: {},
  },
};

/**
 * Resolve app branding by merging app-specific overrides onto the
 * default tenant branding. Apps call this once at startup.
 */
export function resolveBranding(
  appBranding: AppBranding,
  tenantOverride?: Partial<TenantBranding>,
): TenantBranding & { appName: string; appDescription: string } {
  const base = { ...DEFAULT_BRANDING, ...tenantOverride };
  return {
    ...base,
    appName: appBranding.appName,
    appDescription: appBranding.appDescription,
    mascot: tenantOverride?.mascot ?? base.mascot,
    favicon: {
      default: appBranding.favicon.default,
      tools: { ...appBranding.favicon.tools },
    },
    colors: { ...base.colors, ...tenantOverride?.colors },
    footer: { ...base.footer, ...tenantOverride?.footer },
  };
}
