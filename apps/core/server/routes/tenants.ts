/**
 * Tenant management routes.
 * CRUD for tenants across all 4 tiers (platform, msp, client, site/prospect).
 * Hierarchy tree endpoint for visual display.
 *
 * Platform Admins have cross-tenant visibility — no per-query tenant scoping.
 * Tenant filters are optional params for narrowing the admin view.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { getSql } from '../db';

export const tenantRouter: RouterType = Router();

// List tenants with optional filters
tenantRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const { type, parent_id, status, search, limit = '50', offset = '0' } = req.query;

  let query = sql`
    SELECT t.*,
      (SELECT count(*) FROM tenants c WHERE c.parent_id = t.id) AS child_count,
      p.name AS parent_name
    FROM tenants t
    LEFT JOIN tenants p ON t.parent_id = p.id
    WHERE 1=1
  `;

  if (type) query = sql`${query} AND t.type = ${type as string}`;
  if (parent_id) query = sql`${query} AND t.parent_id = ${parent_id as string}::uuid`;
  if (status) query = sql`${query} AND t.status = ${status as string}`;
  if (search) query = sql`${query} AND t.name ILIKE ${'%' + (search as string) + '%'}`;

  query = sql`${query} ORDER BY t.type, t.name LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

  const tenants = await query;

  // Get total count
  let countQuery = sql`SELECT count(*) AS total FROM tenants WHERE 1=1`;
  if (type) countQuery = sql`${countQuery} AND type = ${type as string}`;
  if (parent_id) countQuery = sql`${countQuery} AND parent_id = ${parent_id as string}::uuid`;
  if (status) countQuery = sql`${countQuery} AND status = ${status as string}`;
  if (search) countQuery = sql`${countQuery} AND name ILIKE ${'%' + (search as string) + '%'}`;
  const [{ total }] = await countQuery;

  res.json({ tenants, total: Number(total) });
});

// Full hierarchy tree
tenantRouter.get('/tree', async (_req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const tenants = await sql`
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
  `;

  // Build tree structure
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

// Get single tenant
tenantRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const [tenant] = await sql`
    SELECT t.*,
      p.name AS parent_name,
      (SELECT count(*) FROM tenants c WHERE c.parent_id = t.id) AS child_count,
      (SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'type', c.type, 'status', c.status))
       FROM tenants c WHERE c.parent_id = t.id) AS children
    FROM tenants t
    LEFT JOIN tenants p ON t.parent_id = p.id
    WHERE t.id = ${req.params.id}::uuid
  `;
  if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
  res.json(tenant);
});

// Create tenant
tenantRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const { name, type, parent_id, config, status } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'name and type are required' });
    return;
  }

  const validTypes = ['platform', 'msp', 'client', 'site', 'prospect'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const [tenant] = await sql`
    INSERT INTO tenants (name, type, parent_id, config, status)
    VALUES (${name}, ${type}, ${parent_id ?? null}, ${JSON.stringify(config ?? {})}, ${status ?? 'active'})
    RETURNING *
  `;

  res.status(201).json(tenant);
});

// Update tenant
tenantRouter.patch('/:id', async (req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const { name, status, config } = req.body;

  const [existing] = await sql`SELECT * FROM tenants WHERE id = ${req.params.id}::uuid`;
  if (!existing) { res.status(404).json({ error: 'Tenant not found' }); return; }

  const [tenant] = await sql`
    UPDATE tenants SET
      name = COALESCE(${name ?? null}, name),
      status = COALESCE(${status ?? null}, status),
      config = COALESCE(${config ? JSON.stringify(config) : null}::jsonb, config),
      updated_at = now()
    WHERE id = ${req.params.id}::uuid
    RETURNING *
  `;

  res.json(tenant);
});

// Deactivate tenant
tenantRouter.post('/:id/deactivate', async (req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const [tenant] = await sql`
    UPDATE tenants SET status = 'inactive', updated_at = now()
    WHERE id = ${req.params.id}::uuid
    RETURNING *
  `;
  if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
  res.json(tenant);
});

// Reactivate tenant
tenantRouter.post('/:id/activate', async (req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const [tenant] = await sql`
    UPDATE tenants SET status = 'active', updated_at = now()
    WHERE id = ${req.params.id}::uuid
    RETURNING *
  `;
  if (!tenant) { res.status(404).json({ error: 'Tenant not found' }); return; }
  res.json(tenant);
});

// Tenant stats summary
tenantRouter.get('/stats/summary', async (_req: AuthenticatedRequest, res) => {
  const sql = getSql();
  const stats = await sql`
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
  `;

  const [totals] = await sql`
    SELECT count(*) AS total, count(*) FILTER (WHERE status = 'active') AS active
    FROM tenants
  `;

  res.json({ byType: stats, total: Number(totals.total), active: Number(totals.active) });
});
