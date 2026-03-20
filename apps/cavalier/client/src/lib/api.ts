/**
 * API client for Cavalier backend.
 * Attaches tenant/user headers from localStorage.
 */

const BASE = '/api/v1';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': localStorage.getItem('cavalier-tenant-id') ?? '',
    'X-User-Id': localStorage.getItem('cavalier-user-id') ?? '',
    'X-User-Role': localStorage.getItem('cavalier-user-role') ?? 'partner_admin',
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: getHeaders(),
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

// ─── Tickets ────────────────────────────────────────────────────────

export const tickets = {
  list: (params?: Record<string, string>) =>
    request<any>(`/tickets?${new URLSearchParams(params ?? {})}`),
  get: (id: string) => request<any>(`/tickets/${id}`),
  create: (data: any) => request<any>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addComment: (id: string, data: any) =>
    request<any>(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  assign: (id: string, assignedTo: string) =>
    request<any>(`/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify({ assignedTo }) }),
  resolve: (id: string, resolution?: string) =>
    request<any>(`/tickets/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution }) }),
  close: (id: string) =>
    request<any>(`/tickets/${id}/close`, { method: 'POST' }),
  escalate: (id: string, data: { reason: string; escalateTo?: string }) =>
    request<any>(`/tickets/${id}/escalate`, { method: 'POST', body: JSON.stringify(data) }),
  stats: () => request<any>('/tickets/stats/summary'),
};

// ─── Connectors ─────────────────────────────────────────────────────

export const connectors = {
  catalog: () => request<any>('/connectors/catalog'),
  list: () => request<any>('/connectors'),
  get: (id: string) => request<any>(`/connectors/${id}`),
  configure: (id: string, data: { config?: any; credentials: any }) =>
    request<any>(`/connectors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggle: (id: string) =>
    request<any>(`/connectors/${id}/toggle`, { method: 'PATCH' }),
  remove: (id: string) =>
    request<any>(`/connectors/${id}`, { method: 'DELETE' }),
  syncLogs: (id: string, limit?: number) =>
    request<any>(`/connectors/${id}/sync-logs?limit=${limit ?? 20}`),
  triggerSync: (id: string, data?: { entityType?: string; mode?: string }) =>
    request<any>(`/connectors/${id}/sync`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  health: (id: string) => request<any>(`/connectors/${id}/health`),
};

// ─── Partners ───────────────────────────────────────────────────────

export const partners = {
  tiers: () => request<any>('/partners/tiers'),
  profile: () => request<any>('/partners/profile'),
  onboard: (data: any) =>
    request<any>('/partners/onboard', { method: 'POST', body: JSON.stringify(data) }),
  updateTier: (tier: string) =>
    request<any>('/partners/tier', { method: 'PATCH', body: JSON.stringify({ tier }) }),
  usage: () => request<any>('/partners/usage'),
  clients: () => request<any>('/partners/clients'),
};

// ─── Billing ────────────────────────────────────────────────────────

export const billing = {
  contracts: {
    list: (params?: Record<string, string>) =>
      request<any>(`/billing/contracts?${new URLSearchParams(params ?? {})}`),
    get: (id: string) => request<any>(`/billing/contracts/${id}`),
    create: (data: any) =>
      request<any>('/billing/contracts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/billing/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    blockHours: (id: string) => request<any>(`/billing/contracts/${id}/block-hours`),
  },
  invoices: {
    list: (params?: Record<string, string>) =>
      request<any>(`/billing/invoices?${new URLSearchParams(params ?? {})}`),
    get: (id: string) => request<any>(`/billing/invoices/${id}`),
    generate: (data: { periodStart: string; periodEnd: string }) =>
      request<any>('/billing/invoices/generate', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/billing/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  timeEntries: {
    list: (params?: Record<string, string>) =>
      request<any>(`/billing/time-entries?${new URLSearchParams(params ?? {})}`),
    create: (data: any) =>
      request<any>('/billing/time-entries', { method: 'POST', body: JSON.stringify(data) }),
    startTimer: (data: { ticketId?: string; workType?: string; notes?: string }) =>
      request<any>('/billing/time-entries/start', { method: 'POST', body: JSON.stringify(data) }),
    stopTimer: (id: string) =>
      request<any>(`/billing/time-entries/${id}/stop`, { method: 'POST' }),
    approve: (id: string) =>
      request<any>(`/billing/time-entries/${id}/approve`, { method: 'POST' }),
  },
  summary: () => request<any>('/billing/summary'),
};

// ─── Enrichment ─────────────────────────────────────────────────────

export const enrichment = {
  enrichTicket: (ticketId: string) =>
    request<any>(`/enrichment/ticket/${ticketId}`, { method: 'POST' }),
  similarTickets: (data: { subject: string; description?: string }) =>
    request<any>('/enrichment/similar-tickets', { method: 'POST', body: JSON.stringify(data) }),
};
