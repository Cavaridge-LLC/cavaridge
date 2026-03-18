/**
 * @deprecated Use getTenantConfig() from tenantConfigLoader.ts instead.
 * This static config exists only for backward compatibility with code paths
 * that haven't yet migrated to DB-driven tenant config. DIT values here
 * are defaults for the seed tenant — not hardcoded business logic.
 */
export const tenantConfig = {
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
  ] as const,

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

export function buildRateCardString(): string {
  return tenantConfig.rateCard
    .map((r) => `${r.role} $${r.rate}/hr`)
    .join(", ");
}

export function buildRoleEnum(): string {
  return tenantConfig.rateCard.map((r) => r.role).join(" | ");
}

export function buildRateDescription(): string {
  return tenantConfig.rateCard
    .map((r) => `${r.role}=${r.rate}`)
    .join(", ");
}
