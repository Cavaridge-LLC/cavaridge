/**
 * GET /api/v1/usage — Aggregated cost/token usage statistics
 *
 * Query params:
 *   tenant_id  — filter by tenant (required unless platform admin)
 *   app_code   — filter by app code
 *   start_date — ISO date string (default: 30 days ago)
 *   end_date   — ISO date string (default: now)
 */

import type { Express, Request, Response } from "express";
import { hasDbCapability, getDb } from "@cavaridge/spaniel";
import { requestLog } from "@cavaridge/spaniel/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import { logger } from "../logger.js";

export function registerUsageRoutes(app: Express): void {
  app.get("/api/v1/usage", async (req: Request, res: Response) => {
    if (!hasDbCapability()) {
      return res.status(503).json({
        error: "Usage data requires database connectivity",
        hint: "Set DATABASE_URL or SPANIEL_DATABASE_URL",
      });
    }

    const tenantId = req.query.tenant_id as string | undefined;
    const appCode = req.query.app_code as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    try {
      const db = getDb();

      const conditions = [
        gte(requestLog.createdAt, start),
        lte(requestLog.createdAt, end),
      ];

      if (tenantId) {
        conditions.push(eq(requestLog.tenantId, tenantId));
      }
      if (appCode) {
        conditions.push(eq(requestLog.appCode, appCode));
      }

      const result = await db
        .select({
          totalRequests: sql<number>`count(*)::int`,
          totalInputTokens: sql<number>`coalesce(sum(${requestLog.tokensInput}), 0)::int`,
          totalOutputTokens: sql<number>`coalesce(sum(${requestLog.tokensOutput}), 0)::int`,
          totalCostUsd: sql<string>`coalesce(sum(${requestLog.costUsd}), 0)::numeric(10,6)`,
          successCount: sql<number>`count(*) filter (where ${requestLog.status} = 'success')::int`,
          degradedCount: sql<number>`count(*) filter (where ${requestLog.status} = 'degraded')::int`,
          errorCount: sql<number>`count(*) filter (where ${requestLog.status} = 'error')::int`,
          fallbackCount: sql<number>`count(*) filter (where ${requestLog.fallbackUsed} = true)::int`,
          consensusCount: sql<number>`count(*) filter (where ${requestLog.consensusAligned} is not null)::int`,
          consensusAlignedCount: sql<number>`count(*) filter (where ${requestLog.consensusAligned} = true)::int`,
        })
        .from(requestLog)
        .where(and(...conditions));

      const stats = result[0];

      // Per-model breakdown
      const byModel = await db
        .select({
          model: requestLog.modelUsed,
          requests: sql<number>`count(*)::int`,
          inputTokens: sql<number>`coalesce(sum(${requestLog.tokensInput}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${requestLog.tokensOutput}), 0)::int`,
          costUsd: sql<string>`coalesce(sum(${requestLog.costUsd}), 0)::numeric(10,6)`,
        })
        .from(requestLog)
        .where(and(...conditions))
        .groupBy(requestLog.modelUsed)
        .orderBy(sql`count(*) desc`);

      // Per-task-type breakdown
      const byTaskType = await db
        .select({
          taskType: requestLog.taskType,
          requests: sql<number>`count(*)::int`,
          costUsd: sql<string>`coalesce(sum(${requestLog.costUsd}), 0)::numeric(10,6)`,
        })
        .from(requestLog)
        .where(and(...conditions))
        .groupBy(requestLog.taskType)
        .orderBy(sql`count(*) desc`);

      return res.json({
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        filters: { tenant_id: tenantId ?? null, app_code: appCode ?? null },
        summary: {
          total_requests: stats?.totalRequests ?? 0,
          total_input_tokens: stats?.totalInputTokens ?? 0,
          total_output_tokens: stats?.totalOutputTokens ?? 0,
          total_cost_usd: parseFloat(stats?.totalCostUsd ?? "0"),
          success_rate:
            stats && stats.totalRequests > 0
              ? Math.round(((stats.successCount ?? 0) / stats.totalRequests) * 10000) / 100
              : 0,
          fallback_rate:
            stats && stats.totalRequests > 0
              ? Math.round(((stats.fallbackCount ?? 0) / stats.totalRequests) * 10000) / 100
              : 0,
          consensus_alignment_rate:
            stats && (stats.consensusCount ?? 0) > 0
              ? Math.round(
                  ((stats.consensusAlignedCount ?? 0) / (stats.consensusCount ?? 1)) * 10000
                ) / 100
              : null,
          status_breakdown: {
            success: stats?.successCount ?? 0,
            degraded: stats?.degradedCount ?? 0,
            error: stats?.errorCount ?? 0,
          },
        },
        by_model: byModel,
        by_task_type: byTaskType,
      });
    } catch (err) {
      logger.error({ err }, "Usage query failed");
      return res.status(500).json({ error: "Failed to query usage data" });
    }
  });
}
