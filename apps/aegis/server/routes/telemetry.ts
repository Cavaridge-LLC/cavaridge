/**
 * CVG-AEGIS — Telemetry Ingestion Routes
 *
 * Receives batched telemetry from browser extensions.
 * Events queued via BullMQ for async processing.
 * SaaS classification runs on each URL visit event.
 *
 * POST /batch is public (device-authenticated via device_id).
 * GET endpoints require MSP Tech+ (enforced at router mount).
 */
import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '@cavaridge/auth/server';
import { getDb } from '../db';
import { classifyDomain } from '../lib/saas-catalog';
import { randomUUID } from 'crypto';

export const telemetryRouter = Router();

/**
 * POST /api/v1/telemetry/batch
 * Called by extension every 60 seconds with batched events.
 * No user auth — uses device_id for authentication.
 */
telemetryRouter.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId, events } = req.body;

    if (!deviceId || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'deviceId and events[] required.' });
      return;
    }

    const db = getDb();

    // Look up device to get tenant_id
    const deviceResult = await db.execute({
      sql: `SELECT id, tenant_id, status FROM aegis.devices WHERE device_id = $1`,
      params: [deviceId],
    } as any);

    const device = (deviceResult as any)[0];
    if (!device) {
      res.status(401).json({ error: 'Unknown device. Re-enroll required.' });
      return;
    }

    if (device.status === 'revoked') {
      res.status(403).json({ error: 'Device has been revoked.' });
      return;
    }

    // Update last_seen_at
    await db.execute({
      sql: `UPDATE aegis.devices SET last_seen_at = now(), status = 'active', updated_at = now() WHERE id = $1`,
      params: [device.id],
    } as any);

    // Insert telemetry events and classify SaaS
    const saasUpdates: Map<string, { name: string; category: string; riskScore: number }> = new Map();

    for (const event of events) {
      const domain = extractDomain(event.url ?? event.domain ?? '');
      if (!domain) continue;

      await db.execute({
        sql: `
          INSERT INTO aegis.telemetry_events (id, tenant_id, device_id, event_type, domain, url, title, metadata, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        params: [
          randomUUID(), device.tenant_id, device.id,
          event.type ?? 'url_visit', domain,
          event.url ?? null, event.title ?? null,
          JSON.stringify(event.metadata ?? {}),
          event.timestamp ? new Date(event.timestamp) : new Date(),
        ],
      } as any);

      // SaaS classification
      if (event.type === 'url_visit' || !event.type) {
        const saasMatch = classifyDomain(domain);
        if (saasMatch) {
          saasUpdates.set(domain, { name: saasMatch.name, category: saasMatch.category, riskScore: saasMatch.riskScore });
        }
      }
    }

    // Upsert discovered SaaS applications
    for (const [domain, saas] of saasUpdates) {
      await db.execute({
        sql: `
          INSERT INTO aegis.saas_applications (tenant_id, name, domain, category, classification, risk_score, last_seen_at, visit_count)
          VALUES ($1, $2, $3, $4, 'unclassified', $5, now(), 1)
          ON CONFLICT (tenant_id, domain)
          DO UPDATE SET
            last_seen_at = now(),
            visit_count = aegis.saas_applications.visit_count + 1,
            updated_at = now()
        `,
        params: [device.tenant_id, saas.name, domain, saas.category, saas.riskScore],
      } as any);
    }

    res.json({ accepted: events.length, classified: saasUpdates.size });
  } catch (err) {
    console.error('[aegis] Telemetry ingestion error:', err);
    res.status(500).json({ error: 'Telemetry ingestion failed.' });
  }
});

/**
 * GET /api/v1/telemetry/recent — recent events for tenant (dashboard)
 */
telemetryRouter.get('/recent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const { limit = '100', eventType, deviceId } = req.query;

    let query = `
      SELECT te.*, d.hostname, d.device_id as device_identifier
      FROM aegis.telemetry_events te
      LEFT JOIN aegis.devices d ON d.id = te.device_id
      WHERE te.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (eventType) {
      query += ` AND te.event_type = $${idx++}`;
      params.push(eventType);
    }
    if (deviceId) {
      query += ` AND te.device_id = $${idx++}`;
      params.push(deviceId);
    }

    query += ` ORDER BY te.timestamp DESC LIMIT $${idx++}`;
    params.push(parseInt(limit as string));

    const result = await db.execute({ sql: query, params } as any);
    res.json({ data: result ?? [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/v1/telemetry/stats — telemetry summary
 */
telemetryRouter.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId!;
    const result = await db.execute({
      sql: `
        SELECT
          COUNT(*)::int as total_events,
          COUNT(DISTINCT domain)::int as unique_domains,
          COUNT(DISTINCT device_id)::int as active_devices,
          COUNT(*) FILTER (WHERE event_type = 'url_visit')::int as url_visits,
          COUNT(*) FILTER (WHERE event_type = 'saas_detected')::int as saas_detections,
          COUNT(*) FILTER (WHERE timestamp > now() - interval '24 hours')::int as events_today,
          COUNT(*) FILTER (WHERE timestamp > now() - interval '7 days')::int as events_this_week
        FROM aegis.telemetry_events
        WHERE tenant_id = $1
      `,
      params: [tenantId],
    } as any);

    res.json((result as any)[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

function extractDomain(urlOrDomain: string): string | null {
  try {
    if (!urlOrDomain) return null;
    if (urlOrDomain.includes('://')) {
      return new URL(urlOrDomain).hostname.replace(/^www\./, '');
    }
    return urlOrDomain.replace(/^www\./, '').split('/')[0];
  } catch {
    return null;
  }
}
