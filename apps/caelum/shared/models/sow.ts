/**
 * Caelum Statement of Work — Canonical Data Model v2.1
 * Spec: SOW-MASTER-SPEC-v2_1.md (2026-03-12)
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
  /** @deprecated v2.1 removes per-phase hours. Present only in legacy data. */
  estimatedHours?: number;
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
// Approval (optional in v2.1 — excluded by default)
// ────────────────────────────────────────────────────────────

export interface SowQuoteLine {
  description: string;
  amount: string;
}

export interface SowApproval {
  preamble?: string;
  /** @deprecated v2.1 has no pricing in approval. Kept for legacy data. */
  quoteSummary?: SowQuoteLine[];
  clientEntity: string;
  clientSignerName?: string;
  clientSignerTitle?: string;
  providerEntity: string; // Resolved from tenantConfig.vendorName
  providerSignerName?: string;
  providerSignerTitle?: string;
}

// ────────────────────────────────────────────────────────────
// Labor Hours (v2.1: Role / Scope / Hours Range — NO pricing)
// ────────────────────────────────────────────────────────────

/** v2.1 labor row: role-based with hour ranges, no pricing */
export interface SowLaborRowV21 {
  role: string;       // "Project Manager", "Senior Engineer", etc.
  scope: string;      // Description of involvement across the engagement
  hoursRange: string; // "16 – 24" — always a range, never fixed
}

/** @deprecated v2.0 multi-role format with rates/costs. Use SowLaborRowV21. */
export interface SowLaborRowMultiRole {
  phase: string;
  standardHours?: number;
  seniorHours?: number;
  emergencyHours?: number;
  totalHours: number;
  estCost: number;
}

/** @deprecated v2.0 single-role format with rates. Use SowLaborRowV21. */
export interface SowLaborRowSingleRole {
  phase: string;
  hours: number;
  role: string;
  rate: number;
}

export interface SowLaborHours {
  format: "v2.1" | "multi_role" | "single_role";
  /** @deprecated v2.0 rate card. v2.1 has NO rates. */
  rates?: {
    standard: number;
    senior: number;
    emergency: number;
  };
  rows: (SowLaborRowV21 | SowLaborRowMultiRole | SowLaborRowSingleRole)[];
  totalHoursRange?: string; // "56 – 80"
  notes?: string[];
}

/** Type guard: returns true when a labor row is v2.1 format */
export function isV21LaborRow(row: SowLaborRowV21 | SowLaborRowMultiRole | SowLaborRowSingleRole): row is SowLaborRowV21 {
  return "hoursRange" in row && "scope" in row;
}

// ────────────────────────────────────────────────────────────
// Full SoW Document (v2.1 canonical shape)
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
  /** Optional in v2.1 — excluded by default. Include only when explicitly requested. */
  approval?: SowApproval;
  laborHours: SowLaborHours;
}

// ────────────────────────────────────────────────────────────
// Legacy normalization
// ────────────────────────────────────────────────────────────

/**
 * Converts ad-hoc sowJson (from LLM output or legacy DB rows) into the
 * v2.1 canonical model. Handles both v2.0 legacy shapes and v2.1 native
 * shapes. Missing fields are filled with sensible defaults.
 */
export function normalizeSowJson(raw: any, vendorName = "[Provider]"): SowDocumentV2 {
  // --- Cover ---
  const cover: SowCover = {
    client: raw.clientName || raw.cover?.client || raw.title?.split(" - ")[0]?.trim() || "[Client]",
    facility: raw.cover?.facility,
    projectName: raw.title || raw.cover?.projectName || raw.cover?.project_name || "[Project Name]",
    provider: vendorName,
    billingModel: raw.cover?.billingModel || raw.cover?.billing_model || raw.billingModel || "Time & Materials",
    documentDate: raw.cover?.documentDate || raw.cover?.document_date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    version: raw.cover?.version || "1.0",
    classification: raw.cover?.classification || "Confidential",
    quoteNumber: raw.cover?.quoteNumber || raw.cover?.quote_number || raw.quoteNumber,
    expirationDate: raw.cover?.expirationDate || raw.cover?.expiration_date,
  };

  // --- Summary ---
  const summaryObj = raw.summary;
  const summary = typeof summaryObj === "string"
    ? summaryObj
    : summaryObj?.narrative || "";
  const summaryBoundaryNote = raw.summaryBoundaryNote || raw.scopeBoundaryNote || summaryObj?.scope_boundary_note;

  // --- Proposed Solution ---
  const rawSol = raw.proposed_solution || raw.proposedSolution;
  const proposedSolution: SowProposedSolution = {
    overview: raw.solution || rawSol?.overview || "",
    subsections: rawSol?.subsections,
    componentsTable: rawSol?.componentsTable || rawSol?.components_table,
    includedItemsTable: rawSol?.includedItemsTable,
    keyDeliverables: rawSol?.keyDeliverables || rawSol?.key_deliverables,
    exclusionNotes: rawSol?.exclusionNotes || rawSol?.exclusion_notes,
  };

  // --- Prerequisites (merge legacy dependencies) ---
  const rawPrereqs = raw.prerequisites;
  let prerequisites: string[] = [];
  if (Array.isArray(rawPrereqs)) {
    prerequisites = rawPrereqs;
  } else if (rawPrereqs) {
    const cr = rawPrereqs.clientResponsibilities || [];
    const vr = rawPrereqs.vendorResponsibilities || [];
    const tp = rawPrereqs.thirdPartyResponsibilities || [];
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
    "Provide project plan with milestones (if applicable) and estimated time of completion.",
    "Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.",
    "Remove old documentation references and update documentation to reflect new configurations.",
  ];
  const rawPm = raw.project_management || raw.projectManagement;
  const rawPmTasks = rawPm?.pm_tasks || rawPm?.tasks || [];
  const extraTasks = rawPmTasks.filter(
    (t: string) => !mandatoryTasks.some((m) => t.toLowerCase().includes(m.substring(0, 30).toLowerCase()))
  );
  const projectManagement: SowProjectManagement = {
    siteAddress: rawPm?.siteAddress || rawPm?.site_address,
    contacts: rawPm?.pocs?.map((p: string) => ({ role: "Contact", name: p })) || rawPm?.contacts,
    pmTasks: [...mandatoryTasks, ...extraTasks],
  };

  // --- Phases ---
  const phases: SowPhase[] = (raw.outline || raw.phases || []).map((p: any, i: number) => ({
    number: p.number || i + 1,
    title: (p.phase || p.title || p.name || "").replace(/^Phase\s+\d+[:\s]*/i, ""),
    estimatedHours: p.estimatedHours || p.hours || undefined,
    objective: p.objective || "",
    tasks: p.tasks || [],
    deliverables: p.deliverables || [],
  }));

  // --- Caveats & Risks (merge legacy outOfScope, changeControl) ---
  const rawCaveats = raw.caveats_risks || raw.caveatsRisks || raw.caveatsAndRisks;
  const exclusions = [
    ...(raw.outOfScope || []),
    ...(rawCaveats?.exclusions || []),
  ];
  const assumptions = rawCaveats?.assumptions || [];
  const risks: SowRisk[] = (rawCaveats?.risks || []).map((r: any) => ({
    risk: r.risk || r.title || r.name || "",
    impact: r.impact || "",
    mitigation: r.mitigation || r.mitigationDIT || r.vendorMitigation || r.mitigationVendor || "",
  }));
  const changeControl =
    rawCaveats?.changeControl || rawCaveats?.change_control ||
    raw.changeControl ||
    `Any work, equipment, or services not explicitly described in this document are considered out of scope. Out-of-scope requests identified during the engagement will be documented and presented to the client as a separate change order or scope of work for review and approval prior to execution.`;

  const caveatsRisks: SowCaveatsRisks = { exclusions, assumptions, risks, changeControl };

  // --- Completion Criteria ---
  const completionCriteria = raw.completionCriteria || raw.completion_criteria || [];

  // --- Approval (optional in v2.1 — only build if explicitly present) ---
  let approval: SowApproval | undefined;
  if (raw.approval && typeof raw.approval === "object" && (raw.approval.clientEntity || raw.approval.client_entity)) {
    approval = {
      preamble: raw.approval.preamble,
      quoteSummary: raw.approval.quoteSummary,
      clientEntity: raw.approval.clientEntity || raw.approval.client_entity || cover.client,
      clientSignerName: raw.approval.clientSignerName,
      clientSignerTitle: raw.approval.clientSignerTitle,
      providerEntity: raw.approval.providerEntity || raw.approval.provider_entity || vendorName,
      providerSignerName: raw.approval.providerSignerName,
      providerSignerTitle: raw.approval.providerSignerTitle,
    };
  }

  // --- Labor Hours ---
  const rawLabor = raw.labor_hours || raw.laborHours;
  const laborHours: SowLaborHours = {
    format: "v2.1",
    rows: [],
    notes: [],
  };

  // v2.1 native format (from updated LLM prompt or v2.1 JSON schema)
  if (rawLabor?.rows?.length && rawLabor.rows[0]?.hours_range !== undefined) {
    laborHours.format = "v2.1";
    laborHours.rows = rawLabor.rows.map((r: any) => ({
      role: r.role || "",
      scope: r.scope || "",
      hoursRange: r.hours_range || r.hoursRange || "0 – 0",
    }));
    laborHours.totalHoursRange = rawLabor.total_hours_range || rawLabor.totalHoursRange;
    laborHours.notes = rawLabor.notes || [];
  }
  // v2.1 format already normalized (hoursRange key)
  else if (rawLabor?.rows?.length && rawLabor.rows[0]?.hoursRange !== undefined) {
    laborHours.format = "v2.1";
    laborHours.rows = rawLabor.rows;
    laborHours.totalHoursRange = rawLabor.totalHoursRange;
    laborHours.notes = rawLabor.notes || [];
  }
  // Legacy v2.0 canonical format (multi_role / single_role)
  else if (rawLabor?.rows?.length) {
    laborHours.format = rawLabor.format || "single_role";
    laborHours.rates = rawLabor.rates;
    laborHours.rows = rawLabor.rows;
    laborHours.notes = rawLabor.notes || [];
  }
  // Legacy ad-hoc workloadEstimate
  else if (raw.workloadEstimate?.lineItems?.length) {
    laborHours.format = "v2.1";
    laborHours.rows = raw.workloadEstimate.lineItems.map((li: any) => ({
      role: li.role || "",
      scope: li.description || "",
      hoursRange: `${li.hours || 0} – ${Math.ceil((li.hours || 0) * 1.3)}`,
    }));
    const totalHrs = raw.workloadEstimate.lineItems.reduce((s: number, li: any) => s + (li.hours || 0), 0);
    laborHours.totalHoursRange = `${totalHrs} – ${Math.ceil(totalHrs * 1.3)}`;
    laborHours.notes = raw.workloadEstimate.notes ? [raw.workloadEstimate.notes] : [];
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

// ────────────────────────────────────────────────────────────
// Ducky Integration Hooks (CVG-DUCKY)
// ────────────────────────────────────────────────────────────

export interface DuckyKnowledgePayload {
  name: string;
  sourceType: "api";
  content: string;
  metadataJson: {
    origin: "caelum";
    conversationId: number;
    sowVersion: string;
    projectName: string;
    client: string;
    billingModel: string;
    exportedAt: string;
    tenantId: string;
  };
}

/**
 * Converts a normalized SoW document into a Ducky knowledge ingestion payload.
 * Used to push completed SoWs into Ducky's RAG pipeline for cross-app search.
 */
export function sowToDuckyPayload(
  sow: SowDocumentV2,
  conversationId: number,
  tenantId: string,
): DuckyKnowledgePayload {
  const sections: string[] = [];
  sections.push(`Project: ${sow.cover.projectName}`);
  sections.push(`Client: ${sow.cover.client}`);
  if (sow.cover.facility) sections.push(`Facility: ${sow.cover.facility}`);
  sections.push(`Provider: ${sow.cover.provider}`);
  sections.push(`Billing Model: ${sow.cover.billingModel}`);
  sections.push(`Date: ${sow.cover.documentDate}`);

  sections.push(`\nSummary:\n${sow.summary}`);
  if (sow.summaryBoundaryNote) sections.push(sow.summaryBoundaryNote);

  sections.push(`\nProposed Solution:\n${sow.proposedSolution.overview}`);
  if (sow.proposedSolution.subsections?.length) {
    for (const sub of sow.proposedSolution.subsections) {
      sections.push(`\n${sub.number} ${sub.title}\n${sub.narrative}`);
    }
  }

  if (sow.prerequisites.length) {
    sections.push(`\nPrerequisites:\n${sow.prerequisites.map((p, i) => `${i + 1}. ${p}`).join("\n")}`);
  }

  for (const phase of sow.phases) {
    sections.push(`\nPhase ${phase.number}: ${phase.title}`);
    sections.push(`Objective: ${phase.objective}`);
    if (phase.tasks.length) sections.push(`Tasks:\n${phase.tasks.map((t) => `- ${t}`).join("\n")}`);
    if (phase.deliverables.length) sections.push(`Deliverables:\n${phase.deliverables.map((d) => `- ${d}`).join("\n")}`);
  }

  if (sow.caveatsRisks.exclusions.length) {
    sections.push(`\nExclusions:\n${sow.caveatsRisks.exclusions.map((e) => `- ${e}`).join("\n")}`);
  }
  if (sow.caveatsRisks.assumptions.length) {
    sections.push(`\nAssumptions:\n${sow.caveatsRisks.assumptions.map((a) => `- ${a}`).join("\n")}`);
  }
  if (sow.caveatsRisks.risks.length) {
    sections.push(`\nRisks:\n${sow.caveatsRisks.risks.map((r) => `- ${r.risk}: ${r.impact} (Mitigation: ${r.mitigation})`).join("\n")}`);
  }

  if (sow.completionCriteria.length) {
    sections.push(`\nCompletion Criteria:\n${sow.completionCriteria.map((c) => `- ${c}`).join("\n")}`);
  }

  if (sow.laborHours.rows.length) {
    sections.push(`\nEstimated Labor Hours:`);
    for (const row of sow.laborHours.rows) {
      if (isV21LaborRow(row)) {
        sections.push(`- ${row.role}: ${row.scope} (${row.hoursRange} hours)`);
      }
    }
  }

  return {
    name: `SoW: ${sow.cover.projectName} (${sow.cover.client})`,
    sourceType: "api",
    content: sections.join("\n"),
    metadataJson: {
      origin: "caelum",
      conversationId,
      sowVersion: sow.cover.version,
      projectName: sow.cover.projectName,
      client: sow.cover.client,
      billingModel: sow.cover.billingModel,
      exportedAt: new Date().toISOString(),
      tenantId,
    },
  };
}
