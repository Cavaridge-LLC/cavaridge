/**
 * CVG-CAVALIER — Channel Partner GTM Schema (Drizzle ORM)
 *
 * Tables for partner management, deal registration, commissions,
 * marketing assets, lead distribution, and performance tracking.
 *
 * All tables have tenant_id for RLS. FK to tenants from @cavaridge/auth/schema.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  date,
  real,
} from "drizzle-orm/pg-core";
import { tenants } from "@cavaridge/auth/schema";

// ─── Enums ──────────────────────────────────────────────────────────────

export const partnerTierEnum = pgEnum("partner_tier", [
  "registered",
  "silver",
  "gold",
  "platinum",
]);

export const partnerStatusEnum = pgEnum("partner_status", [
  "pending",
  "approved",
  "active",
  "suspended",
  "inactive",
]);

export const dealStatusEnum = pgEnum("deal_status", [
  "registered",
  "qualified",
  "won",
  "lost",
  "expired",
]);

export const commissionStatusEnum = pgEnum("commission_status", [
  "pending",
  "earned",
  "paid",
  "cancelled",
]);

export const assetAccessTierEnum = pgEnum("asset_access_tier", [
  "registered",
  "silver",
  "gold",
  "platinum",
  "all",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "assigned",
  "accepted",
  "rejected",
  "converted",
  "expired",
]);

// ─── Channel Partners ──────────────────────────────────────────────────

/**
 * Channel partner profiles — MSPs reselling Cavaridge products.
 * Each partner is also a tenant (type=msp) in the UTM.
 */
export const channelPartners = pgTable("channel_partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  website: text("website"),
  tier: partnerTierEnum("tier").notNull().default("registered"),
  status: partnerStatusEnum("status").notNull().default("pending"),
  geography: text("geography"),
  specializations: jsonb("specializations").default([]),
  certifications: jsonb("certifications").default([]),
  techCount: integer("tech_count").default(1),
  assignedPsm: uuid("assigned_psm"),
  roundRobinWeight: integer("round_robin_weight").default(1),
  totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 }).default("0"),
  totalDeals: integer("total_deals").default(0),
  dealsWon: integer("deals_won").default(0),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_channel_partners_tenant").on(table.tenantId),
  index("idx_channel_partners_tier").on(table.tier),
  index("idx_channel_partners_status").on(table.status),
  index("idx_channel_partners_geography").on(table.geography),
  uniqueIndex("uq_channel_partners_email").on(table.tenantId, table.contactEmail),
]);

// ─── Deal Registration ─────────────────────────────────────────────────

/**
 * Deal registration — partners register prospective deals.
 * Conflict detection prevents multiple partners registering the same prospect.
 */
export const dealRegistrations = pgTable("deal_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  partnerId: uuid("partner_id").notNull().references(() => channelPartners.id),
  dealNumber: text("deal_number").notNull(),
  prospectName: text("prospect_name").notNull(),
  prospectEmail: text("prospect_email"),
  prospectPhone: text("prospect_phone"),
  prospectCompany: text("prospect_company").notNull(),
  prospectDomain: text("prospect_domain"),
  productCodes: jsonb("product_codes").notNull().default([]),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  estimatedCloseDate: date("estimated_close_date"),
  status: dealStatusEnum("status").notNull().default("registered"),
  lostReason: text("lost_reason"),
  wonAt: timestamp("won_at", { withTimezone: true }),
  lostAt: timestamp("lost_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  conflictDetected: boolean("conflict_detected").default(false),
  conflictPartnerId: uuid("conflict_partner_id"),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_deals_tenant").on(table.tenantId),
  index("idx_deals_partner").on(table.partnerId),
  index("idx_deals_status").on(table.status),
  index("idx_deals_prospect_domain").on(table.tenantId, table.prospectDomain),
  uniqueIndex("uq_deals_number").on(table.tenantId, table.dealNumber),
]);

// ─── Commission Structures ─────────────────────────────────────────────

/**
 * Commission rate structures per product and partner tier.
 * Platform-level definitions — one row per product+tier combination.
 */
export const commissionStructures = pgTable("commission_structures", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  partnerTier: partnerTierEnum("partner_tier").notNull(),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull(),
  recurringPercent: numeric("recurring_percent", { precision: 5, scale: 2 }).default("0"),
  recurringMonths: integer("recurring_months").default(12),
  bonusThreshold: numeric("bonus_threshold", { precision: 12, scale: 2 }),
  bonusPercent: numeric("bonus_percent", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_commission_structures_tenant").on(table.tenantId),
  uniqueIndex("uq_commission_product_tier").on(table.tenantId, table.productCode, table.partnerTier),
]);

// ─── Commission Records ────────────────────────────────────────────────

/**
 * Actual commission records earned by partners on closed deals.
 * Tracks lifecycle: pending → earned → paid.
 */
export const commissionRecords = pgTable("commission_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  partnerId: uuid("partner_id").notNull().references(() => channelPartners.id),
  dealId: uuid("deal_id").notNull().references(() => dealRegistrations.id),
  structureId: uuid("structure_id").references(() => commissionStructures.id),
  productCode: text("product_code").notNull(),
  dealValue: numeric("deal_value", { precision: 12, scale: 2 }).notNull(),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurringMonth: integer("recurring_month"),
  status: commissionStatusEnum("status").notNull().default("pending"),
  earnedAt: timestamp("earned_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_commissions_tenant").on(table.tenantId),
  index("idx_commissions_partner").on(table.partnerId),
  index("idx_commissions_deal").on(table.dealId),
  index("idx_commissions_status").on(table.status),
]);

// ─── Marketing Assets ──────────────────────────────────────────────────

/**
 * Co-branded marketing materials organized by category and tier access.
 */
export const marketingAssets = pgTable("marketing_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  thumbnailUrl: text("thumbnail_url"),
  accessTier: assetAccessTierEnum("access_tier").notNull().default("all"),
  productCodes: jsonb("product_codes").default([]),
  tags: jsonb("tags").default([]),
  downloadCount: integer("download_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_marketing_assets_tenant").on(table.tenantId),
  index("idx_marketing_assets_category").on(table.category),
  index("idx_marketing_assets_tier").on(table.accessTier),
]);

// ─── Lead Distribution ─────────────────────────────────────────────────

/**
 * Inbound leads distributed to partners based on geography,
 * specialization, and tier with weighted round-robin.
 */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  leadNumber: text("lead_number").notNull(),
  prospectName: text("prospect_name").notNull(),
  prospectEmail: text("prospect_email"),
  prospectPhone: text("prospect_phone"),
  prospectCompany: text("prospect_company").notNull(),
  geography: text("geography"),
  productInterest: jsonb("product_interest").default([]),
  source: text("source"),
  status: leadStatusEnum("status").notNull().default("new"),
  assignedPartnerId: uuid("assigned_partner_id").references(() => channelPartners.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  convertedDealId: uuid("converted_deal_id"),
  score: real("score"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_leads_tenant").on(table.tenantId),
  index("idx_leads_status").on(table.status),
  index("idx_leads_partner").on(table.assignedPartnerId),
  index("idx_leads_geography").on(table.geography),
  uniqueIndex("uq_leads_number").on(table.tenantId, table.leadNumber),
]);

// ─── Round Robin State ─────────────────────────────────────────────────

/**
 * Tracks the last assigned partner per geography for round-robin distribution.
 */
export const roundRobinState = pgTable("round_robin_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  geography: text("geography").notNull(),
  lastPartnerId: uuid("last_partner_id").references(() => channelPartners.id),
  lastAssignedAt: timestamp("last_assigned_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("uq_round_robin_geo").on(table.tenantId, table.geography),
]);

// ─── Partner Scorecards ────────────────────────────────────────────────

/**
 * Periodic partner performance snapshots for dashboard and reporting.
 */
export const partnerScorecards = pgTable("partner_scorecards", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  partnerId: uuid("partner_id").notNull().references(() => channelPartners.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dealsRegistered: integer("deals_registered").default(0),
  dealsWon: integer("deals_won").default(0),
  dealsLost: integer("deals_lost").default(0),
  revenue: numeric("revenue", { precision: 12, scale: 2 }).default("0"),
  commissionEarned: numeric("commission_earned", { precision: 12, scale: 2 }).default("0"),
  commissionPaid: numeric("commission_paid", { precision: 12, scale: 2 }).default("0"),
  leadsReceived: integer("leads_received").default(0),
  leadsConverted: integer("leads_converted").default(0),
  certificationCount: integer("certification_count").default(0),
  overallScore: real("overall_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_scorecards_tenant").on(table.tenantId),
  index("idx_scorecards_partner").on(table.partnerId),
  uniqueIndex("uq_scorecards_period").on(table.tenantId, table.partnerId, table.periodStart),
]);

// ─── Schema exports ────────────────────────────────────────────────────

export type ChannelPartner = typeof channelPartners.$inferSelect;
export type NewChannelPartner = typeof channelPartners.$inferInsert;
export type DealRegistration = typeof dealRegistrations.$inferSelect;
export type NewDealRegistration = typeof dealRegistrations.$inferInsert;
export type CommissionStructure = typeof commissionStructures.$inferSelect;
export type CommissionRecord = typeof commissionRecords.$inferSelect;
export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type PartnerScorecard = typeof partnerScorecards.$inferSelect;
