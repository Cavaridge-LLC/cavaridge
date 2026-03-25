/**
 * Tenant management routes.
 * CRUD for tenants across all 4 tiers (platform, msp, client, site/prospect).
 * Hierarchy tree endpoint for visual display.
 * Create, update, deactivate. Manage parent-child.
 *
 * Platform Admins have cross-tenant visibility — no per-query tenant scoping.
 * Tenant filters are optional params for narrowing the admin view.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth.js';
import { getPool } from '../db.js';

export const tenantRouter: RouterType = Router();

const VALID_TENANT_TYPES = ['platform', 'msp', 'client', 'site', 'prospect'] as const;

// Allowed parent-child relationships per UTM hierarchy
const VALID_PARENT_CHILD: Record<string, string[]> = {
  platform: [], // platform has no parent
  msp: ['platform'],
  client: ['msp'],
  site: ['client'],
  prospect: ['msp'],
};

/**
 * Validate tenant hierarchy: child type must be allowed under parent type.
 */
function validateHierarchy(childType: string, parentType: string | null): string | null {
  if (childType === 'platform' && parentType !== null) {
    return 'Platform tenant cannot have a parent';
  }
  if (childType !== 'platform' && !parentType) {
    return `Tenant type "${childType}" requires a parent`;
  }
  if (parentType && !VALID_PARENT_CHILD[childType]?.includes(parentType)) {
    return `Tenant type "${childType}" cannot be a child of "${parentType}". Allowed parents: ${VALID_PARENT_CHILD[childType]?.join(', ') ?? 'none'}`;
  }
  return null;
}

// List tenants with optional filters
tenantRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { type, parent_id, status, search, limit = '50', offset = '0' } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (type) { conditions.push(`t.type = $${idx++}`); params.push(type); }
  if (parent_id) { conditions.push(`t.parent_id = $${idx++}::uuid`); params.push(parent_id); }
  if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
  if (search) { conditions.push(`t.name ILIKE $${idx++}`); params.push(`%${search}%`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));

  const { rows: tenants } = await pool.query(`
    SELECT t.*,
      (SELECT count(*) FROM tenants c WHERE c.parent_id = t.id) AS child_count,
      p.name AS parent_name
    FROM tenants t
    LEFT JOIN tenants p ON t.parent_id = p.id
    ${where}
    ORDER BY t.type, t.name
    LIMIT $${idx++} OFFSET $${idx++}
  `, params);

  // Reuse conditions for count (without limit/offset params)
  const countParams = params.slice(0, params.length - 2);
  const { rows: [{ total }] } = await pool.query(
    `SELECT count(*) AS total FROM tenants t ${where}`,
    countParams,
  );

  res.json({ tenants, total: Number(total) });
});

// Full hierarchy tree
tenantRouter.get('/tree', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows: tenants } = await pool.query(`
    SELECT id, name, type, status, parent_id, config,
      (SELECT count(*) FROM tenants c WHERE c.parent_id = t.id) AS child_count
    FROM tenants t
    ORDER BY
      CASE type
        WHEN 'platform' THEN 0
        WHEN 'msp' THEN 1
        WHEN 'client' THEN 2
        WHEN 'site' THEN 3
        WHEN 'prospect' THEN 4
      END,
      name
  `);

  const nodeMap = new Map<string, any>();
  const roots: any[] = [];

  for (const t of tenants) {
    nodeMap.set(t.id, { ...t, children: [] });
  }

  for (const t of tenants) {
    const node = nodeMap.get(t.id)!;
    if (t.parent_id && nodeMap.has(t.parent_id)) {
      nodeMap.get(t.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  res.json({ tree: roots, totalTenants: tenants.length });
});

// Tenant stats summary
tenantRouter.get('/stats/summary', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows: stats } = await pool.query(`
    SELECT
      type,
      count(*) AS count,
      count(*) FILTER (WHERE status = 'active') AS active_count,
      count(*) FILTER (WHERE status = 'inactive') AS inactive_count
    FROM tenants
    GROUP BY type
    ORDER BY
      CASE type
        WHEN 'platform' THEN 0
        WHEN 'msp' THEN 1
        WHEN 'client' THEN 2
        WHEN 'site' THEN 3
        WHEN 'prospect' THEN 4
      END
  `);

  const { rows: [totals] } = await pool.query(
    `SELECT count(*) AS total, count(*) FILTER (WHERE status = 'active') AS active FROM tenants`,
  );

  res.json({ byType: stats, total: Number(totals.total), active: Number(totals.active) });
});

// Get single tenant
tenantRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT t.*,
      p.name AS parent_name,
      (SELECT count(*) FROM tenants c WHERE c.parent_id = t.id) AS child_count,
      (SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'type', c.type, 'status', c.status))
       FROM tenants c WHERE c.parent_id = t.id) AS children
    FROM tenants t
    LEFT JOIN tenants p ON t.parent_id = p.id
    WHERE t.id = $1::uuid
  `, [req.params.id]);

  if (rows.length === 0) { res.status(404).json({ error: 'Tenant not found' }); return; }
  res.json(rows[0]);
});

// Create tenant with hierarchy validation
tenantRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { name, type, parent_id, config, status } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'name and type are required' });
    return;
  }

  if (!VALID_TENANT_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VALID_TENANT_TYPES.join(', ')}` });
    return;
  }

  // Validate hierarchy
  if (parent_id) {
    const { rows: parentRows } = await pool.query('SELECT type FROM tenants WHERE id = $1::uuid', [parent_id]);
    if (parentRows.length === 0) {
      res.status(400).json({ error: 'Parent tenant not found' });
      return;
    }
    const hierarchyError = validateHierarchy(type, parentRows[0].type);
    if (hierarchyError) {
      res.status(400).json({ error: hierarchyError });
      return;
    }
  } else {
    const hierarchyError = validateHierarchy(type, null);
    if (hierarchyError) {
      res.status(400).json({ error: hierarchyError });
      return;
    }
  }

  const { rows } = await pool.query(`
    INSERT INTO tenants (name, type, parent_id, config, status)
    VALUES ($1, $2, $3, $4::jsonb, $5)
    RETURNING *
  `, [name, type, parent_id ?? null, JSON.stringify(config ?? {}), status ?? 'active']);

  res.status(201).json(rows[0]);
});

// Update tenant
tenantRouter.patch('/:id', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { name, status, config, parent_id } = req.body;

  const { rows: existing } = await pool.query('SELECT id, type FROM tenants WHERE id = $1::uuid', [req.params.id]);
  if (existing.length === 0) { res.status(404).json({ error: 'Tenant not found' }); return; }

  // If parent_id is being changed, validate hierarchy
  if (parent_id !== undefined) {
    if (parent_id !== null) {
      const { rows: parentRows } = await pool.query('SELECT type FROM tenants WHERE id = $1::uuid', [parent_id]);
      if (parentRows.length === 0) {
        res.status(400).json({ error: 'Parent tenant not found' });
        return;
      }
      const hierarchyError = validateHierarchy(existing[0].type, parentRows[0].type);
      if (hierarchyError) {
        res.status(400).json({ error: hierarchyError });
        return;
      }
    }
  }

  const { rows } = await pool.query(`
    UPDATE tenants SET
      name = COALESCE($1, name),
      status = COALESCE($2, status),
      config = COALESCE($3::jsonb, config),
      parent_id = COALESCE($4::uuid, parent_id),
      updated_at = now()
    WHERE id = $5::uuid
    RETURNING *
  `, [name ?? null, status ?? null, config ? JSON.stringify(config) : null, parent_id ?? null, req.params.id]);

  res.json(rows[0]);
});

// Deactivate tenant
tenantRouter.post('/:id/deactivate', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE tenants SET status = 'inactive', updated_at = now() WHERE id = $1::uuid RETURNING *`,
    [req.params.id],
  );
  if (rows.length === 0) { res.status(404).json({ error: 'Tenant not found' }); return; }
  res.json(rows[0]);
});

// Reactivate tenant
tenantRouter.post('/:id/activate', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE tenants SET status = 'active', updated_at = now() WHERE id = $1::uuid RETURNING *`,
    [req.params.id],
  );
  if (rows.length === 0) { res.status(404).json({ error: 'Tenant not found' }); return; }
  res.json(rows[0]);
});

export { validateHierarchy, VALID_PARENT_CHILD };
