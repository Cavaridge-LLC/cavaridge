/**
 * Audit log viewer routes.
 * Query the audit_log table with filters by tenant, user, action, date range.
 *
 * Platform Admin cross-tenant view — all filters optional.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { getPool } from '../db';

export const auditRouter: RouterType = Router();

// Query audit logs
auditRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const {
    tenant_id, user_id, action, resource_type, app_code,
    from, to, limit = '50', offset = '0',
  } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (tenant_id) { conditions.push(`a.organization_id = $${idx++}::uuid`); params.push(tenant_id); }
  if (user_id) { conditions.push(`a.user_id = $${idx++}::uuid`); params.push(user_id); }
  if (action) { conditions.push(`a.action = $${idx++}`); params.push(action); }
  if (resource_type) { conditions.push(`a.resource_type = $${idx++}`); params.push(resource_type); }
  if (app_code) { conditions.push(`a.app_code = $${idx++}`); params.push(app_code); }
  if (from) { conditions.push(`a.created_at >= $${idx++}::timestamptz`); params.push(from); }
  if (to) { conditions.push(`a.created_at <= $${idx++}::timestamptz`); params.push(to); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));

  const { rows: entries } = await pool.query(`
    SELECT a.*,
      p.full_name AS user_name, p.email AS user_email,
      t.name AS tenant_name
    FROM audit_log a
    LEFT JOIN profiles p ON a.user_id = p.id
    LEFT JOIN tenants t ON a.organization_id = t.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, params);

  const countParams = params.slice(0, params.length - 2);
  const countWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows: [{ total }] } = await pool.query(
    `SELECT count(*) AS total FROM audit_log a ${countWhere}`,
    countParams,
  );

  res.json({ entries, total: Number(total), limit: Number(limit), offset: Number(offset) });
});

// Distinct actions for filter dropdown
auditRouter.get('/actions', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT DISTINCT action FROM audit_log ORDER BY action');
  res.json(rows.map((a: any) => a.action));
});

// Distinct resource types for filter dropdown
auditRouter.get('/resource-types', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT DISTINCT resource_type FROM audit_log ORDER BY resource_type');
  res.json(rows.map((t: any) => t.resource_type));
});

// Distinct app codes for filter dropdown
auditRouter.get('/app-codes', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT DISTINCT app_code FROM audit_log WHERE app_code IS NOT NULL ORDER BY app_code');
  res.json(rows.map((c: any) => c.app_code));
});

// Audit stats
auditRouter.get('/stats', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: [totals] } = await pool.query(`
      SELECT count(*) AS total,
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS last_24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d
      FROM audit_log
    `);

    const { rows: byApp } = await pool.query(`
      SELECT app_code, count(*) AS count
      FROM audit_log WHERE app_code IS NOT NULL
      GROUP BY app_code ORDER BY count DESC
    `);

    const { rows: topActions } = await pool.query(`
      SELECT action, count(*) AS count
      FROM audit_log GROUP BY action ORDER BY count DESC LIMIT 10
    `);

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
