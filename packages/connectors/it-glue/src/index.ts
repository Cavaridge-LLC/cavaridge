/**
 * @cavaridge/connector-it-glue — IT Glue Documentation Connector
 *
 * Implements IDocumentationConnector from @cavaridge/connector-core.
 * IT Glue JSON:API v1 integration with pagination, rate limiting, and
 * normalized model mapping.
 *
 * Auth: API key in x-api-key header
 * Base URL: https://api.itglue.com (configurable, EU: https://api.eu.itglue.com)
 * Format: JSON:API — responses are { data: [{ id, type, attributes, relationships }], meta }
 * Rate limit: 10 req/sec
 */

declare function require(id: string): any;
declare const Buffer: { from(s: string, enc?: string): Uint8Array };

import type {
  IDocumentationConnector,
  ConnectorConfig,
  ConnectorHealth,
  AuthResult,
  SyncResult,
  SyncError,
  PaginatedResult,
  NormalizedDevice,
  NormalizedDocument,
  NormalizedOrganization,
  WebhookRegistration,
  WebhookEvent,
} from '@cavaridge/connector-core';

// ─── JSON:API Types ──────────────────────────────────────────────────

interface JsonApiResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data: { id: string; type: string } | Array<{ id: string; type: string }> }>;
}

interface JsonApiResponse {
  data: JsonApiResource | JsonApiResource[];
  meta?: { 'current-page': number; 'next-page': number | null; 'prev-page': number | null; 'total-pages': number; 'total-count': number };
}

// ─── Rate Limiter ────────────────────────────────────────────────────

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// ─── IT Glue Connector ──────────────────────────────────────────────

export class ItGlueConnector implements IDocumentationConnector {
  readonly id = 'it-glue';
  readonly name = 'IT Glue';
  readonly type = 'documentation' as const;
  readonly version = '1.0.0';
  readonly platformVersion = '1.0.0';

  private config: ConnectorConfig | null = null;
  private apiKey = '';
  private baseUrl = 'https://api.itglue.com';
  private authenticated = false;
  private rateLimiter = new RateLimiter(10);
  private syncCursors = new Map<string, string>();
  private lastSyncAt: Date | null = null;
  private lastErrorAt: Date | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    this.apiKey = config.credentials.apiKey || '';
    if (config.baseUrl) this.baseUrl = config.baseUrl.replace(/\/$/, '');
    if (!this.apiKey) throw new Error('IT Glue API key required in credentials.apiKey');
    await this.authenticate();
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const checkedAt = new Date();
    try {
      await this.request('/organizations', { 'page[size]': '1' });
      return {
        connectorId: this.id,
        status: 'healthy',
        lastSyncAt: this.lastSyncAt,
        lastErrorAt: this.lastErrorAt,
        syncLagSeconds: this.lastSyncAt ? Math.floor((Date.now() - this.lastSyncAt.getTime()) / 1000) : 0,
        recordsSynced: 0,
        errorRate: 0,
        details: {},
        checkedAt,
      };
    } catch (err) {
      this.lastErrorAt = checkedAt;
      return {
        connectorId: this.id,
        status: 'unhealthy',
        lastSyncAt: this.lastSyncAt,
        lastErrorAt: this.lastErrorAt,
        syncLagSeconds: 0,
        recordsSynced: 0,
        errorRate: 1,
        details: { error: err instanceof Error ? err.message : String(err) },
        checkedAt,
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
      await this.request('/organizations', { 'page[size]': '1' });
      this.authenticated = true;
      return { authenticated: true };
    } catch (err) {
      this.authenticated = false;
      return { authenticated: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async refreshAuth(): Promise<AuthResult> {
    return this.authenticate();
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  // ─── Sync ────────────────────────────────────────────────────────

  async fullSync(entityType: string): Promise<SyncResult> {
    const start = Date.now();
    const errors: SyncError[] = [];
    let recordsProcessed = 0;

    try {
      switch (entityType) {
        case 'organizations': {
          const all = await this.fetchAllPages<JsonApiResource>('/organizations');
          recordsProcessed = all.length;
          break;
        }
        case 'configurations': {
          const all = await this.fetchAllPages<JsonApiResource>('/configurations');
          recordsProcessed = all.length;
          break;
        }
        case 'documents': {
          const all = await this.fetchAllPages<JsonApiResource>('/documents');
          recordsProcessed = all.length;
          break;
        }
        default:
          errors.push({ message: `Unknown entity type: ${entityType}`, retryable: false });
      }

      this.lastSyncAt = new Date();
      this.syncCursors.set(entityType, new Date().toISOString());
    } catch (err) {
      this.lastErrorAt = new Date();
      errors.push({ message: err instanceof Error ? err.message : String(err), retryable: true });
    }

    return {
      mode: 'full_sync',
      entityType,
      recordsProcessed,
      recordsCreated: recordsProcessed,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors,
      cursor: this.syncCursors.get(entityType) || null,
      durationMs: Date.now() - start,
    };
  }

  async incrementalSync(entityType: string, cursor: string): Promise<SyncResult> {
    const start = Date.now();
    const errors: SyncError[] = [];
    let recordsProcessed = 0;

    try {
      const params: Record<string, string> = { 'filter[updated-since]': cursor };

      switch (entityType) {
        case 'organizations': {
          const all = await this.fetchAllPages<JsonApiResource>('/organizations', params);
          recordsProcessed = all.length;
          break;
        }
        case 'configurations': {
          const all = await this.fetchAllPages<JsonApiResource>('/configurations', params);
          recordsProcessed = all.length;
          break;
        }
        default:
          errors.push({ message: `Unknown entity type: ${entityType}`, retryable: false });
      }

      const newCursor = new Date().toISOString();
      this.syncCursors.set(entityType, newCursor);
      this.lastSyncAt = new Date();
    } catch (err) {
      this.lastErrorAt = new Date();
      errors.push({ message: err instanceof Error ? err.message : String(err), retryable: true });
    }

    return {
      mode: 'incremental_sync',
      entityType,
      recordsProcessed,
      recordsCreated: 0,
      recordsUpdated: recordsProcessed,
      recordsDeleted: 0,
      errors,
      cursor: this.syncCursors.get(entityType) || null,
      durationMs: Date.now() - start,
    };
  }

  async getLastSyncCursor(entityType: string): Promise<string | null> {
    return this.syncCursors.get(entityType) || null;
  }

  // ─── Webhooks (not supported by IT Glue) ─────────────────────────

  supportsWebhooks(): boolean {
    return false;
  }

  // ─── Organizations ───────────────────────────────────────────────

  async listOrganizations(): Promise<PaginatedResult<NormalizedOrganization>> {
    const resources = await this.fetchAllPages<JsonApiResource>('/organizations');
    const data = resources.map(r => this.mapOrganization(r));
    return { data, total: data.length, page: 1, pageSize: data.length, hasMore: false };
  }

  async getOrganization(id: string): Promise<NormalizedOrganization> {
    const resp = await this.request(`/organizations/${id}`);
    const resource = (resp as JsonApiResponse).data as JsonApiResource;
    return this.mapOrganization(resource);
  }

  // ─── Configurations (map to NormalizedDevice) ────────────────────

  async listConfigurations(orgId: string, filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedDevice>> {
    const page = (filters?.page as number) || 1;
    const pageSize = (filters?.pageSize as number) || 50;
    const params: Record<string, string> = {
      'filter[organization-id]': orgId,
      'page[number]': String(page),
      'page[size]': String(pageSize),
    };
    if (filters?.search) params['filter[name]'] = String(filters.search);

    const resp = await this.request('/configurations', params);
    const json = resp as JsonApiResponse;
    const resources = Array.isArray(json.data) ? json.data : [json.data];
    const data = resources.map(r => this.mapConfiguration(r));
    const totalCount = json.meta?.['total-count'] || data.length;
    const totalPages = json.meta?.['total-pages'] || 1;

    return {
      data,
      total: totalCount,
      page,
      pageSize,
      hasMore: page < totalPages,
    };
  }

  async getConfiguration(id: string): Promise<NormalizedDevice> {
    const resp = await this.request(`/configurations/${id}`);
    const resource = (resp as JsonApiResponse).data as JsonApiResource;
    return this.mapConfiguration(resource);
  }

  async createConfiguration(orgId: string, data: Record<string, unknown>): Promise<NormalizedDevice> {
    const body = {
      data: {
        type: 'configurations',
        attributes: {
          'organization-id': Number(orgId),
          name: data.hostname || data.name,
          'configuration-type-id': data.configurationTypeId,
          'operating-system': data.osName,
          'primary-ip': data.ipAddress,
          'serial-number': data.serialNumber,
          notes: data.notes,
          ...((data.attributes as Record<string, unknown>) || {}),
        },
      },
    };
    const resp = await this.request('/configurations', {}, 'POST', body);
    const resource = (resp as JsonApiResponse).data as JsonApiResource;
    return this.mapConfiguration(resource);
  }

  async updateConfiguration(id: string, data: Record<string, unknown>): Promise<NormalizedDevice> {
    const body = {
      data: {
        type: 'configurations',
        attributes: data,
      },
    };
    const resp = await this.request(`/configurations/${id}`, {}, 'PATCH', body);
    const resource = (resp as JsonApiResponse).data as JsonApiResource;
    return this.mapConfiguration(resource);
  }

  // ─── Documents ───────────────────────────────────────────────────

  async listDocuments(orgId: string): Promise<PaginatedResult<NormalizedDocument>> {
    const resources = await this.fetchAllPages<JsonApiResource>(
      `/organizations/${orgId}/relationships/documents`,
      {},
      '/documents',
    );
    const data = resources.map(r => this.mapDocument(r));
    return { data, total: data.length, page: 1, pageSize: data.length, hasMore: false };
  }

  async getDocument(id: string): Promise<NormalizedDocument> {
    const resp = await this.request(`/documents/${id}`);
    const resource = (resp as JsonApiResponse).data as JsonApiResource;
    return this.mapDocument(resource);
  }

  // ─── Flexible Assets ─────────────────────────────────────────────

  async listFlexibleAssets(orgId: string, typeId: string): Promise<PaginatedResult<Record<string, unknown>>> {
    const resources = await this.fetchAllPages<JsonApiResource>('/flexible_assets', {
      'filter[organization-id]': orgId,
      'filter[flexible-asset-type-id]': typeId,
    });
    const data = resources.map(r => ({
      id: r.id,
      type: r.type,
      ...r.attributes,
    }));
    return { data, total: data.length, page: 1, pageSize: data.length, hasMore: false };
  }

  // ─── Passwords (metadata only — NEVER log values) ────────────────

  async listPasswords(orgId: string): Promise<PaginatedResult<Record<string, unknown>>> {
    const resources = await this.fetchAllPages<JsonApiResource>('/passwords', {
      'filter[organization-id]': orgId,
    });
    const data = resources.map(r => ({
      id: r.id,
      name: r.attributes['name'],
      username: r.attributes['username'],
      url: r.attributes['url'],
      passwordCategory: r.attributes['password-category-name'],
      updatedAt: r.attributes['updated-at'],
      createdAt: r.attributes['created-at'],
      // Password value intentionally excluded — sensitive data
    }));
    return { data, total: data.length, page: 1, pageSize: data.length, hasMore: false };
  }

  // ─── Mapping Helpers ─────────────────────────────────────────────

  private mapOrganization(r: JsonApiResource): NormalizedOrganization {
    return {
      externalId: r.id,
      name: String(r.attributes['name'] || ''),
      description: r.attributes['description'] as string | undefined,
    };
  }

  private mapConfiguration(r: JsonApiResource): NormalizedDevice {
    const attrs = r.attributes;
    const osName = String(attrs['operating-system'] || '');
    const osType = this.detectOsType(osName);

    return {
      externalId: r.id,
      connectorId: this.config?.connectorId || this.id,
      hostname: String(attrs['name'] || ''),
      fqdn: undefined,
      osName,
      osVersion: '',
      osType,
      lastSeen: attrs['updated-at'] ? new Date(String(attrs['updated-at'])) : new Date(),
      status: 'unknown',
      ipAddresses: attrs['primary-ip'] ? [String(attrs['primary-ip'])] : [],
      macAddresses: attrs['mac-address'] ? [String(attrs['mac-address'])] : [],
      manufacturer: attrs['manufacturer-name'] as string | undefined,
      model: attrs['model-name'] as string | undefined,
      serialNumber: attrs['serial-number'] as string | undefined,
      assignedUser: attrs['contact-name'] as string | undefined,
      clientExternalId: attrs['organization-id'] ? String(attrs['organization-id']) : undefined,
      siteExternalId: attrs['location-id'] ? String(attrs['location-id']) : undefined,
      tags: [],
      patchStatus: 'unknown',
      antivirusStatus: 'unknown',
      rawData: attrs as Record<string, unknown>,
    };
  }

  private mapDocument(r: JsonApiResource): NormalizedDocument {
    return {
      externalId: r.id,
      title: String(r.attributes['name'] || r.attributes['title'] || ''),
      content: String(r.attributes['content'] || ''),
      updatedAt: r.attributes['updated-at'] ? new Date(String(r.attributes['updated-at'])) : new Date(),
    };
  }

  private detectOsType(os: string): 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'network' | 'other' {
    const lower = os.toLowerCase();
    if (lower.includes('windows')) return 'windows';
    if (lower.includes('mac') || lower.includes('darwin')) return 'macos';
    if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('centos') || lower.includes('debian')) return 'linux';
    if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return 'ios';
    if (lower.includes('android')) return 'android';
    if (lower.includes('cisco') || lower.includes('juniper') || lower.includes('meraki') || lower.includes('switch') || lower.includes('router') || lower.includes('firewall')) return 'network';
    return 'other';
  }

  // ─── HTTP Client ─────────────────────────────────────────────────

  private async request(
    path: string,
    params: Record<string, string> = {},
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    await this.rateLimiter.acquire();

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.api+json',
      'x-api-key': this.apiKey,
    };

    const opts: RequestInit = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH')) {
      opts.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(url.toString(), opts);

        if (resp.status === 429) {
          const retryAfter = parseInt(resp.headers.get('Retry-After') || '2', 10);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`IT Glue API ${resp.status}: ${text}`);
        }

        if (resp.status === 204) return {};
        return await resp.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        }
      }
    }
    throw lastError || new Error('IT Glue request failed');
  }

  private async fetchAllPages<T>(
    path: string,
    extraParams: Record<string, string> = {},
    _altPath?: string,
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    const pageSize = 50;

    while (true) {
      const params: Record<string, string> = {
        ...extraParams,
        'page[number]': String(page),
        'page[size]': String(pageSize),
      };

      const resp = await this.request(path, params) as JsonApiResponse;
      const resources = Array.isArray(resp.data) ? resp.data : [resp.data];
      all.push(...(resources as unknown as T[]));

      const totalPages = resp.meta?.['total-pages'] || 1;
      if (page >= totalPages || resources.length < pageSize) break;
      page++;

      // Safety: cap at 100 pages (5000 records)
      if (page > 100) break;
    }

    return all;
  }
}

export default ItGlueConnector;
