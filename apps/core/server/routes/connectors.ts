/**
 * Connector marketplace routes.
 * List all 25 connectors, status per tenant, request/vote system.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth.js';
import { getPool } from '../db.js';

export const connectorMarketplaceRouter: RouterType = Router();

// Full connector catalog — 25 connectors per CLAUDE.md
const CONNECTOR_CATALOG = [
  { id: 'ninjaone', name: 'NinjaOne', vertical: 'msp', tier: 'base', phase: 1, description: 'RMM monitoring, patch management, remote access' },
  { id: 'halopsa', name: 'HaloPSA', vertical: 'msp', tier: 'base', phase: 1, description: 'PSA ticketing, billing, project management' },
  { id: 'connectwise-automate', name: 'ConnectWise Automate', vertical: 'msp', tier: 'pro', phase: 3, description: 'RMM automation and scripting' },
  { id: 'datto-rmm', name: 'Datto RMM', vertical: 'msp', tier: 'pro', phase: 3, description: 'Remote monitoring and management' },
  { id: 'atera', name: 'Atera', vertical: 'msp', tier: 'pro', phase: 2, description: 'All-in-one RMM/PSA platform' },
  { id: 'syncro', name: 'Syncro', vertical: 'msp', tier: 'pro', phase: 2, description: 'Combined RMM/PSA for SMB MSPs' },
  { id: 'connectwise-manage', name: 'ConnectWise Manage', vertical: 'msp', tier: 'enterprise', phase: 3, description: 'Business management for technology providers' },
  { id: 'it-glue', name: 'IT Glue', vertical: 'msp', tier: 'pro', phase: 2, description: 'IT documentation platform' },
  { id: 'hudu', name: 'Hudu', vertical: 'msp', tier: 'pro', phase: 2, description: 'IT documentation and password management' },
  { id: 'athenahealth', name: 'athenahealth', vertical: 'healthcare', tier: 'enterprise', phase: 3, description: 'EHR, practice management, revenue cycle' },
  { id: 'epic', name: 'Epic (read-only)', vertical: 'healthcare', tier: 'enterprise', phase: 3, description: 'EHR data access via FHIR APIs' },
  { id: 'kareo', name: 'Kareo', vertical: 'healthcare', tier: 'pro', phase: 2, description: 'Practice management and billing' },
  { id: 'meditech', name: 'MEDITECH', vertical: 'healthcare', tier: 'enterprise', phase: 3, description: 'Hospital information system' },
  { id: 'jira', name: 'Jira', vertical: 'itsm', tier: 'base', phase: 1, description: 'Issue tracking and project management' },
  { id: 'servicenow', name: 'ServiceNow', vertical: 'itsm', tier: 'enterprise', phase: 2, description: 'IT service management' },
  { id: 'zendesk', name: 'Zendesk', vertical: 'itsm', tier: 'pro', phase: 2, description: 'Customer support and helpdesk' },
  { id: 'freshdesk', name: 'Freshdesk', vertical: 'itsm', tier: 'base', phase: 2, description: 'Customer support platform' },
  { id: 'quickbooks', name: 'QuickBooks', vertical: 'erp', tier: 'base', phase: 2, description: 'Accounting and invoicing' },
  { id: 'xero', name: 'Xero', vertical: 'erp', tier: 'base', phase: 2, description: 'Cloud accounting software' },
  { id: 'stripe', name: 'Stripe', vertical: 'erp', tier: 'base', phase: 1, description: 'Payment processing and billing' },
  { id: 'freshbooks', name: 'FreshBooks', vertical: 'erp', tier: 'base', phase: 2, description: 'Invoicing and expense tracking' },
  { id: 'slack', name: 'Slack', vertical: 'collaboration', tier: 'base', phase: 2, description: 'Team messaging and notifications' },
  { id: 'ms-teams', name: 'Microsoft Teams', vertical: 'collaboration', tier: 'base', phase: 2, description: 'Team collaboration and chat' },
  { id: 'google-workspace', name: 'Google Workspace', vertical: 'collaboration', tier: 'pro', phase: 2, description: 'Productivity suite integration' },
  { id: 'm365', name: 'Microsoft 365', vertical: 'collaboration', tier: 'base', phase: 1, description: 'M365 tenant data and Graph API' },
];

// Get full catalog
connectorMarketplaceRouter.get('/catalog', (_req: AuthenticatedRequest, res) => {
  const byVertical: Record<string, typeof CONNECTOR_CATALOG> = {};
  for (const c of CONNECTOR_CATALOG) {
    (byVertical[c.vertical] ??= []).push(c);
  }

  res.json({
    connectors: CONNECTOR_CATALOG,
    byVertical,
    summary: {
      total: CONNECTOR_CATALOG.length,
      byTier: {
        base: CONNECTOR_CATALOG.filter(c => c.tier === 'base').length,
        pro: CONNECTOR_CATALOG.filter(c => c.tier === 'pro').length,
        enterprise: CONNECTOR_CATALOG.filter(c => c.tier === 'enterprise').length,
      },
      byPhase: {
        1: CONNECTOR_CATALOG.filter(c => c.phase === 1).length,
        2: CONNECTOR_CATALOG.filter(c => c.phase === 2).length,
        3: CONNECTOR_CATALOG.filter(c => c.phase === 3).length,
      },
    },
  });
});

// Get connector configs across all tenants (platform admin view)
connectorMarketplaceRouter.get('/configs', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: configs } = await pool.query(`
      SELECT cc.*, t.name AS tenant_name
      FROM connector_configs cc
      JOIN tenants t ON cc.tenant_id = t.id
      ORDER BY cc.connector_id, t.name
    `);
    res.json({ configs });
  } catch {
    res.json({ configs: [] });
  }
});

// Get tenant connector requests/votes
connectorMarketplaceRouter.get('/requests', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: requests } = await pool.query(`
      SELECT cr.*, t.name AS tenant_name, p.full_name AS requested_by_name
      FROM connector_requests cr
      JOIN tenants t ON cr.tenant_id = t.id
      LEFT JOIN profiles p ON cr.requested_by = p.id
      ORDER BY cr.vote_count DESC, cr.created_at DESC
    `);
    res.json({ requests });
  } catch {
    res.json({ requests: [] });
  }
});

// Submit connector request
connectorMarketplaceRouter.post('/requests', async (req: AuthenticatedRequest, res) => {
  const { connector_id, tenant_id, reason } = req.body;

  if (!connector_id || !tenant_id) {
    res.status(400).json({ error: 'connector_id and tenant_id are required' });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authenticated user required' });
    return;
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(`
      INSERT INTO connector_requests (connector_id, tenant_id, requested_by, reason, vote_count)
      VALUES ($1, $2::uuid, $3::uuid, $4, 1)
      ON CONFLICT (connector_id, tenant_id) DO UPDATE SET vote_count = connector_requests.vote_count + 1
      RETURNING *
    `, [connector_id, tenant_id, userId, reason ?? null]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Could not submit request — connector_requests table may not be provisioned' });
  }
});
