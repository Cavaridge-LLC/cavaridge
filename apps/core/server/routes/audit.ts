/**
 * Audit log viewer routes.
 * Query the audit_log table with filters by tenant, user, action, date range.
 *
 * Platform Admin cross-tenant view — all filters optional.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { getSql } from '../db';

export const auditRouter: RouterType = Router();

// Query audit logs — platform admin can query across all tenants
auditRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const {
    tenant_id, user_id, action, resource_type, app_code,
    from, to, limit = '50', offset = '0',
  } = req.query;

  let query = sql`
    SELECT a.*,
      p.full_name AS user_name, p.email AS user_email,
      t.name AS tenant_name
    FROM audit_log a
    LEFT JOIN profiles p ON a.user_id = p.id
    LEFT JOIN tenants t ON a.organization_id = t.id
    WHERE 1=1
  `;

  if (tenant_id) query = sql`${query} AND a.organization_id = ${tenant_id as string}::uuid`;
  if (user_id) query = sql`${query} AND a.user_id = ${user_id as string}::uuid`;
  if (action) query = sql`${query} AND a.action = ${action as string}`;
  if (resource_type) query = sql`${query} AND a.resource_type = ${resource_type as string}`;
  if (app_code) query = sql`${query} AND a.app_code = ${app_code as string}`;
  if (from) query = sql`${query} AND a.created_at >= ${from as string}::timestamptz`;
  if (to) query = sql`${query} AND a.created_at <= ${to as string}::timestamptz`;

  query = sql`${query} ORDER BY a.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

  const entries = await query;

  // Count
  let countQuery = sql`SELECT count(*) AS total FROM audit_log WHERE 1=1`;
  if (tenant_id) countQuery = sql`${countQuery} AND organization_id = ${tenant_id as string}::uuid`;
  if (user_id) countQuery = sql`${countQuery} AND user_id = ${user_id as string}::uuid`;
  if (action) countQuery = sql`${countQuery} AND action = ${action as string}`;
  if (resource_type) countQuery = sql`${countQuery} AND resource_type = ${resource_type as string}`;
  if (app_code) countQuery = sql`${countQuery} AND app_code = ${app_code as string}`;
  if (from) countQuery = sql`${countQuery} AND created_at >= ${from as string}::timestamptz`;
  if (to) countQuery = sql`${countQuery} AND created_at <= ${to as string}::timestamptz`;
  const [{ total }] = await countQuery;

  res.json({ entries, total: Number(total), limit: Number(limit), offset: Number(offset) });
});

// Distinct actions for filter dropdown
auditRouter.get('/actions', async (_req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const actions = await sql`SELECT DISTINCT action FROM audit_log ORDER BY action`;
  res.json(actions.map((a: any) => a.action));
});

// Distinct resource types for filter dropdown
auditRouter.get('/resource-types', async (_req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const types = await sql`SELECT DISTINCT resource_type FROM audit_log ORDER BY resource_type`;
  res.json(types.map((t: any) => t.resource_type));
});

// Distinct app codes for filter dropdown
auditRouter.get('/app-codes', async (_req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const codes = await sql`SELECT DISTINCT app_code FROM audit_log WHERE app_code IS NOT NULL ORDER BY app_code`;
  res.json(codes.map((c: any) => c.app_code));
});

// Audit stats
auditRouter.get('/stats', async (_req: AuthenticatedRequest, res) => {
  try {
    const sql = getSql();
    const [totals] = await sql`
      SELECT count(*) AS total,
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS last_24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d
      FROM audit_log
    `;

    const byApp = await sql`
      SELECT app_code, count(*) AS count
      FROM audit_log
      WHERE app_code IS NOT NULL
      GROUP BY app_code
      ORDER BY count DESC
    `;

    const topActions = await sql`
      SELECT action, count(*) AS count
      FROM audit_log
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `;

    res.json({
      total: Number(totals.total),
      last24h: Number(totals.last_24h),
      last7d: Number(totals.last_7d),
      byApp,
      topActions,
    });
  } catch {
    res.json({ total: 0, last24h: 0, last7d: 0, byApp: [], topActions: [] });
  }
});
