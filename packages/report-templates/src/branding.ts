/**
 * Default branding configurations for known tenants.
 * Partners can extend this via tenant config in the database.
 */

import type { TenantBranding } from "./types";

export const DIT_BRANDING: TenantBranding = {
  brandKey: "dit",
  companyName: "Dedicated IT",
  website: "dedicatedit.com",
  copyrightHolder: "Dedicated IT",
  primaryColor: "135CFD",
  accentColor: "3CEEB6",
  stack: {
    psa: "ConnectWise Manage",
    rmm: "NinjaRMM",
    edr: "SentinelOne EDR/MDR/SOC",
    itdr: "Huntress ITDR",
    mfa: "Cisco Duo",
    dns: "Umbrella / Atakama",
    backup: "NinjaRMM Backup",
    securityCenter: "M365 Security Center",
  },
};

export const CAVARIDGE_BRANDING: TenantBranding = {
  brandKey: "cavaridge",
  companyName: "Cavaridge, LLC",
  website: "cavaridge.com",
  copyrightHolder: "Cavaridge, LLC",
  footerTagline: "Powered by Ducky Intelligence",
  primaryColor: "7C8DBF",
  accentColor: "D4A557",
  stack: {
    psa: "Salesforce",
    rmm: "RMM (TBD)",
    edr: "Guardz + SentinelOne (when needed)",
    itdr: "Huntress ITDR",
    mfa: "Cisco Duo",
    dns: "Atakama",
    backup: "RMM (TBD) Backup",
    securityCenter: "M365 Security Center",
  },
};

/** Lookup default branding by key */
export function getDefaultBranding(brandKey: string): TenantBranding | undefined {
  const defaults: Record<string, TenantBranding> = {
    dit: DIT_BRANDING,
    cavaridge: CAVARIDGE_BRANDING,
  };
  return defaults[brandKey];
}
