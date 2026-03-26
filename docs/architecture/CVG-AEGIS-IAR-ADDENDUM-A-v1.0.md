# CVG-AEGIS-IDENTITY-REVIEW — Addendum A: Subscription Intelligence

**Document Code:** CVG-AEGIS-IAR-ADDENDUM-A-v1.0  
**Parent Spec:** CVG-AEGIS-IDENTITY-REVIEW-v1.0  
**Date:** 2026-03-26  
**Status:** APPROVED  
**Author:** Benjamin Posner / Claude (Architect)

---

## 1. Purpose

This addendum extends the AEGIS Identity Access Review module with subscription-level licensing intelligence. When an M365 subscription export is provided (or subscription data is pulled via Graph API in Phase 3), the IAR report is enriched with licensing term, billing frequency, renewal dates, utilization analysis, and cost optimization metrics.

**Design principle:** Subscription data is always optional. The IAR must generate a complete, useful report from the two required user-level CSVs alone. Subscription intelligence is an enrichment layer — it adds value when present but never blocks the core identity review.

---

## 2. Data Source

### 2.1 Manual Export (Phase 1–2)

**Source:** M365 Admin Center → Billing → Your products → Export  
**Permission:** Billing Admin or Global Admin  
**Format:** CSV with subscription-level metadata

Key columns: Subscription Name, Status, Total Licenses, Assigned Licenses, Billing Recurrence, Term Duration, Start Date, Next Charge Date, Auto-Renew, Trial.

Column names vary between tenant versions. The processing engine uses fuzzy matching against a known alias map (see processing-logic.md §2).

### 2.2 Graph API Direct Pull (Phase 3)

**Endpoint:** `GET /subscribedSkus` (Microsoft Graph API)  
**Permission scope:** `Organization.Read.All` (application) or `Directory.Read.All`  
**Returns:** SKU-level subscription data including `capabilityStatus`, `consumedUnits`, `prepaidUnits` (enabled/suspended/warning), `skuPartNumber`, `skuId`, `appliesTo`.

**Note:** Graph API does not expose billing frequency, term duration, renewal dates, or cost data. These fields require either the admin center export or manual confirmation at intake. Phase 3 implementation should auto-pull what Graph provides and prompt for the rest only when the subscription export CSV is not also provided.

### 2.3 Cost Data

Subscription cost is **never inferred or estimated.** It is provided in one of two ways:
1. **Intake confirmation:** The operator is presented with detected subscription names and asked to provide annual cost per subscription. This is the primary method.
2. **Manual entry:** The Subscription Overview tab includes an Est. Annual Cost column that can be left blank for the client to populate post-delivery.

---

## 3. Schema Additions

All new tables live in the `aegis` schema under existing RLS policies. Tenant isolation is enforced at every layer.

### 3.1 `aegis.iar_subscription_snapshots`

Stores subscription-level data captured at the time of each IAR review. One row per subscription per review.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `review_id` | UUID | FK → aegis.iar_reviews(id), NOT NULL | |
| `tenant_id` | UUID | FK → auth.tenants(id), NOT NULL | RLS enforced |
| `subscription_name` | TEXT | NOT NULL | Display name from export |
| `sku_id` | TEXT | | Graph API skuId when available |
| `status` | TEXT | NOT NULL | Active, Expired, Disabled, InGracePeriod, Warning |
| `total_licenses` | INTEGER | NOT NULL | Purchased seat count |
| `assigned_licenses` | INTEGER | NOT NULL | Seats assigned to users |
| `available_licenses` | INTEGER | NOT NULL | total - assigned |
| `utilization_pct` | DECIMAL(5,1) | | (assigned / total) × 100 |
| `billing_recurrence` | TEXT | | Monthly, Annual, None, Unknown |
| `term_duration` | TEXT | | 1 Month, 1 Year, 3 Years, etc. |
| `start_date` | TIMESTAMPTZ | | Subscription start |
| `next_charge_date` | TIMESTAMPTZ | | Next billing/renewal date |
| `days_until_renewal` | INTEGER | | Computed at snapshot time |
| `auto_renew` | BOOLEAN | | |
| `is_trial` | BOOLEAN | DEFAULT false | |
| `est_annual_cost` | DECIMAL(12,2) | | User-confirmed; NULL if not provided |
| `cost_per_license` | DECIMAL(10,2) | | est_annual_cost / total_licenses; NULL if cost not provided |
| `est_wasted_cost` | DECIMAL(12,2) | | cost_per_license × available_licenses; NULL if cost not provided |
| `flags` | TEXT | | Semicolon-delimited subscription-level flags |
| `source` | TEXT | DEFAULT 'csv_export' | csv_export, graph_api, manual |
| `raw_data` | JSONB | | Original row from CSV/API for audit |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `idx_iar_sub_snap_review` ON (review_id)
- `idx_iar_sub_snap_tenant` ON (tenant_id)
- `idx_iar_sub_snap_renewal` ON (next_charge_date) — supports renewal alerting queries

### 3.2 `aegis.iar_subscription_user_map`

Maps individual users to their subscription(s) within a review. Enables per-user subscription metadata on the License Breakdown tab and supports historical tracking of which users consumed which subscriptions over time.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `review_id` | UUID | FK → aegis.iar_reviews(id), NOT NULL | |
| `tenant_id` | UUID | FK → auth.tenants(id), NOT NULL | RLS enforced |
| `user_snapshot_id` | UUID | FK → aegis.iar_user_snapshots(id), NOT NULL | |
| `subscription_snapshot_id` | UUID | FK → aegis.iar_subscription_snapshots(id), NOT NULL | |
| `matched_product_name` | TEXT | | The specific product string that triggered the match |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `idx_iar_sub_user_review` ON (review_id)
- `idx_iar_sub_user_user` ON (user_snapshot_id)
- `idx_iar_sub_user_sub` ON (subscription_snapshot_id)

**Unique constraint:** (review_id, user_snapshot_id, subscription_snapshot_id)

### 3.3 Additions to `aegis.iar_reviews`

Two new columns on the existing reviews table:

| Column | Type | Notes |
|--------|------|-------|
| `has_subscription_data` | BOOLEAN | DEFAULT false — controls conditional logic in report generation and UI |
| `subscription_source` | TEXT | csv_export, graph_api, NULL |

---

## 4. Subscription-Level Risk Flags

Seven new flags, computed deterministically (no LLM). These appear on the Subscription Overview tab and roll up into the Executive Summary observations.

| Flag | Severity | Condition |
|------|----------|-----------|
| Over-Provisioned License | Medium | Utilization < 50% AND unused ≥ 5 |
| Under-Utilized License | Low | Utilization 50–75% AND unused ≥ 3 |
| Expiring ≤30 Days (No Auto-Renew) | High | Days until renewal ≤ 30 AND auto_renew = false |
| Expiring ≤60 Days (No Auto-Renew) | Medium | Days until renewal ≤ 60 AND auto_renew = false |
| Expiring ≤90 Days | Low | Days until renewal ≤ 90 (informational, regardless of auto-renew) |
| Trial Subscription Active | Medium | is_trial = true AND status = Active |
| Expired Subscription | High | status = Expired OR days_until_renewal ≤ 0 |

**Total IAR flag count:** 8 user-level + 7 subscription-level = 15 deterministic flags.

---

## 5. Report Output Changes

### 5.1 Executive Summary — Subscription Snapshot Block

Appended after the existing metrics table when `has_subscription_data = true`:

- Total Subscriptions (count)
- Total Purchased Licenses (sum across all subscriptions)
- Overall Utilization Rate (total assigned / total purchased)
- Subscriptions Expiring ≤90 Days (count + names)
- Subscriptions Without Auto-Renew (count)
- Est. Annual Licensing Cost (sum, or "Not Provided")
- Est. Annual Waste — Unused Seats (sum of wasted cost, or "Not Provided")

### 5.2 License Breakdown Tab — Enriched Columns

Four columns appended when subscription data is present:

| Column | Source | Multi-value |
|--------|--------|-------------|
| Licensing Term | subscription_snapshots.term_duration | Semicolon-delimited if multi-sub |
| Billing Frequency | subscription_snapshots.billing_recurrence | Semicolon-delimited if multi-sub |
| Renewal Date | subscription_snapshots.next_charge_date | Semicolon-delimited if multi-sub |
| Auto-Renew | subscription_snapshots.auto_renew | Semicolon-delimited if multi-sub |

Populated via the `iar_subscription_user_map` join.

### 5.3 Subscription Overview Tab (New — Tab 6)

Full subscription-level detail. See processing-logic.md §5 for column spec, sort order, and conditional formatting rules.

### 5.4 Historical Diffing (Phase 2+)

The delta engine already diffs user snapshots between reviews. With subscription snapshots stored, the diff extends to:
- New/removed subscriptions since last review
- Seat count changes (total, assigned, available)
- Utilization trend (improving/declining)
- Renewal date changes (extensions, shortened terms)
- Cost changes (if cost data provided on both reviews)

---

## 6. Tone Rules for Subscription Findings

Consistent with the IAR's existing tone policy — findings are optimization opportunities, not evidence of negligence.

| Finding Type | Correct Framing | Never Say |
|---|---|---|
| Over-provisioned | "License optimization opportunity — [N] unused seats available for reclamation or right-sizing at renewal." | "Wasted licenses" / "Mismanaged subscriptions" |
| Expiring soon | "Upcoming renewal — [subscription] renews on [date]. Recommend reviewing seat count and plan tier prior to renewal." | "Subscription lapsing" / "Billing failure risk" |
| Trial active | "Active trial subscription detected — recommend evaluating for conversion or removal before trial expiration." | "Unmanaged trial" |
| Low utilization | "Utilization at [X]% — consider right-sizing at next renewal or reallocating to users with active need." | "Paying for unused licenses" |

---

## 7. Phase Alignment

| Phase | Subscription Capability |
|-------|------------------------|
| **Phase 1** (Freemium) | CSV upload for all 3 files. Subscription data optional. Report generated client-side, no storage. |
| **Phase 2** (Full-Tier AEGIS) | Subscription snapshots stored in `aegis.iar_subscription_snapshots`. Historical diffing includes subscription changes. Cost tracking across reviews. |
| **Phase 3** (Graph API) | `subscribedSkus` endpoint supplements CSV data. Billing fields still require CSV or manual intake since Graph doesn't expose them. |
| **Phase 4** (Astra Integration) | Subscription utilization and cost data flow into Astra's license optimization dashboard. Renewal calendar widget. Cost trend reporting for vCIO decks. |

---

## 8. Build Instructions for Claude Code

**Migration:** Apply `015_iar_subscription_intelligence.sql` to add the two new tables and the two new columns on `aegis.iar_reviews`.

**Drizzle schema:** Update `packages/aegis/src/schema/iar.ts` with the new table definitions. Run `pnpm drizzle-kit generate` to verify migration alignment.

**Processing engine:** Update the IAR report generation service to:
1. Accept optional subscription CSV in the upload endpoint
2. Parse and normalize subscription columns using the fuzzy alias map
3. Compute subscription derived fields and flags
4. Map subscriptions to users via product name matching
5. Conditionally render enriched License Breakdown columns and Subscription Overview tab
6. Include subscription metrics in Executive Summary when present

**API contract:** The existing `POST /api/aegis/iar/generate` endpoint gains an optional `subscriptionFile` field in the multipart upload. Response shape unchanged — the XLSX output conditionally includes the extra tab.
