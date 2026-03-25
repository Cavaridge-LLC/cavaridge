/**
 * Audit log viewer routes.
 * Query the audit_log table with filters by tenant, user, action, date range.
 * CSV export support.
 *
 * Platform Admin cross-tenant view — all filters optional.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth.js';
import { getPool } from '../db.js';

export const auditRouter: RouterType = Router();

interface AuditQueryParams {
  tenant_id?: string;
  user_id?: string;
  action?: string;
  resource_type?: string;
  app_code?: string;
  from?: string;
  to?: string;
  limit?: string;
  offset?: string;
}

function buildAuditQuery(query: AuditQueryParams) {
  const {
    tenant_id, user_id, action, resource_type, app_code,
    from, to, limit = '50', offset = '0',
  } = query;

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

  return { conditions, params, idx, where, limit: Number(limit), offset: Number(offset) };
}

// Query audit logs
auditRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { params, idx: startIdx, where, limit, offset } = buildAuditQuery(
    req.query as AuditQueryParams,
  );

  let idx = startIdx;
  const queryParams = [...params, limit, offset];

  const { rows: entries } = await pool.query(`
    SELECT a.*,
      p.display_name AS user_name, p.email AS user_email,
      t.name AS tenant_name
    FROM audit_log a
    LEFT JOIN profiles p ON a.user_id = p.id
    LEFT JOIN tenants t ON a.organization_id = t.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, queryParams);

  const countParams = params;
  const { rows: [{ total }] } = await pool.query(
    `SELECT count(*) AS total FROM audit_log a ${where}`,
    countParams,
  );

  res.json({ entries, total: Number(total), limit, offset });
});

// CSV export of audit logs
auditRouter.get('/export', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { params, where } = buildAuditQuery(req.query as AuditQueryParams);

  // Cap export at 10,000 rows
  const maxExport = 10000;

  const { rows: entries } = await pool.query(`
    SELECT
      a.id,
      a.created_at,
      a.action,
      a.resource_type,
      a.resource_id,
      a.app_code,
      a.ip_address,
      p.display_name AS user_name,
      p.email AS user_email,
      t.name AS tenant_name,
      a.details_json
    FROM audit_log a
    LEFT JOIN profiles p ON a.user_id = p.id
    LEFT JOIN tenants t ON a.organization_id = t.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT ${maxExport}
  `, params);

  // Build CSV
  const headers = ['id', 'created_at', 'action', 'resource_type', 'resource_id', 'app_code', 'ip_address', 'user_name', 'user_email', 'tenant_name', 'details'];

  function escapeCsvField(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const csvRows = [headers.join(',')];
  for (const entry of entries) {
    csvRows.push([
      escapeCsvField(entry.id),
      escapeCsvField(entry.created_at),
      escapeCsvField(entry.action),
      escapeCsvField(entry.resource_type),
      escapeCsvField(entry.resource_id),
      escapeCsvField(entry.app_code),
      escapeCsvField(entry.ip_address),
      escapeCsvField(entry.user_name),
      escapeCsvField(entry.user_email),
      escapeCsvField(entry.tenant_name),
      escapeCsvField(entry.details_json),
    ].join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csvRows.join('\n'));
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
