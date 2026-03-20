/**
 * CVG-CAVALIER — Connector Management Routes
 *
 * NinjaOne and HaloPSA connector configuration, sync status,
 * error logs, and manual sync triggers.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';

export const connectorRouter = Router();

// ─── Available connectors catalog ───────────────────────────────────
const AVAILABLE_CONNECTORS = [
  {
    id: 'ninjaone',
    name: 'NinjaOne',
    type: 'rmm',
    description: 'RMM platform — device inventory, alerts, patches, scripting',
    phase: 1,
    logo: '/assets/connectors/ninjaone.svg',
    requiredCredentials: ['clientId', 'clientSecret'],
    optionalSettings: ['baseUrl', 'syncIntervalMinutes', 'region'],
  },
  {
    id: 'halopsa',
    name: 'HaloPSA',
    type: 'psa',
    description: 'PSA platform — tickets, contracts, time entries, clients',
    phase: 1,
    logo: '/assets/connectors/halopsa.svg',
    requiredCredentials: ['clientId', 'clientSecret', 'tenantUrl'],
    optionalSettings: ['syncIntervalMinutes', 'authMode'],
  },
  {
    id: 'atera',
    name: 'Atera',
    type: 'rmm',
    description: 'RMM platform — devices, alerts, tickets',
    phase: 2,
    logo: '/assets/connectors/atera.svg',
    requiredCredentials: ['apiKey'],
    optionalSettings: [],
  },
  {
    id: 'syncro',
    name: 'Syncro',
    type: 'rmm',
    description: 'RMM/PSA platform — assets, tickets, invoices',
    phase: 2,
    logo: '/assets/connectors/syncro.svg',
    requiredCredentials: ['apiKey', 'subdomain'],
    optionalSettings: [],
  },
  {
    id: 'guardz',
    name: 'Guardz',
    type: 'security',
    description: 'Security platform — posture scoring, threat detection',
    phase: 2,
    logo: '/assets/connectors/guardz.svg',
    requiredCredentials: ['apiKey'],
    optionalSettings: [],
  },
];

// ─── List available connectors ──────────────────────────────────────
connectorRouter.get('/catalog', async (_req: Request, res: Response) => {
  res.json(AVAILABLE_CONNECTORS);
});

// ─── List tenant's configured connectors ────────────────────────────
connectorRouter.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT id, tenant_id, connector_id, status, config,
               last_health_check, health_status, health_details,
               enabled, created_at, updated_at
        FROM connector_configs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `,
      params: [req.tenantId],
    } as any);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get connector config ───────────────────────────────────────────
connectorRouter.get('/:connectorId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM connector_configs WHERE connector_id = $1 AND tenant_id = $2`,
      params: [req.params.connectorId, req.tenantId],
    } as any);

    const config = (result as any)[0];
    if (!config) {
      res.status(404).json({ error: 'Connector not configured' });
      return;
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Configure / update connector ───────────────────────────────────
connectorRouter.put('/:connectorId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { connectorId } = req.params;
    const { config, credentials } = req.body;

    // Validate connector exists in catalog
    const catalogEntry = AVAILABLE_CONNECTORS.find((c) => c.id === connectorId);
    if (!catalogEntry) {
      res.status(400).json({ error: `Unknown connector: ${connectorId}` });
      return;
    }

    // Check required credentials
    for (const key of catalogEntry.requiredCredentials) {
      if (!credentials?.[key]) {
        res.status(400).json({ error: `Missing required credential: ${key}` });
        return;
      }
    }

    // NOTE: In production, credentials are stored in Doppler.
    // For dev, they are AES-256-GCM encrypted in credentials_encrypted column.
    // Here we store a placeholder — real encryption handled by packages/auth.
    const credentialsEncrypted = JSON.stringify(credentials);

    const result = await db.execute({
      sql: `
        INSERT INTO connector_configs (tenant_id, connector_id, status, config, credentials_encrypted)
        VALUES ($1, $2, 'configuring', $3, $4)
        ON CONFLICT ON CONSTRAINT uq_connector_configs_tenant_connector
        DO UPDATE SET
          config = EXCLUDED.config,
          credentials_encrypted = EXCLUDED.credentials_encrypted,
          status = 'configuring',
          updated_at = NOW()
        RETURNING *
      `,
      params: [req.tenantId, connectorId, JSON.stringify(config ?? {}), credentialsEncrypted],
    } as any);

    res.json((result as any)[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Enable/disable connector ───────────────────────────────────────
connectorRouter.patch('/:connectorId/toggle', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        UPDATE connector_configs
        SET enabled = NOT enabled, updated_at = NOW()
        WHERE connector_id = $1 AND tenant_id = $2
        RETURNING *
      `,
      params: [req.params.connectorId, req.tenantId],
    } as any);

    const config = (result as any)[0];
    if (!config) {
      res.status(404).json({ error: 'Connector not configured' });
      return;
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Delete connector config ────────────────────────────────────────
connectorRouter.delete('/:connectorId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: `DELETE FROM connector_configs WHERE connector_id = $1 AND tenant_id = $2`,
      params: [req.params.connectorId, req.tenantId],
    } as any);

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Sync logs ──────────────────────────────────────────────────────
connectorRouter.get('/:connectorId/sync-logs', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { limit = '20', entityType } = req.query;
    let query = `
      SELECT * FROM connector_sync_logs
      WHERE connector_id = $1 AND tenant_id = $2
    `;
    const params: unknown[] = [req.params.connectorId, req.tenantId];
    let paramIndex = 3;

    if (entityType) {
      query += ` AND entity_type = $${paramIndex++}`;
      params.push(entityType);
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit as string));

    const result = await db.execute({ sql: query, params } as any);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Trigger manual sync ────────────────────────────────────────────
connectorRouter.post('/:connectorId/sync', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { entityType = 'all', mode = 'incremental' } = req.body;

    // Create sync log entry
    const result = await db.execute({
      sql: `
        INSERT INTO connector_sync_logs
          (tenant_id, connector_id, sync_type, entity_type, status)
        VALUES ($1, $2, $3, $4, 'started')
        RETURNING *
      `,
      params: [req.tenantId, req.params.connectorId, mode === 'full' ? 'full' : 'incremental', entityType],
    } as any);

    // In production, this would enqueue a BullMQ job.
    // For now, return the sync log entry to indicate the request was accepted.
    res.status(202).json({
      message: 'Sync job queued',
      syncLog: (result as any)[0],
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Health check for specific connector ────────────────────────────
connectorRouter.get('/:connectorId/health', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `
        SELECT health_status, health_details, last_health_check
        FROM connector_configs
        WHERE connector_id = $1 AND tenant_id = $2
      `,
      params: [req.params.connectorId, req.tenantId],
    } as any);

    const config = (result as any)[0];
    if (!config) {
      res.status(404).json({ error: 'Connector not configured' });
      return;
    }

    // Get recent error count
    const errorResult = await db.execute({
      sql: `
        SELECT
          COUNT(*) FILTER (WHERE status = 'failed') as error_count,
          COUNT(*) as total_syncs,
          MAX(completed_at) as last_sync_at
        FROM connector_sync_logs
        WHERE connector_id = $1 AND tenant_id = $2
          AND started_at > NOW() - INTERVAL '1 hour'
      `,
      params: [req.params.connectorId, req.tenantId],
    } as any);

    res.json({
      ...config,
      recentErrors: (errorResult as any)[0] ?? {},
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
