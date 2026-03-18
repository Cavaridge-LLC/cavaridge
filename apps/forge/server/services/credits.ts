/**
 * Credit Tracking Service
 *
 * Manages per-tenant credit balances and usage logging.
 * Subscription tiers: free (50 credits), pro (500), business (2000), enterprise (custom).
 */

import { db } from "../db";
import { forgeTenantCredits, forgeUsage } from "@shared/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { ValidationError } from "../utils/errors";

export interface CreditBalance {
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  tier: string;
}

/** Get credit balance for a tenant */
export async function getCreditBalance(tenantId: string): Promise<CreditBalance> {
  const [credits] = await db
    .select()
    .from(forgeTenantCredits)
    .where(eq(forgeTenantCredits.tenantId, tenantId));

  if (!credits) {
    // Auto-provision free tier for new tenants
    await db.insert(forgeTenantCredits).values({
      tenantId,
      totalCredits: 50,
      usedCredits: 0,
      tier: "free",
    }).onConflictDoNothing();

    return { totalCredits: 50, usedCredits: 0, availableCredits: 50, tier: "free" };
  }

  return {
    totalCredits: credits.totalCredits,
    usedCredits: credits.usedCredits,
    availableCredits: credits.totalCredits - credits.usedCredits,
    tier: credits.tier,
  };
}

/** Check if tenant has enough credits */
export async function hasCredits(tenantId: string, requiredCredits: number): Promise<boolean> {
  const balance = await getCreditBalance(tenantId);
  return balance.availableCredits >= requiredCredits;
}

/** Consume credits for a project */
export async function consumeCredits(
  tenantId: string,
  userId: string,
  projectId: string,
  credits: number,
  creditType: "production" | "revision" | "free_revision",
): Promise<void> {
  if (creditType !== "free_revision") {
    const balance = await getCreditBalance(tenantId);
    if (balance.availableCredits < credits) {
      throw new ValidationError(`Insufficient credits. Need ${credits}, have ${balance.availableCredits}.`);
    }

    await db.update(forgeTenantCredits).set({
      usedCredits: sql`${forgeTenantCredits.usedCredits} + ${credits}`,
      updatedAt: new Date(),
    }).where(eq(forgeTenantCredits.tenantId, tenantId));
  }

  // Log usage
  await db.insert(forgeUsage).values({
    tenantId,
    userId,
    projectId,
    creditsUsed: credits,
    creditType,
    billingPeriod: getFirstOfMonth(),
  });
}

/** Get usage summary for current billing period */
export async function getUsageSummary(tenantId: string) {
  const firstOfMonth = getFirstOfMonth();

  const usage = await db
    .select()
    .from(forgeUsage)
    .where(and(
      eq(forgeUsage.tenantId, tenantId),
      gte(forgeUsage.billingPeriod, firstOfMonth),
    ));

  const totalUsed = usage.reduce((sum, u) => sum + u.creditsUsed, 0);
  const byType = {
    production: usage.filter((u) => u.creditType === "production").reduce((sum, u) => sum + u.creditsUsed, 0),
    revision: usage.filter((u) => u.creditType === "revision").reduce((sum, u) => sum + u.creditsUsed, 0),
    freeRevision: usage.filter((u) => u.creditType === "free_revision").reduce((sum, u) => sum + u.creditsUsed, 0),
  };

  return { totalUsed, byType, entries: usage };
}

function getFirstOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
