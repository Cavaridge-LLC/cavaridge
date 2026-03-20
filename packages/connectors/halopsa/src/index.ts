/**
 * @cavaridge/connector-halopsa — HaloPSA PSA Connector
 *
 * Phase 1 integration. Implements IPsaConnector.
 *
 * Auth: OAuth 2.0 Client Credentials or Authorization Code
 * Base URL: https://{tenant}.halopsa.com/api
 * Webhooks: Via automation rules (HTTP POST actions)
 * Key entities: Tickets, Actions, Clients, Contracts, Timesheets, Invoices, Assets
 */
import type {
  IPsaConnector, ConnectorConfig, ConnectorHealth, AuthResult,
  SyncResult, WebhookRegistration, WebhookEvent,
  NormalizedTicket, NormalizedTimeEntry, NormalizedContract,
  PaginatedResult,
} from '@cavaridge/connector-core';

const CONNECTOR_ID = 'halopsa';
const CONNECTOR_NAME = 'HaloPSA';
const CONNECTOR_VERSION = '0.1.0';

export class HaloPsaConnector implements IPsaConnector {
  readonly id = CONNECTOR_ID;
  readonly name = CONNECTOR_NAME;
  readonly type = 'psa' as const;
  readonly version = CONNECTOR_VERSION;
  readonly platformVersion = 'v1';

  private config: ConnectorConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private baseUrl = '';

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    this.baseUrl = config.baseUrl ?? `https://${config.settings.tenantUrl ?? 'app'}.halopsa.com`;
    await this.authenticate();
  }

  async healthCheck(): Promise<ConnectorHealth> {
    try {
      await this.apiGet('/api/Ticket?count=1&pageinate=true&page_size=1');
      return {
        connectorId: this.id,
        status: 'healthy',
        lastSyncAt: null,
        lastErrorAt: null,
        syncLagSeconds: 0,
        recordsSynced: 0,
        errorRate: 0,
        details: {},
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
      const authUrl = `${this.baseUrl}/auth/token`;
      const body: Record<string, string> = {
        grant_type: 'client_credentials',
        client_id: this.config.credentials.clientId,
        client_secret: this.config.credentials.clientSecret,
        scope: 'all',
      };

      // Support authorization_code flow
      if (this.config.settings.authMode === 'authorization_code' && this.config.credentials.refreshToken) {
        body.grant_type = 'refresh_token';
        body.refresh_token = this.config.credentials.refreshToken;
      }

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return { authenticated: false, error: `Auth failed: ${response.status} — ${errBody}` };
      }

      const data = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };
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
    let recordsProcessed = 0;
    let recordsCreated = 0;
    const errors: Array<{ recordId?: string; message: string; code?: string; retryable: boolean }> = [];

    try {
      switch (entityType) {
        case 'tickets': {
          const result = await this.listTickets({ page_size: 1000 });
          recordsProcessed = result.total;
          recordsCreated = result.data.length;
          break;
        }
        case 'clients': {
          const result = await this.listClients({ page_size: 1000 });
          recordsProcessed = result.total;
          recordsCreated = result.data.length;
          break;
        }
        case 'contracts': {
          const result = await this.listContracts({ page_size: 1000 });
          recordsProcessed = result.total;
          recordsCreated = result.data.length;
          break;
        }
        case 'time_entries': {
          const result = await this.listTimeEntries({ page_size: 1000 });
          recordsProcessed = result.total;
          recordsCreated = result.data.length;
          break;
        }
        default:
          errors.push({ message: `Unknown entity type: ${entityType}`, retryable: false });
      }
    } catch (err) {
      errors.push({ message: String(err), retryable: true });
    }

    return {
      mode: 'full_sync',
      entityType,
      recordsProcessed,
      recordsCreated,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors,
      cursor: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  async incrementalSync(entityType: string, cursor: string): Promise<SyncResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsUpdated = 0;
    const errors: Array<{ recordId?: string; message: string; code?: string; retryable: boolean }> = [];

    try {
      // HaloPSA supports lastUpdate datetime filter
      const filters: Record<string, unknown> = { lastUpdate: cursor };

      switch (entityType) {
        case 'tickets': {
          const result = await this.listTickets(filters);
          recordsProcessed = result.data.length;
          recordsUpdated = result.data.length;
          break;
        }
        case 'clients': {
          const result = await this.listClients(filters);
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

    return {
      mode: 'incremental_sync',
      entityType,
      recordsProcessed,
      recordsCreated: 0,
      recordsUpdated,
      recordsDeleted: 0,
      errors,
      cursor: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  async getLastSyncCursor(_entityType: string): Promise<string | null> {
    // Read from connector_sync_logs in production
    return null;
  }

  // ─── Webhooks ────────────────────────────────────────────────────

  supportsWebhooks(): boolean { return true; }

  async registerWebhook(eventType: string, callbackUrl: string): Promise<WebhookRegistration> {
    // HaloPSA webhooks are configured via Automation Rules in the UI
    // or via /api/AutomationRule endpoint
    return {
      id: `halopsa-webhook-${eventType}`,
      eventType,
      callbackUrl,
      createdAt: new Date(),
    };
  }

  async handleWebhookPayload(headers: Record<string, string>, body: unknown): Promise<WebhookEvent> {
    const payload = body as Record<string, unknown>;
    return {
      connectorId: this.id,
      eventType: (payload.event_type as string) ?? 'ticket.updated',
      externalId: String(payload.id ?? ''),
      payload,
      receivedAt: new Date(),
    };
  }

  validateWebhookSignature(headers: Record<string, string>, body: string): boolean {
    // HaloPSA webhook validation via shared secret
    const expectedSecret = this.config?.credentials.webhookSecret;
    if (!expectedSecret) return true; // No secret configured, accept all

    const receivedSignature = headers['x-halo-signature'] ?? headers['x-webhook-signature'];
    if (!receivedSignature) return false;

    // HMAC-SHA256 validation
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', expectedSecret).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expected));
  }

  // ─── PSA-Specific: Tickets ────────────────────────────────────────

  async listTickets(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedTicket>> {
    const params = new URLSearchParams();
    params.set('pageinate', 'true');
    params.set('page_size', String(filters?.page_size ?? 50));
    params.set('page_no', String(filters?.page ?? 1));

    if (filters?.status) params.set('status_id', String(filters.status));
    if (filters?.lastUpdate) params.set('lastUpdate', String(filters.lastUpdate));
    if (filters?.client_id) params.set('client_id', String(filters.client_id));

    const response = await this.apiGet(`/api/Ticket?${params}`);
    const tickets = response.tickets ?? [];
    const recordCount = response.record_count ?? tickets.length;

    return {
      data: tickets.map((t: any) => this.normalizeTicket(t)),
      total: recordCount,
      page: parseInt(String(filters?.page ?? 1)),
      pageSize: parseInt(String(filters?.page_size ?? 50)),
      hasMore: tickets.length === parseInt(String(filters?.page_size ?? 50)),
    };
  }

  async getTicket(externalId: string): Promise<NormalizedTicket> {
    const response = await this.apiGet(`/api/Ticket/${externalId}`);
    return this.normalizeTicket(response);
  }

  async createTicket(ticket: Record<string, unknown>): Promise<NormalizedTicket> {
    const payload = {
      summary: ticket.subject ?? ticket.summary,
      details: ticket.description ?? ticket.details,
      client_id: ticket.clientId ?? ticket.client_id,
      tickettype_id: ticket.typeId ?? 1,
      priority_id: this.mapPriorityToHalo(ticket.priority as string),
      category_1: ticket.category,
    };

    const response = await this.apiPost('/api/Ticket', [payload]);
    return this.normalizeTicket(Array.isArray(response) ? response[0] : response);
  }

  async updateTicket(externalId: string, updates: Record<string, unknown>): Promise<NormalizedTicket> {
    const payload: Record<string, unknown> = { id: parseInt(externalId) };

    if (updates.subject) payload.summary = updates.subject;
    if (updates.description) payload.details = updates.description;
    if (updates.priority) payload.priority_id = this.mapPriorityToHalo(updates.priority as string);
    if (updates.status) payload.status_id = this.mapStatusToHalo(updates.status as string);
    if (updates.assignedTo) payload.agent_id = updates.assignedTo;

    const response = await this.apiPost('/api/Ticket', [payload]);
    return this.normalizeTicket(Array.isArray(response) ? response[0] : response);
  }

  // ─── PSA-Specific: Time Entries ───────────────────────────────────

  async listTimeEntries(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedTimeEntry>> {
    const params = new URLSearchParams();
    params.set('pageinate', 'true');
    params.set('page_size', String(filters?.page_size ?? 50));
    params.set('page_no', String(filters?.page ?? 1));

    if (filters?.ticket_id) params.set('ticket_id', String(filters.ticket_id));
    if (filters?.agent_id) params.set('agent_id', String(filters.agent_id));

    const response = await this.apiGet(`/api/Timesheet?${params}`);
    const entries = response.timesheets ?? [];

    return {
      data: entries.map((e: any) => this.normalizeTimeEntry(e)),
      total: response.record_count ?? entries.length,
      page: parseInt(String(filters?.page ?? 1)),
      pageSize: parseInt(String(filters?.page_size ?? 50)),
      hasMore: entries.length === parseInt(String(filters?.page_size ?? 50)),
    };
  }

  async createTimeEntry(entry: Record<string, unknown>): Promise<NormalizedTimeEntry> {
    const payload = {
      ticket_id: entry.ticketId ?? entry.ticket_id,
      agent_id: entry.userId ?? entry.agent_id,
      start_date: entry.startTime ?? entry.start_date,
      end_date: entry.endTime ?? entry.end_date,
      hours: entry.durationMins ? (entry.durationMins as number) / 60 : entry.hours,
      note: entry.notes ?? entry.note,
      charge_rate: entry.rateOverride ?? entry.charge_rate,
      billable: entry.billable ?? true,
    };

    const response = await this.apiPost('/api/Timesheet', [payload]);
    return this.normalizeTimeEntry(Array.isArray(response) ? response[0] : response);
  }

  // ─── PSA-Specific: Contracts ──────────────────────────────────────

  async listContracts(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedContract>> {
    const params = new URLSearchParams();
    params.set('pageinate', 'true');
    params.set('page_size', String(filters?.page_size ?? 50));

    if (filters?.client_id) params.set('client_id', String(filters.client_id));

    const response = await this.apiGet(`/api/ClientContract?${params}`);
    const contracts = response.contracts ?? (Array.isArray(response) ? response : []);

    return {
      data: contracts.map((c: any) => this.normalizeContract(c)),
      total: response.record_count ?? contracts.length,
      page: 1,
      pageSize: parseInt(String(filters?.page_size ?? 50)),
      hasMore: false,
    };
  }

  async getContract(externalId: string): Promise<NormalizedContract> {
    const response = await this.apiGet(`/api/ClientContract/${externalId}`);
    return this.normalizeContract(response);
  }

  // ─── Clients (bonus — HaloPSA exposes clients) ───────────────────

  async listClients(filters?: Record<string, unknown>): Promise<PaginatedResult<any>> {
    const params = new URLSearchParams();
    params.set('pageinate', 'true');
    params.set('page_size', String(filters?.page_size ?? 50));

    if (filters?.lastUpdate) params.set('lastUpdate', String(filters.lastUpdate));

    const response = await this.apiGet(`/api/Client?${params}`);
    const clients = response.clients ?? [];

    return {
      data: clients.map((c: any) => ({
        externalId: String(c.id),
        connectorId: this.id,
        name: c.name,
        email: c.main_email,
        phone: c.main_phone,
        address: c.address,
        isActive: !c.inactive,
        rawData: c,
      })),
      total: response.record_count ?? clients.length,
      page: 1,
      pageSize: parseInt(String(filters?.page_size ?? 50)),
      hasMore: false,
    };
  }

  // ─── Normalizers ─────────────────────────────────────────────────

  private normalizeTicket(raw: any): NormalizedTicket {
    return {
      externalId: String(raw.id ?? ''),
      connectorId: this.id,
      subject: raw.summary ?? '',
      description: raw.details ?? raw.details_html ?? '',
      status: this.mapHaloStatus(raw.status_id, raw.status_name),
      priority: this.mapHaloPriority(raw.priority_id, raw.priority_name),
      category: raw.category_1 ?? undefined,
      assignedTo: raw.agent_id ? String(raw.agent_id) : undefined,
      requestedBy: raw.user_id ? String(raw.user_id) : raw.user_name,
      createdAt: raw.dateoccurred ? new Date(raw.dateoccurred) : new Date(),
      updatedAt: raw.lastupdate ? new Date(raw.lastupdate) : new Date(),
      resolvedAt: raw.dateclosed ? new Date(raw.dateclosed) : undefined,
      rawData: raw,
    };
  }

  private normalizeTimeEntry(raw: any): NormalizedTimeEntry {
    return {
      externalId: String(raw.id ?? ''),
      connectorId: this.id,
      ticketExternalId: raw.ticket_id ? String(raw.ticket_id) : undefined,
      userId: String(raw.agent_id ?? ''),
      startTime: raw.start_date ? new Date(raw.start_date) : new Date(),
      endTime: raw.end_date ? new Date(raw.end_date) : undefined,
      durationMins: raw.hours ? Math.round(raw.hours * 60) : 0,
      billable: raw.billable ?? true,
      notes: raw.note ?? raw.notes,
      rawData: raw,
    };
  }

  private normalizeContract(raw: any): NormalizedContract {
    return {
      externalId: String(raw.id ?? ''),
      connectorId: this.id,
      clientExternalId: String(raw.client_id ?? ''),
      name: raw.ref ?? raw.name ?? '',
      type: raw.type_name ?? 'managed',
      status: raw.inactive ? 'expired' : 'active',
      startDate: raw.start_date ? new Date(raw.start_date) : new Date(),
      endDate: raw.end_date ? new Date(raw.end_date) : undefined,
      monthlyAmount: raw.standing_charge ?? undefined,
      rawData: raw,
    };
  }

  // ─── Mapping Helpers ─────────────────────────────────────────────

  private mapHaloStatus(statusId: number | undefined, statusName?: string): string {
    if (statusName) {
      const lower = statusName.toLowerCase();
      if (lower.includes('new')) return 'new';
      if (lower.includes('open') || lower.includes('in progress')) return 'open';
      if (lower.includes('pending') || lower.includes('waiting')) return 'pending';
      if (lower.includes('hold')) return 'on_hold';
      if (lower.includes('resolved') || lower.includes('fixed')) return 'resolved';
      if (lower.includes('closed')) return 'closed';
      if (lower.includes('cancel')) return 'cancelled';
    }
    // Default status mapping by common HaloPSA status IDs
    switch (statusId) {
      case 1: return 'new';
      case 2: return 'open';
      case 3: return 'pending';
      case 4: return 'on_hold';
      case 5: return 'resolved';
      case 6: return 'closed';
      default: return 'open';
    }
  }

  private mapHaloPriority(priorityId: number | undefined, priorityName?: string): string {
    if (priorityName) {
      const lower = priorityName.toLowerCase();
      if (lower.includes('critical') || lower.includes('emergency')) return 'critical';
      if (lower.includes('high') || lower.includes('urgent')) return 'high';
      if (lower.includes('medium') || lower.includes('normal')) return 'medium';
      if (lower.includes('low')) return 'low';
    }
    switch (priorityId) {
      case 1: return 'critical';
      case 2: return 'high';
      case 3: return 'medium';
      case 4: return 'low';
      default: return 'medium';
    }
  }

  private mapPriorityToHalo(priority: string | undefined): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 4;
      default: return 3;
    }
  }

  private mapStatusToHalo(status: string | undefined): number {
    switch (status) {
      case 'new': return 1;
      case 'open': return 2;
      case 'pending': return 3;
      case 'on_hold': return 4;
      case 'resolved': return 5;
      case 'closed': return 6;
      default: return 2;
    }
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
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '30', 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.apiGet(path);
    }

    if (!response.ok) {
      throw new Error(`HaloPSA API error: ${response.status} ${response.statusText}`);
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
      throw new Error(`HaloPSA API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export default HaloPsaConnector;
