/**
 * CVG-CAVALIER — Partner Portal Routes
 *
 * MSP onboarding, partner tier management, usage dashboard.
 * Partner tiers: Starter / Professional / Enterprise.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';

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
    features: ['Ducky AI + Spaniel', 'PSA-lite', 'Client Portal', 'Co-branded'],
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
      params: [req.tenantId],
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

// ─── Onboarding — create/update partner profile ─────────────────────
partnerRouter.post('/onboard', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      companyName, contactName, contactEmail, contactPhone,
      tier = 'starter', techCount = 1,
    } = req.body;

    // Upsert partner profile
    const result = await db.execute({
      sql: `
        INSERT INTO partner_profiles
          (tenant_id, company_name, contact_name, contact_email, contact_phone, partner_tier, tech_count, onboarded_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (tenant_id)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          contact_name = EXCLUDED.contact_name,
          contact_email = EXCLUDED.contact_email,
          contact_phone = EXCLUDED.contact_phone,
          partner_tier = EXCLUDED.partner_tier,
          tech_count = EXCLUDED.tech_count,
          updated_at = NOW()
        RETURNING *
      `,
      params: [req.tenantId, companyName, contactName, contactEmail, contactPhone, tier, techCount],
    } as any);

    res.status(201).json((result as any)[0]);
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
      params: [tier, req.tenantId],
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
      params: [req.tenantId],
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
      params: [req.tenantId],
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
      params: [req.tenantId],
    } as any);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
