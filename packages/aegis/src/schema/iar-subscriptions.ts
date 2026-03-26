/**
 * IAR Subscription Intelligence — Drizzle Schema
 *
 * Addendum A tables for CVG-AEGIS Identity Access Review.
 * Add these to packages/aegis/src/schema/iar.ts alongside existing IAR tables.
 *
 * Depends on:
 *   - aegis.iar_reviews (parent spec)
 *   - aegis.iar_user_snapshots (parent spec)
 *   - auth.tenants (UTM)
 */

import {
  pgTable,
  pgSchema,
  uuid,
  text,
  integer,
  boolean,
  decimal,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const aegis = pgSchema("aegis");

// ---------------------------------------------------------------------------
// Reference: existing tables (already defined in iar.ts — do NOT duplicate)
// These are here as type references only for the FK relationships.
// ---------------------------------------------------------------------------
// aegis.iar_reviews
// aegis.iar_user_snapshots

// ---------------------------------------------------------------------------
// NEW: aegis.iar_subscription_snapshots
// ---------------------------------------------------------------------------
// Stores subscription-level data captured at time of each IAR review.
// One row per subscription per review. Tenant-scoped via RLS.

export const iarSubscriptionSnapshots = aegis.table(
  "iar_subscription_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id").notNull(),
    // .references(() => iarReviews.id, { onDelete: "cascade" })
    tenantId: uuid("tenant_id").notNull(),
    // .references(() => tenants.id)

    // Subscription identity
    subscriptionName: text("subscription_name").notNull(),
    skuId: text("sku_id"), // Graph API skuId when available

    // Status & counts
    status: text("status").notNull(), // Active, Expired, Disabled, InGracePeriod, Warning
    totalLicenses: integer("total_licenses").notNull(),
    assignedLicenses: integer("assigned_licenses").notNull(),
    availableLicenses: integer("available_licenses").notNull(),
    utilizationPct: decimal("utilization_pct", { precision: 5, scale: 1 }),

    // Licensing terms
    billingRecurrence: text("billing_recurrence"), // Monthly, Annual, None, Unknown
    termDuration: text("term_duration"), // 1 Month, 1 Year, 3 Years, etc.
    startDate: timestamp("start_date", { withTimezone: true }),
    nextChargeDate: timestamp("next_charge_date", { withTimezone: true }),
    daysUntilRenewal: integer("days_until_renewal"),
    autoRenew: boolean("auto_renew"),
    isTrial: boolean("is_trial").default(false),

    // Cost (user-confirmed, never inferred)
    estAnnualCost: decimal("est_annual_cost", { precision: 12, scale: 2 }),
    costPerLicense: decimal("cost_per_license", { precision: 10, scale: 2 }),
    estWastedCost: decimal("est_wasted_cost", { precision: 12, scale: 2 }),

    // Flags & audit
    flags: text("flags"), // Semicolon-delimited subscription-level flags
    source: text("source").default("csv_export"), // csv_export, graph_api, manual
    rawData: jsonb("raw_data"), // Original row from CSV/API

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    reviewIdx: index("idx_iar_sub_snap_review").on(table.reviewId),
    tenantIdx: index("idx_iar_sub_snap_tenant").on(table.tenantId),
    renewalIdx: index("idx_iar_sub_snap_renewal").on(table.nextChargeDate),
  })
);

// ---------------------------------------------------------------------------
// NEW: aegis.iar_subscription_user_map
// ---------------------------------------------------------------------------
// Maps individual users to their subscription(s) within a review.
// Enables per-user subscription metadata on License Breakdown tab
// and supports historical tracking across reviews.

export const iarSubscriptionUserMap = aegis.table(
  "iar_subscription_user_map",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id").notNull(),
    // .references(() => iarReviews.id, { onDelete: "cascade" })
    tenantId: uuid("tenant_id").notNull(),
    // .references(() => tenants.id)
    userSnapshotId: uuid("user_snapshot_id").notNull(),
    // .references(() => iarUserSnapshots.id, { onDelete: "cascade" })
    subscriptionSnapshotId: uuid("subscription_snapshot_id").notNull(),
    // .references(() => iarSubscriptionSnapshots.id, { onDelete: "cascade" })

    matchedProductName: text("matched_product_name"), // Product string that triggered the match

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    reviewIdx: index("idx_iar_sub_user_review").on(table.reviewId),
    userIdx: index("idx_iar_sub_user_user").on(table.userSnapshotId),
    subIdx: index("idx_iar_sub_user_sub").on(table.subscriptionSnapshotId),
    uniqueMapping: uniqueIndex("uq_iar_sub_user_mapping").on(
      table.reviewId,
      table.userSnapshotId,
      table.subscriptionSnapshotId
    ),
  })
);

// ---------------------------------------------------------------------------
// Type exports for service layer
// ---------------------------------------------------------------------------
export type IarSubscriptionSnapshot =
  typeof iarSubscriptionSnapshots.$inferSelect;
export type NewIarSubscriptionSnapshot =
  typeof iarSubscriptionSnapshots.$inferInsert;
export type IarSubscriptionUserMap =
  typeof iarSubscriptionUserMap.$inferSelect;
export type NewIarSubscriptionUserMap =
  typeof iarSubscriptionUserMap.$inferInsert;
