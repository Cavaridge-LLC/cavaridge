/**
 * @cavaridge/connector-ninjaone — NinjaOne RMM Connector
 *
 * Phase 1 integration target. Implements IRmmConnector.
 *
 * Auth: OAuth 2.0 Authorization Code
 * Base URL: https://app.ninjarmm.com/v2 (varies by region)
 * Rate limits: 100 req/min
 * Webhooks: Supported (HMAC-SHA256)
 * Key entities: Organizations, Devices, Alerts, Activities, Patch Status
 */
import type {
  IRmmConnector, ConnectorConfig, ConnectorHealth, AuthResult,
  SyncResult, WebhookRegistration, WebhookEvent,
  NormalizedDevice, NormalizedAlert, PaginatedResult,
  DeviceFilters, AlertFilters, PatchStatus, ScriptPayload, ScriptResult,
} from '@cavaridge/connector-core';

const CONNECTOR_ID = 'ninjaone';
const CONNECTOR_NAME = 'NinjaOne';
const CONNECTOR_VERSION = '0.1.0';
const PLATFORM_VERSION = 'v2';

export class NinjaOneConnector implements IRmmConnector {
  readonly id = CONNECTOR_ID;
  readonly name = CONNECTOR_NAME;
  readonly type = 'rmm' as const;
  readonly version = CONNECTOR_VERSION;
  readonly platformVersion = PLATFORM_VERSION;

  private config: ConnectorConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private baseUrl = 'https://app.ninjarmm.com';

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    await this.authenticate();
  }

  async healthCheck(): Promise<ConnectorHealth> {
    try {
      // Hit a lightweight endpoint to verify connectivity
      const response = await this.apiGet('/v2/organizations');
      return {
        connectorId: this.id,
        status: 'healthy',
        lastSyncAt: null, // TODO: Track from sync log
        lastErrorAt: null,
        syncLagSeconds: 0,
        recordsSynced: 0,
        errorRate: 0,
        details: { organizationCount: Array.isArray(response) ? response.length : 0 },
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        connectorId: this.id,
        status: 'unhealthy',
        lastSyncAt: null,
        lastErrorAt: new Date(),
        syncLagSeconds: -1,
        recordsSynced: 0,
        errorRate: 100,
        details: { error: String(error) },
        checkedAt: new Date(),
      };
    }
  }

  async shutdown(): Promise<void> {
    this.accessToken = null;
    this.config = null;
  }

  // ─── Authentication ──────────────────────────────────────────────

  async authenticate(): Promise<AuthResult> {
    if (!this.config) throw new Error('Connector not initialized');

    try {
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.credentials.clientId,
          client_secret: this.config.credentials.clientSecret,
          scope: 'monitoring management',
        }),
      });

      if (!response.ok) {
        return { authenticated: false, error: `Auth failed: ${response.status}` };
      }

      const data = await response.json() as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      return { authenticated: true, expiresAt: this.tokenExpiresAt };
    } catch (error) {
      return { authenticated: false, error: String(error) };
    }
  }

  async refreshAuth(): Promise<AuthResult> {
    return this.authenticate(); // NinjaOne uses client_credentials, just re-auth
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.tokenExpiresAt && this.tokenExpiresAt > new Date();
  }

  // ─── Sync ────────────────────────────────────────────────────────

  async fullSync(entityType: string): Promise<SyncResult> {
    const startTime = Date.now();
    // TODO: Implement full sync for each entity type
    // entityType: 'devices' | 'alerts' | 'organizations'
    return {
      mode: 'full_sync',
      entityType,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      cursor: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  async incrementalSync(entityType: string, cursor: string): Promise<SyncResult> {
    const startTime = Date.now();
    // TODO: Implement incremental sync using lastModified > cursor
    return {
      mode: 'incremental_sync',
      entityType,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      cursor: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  async getLastSyncCursor(entityType: string): Promise<string | null> {
    // TODO: Read from connector_sync_logs
    return null;
  }

  // ─── Webhooks ────────────────────────────────────────────────────

  supportsWebhooks(): boolean { return true; }

  async registerWebhook(eventType: string, callbackUrl: string): Promise<WebhookRegistration> {
    // TODO: Register webhook channel via NinjaOne API
    return {
      id: '',
      eventType,
      callbackUrl,
      createdAt: new Date(),
    };
  }

  async handleWebhookPayload(headers: Record<string, string>, body: unknown): Promise<WebhookEvent> {
    // TODO: Parse NinjaOne webhook payload into WebhookEvent
    return {
      connectorId: this.id,
      eventType: 'unknown',
      externalId: '',
      payload: body,
      receivedAt: new Date(),
    };
  }

  validateWebhookSignature(headers: Record<string, string>, body: string): boolean {
    // TODO: Validate HMAC-SHA256 signature
    return false;
  }

  // ─── RMM-Specific: Devices ───────────────────────────────────────

  async listDevices(filters?: DeviceFilters): Promise<PaginatedResult<NormalizedDevice>> {
    const params = new URLSearchParams();
    if (filters?.page) params.set('pageSize', String(filters.pageSize ?? 50));
    // TODO: Map filters to NinjaOne query params

    const response = await this.apiGet(`/v2/devices?${params}`);
    const devices = Array.isArray(response) ? response : [];

    return {
      data: devices.map((d: any) => this.normalizeDevice(d)),
      total: devices.length,
      page: filters?.page ?? 1,
      pageSize: filters?.pageSize ?? 50,
      hasMore: false, // TODO: Check NinjaOne pagination
    };
  }

  async getDevice(externalId: string): Promise<NormalizedDevice> {
    const response = await this.apiGet(`/v2/device/${externalId}`);
    return this.normalizeDevice(response);
  }

  async getDeviceAlerts(externalId: string): Promise<NormalizedAlert[]> {
    const response = await this.apiGet(`/v2/device/${externalId}/alerts`);
    return Array.isArray(response) ? response.map((a: any) => this.normalizeAlert(a)) : [];
  }

  // ─── RMM-Specific: Alerts ────────────────────────────────────────

  async listAlerts(filters?: AlertFilters): Promise<PaginatedResult<NormalizedAlert>> {
    const params = new URLSearchParams();
    if (filters?.since) params.set('after', filters.since.toISOString());
    if (filters?.severity) params.set('severity', filters.severity);

    const response = await this.apiGet(`/v2/alerts?${params}`);
    const alerts = Array.isArray(response) ? response : [];

    return {
      data: alerts.map((a: any) => this.normalizeAlert(a)),
      total: alerts.length,
      page: 1,
      pageSize: 50,
      hasMore: false,
    };
  }

  async acknowledgeAlert(externalId: string): Promise<void> {
    // TODO: PUT /v2/alert/{id}
  }

  async resolveAlert(externalId: string, notes?: string): Promise<void> {
    // TODO: PUT /v2/alert/{id} with resolved status
  }

  // ─── RMM-Specific: Patches ───────────────────────────────────────

  async getPatchStatus(deviceId: string): Promise<PatchStatus> {
    const response = await this.apiGet(`/v2/device/${deviceId}/os-patches`);
    // TODO: Map NinjaOne patch data to PatchStatus
    return {
      deviceExternalId: deviceId,
      totalPatches: 0,
      installedPatches: 0,
      pendingPatches: 0,
      failedPatches: 0,
    };
  }

  // ─── RMM-Specific: Scripting ─────────────────────────────────────

  supportsScripting(): boolean { return true; }

  async executeScript(deviceId: string, script: ScriptPayload): Promise<ScriptResult> {
    // TODO: POST /v2/device/{id}/script
    return { jobId: '', status: 'queued' };
  }

  async getScriptResult(jobId: string): Promise<ScriptResult> {
    // TODO: GET /v2/job/{id}
    return { jobId, status: 'queued' };
  }

  // ─── Normalizers ─────────────────────────────────────────────────

  private normalizeDevice(raw: any): NormalizedDevice {
    return {
      externalId: String(raw.id ?? ''),
      connectorId: this.id,
      hostname: raw.systemName ?? raw.dnsName ?? 'Unknown',
      fqdn: raw.dnsName,
      osName: raw.os?.name ?? 'Unknown',
      osVersion: raw.os?.version ?? '',
      osType: this.mapOsType(raw.nodeClass),
      lastSeen: raw.lastContact ? new Date(raw.lastContact) : new Date(),
      status: raw.offline ? 'offline' : 'online',
      ipAddresses: raw.ipAddresses ?? [],
      macAddresses: [],
      manufacturer: raw.system?.manufacturer,
      model: raw.system?.model,
      serialNumber: raw.system?.serialNumber,
      assignedUser: raw.lastLoggedInUser,
      clientExternalId: raw.organizationId ? String(raw.organizationId) : undefined,
      siteExternalId: raw.locationId ? String(raw.locationId) : undefined,
      tags: [],
      patchStatus: 'unknown',
      antivirusStatus: 'unknown',
      rawData: raw,
    };
  }

  private normalizeAlert(raw: any): NormalizedAlert {
    return {
      externalId: String(raw.id ?? raw.uid ?? ''),
      connectorId: this.id,
      deviceExternalId: raw.deviceId ? String(raw.deviceId) : undefined,
      title: raw.message ?? 'Alert',
      description: raw.message ?? '',
      severity: this.mapSeverity(raw.severity),
      status: raw.status === 'CLEARED' ? 'resolved' : 'active',
      category: raw.sourceType ?? 'unknown',
      createdAt: raw.createTime ? new Date(raw.createTime) : new Date(),
      updatedAt: raw.updateTime ? new Date(raw.updateTime) : new Date(),
      resolvedAt: raw.status === 'CLEARED' ? new Date(raw.updateTime) : undefined,
      rawData: raw,
    };
  }

  private mapOsType(nodeClass: string): NormalizedDevice['osType'] {
    switch (nodeClass?.toUpperCase()) {
      case 'WINDOWS_WORKSTATION':
      case 'WINDOWS_SERVER': return 'windows';
      case 'MAC': return 'macos';
      case 'LINUX': return 'linux';
      case 'VMWARE_VM_GUEST':
      case 'CLOUD_MONITOR_TARGET': return 'other';
      default: return 'other';
    }
  }

  private mapSeverity(severity: string): NormalizedAlert['severity'] {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'critical';
      case 'MAJOR': return 'high';
      case 'MODERATE': return 'medium';
      case 'MINOR': return 'low';
      default: return 'info';
    }
  }

  // ─── API Helper ──────────────────────────────────────────────────

  private async apiGet(path: string): Promise<any> {
    if (!this.isAuthenticated()) await this.refreshAuth();

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 429) {
      // Rate limited — wait and retry
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.apiGet(path);
    }

    if (!response.ok) {
      throw new Error(`NinjaOne API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export default NinjaOneConnector;
