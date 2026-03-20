/**
 * @cavaridge/connector-ninjaone — NinjaOne RMM Connector
 *
 * Phase 1 integration. Implements IRmmConnector.
 *
 * Auth: OAuth 2.0 client_credentials
 * Base URL: https://app.ninjarmm.com/v2 (varies by region: EU, OC)
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
import { createHmac, timingSafeEqual } from 'crypto';

const CONNECTOR_ID = 'ninjaone';
const CONNECTOR_NAME = 'NinjaOne';
const CONNECTOR_VERSION = '0.2.0';
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
  private lastSyncAt: Date | null = null;
  private syncCursors = new Map<string, string>();

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    const region = config.settings.region as string;
    if (region === 'eu') this.baseUrl = 'https://eu.ninjarmm.com';
    else if (region === 'oc') this.baseUrl = 'https://oc.ninjarmm.com';
    await this.authenticate();
  }

  async healthCheck(): Promise<ConnectorHealth> {
    try {
      const response = await this.apiGet('/v2/organizations');
      return {
        connectorId: this.id,
        status: 'healthy',
        lastSyncAt: this.lastSyncAt,
        lastErrorAt: null,
        syncLagSeconds: this.lastSyncAt
          ? Math.floor((Date.now() - this.lastSyncAt.getTime()) / 1000)
          : 0,
        recordsSynced: 0,
        errorRate: 0,
        details: { organizationCount: Array.isArray(response) ? response.length : 0 },
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        connectorId: this.id,
        status: 'unhealthy',
        lastSyncAt: this.lastSyncAt,
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
    return this.authenticate();
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.tokenExpiresAt && this.tokenExpiresAt > new Date();
  }

  // ─── Sync ────────────────────────────────────────────────────────

  async fullSync(entityType: string): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ recordId?: string; message: string; code?: string; retryable: boolean }> = [];
    let recordsProcessed = 0;
    let recordsCreated = 0;

    try {
      switch (entityType) {
        case 'devices': {
          const result = await this.listDevices({ pageSize: 1000 });
          recordsProcessed = result.total;
          recordsCreated = result.data.length;
          break;
        }
        case 'alerts': {
          const result = await this.listAlerts({ pageSize: 1000 });
          recordsProcessed = result.total;
          recordsCreated = result.data.length;
          break;
        }
        case 'organizations': {
          const orgs = await this.apiGet('/v2/organizations');
          recordsProcessed = Array.isArray(orgs) ? orgs.length : 0;
          recordsCreated = recordsProcessed;
          break;
        }
        default:
          errors.push({ message: `Unknown entity type: ${entityType}`, retryable: false });
      }
    } catch (err) {
      errors.push({ message: String(err), retryable: true });
    }

    const cursor = new Date().toISOString();
    this.syncCursors.set(entityType, cursor);
    this.lastSyncAt = new Date();

    return {
      mode: 'full_sync',
      entityType,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors,
      cursor,
      durationMs: Date.now() - startTime,
    };
  }

  async incrementalSync(entityType: string, cursor: string): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: Array<{ recordId?: string; message: string; code?: string; retryable: boolean }> = [];
    let recordsProcessed = 0;
    let recordsUpdated = 0;

    try {
      switch (entityType) {
        case 'devices': {
          const result = await this.listDevices({ pageSize: 1000 });
          recordsProcessed = result.data.length;
          recordsUpdated = result.data.length;
          break;
        }
        case 'alerts': {
          const result = await this.listAlerts({ since: new Date(cursor), pageSize: 1000 });
          recordsProcessed = result.data.length;
          recordsUpdated = result.data.length;
          break;
        }
        default:
          errors.push({ message: `Incremental sync not supported for: ${entityType}`, retryable: false });
      }
    } catch (err) {
      errors.push({ message: String(err), retryable: true });
    }

    const newCursor = new Date().toISOString();
    this.syncCursors.set(entityType, newCursor);
    this.lastSyncAt = new Date();

    return {
      mode: 'incremental_sync',
      entityType,
      recordsProcessed,
      recordsCreated: 0,
      recordsUpdated,
      recordsDeleted: 0,
      errors,
      cursor: newCursor,
      durationMs: Date.now() - startTime,
    };
  }

  async getLastSyncCursor(entityType: string): Promise<string | null> {
    return this.syncCursors.get(entityType) ?? null;
  }

  // ─── Webhooks ────────────────────────────────────────────────────

  supportsWebhooks(): boolean { return true; }

  async registerWebhook(eventType: string, callbackUrl: string): Promise<WebhookRegistration> {
    return {
      id: `ninjaone-webhook-${eventType}`,
      eventType,
      callbackUrl,
      createdAt: new Date(),
    };
  }

  async handleWebhookPayload(headers: Record<string, string>, body: unknown): Promise<WebhookEvent> {
    const payload = body as Record<string, unknown>;
    const eventType = this.mapWebhookEventType(payload);

    return {
      connectorId: this.id,
      eventType,
      externalId: String(payload.id ?? payload.deviceId ?? ''),
      payload,
      receivedAt: new Date(),
    };
  }

  validateWebhookSignature(headers: Record<string, string>, body: string): boolean {
    const secret = this.config?.credentials.webhookSecret;
    if (!secret) return false;

    const signature = headers['x-ninja-signature'] ?? headers['x-webhook-signature'];
    if (!signature) return false;

    const expected = createHmac('sha256', secret).update(body).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // ─── RMM-Specific: Devices ───────────────────────────────────────

  async listDevices(filters?: DeviceFilters): Promise<PaginatedResult<NormalizedDevice>> {
    const params = new URLSearchParams();
    if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters?.clientExternalId) params.set('of', String(filters.clientExternalId));
    if (filters?.status === 'offline') params.set('offline', 'true');
    if (filters?.osType) params.set('nodeClass', this.reverseMapOsType(filters.osType));

    const response = await this.apiGet(`/v2/devices?${params}`);
    const devices = Array.isArray(response) ? response : [];

    let filtered = devices;
    if (filters?.search) {
      const term = filters.search.toLowerCase();
      filtered = devices.filter((d: any) =>
        (d.systemName ?? '').toLowerCase().includes(term) ||
        (d.dnsName ?? '').toLowerCase().includes(term)
      );
    }

    return {
      data: filtered.map((d: any) => this.normalizeDevice(d)),
      total: filtered.length,
      page: filters?.page ?? 1,
      pageSize: filters?.pageSize ?? 50,
      hasMore: false,
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
    if (filters?.severity) params.set('severity', filters.severity.toUpperCase());
    if (filters?.status === 'active') params.set('status', 'TRIGGERED');
    if (filters?.status === 'resolved') params.set('status', 'CLEARED');
    if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));

    const response = await this.apiGet(`/v2/alerts?${params}`);
    const alerts = Array.isArray(response) ? response : [];

    return {
      data: alerts.map((a: any) => this.normalizeAlert(a)),
      total: alerts.length,
      page: 1,
      pageSize: filters?.pageSize ?? 50,
      hasMore: false,
    };
  }

  async acknowledgeAlert(externalId: string): Promise<void> {
    await this.apiPost(`/v2/alert/${externalId}/acknowledge`, {});
  }

  async resolveAlert(externalId: string, notes?: string): Promise<void> {
    await this.apiPost(`/v2/alert/${externalId}/reset`, { note: notes });
  }

  /**
   * Convert an active NinjaOne alert into a ticket-creation payload.
   * Consuming app calls TicketEngine.createFromConnector() with this data.
   */
  alertToTicketPayload(alert: NormalizedAlert, tenantId: string, clientId: string) {
    const priorityMap: Record<string, string> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
      info: 'low',
    };

    return {
      tenantId,
      clientId,
      subject: `[NinjaOne Alert] ${alert.title}`,
      description: `Auto-created from NinjaOne alert.\n\nAlert: ${alert.title}\nSeverity: ${alert.severity}\nCategory: ${alert.category}\nDevice: ${alert.deviceExternalId ?? 'Unknown'}\n\n${alert.description}`,
      priority: priorityMap[alert.severity] ?? 'medium',
      category: alert.category,
      source: 'alert' as const,
    };
  }

  // ─── RMM-Specific: Patches ───────────────────────────────────────

  async getPatchStatus(deviceId: string): Promise<PatchStatus> {
    const response = await this.apiGet(`/v2/device/${deviceId}/os-patches`);
    const patches = Array.isArray(response) ? response : [];

    const installed = patches.filter((p: any) => p.status === 'INSTALLED').length;
    const pending = patches.filter((p: any) => p.status === 'AVAILABLE' || p.status === 'PENDING').length;
    const failed = patches.filter((p: any) => p.status === 'FAILED').length;

    return {
      deviceExternalId: deviceId,
      totalPatches: patches.length,
      installedPatches: installed,
      pendingPatches: pending,
      failedPatches: failed,
      lastPatchedAt: patches.length > 0
        ? new Date(patches.sort((a: any, b: any) =>
            new Date(b.installedAt ?? 0).getTime() - new Date(a.installedAt ?? 0).getTime()
          )[0]?.installedAt)
        : undefined,
    };
  }

  // ─── RMM-Specific: Scripting ─────────────────────────────────────

  supportsScripting(): boolean { return true; }

  async executeScript(deviceId: string, script: ScriptPayload): Promise<ScriptResult> {
    const response = await this.apiPost(`/v2/device/${deviceId}/script/run`, {
      type: script.language === 'powershell' ? 'POWERSHELL' : script.language.toUpperCase(),
      content: script.body,
      parameters: script.parameters,
      timeout: script.timeout ?? 300,
    });

    return {
      jobId: String(response.id ?? response.jobUid ?? ''),
      status: 'queued',
    };
  }

  async getScriptResult(jobId: string): Promise<ScriptResult> {
    const response = await this.apiGet(`/v2/job/${jobId}`);

    const statusMap: Record<string, ScriptResult['status']> = {
      QUEUED: 'queued',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed',
      TIMED_OUT: 'timeout',
    };

    return {
      jobId,
      status: statusMap[response.status] ?? 'queued',
      stdout: response.output,
      stderr: response.error,
      exitCode: response.exitCode,
    };
  }

  // ─── Organizations (clients in NinjaOne) ─────────────────────────

  async listOrganizations(): Promise<Array<{ externalId: string; name: string; description?: string }>> {
    const response = await this.apiGet('/v2/organizations');
    const orgs = Array.isArray(response) ? response : [];
    return orgs.map((o: any) => ({
      externalId: String(o.id),
      name: o.name,
      description: o.description,
    }));
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
      macAddresses: raw.macAddresses ?? [],
      manufacturer: raw.system?.manufacturer,
      model: raw.system?.model,
      serialNumber: raw.system?.serialNumber,
      assignedUser: raw.lastLoggedInUser,
      clientExternalId: raw.organizationId ? String(raw.organizationId) : undefined,
      siteExternalId: raw.locationId ? String(raw.locationId) : undefined,
      tags: raw.tags ?? [],
      patchStatus: this.mapPatchStatus(raw),
      antivirusStatus: this.mapAntivirusStatus(raw),
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
      default: return 'other';
    }
  }

  private reverseMapOsType(osType: string): string {
    switch (osType) {
      case 'windows': return 'WINDOWS_WORKSTATION';
      case 'macos': return 'MAC';
      case 'linux': return 'LINUX';
      default: return osType;
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

  private mapPatchStatus(raw: any): NormalizedDevice['patchStatus'] {
    if (raw.patchStatus === 'UP_TO_DATE') return 'current';
    if (raw.patchStatus === 'AVAILABLE') return 'pending';
    if (raw.patchStatus === 'OVERDUE') return 'overdue';
    return 'unknown';
  }

  private mapAntivirusStatus(raw: any): NormalizedDevice['antivirusStatus'] {
    if (raw.antivirusProduct) {
      if (raw.antivirusEnabled === false) return 'disabled';
      if (raw.antivirusUpToDate === false) return 'outdated';
      return 'active';
    }
    return 'unknown';
  }

  private mapWebhookEventType(payload: Record<string, unknown>): string {
    const type = payload.type ?? payload.activityType ?? payload.event;
    if (typeof type === 'string') {
      if (type.includes('ALERT')) return 'alert';
      if (type.includes('DEVICE')) return 'device';
      if (type.includes('PATCH')) return 'patch';
    }
    return 'unknown';
  }

  // ─── API Helpers ─────────────────────────────────────────────────

  private async apiGet(path: string): Promise<any> {
    if (!this.isAuthenticated()) await this.refreshAuth();

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.apiGet(path);
    }

    if (!response.ok) {
      throw new Error(`NinjaOne API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async apiPost(path: string, body: unknown): Promise<any> {
    if (!this.isAuthenticated()) await this.refreshAuth();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`NinjaOne API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export default NinjaOneConnector;
