import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

// ── Clients ──────────────────────────────────────────────────────────

export function clientsQuery() {
  return queryOptions({
    queryKey: ["clients"],
    queryFn: () => apiFetch("/api/clients"),
  });
}

// ── Initiatives ──────────────────────────────────────────────────────

export function initiativesQuery(clientId: string) {
  return queryOptions({
    queryKey: ["initiatives", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/initiatives`),
    enabled: !!clientId,
  });
}

// ── Snapshots ────────────────────────────────────────────────────────

export function snapshotQuery(clientId: string) {
  return queryOptions({
    queryKey: ["snapshot", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/snapshot`),
    enabled: !!clientId,
    retry: false,
  });
}

// ── Meetings ─────────────────────────────────────────────────────────

export function meetingsQuery(clientId?: string) {
  return queryOptions({
    queryKey: ["meetings", clientId ?? "all"],
    queryFn: () => apiFetch(clientId ? `/api/meetings?clientId=${clientId}` : "/api/meetings"),
  });
}

export function meetingQuery(id: string) {
  return queryOptions({
    queryKey: ["meeting", id],
    queryFn: () => apiFetch(`/api/meetings/${id}`),
    enabled: !!id,
  });
}

// ── Security Scoring ─────────────────────────────────────────────────

export function scoringCatalogQuery() {
  return queryOptions({
    queryKey: ["scoring", "catalog"],
    queryFn: () => apiFetch("/api/scoring/catalog"),
  });
}

export function clientOverridesQuery(clientId: string) {
  return queryOptions({
    queryKey: ["scoring", "overrides", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/scoring/overrides`),
    enabled: !!clientId,
  });
}

export function latestScoreQuery(clientId: string) {
  return queryOptions({
    queryKey: ["scoring", "latest", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/scoring/latest`),
    enabled: !!clientId,
    retry: false,
  });
}

export function scoreHistoryQuery(clientId: string) {
  return queryOptions({
    queryKey: ["scoring", "history", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/scoring/history`),
    enabled: !!clientId,
  });
}

export function scoreTrendQuery(clientId: string) {
  return queryOptions({
    queryKey: ["scoring", "trend", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/scoring/trend`),
    enabled: !!clientId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────

export function useCreateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/api/initiatives", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  });
}

export function useUpdateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiFetch(`/api/initiatives/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  });
}

export function useDeleteInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/initiatives/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  });
}

export function useCompleteInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/initiatives/${id}/complete`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["initiatives"] });
      qc.invalidateQueries({ queryKey: ["scoring"] });
    },
  });
}

export function useReorderInitiatives() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; quarter: string; sortOrder: number }[]) =>
      apiFetch("/api/initiatives/reorder/batch", { method: "PATCH", body: JSON.stringify({ updates }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/api/meetings", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiFetch(`/api/meetings/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/seed", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      qc.invalidateQueries({ queryKey: ["scoring"] });
    },
  });
}

// ── Scoring Mutations ────────────────────────────────────────────────

export function useCalculateScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, ...data }: { clientId: string; nativeControls: any[]; vendor?: string; detectedSignals?: any[] }) =>
      apiFetch(`/api/clients/${clientId}/scoring/calculate`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scoring"] }),
  });
}

export function useSetOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, ...data }: { clientId: string } & Record<string, any>) =>
      apiFetch(`/api/clients/${clientId}/scoring/overrides`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scoring", "overrides"] }),
  });
}

export function useDeleteOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, controlId }: { clientId: string; controlId: string }) =>
      apiFetch(`/api/clients/${clientId}/scoring/overrides/${controlId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scoring", "overrides"] }),
  });
}

// ── Agent Mutations ──────────────────────────────────────────────────

export function useRunAdvisor() {
  return useMutation({
    mutationFn: ({ clientId, ...data }: { clientId: string; clientContext?: string; focus?: string[] }) =>
      apiFetch(`/api/clients/${clientId}/advisor/analyze`, { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useRunWhatIf() {
  return useMutation({
    mutationFn: ({ clientId, gapIds }: { clientId: string; gapIds: string[] }) =>
      apiFetch(`/api/clients/${clientId}/advisor/what-if`, { method: "POST", body: JSON.stringify({ gapIds }) }),
  });
}

export function useGenerateQbr() {
  return useMutation({
    mutationFn: (clientId: string) =>
      apiFetch(`/api/clients/${clientId}/qbr/generate`, { method: "POST" }),
  });
}

export function useImportGapsToRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      apiFetch(`/api/clients/${clientId}/roadmap/from-gaps`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  });
}
