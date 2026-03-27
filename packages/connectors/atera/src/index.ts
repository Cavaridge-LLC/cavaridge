/**
 * @cavaridge/connector-atera — Atera RMM Connector
 *
 * Implements IRmmConnector from @cavaridge/connector-core.
 * Atera REST API v3 with pagination, rate limiting, and normalized model mapping.
 *
 * Auth: API key in X-Api-Key header
 * Base URL: https://app.atera.com/api/v3
 * Rate limits: 500 req / 5 min (~1.67 req/sec)
 * Pagination: page + itemsInPage params, response has totalPages + totalItemCount
 * Key entities: Customers, Agents, Alerts, Tickets, KnowledgeBase
 */

declare function require(id: string): any;
declare const Buffer: { from(s: string, enc?: string): Uint8Array };

import type {
  IRmmConnector, ConnectorConfig, ConnectorHealth, AuthResult,
  SyncResult, SyncError, NormalizedDevice, NormalizedAlert, PaginatedResult,
  DeviceFilters, AlertFilters, PatchStatus, ScriptPayload, ScriptResult,
  WebhookRegistration, WebhookEvent,
} from '@cavaridge/connector-core';

// ─── Atera API Response Types ────────────────────────────────────────

interface AteraPagedResponse<T> {
  items: T[];
  totalPages: number;
  totalItemCount: number;
  page: number;
  itemsInPage: number;
}

interface AteraAgent {
  AgentID: number;
  AgentName: string;
  MachineName: string;
  CustomerID: number;
  CustomerName: string;
  DomainName?: string;
  IPAddresses?: string;
  MacAddresses?: string;
  OS: string;
  OSType: string;
  OSVersion?: string;
  Manufacturer?: string;
  ModelName?: string;
  SerialNumber?: string;
  Online: boolean;
  LastSeenDate: string;
  Username?: string;
  AntivirusStatus?: string;
  PatchManagementStatus?: string;
}

interface AteraAlert {
  AlertID: number;
  DeviceGuid?: string;
  AgentID?: number;
  Title: string;
  Severity: string;
  AlertCategoryID: string;
  AlertMessage: string;
  Created: string;
  Archived: boolean;
  ArchivedDate?: string;
  CustomerID: number;
  CustomerName?: string;
  MachineName?: string;
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

// ─── Atera Connector ─────────────────────────────────────────────────

export class AteraConnector implements IRmmConnector {
  readonly id = 'atera';
  readonly name = 'Atera';
  readonly type = 'rmm' as const;
  readonly version = '1.0.0';
  readonly platformVersion = 'v3';

  private config: ConnectorConfig | null = null;
  private apiKey = '';
  private baseUrl = 'https://app.atera.com/api/v3';
  private authenticated = false;
  private rateLimiter = new RateLimiter(1.5); // 500 req / 5 min ≈ 1.67/s, conservative
  private syncCursors = new Map<string, string>();
  private lastSyncAt: Date | null = null;
  private lastErrorAt: Date | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    this.apiKey = config.credentials.apiKey || '';
    if (config.baseUrl) this.baseUrl = config.baseUrl.replace(/\/$/, '');
    if (!this.apiKey) throw new Error('Atera API key required in credentials.apiKey');
    await this.authenticate();
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const checkedAt = new Date();
    try {
      await this.request('/agents', { page: '1', itemsInPage: '1' });
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
      await this.request('/agents', { page: '1', itemsInPage: '1' });
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
        const all = await this.fetchAllPages<AteraAgent>('/agents');
        count = all.length;
      } else if (entityType === 'alerts') {
        const all = await this.fetchAllPages<AteraAlert>('/alerts');
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
    // Atera doesn't have native incremental sync — use full sync with post-filter
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

  supportsWebhooks(): boolean { return false; }
  supportsScripting(): boolean { return false; }

  // ─── Devices (Agents) ────────────────────────────────────────────

  async listDevices(filters?: DeviceFilters): Promise<PaginatedResult<NormalizedDevice>> {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 50;
    const params: Record<string, string> = {
      page: String(page),
      itemsInPage: String(pageSize),
    };
    if (filters?.clientExternalId) params.customerid = filters.clientExternalId;

    const resp = await this.request('/agents', params) as AteraPagedResponse<AteraAgent>;
    let devices = resp.items.map(a => this.mapDevice(a));

    if (filters?.status) {
      const wantOnline = filters.status === 'online';
      devices = devices.filter(d => (d.status === 'online') === wantOnline);
    }
    if (filters?.osType) {
      devices = devices.filter(d => d.osType === filters.osType);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      devices = devices.filter(d => d.hostname.toLowerCase().includes(s));
    }

    return {
      data: devices, total: resp.totalItemCount,
      page, pageSize, hasMore: page < resp.totalPages,
    };
  }

  async getDevice(externalId: string): Promise<NormalizedDevice> {
    const resp = await this.request(`/agents/${externalId}`) as AteraAgent;
    return this.mapDevice(resp);
  }

  async getDeviceAlerts(externalId: string): Promise<NormalizedAlert[]> {
    const params = { agentId: externalId };
    const all = await this.fetchAllPages<AteraAlert>('/alerts', params);
    return all.map(a => this.mapAlert(a));
  }

  // ─── Alerts ──────────────────────────────────────────────────────

  async listAlerts(filters?: AlertFilters): Promise<PaginatedResult<NormalizedAlert>> {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 50;
    const params: Record<string, string> = {
      page: String(page),
      itemsInPage: String(pageSize),
    };
    if (filters?.deviceExternalId) params.agentId = filters.deviceExternalId;

    const resp = await this.request('/alerts', params) as AteraPagedResponse<AteraAlert>;
    let alerts = resp.items.map(a => this.mapAlert(a));

    if (filters?.severity) {
      alerts = alerts.filter(a => a.severity === filters.severity);
    }
    if (filters?.status) {
      alerts = alerts.filter(a => a.status === filters.status);
    }
    if (filters?.since) {
      const since = filters.since.getTime();
      alerts = alerts.filter(a => a.createdAt.getTime() >= since);
    }

    return {
      data: alerts, total: resp.totalItemCount,
      page, pageSize, hasMore: page < resp.totalPages,
    };
  }

  async acknowledgeAlert(externalId: string): Promise<void> {
    // Atera doesn't have a dedicated acknowledge — alerts can only be archived
    // We treat acknowledge as a no-op to maintain interface compatibility
  }

  async resolveAlert(externalId: string, _notes?: string): Promise<void> {
    // Archive the alert in Atera
    await this.request(`/alerts/${externalId}`, {}, 'DELETE');
  }

  // ─── Patch Status ────────────────────────────────────────────────

  async getPatchStatus(deviceId: string): Promise<PatchStatus> {
    // Atera provides patch info at the agent level
    try {
      const agent = await this.request(`/agents/${deviceId}`) as AteraAgent;
      const status = agent.PatchManagementStatus?.toLowerCase() || '';
      return {
        deviceExternalId: deviceId,
        totalPatches: 0,
        installedPatches: 0,
        pendingPatches: status === 'pending' ? 1 : 0,
        failedPatches: status === 'failed' ? 1 : 0,
        lastPatchedAt: undefined,
      };
    } catch {
      return {
        deviceExternalId: deviceId,
        totalPatches: 0, installedPatches: 0,
        pendingPatches: 0, failedPatches: 0,
      };
    }
  }

  // ─── Customer helpers ────────────────────────────────────────────

  async listCustomers(page = 1, pageSize = 50): Promise<PaginatedResult<{ externalId: string; name: string }>> {
    const resp = await this.request('/customers', {
      page: String(page), itemsInPage: String(pageSize),
    }) as AteraPagedResponse<{ CustomerID: number; CustomerName: string }>;
    return {
      data: resp.items.map(c => ({
        externalId: String(c.CustomerID),
        name: c.CustomerName,
      })),
      total: resp.totalItemCount,
      page, pageSize, hasMore: page < resp.totalPages,
    };
  }

  // ─── Mapping ─────────────────────────────────────────────────────

  private mapDevice(a: AteraAgent): NormalizedDevice {
    const osLower = (a.OS || '').toLowerCase();
    let osType: NormalizedDevice['osType'] = 'other';
    if (osLower.includes('windows')) osType = 'windows';
    else if (osLower.includes('mac') || osLower.includes('darwin')) osType = 'macos';
    else if (osLower.includes('linux') || osLower.includes('ubuntu')) osType = 'linux';

    const avStatus = (a.AntivirusStatus || '').toLowerCase();
    let antivirusStatus: NormalizedDevice['antivirusStatus'] = 'unknown';
    if (avStatus.includes('active') || avStatus.includes('on') || avStatus.includes('enabled')) antivirusStatus = 'active';
    else if (avStatus.includes('outdated') || avStatus.includes('expired')) antivirusStatus = 'outdated';
    else if (avStatus.includes('disabled') || avStatus.includes('off')) antivirusStatus = 'disabled';

    const patchLower = (a.PatchManagementStatus || '').toLowerCase();
    let patchStatus: NormalizedDevice['patchStatus'] = 'unknown';
    if (patchLower.includes('uptodate') || patchLower.includes('current')) patchStatus = 'current';
    else if (patchLower.includes('pending')) patchStatus = 'pending';
    else if (patchLower.includes('overdue') || patchLower.includes('failed')) patchStatus = 'overdue';

    return {
      externalId: String(a.AgentID),
      connectorId: this.config?.connectorId || this.id,
      hostname: a.MachineName || a.AgentName,
      fqdn: a.DomainName ? `${a.MachineName}.${a.DomainName}` : undefined,
      osName: a.OS || '',
      osVersion: a.OSVersion || '',
      osType,
      lastSeen: new Date(a.LastSeenDate),
      status: a.Online ? 'online' : 'offline',
      ipAddresses: a.IPAddresses ? a.IPAddresses.split(',').map(s => s.trim()).filter(Boolean) : [],
      macAddresses: a.MacAddresses ? a.MacAddresses.split(',').map(s => s.trim()).filter(Boolean) : [],
      manufacturer: a.Manufacturer,
      model: a.ModelName,
      serialNumber: a.SerialNumber,
      assignedUser: a.Username,
      clientExternalId: String(a.CustomerID),
      siteExternalId: undefined,
      tags: [],
      patchStatus,
      antivirusStatus,
      rawData: a as unknown as Record<string, unknown>,
    };
  }

  private mapAlert(a: AteraAlert): NormalizedAlert {
    const severityMap: Record<string, NormalizedAlert['severity']> = {
      critical: 'critical', warning: 'high', information: 'info', low: 'low',
    };
    return {
      externalId: String(a.AlertID),
      connectorId: this.config?.connectorId || this.id,
      deviceExternalId: a.AgentID ? String(a.AgentID) : undefined,
      title: a.Title,
      description: a.AlertMessage || '',
      severity: severityMap[(a.Severity || '').toLowerCase()] || 'medium',
      status: a.Archived ? 'resolved' : 'active',
      category: a.AlertCategoryID || 'general',
      createdAt: new Date(a.Created),
      updatedAt: new Date(a.Created),
      resolvedAt: a.ArchivedDate ? new Date(a.ArchivedDate) : undefined,
      rawData: a as unknown as Record<string, unknown>,
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
      'X-Api-Key': this.apiKey,
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
          const retryAfter = parseInt(resp.headers.get('Retry-After') || '5', 10);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Atera API ${resp.status}: ${text}`);
        }

        if (resp.status === 204) return {};
        return await resp.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
      }
    }
    throw lastError || new Error('Atera request failed');
  }

  private async fetchAllPages<T>(
    path: string,
    extraParams: Record<string, string> = {},
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    const pageSize = 50;

    while (true) {
      const resp = await this.request(path, {
        ...extraParams, page: String(page), itemsInPage: String(pageSize),
      }) as AteraPagedResponse<T>;

      all.push(...resp.items);
      if (page >= resp.totalPages || resp.items.length < pageSize) break;
      page++;
      if (page > 100) break; // safety cap
    }

    return all;
  }
}

export default AteraConnector;
