import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { BRANDING } from "@shared/branding";
import BriefIntakeForm from "@/components/BriefIntakeForm";
import CostPreview from "@/components/CostPreview";
import ThemeToggle from "@/components/ThemeToggle";
import DuckyMascot from "@/components/DuckyMascot";
import {
  Flame, Plus, FileText, Clock, CheckCircle, XCircle,
  Loader2, LogOut, Coins, ChevronRight,
} from "lucide-react";

type View = "list" | "intake" | "preview";

export default function HomePage() {
  const [view, setView] = useState<View>("list");
  const [pendingProject, setPendingProject] = useState<any>(null);
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  // Fetch projects
  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ["forge-projects"],
    queryFn: () => apiRequest("/api/forge/projects"),
  });

  // Fetch credit balance
  const { data: credits } = useQuery({
    queryKey: ["forge-credits"],
    queryFn: () => apiRequest("/api/forge/credits"),
  });

  // Create project (intake + estimate)
  const createMutation = useMutation({
    mutationFn: (brief: any) => apiRequest("/api/forge/projects", {
      method: "POST",
      body: JSON.stringify(brief),
    }),
    onSuccess: (data) => {
      setPendingProject(data);
      setView("preview");
    },
  });

  // Approve project
  const approveMutation = useMutation({
    mutationFn: (projectId: string) => apiRequest(`/api/forge/projects/${projectId}/approve`, {
      method: "POST",
    }),
    onSuccess: (_data, projectId) => {
      qc.invalidateQueries({ queryKey: ["forge-projects"] });
      qc.invalidateQueries({ queryKey: ["forge-credits"] });
      navigate(`/project/${projectId}`);
    },
  });

  const projects = projectsData?.projects ?? [];

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "running": case "queued": case "validating": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Forge</span>
          </div>
          <div className="flex items-center gap-4">
            {credits && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Coins className="h-4 w-4" />
                <span>{credits.availableCredits} credits</span>
              </div>
            )}
            <ThemeToggle />
            <button
              onClick={() => signOut()}
              className="p-2 text-muted-foreground hover:text-foreground transition"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* List View */}
        {view === "list" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Your Projects</h1>
                <p className="text-sm text-muted-foreground">Create and manage content with AI</p>
              </div>
              <button
                onClick={() => setView("intake")}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            </div>

            {loadingProjects ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <DuckyMascot state="idle" size="lg" />
                <h2 className="text-lg font-medium">No projects yet</h2>
                <p className="text-muted-foreground">Create your first project to get started.</p>
                <button
                  onClick={() => setView("intake")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Create Project
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/project/${p.id}`)}
                    className="w-full flex items-center justify-between p-4 bg-card rounded-lg border hover:border-primary/50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(p.status)}
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.outputFormat.toUpperCase()} &middot; {new Date(p.createdAt).toLocaleDateString()}
                          {p.qualityScore != null && ` \u00b7 QC: ${Math.round(p.qualityScore * 100)}%`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground capitalize">
                        {p.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brief Intake View */}
        {view === "intake" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">New Project</h1>
              <button
                onClick={() => setView("list")}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <BriefIntakeForm
              onSubmit={(brief) => createMutation.mutate(brief)}
              loading={createMutation.isPending}
            />
            {createMutation.isError && (
              <p className="text-sm text-destructive">
                {(createMutation.error as Error).message}
              </p>
            )}
          </div>
        )}

        {/* Cost Preview */}
        {view === "preview" && pendingProject && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{pendingProject.projectSpec?.title}</h1>
              <button
                onClick={() => { setView("list"); setPendingProject(null); }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <CostPreview
              estimate={pendingProject.costEstimate}
              creditBalance={credits?.availableCredits ?? 0}
              onApprove={() => approveMutation.mutate(pendingProject.project.id)}
              onCancel={() => { setView("list"); setPendingProject(null); }}
              loading={approveMutation.isPending}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          {BRANDING.duckyFooter} &copy; {new Date().getFullYear()} {BRANDING.parentCompany}
        </div>
      </footer>
    </div>
  );
}
