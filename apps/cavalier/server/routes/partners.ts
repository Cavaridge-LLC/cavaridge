/**
 * CVG-CAVALIER — Partner Portal Routes
 *
 * MSP onboarding (with RMM credential validation + connector config),
 * partner tier management, usage dashboard, commission tracking,
 * payout requests, and profile management.
 *
 * Partner tiers: Starter / Professional / Enterprise.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb, getSql } from '../db';

export const partnerRouter = Router();

// Partner tier definitions
const PARTNER_TIERS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPerTech: 149,
    maxConnectors: 2,
    maxRmmConnectors: 2,
    maxStdConnectors: 3,
    features: ['Ducky Intelligence + Spaniel', 'PSA-lite', 'Client Portal', 'Co-branded'],
    apps: ['CVG-CORE', 'CVG-AI', 'CVG-RESEARCH'],
    support: 'Community',
    hipaa: 'Templates only',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    monthlyPerTech: 249,
    maxConnectors: 4,
    maxRmmConnectors: 4,
    maxStdConnectors: 10,
    features: ['Everything in Starter', 'Caelum SoW Builder', 'Midas QBR/Roadmap', 'Vespar Migration', 'Priority Slack support', 'Partner-branded'],
    apps: ['CVG-CORE', 'CVG-AI', 'CVG-RESEARCH', 'CVG-CAELUM', 'CVG-MIDAS', 'CVG-VESPAR'],
    support: 'Priority Slack',
    hipaa: 'Automation',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPerTech: 349,
    maxConnectors: -1, // unlimited
    maxRmmConnectors: -1,
    maxStdConnectors: -1,
    features: ['Everything in Professional', 'AEGIS Security', 'Meridian M&A', 'Brain Knowledge', 'White-label', 'Dedicated PSM'],
    apps: ['ALL'],
    support: 'Dedicated PSM',
    hipaa: 'Full + audit',
  },
} as const;

// ─── Get partner tiers catalog ──────────────────────────────────────
partnerRouter.get('/tiers', async (_req: Request, res: Response) => {
  res.json(Object.values(PARTNER_TIERS));
});

// ─── Get current partner profile ────────────────────────────────────
partnerRouter.get('/profile', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT t.*, pp.*
        FROM tenants t
        LEFT JOIN partner_profiles pp ON pp.tenant_id = t.id
        WHERE t.id = $1
      `,
      params: [req.tenantId!],
    } as any);

    const profile = (result as any)[0];
    if (!profile) {
      res.status(404).json({ error: 'Partner profile not found' });
      return;
    }

    // Look up tier details
    const tierKey = (profile.partner_tier ?? 'starter') as keyof typeof PARTNER_TIERS;
    const tierDetails = PARTNER_TIERS[tierKey] ?? PARTNER_TIERS.starter;

    res.json({ ...profile, tierDetails });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Onboarding — create/update partner profile + RMM connector ─────
partnerRouter.post('/onboard', async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const {
      companyName, contactName, contactEmail, contactPhone,
      tier = 'starter', techCount = 1,
      domain, industry, companySize,
      rmmProvider, rmmCredentials,
    } = req.body;

    if (!companyName || !contactName || !contactEmail) {
      res.status(400).json({ error: 'companyName, contactName, and contactEmail are required' });
      return;
    }

    if (!['starter', 'professional', 'enterprise'].includes(tier)) {
      res.status(400).json({ error: 'Invalid tier. Must be starter, professional, or enterprise.' });
      return;
    }

    // Validate RMM provider if supplied
    const validRmmProviders = [
      'ninjaone', 'connectwise_automate', 'datto_rmm',
      'atera', 'syncro', 'halopsa',
    ];
    const isKnownRmm = rmmProvider && validRmmProviders.includes(rmmProvider);

    // Upsert partner profile with extended fields
    const profileResult = await sql.unsafe(
      `INSERT INTO partner_profiles
        (tenant_id, company_name, contact_name, contact_email, contact_phone,
         partner_tier, tech_count, domain, industry, company_size,
         rmm_provider, onboarded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         company_name = EXCLUDED.company_name,
         contact_name = EXCLUDED.contact_name,
         contact_email = EXCLUDED.contact_email,
         contact_phone = EXCLUDED.contact_phone,
         partner_tier = EXCLUDED.partner_tier,
         tech_count = EXCLUDED.tech_count,
         domain = EXCLUDED.domain,
         industry = EXCLUDED.industry,
         company_size = EXCLUDED.company_size,
         rmm_provider = EXCLUDED.rmm_provider,
         updated_at = NOW()
       RETURNING *`,
      [
        req.tenantId!, companyName, contactName, contactEmail, contactPhone ?? null,
        tier, techCount, domain ?? null, industry ?? null, companySize ?? null,
        rmmProvider ?? null,
      ],
    );

    // If RMM credentials provided, upsert connector config
    let connectorResult = null;
    if (rmmProvider && rmmCredentials) {
      const connectorId = isKnownRmm ? rmmProvider : 'custom_rmm';

      connectorResult = await sql.unsafe(
        `INSERT INTO connector_configs
          (tenant_id, connector_id, enabled, credentials, config, status, health_status)
         VALUES ($1, $2, true, $3, $4, 'configured', 'unknown')
         ON CONFLICT ON CONSTRAINT uq_connector_tenant
         DO UPDATE SET
           credentials = EXCLUDED.credentials,
           config = EXCLUDED.config,
           status = 'configured',
           enabled = true,
           updated_at = NOW()
         RETURNING id, connector_id, status, health_status`,
        [
          req.tenantId!,
          connectorId,
          JSON.stringify(rmmCredentials),
          JSON.stringify({ rmmProvider, customName: isKnownRmm ? null : rmmProvider }),
        ],
      );
    }

    res.status(201).json({
      profile: profileResult[0],
      connector: connectorResult?.[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update partner tier ────────────────────────────────────────────
partnerRouter.patch('/tier', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { tier } = req.body;

    if (!['starter', 'professional', 'enterprise'].includes(tier)) {
      res.status(400).json({ error: 'Invalid tier. Must be starter, professional, or enterprise.' });
      return;
    }

    const result = await db.execute({
      sql: `
        UPDATE partner_profiles
        SET partner_tier = $1, updated_at = NOW()
        WHERE tenant_id = $2
        RETURNING *
      `,
      params: [tier, req.tenantId!],
    } as any);

    const profile = (result as any)[0];
    if (!profile) {
      res.status(404).json({ error: 'Partner profile not found. Complete onboarding first.' });
      return;
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Usage dashboard ────────────────────────────────────────────────
partnerRouter.get('/usage', async (req: Request, res: Response) => {
  try {
    const db = getDb();

    // Aggregate stats across all child tenants
    const stats = await db.execute({
      sql: `
        SELECT
          (SELECT COUNT(*)::int FROM tenants WHERE parent_id = $1 AND type = 'client') as client_count,
          (SELECT COUNT(*)::int FROM tickets WHERE tenant_id = $1) as total_tickets,
          (SELECT COUNT(*)::int FROM tickets WHERE tenant_id = $1 AND status NOT IN ('resolved', 'closed', 'cancelled')) as open_tickets,
          (SELECT COUNT(*)::int FROM contracts WHERE tenant_id = $1 AND status = 'active') as active_contracts,
          (SELECT COUNT(*)::int FROM connector_configs WHERE tenant_id = $1 AND enabled = true) as active_connectors,
          (SELECT COALESCE(SUM(total::numeric), 0)::text FROM invoices WHERE tenant_id = $1 AND status = 'paid' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())) as mrr
      `,
      params: [req.tenantId!],
    } as any);

    // SLA compliance rate
    const slaStats = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total_resolved,
          COUNT(*) FILTER (WHERE sla_resolution_breached = false)::int as within_sla
        FROM tickets
        WHERE tenant_id = $1
          AND status IN ('resolved', 'closed')
          AND created_at > NOW() - INTERVAL '30 days'
      `,
      params: [req.tenantId!],
    } as any);

    const sla = (slaStats as any)[0] ?? {};
    const complianceRate = sla.total_resolved > 0
      ? Math.round((sla.within_sla / sla.total_resolved) * 100)
      : 100;

    res.json({
      ...(stats as any)[0],
      slaComplianceRate: complianceRate,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── List clients (child tenants) ───────────────────────────────────
partnerRouter.get('/clients', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT t.*,
          (SELECT COUNT(*)::int FROM tickets WHERE client_id = t.id AND status NOT IN ('resolved', 'closed', 'cancelled')) as open_tickets,
          (SELECT COUNT(*)::int FROM contracts WHERE client_id = t.id AND status = 'active') as active_contracts
        FROM tenants t
        WHERE t.parent_id = $1 AND t.type IN ('client', 'prospect')
        ORDER BY t.name ASC
      `,
      params: [req.tenantId!],
    } as any);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update partner profile ────────────────────────────────────────
partnerRouter.patch('/profile', async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const {
      companyName, contactName, contactEmail, contactPhone,
      domain, industry, companySize,
    } = req.body;

    // Build dynamic SET clause from provided fields
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const addField = (column: string, value: unknown) => {
      if (value !== undefined) {
        updates.push(`${column} = $${idx++}`);
        params.push(value);
      }
    };

    addField('company_name', companyName);
    addField('contact_name', contactName);
    addField('contact_email', contactEmail);
    addField('contact_phone', contactPhone);
    addField('domain', domain);
    addField('industry', industry);
    addField('company_size', companySize);

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);

    const result = await sql.unsafe(
      `UPDATE partner_profiles
       SET ${updates.join(', ')}
       WHERE tenant_id = $${idx}
       RETURNING *`,
      [...params, req.tenantId!],
    );

    if (!result[0]) {
      res.status(404).json({ error: 'Partner profile not found. Complete onboarding first.' });
      return;
    }

    // Attach tier details
    const tierKey = ((result[0] as any).partner_tier ?? 'starter') as keyof typeof PARTNER_TIERS;
    const tierDetails = PARTNER_TIERS[tierKey] ?? PARTNER_TIERS.starter;

    res.json({ ...(result[0] as any), tierDetails });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Partner commissions — list with filters ────────────────────────
partnerRouter.get('/commissions', async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const { status, productCode, dateFrom, dateTo, page = '1', pageSize = '100' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    let query = `
      SELECT cr.*, d.deal_number, d.prospect_company
      FROM commission_records cr
      LEFT JOIN deal_registrations d ON d.id = cr.deal_id
      WHERE cr.tenant_id = $1
    `;
    const params: unknown[] = [req.tenantId!];
    let idx = 2;

    if (status && status !== 'all') {
      query += ` AND cr.status = $${idx++}`;
      params.push(status);
    }
    if (productCode && productCode !== 'all') {
      query += ` AND cr.product_code = $${idx++}`;
      params.push(productCode);
    }
    if (dateFrom) {
      query += ` AND cr.earned_at >= $${idx++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ` AND cr.earned_at <= $${idx++}::date + INTERVAL '1 day'`;
      params.push(dateTo);
    }

    query += ` ORDER BY cr.earned_at DESC NULLS LAST, cr.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await sql.unsafe(query, params as any[]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Partner commissions — aggregate summary ────────────────────────
partnerRouter.get('/commissions/summary', async (req: Request, res: Response) => {
  try {
    const sql = getSql();

    const result = await sql.unsafe(
      `SELECT
         COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('earned', 'paid', 'pending_payout')), 0)::text as total_earned,
         COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('pending', 'earned')), 0)::text as pending,
         COALESCE(SUM(commission_amount) FILTER (
           WHERE status = 'paid'
             AND paid_at >= DATE_TRUNC('month', NOW())
         ), 0)::text as paid_this_month,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0)::text as lifetime,
         COUNT(*) FILTER (WHERE status IN ('pending', 'earned'))::int as pending_count,
         COUNT(*) FILTER (WHERE status = 'earned')::int as earned_count,
         COUNT(*) FILTER (WHERE status = 'paid')::int as paid_count
       FROM commission_records
       WHERE tenant_id = $1`,
      [req.tenantId!],
    );

    res.json(result[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Partner commissions — monthly trends (last 12 months) ──────────
partnerRouter.get('/commissions/trends', async (req: Request, res: Response) => {
  try {
    const sql = getSql();

    const result = await sql.unsafe(
      `WITH months AS (
         SELECT generate_series(
           DATE_TRUNC('month', NOW()) - INTERVAL '11 months',
           DATE_TRUNC('month', NOW()),
           '1 month'
         )::date as month_start
       )
       SELECT
         TO_CHAR(m.month_start, 'YYYY-MM') as month,
         TO_CHAR(m.month_start, 'Mon') as label,
         COALESCE(SUM(cr.commission_amount) FILTER (WHERE cr.status IN ('earned', 'paid', 'pending_payout')), 0)::text as earned,
         COALESCE(SUM(cr.commission_amount) FILTER (WHERE cr.status = 'paid'), 0)::text as paid
       FROM months m
       LEFT JOIN commission_records cr
         ON cr.tenant_id = $1
         AND DATE_TRUNC('month', COALESCE(cr.earned_at, cr.created_at)) = m.month_start
       GROUP BY m.month_start
       ORDER BY m.month_start ASC`,
      [req.tenantId!],
    );

    const trends = (result as any[]).map((r: any) => ({
      month: r.month,
      label: r.label,
      earned: parseFloat(r.earned ?? '0'),
      paid: parseFloat(r.paid ?? '0'),
    }));

    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Request payout — mark earned commissions as pending_payout ─────
partnerRouter.post('/commissions/payout', async (req: Request, res: Response) => {
  try {
    const sql = getSql();

    // Mark all earned commissions as pending_payout for this tenant
    const result = await sql.unsafe(
      `UPDATE commission_records
       SET status = 'pending_payout', updated_at = NOW()
       WHERE tenant_id = $1
         AND status = 'earned'
       RETURNING id`,
      [req.tenantId!],
    );

    const count = (result as any[]).length;

    if (count === 0) {
      res.json({ count: 0, message: 'No earned commissions available for payout.' });
      return;
    }

    // Calculate total payout amount
    const totalResult = await sql.unsafe(
      `SELECT COALESCE(SUM(commission_amount), 0)::text as total
       FROM commission_records
       WHERE tenant_id = $1 AND status = 'pending_payout'`,
      [req.tenantId!],
    );

    res.json({
      count,
      total: (totalResult as any[])[0]?.total ?? '0',
      message: `${count} commission(s) marked for payout.`,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
