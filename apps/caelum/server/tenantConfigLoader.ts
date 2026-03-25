import { db } from "./db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface TenantConfig {
  vendorName: string;
  vendorAbbreviation: string;
  parentCompany: string;
  appName: string;
  confidentialFooter: string;
  vendorSignatureLabel: string;
  rateCard: { role: string; rate: number }[];
  mandatoryPmTasks: string[];
  scopeTypeAddOns: string[];
}

/**
 * Fallback config used when a tenant has no configJson or is missing fields.
 * Matches the "dedicated-it" seed tenant. In production, every MSP tenant
 * should have their own config stored in tenants.config_json.
 *
 * DIT is an MSP tenant, not hardcoded — these defaults exist solely as
 * a safety net for the seed/development environment.
 */
const FALLBACK_CONFIG: TenantConfig = {
  vendorName: "Dedicated IT",
  vendorAbbreviation: "DIT",
  parentCompany: "Cavaridge, LLC",
  appName: "Caelum",
  confidentialFooter: "Dedicated IT — Confidential",
  vendorSignatureLabel: "Dedicated IT Representative:",
  rateCard: [
    { role: "Executive/Shareholder", rate: 285 },
    { role: "Architect", rate: 225 },
    { role: "Systems Engineer", rate: 185 },
    { role: "Security Engineer", rate: 225 },
    { role: "Project Manager", rate: 185 },
    { role: "Network Technician", rate: 185 },
    { role: "Field Technician", rate: 185 },
  ],
  mandatoryPmTasks: [
    "Provide project plan with milestones (if applicable) and estimated time of completion.",
    "Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed upon intervals established during project kickoff meeting.",
    "Remove old documentation references and update documentation to reflect new configurations.",
  ],
  scopeTypeAddOns: [
    "Network Deployment: Include cloud check-in dependency, cutover window + rollback posture, site connectivity vendors",
    "Onboarding & Stabilization: Include \"Covered Under Activation\" section in summary, map completion criteria to: Managed Support, Security, M365, Data Protection, Printers, Endpoints, Documentation",
    "Endpoint Deployment: Include device counts, naming conventions, enrollment method, training/handoff line items",
    "Virtualization & Recovery: Include per-interface breakdown, discovery phase, acceptance criteria proving operational equivalence",
  ],
};

const configCache = new Map<string, { config: TenantConfig; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const cached = configCache.get(tenantId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  // Cast: cross-package drizzle-orm type mismatch (different @types/pg resolutions)
  const [tenant] = await db.select().from(tenants as any).where(eq((tenants as any).id, tenantId));
  if (!tenant || !(tenant as any).config || typeof (tenant as any).config !== "object") {
    return FALLBACK_CONFIG;
  }

  const json = (tenant as any).config as Record<string, any>;
  const config: TenantConfig = {
    vendorName: json.vendorName || FALLBACK_CONFIG.vendorName,
    vendorAbbreviation: json.vendorAbbreviation || FALLBACK_CONFIG.vendorAbbreviation,
    parentCompany: json.parentCompany || FALLBACK_CONFIG.parentCompany,
    appName: json.appName || FALLBACK_CONFIG.appName,
    confidentialFooter: json.confidentialFooter || FALLBACK_CONFIG.confidentialFooter,
    vendorSignatureLabel: json.vendorSignatureLabel || FALLBACK_CONFIG.vendorSignatureLabel,
    rateCard: Array.isArray(json.rateCard) ? json.rateCard : FALLBACK_CONFIG.rateCard,
    mandatoryPmTasks: Array.isArray(json.mandatoryPmTasks) ? json.mandatoryPmTasks : FALLBACK_CONFIG.mandatoryPmTasks,
    scopeTypeAddOns: Array.isArray(json.scopeTypeAddOns) ? json.scopeTypeAddOns : FALLBACK_CONFIG.scopeTypeAddOns,
  };

  configCache.set(tenantId, { config, loadedAt: Date.now() });
  return config;
}

export function buildRateCardStringFromConfig(config: TenantConfig): string {
  return config.rateCard.map((r) => `${r.role} $${r.rate}/hr`).join(", ");
}

export function buildRoleEnumFromConfig(config: TenantConfig): string {
  return config.rateCard.map((r) => r.role).join(" | ");
}

export function buildRateDescriptionFromConfig(config: TenantConfig): string {
  return config.rateCard.map((r) => `${r.role}=${r.rate}`).join(", ");
}

export function clearTenantConfigCache(tenantId?: string) {
  if (tenantId) {
    configCache.delete(tenantId);
  } else {
    configCache.clear();
  }
}
