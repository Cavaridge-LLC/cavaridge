/**
 * CVG-AEGIS — SaaS Discovery Routes
 *
 * Discovered SaaS applications per tenant.
 * Classification: sanctioned / unsanctioned / unclassified / blocked.
 *
 * Read: MSP Tech+ (enforced at router mount).
 * Write (PATCH): MSP Admin only.
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '@cavaridge/auth/server';
import { requireRole } from '@cavaridge/auth/guards';
import { ROLES } from '@cavaridge/auth';
import { getDb } from '../db';
import { getCategories, SAAS_CATALOG } from '../lib/saas-catalog';

export const saasRouter = Router();

// ─── List discovered SaaS applications ─────────────────────────────────

saasRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { classification, category, search, sort = 'last_seen_at', order = 'desc' } = req.query;

    let query = `SELECT * FROM aegis.saas_applications WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (classification) {
      query += ` AND classification = $${idx++}`;
      params.push(classification);
    }
    if (category) {
      query += ` AND category = $${idx++}`;
      params.push(category);
    }
    if (search) {
      query += ` AND (name ILIKE $${idx} OR domain ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const validSorts = ['name', 'domain', 'category', 'visit_count', 'last_seen_at', 'risk_score', 'first_seen_at'];
    const sortCol = validSorts.includes(sort as string) ? sort : 'last_seen_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${sortOrder}`;

    const result = await db.execute({ sql: query, params } as any);
    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── SaaS discovery summary ────────────────────────────────────────────

saasRouter.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const result = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE classification = 'sanctioned')::int as sanctioned,
          COUNT(*) FILTER (WHERE classification = 'unsanctioned')::int as unsanctioned,
          COUNT(*) FILTER (WHERE classification = 'unclassified')::int as unclassified,
          COUNT(*) FILTER (WHERE classification = 'blocked')::int as blocked,
          COUNT(DISTINCT category)::int as categories,
          COALESCE(AVG(risk_score), 0)::int as avg_risk_score
        FROM aegis.saas_applications
        WHERE tenant_id = $1
      `,
      params: [tenantId],
    } as any);

    res.json((result as any)[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── SaaS by category breakdown ────────────────────────────────────────

saasRouter.get('/by-category', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const result = await db.execute({
      sql: `
        SELECT category, COUNT(*)::int as count,
          COALESCE(AVG(risk_score), 0)::int as avg_risk,
          SUM(visit_count)::int as total_visits
        FROM aegis.saas_applications
        WHERE tenant_id = $1
        GROUP BY category
        ORDER BY count DESC
      `,
      params: [tenantId],
    } as any);

    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update SaaS classification (MSP Admin only) ─────────────────────

saasRouter.patch('/:id', requireRole(ROLES.MSP_ADMIN) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { classification, notes } = req.body;

    if (classification && !['sanctioned', 'unsanctioned', 'unclassified', 'blocked'].includes(classification)) {
      res.status(400).json({ error: 'Invalid classification.' });
      return;
    }

    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    let idx = 1;

    if (classification) { sets.push(`classification = $${idx++}`); params.push(classification); }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(notes); }

    params.push(req.params.id, tenantId);

    const result = await db.execute({
      sql: `UPDATE aegis.saas_applications SET ${sets.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx++} RETURNING *`,
      params,
    } as any);

    const app = (result as any)[0];
    if (!app) {
      res.status(404).json({ error: 'SaaS application not found' });
      return;
    }

    res.json(app);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get SaaS catalog (reference data) ─────────────────────────────────

saasRouter.get('/catalog', (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    entries: SAAS_CATALOG.map(e => ({
      name: e.name,
      domains: e.domains,
      category: e.category,
      vendor: e.vendor,
      riskScore: e.riskScore,
    })),
    categories: getCategories(),
  });
});
