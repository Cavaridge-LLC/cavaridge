/**
 * @cavaridge/report-templates
 *
 * QBR/ABR branded PPTX templates with hydration engine.
 *
 * Usage:
 *   import { hydrateReport, getTemplatePath, DIT_BRANDING } from "@cavaridge/report-templates";
 *
 *   // Option 1: Generate programmatically from data
 *   const pptx = hydrateReport({ template, branding, clientName, ... });
 *   const buffer = await pptx.write({ outputType: "nodebuffer" });
 *
 *   // Option 2: Serve a pre-built template for manual fill
 *   const templatePath = getTemplatePath({ reportType: "qbr", tier: "smb", brand: "dit" });
 */

// Types
export type {
  ReportType,
  ReportTier,
  BrandKey,
  TemplateSelection,
  TenantBranding,
  TenantStack,
  JourneyMetric,
  JourneyData,
  QbrHydrationInput,
  TemplateRegistryEntry,
} from "./types";

// Registry
export {
  TEMPLATE_REGISTRY,
  getTemplatePath,
  getTemplatesForBrand,
  getAvailableBrands,
} from "./registry";

// Branding
export {
  DIT_BRANDING,
  CAVARIDGE_BRANDING,
  getDefaultBranding,
} from "./branding";

// Hydration Engine
export { hydrateReport } from "./hydrate";

// Cross-app Integrations
export type {
  QbrToSowItem,
  PartnerTemplateConfig,
  AegisSecurityFinding,
} from "./integrations";
export { qbrItemsToSowItems } from "./integrations";
