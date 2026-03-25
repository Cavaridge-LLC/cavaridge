/**
 * Caelum SoW Document Validation
 * Spec: SOW-MASTER-SPEC-v2_2.md (2026-03-24, LOCKED)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 *
 * Validates a SowDocumentV2 against the 8-section structure requirements.
 * Ensures mandatory PM tasks, labor hours format, and section completeness.
 */

import type { SowDocumentV2 } from "../../../shared/models/sow";
import { isV21LaborRow } from "../../../shared/models/sow";

// ---------------------------------------------------------------------------
// Constants — 3 Mandatory PM Tasks (verbatim per spec)
// ---------------------------------------------------------------------------

export const MANDATORY_PM_TASKS = [
  "Provide project plan with milestones (if applicable) and estimated time of completion.",
  "Provide regular updates through preferred method (email, phone, or Teams meetings) at agreed-upon intervals established during project kickoff meeting.",
  "Remove old documentation references and update documentation to reflect new configurations.",
] as const;

// ---------------------------------------------------------------------------
// Formatting Constants (v2.2 LOCKED palette)
// ---------------------------------------------------------------------------

export const SOW_FORMAT = {
  font: "Arial",
  h1Color: "2E5090",
  h2Color: "1A1A1A",
  bodyTextColor: "333333",
  tableHeaderBg: "2E5090",
  tableHeaderText: "FFFFFF",
  rowBanding: "F2F6FA",
  borderColor: "BFBFBF",
} as const;

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  section: string;
  severity: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  sectionChecklist: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// 8-section structure enforcement
// ---------------------------------------------------------------------------

const REQUIRED_SECTIONS = [
  "summary",
  "proposedSolution",
  "prerequisites",
  "projectManagement",
  "phases",
  "caveatsRisks",
  "completionCriteria",
  "laborHours",
] as const;

/**
 * Validates a SowDocumentV2 against the SOW-MASTER-SPEC v2.2 requirements.
 * Returns a ValidationResult with issues and a section checklist.
 */
export function validateSowDocument(sow: SowDocumentV2): ValidationResult {
  const issues: ValidationIssue[] = [];
  const sectionChecklist: Record<string, boolean> = {};

  // --- Cover ---
  if (!sow.cover) {
    issues.push({ section: "cover", severity: "error", message: "Cover section is missing." });
    sectionChecklist.cover = false;
  } else {
    sectionChecklist.cover = true;
    if (!sow.cover.client) issues.push({ section: "cover", severity: "error", message: "Client name is required." });
    if (!sow.cover.projectName) issues.push({ section: "cover", severity: "error", message: "Project name is required." });
    if (!sow.cover.provider) issues.push({ section: "cover", severity: "error", message: "Provider name is required." });
    if (!sow.cover.billingModel) issues.push({ section: "cover", severity: "error", message: "Billing model is required." });
    if (!sow.cover.documentDate) issues.push({ section: "cover", severity: "warning", message: "Document date is missing." });
  }

  // --- Section 1: Summary ---
  sectionChecklist.summary = !!sow.summary && sow.summary.trim().length > 0;
  if (!sectionChecklist.summary) {
    issues.push({ section: "summary", severity: "error", message: "Summary section is empty." });
  }

  // --- Section 2: Proposed Solution ---
  sectionChecklist.proposedSolution = !!sow.proposedSolution?.overview && sow.proposedSolution.overview.trim().length > 0;
  if (!sectionChecklist.proposedSolution) {
    issues.push({ section: "proposedSolution", severity: "error", message: "Proposed Solution overview is empty." });
  }

  // --- Section 3: Prerequisites ---
  sectionChecklist.prerequisites = Array.isArray(sow.prerequisites) && sow.prerequisites.length > 0;
  if (!sectionChecklist.prerequisites) {
    issues.push({ section: "prerequisites", severity: "error", message: "Prerequisites section must have at least one item." });
  }

  // --- Section 4: Project Management ---
  sectionChecklist.projectManagement = !!sow.projectManagement?.pmTasks && sow.projectManagement.pmTasks.length >= 3;
  if (!sectionChecklist.projectManagement) {
    issues.push({ section: "projectManagement", severity: "error", message: "Project Management must include at least 3 PM tasks." });
  } else {
    // Check mandatory PM tasks are present
    for (const mandatoryTask of MANDATORY_PM_TASKS) {
      const found = sow.projectManagement.pmTasks.some(
        (task) => task.toLowerCase().includes(mandatoryTask.substring(0, 30).toLowerCase())
      );
      if (!found) {
        issues.push({
          section: "projectManagement",
          severity: "error",
          message: `Missing mandatory PM task: "${mandatoryTask.substring(0, 60)}..."`,
        });
      }
    }
  }

  // --- Section 5: High-Level Project Outline (Phases) ---
  sectionChecklist.phases = Array.isArray(sow.phases) && sow.phases.length > 0;
  if (!sectionChecklist.phases) {
    issues.push({ section: "phases", severity: "error", message: "At least one project phase is required." });
  } else {
    for (const phase of sow.phases) {
      if (!phase.title) {
        issues.push({ section: "phases", severity: "warning", message: `Phase ${phase.number} is missing a title.` });
      }
      if (!phase.objective) {
        issues.push({ section: "phases", severity: "warning", message: `Phase ${phase.number} is missing an objective.` });
      }
      if (!phase.tasks || phase.tasks.length === 0) {
        issues.push({ section: "phases", severity: "warning", message: `Phase ${phase.number} has no tasks.` });
      }
      if (!phase.deliverables || phase.deliverables.length === 0) {
        issues.push({ section: "phases", severity: "warning", message: `Phase ${phase.number} has no deliverables.` });
      }
    }
  }

  // --- Section 6: Caveats & Risks ---
  sectionChecklist.caveatsRisks = !!sow.caveatsRisks;
  if (!sow.caveatsRisks) {
    issues.push({ section: "caveatsRisks", severity: "error", message: "Caveats & Risks section is missing." });
  } else {
    if (!sow.caveatsRisks.exclusions || sow.caveatsRisks.exclusions.length === 0) {
      issues.push({ section: "caveatsRisks", severity: "warning", message: "No scope exclusions defined." });
    }
    if (!sow.caveatsRisks.assumptions || sow.caveatsRisks.assumptions.length === 0) {
      issues.push({ section: "caveatsRisks", severity: "warning", message: "No assumptions defined." });
    }
    if (!sow.caveatsRisks.risks || sow.caveatsRisks.risks.length === 0) {
      issues.push({ section: "caveatsRisks", severity: "warning", message: "No risks defined." });
    }
    if (!sow.caveatsRisks.changeControl) {
      issues.push({ section: "caveatsRisks", severity: "error", message: "Change control statement is required." });
    }
  }

  // --- Section 7: Completion Criteria ---
  sectionChecklist.completionCriteria = Array.isArray(sow.completionCriteria) && sow.completionCriteria.length > 0;
  if (!sectionChecklist.completionCriteria) {
    issues.push({ section: "completionCriteria", severity: "error", message: "At least one completion criterion is required." });
  }

  // --- Section 8: Estimated Labor Hours ---
  sectionChecklist.laborHours = !!sow.laborHours?.rows && sow.laborHours.rows.length > 0;
  if (!sectionChecklist.laborHours) {
    issues.push({ section: "laborHours", severity: "error", message: "Labor hours section must have at least one row." });
  } else {
    // Ensure v2.1 format: Role | Scope | Hours Range — NO pricing
    if (sow.laborHours.format === "v2.1") {
      for (const row of sow.laborHours.rows) {
        if (isV21LaborRow(row)) {
          if (!row.role) issues.push({ section: "laborHours", severity: "warning", message: "A labor row is missing a role." });
          if (!row.scope) issues.push({ section: "laborHours", severity: "warning", message: `Role "${row.role}" is missing scope description.` });
          if (!row.hoursRange) issues.push({ section: "laborHours", severity: "error", message: `Role "${row.role}" is missing hours range.` });
          // Check for pricing in the hours range (should never appear)
          if (row.hoursRange && /\$/.test(row.hoursRange)) {
            issues.push({ section: "laborHours", severity: "error", message: `Role "${row.role}" hours range contains pricing — remove dollar amounts.` });
          }
        }
      }
    }

    // Check for Project Manager role
    const hasPM = sow.laborHours.rows.some((row) => {
      if (isV21LaborRow(row)) {
        return /project\s*manager/i.test(row.role);
      }
      return false;
    });
    if (!hasPM && sow.laborHours.format === "v2.1") {
      issues.push({ section: "laborHours", severity: "warning", message: "No Project Manager role found in labor hours. PM hours are recommended for every SoW." });
    }
  }

  // --- Approval section check ---
  if (sow.approval) {
    // Approval is allowed but excluded by default per spec
    issues.push({ section: "approval", severity: "warning", message: "Approval section is included. Per v2.2 spec, it is excluded by default — include only when explicitly requested." });
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    issues,
    sectionChecklist,
  };
}
