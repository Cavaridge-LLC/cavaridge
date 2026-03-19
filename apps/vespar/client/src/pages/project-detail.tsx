import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useProject,
  useUpdateProject,
  useWorkloads,
  useCreateWorkload,
  useUpdateWorkload,
  useDeleteWorkload,
  useDependencies,
  useRisks,
  useAnalyzeRisks,
  useCosts,
  useAnalyzeCosts,
  useRunbooks,
  useGenerateRunbook,
  useAnalyzeProject,
  useReadiness,
} from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Play,
  Plus,
  Pencil,
  Trash2,
  Cloud,
  Server,
  ArrowRight,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  Layers,
  Link2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import type { Workload } from "@shared/schema";

import DependencyGraph from "@/components/dependency-graph";
import RiskMatrix from "@/components/risk-matrix";
import CostChart from "@/components/cost-chart";
import RunbookViewer from "@/components/runbook-viewer";
import MigrationTimeline from "@/components/migration-timeline";

const ENV_LABELS: Record<string, string> = {
  "on-prem": "On-Premises",
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  other: "Other",
};

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "default"> = {
  draft: "secondary",
  assessment: "outline",
  planning: "default",
  approved: "default",
  "in-progress": "default",
  completed: "default",
  archived: "secondary",
};

const WORKLOAD_TYPES = [
  { value: "server", label: "Server" },
  { value: "database", label: "Database" },
  { value: "application", label: "Application" },
  { value: "storage", label: "Storage" },
  { value: "network", label: "Network" },
  { value: "identity", label: "Identity" },
  { value: "other", label: "Other" },
];

const CRITICALITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STRATEGY_OPTIONS = [
  { value: "rehost", label: "Rehost (Lift & Shift)" },
  { value: "replatform", label: "Replatform" },
  { value: "refactor", label: "Refactor" },
  { value: "repurchase", label: "Repurchase" },
  { value: "retire", label: "Retire" },
  { value: "retain", label: "Retain" },
];

const CRITICALITY_COLOR: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-500",
  medium: "text-amber-500",
  low: "text-green-600",
};

function envIcon(env: string) {
  if (env === "on-prem") return <Server className="h-4 w-4" />;
  return <Cloud className="h-4 w-4" />;
}

export default function ProjectDetail() {
  const [match, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id ?? "";

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const { data: workloads, isLoading: workloadsLoading } = useWorkloads(projectId);
  const createWorkload = useCreateWorkload(projectId);
  const updateWorkload = useUpdateWorkload(projectId);
  const deleteWorkload = useDeleteWorkload(projectId);
  const { data: dependencies } = useDependencies(projectId);
  const { data: risks } = useRisks(projectId);
  const analyzeRisks = useAnalyzeRisks(projectId);
  const { data: costs } = useCosts(projectId);
  const analyzeCosts = useAnalyzeCosts(projectId);
  const { data: runbooks } = useRunbooks(projectId);
  const generateRunbook = useGenerateRunbook(projectId);
  const analyzeProject = useAnalyzeProject(projectId);
  const { data: readiness } = useReadiness(projectId);

  // Workload form state
  const [workloadDialogOpen, setWorkloadDialogOpen] = useState(false);
  const [editingWorkload, setEditingWorkload] = useState<Workload | null>(null);
  const [wName, setWName] = useState("");
  const [wType, setWType] = useState("server");
  const [wCriticality, setWCriticality] = useState("medium");
  const [wStrategy, setWStrategy] = useState("");
  const [wEffort, setWEffort] = useState("");
  const [wNotes, setWNotes] = useState("");
  const [wCurrentHosting, setWCurrentHosting] = useState("");

  function resetWorkloadForm() {
    setWName("");
    setWType("server");
    setWCriticality("medium");
    setWStrategy("");
    setWEffort("");
    setWNotes("");
    setWCurrentHosting("");
    setEditingWorkload(null);
  }

  function openEditWorkload(w: Workload) {
    setEditingWorkload(w);
    setWName(w.name);
    setWType(w.type);
    setWCriticality(w.criticality);
    setWStrategy(w.migrationStrategy ?? "");
    setWEffort(w.estimatedEffortHours?.toString() ?? "");
    setWNotes(w.notes ?? "");
    setWCurrentHosting(w.currentHosting ?? "");
    setWorkloadDialogOpen(true);
  }

  async function handleSaveWorkload() {
    if (!wName.trim()) {
      toast.error("Workload name is required");
      return;
    }

    const payload = {
      name: wName.trim(),
      type: wType,
      criticality: wCriticality,
      migrationStrategy: wStrategy || undefined,
      estimatedEffortHours: wEffort ? parseInt(wEffort, 10) : undefined,
      notes: wNotes.trim() || undefined,
      currentHosting: wCurrentHosting.trim() || undefined,
    };

    try {
      if (editingWorkload) {
        await updateWorkload.mutateAsync({ id: editingWorkload.id, ...payload });
        toast.success("Workload updated");
      } else {
        await createWorkload.mutateAsync(payload);
        toast.success("Workload added");
      }
      resetWorkloadForm();
      setWorkloadDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save workload";
      toast.error(message);
    }
  }

  async function handleDeleteWorkload(id: string) {
    try {
      await deleteWorkload.mutateAsync(id);
      toast.success("Workload deleted");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete workload";
      toast.error(message);
    }
  }

  async function handleRunAnalysis() {
    try {
      const result = await analyzeProject.mutateAsync();
      toast.success(`Analysis complete — readiness score: ${result.readinessScore}%`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      toast.error(message);
    }
  }

  if (!match) return null;

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <Button variant="outline" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const readinessScore = project.readinessScore ?? readiness?.project?.readinessScore ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                  {project.status}
                </Badge>
              </div>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <Button onClick={handleRunAnalysis} disabled={analyzeProject.isPending}>
            <Play className="h-4 w-4 mr-2" />
            {analyzeProject.isPending ? "Analyzing..." : "Run Full Analysis"}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="workloads" className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Workloads</span>
            </TabsTrigger>
            <TabsTrigger value="dependencies" className="flex items-center gap-1.5">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Dependencies</span>
            </TabsTrigger>
            <TabsTrigger value="risks" className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Risks</span>
            </TabsTrigger>
            <TabsTrigger value="costs" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Costs</span>
            </TabsTrigger>
            <TabsTrigger value="runbooks" className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Runbooks</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Readiness Gauge */}
              <Card className="flex flex-col items-center justify-center py-8">
                <CardContent className="flex flex-col items-center">
                  <div className="relative h-32 w-32 mb-4">
                    <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-muted"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeDasharray={`${((readinessScore ?? 0) / 100) * 327} 327`}
                        strokeLinecap="round"
                        className="text-sky-600 transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold">
                        {readinessScore != null ? `${readinessScore}%` : "—"}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Readiness Score</p>
                </CardContent>
              </Card>

              {/* Project Info */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Project Info</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    {envIcon(project.sourceEnvironment)}
                    <span>{ENV_LABELS[project.sourceEnvironment] ?? project.sourceEnvironment}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    {envIcon(project.targetEnvironment)}
                    <span>{ENV_LABELS[project.targetEnvironment] ?? project.targetEnvironment}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Status: </span>
                    <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                      {project.status}
                    </Badge>
                  </div>
                  {project.createdAt && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Created: </span>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Quick Stats</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Workloads</span>
                    <span className="font-medium">{workloads?.length ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Risks</span>
                    <span className="font-medium">{risks?.length ?? 0}</span>
                  </div>
                  {readiness && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Critical Risks</span>
                        <span className="font-medium text-red-600">{readiness.criticalRisks}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">High Risks</span>
                        <span className="font-medium text-orange-500">{readiness.highRisks}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost Projections</span>
                    <span className="font-medium">{costs?.length ?? 0}</span>
                  </div>
                  {readiness?.totalMonthlyCost != null && readiness.totalMonthlyCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Est. Monthly Cost</span>
                      <span className="font-medium">
                        ${readiness.totalMonthlyCost.toLocaleString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Workloads ── */}
          <TabsContent value="workloads">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Workloads</h2>
              <Dialog
                open={workloadDialogOpen}
                onOpenChange={(open) => {
                  setWorkloadDialogOpen(open);
                  if (!open) resetWorkloadForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Workload
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {editingWorkload ? "Edit Workload" : "Add Workload"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="w-name">Name</Label>
                      <Input
                        id="w-name"
                        placeholder="e.g. SQL Server - Production"
                        value={wName}
                        onChange={(e) => setWName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={wType} onValueChange={setWType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WORKLOAD_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Criticality</Label>
                        <Select value={wCriticality} onValueChange={setWCriticality}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CRITICALITY_OPTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Migration Strategy</Label>
                        <Select value={wStrategy} onValueChange={setWStrategy}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select strategy" />
                          </SelectTrigger>
                          <SelectContent>
                            {STRATEGY_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="w-effort">Estimated Effort (hrs)</Label>
                        <Input
                          id="w-effort"
                          type="number"
                          min={0}
                          placeholder="e.g. 40"
                          value={wEffort}
                          onChange={(e) => setWEffort(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="w-hosting">Current Hosting</Label>
                      <Input
                        id="w-hosting"
                        placeholder="e.g. VMware ESXi 7.0"
                        value={wCurrentHosting}
                        onChange={(e) => setWCurrentHosting(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="w-notes">Notes</Label>
                      <Textarea
                        id="w-notes"
                        placeholder="Additional details..."
                        value={wNotes}
                        onChange={(e) => setWNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <Button
                      onClick={handleSaveWorkload}
                      disabled={createWorkload.isPending || updateWorkload.isPending}
                      className="w-full"
                    >
                      {editingWorkload ? "Save Changes" : "Add Workload"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {workloadsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600" />
              </div>
            ) : workloads && workloads.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Criticality</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Effort (hrs)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workloads.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="capitalize">{w.type}</TableCell>
                        <TableCell>
                          <span className={`capitalize font-medium ${CRITICALITY_COLOR[w.criticality] ?? ""}`}>
                            {w.criticality}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize">
                          {w.migrationStrategy ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {w.estimatedEffortHours ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditWorkload(w)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteWorkload(w.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center text-center">
                  <Layers className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground mb-4">
                    No workloads added yet. Add servers, databases, and applications to assess.
                  </p>
                  <Button variant="outline" onClick={() => setWorkloadDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Workload
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Dependencies ── */}
          <TabsContent value="dependencies">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Dependencies</h2>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Dependency
              </Button>
            </div>
            <DependencyGraph projectId={projectId} />
          </TabsContent>

          {/* ── Risks ── */}
          <TabsContent value="risks">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Risk Analysis</h2>
              <Button
                onClick={() => {
                  analyzeRisks.mutate(undefined, {
                    onSuccess: () => toast.success("Risk analysis complete"),
                    onError: (err) => toast.error(err.message),
                  });
                }}
                disabled={analyzeRisks.isPending}
              >
                <Shield className="h-4 w-4 mr-2" />
                {analyzeRisks.isPending ? "Analyzing..." : "Analyze Risks"}
              </Button>
            </div>
            <RiskMatrix projectId={projectId} />
            {risks && risks.length > 0 && (
              <Card className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risks.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>
                          <span className={`capitalize font-medium ${CRITICALITY_COLOR[r.severity] ?? ""}`}>
                            {r.severity}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize">{r.category}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{r.riskScore ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ── Costs ── */}
          <TabsContent value="costs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Cost Projections</h2>
              <Button
                onClick={() => {
                  analyzeCosts.mutate(undefined, {
                    onSuccess: () => toast.success("Cost analysis complete"),
                    onError: (err) => toast.error(err.message),
                  });
                }}
                disabled={analyzeCosts.isPending}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {analyzeCosts.isPending ? "Analyzing..." : "Analyze Costs"}
              </Button>
            </div>
            <CostChart projectId={projectId} />
            {costs && costs.length > 0 && (
              <Card className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workload</TableHead>
                      <TableHead className="text-right">Current (Monthly)</TableHead>
                      <TableHead className="text-right">Projected (Monthly)</TableHead>
                      <TableHead className="text-right">Migration (One-time)</TableHead>
                      <TableHead className="text-right">Monthly Savings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {workloads?.find((w) => w.id === c.workloadId)?.name ?? "Project-level"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.currentMonthlyCost ? `$${c.currentMonthlyCost}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.projectedMonthlyCost ? `$${c.projectedMonthlyCost}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.migrationCostOnetime ? `$${c.migrationCostOnetime}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.savingsMonthly ? `$${c.savingsMonthly}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ── Runbooks ── */}
          <TabsContent value="runbooks">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Runbooks</h2>
              <Button
                onClick={() => {
                  generateRunbook.mutate(undefined, {
                    onSuccess: () => toast.success("Runbook generated"),
                    onError: (err) => toast.error(err.message),
                  });
                }}
                disabled={generateRunbook.isPending}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                {generateRunbook.isPending ? "Generating..." : "Generate Runbook"}
              </Button>
            </div>
            <RunbookViewer projectId={projectId} />
          </TabsContent>

          {/* ── Timeline ── */}
          <TabsContent value="timeline">
            <h2 className="text-xl font-semibold mb-4">Migration Timeline</h2>
            <MigrationTimeline projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
