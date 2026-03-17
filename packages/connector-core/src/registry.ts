/**
 * @cavaridge/connector-core — Registry and Sync infrastructure
 *
 * ConnectorRegistry manages active instances per tenant.
 * Sync log schema tracks all sync operations.
 */
import {
  pgTable, uuid, text, boolean, integer, timestamp, jsonb, pgEnum, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { IBaseConnector, ConnectorHealth, ConnectorType } from './interfaces';

// ─── Database Schema ─────────────────────────────────────────────────

export const connectorStatusEnum = pgEnum('connector_status', [
  'unconfigured', 'configuring', 'connected', 'active', 'error', 'disabled',
]);

export const connectorHealthStatusEnum = pgEnum('connector_health_status', [
  'healthy', 'degraded', 'unhealthy', 'unknown',
]);

export const syncTypeEnum = pgEnum('sync_type', [
  'full', 'incremental', 'webhook',
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'started', 'completed', 'failed', 'partial',
]);

export const connectorConfigs = pgTable('connector_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  connectorId: text('connector_id').notNull(),
  status: connectorStatusEnum('status').notNull().default('unconfigured'),
  config: jsonb('config').default('{}'),
  credentialsEncrypted: text('credentials_encrypted'), // AES-256-GCM, dev only
  lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
  healthStatus: connectorHealthStatusEnum('health_status').default('unknown'),
  healthDetails: jsonb('health_details').default('{}'),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantConnectorUnique: uniqueIndex('uq_connector_configs_tenant_connector')
    .on(table.tenantId, table.connectorId),
}));

export const connectorSyncLogs = pgTable('connector_sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  connectorId: text('connector_id').notNull(),
  syncType: syncTypeEnum('sync_type').notNull(),
  entityType: text('entity_type').notNull(),
  status: syncStatusEnum('status').notNull().default('started'),
  recordsProcessed: integer('records_processed').default(0),
  recordsCreated: integer('records_created').default(0),
  recordsUpdated: integer('records_updated').default(0),
  recordsDeleted: integer('records_deleted').default(0),
  errors: jsonb('errors').default('[]'),
  cursorBefore: text('cursor_before'),
  cursorAfter: text('cursor_after'),
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ─── Connector Queue Definitions ─────────────────────────────────────

export const CONNECTOR_QUEUES = {
  FULL_SYNC: 'connector:full-sync',
  INCREMENTAL_SYNC: 'connector:incremental-sync',
  WEBHOOK_PROCESS: 'connector:webhook-process',
  HEALTH_CHECK: 'connector:health-check',
} as const;

export const CONNECTOR_QUEUE_SCHEDULES = {
  [CONNECTOR_QUEUES.INCREMENTAL_SYNC]: {
    pattern: '*/5 * * * *', // Every 5 minutes
  },
  [CONNECTOR_QUEUES.HEALTH_CHECK]: {
    pattern: '*/2 * * * *', // Every 2 minutes
  },
};

// ─── Runtime Registry ────────────────────────────────────────────────

export class ConnectorRegistry {
  private connectors = new Map<string, Map<string, IBaseConnector>>();

  /**
   * Register a connector instance for a tenant.
   */
  register(tenantId: string, connector: IBaseConnector): void {
    if (!this.connectors.has(tenantId)) {
      this.connectors.set(tenantId, new Map());
    }
    this.connectors.get(tenantId)!.set(connector.id, connector);
  }

  /**
   * Unregister a connector instance.
   */
  unregister(tenantId: string, connectorId: string): void {
    this.connectors.get(tenantId)?.delete(connectorId);
  }

  /**
   * Get a specific connector for a tenant.
   */
  getConnector<T extends IBaseConnector>(tenantId: string, connectorId: string): T | null {
    return (this.connectors.get(tenantId)?.get(connectorId) as T) ?? null;
  }

  /**
   * Get all connectors of a specific type for a tenant.
   */
  getConnectorsByType(tenantId: string, type: ConnectorType): IBaseConnector[] {
    const tenantConnectors = this.connectors.get(tenantId);
    if (!tenantConnectors) return [];
    return Array.from(tenantConnectors.values()).filter((c) => c.type === type);
  }

  /**
   * Get all connectors for a tenant.
   */
  getAllConnectors(tenantId: string): IBaseConnector[] {
    const tenantConnectors = this.connectors.get(tenantId);
    if (!tenantConnectors) return [];
    return Array.from(tenantConnectors.values());
  }

  /**
   * Run health checks on all connectors for a tenant.
   */
  async checkHealth(tenantId: string): Promise<Map<string, ConnectorHealth>> {
    const results = new Map<string, ConnectorHealth>();
    const tenantConnectors = this.connectors.get(tenantId);
    if (!tenantConnectors) return results;

    for (const [id, connector] of tenantConnectors) {
      try {
        const health = await connector.healthCheck();
        results.set(id, health);
      } catch (error) {
        results.set(id, {
          connectorId: id,
          status: 'unhealthy',
          lastSyncAt: null,
          lastErrorAt: new Date(),
          syncLagSeconds: -1,
          recordsSynced: 0,
          errorRate: 100,
          details: { error: String(error) },
          checkedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Shutdown all connectors for a tenant.
   */
  async shutdownAll(tenantId: string): Promise<void> {
    const tenantConnectors = this.connectors.get(tenantId);
    if (!tenantConnectors) return;

    for (const connector of tenantConnectors.values()) {
      await connector.shutdown().catch(() => {}); // Best effort
    }
    this.connectors.delete(tenantId);
  }
}
