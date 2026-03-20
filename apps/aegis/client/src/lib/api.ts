/**
 * API client for AEGIS backend.
 * Attaches tenant/user headers from localStorage.
 */

const BASE = '/api/v1';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': localStorage.getItem('aegis-tenant-id') ?? '',
    'X-User-Id': localStorage.getItem('aegis-user-id') ?? '',
    'X-User-Role': localStorage.getItem('aegis-user-role') ?? 'msp_admin',
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

// ─── Devices ──────────────────────────────────────────────────────────

export const devices = {
  list: (params?: Record<string, string>) =>
    request<any>(`/devices?${new URLSearchParams(params ?? {})}`),
  get: (id: string) => request<any>(`/devices/${id}`),
  update: (id: string, data: any) =>
    request<any>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  stats: () => request<any>('/devices/stats/summary'),
};

// ─── Policies ─────────────────────────────────────────────────────────

export const policies = {
  list: (params?: Record<string, string>) =>
    request<any>(`/policies?${new URLSearchParams(params ?? {})}`),
  get: (id: string) => request<any>(`/policies/${id}`),
  create: (data: any) =>
    request<any>('/policies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/policies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/policies/${id}`, { method: 'DELETE' }),
};

// ─── SaaS Discovery ──────────────────────────────────────────────────

export const saas = {
  list: (params?: Record<string, string>) =>
    request<any>(`/saas?${new URLSearchParams(params ?? {})}`),
  summary: () => request<any>('/saas/summary'),
  byCategory: () => request<any>('/saas/by-category'),
  classify: (id: string, data: { classification: string; notes?: string }) =>
    request<any>(`/saas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  catalog: () => request<any>('/saas/catalog'),
};

// ─── Telemetry ────────────────────────────────────────────────────────

export const telemetry = {
  recent: (params?: Record<string, string>) =>
    request<any>(`/telemetry/recent?${new URLSearchParams(params ?? {})}`),
  stats: () => request<any>('/telemetry/stats'),
};

// ─── Scans ────────────────────────────────────────────────────────────

export const scans = {
  list: () => request<any>('/scan'),
  get: (id: string) => request<any>(`/scan/${id}`),
  run: (data: { target: string; scanType?: string }) =>
    request<any>('/scan', { method: 'POST', body: JSON.stringify(data) }),
  publicScan: (data: { target: string; email?: string; name?: string; company?: string }) =>
    request<any>('/scan/public', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Score ─────────────────────────────────────────────────────────────

export const score = {
  current: (params?: Record<string, string>) =>
    request<any>(`/score/current?${new URLSearchParams(params ?? {})}`),
  calculate: (data?: { clientTenantId?: string }) =>
    request<any>('/score/calculate', { method: 'POST', body: JSON.stringify(data ?? {}) }),
  history: (params?: Record<string, string>) =>
    request<any>(`/score/history?${new URLSearchParams(params ?? {})}`),
};

// ─── Enrollment ───────────────────────────────────────────────────────

export const enrollment = {
  tokens: () => request<any>('/enrollment/tokens'),
  createToken: (data: { label?: string; maxUses?: number; expiresAt?: string }) =>
    request<any>('/enrollment/tokens', { method: 'POST', body: JSON.stringify(data) }),
  revokeToken: (id: string) =>
    request<any>(`/enrollment/tokens/${id}`, { method: 'DELETE' }),
};
