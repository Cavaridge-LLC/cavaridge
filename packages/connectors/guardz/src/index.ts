/**
 * @cavaridge/connector-guardz — Guardz Security Connector
 *
 * Phase 2 integration. Implements ISecurityConnector.
 *
 * Auth: API key via x-api-key header (partner program)
 * Base URL: https://api.guardz.com/v1
 * Rate limits: 60 req/min
 * Webhooks: Real-time alerts via notification config
 * Key entities: Clients, Users, Issues (threats), Posture Scores, Scan Results, Policies
 *
 * Guardz API uses JSON responses with { data, meta } wrapper pattern.
 * Pagination: cursor-based (next_cursor in meta).
 */
import type {
  ISecurityConnector, ConnectorConfig, ConnectorHealth, AuthResult,
  SyncResult, NormalizedThreat, PostureScore, ComplianceStatus,
  PaginatedResult, ThreatFilters,
} from '@cavaridge/connector-core';

// Minimal Node.js type declarations for environments where @types/node isn't available
declare function require(id: string): any;
declare const Buffer: { from(s: string, enc?: string): Uint8Array };

const CONNECTOR_ID = 'guardz';
const CONNECTOR_NAME = 'Guardz';
const CONNECTOR_VERSION = '0.2.0';
const PLATFORM_VERSION = 'v1';
const DEFAULT_BASE_URL = 'https://api.guardz.com/v1';
const RATE_LIMIT_PER_MIN = 60;
const PAGE_SIZE = 50;

// ─── Guardz API Types ────────────────────────────────────────────────

interface GuardzClient {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  user_count: number;
  device_count: number;
  posture_score: number;
  posture_grade: string;
  created_at: string;
  updated_at: string;
}

interface GuardzUser {
  id: string;
  client_id: string;
  email: string;
  display_name: string;
  role: string;
  status: 'active' | 'inactive' | 'compromised';
  mfa_enabled: boolean;
  last_login_at: string | null;
  risk_score: number;
  created_at: string;
}

interface GuardzIssue {
  id: string;
  client_id: string;
  user_id: string | null;
  device_id: string | null;
  type: 'phishing' | 'malware' | 'data_leak' | 'dark_web' | 'misconfiguration' | 'vulnerability' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  recommendation: string;
  affected_entity: string;
  detected_at: string;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
}

interface GuardzPosture {
  client_id: string;
  overall_score: number;
  grade: string;
  categories: Array<{
    name: string;
    score: number;
    weight: number;
    issues_count: number;
    status: 'good' | 'warning' | 'critical';
  }>;
  trend: Array<{ date: string; score: number }>;
  last_assessed_at: string;
}

interface GuardzPolicy {
  id: string;
  client_id: string;
  name: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  compliance_framework: string | null;
}

interface GuardzApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    page_size?: number;
    next_cursor?: string | null;
  };
}

interface GuardzApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ─── Connector Implementation ────────────────────────────────────────

export class GuardzConnector implements ISecurityConnector {
  readonly id = CONNECTOR_ID;
  readonly name = CONNECTOR_NAME;
  readonly type = 'security' as const;
  readonly version = CONNECTOR_VERSION;
  readonly platformVersion = PLATFORM_VERSION;

  private config: ConnectorConfig | null = null;
  private apiKey: string | null = null;
  private baseUrl = DEFAULT_BASE_URL;
  private lastSyncAt: Date | null = null;
  private syncCursors = new Map<string, string>();
  private requestCount = 0;
  private requestWindowStart = Date.now();

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    this.apiKey = config.credentials.apiKey ?? null;
    if (config.baseUrl) this.baseUrl = config.baseUrl;

    if (!this.apiKey) {
      throw new Error('Guardz API key is required. Obtain one from the Guardz partner portal.');
    }

    // Validate connection
    const auth = await this.authenticate();
    if (!auth.authenticated) {
      throw new Error(`Guardz authentication failed: ${auth.error}`);
    }
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const startTime = Date.now();
    try {
      const response = await this.request<{ status: string; version: string }>('GET', '/health');
      return {
        connectorId: this.id,
        status: 'healthy',
        lastSyncAt: this.lastSyncAt,
        lastErrorAt: null,
        syncLagSeconds: this.lastSyncAt ? Math.floor((Date.now() - this.lastSyncAt.getTime()) / 1000) : 0,
        recordsSynced: 0,
        errorRate: 0,
        details: { apiVersion: response.version, responseTimeMs: Date.now() - startTime },
        checkedAt: new Date(),
      };
    } catch (err) {
      return {
        connectorId: this.id,
        status: 'unhealthy',
        lastSyncAt: this.lastSyncAt,
        lastErrorAt: new Date(),
        syncLagSeconds: 0,
        recordsSynced: 0,
        errorRate: 1,
        details: { error: (err as Error).message },
        checkedAt: new Date(),
      };
    }
  }

  async shutdown(): Promise<void> {
    this.apiKey = null;
    this.config = null;
    this.syncCursors.clear();
  }

  // ─── Authentication ────────────────────────────────────────────────

  async authenticate(): Promise<AuthResult> {
    if (!this.apiKey) {
      return { authenticated: false, error: 'No API key configured' };
    }

    try {
      // Test the API key by fetching first page of clients
      await this.request<GuardzApiResponse<GuardzClient[]>>('GET', '/clients', { page_size: '1' });
      return {
        authenticated: true,
      };
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('401') || message.includes('403')) {
        return { authenticated: false, error: 'Invalid or expired API key' };
      }
      return { authenticated: false, error: message };
    }
  }

  async refreshAuth(): Promise<AuthResult> {
    // API key auth doesn't need refresh
    return this.authenticate();
  }

  isAuthenticated(): boolean {
    return !!this.apiKey;
  }

  // ─── Sync Operations ──────────────────────────────────────────────

  async fullSync(entityType: string): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      mode: 'full_sync',
      entityType,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      cursor: null,
      durationMs: 0,
    };

    try {
      switch (entityType) {
        case 'clients': {
          const clients = await this.fetchAllPages<GuardzClient>('/clients');
          result.recordsProcessed = clients.length;
          result.recordsCreated = clients.length;
          break;
        }
        case 'users': {
          const users = await this.fetchAllPages<GuardzUser>('/users');
          result.recordsProcessed = users.length;
          result.recordsCreated = users.length;
          break;
        }
        case 'issues': {
          const issues = await this.fetchAllPages<GuardzIssue>('/issues');
          result.recordsProcessed = issues.length;
          result.recordsCreated = issues.length;
          break;
        }
        case 'policies': {
          const policies = await this.fetchAllPages<GuardzPolicy>('/policies');
          result.recordsProcessed = policies.length;
          result.recordsCreated = policies.length;
          break;
        }
        default:
          result.errors.push({ message: `Unknown entity type: ${entityType}`, retryable: false });
      }
    } catch (err) {
      result.errors.push({ message: (err as Error).message, retryable: true });
    }

    result.durationMs = Date.now() - startTime;
    this.lastSyncAt = new Date();
    return result;
  }

  async incrementalSync(entityType: string, cursor: string): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      mode: 'incremental_sync',
      entityType,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      cursor: null,
      durationMs: 0,
    };

    try {
      const params: Record<string, string> = {
        updated_since: cursor,
        page_size: String(PAGE_SIZE),
      };

      const endpoint = `/${entityType}`;
      const response = await this.request<GuardzApiResponse<unknown[]>>('GET', endpoint, params);
      result.recordsProcessed = response.data.length;
      result.recordsUpdated = response.data.length;
      result.cursor = response.meta?.next_cursor ?? new Date().toISOString();
    } catch (err) {
      result.errors.push({ message: (err as Error).message, retryable: true });
    }

    result.durationMs = Date.now() - startTime;
    this.lastSyncAt = new Date();
    return result;
  }

  async getLastSyncCursor(entityType: string): Promise<string | null> {
    return this.syncCursors.get(entityType) ?? null;
  }

  supportsWebhooks(): boolean {
    return true;
  }

  // ─── Security-Specific: Posture ────────────────────────────────────

  async getPostureScore(clientId: string): Promise<PostureScore> {
    try {
      const response = await this.request<GuardzApiResponse<GuardzPosture>>('GET', `/clients/${clientId}/posture`);
      const posture = response.data;

      return {
        connectorId: this.id,
        clientExternalId: clientId,
        overallScore: posture.overall_score,
        gradeLabel: posture.grade,
        categories: posture.categories.map(c => ({
          name: c.name,
          score: c.score,
          issueCount: c.issues_count,
          criticalCount: c.status === 'critical' ? c.issues_count : 0,
        })),
        lastAssessedAt: new Date(posture.last_assessed_at),
        rawData: { trend: posture.trend },
      };
    } catch (err) {
      return {
        connectorId: this.id,
        clientExternalId: clientId,
        overallScore: 0,
        gradeLabel: 'N/A',
        categories: [],
        lastAssessedAt: new Date(),
        rawData: { error: (err as Error).message },
      };
    }
  }

  async getPostureDetails(clientId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const response = await this.request<GuardzApiResponse<GuardzPosture>>('GET', `/clients/${clientId}/posture`);
      const posture = response.data;

      return posture.categories.map(cat => ({
        category: cat.name,
        score: cat.score,
        weight: cat.weight,
        status: cat.status,
        issueCount: cat.issues_count,
      }));
    } catch {
      return [];
    }
  }

  // ─── Security-Specific: Threats ────────────────────────────────────

  async listThreats(filters?: ThreatFilters): Promise<PaginatedResult<NormalizedThreat>> {
    try {
      const params: Record<string, string> = {
        page_size: String(filters?.pageSize ?? PAGE_SIZE),
      };

      if (filters?.severity) params.severity = filters.severity;
      if (filters?.status) params.status = filters.status;
      if (filters?.clientExternalId) params.client_id = filters.clientExternalId;
      if (filters?.since) params.detected_after = filters.since.toISOString();
      if (filters?.page) params.page = String(filters.page);

      const response = await this.request<GuardzApiResponse<GuardzIssue[]>>('GET', '/issues', params);

      const threats: NormalizedThreat[] = response.data.map(issue => this.normalizeIssue(issue));

      return {
        data: threats,
        total: response.meta?.total ?? threats.length,
        page: response.meta?.page ?? 1,
        pageSize: PAGE_SIZE,
        hasMore: !!response.meta?.next_cursor,
        cursor: response.meta?.next_cursor ?? undefined,
      };
    } catch {
      return { data: [], total: 0, page: 1, pageSize: PAGE_SIZE, hasMore: false };
    }
  }

  async getThreat(externalId: string): Promise<NormalizedThreat> {
    const response = await this.request<GuardzApiResponse<GuardzIssue>>('GET', `/issues/${externalId}`);
    return this.normalizeIssue(response.data);
  }

  async acknowledgeThreat(externalId: string): Promise<void> {
    await this.request('PATCH', `/issues/${externalId}`, undefined, {
      status: 'resolved',
      resolution: 'acknowledged_via_cavaridge',
    });
  }

  // ─── Security-Specific: Compliance ─────────────────────────────────

  async getComplianceStatus(clientId: string, framework?: string): Promise<ComplianceStatus> {
    try {
      const params: Record<string, string> = {};
      if (framework) params.framework = framework;

      const response = await this.request<GuardzApiResponse<{
        framework: string;
        overall_status: string;
        controls_passed: number;
        controls_failed: number;
        controls_total: number;
        last_assessed_at: string;
        details: Record<string, unknown>;
      }>>('GET', `/clients/${clientId}/compliance`, params);

      const data = response.data;
      return {
        connectorId: this.id,
        clientExternalId: clientId,
        framework: data.framework,
        overallStatus: data.overall_status as 'compliant' | 'non_compliant' | 'partial' | 'unknown',
        controlsPassed: data.controls_passed,
        controlsFailed: data.controls_failed,
        controlsTotal: data.controls_total,
        lastAssessedAt: new Date(data.last_assessed_at),
        rawData: data.details,
      };
    } catch {
      return {
        connectorId: this.id,
        clientExternalId: clientId,
        framework: framework ?? 'general',
        overallStatus: 'unknown',
        controlsPassed: 0,
        controlsFailed: 0,
        controlsTotal: 0,
        lastAssessedAt: new Date(),
        rawData: {},
      };
    }
  }

  // ─── Extended Methods ──────────────────────────────────────────────

  async getClients(): Promise<GuardzClient[]> {
    return this.fetchAllPages<GuardzClient>('/clients');
  }

  async getClient(clientId: string): Promise<GuardzClient> {
    const response = await this.request<GuardzApiResponse<GuardzClient>>('GET', `/clients/${clientId}`);
    return response.data;
  }

  async getUsers(clientId?: string): Promise<GuardzUser[]> {
    const params: Record<string, string> = {};
    if (clientId) params.client_id = clientId;
    return this.fetchAllPages<GuardzUser>('/users', params);
  }

  async getDevices(clientId: string): Promise<Array<Record<string, unknown>>> {
    const response = await this.request<GuardzApiResponse<Array<Record<string, unknown>>>>('GET', `/clients/${clientId}/devices`);
    return response.data;
  }

  async getPolicies(clientId?: string): Promise<GuardzPolicy[]> {
    const params: Record<string, string> = {};
    if (clientId) params.client_id = clientId;
    return this.fetchAllPages<GuardzPolicy>('/policies', params);
  }

  async updatePolicy(policyId: string, settings: Record<string, unknown>): Promise<GuardzPolicy> {
    const response = await this.request<GuardzApiResponse<GuardzPolicy>>('PATCH', `/policies/${policyId}`, undefined, { settings });
    return response.data;
  }

  async getScanResults(clientId: string): Promise<Array<Record<string, unknown>>> {
    const response = await this.request<GuardzApiResponse<Array<Record<string, unknown>>>>('GET', `/clients/${clientId}/scans`);
    return response.data;
  }

  async getDarkWebFindings(clientId: string): Promise<Array<Record<string, unknown>>> {
    const response = await this.request<GuardzApiResponse<Array<Record<string, unknown>>>>('GET', `/clients/${clientId}/dark-web`);
    return response.data;
  }

  // ─── Webhook Handling ──────────────────────────────────────────────

  async verifyWebhook(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      // Compute HMAC-SHA256 and compare in constant time
      const { createHmac } = require('crypto') as { createHmac: (alg: string, key: string) => { update(data: string): { digest(enc: string): string } } };
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      // Constant-time comparison via character-by-character XOR
      if (signature.length !== expected.length) return false;
      let diff = 0;
      for (let i = 0; i < signature.length; i++) {
        diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
      }
      return diff === 0;
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: Record<string, unknown>): {
    type: string;
    clientId: string;
    data: Record<string, unknown>;
  } {
    return {
      type: (payload.event_type as string) ?? 'unknown',
      clientId: (payload.client_id as string) ?? '',
      data: payload,
    };
  }

  // ─── HTTP Client ───────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    queryParams?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    await this.enforceRateLimit();

    const url = new URL(`${this.baseUrl}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      'x-api-key': this.apiKey!,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `Cavaridge-Connector/${CONNECTOR_VERSION}`,
    };

    const init: RequestInit = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      init.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url.toString(), init);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5');
          await this.sleep(retryAfter * 1000);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          let errorMessage: string;
          try {
            const parsed = JSON.parse(errorBody) as GuardzApiError;
            errorMessage = parsed.error?.message ?? `HTTP ${response.status}`;
          } catch {
            errorMessage = `HTTP ${response.status}: ${errorBody.substring(0, 200)}`;
          }
          throw new Error(errorMessage);
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err as Error;
        if (attempt < 2 && !(err as Error).message.includes('HTTP 4')) {
          await this.sleep(1000 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  private async fetchAllPages<T>(path: string, baseParams?: Record<string, string>): Promise<T[]> {
    const all: T[] = [];
    let cursor: string | null = null;

    do {
      const params: Record<string, string> = {
        ...baseParams,
        page_size: String(PAGE_SIZE),
      };
      if (cursor) params.cursor = cursor;

      const response = await this.request<GuardzApiResponse<T[]>>('GET', path, params);
      all.push(...response.data);
      cursor = response.meta?.next_cursor ?? null;
    } while (cursor);

    return all;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 60_000;

    if (now - this.requestWindowStart > windowMs) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    this.requestCount++;
    if (this.requestCount >= RATE_LIMIT_PER_MIN) {
      const waitMs = windowMs - (now - this.requestWindowStart) + 100;
      await this.sleep(waitMs);
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }
  }

  private normalizeIssue(issue: GuardzIssue): NormalizedThreat {
    const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'low',
    };
    const statusMap: Record<string, 'active' | 'investigating' | 'contained' | 'remediated' | 'false_positive'> = {
      open: 'active', in_progress: 'investigating', resolved: 'remediated', dismissed: 'false_positive',
    };
    const typeMap: Record<string, NormalizedThreat['threatType']> = {
      phishing: 'phishing', malware: 'malware', data_leak: 'data_leak',
      dark_web: 'identity', misconfiguration: 'policy_violation',
      vulnerability: 'vulnerability', compliance: 'policy_violation',
    };

    return {
      externalId: issue.id,
      connectorId: this.id,
      threatType: typeMap[issue.type] ?? 'other',
      severity: severityMap[issue.severity] ?? 'medium',
      status: statusMap[issue.status] ?? 'active',
      title: issue.title,
      description: issue.description,
      affectedEntities: [{
        type: issue.device_id ? 'device' : issue.user_id ? 'user' : 'organization',
        id: issue.device_id ?? issue.user_id ?? issue.client_id,
        name: issue.affected_entity,
      }],
      detectedAt: new Date(issue.detected_at),
      recommendedActions: [issue.recommendation],
      rawData: issue.metadata,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GuardzConnector;
