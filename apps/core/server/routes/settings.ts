/**
 * Platform settings routes.
 * Feature flags, branding defaults, LLM routing config.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { getSql } from '../db';

export const settingsRouter: RouterType = Router();

// Get platform-level feature flags
settingsRouter.get('/feature-flags', async (_req: AuthenticatedRequest, res) => {
  try {
    const sql = getSql();
    const flags = await sql`
      SELECT * FROM feature_flags ORDER BY category, name
    `;
    res.json({ flags });
  } catch {
    // Table may not exist yet — return defaults
    res.json({
      flags: [
        { name: 'agent_test_required', category: 'agents', enabled: true, description: 'Require agent-test simulation pass before version promotion' },
        { name: 'blueprint_save_prompt', category: 'agents', enabled: true, description: 'Prompt blueprint save after successful Ducky builds' },
        { name: 'hipaa_zdr_mode', category: 'compliance', enabled: false, description: 'HIPAA Zero Data Retention mode for Spaniel' },
        { name: 'connector_marketplace', category: 'connectors', enabled: false, description: 'Enable connector marketplace for tenant requests' },
        { name: 'multi_model_consensus', category: 'llm', enabled: false, description: 'Enable Spaniel cross-validation (Addendum B)' },
        { name: 'freemium_scan', category: 'aegis', enabled: false, description: 'Enable AEGIS freemium external scan' },
      ],
    });
  }
});

// Update a feature flag
settingsRouter.patch('/feature-flags/:name', async (req: AuthenticatedRequest, res) => {
  const { enabled } = req.body;

  try {
    const sql = getSql();
    const [flag] = await sql`
      UPDATE feature_flags SET enabled = ${enabled}, updated_at = now()
      WHERE name = ${req.params.name}
      RETURNING *
    `;
    if (!flag) { res.status(404).json({ error: 'Flag not found' }); return; }
    res.json(flag);
  } catch {
    res.status(500).json({ error: 'Feature flags table not yet provisioned' });
  }
});

// Get branding defaults
settingsRouter.get('/branding', async (_req: AuthenticatedRequest, res) => {
  try {
    const sql = getSql();
    const [config] = await sql`
      SELECT config FROM tenants WHERE type = 'platform' LIMIT 1
    `;
    res.json({ branding: config?.config ?? {} });
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

// Update branding defaults
settingsRouter.patch('/branding', async (req: AuthenticatedRequest, res) => {
  const { branding } = req.body;

  try {
    const sql = getSql();
    const [tenant] = await sql`
      UPDATE tenants
      SET config = config || ${JSON.stringify(branding)}::jsonb, updated_at = now()
      WHERE type = 'platform'
      RETURNING config
    `;
    res.json({ branding: tenant?.config ?? branding });
  } catch {
    res.status(500).json({ error: 'Platform tenant not yet provisioned' });
  }
});

// LLM routing config (read from Spaniel if available, else defaults)
settingsRouter.get('/llm-config', async (_req: AuthenticatedRequest, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('http://localhost:5002/api/v1/models', { signal: controller.signal });
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
