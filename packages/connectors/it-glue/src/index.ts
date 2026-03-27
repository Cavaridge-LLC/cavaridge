/**
 * @cavaridge/connector-it-glue — IT Glue Documentation Connector
 *
 * Implements IDocumentationConnector from @cavaridge/connector-core
 * plus extended methods for flexible assets, passwords, and CRUD operations.
 *
 * Auth: API key in x-api-key header
 * Base URL: https://api.itglue.com (EU: https://api.eu.itglue.com)
 * Format: JSON:API — { data: [{ id, type, attributes, relationships }], meta }
 * Rate limit: 10 req/sec (token bucket)
 * Pagination: page[number] + page[size] (max 1000)
 * Retry: 3 attempts with exponential backoff for 429/5xx
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
} from '@cavaridge/connector-core';

// ─── Constants ──────────────────────────────────────────────────────

const CONNECTOR_ID = 'it-glue';
const CONNECTOR_VERSION = '1.0.0';
const DEFAULT_BASE_URL = 'https://api.itglue.com';
const EU_BASE_URL = 'https://api.eu.itglue.com';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 1000;
const RATE_LIMIT_RPS = 10;
const MAX_RETRY_ATTEMPTS = 3;
const MAX_PAGINATION_PAGES = 200; // Safety cap: 200 * 1000 = 200k records

// ─── JSON:API Types ─────────────────────────────────────────────────

interface JsonApiResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<
    string,
    { data: { id: string; type: string } | Array<{ id: string; type: string }> | null }
  >;
}

interface JsonApiMeta {
  'current-page'?: number;
  'next-page'?: number | null;
  'prev-page'?: number | null;
  'total-pages'?: number;
  'total-count'?: number;
}

interface JsonApiResponse {
  data: JsonApiResource | JsonApiResource[];
  meta?: JsonApiMeta;
  included?: JsonApiResource[];
}

// ─── Public Filter Types ────────────────────────────────────────────

export interface OrganizationFilters {
  name?: string;
  organizationTypeId?: number;
  organizationStatusId?: number;
  updatedSince?: string;
  page?: number;
  pageSize?: number;
}

export interface ConfigurationFilters {
  name?: string;
  configurationTypeId?: number;
  configurationStatusId?: number;
  serialNumber?: string;
  contactId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface FlexibleAssetFilters {
  name?: string;
  page?: number;
  pageSize?: number;
}

export interface PasswordFilters {
  name?: string;
  passwordCategoryId?: number;
  page?: number;
  pageSize?: number;
}

// ─── Extended Normalized Types ──────────────────────────────────────

export interface NormalizedFlexibleAsset {
  externalId: string;
  connectorId: string;
  name: string;
  typeName: string;
  typeId: string;
  organizationId: string;
  organizationName: string;
  traits: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  rawData: Record<string, unknown>;
}

/**
 * Password metadata only. The actual password value is NEVER retrieved,
 * stored, or logged. The `sensitive` flag is always true.
 */
export interface NormalizedPasswordMeta {
  externalId: string;
  connectorId: string;
  name: string;
  username?: string;
  url?: string;
  categoryName?: string;
  organizationId: string;
  resourceId?: string;
  resourceType?: string;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  /** Always true — password values are NEVER included */
  sensitive: true;
  rawData: Record<string, unknown>;
}

// ─── IT Glue API Error ──────────────────────────────────────────────

export class ITGlueApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string = '',
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ITGlueApiError';
  }
}

// ─── Token Bucket Rate Limiter ──────────────────────────────────────

class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRatePerMs = requestsPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Calculate how long we need to wait for 1 token
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }
}

// ─── IT Glue Connector ─────────────────────────────────────────────

export class ItGlueConnector implements IDocumentationConnector {
  readonly id = CONNECTOR_ID;
  readonly name = 'IT Glue';
  readonly type = 'documentation' as const;
  readonly version = CONNECTOR_VERSION;
  readonly platformVersion = '1.0.0';

  private config: ConnectorConfig | null = null;
  private apiKey = '';
  private baseUrl = DEFAULT_BASE_URL;
  private authenticated = false;
  private rateLimiter = new TokenBucketLimiter(RATE_LIMIT_RPS);
  private syncCursors = new Map<string, string>();
  private lastSyncAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private totalRecordsSynced = 0;

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    this.apiKey = config.credentials.apiKey || '';
    if (!this.apiKey) {
      throw new Error('IT Glue API key required in credentials.apiKey');
    }

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
    } else {
      const region = config.settings.region as string | undefined;
      if (region === 'eu') this.baseUrl = EU_BASE_URL;
    }

    await this.authenticate();
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const checkedAt = new Date();
    try {
      await this.apiRequest('GET', '/organizations', { 'page[size]': '1' });
      return {
        connectorId: this.id,
        status: 'healthy',
        lastSyncAt: this.lastSyncAt,
        lastErrorAt: this.lastErrorAt,
        syncLagSeconds: this.lastSyncAt
          ? Math.floor((Date.now() - this.lastSyncAt.getTime()) / 1000)
          : 0,
        recordsSynced: this.totalRecordsSynced,
        errorRate: 0,
        details: { baseUrl: this.baseUrl },
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
        recordsSynced: this.totalRecordsSynced,
        errorRate: 1,
        details: { error: err instanceof Error ? err.message : String(err), baseUrl: this.baseUrl },
        checkedAt,
      };
    }
  }

  async shutdown(): Promise<void> {
    this.authenticated = false;
    this.config = null;
    this.apiKey = '';
    this.syncCursors.clear();
  }

  // ─── Authentication ──────────────────────────────────────────────

  async authenticate(): Promise<AuthResult> {
    if (!this.apiKey) {
      this.authenticated = false;
      return { authenticated: false, error: 'No API key configured' };
    }
    try {
      // IT Glue uses static API keys — validate by making a lightweight call
      await this.apiRequest('GET', '/organizations', { 'page[size]': '1' });
      this.authenticated = true;
      return { authenticated: true };
    } catch (err) {
      this.authenticated = false;
      return {
        authenticated: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async refreshAuth(): Promise<AuthResult> {
    // IT Glue uses static API keys — no token refresh needed
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
      const pathMap: Record<string, string> = {
        organizations: '/organizations',
        configurations: '/configurations',
        flexible_assets: '/flexible_assets',
        documents: '/documents',
        passwords: '/passwords',
      };

      const path = pathMap[entityType];
      if (!path) {
        errors.push({ message: `Unknown entity type: ${entityType}`, retryable: false });
      } else {
        const all = await this.fetchAllPages(path);
        recordsProcessed = all.length;
      }

      this.lastSyncAt = new Date();
      this.syncCursors.set(entityType, new Date().toISOString());
      this.totalRecordsSynced += recordsProcessed;
    } catch (err) {
      this.lastErrorAt = new Date();
      errors.push({
        message: err instanceof Error ? err.message : String(err),
        retryable: err instanceof ITGlueApiError ? err.retryable : true,
      });
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
      const pathMap: Record<string, string> = {
        organizations: '/organizations',
        configurations: '/configurations',
        flexible_assets: '/flexible_assets',
        documents: '/documents',
        passwords: '/passwords',
      };

      const path = pathMap[entityType];
      if (!path) {
        errors.push({
          message: `Incremental sync not supported for: ${entityType}`,
          retryable: false,
        });
      } else {
        const all = await this.fetchAllPages(path, {
          'filter[updated-since]': cursor,
        });
        recordsProcessed = all.length;
      }

      const newCursor = new Date().toISOString();
      this.syncCursors.set(entityType, newCursor);
      this.lastSyncAt = new Date();
      this.totalRecordsSynced += recordsProcessed;
    } catch (err) {
      this.lastErrorAt = new Date();
      errors.push({
        message: err instanceof Error ? err.message : String(err),
        retryable: err instanceof ITGlueApiError ? err.retryable : true,
      });
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

  // ─── Webhooks (IT Glue does not support webhooks) ─────────────────

  supportsWebhooks(): boolean {
    return false;
  }

  // ─── Organizations ───────────────────────────────────────────────

  async listOrganizations(): Promise<PaginatedResult<NormalizedOrganization>> {
    const all = await this.fetchAllPages('/organizations');
    const data = all.map((r) => this.mapOrganization(r));
    return { data, total: data.length, page: 1, pageSize: data.length, hasMore: false };
  }

  async getOrganizations(
    filters?: OrganizationFilters,
  ): Promise<PaginatedResult<NormalizedOrganization>> {
    const page = filters?.page ?? 1;
    const pageSize = clampPageSize(filters?.pageSize);
    const params: Record<string, string> = {
      'page[number]': String(page),
      'page[size]': String(pageSize),
    };
    if (filters?.name) params['filter[name]'] = filters.name;
    if (filters?.organizationTypeId)
      params['filter[organization-type-id]'] = String(filters.organizationTypeId);
    if (filters?.organizationStatusId)
      params['filter[organization-status-id]'] = String(filters.organizationStatusId);
    if (filters?.updatedSince) params['filter[updated-since]'] = filters.updatedSince;

    const resp = await this.apiRequest('GET', '/organizations', params);
    const json = resp as JsonApiResponse;
    const resources = extractArray(json);
    const meta = json.meta;

    return {
      data: resources.map((r) => this.mapOrganization(r)),
      total: meta?.['total-count'] ?? resources.length,
      page,
      pageSize,
      hasMore: meta?.['next-page'] != null,
      cursor: meta?.['next-page'] != null ? String(meta['next-page']) : undefined,
    };
  }

  async getOrganization(id: string): Promise<NormalizedOrganization> {
    const resp = await this.apiRequest('GET', `/organizations/${id}`);
    return this.mapOrganization(extractSingle(resp as JsonApiResponse));
  }

  // ─── Configurations ──────────────────────────────────────────────

  async listConfigurations(
    orgId: string,
    filters?: Record<string, unknown>,
  ): Promise<PaginatedResult<NormalizedDevice>> {
    return this.getConfigurations(orgId, filters as ConfigurationFilters | undefined);
  }

  async getConfigurations(
    orgId: string,
    filters?: ConfigurationFilters,
  ): Promise<PaginatedResult<NormalizedDevice>> {
    const page = filters?.page ?? 1;
    const pageSize = clampPageSize(filters?.pageSize);
    const params: Record<string, string> = {
      'filter[organization-id]': orgId,
      'page[number]': String(page),
      'page[size]': String(pageSize),
    };
    if (filters?.name) params['filter[name]'] = filters.name;
    if (filters?.search) params['filter[name]'] = filters.search;
    if (filters?.configurationTypeId)
      params['filter[configuration-type-id]'] = String(filters.configurationTypeId);
    if (filters?.configurationStatusId)
      params['filter[configuration-status-id]'] = String(filters.configurationStatusId);
    if (filters?.serialNumber) params['filter[serial-number]'] = filters.serialNumber;
    if (filters?.contactId) params['filter[contact-id]'] = String(filters.contactId);

    const resp = await this.apiRequest('GET', '/configurations', params);
    const json = resp as JsonApiResponse;
    const resources = extractArray(json);
    const meta = json.meta;

    return {
      data: resources.map((r) => this.mapConfiguration(r)),
      total: meta?.['total-count'] ?? resources.length,
      page,
      pageSize,
      hasMore: meta?.['next-page'] != null,
      cursor: meta?.['next-page'] != null ? String(meta['next-page']) : undefined,
    };
  }

  async getConfiguration(id: string): Promise<NormalizedDevice> {
    const resp = await this.apiRequest('GET', `/configurations/${id}`);
    return this.mapConfiguration(extractSingle(resp as JsonApiResponse));
  }

  async createConfiguration(
    orgId: string,
    data: Record<string, unknown>,
  ): Promise<NormalizedDevice> {
    const attrs: Record<string, unknown> = {
      'organization-id': Number(orgId),
      name: data.name ?? data.hostname,
    };
    // Map camelCase input to IT Glue kebab-case attributes
    if (data.hostname !== undefined) attrs['hostname'] = data.hostname;
    if (data.configurationTypeId !== undefined)
      attrs['configuration-type-id'] = data.configurationTypeId;
    if (data.configurationStatusId !== undefined)
      attrs['configuration-status-id'] = data.configurationStatusId;
    if (data.manufacturerId !== undefined) attrs['manufacturer-id'] = data.manufacturerId;
    if (data.modelId !== undefined) attrs['model-id'] = data.modelId;
    if (data.operatingSystem !== undefined) attrs['operating-system'] = data.operatingSystem;
    if (data.osName !== undefined) attrs['operating-system'] = data.osName;
    if (data.primaryIp !== undefined) attrs['primary-ip'] = data.primaryIp;
    if (data.ipAddress !== undefined) attrs['primary-ip'] = data.ipAddress;
    if (data.macAddress !== undefined) attrs['mac-address'] = data.macAddress;
    if (data.serialNumber !== undefined) attrs['serial-number'] = data.serialNumber;
    if (data.assetTag !== undefined) attrs['asset-tag'] = data.assetTag;
    if (data.notes !== undefined) attrs['notes'] = data.notes;
    if (data.warrantyExpiresAt !== undefined)
      attrs['warranty-expires-at'] = data.warrantyExpiresAt;
    if (data.installedBy !== undefined) attrs['installed-by'] = data.installedBy;
    // Allow raw attributes passthrough
    if (data.attributes && typeof data.attributes === 'object') {
      Object.assign(attrs, data.attributes);
    }

    const body = { data: { type: 'configurations', attributes: attrs } };
    const resp = await this.apiRequest('POST', '/configurations', {}, body);
    return this.mapConfiguration(extractSingle(resp as JsonApiResponse));
  }

  async updateConfiguration(
    id: string,
    data: Record<string, unknown>,
  ): Promise<NormalizedDevice> {
    const attrs: Record<string, unknown> = {};
    if (data.name !== undefined) attrs['name'] = data.name;
    if (data.hostname !== undefined) attrs['hostname'] = data.hostname;
    if (data.configurationTypeId !== undefined)
      attrs['configuration-type-id'] = data.configurationTypeId;
    if (data.configurationStatusId !== undefined)
      attrs['configuration-status-id'] = data.configurationStatusId;
    if (data.manufacturerId !== undefined) attrs['manufacturer-id'] = data.manufacturerId;
    if (data.modelId !== undefined) attrs['model-id'] = data.modelId;
    if (data.operatingSystem !== undefined) attrs['operating-system'] = data.operatingSystem;
    if (data.osName !== undefined) attrs['operating-system'] = data.osName;
    if (data.primaryIp !== undefined) attrs['primary-ip'] = data.primaryIp;
    if (data.ipAddress !== undefined) attrs['primary-ip'] = data.ipAddress;
    if (data.macAddress !== undefined) attrs['mac-address'] = data.macAddress;
    if (data.serialNumber !== undefined) attrs['serial-number'] = data.serialNumber;
    if (data.assetTag !== undefined) attrs['asset-tag'] = data.assetTag;
    if (data.notes !== undefined) attrs['notes'] = data.notes;
    if (data.warrantyExpiresAt !== undefined)
      attrs['warranty-expires-at'] = data.warrantyExpiresAt;
    if (data.installedBy !== undefined) attrs['installed-by'] = data.installedBy;
    if (data.archived !== undefined) attrs['archived'] = data.archived;
    // Allow raw attributes passthrough
    if (data.attributes && typeof data.attributes === 'object') {
      Object.assign(attrs, data.attributes);
    }

    const body = { data: { type: 'configurations', attributes: attrs } };
    const resp = await this.apiRequest('PATCH', `/configurations/${id}`, {}, body);
    return this.mapConfiguration(extractSingle(resp as JsonApiResponse));
  }

  // ─── Flexible Assets ─────────────────────────────────────────────

  async getFlexibleAssets(
    orgId: string,
    typeId: string,
    filters?: FlexibleAssetFilters,
  ): Promise<PaginatedResult<NormalizedFlexibleAsset>> {
    const page = filters?.page ?? 1;
    const pageSize = clampPageSize(filters?.pageSize);
    const params: Record<string, string> = {
      'filter[organization-id]': orgId,
      'filter[flexible-asset-type-id]': typeId,
      'page[number]': String(page),
      'page[size]': String(pageSize),
    };
    if (filters?.name) params['filter[name]'] = filters.name;

    const resp = await this.apiRequest('GET', '/flexible_assets', params);
    const json = resp as JsonApiResponse;
    const resources = extractArray(json);
    const meta = json.meta;

    return {
      data: resources.map((r) => this.mapFlexibleAsset(r)),
      total: meta?.['total-count'] ?? resources.length,
      page,
      pageSize,
      hasMore: meta?.['next-page'] != null,
      cursor: meta?.['next-page'] != null ? String(meta['next-page']) : undefined,
    };
  }

  // ─── Documents ───────────────────────────────────────────────────

  async listDocuments(orgId: string): Promise<PaginatedResult<NormalizedDocument>> {
    return this.getDocuments(orgId);
  }

  async getDocuments(
    orgId: string,
    page?: number,
    pageSize?: number,
  ): Promise<PaginatedResult<NormalizedDocument>> {
    const effectivePage = page ?? 1;
    const effectivePageSize = clampPageSize(pageSize);
    const params: Record<string, string> = {
      'filter[organization-id]': orgId,
      'page[number]': String(effectivePage),
      'page[size]': String(effectivePageSize),
    };

    const resp = await this.apiRequest(
      'GET',
      `/organizations/${orgId}/relationships/documents`,
      params,
    );
    const json = resp as JsonApiResponse;
    const resources = extractArray(json);
    const meta = json.meta;

    return {
      data: resources.map((r) => this.mapDocument(r)),
      total: meta?.['total-count'] ?? resources.length,
      page: effectivePage,
      pageSize: effectivePageSize,
      hasMore: meta?.['next-page'] != null,
      cursor: meta?.['next-page'] != null ? String(meta['next-page']) : undefined,
    };
  }

  // ─── Passwords (metadata only — NEVER log or return password values) ──

  async getPasswords(
    orgId: string,
    filters?: PasswordFilters,
  ): Promise<PaginatedResult<NormalizedPasswordMeta>> {
    const page = filters?.page ?? 1;
    const pageSize = clampPageSize(filters?.pageSize);
    const params: Record<string, string> = {
      'filter[organization-id]': orgId,
      'page[number]': String(page),
      'page[size]': String(pageSize),
    };
    if (filters?.name) params['filter[name]'] = filters.name;
    if (filters?.passwordCategoryId)
      params['filter[password-category-id]'] = String(filters.passwordCategoryId);

    // IMPORTANT: We NEVER set show_password=true. IT Glue returns metadata only
    // on list endpoints unless explicitly requested.
    const resp = await this.apiRequest('GET', '/passwords', params);
    const json = resp as JsonApiResponse;
    const resources = extractArray(json);
    const meta = json.meta;

    return {
      data: resources.map((r) => this.mapPasswordMeta(r)),
      total: meta?.['total-count'] ?? resources.length,
      page,
      pageSize,
      hasMore: meta?.['next-page'] != null,
      cursor: meta?.['next-page'] != null ? String(meta['next-page']) : undefined,
    };
  }

  // ─── Normalizers ─────────────────────────────────────────────────

  private mapOrganization(r: JsonApiResource): NormalizedOrganization {
    return {
      externalId: String(r.id),
      name: String(r.attributes['name'] ?? ''),
      description: r.attributes['description'] as string | undefined,
    };
  }

  private mapConfiguration(r: JsonApiResource): NormalizedDevice {
    const a = r.attributes;
    const osNotes = String(a['operating-system-notes'] ?? a['operating-system'] ?? '');

    return {
      externalId: String(r.id),
      connectorId: this.config?.connectorId ?? this.id,
      hostname: String(a['hostname'] ?? a['name'] ?? ''),
      fqdn: (a['fqdn'] as string) || undefined,
      osName: osNotes || 'Unknown',
      osVersion: '',
      osType: detectOsType(osNotes, String(a['configuration-type-name'] ?? '')),
      lastSeen: a['updated-at'] ? new Date(String(a['updated-at'])) : new Date(),
      status: a['archived'] === true ? 'offline' : 'unknown',
      ipAddresses: a['primary-ip'] ? [String(a['primary-ip'])] : [],
      macAddresses: a['mac-address'] ? [String(a['mac-address'])] : [],
      manufacturer: (a['manufacturer-name'] as string) || undefined,
      model: (a['model-name'] as string) || undefined,
      serialNumber: (a['serial-number'] as string) || undefined,
      assignedUser: (a['contact-name'] as string) || (a['installed-by'] as string) || undefined,
      clientExternalId: a['organization-id'] ? String(a['organization-id']) : undefined,
      siteExternalId: a['location-id'] ? String(a['location-id']) : undefined,
      tags: [],
      patchStatus: 'unknown',
      antivirusStatus: 'unknown',
      rawData: a as Record<string, unknown>,
    };
  }

  private mapDocument(r: JsonApiResource): NormalizedDocument {
    return {
      externalId: String(r.id),
      title: String(r.attributes['name'] ?? r.attributes['title'] ?? 'Untitled'),
      content: String(r.attributes['content'] ?? ''),
      updatedAt: r.attributes['updated-at']
        ? new Date(String(r.attributes['updated-at']))
        : new Date(),
    };
  }

  private mapFlexibleAsset(r: JsonApiResource): NormalizedFlexibleAsset {
    const a = r.attributes;
    return {
      externalId: String(r.id),
      connectorId: this.config?.connectorId ?? this.id,
      name: String(a['name'] ?? ''),
      typeName: String(a['flexible-asset-type-name'] ?? ''),
      typeId: a['flexible-asset-type-id'] ? String(a['flexible-asset-type-id']) : '',
      organizationId: a['organization-id'] ? String(a['organization-id']) : '',
      organizationName: String(a['organization-name'] ?? ''),
      traits: (a['traits'] as Record<string, unknown>) ?? {},
      createdAt: a['created-at'] ? new Date(String(a['created-at'])) : new Date(),
      updatedAt: a['updated-at'] ? new Date(String(a['updated-at'])) : new Date(),
      archived: a['archived'] === true,
      rawData: a as Record<string, unknown>,
    };
  }

  private mapPasswordMeta(r: JsonApiResource): NormalizedPasswordMeta {
    const a = r.attributes;

    // Sanitize raw data — scrub any password-related fields that may leak through
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(a)) {
      if (
        key === 'password' ||
        key === 'password-value' ||
        key === 'otp-secret' ||
        key === 'cached-resource-password'
      ) {
        continue; // NEVER include actual credential values
      }
      sanitized[key] = value;
    }

    return {
      externalId: String(r.id),
      connectorId: this.config?.connectorId ?? this.id,
      name: String(a['name'] ?? ''),
      username: (a['username'] as string) || undefined,
      url: (a['url'] as string) || undefined,
      categoryName: (a['password-category-name'] as string) || undefined,
      organizationId: a['organization-id'] ? String(a['organization-id']) : '',
      resourceId: a['resource-id'] ? String(a['resource-id']) : undefined,
      resourceType: (a['resource-type'] as string) || undefined,
      createdAt: a['created-at'] ? new Date(String(a['created-at'])) : new Date(),
      updatedAt: a['updated-at'] ? new Date(String(a['updated-at'])) : new Date(),
      archived: a['archived'] === true,
      sensitive: true,
      rawData: sanitized,
    };
  }

  // ─── Pagination Helper ───────────────────────────────────────────

  /**
   * Fetch all pages of a paginated IT Glue endpoint.
   * Uses page[number] + page[size] with the maximum allowed page size.
   * Stops at MAX_PAGINATION_PAGES as a safety cap.
   */
  private async fetchAllPages(
    path: string,
    extraParams: Record<string, string> = {},
  ): Promise<JsonApiResource[]> {
    const all: JsonApiResource[] = [];
    let currentPage = 1;

    while (currentPage <= MAX_PAGINATION_PAGES) {
      const params: Record<string, string> = {
        ...extraParams,
        'page[number]': String(currentPage),
        'page[size]': String(MAX_PAGE_SIZE),
      };

      const resp = (await this.apiRequest('GET', path, params)) as JsonApiResponse;
      const resources = extractArray(resp);
      all.push(...resources);

      const meta = resp.meta;
      if (meta?.['next-page'] != null && meta['next-page'] > currentPage) {
        currentPage = meta['next-page'];
      } else {
        break;
      }
    }

    return all;
  }

  // ─── HTTP Transport ──────────────────────────────────────────────

  /**
   * Core API request method with rate limiting, retry, and error handling.
   *
   * Rate limiting: Token bucket at 10 req/sec.
   * Retry: Up to 3 attempts for 429 (rate limit) and 5xx (server errors).
   * Backoff: Exponential — 1s, 2s, 4s. Honors Retry-After header on 429.
   */
  private async apiRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    params: Record<string, string> = {},
    body?: unknown,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      'x-api-key': this.apiKey,
    };

    const requestInit: RequestInit = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH')) {
      requestInit.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      // Acquire rate limiter token before each attempt
      await this.rateLimiter.acquire();

      try {
        const resp = await fetch(url.toString(), requestInit);

        // 429 Too Many Requests — back off and retry
        if (resp.status === 429) {
          const retryAfter = parseInt(resp.headers.get('Retry-After') ?? '2', 10);
          const backoffMs = Math.max(retryAfter * 1000, (attempt + 1) * 1000);
          await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        // 5xx Server Errors — retry with exponential backoff
        if (resp.status >= 500) {
          const responseBody = await resp.text().catch(() => '');
          lastError = new ITGlueApiError(
            `IT Glue server error: ${resp.status} ${resp.statusText}`,
            resp.status,
            responseBody,
            true,
          );
          if (attempt < MAX_RETRY_ATTEMPTS - 1) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw lastError;
        }

        // 401/403 Auth errors — not retryable
        if (resp.status === 401 || resp.status === 403) {
          this.authenticated = false;
          const responseBody = await resp.text().catch(() => '');
          throw new ITGlueApiError(
            `IT Glue authentication error: ${resp.status}`,
            resp.status,
            responseBody,
            false,
          );
        }

        // 404 Not Found — not retryable
        if (resp.status === 404) {
          const responseBody = await resp.text().catch(() => '');
          throw new ITGlueApiError(
            `IT Glue resource not found: ${method} ${path}`,
            404,
            responseBody,
            false,
          );
        }

        // Other 4xx client errors — not retryable
        if (!resp.ok) {
          const responseBody = await resp.text().catch(() => '');
          throw new ITGlueApiError(
            `IT Glue API error: ${resp.status} ${resp.statusText}`,
            resp.status,
            responseBody,
            false,
          );
        }

        // 204 No Content
        if (resp.status === 204) {
          return { data: [] };
        }

        return await resp.json();
      } catch (err) {
        if (err instanceof ITGlueApiError && !err.retryable) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    this.lastErrorAt = new Date();
    throw lastError ?? new Error(`IT Glue request failed after ${MAX_RETRY_ATTEMPTS} attempts`);
  }
}

// ─── Utility Functions ──────────────────────────────────────────────

function extractArray(resp: JsonApiResponse): JsonApiResource[] {
  if (!resp || !resp.data) return [];
  return Array.isArray(resp.data) ? resp.data : [resp.data];
}

function extractSingle(resp: JsonApiResponse): JsonApiResource {
  if (!resp || !resp.data) {
    throw new ITGlueApiError('Empty response — no data field', 0, '', false);
  }
  const resource = Array.isArray(resp.data) ? resp.data[0] : resp.data;
  if (!resource) {
    throw new ITGlueApiError('Resource not found in response', 404, '', false);
  }
  return resource;
}

function clampPageSize(size?: number): number {
  if (!size || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(size, MAX_PAGE_SIZE);
}

function detectOsType(
  osNotes: string,
  configTypeName: string,
): NormalizedDevice['osType'] {
  const combined = `${osNotes} ${configTypeName}`.toLowerCase();
  if (combined.includes('windows') || combined.includes('win server')) return 'windows';
  if (combined.includes('macos') || combined.includes('mac os') || combined.includes('darwin') || combined.includes('apple'))
    return 'macos';
  if (
    combined.includes('linux') ||
    combined.includes('ubuntu') ||
    combined.includes('centos') ||
    combined.includes('debian') ||
    combined.includes('rhel') ||
    combined.includes('red hat')
  )
    return 'linux';
  if (combined.includes('ios') || combined.includes('iphone') || combined.includes('ipad'))
    return 'ios';
  if (combined.includes('android')) return 'android';
  if (
    combined.includes('switch') ||
    combined.includes('router') ||
    combined.includes('firewall') ||
    combined.includes('access point') ||
    combined.includes('cisco') ||
    combined.includes('juniper') ||
    combined.includes('meraki') ||
    combined.includes('fortinet') ||
    combined.includes('palo alto')
  )
    return 'network';
  return 'other';
}

export default ItGlueConnector;
