/**
 * Forge shared branding constants.
 *
 * vendorName/vendorAbbreviation are defaults used when tenant config
 * hasn't loaded yet. At runtime, prefer values from the tenant config API.
 *
 * Ducky Intelligence branding persists across ALL tenant instances per the
 * "Intel Inside" model — tenants control app skin but not the AI companion.
 */
export const BRANDING = {
  /** Default vendor branding — overridden by tenant config at runtime */
  vendorName: "Dedicated IT",
  vendorAbbreviation: "DIT",
  parentCompany: "Cavaridge, LLC",
  appName: "Forge",
  appTagline: "Describe it. Forge builds it.",
  /** Ducky Intelligence branding — persists across ALL tenant instances */
  duckyIntelligence: "Ducky Intelligence",
  duckyFooter: "Powered by Ducky Intelligence.",
} as const;
