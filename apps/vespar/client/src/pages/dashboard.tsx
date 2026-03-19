import { useState } from "react";
import { useLocation } from "wouter";
import { useProjects, useCreateProject } from "@/lib/api";
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
  Plus,
  Cloud,
  Server,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

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

function envIcon(env: string) {
  if (env === "on-prem") return <Server className="h-4 w-4" />;
  return <Cloud className="h-4 w-4" />;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceEnvironment, setSourceEnvironment] = useState("");
  const [targetEnvironment, setTargetEnvironment] = useState("");

  const totalProjects = projects?.length ?? 0;
  const inProgress = projects?.filter((p) => p.status === "in-progress").length ?? 0;
  const totalWorkloads = projects?.reduce((sum, p) => sum + (p.workloadCount ?? 0), 0) ?? 0;
  const openRisks = projects?.reduce((sum, p) => sum + (p.openRiskCount ?? 0), 0) ?? 0;

  function resetForm() {
    setName("");
    setDescription("");
    setSourceEnvironment("");
    setTargetEnvironment("");
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    if (!sourceEnvironment) {
      toast.error("Source environment is required");
      return;
    }
    if (!targetEnvironment) {
      toast.error("Target environment is required");
      return;
    }

    try {
      await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        sourceEnvironment,
        targetEnvironment,
      });
      toast.success("Project created");
      resetForm();
      setDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      toast.error(message);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Migration Projects</h1>
            <p className="text-muted-foreground mt-1">
              Plan, assess, and execute cloud migration projects
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Migration Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g. Q3 Cloud Migration"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-desc">Description</Label>
                  <Textarea
                    id="project-desc"
                    placeholder="Describe the migration scope and goals..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source Environment</Label>
                    <Select value={sourceEnvironment} onValueChange={setSourceEnvironment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENV_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Environment</Label>
                    <Select value={targetEnvironment} onValueChange={setTargetEnvironment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENV_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={createProject.isPending}
                  className="w-full"
                >
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <p className="text-3xl font-bold">{totalProjects}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-3xl font-bold">{inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Workloads</p>
              <p className="text-3xl font-bold">{totalWorkloads}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-1">
                <p className="text-sm text-muted-foreground">Open Risks</p>
                {openRisks > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              </div>
              <p className="text-3xl font-bold">{openRisks}</p>
            </CardContent>
          </Card>
        </div>

        {/* Project Cards or Empty State */}
        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLocation(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg leading-tight line-clamp-2">
                      {project.name}
                    </h3>
                    <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Source → Target */}
                  <div className="flex items-center gap-2 text-sm">
                    {envIcon(project.sourceEnvironment)}
                    <span>{ENV_LABELS[project.sourceEnvironment] ?? project.sourceEnvironment}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    {envIcon(project.targetEnvironment)}
                    <span>{ENV_LABELS[project.targetEnvironment] ?? project.targetEnvironment}</span>
                  </div>

                  {/* Counts */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{project.workloadCount ?? 0} workloads</span>
                    <span className="flex items-center gap-1">
                      {(project.openRiskCount ?? 0) > 0 ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {project.riskCount ?? 0} risks
                    </span>
                  </div>

                  {/* Readiness score */}
                  {project.readinessScore != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Readiness:</span>
                      <span className="font-medium">{project.readinessScore}%</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-600 transition-all"
                          style={{ width: `${project.readinessScore}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Updated date */}
                  {project.updatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="py-16">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Cloud className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No migration projects yet</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Create your first migration project to start planning, assessing workloads, and
                tracking risks for your cloud migration.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first migration project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
