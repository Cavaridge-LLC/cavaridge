import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import { organizations, users, deals, documents, usageTracking, baselineProfiles } from "@shared/schema";
import type { Organization } from "@shared/schema";

export type PlanTier = "starter" | "professional" | "enterprise";
export type LimitType = "users" | "deals" | "storage" | "documents" | "queries" | "baselines";

export interface PlanLimits {
  maxUsers: number;
  maxActiveDeals: number;
  maxStorageGb: number;
  maxDocumentsPerDeal: number;
  maxQueriesPerMonth: number;
  portfolioAnalytics: boolean;
  digitalTwinSimulator: boolean;
  maxBaselineProfiles: number;
  auditLogRetentionDays: number;
  whiteLabel: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    maxUsers: 5,
    maxActiveDeals: 5,
    maxStorageGb: 5,
    maxDocumentsPerDeal: 500,
    maxQueriesPerMonth: 100,
    portfolioAnalytics: false,
    digitalTwinSimulator: false,
    maxBaselineProfiles: 1,
    auditLogRetentionDays: 30,
    whiteLabel: false,
    apiAccess: false,
    prioritySupport: false,
  },
  professional: {
    maxUsers: 25,
    maxActiveDeals: 25,
    maxStorageGb: 50,
    maxDocumentsPerDeal: 2000,
    maxQueriesPerMonth: 1000,
    portfolioAnalytics: true,
    digitalTwinSimulator: true,
    maxBaselineProfiles: 5,
    auditLogRetentionDays: 365,
    whiteLabel: false,
    apiAccess: false,
    prioritySupport: true,
  },
  enterprise: {
    maxUsers: -1,
    maxActiveDeals: -1,
    maxStorageGb: 500,
    maxDocumentsPerDeal: -1,
    maxQueriesPerMonth: -1,
    portfolioAnalytics: true,
    digitalTwinSimulator: true,
    maxBaselineProfiles: -1,
    auditLogRetentionDays: -1,
    whiteLabel: true,
    apiAccess: true,
    prioritySupport: true,
  },
};

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  limitType: LimitType;
  planTier: PlanTier;
  unlimited: boolean;
}

function getPlanTier(org: Organization): PlanTier {
  const tier = (org.planTier || "starter") as string;
  if (tier in PLAN_LIMITS) return tier as PlanTier;
  return "starter";
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function checkPlanLimit(
  organizationId: string,
  limitType: LimitType,
  dealId?: string
): Promise<LimitCheckResult> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org) throw new Error("Organization not found");

  const tier = getPlanTier(org);
  const limits = PLAN_LIMITS[tier];

  switch (limitType) {
    case "users": {
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
        .from(users).where(eq(users.organizationId, organizationId));
      const current = result?.count || 0;
      const limit = limits.maxUsers;
      return { allowed: limit === -1 || current < limit, current, limit, limitType, planTier: tier, unlimited: limit === -1 };
    }
    case "deals": {
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
        .from(deals).where(and(eq(deals.organizationId, organizationId), sql`stage != 'Closed'`));
      const current = result?.count || 0;
      const limit = limits.maxActiveDeals;
      return { allowed: limit === -1 || current < limit, current, limit, limitType, planTier: tier, unlimited: limit === -1 };
    }
    case "storage": {
      const orgDeals = await db.select({ id: deals.id }).from(deals).where(eq(deals.organizationId, organizationId));
      const dealIds = orgDeals.map(d => d.id);
      let currentBytes = 0;
      if (dealIds.length > 0) {
        const [result] = await db.select({ total: sql<number>`coalesce(sum(file_size), 0)::bigint` })
          .from(documents).where(inArray(documents.dealId, dealIds));
        currentBytes = Number(result?.total || 0);
      }
      const currentGb = currentBytes / (1024 * 1024 * 1024);
      const limit = limits.maxStorageGb;
      return { allowed: limit === -1 || currentGb < limit, current: Math.round(currentGb * 100) / 100, limit, limitType, planTier: tier, unlimited: limit === -1 };
    }
    case "documents": {
      if (!dealId) throw new Error("dealId required for documents limit check");
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
        .from(documents).where(eq(documents.dealId, dealId));
      const current = result?.count || 0;
      const limit = limits.maxDocumentsPerDeal;
      return { allowed: limit === -1 || current < limit, current, limit, limitType, planTier: tier, unlimited: limit === -1 };
    }
    case "queries": {
      const period = currentPeriod();
      const [result] = await db.select({ count: usageTracking.count })
        .from(usageTracking)
        .where(and(
          eq(usageTracking.organizationId, organizationId),
          eq(usageTracking.metric, "chat_queries"),
          eq(usageTracking.period, period)
        ));
      const current = result?.count || 0;
      const limit = limits.maxQueriesPerMonth;
      return { allowed: limit === -1 || current < limit, current, limit, limitType, planTier: tier, unlimited: limit === -1 };
    }
    case "baselines": {
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
        .from(baselineProfiles).where(eq(baselineProfiles.organizationId, organizationId));
      const current = result?.count || 0;
      const limit = limits.maxBaselineProfiles;
      return { allowed: limit === -1 || current < limit, current, limit, limitType, planTier: tier, unlimited: limit === -1 };
    }
    default:
      throw new Error(`Unknown limit type: ${limitType}`);
  }
}

export async function incrementUsage(
  organizationId: string,
  metric: string,
  amount: number = 1
): Promise<void> {
  const period = currentPeriod();
  await db.execute(sql`
    INSERT INTO usage_tracking (id, organization_id, metric, period, count, updated_at)
    VALUES (gen_random_uuid(), ${organizationId}, ${metric}, ${period}, ${amount}, NOW())
    ON CONFLICT (organization_id, metric, period)
    DO UPDATE SET count = usage_tracking.count + ${amount}, updated_at = NOW()
  `);
}

export async function getUsageSummary(organizationId: string): Promise<{
  users: LimitCheckResult;
  deals: LimitCheckResult;
  storage: LimitCheckResult;
  queries: LimitCheckResult;
  baselines: LimitCheckResult;
  planTier: PlanTier;
  planLimits: PlanLimits;
}> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org) throw new Error("Organization not found");

  const tier = getPlanTier(org);

  const [usersCheck, dealsCheck, storageCheck, queriesCheck, baselinesCheck] = await Promise.all([
    checkPlanLimit(organizationId, "users"),
    checkPlanLimit(organizationId, "deals"),
    checkPlanLimit(organizationId, "storage"),
    checkPlanLimit(organizationId, "queries"),
    checkPlanLimit(organizationId, "baselines"),
  ]);

  return {
    users: usersCheck,
    deals: dealsCheck,
    storage: storageCheck,
    queries: queriesCheck,
    baselines: baselinesCheck,
    planTier: tier,
    planLimits: PLAN_LIMITS[tier],
  };
}

export function getNextTier(current: PlanTier): PlanTier | null {
  if (current === "starter") return "professional";
  if (current === "professional") return "enterprise";
  return null;
}

export function tierLabel(tier: PlanTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function limitLabel(limitType: LimitType): string {
  const labels: Record<LimitType, string> = {
    users: "users",
    deals: "active deals",
    storage: "GB of storage",
    documents: "documents per deal",
    queries: "AI queries this month",
    baselines: "baseline profiles",
  };
  return labels[limitType];
}
