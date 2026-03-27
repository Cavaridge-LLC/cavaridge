/**
 * @cavaridge/connector-syncro — Syncro RMM Connector
 *
 * Implements IRmmConnector from @cavaridge/connector-core.
 * Syncro REST API v1 with pagination, rate limiting, and normalized model mapping.
 *
 * Auth: API key in Authorization header (Bearer token)
 * Base URL: https://{subdomain}.syncromsp.com/api/v1
 * Rate limits: 180 req/min (3 req/sec)
 * Pagination: page param, response has total_pages + total_entries
 * Key entities: Customers, Assets, Tickets, Invoices, Estimates, Leads
 */

declare function require(id: string): any;
declare const Buffer: { from(s: string, enc?: string): Uint8Array };

import type {
  IRmmConnector, ConnectorConfig, ConnectorHealth, AuthResult,
  SyncResult, SyncError, NormalizedDevice, NormalizedAlert, PaginatedResult,
  DeviceFilters, AlertFilters, PatchStatus, ScriptPayload, ScriptResult,
  WebhookRegistration, WebhookEvent,
} from '@cavaridge/connector-core';

// ─── Syncro API Types ────────────────────────────────────────────────

interface SyncroAsset {
  id: number;
  name: string;
  asset_type: string;
  customer_id: number;
  customer_name?: string;
  properties?: {
    os_name?: string;
    os_version?: string;
    os_type?: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    ip_address?: string;
    mac_address?: string;
    last_seen?: string;
    online?: boolean;
  };
  created_at: string;
  updated_at: string;
}

interface SyncroTicket {
  id: number;
  number: number;
  subject: string;
  body?: string;
  status: string;
  priority: string;
  customer_id: number;
  customer_name?: string;
  user_id?: number;
  assigned_user_name?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  ticket_type?: string;
}

interface SyncroPaginatedResponse<T> {
  [key: string]: T[] | number | undefined;
  meta?: any;
}

// ─── Rate Limiter ────────────────────────────────────────────────────

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) { this.tokens -= 1; return; }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    this.tokens = Math.min(this.maxTokens, this.tokens + (now - this.lastRefill) * this.refillRate);
    this.lastRefill = now;
  }
}

// ─── Syncro Connector ────────────────────────────────────────────────

export class SyncroConnector implements IRmmConnector {
  readonly id = 'syncro';
  readonly name = 'Syncro';
  readonly type = 'rmm' as const;
  readonly version = '1.0.0';
  readonly platformVersion = 'v1';

  private config: ConnectorConfig | null = null;
  private apiKey = '';
  private baseUrl = '';
  private authenticated = false;
  private rateLimiter = new RateLimiter(2.5); // 180/min ≈ 3/s, conservative
  private syncCursors = new Map<string, string>();
  private lastSyncAt: Date | null = null;
  private lastErrorAt: Date | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    this.apiKey = config.credentials.apiKey || '';
    const subdomain = config.credentials.subdomain || config.settings.subdomain;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
    } else if (subdomain) {
      this.baseUrl = `https://${subdomain}.syncromsp.com/api/v1`;
    } else {
      throw new Error('Syncro requires either baseUrl or credentials.subdomain');
    }
    if (!this.apiKey) throw new Error('Syncro API key required in credentials.apiKey');
    await this.authenticate();
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const checkedAt = new Date();
    try {
      await this.request('/customers', { page: '1' });
      return {
        connectorId: this.id, status: 'healthy',
        lastSyncAt: this.lastSyncAt, lastErrorAt: this.lastErrorAt,
        syncLagSeconds: this.lastSyncAt ? Math.floor((Date.now() - this.lastSyncAt.getTime()) / 1000) : 0,
        recordsSynced: 0, errorRate: 0, details: {}, checkedAt,
      };
    } catch (err) {
      this.lastErrorAt = checkedAt;
      return {
        connectorId: this.id, status: 'unhealthy',
        lastSyncAt: this.lastSyncAt, lastErrorAt: this.lastErrorAt,
        syncLagSeconds: 0, recordsSynced: 0, errorRate: 1,
        details: { error: err instanceof Error ? err.message : String(err) }, checkedAt,
      };
    }
  }

  async shutdown(): Promise<void> {
    this.authenticated = false;
    this.config = null;
    this.syncCursors.clear();
  }

  // ─── Authentication ──────────────────────────────────────────────

  async authenticate(): Promise<AuthResult> {
    try {
      await this.request('/customers', { page: '1' });
      this.authenticated = true;
      return { authenticated: true };
    } catch (err) {
      this.authenticated = false;
      return { authenticated: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async refreshAuth(): Promise<AuthResult> { return this.authenticate(); }
  isAuthenticated(): boolean { return this.authenticated; }

  // ─── Sync ────────────────────────────────────────────────────────

  async fullSync(entityType: string): Promise<SyncResult> {
    const start = Date.now();
    const errors: SyncError[] = [];
    let count = 0;
    try {
      if (entityType === 'devices') {
        const all = await this.fetchAllPages<SyncroAsset>('/customer_assets', 'assets');
        count = all.length;
      } else if (entityType === 'tickets') {
        const all = await this.fetchAllPages<SyncroTicket>('/tickets', 'tickets');
        count = all.length;
      } else {
        errors.push({ message: `Unknown entity: ${entityType}`, retryable: false });
      }
      this.lastSyncAt = new Date();
      this.syncCursors.set(entityType, new Date().toISOString());
    } catch (err) {
      this.lastErrorAt = new Date();
      errors.push({ message: err instanceof Error ? err.message : String(err), retryable: true });
    }
    return {
      mode: 'full_sync', entityType, recordsProcessed: count,
      recordsCreated: count, recordsUpdated: 0, recordsDeleted: 0,
      errors, cursor: this.syncCursors.get(entityType) || null, durationMs: Date.now() - start,
    };
  }

  async incrementalSync(entityType: string, cursor: string): Promise<SyncResult> {
    const result = await this.fullSync(entityType);
    result.mode = 'incremental_sync';
    result.cursor = new Date().toISOString();
    this.syncCursors.set(entityType, result.cursor);
    return result;
  }

  async getLastSyncCursor(entityType: string): Promise<string | null> {
    return this.syncCursors.get(entityType) || null;
  }

  // ─── Webhooks ────────────────────────────────────────────────────

  supportsWebhooks(): boolean { return true; }
  supportsScripting(): boolean { return false; }

  async registerWebhook(eventType: string, callbackUrl: string): Promise<WebhookRegistration> {
    // Syncro webhooks configured in Notification Center — create programmatically via API
    const resp = await this.request('/webhooks', {}, 'POST', {
      url: callbackUrl,
      events: [eventType],
    }) as { id: number; created_at: string };

    return {
      id: String(resp.id),
      eventType,
      callbackUrl,
      createdAt: new Date(resp.created_at || Date.now()),
    };
  }

  handleWebhookPayload(headers: Record<string, string>, body: unknown): Promise<WebhookEvent> {
    const payload = body as Record<string, unknown>;
    return Promise.resolve({
      connectorId: this.id,
      eventType: String(payload.event || 'unknown'),
      externalId: String(payload.id || ''),
      payload,
      receivedAt: new Date(),
    });
  }

  // ─── Devices (Assets) ────────────────────────────────────────────

  async listDevices(filters?: DeviceFilters): Promise<PaginatedResult<NormalizedDevice>> {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 25; // Syncro default is 25
    const params: Record<string, string> = { page: String(page) };
    if (filters?.clientExternalId) params.customer_id = filters.clientExternalId;
    if (filters?.search) params.query = filters.search;

    const resp = await this.request('/customer_assets', params) as any;
    const assets: SyncroAsset[] = resp.assets || [];
    const totalPages = resp.meta?.total_pages || 1;
    const totalEntries = resp.meta?.total_entries || assets.length;

    let devices = assets.map(a => this.mapDevice(a));
    if (filters?.osType) devices = devices.filter(d => d.osType === filters.osType);
    if (filters?.status) devices = devices.filter(d => d.status === filters.status);

    return {
      data: devices, total: totalEntries,
      page, pageSize, hasMore: page < totalPages,
    };
  }

  async getDevice(externalId: string): Promise<NormalizedDevice> {
    const resp = await this.request(`/customer_assets/${externalId}`) as { asset: SyncroAsset };
    return this.mapDevice(resp.asset || resp as unknown as SyncroAsset);
  }

  async getDeviceAlerts(externalId: string): Promise<NormalizedAlert[]> {
    // Syncro doesn't have a separate alerts endpoint per asset
    // Use RMM alerts filtered by asset
    try {
      const resp = await this.request('/rmm_alerts', { asset_id: externalId }) as any;
      const alerts = resp.rmm_alerts || [];
      return alerts.map((a: any) => this.mapRmmAlert(a));
    } catch {
      return [];
    }
  }

  // ─── Alerts ──────────────────────────────────────────────────────

  async listAlerts(filters?: AlertFilters): Promise<PaginatedResult<NormalizedAlert>> {
    const page = filters?.page || 1;
    const params: Record<string, string> = { page: String(page) };
    if (filters?.status === 'resolved') params.resolved = 'true';

    const resp = await this.request('/rmm_alerts', params) as any;
    const rmmAlerts = resp.rmm_alerts || [];
    const totalPages = resp.meta?.total_pages || 1;
    const totalEntries = resp.meta?.total_entries || rmmAlerts.length;

    let alerts = rmmAlerts.map((a: any) => this.mapRmmAlert(a));
    if (filters?.severity) alerts = alerts.filter((a: NormalizedAlert) => a.severity === filters.severity);
    if (filters?.since) {
      const since = filters.since.getTime();
      alerts = alerts.filter((a: NormalizedAlert) => a.createdAt.getTime() >= since);
    }

    return {
      data: alerts, total: totalEntries,
      page, pageSize: 25, hasMore: page < totalPages,
    };
  }

  async acknowledgeAlert(_externalId: string): Promise<void> {
    // Syncro RMM alerts are resolved, not acknowledged
  }

  async resolveAlert(externalId: string, _notes?: string): Promise<void> {
    await this.request(`/rmm_alerts/${externalId}/resolve`, {}, 'PUT');
  }

  // ─── Patch Status ────────────────────────────────────────────────

  async getPatchStatus(deviceId: string): Promise<PatchStatus> {
    try {
      const device = await this.getDevice(deviceId);
      return {
        deviceExternalId: deviceId,
        totalPatches: 0,
        installedPatches: 0,
        pendingPatches: device.patchStatus === 'pending' ? 1 : 0,
        failedPatches: device.patchStatus === 'overdue' ? 1 : 0,
      };
    } catch {
      return {
        deviceExternalId: deviceId,
        totalPatches: 0, installedPatches: 0,
        pendingPatches: 0, failedPatches: 0,
      };
    }
  }

  // ─── Tickets (bonus — Syncro is PSA+RMM hybrid) ──────────────────

  async listTickets(filters?: Record<string, unknown>): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = (filters?.page as number) || 1;
    const params: Record<string, string> = { page: String(page) };
    if (filters?.status) params.status = String(filters.status);
    if (filters?.customerId) params.customer_id = String(filters.customerId);

    const resp = await this.request('/tickets', params) as any;
    const tickets: SyncroTicket[] = resp.tickets || [];
    const totalPages = resp.meta?.total_pages || 1;

    return {
      data: tickets.map(t => ({
        externalId: String(t.id),
        number: t.number,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        customerId: String(t.customer_id),
        assignedTo: t.assigned_user_name,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      total: resp.meta?.total_entries || tickets.length,
      page, pageSize: 25, hasMore: page < totalPages,
    };
  }

  // ─── Customer helpers ────────────────────────────────────────────

  async listCustomers(page = 1): Promise<PaginatedResult<{ externalId: string; name: string }>> {
    const resp = await this.request('/customers', { page: String(page) }) as any;
    const customers = resp.customers || [];
    return {
      data: customers.map((c: any) => ({
        externalId: String(c.id),
        name: c.business_name || c.firstname + ' ' + c.lastname,
      })),
      total: resp.meta?.total_entries || customers.length,
      page, pageSize: 25, hasMore: page < (resp.meta?.total_pages || 1),
    };
  }

  // ─── Mapping ─────────────────────────────────────────────────────

  private mapDevice(a: SyncroAsset): NormalizedDevice {
    const props = a.properties || {};
    const osName = props.os_name || '';
    const osLower = osName.toLowerCase();
    let osType: NormalizedDevice['osType'] = 'other';
    if (osLower.includes('windows')) osType = 'windows';
    else if (osLower.includes('mac') || osLower.includes('darwin')) osType = 'macos';
    else if (osLower.includes('linux') || osLower.includes('ubuntu')) osType = 'linux';
    else if (a.asset_type?.toLowerCase().includes('network') || a.asset_type?.toLowerCase().includes('switch') || a.asset_type?.toLowerCase().includes('router') || a.asset_type?.toLowerCase().includes('firewall')) osType = 'network';

    return {
      externalId: String(a.id),
      connectorId: this.config?.connectorId || this.id,
      hostname: a.name,
      fqdn: undefined,
      osName,
      osVersion: props.os_version || '',
      osType,
      lastSeen: props.last_seen ? new Date(props.last_seen) : new Date(a.updated_at),
      status: props.online ? 'online' : 'offline',
      ipAddresses: props.ip_address ? [props.ip_address] : [],
      macAddresses: props.mac_address ? [props.mac_address] : [],
      manufacturer: props.manufacturer,
      model: props.model,
      serialNumber: props.serial_number,
      assignedUser: undefined,
      clientExternalId: String(a.customer_id),
      siteExternalId: undefined,
      tags: [],
      patchStatus: 'unknown',
      antivirusStatus: 'unknown',
      rawData: a as unknown as Record<string, unknown>,
    };
  }

  private mapRmmAlert(a: any): NormalizedAlert {
    const severityMap: Record<string, NormalizedAlert['severity']> = {
      critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info',
    };
    return {
      externalId: String(a.id),
      connectorId: this.config?.connectorId || this.id,
      deviceExternalId: a.asset_id ? String(a.asset_id) : undefined,
      title: a.title || a.alert_type || 'RMM Alert',
      description: a.description || a.message || '',
      severity: severityMap[(a.severity || '').toLowerCase()] || 'medium',
      status: a.resolved ? 'resolved' : 'active',
      category: a.alert_type || 'rmm',
      createdAt: new Date(a.created_at),
      updatedAt: new Date(a.updated_at || a.created_at),
      resolvedAt: a.resolved_at ? new Date(a.resolved_at) : undefined,
      rawData: a as Record<string, unknown>,
    };
  }

  // ─── HTTP Client ─────────────────────────────────────────────────

  private async request(
    path: string,
    params: Record<string, string> = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': this.apiKey,
    };

    const opts: RequestInit = { method, headers };
    if (body && (method === 'POST' || method === 'PUT')) {
      opts.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(url.toString(), opts);

        if (resp.status === 429) {
          const retryAfter = parseInt(resp.headers.get('Retry-After') || '3', 10);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Syncro API ${resp.status}: ${text}`);
        }

        if (resp.status === 204) return {};
        return await resp.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
      }
    }
    throw lastError || new Error('Syncro request failed');
  }

  private async fetchAllPages<T>(
    path: string,
    dataKey: string,
    extraParams: Record<string, string> = {},
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;

    while (true) {
      const resp = await this.request(path, { ...extraParams, page: String(page) }) as any;
      const items: T[] = resp[dataKey] || [];
      all.push(...items);

      const totalPages = resp.meta?.total_pages || 1;
      if (page >= totalPages || items.length === 0) break;
      page++;
      if (page > 100) break;
    }

    return all;
  }
}

export default SyncroConnector;
