# CVG-CAELUM v2.1 Integration Guide

**Date:** 2026-03-12
**Spec:** SOW-MASTER-SPEC-v2_1.md (LOCKED)

---

## Breaking Changes from v2.0

| Area | v2.0 | v2.1 |
|------|------|------|
| **Default sections** | 9 (Approval always included) | 8 (Approval excluded by default) |
| **Approval** | Required section | Optional — only when explicitly requested |
| **Labor table** | Role / Rate / Hours / Subtotal (with pricing) | Role / Scope / Hours Range (no pricing) |
| **Per-phase hours** | `estimatedHours` on each phase | Removed — hours only in labor table |
| **Risk table** | 6-column (with mitigationDIT, mitigationClient, decision) | 3-column (risk, impact, mitigation) |
| **Prerequisites** | Object with sub-arrays | Flat string array |
| **Color palette** | Navy #1F3864, Blue #2E75B6 | Blue #2E5090, Dark #1A1A1A, Body #333333, Border #BFBFBF, Banding #F2F6FA |
| **Cover layout** | "STATEMENT OF WORK" header | Vendor name header + "Scope of Work" subtitle |
| **Signature blocks** | Side-by-side table | Stacked underscore blocks |

---

## Files Modified

| File | Changes |
|------|---------|
| `shared/models/sow.ts` | v2.1 types, `SowLaborRowV21`, optional approval, `isV21LaborRow()`, `sowToDuckyPayload()` |
| `server/sowDocxExportV2.ts` | v2.1 colors, cover, conditional approval, labor table, header/footer borders |
| `server/sowMarkdownExport.ts` | v2.1 cover, conditional approval, labor table, no per-phase hours |
| `server/routes.ts` | v2.1 LLM prompt, export routes (md format), grammar check dual-format, Ducky stub |
| `client/src/pages/home.tsx` | `parseSow()` dual-format, v2.1 labor table rendering, Markdown export button |

---

## Data Model Changes (`shared/models/sow.ts`)

### New Types

```ts
interface SowLaborRowV21 {
  role: string;
  scope: string;
  hoursRange: string;  // e.g., "8–12"
}

interface DuckyKnowledgePayload {
  sourceType: "api";
  sourceId: string;
  title: string;
  content: string;
  metadata: { ... };
}
```

### Modified Fields

- `SowPhase.estimatedHours` — now `number?` with `@deprecated`
- `SowDocumentV2.approval` — now `SowApproval | undefined` (optional)
- `SowLaborHours.format` — added `"v2.1"` option
- `SowLaborHours.totalHoursRange` — new optional field
- `SowLaborHours.rows` — union includes `SowLaborRowV21`

### Normalization

`normalizeSowJson()` handles all formats:

| Input Shape | Path |
|---|---|
| v2.1 native (`labor_hours.rows` with `hours_range`) | Direct mapping |
| v2.1 already-normalized (`hoursRange`) | Pass-through |
| v2.0 canonical (`multi_role`/`single_role`) | Strip pricing, convert |
| Legacy ad-hoc (`workloadEstimate.lineItems`) | Convert hours to ranges (N → "N–ceil(N*1.3)") |

---

## LLM Prompt Changes

The system prompt now instructs the LLM to output:

- `labor_hours.rows[]` with `{ role, scope, hours_range }` — **no rates, no pricing**
- `prerequisites` as a flat string array
- `caveats_and_risks.risks[]` with `{ risk, impact, mitigation }` (3-field)
- `project_management.contacts[]` with structured objects
- **No** `approval` section by default
- **No** `estimatedHours` on phases

---

## Export Formats

| Format | Route | Handler |
|--------|-------|---------|
| `pdf` | `POST /api/conversations/:id/export/pdf` | Legacy PDFKit (unchanged) |
| `docx` / `docx-detailed` | `POST /api/conversations/:id/export/docx` | `generateDocxV2()` via normalizer |
| `docx-legacy` | `POST /api/conversations/:id/export/docx-legacy` | Old DOCX renderer |
| `md` / `markdown` | `POST /api/conversations/:id/export/md` | `generateMarkdown()` via normalizer |

---

## Ducky Integration

Lightweight hooks prepared for cross-app wiring:

1. **Payload builder:** `sowToDuckyPayload(sow, conversationId)` in `shared/models/sow.ts`
2. **Stub endpoint:** `POST /api/conversations/:id/push-to-ducky` — returns ready payload as JSON
3. **Ducky ingestion:** `POST /api/knowledge` with `sourceType: "api"` (no Ducky changes needed)

Full service-to-service HTTP call deferred to integration go-live.

---

## Backward Compatibility

| Scenario | Handling |
|----------|----------|
| Old v2.0 `sowJson` in DB | `normalizeSowJson()` bridges at export time |
| Legacy `workloadEstimate.lineItems` | Auto-converted to v2.1 hour ranges |
| Old risk format (6-column) | Mapped to 3-column (mitigation merged) |
| Old prerequisites (object) | Merged to flat array |
| `SowPhase.estimatedHours` | Kept as optional, not rendered |

**No database migration required.**

---

## Validation

1. **Build:** `pnpm build --filter=caelum` passes
2. **New SoW:** Generate via chat — confirm `labor_hours` output (no rates), no per-phase hours
3. **DOCX export:** Verify cover (vendor header, "Scope of Work"), colors (#2E5090 H1, #1A1A1A H2, #333333 body), no approval (unless requested), labor table (Role/Scope/Hours), header/footer borders
4. **Markdown export:** Verify same structural compliance
5. **Legacy SoW:** Export old conversation — confirm normalization bridge works
6. **Ducky stub:** `POST /api/conversations/:id/push-to-ducky` returns correct payload shape
