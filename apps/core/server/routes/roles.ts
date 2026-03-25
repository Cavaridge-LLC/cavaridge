/**
 * Role management routes.
 * View/assign 6 RBAC roles. Audit who has what role where.
 *
 * Platform Admin cross-tenant view.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth.js';
import { getPool } from '../db.js';

export const roleRouter: RouterType = Router();

// List all role definitions with descriptions
roleRouter.get('/', (_req: AuthenticatedRequest, res) => {
  const roles = [
    { id: 'platform_admin', name: 'Platform Admin', scope: 'Full platform', access: 'Everything — Cavaridge operators only', tier: 'platform' },
    { id: 'msp_admin', name: 'MSP Admin', scope: 'Their MSP + all children', access: 'Full CRUD, user management, billing', tier: 'msp' },
    { id: 'msp_tech', name: 'MSP Tech', scope: 'Their MSP + assigned clients', access: 'Operational access, no billing/user mgmt', tier: 'msp' },
    { id: 'client_admin', name: 'Client Admin', scope: 'Their org + sites', access: 'Manage own users, view reports', tier: 'client' },
    { id: 'client_viewer', name: 'Client Viewer', scope: 'Their org + sites', access: 'Read-only dashboards and reports', tier: 'client' },
    { id: 'prospect', name: 'Prospect', scope: 'Limited preview', access: 'Freemium scan results only (AEGIS)', tier: 'prospect' },
  ];

  res.json({ roles });
});

// Role distribution — who has what role, broken down by tenant
roleRouter.get('/distribution', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();

  const { rows: byRole } = await pool.query(`
    SELECT p.role,
      count(*) AS total,
      count(*) FILTER (WHERE p.status = 'active') AS active,
      count(*) FILTER (WHERE p.status = 'inactive') AS inactive,
      count(*) FILTER (WHERE p.status = 'invited') AS invited
    FROM profiles p
    GROUP BY p.role
    ORDER BY
      CASE p.role
        WHEN 'platform_admin' THEN 0
        WHEN 'msp_admin' THEN 1
        WHEN 'msp_tech' THEN 2
        WHEN 'client_admin' THEN 3
        WHEN 'client_viewer' THEN 4
        WHEN 'prospect' THEN 5
      END
  `);

  const { rows: byTenant } = await pool.query(`
    SELECT t.id AS tenant_id, t.name AS tenant_name, t.type AS tenant_type,
      p.role,
      count(*) AS count
    FROM profiles p
    JOIN tenants t ON p.organization_id = t.id
    GROUP BY t.id, t.name, t.type, p.role
    ORDER BY t.type, t.name, p.role
  `);

  res.json({ byRole, byTenant });
});

// Audit: list all users with a specific role
roleRouter.get('/:role/users', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const role = Array.isArray(req.params.role) ? req.params.role[0] : req.params.role;
  const { limit = '50', offset = '0' } = req.query;

  const validRoles = ['platform_admin', 'msp_admin', 'msp_tech', 'client_admin', 'client_viewer', 'prospect'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const { rows: users } = await pool.query(`
    SELECT p.*, t.name AS tenant_name, t.type AS tenant_type
    FROM profiles p
    LEFT JOIN tenants t ON p.organization_id = t.id
    WHERE p.role = $1
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3
  `, [role, Number(limit), Number(offset)]);

  const { rows: [{ total }] } = await pool.query(
    `SELECT count(*) AS total FROM profiles WHERE role = $1`,
    [role],
  );

  res.json({ role, users, total: Number(total) });
});

// Assign a role to a user
roleRouter.post('/assign', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { user_id, role, organization_id } = req.body;

  if (!user_id || !role) {
    res.status(400).json({ error: 'user_id and role are required' });
    return;
  }

  const validRoles = ['platform_admin', 'msp_admin', 'msp_tech', 'client_admin', 'client_viewer', 'prospect'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const { rows: existing } = await pool.query('SELECT id, role FROM profiles WHERE id = $1::uuid', [user_id]);
  if (existing.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const previousRole = existing[0].role;

  const setClauses = ['role = $1', 'updated_at = now()'];
  const params: any[] = [role];
  let idx = 2;

  if (organization_id) {
    setClauses.push(`organization_id = $${idx++}::uuid`);
    params.push(organization_id);
  }

  params.push(user_id);

  const { rows } = await pool.query(
    `UPDATE profiles SET ${setClauses.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
    params,
  );

  res.json({ user: rows[0], previousRole, newRole: role });
});

// Tenant membership management — list memberships for a user
roleRouter.get('/memberships/:userId', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { userId } = req.params;

  try {
    const { rows: memberships } = await pool.query(`
      SELECT tm.*, t.name AS tenant_name, t.type AS tenant_type
      FROM tenant_memberships tm
      JOIN tenants t ON tm.tenant_id = t.id
      WHERE tm.user_id = $1::uuid
      ORDER BY t.type, t.name
    `, [userId]);

    res.json({ userId, memberships });
  } catch {
    // tenant_memberships table may not exist yet
    res.json({ userId, memberships: [], message: 'tenant_memberships table not yet provisioned' });
  }
});
