/**
 * Stub Connector Base — For Phase 2/3 connectors
 *
 * Provides a no-op implementation of IBaseConnector.
 * Each stub connector extends this with its identity.
 */

import type {
  IBaseConnector,
  ConnectorConfig,
  ConnectorHealth,
  AuthResult,
  SyncResult,
  ConnectorType,
} from "@cavaridge/connector-core";

export abstract class StubConnector implements IBaseConnector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly type: ConnectorType;
  abstract readonly version: string;
  abstract readonly platformVersion: string;

  async initialize(_config: ConnectorConfig): Promise<void> {
    // Stub — no-op
  }

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      connectorId: this.id,
      status: "unknown",
      lastSyncAt: null,
      lastErrorAt: null,
      syncLagSeconds: 0,
      recordsSynced: 0,
      errorRate: 0,
      details: { stub: true, message: "Connector not yet implemented" },
      checkedAt: new Date(),
    };
  }

  async shutdown(): Promise<void> {}

  async authenticate(): Promise<AuthResult> {
    return { authenticated: false, error: `${this.name} connector not yet implemented (stub)` };
  }

  async refreshAuth(): Promise<AuthResult> {
    return this.authenticate();
  }

  isAuthenticated(): boolean {
    return false;
  }

  async fullSync(entityType: string): Promise<SyncResult> {
    return {
      mode: "full_sync", entityType,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0, recordsDeleted: 0,
      errors: [{ message: `${this.name} connector not yet implemented`, retryable: false }],
      cursor: null, durationMs: 0,
    };
  }

  async incrementalSync(entityType: string, _cursor: string): Promise<SyncResult> {
    return this.fullSync(entityType);
  }

  async getLastSyncCursor(_entityType: string): Promise<string | null> {
    return null;
  }

  supportsWebhooks(): boolean {
    return false;
  }
}
