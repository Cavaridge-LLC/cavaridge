/**
 * Caelum Statement of Work — Markdown Export Generator v2.1
 * Spec: SOW-MASTER-SPEC-v2_1.md (2026-03-12)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 * Provider name and branding are resolved per-tenant via tenantConfig.
 */

import type { SowDocumentV2, SowLaborRowV21, SowLaborRowMultiRole, SowLaborRowSingleRole } from "../shared/models/sow";
import { isV21LaborRow } from "../shared/models/sow";

function escMd(text: string): string {
  return text.replace(/\|/g, "\\|");
}

export function generateMarkdown(sow: SowDocumentV2): string {
  const lines: string[] = [];
  const ln = (s = "") => lines.push(s);

  // ── Cover ──
  ln(`# ${sow.cover.provider}`);
  ln();
  ln(`*Scope of Work*`);
  ln();
  ln(`## ${sow.cover.projectName}`);
  ln();
  ln(`**${sow.cover.client}${sow.cover.facility ? ` — ${sow.cover.facility}` : ""}**`);
  ln();
  ln(`| | |`);
  ln(`|---|---|`);
  ln(`| **Client** | ${escMd(sow.cover.client)} |`);
  if (sow.cover.facility) ln(`| **Facility** | ${escMd(sow.cover.facility)} |`);
  ln(`| **Provider** | ${escMd(sow.cover.provider)} |`);
  ln(`| **Billing Model** | ${sow.cover.billingModel} |`);
  ln(`| **Document Date** | ${sow.cover.documentDate} |`);
  ln(`| **Version** | ${sow.cover.version} |`);
  ln(`| **Classification** | ${sow.cover.classification} |`);
  if (sow.cover.quoteNumber) ln(`| **Quote #** | ${sow.cover.quoteNumber} |`);
  if (sow.cover.expirationDate) ln(`| **Expiration** | ${sow.cover.expirationDate} |`);
  ln();
  ln(`> *CONFIDENTIAL — This document is proprietary to ${sow.cover.provider} and intended solely for the above-referenced organization.*`);
  ln();
  ln("---");
  ln();

  // ── Section 1: Summary ──
  ln(`## 1. Summary`);
  ln();
  ln(sow.summary);
  if (sow.summaryBoundaryNote) {
    ln();
    ln(`*${sow.summaryBoundaryNote}*`);
  }
  ln();

  // ── Section 2: Proposed Solution ──
  ln(`## 2. Proposed Solution`);
  ln();
  ln(sow.proposedSolution.overview);
  ln();

  if (sow.proposedSolution.subsections?.length) {
    for (const sub of sow.proposedSolution.subsections) {
      ln(`### ${sub.number} ${sub.title}`);
      ln();
      ln(sub.narrative);
      ln();
    }
  }

  if (sow.proposedSolution.componentsTable?.length) {
    ln(`### Infrastructure Components`);
    ln();
    ln(`| Component | Description |`);
    ln(`|---|---|`);
    for (const c of sow.proposedSolution.componentsTable) {
      ln(`| **${escMd(c.component)}** | ${escMd(c.description)} |`);
    }
    ln();
  }

  if (sow.proposedSolution.includedItemsTable?.length) {
    ln(`### Included Hardware / Software`);
    ln();
    ln(`| Description | Unit Price | Qty | Ext. Price |`);
    ln(`|---|---:|---:|---:|`);
    let subtotal = 0;
    for (const li of sow.proposedSolution.includedItemsTable) {
      subtotal += li.extPrice;
      ln(`| ${escMd(li.description)} | $${li.unitPrice.toLocaleString()} | ${li.qty} | $${li.extPrice.toLocaleString()} |`);
    }
    ln(`| | | **Subtotal** | **$${subtotal.toLocaleString()}** |`);
    ln();
  }

  if (sow.proposedSolution.keyDeliverables?.length) {
    ln(`### Key Deliverables`);
    ln();
    sow.proposedSolution.keyDeliverables.forEach((d, i) => ln(`${i + 1}. ${d}`));
    ln();
  }

  if (sow.proposedSolution.exclusionNotes?.length) {
    ln(`**This Scope of Work does not include:**`);
    ln();
    for (const e of sow.proposedSolution.exclusionNotes) ln(`- ${e}`);
    ln();
    ln(`*These items, if required, will be addressed under separate Scopes of Work.*`);
    ln();
  }

  // ── Section 3: Prerequisites ──
  ln(`## 3. Prerequisites`);
  ln();
  ln(`The following conditions must be met prior to project commencement.`);
  ln();
  sow.prerequisites.forEach((p, i) => ln(`${i + 1}. ${p}`));
  ln();
  ln(`*Delays in meeting these prerequisites may impact the project timeline and/or require a change order.*`);
  ln();

  // ── Section 4: Project Management ──
  ln(`## 4. Project Management`);
  ln();

  if (sow.projectManagement.siteAddress) {
    ln(`### Site Address`);
    ln();
    ln(sow.projectManagement.siteAddress);
    ln();
  }

  if (sow.projectManagement.contacts?.length) {
    for (const c of sow.projectManagement.contacts) {
      ln(`### ${c.role}`);
      ln();
      ln(`| | |`);
      ln(`|---|---|`);
      ln(`| **Name** | ${c.name} |`);
      if (c.title) ln(`| **Title** | ${c.title} |`);
      if (c.email) ln(`| **Email** | ${c.email} |`);
      if (c.phone) ln(`| **Phone** | ${c.phone} |`);
      if (c.notes) ln(`| **Notes** | *${c.notes}* |`);
      ln();
    }
  }

  ln(`### Project Management Tasks`);
  ln();
  for (const t of sow.projectManagement.pmTasks) ln(`- ${t}`);
  ln();

  // ── Section 5: High-Level Project Outline ──
  ln(`## 5. High-Level Project Outline`);
  ln();

  for (const phase of sow.phases) {
    ln(`### Phase ${phase.number}: ${phase.title}`);
    ln();
    ln(`**Objective:** ${phase.objective}`);
    ln();
    ln(`**Tasks:**`);
    ln();
    for (const t of phase.tasks) ln(`- ${t}`);
    ln();
    ln(`**Deliverables:**`);
    ln();
    for (const d of phase.deliverables) ln(`- ${d}`);
    ln();
  }

  // ── Section 6: Caveats & Risks ──
  ln(`## 6. Caveats and Risks`);
  ln();

  if (sow.caveatsRisks.exclusions.length) {
    ln(`### 6.1 Scope Exclusions`);
    ln();
    for (const e of sow.caveatsRisks.exclusions) ln(`- ${e}`);
    ln();
  }

  if (sow.caveatsRisks.assumptions.length) {
    ln(`### 6.2 Assumptions`);
    ln();
    for (const a of sow.caveatsRisks.assumptions) ln(`- ${a}`);
    ln();
  }

  if (sow.caveatsRisks.risks.length) {
    ln(`### 6.3 Risks`);
    ln();
    ln(`| Risk | Impact | Mitigation |`);
    ln(`|---|---|---|`);
    for (const r of sow.caveatsRisks.risks) {
      ln(`| ${escMd(r.risk)} | ${escMd(r.impact)} | ${escMd(r.mitigation)} |`);
    }
    ln();
  }

  ln(`### 6.4 Change Control`);
  ln();
  ln(`*${sow.caveatsRisks.changeControl}*`);
  ln();

  // ── Section 7: Completion Criteria ──
  ln(`## 7. Completion Criteria`);
  ln();
  ln(`This project will be considered complete when all of the following conditions have been met:`);
  ln();
  for (const c of sow.completionCriteria) ln(`- ${c}`);
  ln();
  ln(`*Upon receipt of written sign-off, the project will be formally closed. Any issues or requests identified after sign-off will be handled through standard ${sow.cover.provider} support channels or scoped as a separate engagement.*`);
  ln();

  // ── Dynamic section numbering ──
  let secNum = 8;

  // ── Approval (optional) ──
  if (sow.approval) {
    ln(`## ${secNum}. Approval`);
    ln();
    ln(sow.approval.preamble || `By signing below, the authorized representatives acknowledge they have reviewed this Scope of Work and agree to the terms, deliverables, prerequisites, and exclusions outlined herein.`);
    ln();
    ln(`*This document constitutes the complete scope for the ${sow.cover.projectName} at ${sow.cover.facility || sow.cover.client}. Work will commence upon receipt of signed approval.*`);
    ln();

    // Stacked signature blocks
    ln(`**Client — ${sow.approval.clientEntity}**`);
    ln();
    ln(`____________________________________________`);
    ln(`Authorized Signature`);
    ln();
    ln(`Printed Name: ___________________________`);
    ln(`Date: _______________`);
    ln();
    ln(`**Provider — ${sow.approval.providerEntity}**`);
    ln();
    ln(`____________________________________________`);
    ln(`Authorized Signature`);
    ln();
    ln(`Printed Name: ___________________________`);
    ln(`Date: _______________`);
    ln();
    secNum++;
  }

  // ── Estimated Labor Hours ──
  ln(`## ${secNum}. Estimated Labor Hours`);
  ln();

  // v2.1 format
  if (sow.laborHours.format === "v2.1" && sow.laborHours.rows.length && isV21LaborRow(sow.laborHours.rows[0])) {
    ln(`| Role | Scope of Involvement | Est. Hours |`);
    ln(`|---|---|---:|`);
    for (const row of sow.laborHours.rows as SowLaborRowV21[]) {
      ln(`| **${escMd(row.role)}** | ${escMd(row.scope)} | ${row.hoursRange} |`);
    }
    if (sow.laborHours.totalHoursRange) {
      ln(`| **Total Estimated Hours** | | **${sow.laborHours.totalHoursRange}** |`);
    }
  }
  // Legacy single_role fallback (strip pricing)
  else if (sow.laborHours.format === "single_role") {
    ln(`| Role | Scope of Involvement | Est. Hours |`);
    ln(`|---|---|---:|`);
    for (const row of sow.laborHours.rows as SowLaborRowSingleRole[]) {
      ln(`| **${escMd(row.role || row.phase)}** | ${escMd(row.phase)} | ${row.hours} |`);
    }
  }
  // Legacy multi_role fallback (strip pricing)
  else if (sow.laborHours.format === "multi_role") {
    ln(`| Role | Scope of Involvement | Est. Hours |`);
    ln(`|---|---|---:|`);
    for (const row of sow.laborHours.rows as SowLaborRowMultiRole[]) {
      ln(`| **${escMd(row.phase)}** | | ${row.totalHours} |`);
    }
  }
  ln();

  if (sow.laborHours.notes?.length) {
    ln(`**Notes:**`);
    ln();
    for (const n of sow.laborHours.notes) ln(`- *${n}*`);
    ln();
  }

  return lines.join("\n");
}
