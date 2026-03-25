/**
 * User management routes.
 * Create users, assign roles, assign to tenants, bulk invite.
 *
 * Platform Admin cross-tenant view — queries accept optional tenant_id filter.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { getPool } from '../db';

export const userRouter: RouterType = Router();

// List users with filters
userRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { tenant_id, role, search, limit = '50', offset = '0' } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (tenant_id) { conditions.push(`p.organization_id = $${idx++}::uuid`); params.push(tenant_id); }
  if (role) { conditions.push(`p.role = $${idx++}`); params.push(role); }
  if (search) {
    conditions.push(`(p.full_name ILIKE $${idx} OR p.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Number(limit), Number(offset));

  const { rows: users } = await pool.query(`
    SELECT p.*, t.name AS tenant_name, t.type AS tenant_type
    FROM profiles p
    LEFT JOIN tenants t ON p.organization_id = t.id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, params);

  const countParams = params.slice(0, params.length - 2);
  const { rows: [{ total }] } = await pool.query(
    `SELECT count(*) AS total FROM profiles p ${where}`,
    countParams,
  );

  res.json({ users, total: Number(total) });
});

// Get single user
userRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT p.*, t.name AS tenant_name, t.type AS tenant_type
    FROM profiles p
    LEFT JOIN tenants t ON p.organization_id = t.id
    WHERE p.id = $1::uuid
  `, [req.params.id]);

  if (rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(rows[0]);
});

// Create user (invite)
userRouter.post('/', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { email, full_name, role, organization_id } = req.body;

  if (!email || !role || !organization_id) {
    res.status(400).json({ error: 'email, role, and organization_id are required' });
    return;
  }

  const validRoles = ['platform_admin', 'msp_admin', 'msp_tech', 'client_admin', 'client_viewer', 'prospect'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const { rows: existing } = await pool.query('SELECT id FROM profiles WHERE email = $1', [email]);
  if (existing.length > 0) {
    res.status(409).json({ error: 'User with this email already exists' });
    return;
  }

  const { rows } = await pool.query(`
    INSERT INTO profiles (email, full_name, role, organization_id, status)
    VALUES ($1, $2, $3, $4::uuid, 'invited')
    RETURNING *
  `, [email, full_name ?? '', role, organization_id]);

  res.status(201).json(rows[0]);
});

// Bulk invite
userRouter.post('/bulk-invite', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { invites } = req.body;

  if (!Array.isArray(invites) || invites.length === 0) {
    res.status(400).json({ error: 'invites array is required' });
    return;
  }

  if (invites.length > 100) {
    res.status(400).json({ error: 'Maximum 100 invites per batch' });
    return;
  }

  const results: { email: string; status: 'created' | 'exists' | 'error'; error?: string }[] = [];

  for (const invite of invites) {
    try {
      const { rows: existing } = await pool.query('SELECT id FROM profiles WHERE email = $1', [invite.email]);
      if (existing.length > 0) {
        results.push({ email: invite.email, status: 'exists' });
        continue;
      }

      await pool.query(`
        INSERT INTO profiles (email, full_name, role, organization_id, status)
        VALUES ($1, $2, $3, $4::uuid, 'invited')
      `, [invite.email, invite.full_name ?? '', invite.role, invite.organization_id]);
      results.push({ email: invite.email, status: 'created' });
    } catch (err: any) {
      results.push({ email: invite.email, status: 'error', error: err.message });
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  res.json({ results, summary: { total: invites.length, created, skipped: invites.length - created } });
});

// Update user role/tenant
userRouter.patch('/:id', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { role, organization_id, full_name, status } = req.body;

  const { rows: existing } = await pool.query('SELECT id FROM profiles WHERE id = $1::uuid', [req.params.id]);
  if (existing.length === 0) { res.status(404).json({ error: 'User not found' }); return; }

  const { rows } = await pool.query(`
    UPDATE profiles SET
      role = COALESCE($1, role),
      organization_id = COALESCE($2::uuid, organization_id),
      full_name = COALESCE($3, full_name),
      status = COALESCE($4, status),
      updated_at = now()
    WHERE id = $5::uuid
    RETURNING *
  `, [role ?? null, organization_id ?? null, full_name ?? null, status ?? null, req.params.id]);

  res.json(rows[0]);
});

// Deactivate user
userRouter.post('/:id/deactivate', async (req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE profiles SET status = 'inactive', updated_at = now() WHERE id = $1::uuid RETURNING *`,
    [req.params.id],
  );
  if (rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(rows[0]);
});

// User stats
userRouter.get('/stats/summary', async (_req: AuthenticatedRequest, res) => {
  const pool = getPool();
  const { rows: byRole } = await pool.query(`
    SELECT role, count(*) AS count,
      count(*) FILTER (WHERE status = 'active') AS active,
      count(*) FILTER (WHERE status = 'invited') AS invited
    FROM profiles
    GROUP BY role
  `);

  const { rows: [totals] } = await pool.query(`
    SELECT count(*) AS total,
      count(*) FILTER (WHERE status = 'active') AS active,
      count(*) FILTER (WHERE status = 'invited') AS invited
    FROM profiles
  `);

  res.json({ byRole, total: Number(totals.total), active: Number(totals.active), invited: Number(totals.invited) });
});
