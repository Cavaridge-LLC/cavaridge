import { DEFAULT_BRANDING, CERES_BRANDING, resolveBranding } from "@cavaridge/branding";

/** Resolved Ceres branding — merges app config onto default Cavaridge tenant. */
export const RESOLVED_BRANDING = resolveBranding(CERES_BRANDING);

/**
 * Legacy BRANDING constant — existing Ceres pages import from here.
 * Delegates to @cavaridge/branding so values stay in sync.
 */
export const BRANDING = {
  parentCompany: DEFAULT_BRANDING.footer.copyright,
  appName: CERES_BRANDING.appName,
  appDescription: CERES_BRANDING.appDescription,
  duckyIntelligence: "Ducky Intelligence",
  duckyFooter: DEFAULT_BRANDING.footer.tagline,
} as const;
