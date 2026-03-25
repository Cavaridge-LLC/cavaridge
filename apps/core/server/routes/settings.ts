/**
 * Configuration management routes.
 * Platform settings: feature flags, rate limits, maintenance mode,
 * branding, LLM routing config.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth.js';
import { getPool } from '../db.js';

export const settingsRouter: RouterType = Router();

// -------------------------------------------------------------------------
// Feature flags
// -------------------------------------------------------------------------

settingsRouter.get('/feature-flags', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: flags } = await pool.query('SELECT * FROM feature_flags ORDER BY category, name');
    res.json({ flags });
  } catch {
    res.json({
      flags: [
        { name: 'agent_test_required', category: 'agents', enabled: true, description: 'Require agent-test simulation pass before version promotion' },
        { name: 'blueprint_save_prompt', category: 'agents', enabled: true, description: 'Prompt blueprint save after successful Ducky builds' },
        { name: 'hipaa_zdr_mode', category: 'compliance', enabled: false, description: 'HIPAA Zero Data Retention mode for Spaniel' },
        { name: 'connector_marketplace', category: 'connectors', enabled: false, description: 'Enable connector marketplace for tenant requests' },
        { name: 'multi_model_consensus', category: 'llm', enabled: false, description: 'Enable Spaniel cross-validation (Addendum B)' },
        { name: 'freemium_scan', category: 'aegis', enabled: false, description: 'Enable AEGIS freemium external scan' },
        { name: 'maintenance_mode', category: 'platform', enabled: false, description: 'Platform-wide maintenance mode' },
      ],
      source: 'defaults',
    });
  }
});

settingsRouter.patch('/feature-flags/:name', async (req: AuthenticatedRequest, res) => {
  const { enabled } = req.body;

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE feature_flags SET enabled = $1, updated_at = now() WHERE name = $2 RETURNING *`,
      [enabled, req.params.name],
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Flag not found' }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Feature flags table not yet provisioned' });
  }
});

// -------------------------------------------------------------------------
// Branding
// -------------------------------------------------------------------------

settingsRouter.get('/branding', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT config FROM tenants WHERE type = 'platform' LIMIT 1`);
    res.json({ branding: rows[0]?.config ?? {} });
  } catch {
    res.json({
      branding: {
        primaryColor: '#2E5090',
        companyName: 'Cavaridge',
        tagline: 'Powered by Ducky Intelligence.',
        logoUrl: null,
      },
    });
  }
});

settingsRouter.patch('/branding', async (req: AuthenticatedRequest, res) => {
  const { branding } = req.body;

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE tenants SET config = config || $1::jsonb, updated_at = now() WHERE type = 'platform' RETURNING config`,
      [JSON.stringify(branding)],
    );
    res.json({ branding: rows[0]?.config ?? branding });
  } catch {
    res.status(500).json({ error: 'Platform tenant not yet provisioned' });
  }
});

// -------------------------------------------------------------------------
// LLM routing config
// -------------------------------------------------------------------------

settingsRouter.get('/llm-config', async (_req: AuthenticatedRequest, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('http://localhost:5100/api/v1/models', { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      res.json({ source: 'spaniel', ...data });
      return;
    }
  } catch {
    // Spaniel not running — return default config
  }

  res.json({
    source: 'defaults',
    models: {
      reasoning: { primary: 'anthropic/claude-sonnet-4', secondary: 'openai/gpt-4o', tertiary: 'google/gemini-2.0-flash' },
      generation: { primary: 'anthropic/claude-sonnet-4', secondary: 'openai/gpt-4o-mini' },
      extraction: { primary: 'openai/gpt-4o-mini', secondary: 'google/gemini-2.0-flash' },
      embedding: { primary: 'openai/text-embedding-3-small' },
    },
    routing: 'task-type-based',
    fallback: 'three-tier-cascade',
  });
});

// -------------------------------------------------------------------------
// Rate limits
// -------------------------------------------------------------------------

settingsRouter.get('/rate-limits', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: limits } = await pool.query('SELECT * FROM rate_limits ORDER BY scope, name');
    res.json({ rateLimits: limits });
  } catch {
    // Table may not exist — return defaults
    res.json({
      rateLimits: [
        { name: 'api_global', scope: 'platform', window_ms: 60000, max_requests: 1000, description: 'Global API rate limit per minute' },
        { name: 'llm_per_tenant', scope: 'tenant', window_ms: 60000, max_requests: 100, description: 'LLM calls per tenant per minute' },
        { name: 'llm_per_user', scope: 'user', window_ms: 60000, max_requests: 20, description: 'LLM calls per user per minute' },
        { name: 'auth_login', scope: 'ip', window_ms: 900000, max_requests: 10, description: 'Login attempts per IP per 15 minutes' },
        { name: 'export', scope: 'user', window_ms: 3600000, max_requests: 5, description: 'Data exports per user per hour' },
      ],
      source: 'defaults',
    });
  }
});

settingsRouter.patch('/rate-limits/:name', async (req: AuthenticatedRequest, res) => {
  const { window_ms, max_requests } = req.body;

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE rate_limits SET window_ms = COALESCE($1, window_ms), max_requests = COALESCE($2, max_requests), updated_at = now() WHERE name = $3 RETURNING *`,
      [window_ms ?? null, max_requests ?? null, req.params.name],
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Rate limit not found' }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Rate limits table not yet provisioned' });
  }
});

// -------------------------------------------------------------------------
// Maintenance mode
// -------------------------------------------------------------------------

settingsRouter.get('/maintenance', async (_req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT config->'maintenance' AS maintenance FROM tenants WHERE type = 'platform' LIMIT 1`,
    );
    const maintenance = rows[0]?.maintenance ?? { enabled: false, message: null, allowedRoles: ['platform_admin'] };
    res.json({ maintenance });
  } catch {
    res.json({
      maintenance: {
        enabled: false,
        message: null,
        allowedRoles: ['platform_admin'],
        scheduledStart: null,
        scheduledEnd: null,
      },
    });
  }
});

settingsRouter.patch('/maintenance', async (req: AuthenticatedRequest, res) => {
  const { enabled, message, scheduledStart, scheduledEnd } = req.body;

  const maintenance = {
    enabled: enabled ?? false,
    message: message ?? null,
    allowedRoles: ['platform_admin'],
    scheduledStart: scheduledStart ?? null,
    scheduledEnd: scheduledEnd ?? null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE tenants SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{maintenance}', $1::jsonb), updated_at = now() WHERE type = 'platform' RETURNING config->'maintenance' AS maintenance`,
      [JSON.stringify(maintenance)],
    );
    res.json({ maintenance: rows[0]?.maintenance ?? maintenance });
  } catch {
    res.status(500).json({ error: 'Platform tenant not yet provisioned' });
  }
});

// -------------------------------------------------------------------------
// All settings summary
// -------------------------------------------------------------------------

settingsRouter.get('/', async (_req: AuthenticatedRequest, res) => {
  res.json({
    endpoints: {
      featureFlags: '/api/v1/admin/settings/feature-flags',
      branding: '/api/v1/admin/settings/branding',
      llmConfig: '/api/v1/admin/settings/llm-config',
      rateLimits: '/api/v1/admin/settings/rate-limits',
      maintenance: '/api/v1/admin/settings/maintenance',
    },
  });
});
