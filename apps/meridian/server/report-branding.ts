import { storage } from "./storage";
import type { OrganizationBranding } from "@shared/schema";

export interface ReportBranding {
  companyName: string;
  logoUrl: string | null;
  logoWidthPx: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  reportHeaderText: string;
  reportFooterText: string;
  confidentialityNotice: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  showMeridianBadge: boolean;
  customCoverPage: boolean;
  useTextLogo: boolean;
}

const MERIDIAN_DEFAULTS: ReportBranding = {
  companyName: "MERIDIAN",
  logoUrl: null,
  logoWidthPx: 200,
  primaryColor: "#1a56db",
  secondaryColor: "#6b7280",
  accentColor: "#059669",
  reportHeaderText: "IT Due Diligence Assessment",
  reportFooterText: "Prepared by MERIDIAN",
  confidentialityNotice: "CONFIDENTIAL — For intended recipients only.",
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  website: null,
  showMeridianBadge: true,
  customCoverPage: false,
  useTextLogo: true,
};

export async function getBrandingForReport(tenantId: string): Promise<ReportBranding> {
  const branding = await storage.getBranding(tenantId);

  if (!branding) {
    return { ...MERIDIAN_DEFAULTS };
  }

  const hasLogo = !!branding.logoUrl;

  return {
    companyName: branding.companyName || MERIDIAN_DEFAULTS.companyName,
    logoUrl: branding.logoUrl || null,
    logoWidthPx: branding.logoWidthPx ?? MERIDIAN_DEFAULTS.logoWidthPx,
    primaryColor: branding.primaryColor || MERIDIAN_DEFAULTS.primaryColor,
    secondaryColor: branding.secondaryColor || MERIDIAN_DEFAULTS.secondaryColor,
    accentColor: branding.accentColor || MERIDIAN_DEFAULTS.accentColor,
    reportHeaderText: branding.reportHeaderText || MERIDIAN_DEFAULTS.reportHeaderText,
    reportFooterText: branding.reportFooterText || MERIDIAN_DEFAULTS.reportFooterText,
    confidentialityNotice: branding.confidentialityNotice || MERIDIAN_DEFAULTS.confidentialityNotice,
    contactName: branding.contactName || null,
    contactEmail: branding.contactEmail || null,
    contactPhone: branding.contactPhone || null,
    website: branding.website || null,
    showMeridianBadge: branding.showMeridianBadge ?? MERIDIAN_DEFAULTS.showMeridianBadge,
    customCoverPage: branding.customCoverPage ?? MERIDIAN_DEFAULTS.customCoverPage,
    useTextLogo: !hasLogo,
  };
}
