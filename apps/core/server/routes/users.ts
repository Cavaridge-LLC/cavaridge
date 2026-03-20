/**
 * User management routes.
 * Create users, assign roles, assign to tenants, bulk invite.
 */
import { Router, type Router as RouterType } from 'express';
import { getSql } from '../db';

export const userRouter: RouterType = Router();

// List users with filters
userRouter.get('/', async (req, res) => {
  const sql = getSql();
  const { tenant_id, role, search, limit = '50', offset = '0' } = req.query;

  let query = sql`
    SELECT p.*,
      t.name AS tenant_name, t.type AS tenant_type
    FROM profiles p
    LEFT JOIN tenants t ON p.organization_id = t.id
    WHERE 1=1
  `;

  if (tenant_id) query = sql`${query} AND p.organization_id = ${tenant_id as string}::uuid`;
  if (role) query = sql`${query} AND p.role = ${role as string}`;
  if (search) query = sql`${query} AND (p.full_name ILIKE ${'%' + (search as string) + '%'} OR p.email ILIKE ${'%' + (search as string) + '%'})`;

  query = sql`${query} ORDER BY p.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

  const users = await query;

  let countQuery = sql`SELECT count(*) AS total FROM profiles WHERE 1=1`;
  if (tenant_id) countQuery = sql`${countQuery} AND organization_id = ${tenant_id as string}::uuid`;
  if (role) countQuery = sql`${countQuery} AND role = ${role as string}`;
  if (search) countQuery = sql`${countQuery} AND (full_name ILIKE ${'%' + (search as string) + '%'} OR email ILIKE ${'%' + (search as string) + '%'})`;
  const [{ total }] = await countQuery;

  res.json({ users, total: Number(total) });
});

// Get single user
userRouter.get('/:id', async (req, res) => {
  const sql = getSql();
  const [user] = await sql`
    SELECT p.*, t.name AS tenant_name, t.type AS tenant_type
    FROM profiles p
    LEFT JOIN tenants t ON p.organization_id = t.id
    WHERE p.id = ${req.params.id}::uuid
  `;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

// Create user (invite)
userRouter.post('/', async (req, res) => {
  const sql = getSql();
  const { email, full_name, role, organization_id } = req.body;

  if (!email || !role || !organization_id) {
    res.status(400).json({ error: 'email, role, and organization_id are required' });
    return;
  }

  const validRoles = ['platform_owner', 'platform_admin', 'tenant_admin', 'user', 'viewer'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    return;
  }

  // Check if email already exists
  const [existing] = await sql`SELECT id FROM profiles WHERE email = ${email}`;
  if (existing) {
    res.status(409).json({ error: 'User with this email already exists' });
    return;
  }

  // Create profile (in production, also triggers Supabase Auth invite)
  const [user] = await sql`
    INSERT INTO profiles (email, full_name, role, organization_id, status)
    VALUES (${email}, ${full_name ?? ''}, ${role}, ${organization_id}::uuid, 'invited')
    RETURNING *
  `;

  res.status(201).json(user);
});

// Bulk invite
userRouter.post('/bulk-invite', async (req, res) => {
  const sql = getSql();
  const { invites } = req.body; // Array of { email, full_name?, role, organization_id }

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
      const [existing] = await sql`SELECT id FROM profiles WHERE email = ${invite.email}`;
      if (existing) {
        results.push({ email: invite.email, status: 'exists' });
        continue;
      }

      await sql`
        INSERT INTO profiles (email, full_name, role, organization_id, status)
        VALUES (${invite.email}, ${invite.full_name ?? ''}, ${invite.role}, ${invite.organization_id}::uuid, 'invited')
      `;
      results.push({ email: invite.email, status: 'created' });
    } catch (err: any) {
      results.push({ email: invite.email, status: 'error', error: err.message });
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  res.json({ results, summary: { total: invites.length, created, skipped: invites.length - created } });
});

// Update user role/tenant
userRouter.patch('/:id', async (req, res) => {
  const sql = getSql();
  const { role, organization_id, full_name, status } = req.body;

  const [existing] = await sql`SELECT * FROM profiles WHERE id = ${req.params.id}::uuid`;
  if (!existing) { res.status(404).json({ error: 'User not found' }); return; }

  const [user] = await sql`
    UPDATE profiles SET
      role = COALESCE(${role ?? null}, role),
      organization_id = COALESCE(${organization_id ?? null}::uuid, organization_id),
      full_name = COALESCE(${full_name ?? null}, full_name),
      status = COALESCE(${status ?? null}, status),
      updated_at = now()
    WHERE id = ${req.params.id}::uuid
    RETURNING *
  `;

  res.json(user);
});

// Deactivate user
userRouter.post('/:id/deactivate', async (req, res) => {
  const sql = getSql();
  const [user] = await sql`
    UPDATE profiles SET status = 'inactive', updated_at = now()
    WHERE id = ${req.params.id}::uuid
    RETURNING *
  `;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

// User stats
userRouter.get('/stats/summary', async (_req, res) => {
  const sql = getSql();
  const byRole = await sql`
    SELECT role, count(*) AS count,
      count(*) FILTER (WHERE status = 'active') AS active,
      count(*) FILTER (WHERE status = 'invited') AS invited
    FROM profiles
    GROUP BY role
  `;

  const [totals] = await sql`
    SELECT count(*) AS total,
      count(*) FILTER (WHERE status = 'active') AS active,
      count(*) FILTER (WHERE status = 'invited') AS invited
    FROM profiles
  `;

  res.json({ byRole, total: Number(totals.total), active: Number(totals.active), invited: Number(totals.invited) });
});
