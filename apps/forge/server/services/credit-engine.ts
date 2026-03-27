/**
 * Forge Credit Engine
 *
 * Production credit management: balance queries, atomic deductions,
 * cost estimation, and refunds. All operations are tenant-scoped.
 *
 * Credit costs per content type:
 *   blog_post: 5 | whitepaper: 15 | case_study: 10 | social_post: 2
 *   email_sequence: 8 | presentation: 12 | landing_page: 10
 *
 * Plan tiers:
 *   free: 25/mo | starter: 100/mo ($29) | professional: 500/mo ($99) | enterprise: unlimited
 */

import { db } from "../db";
import { forgeTenantCredits, forgeUsage, forgeContent } from "@shared/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import type { ForgeBrief } from "@shared/models/pipeline";

// ── Types ──

export interface CreditBalance {
  tenantId: string;
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  tier: PlanTier;
  isUnlimited: boolean;
  resetAt: Date | null;
}

export interface DeductResult {
  success: boolean;
  previousBalance: number;
  newBalance: number;
  creditsDeducted: number;
  usageId: string;
}

export type PlanTier = "free" | "starter" | "professional" | "enterprise";

export interface PlanConfig {
  tier: PlanTier;
  monthlyCredits: number;
  priceUsd: number;
  isUnlimited: boolean;
}

// ── Constants ──

/** Credit cost by content type. Maps pipeline content types to the spec's naming. */
const CREDIT_COSTS: Record<string, number> = {
  blog_post: 5,
  white_paper: 15,
  case_study: 10,
  social_media_series: 2,
  email_campaign: 8,
  proposal: 12,
  one_pager: 10,
  custom: 8,
};

/** Complexity multipliers based on brief attributes */
const COMPLEXITY_MULTIPLIERS = {
  /** Extra research notes add cost */
  hasReferenceNotes: 1.2,
  /** Professional/academic tone requires more refinement passes */
  complexTone: 1.15,
  /** Using a brand voice adds voice-matching overhead */
  hasBrandVoice: 1.1,
};

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: { tier: "free", monthlyCredits: 25, priceUsd: 0, isUnlimited: false },
  starter: { tier: "starter", monthlyCredits: 100, priceUsd: 29, isUnlimited: false },
  professional: { tier: "professional", monthlyCredits: 500, priceUsd: 99, isUnlimited: false },
  enterprise: { tier: "enterprise", monthlyCredits: 0, priceUsd: 0, isUnlimited: true },
};

// ── Credit Balance ──

/**
 * Fetch the current credit balance for a tenant.
 * Auto-provisions free tier for tenants without a credit record.
 */
export async function getCreditBalance(tenantId: string): Promise<CreditBalance> {
  const [credits] = await db
    .select()
    .from(forgeTenantCredits)
    .where(eq(forgeTenantCredits.tenantId, tenantId));

  if (!credits) {
    // Auto-provision free tier
    const now = new Date();
    const resetAt = getNextResetDate();

    await db.insert(forgeTenantCredits).values({
      tenantId,
      totalCredits: PLAN_CONFIGS.free.monthlyCredits,
      usedCredits: 0,
      tier: "free",
      resetAt,
    }).onConflictDoNothing();

    return {
      tenantId,
      totalCredits: PLAN_CONFIGS.free.monthlyCredits,
      usedCredits: 0,
      availableCredits: PLAN_CONFIGS.free.monthlyCredits,
      tier: "free",
      isUnlimited: false,
      resetAt,
    };
  }

  const tier = credits.tier as PlanTier;
  const isUnlimited = tier === "enterprise";

  return {
    tenantId,
    totalCredits: credits.totalCredits,
    usedCredits: credits.usedCredits,
    availableCredits: isUnlimited
      ? Infinity
      : credits.totalCredits - credits.usedCredits,
    tier,
    isUnlimited,
    resetAt: credits.resetAt,
  };
}

// ── Pre-check ──

/**
 * Check whether a tenant has enough credits for a generation.
 * Enterprise tenants always return true (unlimited).
 */
export async function hasEnoughCredits(
  tenantId: string,
  requiredCredits: number,
): Promise<boolean> {
  const balance = await getCreditBalance(tenantId);
  if (balance.isUnlimited) return true;
  return balance.availableCredits >= requiredCredits;
}

// ── Deduction ──

/**
 * Atomically deduct credits and log usage.
 * Uses a SQL conditional update to prevent overdraft — the UPDATE
 * only applies if (total_credits - used_credits) >= creditsUsed,
 * ensuring no race conditions.
 *
 * Enterprise tenants skip the balance update but still log usage.
 */
export async function deductCredits(
  tenantId: string,
  contentId: string,
  creditsUsed: number,
  modelUsed: string,
): Promise<DeductResult> {
  const balance = await getCreditBalance(tenantId);

  if (!balance.isUnlimited) {
    if (balance.availableCredits < creditsUsed) {
      return {
        success: false,
        previousBalance: balance.availableCredits,
        newBalance: balance.availableCredits,
        creditsDeducted: 0,
        usageId: "",
      };
    }

    // Atomic conditional update — prevents overdraft under concurrency
    const result = await db
      .update(forgeTenantCredits)
      .set({
        usedCredits: sql`${forgeTenantCredits.usedCredits} + ${creditsUsed}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(forgeTenantCredits.tenantId, tenantId),
          sql`(${forgeTenantCredits.totalCredits} - ${forgeTenantCredits.usedCredits}) >= ${creditsUsed}`,
        ),
      )
      .returning();

    if (result.length === 0) {
      // Concurrent deduction beat us — balance insufficient
      return {
        success: false,
        previousBalance: balance.availableCredits,
        newBalance: balance.availableCredits,
        creditsDeducted: 0,
        usageId: "",
      };
    }
  }

  // Log usage record
  const [usageRecord] = await db.insert(forgeUsage).values({
    tenantId,
    userId: await getContentCreator(contentId),
    contentId,
    creditsUsed,
    creditType: "production",
    billingPeriod: getFirstOfMonth(),
  }).returning();

  // Update actual_credits on the content record
  await db
    .update(forgeContent)
    .set({ actualCredits: creditsUsed, updatedAt: new Date() })
    .where(eq(forgeContent.id, contentId));

  return {
    success: true,
    previousBalance: balance.isUnlimited ? Infinity : balance.availableCredits,
    newBalance: balance.isUnlimited
      ? Infinity
      : balance.availableCredits - creditsUsed,
    creditsDeducted: creditsUsed,
    usageId: usageRecord.id,
  };
}

// ── Estimation ──

/**
 * Estimate the credit cost for a generation based on the brief.
 * Returns an integer credit count (rounded up).
 *
 * Formula: baseCost * complexityMultipliers (rounded up)
 */
export function estimateCreditCost(brief: ForgeBrief): number {
  const baseCost = CREDIT_COSTS[brief.contentType] ?? CREDIT_COSTS.custom;
  let multiplier = 1.0;

  // Reference notes indicate more research overhead
  if (brief.referenceNotes && brief.referenceNotes.length > 100) {
    multiplier *= COMPLEXITY_MULTIPLIERS.hasReferenceNotes;
  }

  // Academic/technical tone requires extra refinement
  if (brief.tone === "academic" || brief.tone === "technical") {
    multiplier *= COMPLEXITY_MULTIPLIERS.complexTone;
  }

  // Brand voice matching adds overhead
  if (brief.brandVoiceId) {
    multiplier *= COMPLEXITY_MULTIPLIERS.hasBrandVoice;
  }

  return Math.ceil(baseCost * multiplier);
}

/**
 * Return the base credit cost for a content type string.
 * Used by the estimate endpoint when only content type is known.
 */
export function getBaseCreditCost(contentType: string): number {
  return CREDIT_COSTS[contentType] ?? CREDIT_COSTS.custom;
}

// ── Refund ──

/**
 * Refund credits for a failed generation.
 * Decrements used_credits on the tenant and logs a negative usage record
 * with the refund reason in metadata.
 */
export async function refundCredits(
  tenantId: string,
  contentId: string,
  reason: string,
): Promise<void> {
  // Find the original usage record for this content
  const [usageRecord] = await db
    .select()
    .from(forgeUsage)
    .where(
      and(
        eq(forgeUsage.tenantId, tenantId),
        eq(forgeUsage.contentId, contentId),
        eq(forgeUsage.creditType, "production"),
      ),
    )
    .orderBy(desc(forgeUsage.createdAt))
    .limit(1);

  if (!usageRecord) {
    // No usage record found — nothing to refund (enterprise or never charged)
    return;
  }

  const creditsToRefund = usageRecord.creditsUsed;

  // Decrement used credits on the tenant
  await db
    .update(forgeTenantCredits)
    .set({
      usedCredits: sql`GREATEST(${forgeTenantCredits.usedCredits} - ${creditsToRefund}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(forgeTenantCredits.tenantId, tenantId));

  // Log the refund as a negative usage record with free_revision type
  await db.insert(forgeUsage).values({
    tenantId,
    userId: usageRecord.userId,
    contentId,
    creditsUsed: -creditsToRefund,
    creditType: "free_revision",
    billingPeriod: getFirstOfMonth(),
  });

  // Clear actual_credits on the content record
  await db
    .update(forgeContent)
    .set({ actualCredits: 0, updatedAt: new Date() })
    .where(eq(forgeContent.id, contentId));
}

// ── Usage History ──

export interface UsageHistoryEntry {
  id: string;
  contentId: string;
  creditsUsed: number;
  creditType: string;
  createdAt: Date;
}

export interface UsageBreakdown {
  contentType: string;
  totalCredits: number;
  count: number;
}

/**
 * Fetch usage history for the current billing period.
 */
export async function getUsageHistory(
  tenantId: string,
  limit = 50,
): Promise<UsageHistoryEntry[]> {
  const firstOfMonth = getFirstOfMonth();

  const records = await db
    .select()
    .from(forgeUsage)
    .where(
      and(
        eq(forgeUsage.tenantId, tenantId),
        gte(forgeUsage.billingPeriod, firstOfMonth),
      ),
    )
    .orderBy(desc(forgeUsage.createdAt))
    .limit(limit);

  return records.map((r) => ({
    id: r.id,
    contentId: r.contentId,
    creditsUsed: r.creditsUsed,
    creditType: r.creditType,
    createdAt: r.createdAt,
  }));
}

/**
 * Get usage breakdown by content type for the last 30 days.
 */
export async function getUsageByContentType(
  tenantId: string,
): Promise<UsageBreakdown[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Join usage with content to get content type breakdown
  const usageRecords = await db
    .select({
      contentType: forgeContent.contentType,
      creditsUsed: forgeUsage.creditsUsed,
    })
    .from(forgeUsage)
    .innerJoin(forgeContent, eq(forgeUsage.contentId, forgeContent.id))
    .where(
      and(
        eq(forgeUsage.tenantId, tenantId),
        gte(forgeUsage.createdAt, thirtyDaysAgo),
        sql`${forgeUsage.creditsUsed} > 0`,
      ),
    );

  // Aggregate in application layer
  const byType = new Map<string, { totalCredits: number; count: number }>();

  for (const record of usageRecords) {
    const type = record.contentType;
    const existing = byType.get(type) ?? { totalCredits: 0, count: 0 };
    existing.totalCredits += record.creditsUsed;
    existing.count += 1;
    byType.set(type, existing);
  }

  return Array.from(byType.entries()).map(([contentType, data]) => ({
    contentType,
    ...data,
  }));
}

// ── Helpers ──

function getFirstOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getNextResetDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

async function getContentCreator(contentId: string): Promise<string> {
  const [content] = await db
    .select({ createdBy: forgeContent.createdBy })
    .from(forgeContent)
    .where(eq(forgeContent.id, contentId))
    .limit(1);

  return content?.createdBy ?? "unknown";
}
