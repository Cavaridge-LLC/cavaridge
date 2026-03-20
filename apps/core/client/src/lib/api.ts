/**
 * API client for CVG-CORE backend.
 * Platform Admin headers injected on every request.
 */

const BASE = '/api/v1';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': localStorage.getItem('core-user-id') ?? '',
    'X-User-Role': localStorage.getItem('core-user-role') ?? 'platform_admin',
    'X-Tenant-Id': localStorage.getItem('core-tenant-id') ?? 'platform',
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

// ─── Tenants ───────────────────────────────────────────────────────

export const tenants = {
  list: (params?: Record<string, string>) =>
    request<any>(`/tenants?${new URLSearchParams(params ?? {})}`),
  tree: () => request<any>('/tenants/tree'),
  get: (id: string) => request<any>(`/tenants/${id}`),
  create: (data: { name: string; type: string; parent_id?: string; config?: any }) =>
    request<any>('/tenants', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivate: (id: string) =>
    request<any>(`/tenants/${id}/deactivate`, { method: 'POST' }),
  activate: (id: string) =>
    request<any>(`/tenants/${id}/activate`, { method: 'POST' }),
  stats: () => request<any>('/tenants/stats/summary'),
};

// ─── Users ─────────────────────────────────────────────────────────

export const users = {
  list: (params?: Record<string, string>) =>
    request<any>(`/users?${new URLSearchParams(params ?? {})}`),
  get: (id: string) => request<any>(`/users/${id}`),
  create: (data: { email: string; full_name?: string; role: string; organization_id: string }) =>
    request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  bulkInvite: (invites: { email: string; full_name?: string; role: string; organization_id: string }[]) =>
    request<any>('/users/bulk-invite', { method: 'POST', body: JSON.stringify({ invites }) }),
  update: (id: string, data: any) =>
    request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivate: (id: string) =>
    request<any>(`/users/${id}/deactivate`, { method: 'POST' }),
  stats: () => request<any>('/users/stats/summary'),
};

// ─── Apps ──────────────────────────────────────────────────────────

export const apps = {
  list: () => request<any>('/apps'),
  health: (code: string) => request<any>(`/apps/${code}/health`),
  healthAll: () => request<any>('/apps/health/all'),
};

// ─── Settings ──────────────────────────────────────────────────────

export const settings = {
  featureFlags: () => request<any>('/settings/feature-flags'),
  updateFlag: (name: string, enabled: boolean) =>
    request<any>(`/settings/feature-flags/${name}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  branding: () => request<any>('/settings/branding'),
  updateBranding: (branding: any) =>
    request<any>('/settings/branding', { method: 'PATCH', body: JSON.stringify({ branding }) }),
  llmConfig: () => request<any>('/settings/llm-config'),
};

// ─── Audit ─────────────────────────────────────────────────────────

export const audit = {
  query: (params?: Record<string, string>) =>
    request<any>(`/audit?${new URLSearchParams(params ?? {})}`),
  actions: () => request<string[]>('/audit/actions'),
  resourceTypes: () => request<string[]>('/audit/resource-types'),
  appCodes: () => request<string[]>('/audit/app-codes'),
  stats: () => request<any>('/audit/stats'),
};

// ─── Connectors ────────────────────────────────────────────────────

export const connectors = {
  catalog: () => request<any>('/connectors/catalog'),
  configs: () => request<any>('/connectors/configs'),
  requests: () => request<any>('/connectors/requests'),
  submitRequest: (data: { connector_id: string; tenant_id: string; reason?: string }) =>
    request<any>('/connectors/requests', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Database ──────────────────────────────────────────────────────

export const database = {
  tables: () => request<any>('/database/tables'),
  rls: () => request<any>('/database/rls'),
  migrations: () => request<any>('/database/migrations'),
  extensions: () => request<any>('/database/extensions'),
  health: () => request<any>('/database/health'),
};
