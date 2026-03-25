/**
 * Billing/usage tracking routes.
 * Per-tenant usage of LLM calls, storage, API requests.
 * Reports per billing period.
 *
 * Tracking only — no payment integration yet.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth.js';
import { getPool } from '../db.js';

export const billingRouter: RouterType = Router();

// Usage summary across all tenants
billingRouter.get('/usage', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { period = 'current_month' } = req.query;

  let dateFilter: string;
  switch (period) {
    case 'last_month':
      dateFilter = `created_at >= date_trunc('month', now() - interval '1 month') AND created_at < date_trunc('month', now())`;
      break;
    case 'last_7d':
      dateFilter = `created_at >= now() - interval '7 days'`;
      break;
    case 'last_30d':
      dateFilter = `created_at >= now() - interval '30 days'`;
      break;
    case 'current_month':
    default:
      dateFilter = `created_at >= date_trunc('month', now())`;
      break;
  }

  // Audit log as proxy for API request volume per tenant
  let apiUsage: any[] = [];
  try {
    const { rows } = await pool.query(`
      SELECT
        a.organization_id AS tenant_id,
        t.name AS tenant_name,
        t.type AS tenant_type,
        count(*) AS api_requests,
        count(DISTINCT a.user_id) AS unique_users,
        count(DISTINCT a.action) AS distinct_actions
      FROM audit_log a
      JOIN tenants t ON a.organization_id = t.id
      WHERE ${dateFilter}
      GROUP BY a.organization_id, t.name, t.type
      ORDER BY api_requests DESC
    `);
    apiUsage = rows;
  } catch {
    // audit_log may not exist
  }

  // LLM usage per tenant
  let llmUsage: any[] = [];
  try {
    const { rows } = await pool.query(`
      SELECT
        lu.tenant_id,
        t.name AS tenant_name,
        count(*) AS llm_calls,
        sum(lu.prompt_tokens) AS prompt_tokens,
        sum(lu.completion_tokens) AS completion_tokens,
        sum(lu.total_tokens) AS total_tokens,
        sum(lu.cost_usd) AS cost_usd
      FROM llm_usage lu
      JOIN tenants t ON lu.tenant_id = t.id
      WHERE lu.${dateFilter}
      GROUP BY lu.tenant_id, t.name
      ORDER BY cost_usd DESC
    `);
    llmUsage = rows;
  } catch {
    // llm_usage table may not exist
  }

  // Storage per tenant (estimated from table stats if available)
  let storageUsage: any[] = [];
  try {
    const { rows } = await pool.query(`
      SELECT
        pg_size_pretty(pg_database_size(current_database())) AS total_database_size,
        pg_database_size(current_database()) AS total_bytes
    `);
    storageUsage = rows;
  } catch {
    // permissions
  }

  res.json({
    period: period as string,
    apiUsage,
    llmUsage,
    storage: storageUsage[0] ?? { total_database_size: 'unknown', total_bytes: 0 },
  });
});

// Per-tenant usage detail
billingRouter.get('/usage/:tenantId', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { tenantId } = req.params;
  const { period = 'current_month' } = req.query;

  let dateFilter: string;
  switch (period) {
    case 'last_month':
      dateFilter = `created_at >= date_trunc('month', now() - interval '1 month') AND created_at < date_trunc('month', now())`;
      break;
    case 'last_7d':
      dateFilter = `created_at >= now() - interval '7 days'`;
      break;
    case 'last_30d':
      dateFilter = `created_at >= now() - interval '30 days'`;
      break;
    case 'current_month':
    default:
      dateFilter = `created_at >= date_trunc('month', now())`;
      break;
  }

  // Verify tenant exists
  const { rows: tenantRows } = await pool.query('SELECT * FROM tenants WHERE id = $1::uuid', [tenantId]);
  if (tenantRows.length === 0) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  // API activity
  let apiActivity: any = { total_requests: 0, unique_users: 0, daily: [] };
  try {
    const { rows: [summary] } = await pool.query(`
      SELECT
        count(*) AS total_requests,
        count(DISTINCT user_id) AS unique_users
      FROM audit_log
      WHERE organization_id = $1::uuid AND ${dateFilter}
    `, [tenantId]);

    const { rows: daily } = await pool.query(`
      SELECT
        date_trunc('day', created_at)::date AS date,
        count(*) AS requests
      FROM audit_log
      WHERE organization_id = $1::uuid AND ${dateFilter}
      GROUP BY date_trunc('day', created_at)::date
      ORDER BY date
    `, [tenantId]);

    apiActivity = {
      total_requests: Number(summary.total_requests),
      unique_users: Number(summary.unique_users),
      daily,
    };
  } catch {
    // audit_log may not exist
  }

  // LLM usage
  let llmActivity: any = { total_calls: 0, total_tokens: 0, total_cost_usd: 0, byModel: [] };
  try {
    const { rows: [summary] } = await pool.query(`
      SELECT
        count(*) AS total_calls,
        sum(total_tokens) AS total_tokens,
        sum(cost_usd) AS total_cost_usd
      FROM llm_usage
      WHERE tenant_id = $1::uuid AND ${dateFilter}
    `, [tenantId]);

    const { rows: byModel } = await pool.query(`
      SELECT
        model,
        count(*) AS calls,
        sum(total_tokens) AS tokens,
        sum(cost_usd) AS cost_usd
      FROM llm_usage
      WHERE tenant_id = $1::uuid AND ${dateFilter}
      GROUP BY model
      ORDER BY cost_usd DESC
    `, [tenantId]);

    llmActivity = {
      total_calls: Number(summary.total_calls),
      total_tokens: Number(summary.total_tokens),
      total_cost_usd: Number(summary.total_cost_usd),
      byModel,
    };
  } catch {
    // llm_usage may not exist
  }

  res.json({
    tenant: tenantRows[0],
    period: period as string,
    apiActivity,
    llmActivity,
  });
});

// Billing report — summary for all tenants in a billing period
billingRouter.get('/report', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { month, year } = req.query;

  const reportMonth = month ? Number(month) : new Date().getMonth() + 1;
  const reportYear = year ? Number(year) : new Date().getFullYear();

  const periodStart = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
  const periodEnd = reportMonth === 12
    ? `${reportYear + 1}-01-01`
    : `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}-01`;

  // Tenant summary
  const { rows: tenants } = await pool.query(`
    SELECT id, name, type, status, plan_tier
    FROM tenants
    WHERE type IN ('msp', 'client')
    ORDER BY type, name
  `);

  // API usage per tenant
  let apiByTenant: Record<string, number> = {};
  try {
    const { rows } = await pool.query(`
      SELECT organization_id AS tenant_id, count(*) AS requests
      FROM audit_log
      WHERE created_at >= $1::date AND created_at < $2::date
      GROUP BY organization_id
    `, [periodStart, periodEnd]);

    for (const row of rows) {
      apiByTenant[row.tenant_id] = Number(row.requests);
    }
  } catch {
    // audit_log may not exist
  }

  // LLM usage per tenant
  let llmByTenant: Record<string, { calls: number; tokens: number; cost: number }> = {};
  try {
    const { rows } = await pool.query(`
      SELECT tenant_id, count(*) AS calls, sum(total_tokens) AS tokens, sum(cost_usd) AS cost
      FROM llm_usage
      WHERE created_at >= $1::date AND created_at < $2::date
      GROUP BY tenant_id
    `, [periodStart, periodEnd]);

    for (const row of rows) {
      llmByTenant[row.tenant_id] = {
        calls: Number(row.calls),
        tokens: Number(row.tokens),
        cost: Number(row.cost),
      };
    }
  } catch {
    // llm_usage may not exist
  }

  const report = tenants.map((t: any) => ({
    tenant_id: t.id,
    tenant_name: t.name,
    tenant_type: t.type,
    plan_tier: t.plan_tier,
    api_requests: apiByTenant[t.id] ?? 0,
    llm_calls: llmByTenant[t.id]?.calls ?? 0,
    llm_tokens: llmByTenant[t.id]?.tokens ?? 0,
    llm_cost_usd: llmByTenant[t.id]?.cost ?? 0,
  }));

  res.json({
    period: { month: reportMonth, year: reportYear, start: periodStart, end: periodEnd },
    report,
    totals: {
      api_requests: report.reduce((s, r) => s + r.api_requests, 0),
      llm_calls: report.reduce((s, r) => s + r.llm_calls, 0),
      llm_tokens: report.reduce((s, r) => s + r.llm_tokens, 0),
      llm_cost_usd: report.reduce((s, r) => s + r.llm_cost_usd, 0),
    },
  });
});
