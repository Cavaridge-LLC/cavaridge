/**
 * Platform analytics routes.
 * Aggregate metrics: total users, active sessions, LLM usage, storage, API volumes.
 *
 * Platform Admin cross-tenant view.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth.js';
import { getPool } from '../db.js';

export const analyticsRouter: RouterType = Router();

// Platform overview — aggregate metrics
analyticsRouter.get('/overview', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();

  // Tenant counts
  const { rows: [tenantCounts] } = await pool.query(`
    SELECT
      count(*) AS total_tenants,
      count(*) FILTER (WHERE status = 'active') AS active_tenants,
      count(*) FILTER (WHERE type = 'msp') AS msp_count,
      count(*) FILTER (WHERE type = 'client') AS client_count,
      count(*) FILTER (WHERE type = 'site') AS site_count,
      count(*) FILTER (WHERE type = 'prospect') AS prospect_count
    FROM tenants
  `);

  // User counts
  const { rows: [userCounts] } = await pool.query(`
    SELECT
      count(*) AS total_users,
      count(*) FILTER (WHERE status = 'active') AS active_users,
      count(*) FILTER (WHERE status = 'invited') AS invited_users,
      count(*) FILTER (WHERE status = 'inactive') AS inactive_users
    FROM profiles
  `);

  // Recent activity (last 24h / 7d audit log entries)
  let activityStats = { last_24h: 0, last_7d: 0, last_30d: 0 };
  try {
    const { rows: [activity] } = await pool.query(`
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS last_24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d,
        count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS last_30d
      FROM audit_log
    `);
    activityStats = {
      last_24h: Number(activity.last_24h),
      last_7d: Number(activity.last_7d),
      last_30d: Number(activity.last_30d),
    };
  } catch {
    // audit_log may not exist yet
  }

  // Database size
  let dbSize = 'unknown';
  try {
    const { rows: [sizeRow] } = await pool.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`,
    );
    dbSize = sizeRow.db_size;
  } catch {
    // permission error possible
  }

  res.json({
    tenants: {
      total: Number(tenantCounts.total_tenants),
      active: Number(tenantCounts.active_tenants),
      byType: {
        msp: Number(tenantCounts.msp_count),
        client: Number(tenantCounts.client_count),
        site: Number(tenantCounts.site_count),
        prospect: Number(tenantCounts.prospect_count),
      },
    },
    users: {
      total: Number(userCounts.total_users),
      active: Number(userCounts.active_users),
      invited: Number(userCounts.invited_users),
      inactive: Number(userCounts.inactive_users),
    },
    activity: activityStats,
    storage: { databaseSize: dbSize },
  });
});

// User growth over time (last 30 days, daily)
analyticsRouter.get('/user-growth', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();

  const { rows: daily } = await pool.query(`
    SELECT
      date_trunc('day', created_at)::date AS date,
      count(*) AS new_users
    FROM profiles
    WHERE created_at >= now() - interval '30 days'
    GROUP BY date_trunc('day', created_at)::date
    ORDER BY date
  `);

  const { rows: cumulative } = await pool.query(`
    SELECT
      date_trunc('day', created_at)::date AS date,
      count(*) AS new_users,
      sum(count(*)) OVER (ORDER BY date_trunc('day', created_at)::date) AS cumulative_users
    FROM profiles
    GROUP BY date_trunc('day', created_at)::date
    ORDER BY date
  `);

  res.json({ daily, cumulative });
});

// Tenant growth over time (last 30 days, daily)
analyticsRouter.get('/tenant-growth', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();

  const { rows: daily } = await pool.query(`
    SELECT
      date_trunc('day', created_at)::date AS date,
      type,
      count(*) AS new_tenants
    FROM tenants
    WHERE created_at >= now() - interval '30 days'
    GROUP BY date_trunc('day', created_at)::date, type
    ORDER BY date, type
  `);

  res.json({ daily });
});

// Activity breakdown by app (from audit logs)
analyticsRouter.get('/activity-by-app', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: byApp } = await pool.query(`
      SELECT
        COALESCE(app_code, 'unknown') AS app_code,
        count(*) AS total_events,
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS last_24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d
      FROM audit_log
      GROUP BY app_code
      ORDER BY total_events DESC
    `);

    res.json({ byApp });
  } catch {
    res.json({ byApp: [] });
  }
});

// LLM usage summary (reads from llm_usage table if it exists)
analyticsRouter.get('/llm-usage', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: usage } = await pool.query(`
      SELECT
        tenant_id,
        t.name AS tenant_name,
        count(*) AS total_calls,
        sum(prompt_tokens) AS total_prompt_tokens,
        sum(completion_tokens) AS total_completion_tokens,
        sum(total_tokens) AS total_tokens,
        sum(cost_usd) AS total_cost_usd,
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS calls_24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS calls_7d
      FROM llm_usage lu
      JOIN tenants t ON lu.tenant_id = t.id
      GROUP BY tenant_id, t.name
      ORDER BY total_calls DESC
    `);

    const { rows: [totals] } = await pool.query(`
      SELECT
        count(*) AS total_calls,
        sum(total_tokens) AS total_tokens,
        sum(cost_usd) AS total_cost_usd
      FROM llm_usage
    `);

    res.json({
      byTenant: usage,
      totals: {
        calls: Number(totals.total_calls),
        tokens: Number(totals.total_tokens),
        costUsd: Number(totals.total_cost_usd),
      },
    });
  } catch {
    // llm_usage table may not exist yet
    res.json({
      byTenant: [],
      totals: { calls: 0, tokens: 0, costUsd: 0 },
      message: 'llm_usage table not yet provisioned — Spaniel must be deployed first',
    });
  }
});

// Active sessions (based on recent audit activity per user)
analyticsRouter.get('/active-sessions', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: sessions } = await pool.query(`
      SELECT
        a.user_id,
        p.full_name AS user_name,
        p.email AS user_email,
        p.role,
        t.name AS tenant_name,
        max(a.created_at) AS last_activity,
        count(*) AS action_count
      FROM audit_log a
      JOIN profiles p ON a.user_id = p.id
      LEFT JOIN tenants t ON a.organization_id = t.id
      WHERE a.created_at >= now() - interval '30 minutes'
      GROUP BY a.user_id, p.full_name, p.email, p.role, t.name
      ORDER BY last_activity DESC
    `);

    res.json({ activeSessions: sessions, count: sessions.length });
  } catch {
    res.json({ activeSessions: [], count: 0 });
  }
});

// API volumes (recent requests from audit log)
analyticsRouter.get('/api-volumes', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();

    const { rows: hourly } = await pool.query(`
      SELECT
        date_trunc('hour', created_at) AS hour,
        count(*) AS request_count
      FROM audit_log
      WHERE created_at >= now() - interval '24 hours'
      GROUP BY date_trunc('hour', created_at)
      ORDER BY hour
    `);

    const { rows: byAction } = await pool.query(`
      SELECT action, count(*) AS count
      FROM audit_log
      WHERE created_at >= now() - interval '24 hours'
      GROUP BY action
      ORDER BY count DESC
      LIMIT 20
    `);

    res.json({ hourly, topActions: byAction });
  } catch {
    res.json({ hourly: [], topActions: [] });
  }
});
