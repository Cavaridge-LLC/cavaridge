# CVG-CAELUM v2.0 Integration Guide

**Date:** 2026-03-10
**Spec:** DIT-SOW-MASTER-SPEC-v2.0.md

---

## Files to Add

| Source File | Destination in Repo |
|---|---|
| `shared/models/sow.ts` | `apps/caelum/shared/models/sow.ts` |
| `server/sowDocxExportV2.ts` | `apps/caelum/server/sowDocxExportV2.ts` |
| `server/sowMarkdownExport.ts` | `apps/caelum/server/sowMarkdownExport.ts` |

## Files to Modify

### 1. `shared/schema.ts` — Add export

```ts
export * from "./models/auth";
export * from "./models/chat";
export * from "./models/sow";   // ← ADD THIS LINE
```

### 2. `server/routes.ts` — Add Markdown format + v2 DOCX

#### Import additions (top of file):

```ts
// REPLACE THIS:
import { generatePdf, generateDocx } from "./sowExport";

// WITH THIS:
import { generatePdf, generateDocx } from "./sowExport";       // Legacy PDF + DOCX
import { generateDocxV2 } from "./sowDocxExportV2";             // v2.0 DOCX
import { generateMarkdown } from "./sowMarkdownExport";          // v2.0 Markdown
import { normalizeSowJson } from "@shared/models/sow";          // Normalizer
```

#### Export route handler replacement (lines ~604-634):

Replace the existing export route handler with:

```ts
app.post("/api/conversations/:id/export/:format", isAuthenticated, tenantScope, loadUserRole, requireRole(ROLE_NAMES.VIEWER), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const format = req.params.format;
    const convo = await chatStorage.getConversation(id, req.tenantId!);
    if (!convo || convo.userId !== (req.user as any).claims.sub) {
      throw new NotFoundError("Conversation not found.");
    }
    if (!convo.sowJson) {
      throw new ValidationError("No SoW to export.");
    }

    const slug = (convo.sowJson as any).title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sow-export";
    const exportConfig = await getTenantConfig(req.tenantId!);

    if (format === "pdf") {
      // Legacy PDF (unchanged)
      const pdfBuffer = await generatePdf(convo.sowJson, exportConfig);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.pdf"`);
      res.send(pdfBuffer);

    } else if (format === "docx-legacy") {
      // Legacy DOCX (keep for backward compat)
      const style = "summary";
      const docxBuffer = await generateDocx(convo.sowJson, style, exportConfig);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}-legacy.docx"`);
      res.send(docxBuffer);

    } else if (format === "docx" || format === "docx-detailed") {
      // v2.0 DOCX (new default)
      const normalized = normalizeSowJson(convo.sowJson, exportConfig.vendorName);
      const docxBuffer = await generateDocxV2(normalized, exportConfig);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.docx"`);
      res.send(docxBuffer);

    } else if (format === "md" || format === "markdown") {
      // v2.0 Markdown (new)
      const normalized = normalizeSowJson(convo.sowJson, exportConfig.vendorName);
      const md = generateMarkdown(normalized);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="sow-${slug}.md"`);
      res.send(md);

    } else {
      throw new ValidationError("Invalid format. Use 'pdf', 'docx', 'docx-legacy', or 'md'.");
    }
  } catch (error: any) {
    next(error);
  }
});
```

### 3. Client-side export button (optional)

In `client/src/pages/home.tsx`, wherever the export format options are rendered, add `"md"` to the list of available formats. Search for `docx` or `export` in that file to find the relevant dropdown/button.

---

## How Backward Compatibility Works

The `normalizeSowJson()` function in `shared/models/sow.ts` handles the translation between the existing ad-hoc `sowJson` shape and the new `SowDocumentV2` interface. Key mappings:

| Legacy Field | → v2.0 Field |
|---|---|
| `sow.title` | `cover.projectName` |
| `sow.clientName` | `cover.client` |
| `sow.summary` | `summary` |
| `sow.solution` | `proposedSolution.overview` |
| `sow.prerequisites.clientResponsibilities` | Merged into `prerequisites[]` |
| `sow.prerequisites.vendorResponsibilities` | Merged into `prerequisites[]` |
| `sow.dependencies` | Merged into `prerequisites[]` |
| `sow.outline[]` | `phases[]` (with `estimatedHours` added) |
| `sow.outOfScope` | `caveatsRisks.exclusions` |
| `sow.caveatsAndRisks.assumptions` | `caveatsRisks.assumptions` |
| `sow.caveatsAndRisks.risks` | `caveatsRisks.risks` (flattened to 3-col) |
| `sow.changeControl` | `caveatsRisks.changeControl` |
| `sow.completionCriteria` | `completionCriteria` |
| `sow.approval` (string) | `approval.preamble` |
| `sow.workloadEstimate.lineItems` | `laborHours.rows` (single_role format) |

**No changes to the database schema are required.** Existing `sowJson` payloads are normalized at export time. New SoWs generated after the v2.0 update will produce the canonical shape natively.

---

## Validation

After integration, test with:

1. **Existing SoW** — Export an old conversation as DOCX and verify it renders with the new navy/blue design, correct 9-section order
2. **Existing SoW as Markdown** — Export as `md` and verify all sections present
3. **Legacy PDF** — Export as `pdf` and confirm the existing PDFKit renderer still works
4. **Legacy DOCX** — Export as `docx-legacy` and confirm the old renderer still works
5. **New SoW** — Create a fresh SoW through chat, export as DOCX and MD, verify both match the spec

---

## Future: Native v2.0 Data Shape

Once the v2.0 generators are validated, the next step is to update the LLM system prompt in `server/routes.ts` (the chat handler) to generate SoW JSON in the `SowDocumentV2` shape natively. This eliminates the normalization step and enables the full spec (cover table fields, per-phase estimated hours, structured risk table, quote summary) from initial generation.

The `normalizeSowJson()` function should remain as a fallback for any legacy conversations.
