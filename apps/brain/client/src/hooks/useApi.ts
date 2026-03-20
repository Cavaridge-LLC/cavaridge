/**
 * API hook — typed fetch wrapper for Brain API calls
 */

const API_BASE = "/api/v1";

// Dev-mode tenant/user headers (in production, JWT auth provides these)
const DEV_HEADERS: Record<string, string> = {
  "X-Tenant-Id": "00000000-0000-0000-0000-000000000001",
  "X-User-Id": "00000000-0000-0000-0000-000000000001",
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...DEV_HEADERS,
      ...options?.headers,
    },
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(body.error || `API error: ${resp.status}`);
  }

  if (resp.status === 204) return {} as T;
  return resp.json() as Promise<T>;
}

export const api = {
  // Recordings
  createRecording: (data: { title?: string; sourceType?: string }) =>
    apiFetch<{ id: string }>("/recordings", { method: "POST", body: JSON.stringify(data) }),

  updateRecording: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/recordings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  processRecording: (id: string, data: { transcript: string; contextHint?: string }) =>
    apiFetch<{ extraction: unknown }>(`/recordings/${id}/process`, { method: "POST", body: JSON.stringify(data) }),

  submitWebSpeech: (id: string, data: { text: string; confidence: number }) =>
    apiFetch(`/recordings/${id}/web-speech`, { method: "POST", body: JSON.stringify(data) }),

  listRecordings: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<{ data: unknown[]; total: number }>(`/recordings${qs}`);
  },

  // Knowledge
  listKnowledge: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<{ data: unknown[]; total: number }>(`/knowledge${qs}`);
  },

  getKnowledge: (id: string) =>
    apiFetch<Record<string, unknown>>(`/knowledge/${id}`),

  updateKnowledge: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/knowledge/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getKnowledgeStats: () =>
    apiFetch<Record<string, unknown>>("/knowledge/stats"),

  getTimeline: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<{ timeline: unknown[] }>(`/knowledge/timeline${qs}`);
  },

  getEntities: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<{ data: unknown[] }>(`/knowledge/entities${qs}`);
  },

  getEntityGraph: (id: string, depth?: number) =>
    apiFetch<{ nodes: unknown[]; edges: unknown[] }>(`/knowledge/entities/${id}/graph?depth=${depth || 2}`),

  // Recall
  recall: (data: { query: string; filters?: Record<string, unknown>; maxResults?: number }) =>
    apiFetch<{ answer: string; sources: unknown[]; totalMatches: number }>("/recall", { method: "POST", body: JSON.stringify(data) }),

  search: (data: { query: string; maxResults?: number }) =>
    apiFetch<{ results: unknown[]; total: number }>("/recall/search", { method: "POST", body: JSON.stringify(data) }),

  // Connectors
  listConnectors: () =>
    apiFetch<{ connectors: Array<{ id: string; name: string; phase: number; status: string; isConfigured: boolean }> }>("/connectors"),

  configureConnector: (id: string, data: { credentials: Record<string, string> }) =>
    apiFetch(`/connectors/${id}/configure`, { method: "POST", body: JSON.stringify(data) }),

  syncConnector: (id: string, entityType?: string) =>
    apiFetch(`/connectors/${id}/sync`, { method: "POST", body: JSON.stringify({ entityType }) }),

  connectorHealth: (id: string) =>
    apiFetch<Record<string, unknown>>(`/connectors/${id}/health`),
};
