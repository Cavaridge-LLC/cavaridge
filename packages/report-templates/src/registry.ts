/**
 * Template Registry — maps (reportType, tier, brand) to .pptx asset files.
 */

import path from "path";
import type { TemplateRegistryEntry, TemplateSelection, BrandKey } from "./types";

const ASSETS_DIR = path.resolve(__dirname, "../assets");

/** All registered templates */
export const TEMPLATE_REGISTRY: TemplateRegistryEntry[] = [
  // DIT
  { reportType: "qbr", tier: "smb",        brand: "dit", filename: "qbr-smb.pptx",        slideCount: 15, description: "DIT QBR — SMB (15 slides)" },
  { reportType: "qbr", tier: "enterprise",  brand: "dit", filename: "qbr-enterprise.pptx",  slideCount: 28, description: "DIT QBR — Enterprise (28 slides)" },
  { reportType: "abr", tier: "smb",        brand: "dit", filename: "abr-smb.pptx",        slideCount: 17, description: "DIT ABR — SMB (17 slides)" },
  { reportType: "abr", tier: "enterprise",  brand: "dit", filename: "abr-enterprise.pptx",  slideCount: 32, description: "DIT ABR — Enterprise (32 slides)" },
  // Cavaridge
  { reportType: "qbr", tier: "smb",        brand: "cavaridge", filename: "qbr-smb.pptx",        slideCount: 15, description: "Cavaridge QBR — SMB (15 slides)" },
  { reportType: "qbr", tier: "enterprise",  brand: "cavaridge", filename: "qbr-enterprise.pptx",  slideCount: 28, description: "Cavaridge QBR — Enterprise (28 slides)" },
  { reportType: "abr", tier: "smb",        brand: "cavaridge", filename: "abr-smb.pptx",        slideCount: 17, description: "Cavaridge ABR — SMB (17 slides)" },
  { reportType: "abr", tier: "enterprise",  brand: "cavaridge", filename: "abr-enterprise.pptx",  slideCount: 32, description: "Cavaridge ABR — Enterprise (32 slides)" },
];

/** Resolve the full path to a template .pptx file */
export function getTemplatePath(selection: TemplateSelection): string {
  const entry = TEMPLATE_REGISTRY.find(
    (t) =>
      t.reportType === selection.reportType &&
      t.tier === selection.tier &&
      t.brand === selection.brand,
  );
  if (!entry) {
    throw new Error(
      `No template found for ${selection.brand}/${selection.reportType}/${selection.tier}`,
    );
  }
  return path.join(ASSETS_DIR, selection.brand, entry.filename);
}

/** List all templates for a given brand */
export function getTemplatesForBrand(brand: BrandKey): TemplateRegistryEntry[] {
  return TEMPLATE_REGISTRY.filter((t) => t.brand === brand);
}

/** List all available brands */
export function getAvailableBrands(): BrandKey[] {
  return [...new Set(TEMPLATE_REGISTRY.map((t) => t.brand))];
}
