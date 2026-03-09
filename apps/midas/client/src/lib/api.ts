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

// ── Query Options ──

export function clientsQuery() {
  return queryOptions({
    queryKey: ["clients"],
    queryFn: () => apiFetch("/api/clients"),
  });
}

export function initiativesQuery(clientId: string) {
  return queryOptions({
    queryKey: ["initiatives", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/initiatives`),
    enabled: !!clientId,
  });
}

export function snapshotQuery(clientId: string) {
  return queryOptions({
    queryKey: ["snapshot", clientId],
    queryFn: () => apiFetch(`/api/clients/${clientId}/snapshot`),
    enabled: !!clientId,
    retry: false,
  });
}

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

// ── Mutations (hooks) ──

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
    },
  });
}
