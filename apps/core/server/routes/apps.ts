/**
 * App registry dashboard routes.
 * Returns status of all 14 Cavaridge apps, health checks, deployment info.
 */
import { Router, type Router as RouterType } from 'express';
import type { AuthenticatedRequest } from '../auth';

export const appRouter: RouterType = Router();

// Canonical app registry — matches CLAUDE.md
const APP_REGISTRY = [
  { code: 'CVG-CORE', name: 'Governance Core', directory: 'apps/core', status: 'active', description: 'Central governance, RBAC, tenant provisioning', port: 5001 },
  { code: 'CVG-AI', name: 'Spaniel', directory: 'apps/spaniel', status: 'planned', description: 'Internal LLM gateway — sole router for all AI calls', port: null },
  { code: 'CVG-RESEARCH', name: 'Ducky', directory: 'apps/ducky', status: 'planned', description: 'User-facing research & intelligence platform', port: null },
  { code: 'CVG-CAELUM', name: 'Caelum', directory: 'apps/caelum', status: 'active', description: 'SoW builder — DIT is a tenant, not hardcoded', port: 3000 },
  { code: 'CVG-FORGE', name: 'Forge', directory: 'apps/forge', status: 'planned', description: 'Autonomous content creation platform', port: null },
  { code: 'CVG-MER', name: 'Meridian', directory: 'apps/meridian', status: 'active', description: 'M&A IT intelligence platform', port: null },
  { code: 'CVG-HIPAA', name: 'HIPAA Risk Assessment', directory: 'apps/hipaa', status: 'active', description: 'Healthcare compliance assessments', port: null },
  { code: 'CVG-AEGIS', name: 'Aegis', directory: 'apps/aegis', status: 'planned', description: 'Security posture & browser security platform', port: null },
  { code: 'CVG-MIDAS', name: 'Midas', directory: 'apps/midas', status: 'active', description: 'IT roadmap / QBR platform + security scoring', port: null },
  { code: 'CVG-VESPAR', name: 'Vespar', directory: 'apps/vespar', status: 'active', description: 'Cloud migration planning', port: null },
  { code: 'CVG-ASTRA', name: 'Astra', directory: 'apps/astra', status: 'active', description: 'M365 license optimization', port: null },
  { code: 'CVG-CERES', name: 'Ceres', directory: 'apps/ceres', status: 'active', description: 'Medicare 60-day frequency calculator', port: null },
  { code: 'CVG-BRAIN', name: 'Brain', directory: 'apps/brain', status: 'planned', description: 'Voice-first knowledge capture & recall', port: null },
  { code: 'CVG-CAVALIER', name: 'Cavalier Partners', directory: 'apps/cavalier', status: 'active', description: 'Channel partner GTM platform', port: 5000 },
];

// List all apps with status
appRouter.get('/', (_req: AuthenticatedRequest, res) => {
  res.json({
    apps: APP_REGISTRY,
    summary: {
      total: APP_REGISTRY.length,
      active: APP_REGISTRY.filter(a => a.status === 'active').length,
      planned: APP_REGISTRY.filter(a => a.status === 'planned').length,
    },
  });
});

// Health check for a specific app
appRouter.get('/:code/health', async (req: AuthenticatedRequest, res) => {
  const app = APP_REGISTRY.find(a => a.code === req.params.code.toUpperCase());
  if (!app) { res.status(404).json({ error: 'App not found' }); return; }

  if (!app.port) {
    res.json({ code: app.code, name: app.name, health: 'not_deployed', message: 'No running instance' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`http://localhost:${app.port}/healthz`, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      res.json({ code: app.code, name: app.name, health: 'healthy', data });
    } else {
      res.json({ code: app.code, name: app.name, health: 'degraded', statusCode: response.status });
    }
  } catch {
    res.json({ code: app.code, name: app.name, health: 'unreachable', message: 'Connection failed' });
  }
});

// Health check all apps with ports
appRouter.get('/health/all', async (_req: AuthenticatedRequest, res) => {
  const results = await Promise.all(
    APP_REGISTRY.map(async (app) => {
      if (!app.port) {
        return { code: app.code, name: app.name, health: 'not_deployed' as const };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`http://localhost:${app.port}/healthz`, { signal: controller.signal });
        clearTimeout(timeout);

        return {
          code: app.code,
          name: app.name,
          health: response.ok ? 'healthy' as const : 'degraded' as const,
        };
      } catch {
        return { code: app.code, name: app.name, health: 'unreachable' as const };
      }
    })
  );

  res.json({
    apps: results,
    summary: {
      healthy: results.filter(r => r.health === 'healthy').length,
      degraded: results.filter(r => r.health === 'degraded').length,
      unreachable: results.filter(r => r.health === 'unreachable').length,
      not_deployed: results.filter(r => r.health === 'not_deployed').length,
    },
  });
});
