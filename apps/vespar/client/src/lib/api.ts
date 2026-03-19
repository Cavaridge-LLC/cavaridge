import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  MigrationProject, Workload, Dependency,
  RiskFinding, CostProjection, Runbook,
} from "@shared/schema";

// Project summary from the API includes counts
interface ProjectSummary extends MigrationProject {
  workloadCount: number;
  riskCount: number;
  openRiskCount: number;
}

interface ReadinessResult {
  project: MigrationProject;
  workloadCount: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  totalMonthlyCost: number;
  runbookCount: number;
}

interface AnalysisResult {
  readinessScore: number;
  riskSummary: unknown;
  costSummary: unknown;
  migrationSequence: unknown[];
  recommendations: string[];
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function postApi<T>(url: string, data: unknown): Promise<T> {
  return fetchApi<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function patchApi<T>(url: string, data: unknown): Promise<T> {
  return fetchApi<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function deleteApi(url: string): Promise<void> {
  await fetch(url, { method: "DELETE", credentials: "include" });
}

// --- Projects ---
export function useProjects() {
  return useQuery<ProjectSummary[]>({
    queryKey: ["projects"],
    queryFn: () => fetchApi("/api/projects"),
  });
}

export function useProject(id: string) {
  return useQuery<MigrationProject>({
    queryKey: ["projects", id],
    queryFn: () => fetchApi(`/api/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; sourceEnvironment: string; targetEnvironment: string }) =>
      postApi<MigrationProject>("/api/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MigrationProject>) => patchApi<MigrationProject>(`/api/projects/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApi(`/api/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

// --- Workloads ---
export function useWorkloads(projectId: string) {
  return useQuery<Workload[]>({
    queryKey: ["workloads", projectId],
    queryFn: () => fetchApi(`/api/projects/${projectId}/workloads`),
    enabled: !!projectId,
  });
}

export function useCreateWorkload(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => postApi<Workload>(`/api/projects/${projectId}/workloads`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workloads", projectId] }),
  });
}

export function useBulkCreateWorkloads(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown[]) => postApi<Workload[]>(`/api/projects/${projectId}/workloads/bulk`, { workloads: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workloads", projectId] }),
  });
}

export function useUpdateWorkload(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Workload>) =>
      patchApi<Workload>(`/api/workloads/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workloads", projectId] }),
  });
}

export function useDeleteWorkload(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApi(`/api/workloads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workloads", projectId] }),
  });
}

// --- Dependencies ---
export function useDependencies(projectId: string) {
  return useQuery<Dependency[]>({
    queryKey: ["dependencies", projectId],
    queryFn: () => fetchApi(`/api/projects/${projectId}/dependencies`),
    enabled: !!projectId,
  });
}

export function useCreateDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => postApi<Dependency>(`/api/projects/${projectId}/dependencies`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dependencies", projectId] }),
  });
}

export function useDeleteDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApi(`/api/dependencies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dependencies", projectId] }),
  });
}

// --- Risks ---
export function useRisks(projectId: string) {
  return useQuery<RiskFinding[]>({
    queryKey: ["risks", projectId],
    queryFn: () => fetchApi(`/api/projects/${projectId}/risks`),
    enabled: !!projectId,
  });
}

export function useAnalyzeRisks(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postApi<RiskFinding[]>(`/api/projects/${projectId}/risks/analyze`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks", projectId] }),
  });
}

export function useUpdateRisk(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<RiskFinding>) =>
      patchApi<RiskFinding>(`/api/risks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks", projectId] }),
  });
}

// --- Costs ---
export function useCosts(projectId: string) {
  return useQuery<CostProjection[]>({
    queryKey: ["costs", projectId],
    queryFn: () => fetchApi(`/api/projects/${projectId}/costs`),
    enabled: !!projectId,
  });
}

export function useAnalyzeCosts(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postApi<CostProjection[]>(`/api/projects/${projectId}/costs/analyze`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["costs", projectId] }),
  });
}

export function useUpdateCost(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CostProjection>) =>
      patchApi<CostProjection>(`/api/costs/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["costs", projectId] }),
  });
}

// --- Runbooks ---
export function useRunbooks(projectId: string) {
  return useQuery<Runbook[]>({
    queryKey: ["runbooks", projectId],
    queryFn: () => fetchApi(`/api/projects/${projectId}/runbooks`),
    enabled: !!projectId,
  });
}

export function useRunbook(id: string) {
  return useQuery<Runbook>({
    queryKey: ["runbook", id],
    queryFn: () => fetchApi(`/api/runbooks/${id}`),
    enabled: !!id,
  });
}

export function useGenerateRunbook(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postApi<Runbook>(`/api/projects/${projectId}/runbooks/generate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runbooks", projectId] }),
  });
}

export function useUpdateRunbook(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Runbook>) =>
      patchApi<Runbook>(`/api/runbooks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runbooks", projectId] }),
  });
}

// --- Analysis ---
export function useAnalyzeProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postApi<AnalysisResult>(`/api/projects/${projectId}/analyze`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", projectId] });
      qc.invalidateQueries({ queryKey: ["risks", projectId] });
      qc.invalidateQueries({ queryKey: ["costs", projectId] });
      qc.invalidateQueries({ queryKey: ["readiness", projectId] });
    },
  });
}

export function useReadiness(projectId: string) {
  return useQuery<ReadinessResult>({
    queryKey: ["readiness", projectId],
    queryFn: () => fetchApi(`/api/projects/${projectId}/readiness`),
    enabled: !!projectId,
  });
}
