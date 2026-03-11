/**
 * Caelum Statement of Work — Canonical Data Model v2.0
 * Spec: SOW-MASTER-SPEC-v2.0.md (2026-03-10)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 *
 * This interface is the single source of truth for all SoW data flowing
 * through Caelum. The export generators (DOCX, Markdown) consume this shape.
 * A normalization layer maps legacy sowJson payloads into this structure.
 * Provider name and branding are resolved per-tenant via tenantConfig.
 */

// ────────────────────────────────────────────────────────────
// Cover
// ────────────────────────────────────────────────────────────

export interface SowCover {
  client: string;
  facility?: string;
  projectName: string;
  provider: string; // Resolved from tenantConfig.vendorName
  billingModel: "Fixed-Fee" | "Time & Materials" | "Hybrid (Fixed + T&M)";
  documentDate: string; // ISO date or display string
  version: string; // e.g. "1.0"
  classification: string; // Default: "Confidential"
  quoteNumber?: string;
  expirationDate?: string;
}

// ────────────────────────────────────────────────────────────
// Section 2: Proposed Solution
// ────────────────────────────────────────────────────────────

export interface SowSubsection {
  number: string; // e.g. "2.1"
  title: string;
  narrative: string;
}

export interface SowComponentRow {
  component: string;
  description: string;
}

export interface SowLineItem {
  description: string;
  unitPrice: number;
  qty: number;
  extPrice: number;
}

export interface SowProposedSolution {
  overview: string;
  subsections?: SowSubsection[];
  componentsTable?: SowComponentRow[];
  includedItemsTable?: SowLineItem[];
  keyDeliverables?: string[];
  exclusionNotes?: string[];
}

// ────────────────────────────────────────────────────────────
// Section 4: Project Management
// ────────────────────────────────────────────────────────────

export interface SowContact {
  role: string; // e.g. "Client Point of Contact", "GC", "ISP Broker"
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface SowProjectManagement {
  siteAddress?: string;
  contacts?: SowContact[];
  pmTasks: string[]; // First 3 are mandatory verbatim
}

// ────────────────────────────────────────────────────────────
// Section 5: Phases
// ────────────────────────────────────────────────────────────

export interface SowPhase {
  number: number;
  title: string;
  estimatedHours: number;
  objective: string;
  tasks: string[];
  deliverables: string[];
}

// ────────────────────────────────────────────────────────────
// Section 6: Caveats & Risks
// ────────────────────────────────────────────────────────────

export interface SowRisk {
  risk: string;
  impact: string;
  mitigation: string;
}

export interface SowCaveatsRisks {
  exclusions: string[];
  assumptions: string[];
  risks: SowRisk[];
  changeControl: string;
}

// ────────────────────────────────────────────────────────────
// Section 8: Approval
// ────────────────────────────────────────────────────────────

export interface SowQuoteLine {
  description: string;
  amount: string;
}

export interface SowApproval {
  preamble?: string;
  quoteSummary?: SowQuoteLine[];
  clientEntity: string;
  clientSignerName?: string;
  clientSignerTitle?: string;
  providerEntity: string; // Resolved from tenantConfig.vendorName
  providerSignerName?: string;
  providerSignerTitle?: string;
}

// ────────────────────────────────────────────────────────────
// Section 9: Labor Hours
// ────────────────────────────────────────────────────────────

export interface SowLaborRowMultiRole {
  phase: string;
  standardHours?: number;
  seniorHours?: number;
  emergencyHours?: number;
  totalHours: number;
  estCost: number;
}

export interface SowLaborRowSingleRole {
  phase: string;
  hours: number;
  role: string;
  rate: number;
}

export interface SowLaborHours {
  format: "multi_role" | "single_role";
  rates?: {
    standard: number; // Default 185
    senior: number; // Default 225
    emergency: number; // Default 285
  };
  rows: (SowLaborRowMultiRole | SowLaborRowSingleRole)[];
  notes?: string[];
}

// ────────────────────────────────────────────────────────────
// Full SoW Document (v2.0 canonical shape)
// ────────────────────────────────────────────────────────────

export interface SowDocumentV2 {
  cover: SowCover;
  summary: string;
  summaryBoundaryNote?: string;
  proposedSolution: SowProposedSolution;
  prerequisites: string[];
  projectManagement: SowProjectManagement;
  phases: SowPhase[];
  caveatsRisks: SowCaveatsRisks;
  completionCriteria: string[];
  approval: SowApproval;
  laborHours: SowLaborHours;
}

// ────────────────────────────────────────────────────────────
// Legacy normalization
// ────────────────────────────────────────────────────────────

/**
 * Converts the existing ad-hoc sowJson shape into the v2.0 canonical model.
 * Handles missing fields gracefully with sensible defaults.
 */
export function normalizeSowJson(raw: any, vendorName = "[Provider]"): SowDocumentV2 {
  // --- Cover ---
  const cover: SowCover = {
    client: raw.clientName || raw.cover?.client || raw.title?.split(" - ")[0]?.trim() || "[Client]",
    facility: raw.cover?.facility,
    projectName: raw.title || raw.cover?.projectName || "[Project Name]",
    provider: vendorName,
    billingModel: raw.cover?.billingModel || raw.billingModel || "Time & Materials",
    documentDate: raw.cover?.documentDate || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    version: raw.cover?.version || "1.0",
    classification: raw.cover?.classification || "Confidential",
    quoteNumber: raw.cover?.quoteNumber || raw.quoteNumber,
    expirationDate: raw.cover?.expirationDate,
  };

  // --- Summary ---
  const summary = raw.summary || "";
  const summaryBoundaryNote = raw.summaryBoundaryNote || raw.scopeBoundaryNote;

  // --- Proposed Solution ---
  const proposedSolution: SowProposedSolution = {
    overview: raw.solution || raw.proposedSolution?.overview || "",
    subsections: raw.proposedSolution?.subsections,
    componentsTable: raw.proposedSolution?.componentsTable,
    includedItemsTable: raw.proposedSolution?.includedItemsTable,
    keyDeliverables: raw.proposedSolution?.keyDeliverables,
    exclusionNotes: raw.proposedSolution?.exclusionNotes,
  };

  // --- Prerequisites (merge legacy dependencies) ---
  let prerequisites: string[] = [];
  if (Array.isArray(raw.prerequisites)) {
    prerequisites = raw.prerequisites;
  } else if (raw.prerequisites) {
    const cr = raw.prerequisites.clientResponsibilities || [];
    const vr = raw.prerequisites.vendorResponsibilities || [];
    const tp = raw.prerequisites.thirdPartyResponsibilities || [];
    prerequisites = [...cr, ...vr, ...tp];
  }
  if (raw.accessPrerequisites?.length) {
    prerequisites = [...raw.accessPrerequisites, ...prerequisites];
  }
  if (raw.dependencies?.length) {
    prerequisites = [...prerequisites, ...raw.dependencies];
  }

  // --- PM ---
  const mandatoryTasks = [
    "Provide project plan with milestones (if milestones applicable) and estimated time of completion.",
    "Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.",
    "Remove old documentation references and update documentation to reflect new configurations.",
  ];
  const extraTasks = (raw.projectManagement?.tasks || []).filter(
    (t: string) => !mandatoryTasks.some((m) => t.toLowerCase().includes(m.substring(0, 30).toLowerCase()))
  );
  const projectManagement: SowProjectManagement = {
    siteAddress: raw.projectManagement?.siteAddress,
    contacts: raw.projectManagement?.pocs?.map((p: string) => ({ role: "Contact", name: p })) || raw.projectManagement?.contacts,
    pmTasks: [...mandatoryTasks, ...extraTasks],
  };

  // --- Phases ---
  const phases: SowPhase[] = (raw.outline || raw.phases || []).map((p: any, i: number) => ({
    number: p.number || i + 1,
    title: (p.phase || p.title || p.name || "").replace(/^Phase\s+\d+[:\s]*/i, ""),
    estimatedHours: p.estimatedHours || p.hours || 0,
    objective: p.objective || "",
    tasks: p.tasks || [],
    deliverables: p.deliverables || [],
  }));

  // --- Caveats & Risks (merge legacy outOfScope, changeControl) ---
  const exclusions = [
    ...(raw.outOfScope || []),
    ...(raw.caveatsRisks?.exclusions || raw.caveatsAndRisks?.exclusions || []),
  ];
  const assumptions = raw.caveatsRisks?.assumptions || raw.caveatsAndRisks?.assumptions || [];
  const risks: SowRisk[] = (raw.caveatsRisks?.risks || raw.caveatsAndRisks?.risks || []).map((r: any) => ({
    risk: r.risk || r.title || r.name || "",
    impact: r.impact || "",
    mitigation: r.mitigation || r.mitigationDIT || r.vendorMitigation || r.mitigationVendor || "",
  }));
  const changeControl =
    raw.caveatsRisks?.changeControl ||
    raw.changeControl ||
    `This engagement is scoped as a ${cover.billingModel} project. Any work, equipment, or services not explicitly described in this document are considered out of scope. Out-of-scope requests identified during the engagement will be documented and presented to the client as a separate change order or scope of work for review and approval prior to execution.`;

  const caveatsRisks: SowCaveatsRisks = { exclusions, assumptions, risks, changeControl };

  // --- Completion Criteria ---
  const completionCriteria = raw.completionCriteria || [];

  // --- Approval ---
  const approval: SowApproval = {
    preamble: raw.approval && typeof raw.approval === "string" ? raw.approval : undefined,
    quoteSummary: raw.approval?.quoteSummary,
    clientEntity: cover.client,
    clientSignerName: raw.approval?.clientSignerName,
    clientSignerTitle: raw.approval?.clientSignerTitle,
    providerEntity: vendorName,
    providerSignerName: raw.approval?.providerSignerName,
    providerSignerTitle: raw.approval?.providerSignerTitle,
  };

  // --- Labor Hours ---
  const laborHours: SowLaborHours = {
    format: raw.laborHours?.format || "single_role",
    rates: raw.laborHours?.rates || { standard: 185, senior: 225, emergency: 285 },
    rows: [],
    notes: raw.laborHours?.notes || raw.workloadEstimate?.notes ? [raw.workloadEstimate?.notes].filter(Boolean) : [],
  };

  if (raw.laborHours?.rows?.length) {
    laborHours.rows = raw.laborHours.rows;
  } else if (raw.workloadEstimate?.lineItems?.length) {
    laborHours.format = "single_role";
    laborHours.rows = raw.workloadEstimate.lineItems.map((li: any) => ({
      phase: li.description || li.role || "",
      hours: li.hours || 0,
      role: li.role || "",
      rate: li.rate || 185,
    }));
  }

  return {
    cover,
    summary,
    summaryBoundaryNote,
    proposedSolution,
    prerequisites,
    projectManagement,
    phases,
    caveatsRisks,
    completionCriteria,
    approval,
    laborHours,
  };
}
