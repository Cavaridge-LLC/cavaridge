/**
 * Dashboard Aggregation Service — CVG-ASTRA
 *
 * MSP portfolio-level metrics: all tenants, total spend,
 * identified savings, optimization status.
 */

import { db } from "../db.js";
import {
  tenantConnections,
  licenseAudits,
  recommendations,
  optimizationPlans,
} from "@shared/schema";
import { tenants } from "@cavaridge/auth/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { PortfolioSummary, TenantDashboardEntry } from "../types/index.js";

/**
 * Get portfolio summary for all tenants accessible to the given MSP tenant.
 */
export async function getPortfolioSummary(
  mspTenantId: string,
): Promise<PortfolioSummary> {
  // Get all tenant connections for this MSP
  const connections = await db
    .select()
    .from(tenantConnections)
    .where(eq(tenantConnections.tenantId, mspTenantId));

  if (connections.length === 0) {
    return {
      totalTenants: 0,
      totalLicenseSpend: 0,
      totalIdentifiedSavings: 0,
      optimizationRate: 0,
      tenantSummaries: [],
    };
  }

  const tenantSummaries: TenantDashboardEntry[] = [];
  let totalSpend = 0;
  let totalSavings = 0;
  let optimizedCount = 0;

  for (const conn of connections) {
    // Get latest audit for this connection
    const [latestAudit] = await db
      .select()
      .from(licenseAudits)
      .where(
        and(
          eq(licenseAudits.tenantId, mspTenantId),
          eq(licenseAudits.connectionId, conn.id),
          eq(licenseAudits.status, "completed"),
        ),
      )
      .orderBy(desc(licenseAudits.completedAt))
      .limit(1);

    const monthlySpend = latestAudit?.totalMonthlyCost ?? 0;
    const wastedCost = latestAudit?.totalWastedCost ?? 0;
    const userCount = latestAudit?.totalUsers ?? 0;
    const wastePercentage = monthlySpend > 0 ? (wastedCost / monthlySpend) * 100 : 0;

    totalSpend += monthlySpend;
    totalSavings += wastedCost;

    // Check optimization status
    let status: TenantDashboardEntry["optimizationStatus"] = "not_started";
    if (latestAudit) {
      const [activePlan] = await db
        .select()
        .from(optimizationPlans)
        .where(
          and(
            eq(optimizationPlans.tenantId, mspTenantId),
            eq(optimizationPlans.auditId, latestAudit.id),
          ),
        )
        .limit(1);

      if (activePlan?.status === "completed") {
        status = "optimized";
        optimizedCount++;
      } else if (activePlan) {
        status = "in_progress";
      } else if (wastePercentage < 5) {
        status = "optimized";
        optimizedCount++;
      } else {
        status = "needs_review";
      }
    }

    tenantSummaries.push({
      tenantId: conn.tenantId,
      tenantName: conn.name,
      userCount,
      monthlySpend,
      identifiedSavings: wastedCost,
      wastePercentage: Math.round(wastePercentage * 10) / 10,
      lastAuditDate: latestAudit?.completedAt ?? null,
      optimizationStatus: status,
    });
  }

  return {
    totalTenants: connections.length,
    totalLicenseSpend: Math.round(totalSpend * 100) / 100,
    totalIdentifiedSavings: Math.round(totalSavings * 100) / 100,
    optimizationRate: connections.length > 0
      ? Math.round((optimizedCount / connections.length) * 100)
      : 0,
    tenantSummaries,
  };
}

/**
 * Get audit history for a specific tenant connection.
 */
export async function getAuditHistory(
  tenantId: string,
  connectionId: number,
  limit = 10,
) {
  return db
    .select()
    .from(licenseAudits)
    .where(
      and(
        eq(licenseAudits.tenantId, tenantId),
        eq(licenseAudits.connectionId, connectionId),
      ),
    )
    .orderBy(desc(licenseAudits.createdAt))
    .limit(limit);
}

/**
 * Get savings trend data for charting.
 */
export async function getSavingsTrend(
  tenantId: string,
  connectionId?: number,
) {
  const conditions = [eq(licenseAudits.tenantId, tenantId)];
  if (connectionId !== undefined) {
    conditions.push(eq(licenseAudits.connectionId, connectionId));
  }

  const audits = await db
    .select({
      id: licenseAudits.id,
      totalMonthlyCost: licenseAudits.totalMonthlyCost,
      totalWastedCost: licenseAudits.totalWastedCost,
      totalUsers: licenseAudits.totalUsers,
      completedAt: licenseAudits.completedAt,
    })
    .from(licenseAudits)
    .where(and(...conditions))
    .orderBy(desc(licenseAudits.completedAt))
    .limit(12);

  return audits.reverse().map((a) => ({
    date: a.completedAt?.toISOString() ?? null,
    totalSpend: a.totalMonthlyCost ?? 0,
    wastedCost: a.totalWastedCost ?? 0,
    userCount: a.totalUsers ?? 0,
  }));
}
