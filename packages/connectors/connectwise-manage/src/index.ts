/**
 * @cavaridge/connector-connectwise-manage — ConnectWise Manage PSA Connector
 *
 * Phase 1 integration. Implements IPsaConnector.
 *
 * Auth: Basic auth with companyId+publicKey:privateKey, clientId header
 * Base URL: https://na.myconnectwise.net/v4_6_release/apis/3.0 (configurable)
 * Rate limits: Respect 429 + Retry-After header
 * Pagination: page + pageSize params
 */
import type {
  IPsaConnector, ConnectorConfig, ConnectorHealth, AuthResult,
  SyncResult, SyncError, NormalizedTicket, NormalizedTimeEntry,
  NormalizedContract, PaginatedResult,
} from '@cavaridge/connector-core';

declare function require(id: string): any;
declare const Buffer: { from(s: string, enc?: string): { toString(enc: string): string } };

const CONNECTOR_ID = 'connectwise-manage';
const CONNECTOR_VERSION = '0.2.0';
const DEFAULT_BASE_URL = 'https://na.myconnectwise.net/v4_6_release/apis/3.0';
const PAGE_SIZE = 100;

// ─── CW Manage API Types ─────────────────────────────────────────────

interface CwTicket {
  id: number;
  summary: string;
  recordType: string;
  board: { id: number; name: string };
  status: { id: number; name: string };
  priority: { id: number; name: string };
  company: { id: number; identifier: string; name: string };
  contact?: { id: number; name: string };
  assignedTo?: { id: number; identifier: string; name: string };
  owner?: { id: number; identifier: string; name: string };
  dateEntered: string;
  closedDate?: string;
  lastUpdated: string;
  closedFlag: boolean;
  severity: string;
  impact: string;
  _info: { lastUpdated: string };
}

interface CwCompany {
  id: number;
  identifier: string;
  name: string;
  status: { id: number; name: string };
  types: Array<{ id: number; name: string }>;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  phoneNumber?: string;
  website?: string;
  dateAcquired: string;
  _info: { lastUpdated: string };
}

interface CwContact {
  id: number;
  firstName: string;
  lastName: string;
  company: { id: number; name: string };
  communicationItems: Array<{ type: { name: string }; value: string; defaultFlag: boolean }>;
  title?: string;
  inactiveFlag: boolean;
}

interface CwTimeEntry {
  id: number;
  chargeToId: number;
  chargeToType: string;
  member: { identifier: string; name: string };
  timeStart: string;
  timeEnd: string;
  actualHours: number;
  billableOption: string;
  notes: string;
  _info: { lastUpdated: string };
}

interface CwBoard {
  id: number;
  name: string;
  location: { id: number; name: string };
  department: { id: number; name: string };
  projectFlag: boolean;
}

interface CwStatus {
  id: number;
  name: string;
  boardId: number;
  sortOrder: number;
  closedStatus: boolean;
}

interface CwApiError {
  code: string;
  message: string;
  errors?: Array<{ code: string; message: string; resource: string; field: string }>;
}

// ─── Connector ───────────────────────────────────────────────────────

export class ConnectWiseManageConnector implements IPsaConnector {
  readonly id = CONNECTOR_ID;
  readonly name = 'ConnectWise Manage';
  readonly type = 'psa' as const;
  readonly version = CONNECTOR_VERSION;
  readonly platformVersion = 'v3.0';

  private config: ConnectorConfig | null = null;
  private baseUrl = DEFAULT_BASE_URL;
  private authHeader = '';
  private clientId = '';
  private lastSyncAt: Date | null = null;
  private requestCount = 0;
  private requestWindowStart = Date.now();

  // ─── Lifecycle ───────────────────────────────────────────────────

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config;
    if (config.baseUrl) this.baseUrl = config.baseUrl;

    const { companyId, publicKey, privateKey, clientId } = config.credentials;
    if (!companyId || !publicKey || !privateKey || !clientId) {
      throw new Error('ConnectWise Manage requires companyId, publicKey, privateKey, and clientId');
    }

    this.clientId = clientId as string;
    const raw = `${companyId}+${publicKey}:${privateKey}`;
    this.authHeader = 'Basic ' + Buffer.from(raw, 'utf8').toString('base64');

    const auth = await this.authenticate();
    if (!auth.authenticated) {
      throw new Error(`ConnectWise auth failed: ${auth.error}`);
    }
  }

  async healthCheck(): Promise<ConnectorHealth> {
    try {
      await this.request<{ version: string }>('GET', '/system/info');
      return {
        connectorId: this.id, status: 'healthy', lastSyncAt: this.lastSyncAt,
        lastErrorAt: null, syncLagSeconds: 0, recordsSynced: 0, errorRate: 0,
        details: {}, checkedAt: new Date(),
      };
    } catch (err) {
      return {
        connectorId: this.id, status: 'unhealthy', lastSyncAt: this.lastSyncAt,
        lastErrorAt: new Date(), syncLagSeconds: 0, recordsSynced: 0, errorRate: 1,
        details: { error: (err as Error).message }, checkedAt: new Date(),
      };
    }
  }

  async shutdown(): Promise<void> {
    this.config = null;
    this.authHeader = '';
  }

  async authenticate(): Promise<AuthResult> {
    try {
      await this.request<{ version: string }>('GET', '/system/info');
      return { authenticated: true };
    } catch (err) {
      return { authenticated: false, error: (err as Error).message };
    }
  }

  async refreshAuth(): Promise<AuthResult> { return this.authenticate(); }
  isAuthenticated(): boolean { return !!this.authHeader; }

  // ─── Sync ──────────────────────────────────────────────────────────

  async fullSync(entityType: string): Promise<SyncResult> {
    const start = Date.now();
    const result: SyncResult = {
      mode: 'full_sync', entityType, recordsProcessed: 0, recordsCreated: 0,
      recordsUpdated: 0, recordsDeleted: 0, errors: [], cursor: null, durationMs: 0,
    };

    try {
      switch (entityType) {
        case 'tickets': {
          const tickets = await this.fetchAllPages<CwTicket>('/service/tickets');
          result.recordsProcessed = tickets.length;
          result.recordsCreated = tickets.length;
          break;
        }
        case 'companies': {
          const companies = await this.fetchAllPages<CwCompany>('/company/companies');
          result.recordsProcessed = companies.length;
          result.recordsCreated = companies.length;
          break;
        }
        case 'contacts': {
          const contacts = await this.fetchAllPages<CwContact>('/company/contacts');
          result.recordsProcessed = contacts.length;
          result.recordsCreated = contacts.length;
          break;
        }
        default:
          result.errors.push({ message: `Unknown entity: ${entityType}`, retryable: false });
      }
    } catch (err) {
      result.errors.push({ message: (err as Error).message, retryable: true });
    }

    result.durationMs = Date.now() - start;
    this.lastSyncAt = new Date();
    return result;
  }

  async incrementalSync(entityType: string, cursor: string): Promise<SyncResult> {
    const start = Date.now();
    const result: SyncResult = {
      mode: 'incremental_sync', entityType, recordsProcessed: 0, recordsCreated: 0,
      recordsUpdated: 0, recordsDeleted: 0, errors: [], cursor: null, durationMs: 0,
    };

    try {
      const conditions = `lastUpdated > [${cursor}]`;
      const endpoint = entityType === 'tickets' ? '/service/tickets' :
        entityType === 'companies' ? '/company/companies' : `/company/${entityType}`;

      const items = await this.fetchAllPages(endpoint, { conditions });
      result.recordsProcessed = items.length;
      result.recordsUpdated = items.length;
      result.cursor = new Date().toISOString();
    } catch (err) {
      result.errors.push({ message: (err as Error).message, retryable: true });
    }

    result.durationMs = Date.now() - start;
    this.lastSyncAt = new Date();
    return result;
  }

  async getLastSyncCursor(_entityType: string): Promise<string | null> { return null; }
  supportsWebhooks(): boolean { return true; }

  // ─── PSA: Tickets ──────────────────────────────────────────────────

  async listTickets(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedTicket>> {
    const params: Record<string, string> = { pageSize: String(PAGE_SIZE) };
    if (filters?.page) params.page = String(filters.page);
    if (filters?.conditions) params.conditions = String(filters.conditions);
    if (filters?.boardId) params.conditions = `board/id=${filters.boardId}`;

    const tickets = await this.request<CwTicket[]>('GET', '/service/tickets', params);
    return {
      data: tickets.map(t => this.normalizeTicket(t)),
      total: tickets.length,
      page: parseInt(params.page ?? '1'),
      pageSize: PAGE_SIZE,
      hasMore: tickets.length === PAGE_SIZE,
    };
  }

  async getTicket(externalId: string): Promise<NormalizedTicket> {
    const ticket = await this.request<CwTicket>('GET', `/service/tickets/${externalId}`);
    return this.normalizeTicket(ticket);
  }

  async createTicket(data: Record<string, unknown>): Promise<NormalizedTicket> {
    const ticket = await this.request<CwTicket>('POST', '/service/tickets', undefined, {
      summary: data.subject ?? data.summary,
      board: data.boardId ? { id: data.boardId } : undefined,
      company: data.companyId ? { id: data.companyId } : undefined,
      priority: data.priorityId ? { id: data.priorityId } : undefined,
      status: data.statusId ? { id: data.statusId } : undefined,
      initialDescription: data.description,
      ...data.rawFields as object,
    });
    return this.normalizeTicket(ticket);
  }

  async updateTicket(externalId: string, updates: Record<string, unknown>): Promise<NormalizedTicket> {
    const patchOps = [];
    if (updates.status) patchOps.push({ op: 'replace', path: '/status/id', value: updates.status });
    if (updates.priority) patchOps.push({ op: 'replace', path: '/priority/id', value: updates.priority });
    if (updates.summary) patchOps.push({ op: 'replace', path: '/summary', value: updates.summary });
    if (updates.assignedTo) patchOps.push({ op: 'replace', path: '/assignedTo/id', value: updates.assignedTo });

    const ticket = await this.request<CwTicket>('PATCH', `/service/tickets/${externalId}`, undefined, patchOps);
    return this.normalizeTicket(ticket);
  }

  // ─── PSA: Time Entries ─────────────────────────────────────────────

  async listTimeEntries(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedTimeEntry>> {
    const params: Record<string, string> = { pageSize: String(PAGE_SIZE) };
    if (filters?.ticketId) params.conditions = `chargeToId=${filters.ticketId} and chargeToType="ServiceTicket"`;
    if (filters?.page) params.page = String(filters.page);

    const entries = await this.request<CwTimeEntry[]>('GET', '/time/entries', params);
    return {
      data: entries.map(e => this.normalizeTimeEntry(e)),
      total: entries.length,
      page: parseInt(params.page ?? '1'),
      pageSize: PAGE_SIZE,
      hasMore: entries.length === PAGE_SIZE,
    };
  }

  async createTimeEntry(entry: Record<string, unknown>): Promise<NormalizedTimeEntry> {
    const created = await this.request<CwTimeEntry>('POST', '/time/entries', undefined, {
      chargeToId: entry.ticketId,
      chargeToType: 'ServiceTicket',
      timeStart: entry.startTime,
      timeEnd: entry.endTime,
      actualHours: entry.durationHours,
      notes: entry.notes,
      billableOption: entry.billable ? 'Billable' : 'DoNotBill',
    });
    return this.normalizeTimeEntry(created);
  }

  // ─── PSA: Contracts ────────────────────────────────────────────────

  async listContracts(filters?: Record<string, unknown>): Promise<PaginatedResult<NormalizedContract>> {
    const params: Record<string, string> = { pageSize: String(PAGE_SIZE) };
    if (filters?.page) params.page = String(filters.page);

    const agreements = await this.request<any[]>('GET', '/finance/agreements', params);
    return {
      data: agreements.map(a => ({
        externalId: String(a.id),
        connectorId: this.id,
        clientExternalId: String(a.company?.id ?? ''),
        name: a.name ?? '',
        type: a.type?.name ?? 'unknown',
        status: a.cancelledFlag ? 'cancelled' : 'active',
        startDate: new Date(a.startDate),
        endDate: a.endDate ? new Date(a.endDate) : undefined,
        monthlyAmount: a.billAmount ?? undefined,
        rawData: a,
      })),
      total: agreements.length,
      page: parseInt(params.page ?? '1'),
      pageSize: PAGE_SIZE,
      hasMore: agreements.length === PAGE_SIZE,
    };
  }

  async getContract(externalId: string): Promise<NormalizedContract> {
    const a = await this.request<any>('GET', `/finance/agreements/${externalId}`);
    return {
      externalId: String(a.id),
      connectorId: this.id,
      clientExternalId: String(a.company?.id ?? ''),
      name: a.name ?? '',
      type: a.type?.name ?? 'unknown',
      status: a.cancelledFlag ? 'cancelled' : 'active',
      startDate: new Date(a.startDate),
      endDate: a.endDate ? new Date(a.endDate) : undefined,
      monthlyAmount: a.billAmount ?? undefined,
      rawData: a,
    };
  }

  // ─── Extended: Boards + Statuses ───────────────────────────────────

  async getBoards(): Promise<CwBoard[]> {
    return this.fetchAllPages<CwBoard>('/service/boards');
  }

  async getStatuses(boardId: number): Promise<CwStatus[]> {
    return this.request<CwStatus[]>('GET', `/service/boards/${boardId}/statuses`);
  }

  async getCompanies(filters?: Record<string, string>): Promise<CwCompany[]> {
    return this.fetchAllPages<CwCompany>('/company/companies', filters);
  }

  async getContacts(filters?: Record<string, string>): Promise<CwContact[]> {
    return this.fetchAllPages<CwContact>('/company/contacts', filters);
  }

  // ─── HTTP ──────────────────────────────────────────────────────────

  private async request<T>(
    method: string, path: string,
    params?: Record<string, string>, body?: unknown,
  ): Promise<T> {
    await this.enforceRateLimit();

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'clientId': this.clientId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (body && method !== 'GET') init.body = JSON.stringify(body);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url.toString(), init);

        if (res.status === 429) {
          const wait = parseInt(res.headers.get('Retry-After') ?? '5');
          await this.sleep(wait * 1000);
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          let msg: string;
          try { msg = (JSON.parse(text) as CwApiError).message; } catch { msg = `HTTP ${res.status}: ${text.substring(0, 200)}`; }
          throw new Error(msg);
        }

        return (await res.json()) as T;
      } catch (err) {
        if (attempt < 2 && !(err as Error).message.includes('HTTP 4')) {
          await this.sleep(1000 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Request failed after retries');
  }

  private async fetchAllPages<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const items = await this.request<T[]>('GET', path, {
        ...params, page: String(page), pageSize: String(PAGE_SIZE),
      });
      all.push(...items);
      hasMore = items.length === PAGE_SIZE;
      page++;
    }

    return all;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.requestWindowStart > 60000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }
    this.requestCount++;
    if (this.requestCount >= 100) {
      await this.sleep(60000 - (now - this.requestWindowStart) + 100);
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }
  }

  private normalizeTicket(t: CwTicket): NormalizedTicket {
    return {
      externalId: String(t.id),
      connectorId: this.id,
      subject: t.summary,
      description: '',
      status: t.status?.name ?? 'unknown',
      priority: t.priority?.name ?? 'unknown',
      category: t.board?.name,
      assignedTo: t.assignedTo?.name ?? t.owner?.name,
      requestedBy: t.contact?.name,
      createdAt: new Date(t.dateEntered),
      updatedAt: new Date(t.lastUpdated ?? t._info?.lastUpdated),
      resolvedAt: t.closedDate ? new Date(t.closedDate) : undefined,
      rawData: t as unknown as Record<string, unknown>,
    };
  }

  private normalizeTimeEntry(e: CwTimeEntry): NormalizedTimeEntry {
    return {
      externalId: String(e.id),
      connectorId: this.id,
      ticketExternalId: String(e.chargeToId),
      userId: e.member?.identifier ?? '',
      startTime: new Date(e.timeStart),
      endTime: e.timeEnd ? new Date(e.timeEnd) : undefined,
      durationMins: Math.round((e.actualHours ?? 0) * 60),
      billable: e.billableOption === 'Billable',
      notes: e.notes,
      rawData: e as unknown as Record<string, unknown>,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}

export default ConnectWiseManageConnector;
