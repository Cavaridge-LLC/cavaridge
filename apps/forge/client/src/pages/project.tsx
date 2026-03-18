import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { BRANDING } from "@shared/branding";
import PipelineProgress from "@/components/PipelineProgress";
import DuckyMascot, { type DuckyState } from "@/components/DuckyMascot";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Flame, ArrowLeft, Download, RefreshCw, Loader2,
  CheckCircle, XCircle, Star, FileText,
} from "lucide-react";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["forge-project", params.id],
    queryFn: () => apiRequest(`/api/forge/projects/${params.id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.project?.status;
      return ["queued", "running", "validating", "revised"].includes(status) ? 3000 : false;
    },
  });

  const reviseMutation = useMutation({
    mutationFn: () => apiRequest(`/api/forge/projects/${params.id}/revise`, {
      method: "POST",
      body: JSON.stringify({ feedback: revisionFeedback }),
    }),
    onSuccess: () => {
      setRevisionFeedback("");
      qc.invalidateQueries({ queryKey: ["forge-project", params.id] });
    },
  });

  const project = data?.project;
  const agentRuns = data?.agentRuns ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <button onClick={() => navigate("/")} className="text-primary hover:underline">
          Back to projects
        </button>
      </div>
    );
  }

  const isRunning = ["queued", "running", "validating", "revised"].includes(project.status);
  const isComplete = project.status === "completed";
  const isFailed = project.status === "failed";
  const metadata = project.metadata as any;

  // Determine pipeline stage from agent runs
  const lastRun = agentRuns[agentRuns.length - 1];
  const currentStage = isComplete ? "complete" : isFailed ? "failed" : (lastRun?.runType ?? "intake");
  const duckyState: DuckyState = isComplete
    ? (project.qualityScore >= 0.75 ? "celebrating" : "concerned")
    : isFailed ? "apologetic"
    : isRunning ? "building"
    : "idle";

  const canRevise = isComplete && project.revisionCount < project.maxFreeRevisions;
  const downloadUrl = project.outputUrl;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Flame className="h-5 w-5 text-primary" />
            <span className="font-semibold">Forge</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Project Title */}
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="uppercase">{project.outputFormat}</span>
            <span>&middot;</span>
            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
            {project.qualityScore != null && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" />
                  QC: {Math.round(project.qualityScore * 100)}%
                </span>
              </>
            )}
          </div>
        </div>

        {/* Pipeline Progress (when running) */}
        {isRunning && (
          <PipelineProgress
            currentStage={currentStage as any}
            duckyState={duckyState}
            message={`Processing... (${agentRuns.length} agent runs completed)`}
          />
        )}

        {/* Completed View */}
        {isComplete && (
          <div className="space-y-6">
            {/* Success Card */}
            <div className="bg-card rounded-xl border p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <h3 className="font-semibold">Document Ready</h3>
                  <p className="text-sm text-muted-foreground">
                    {metadata?.totalWordCount?.toLocaleString() ?? "N/A"} words &middot;
                    Quality score: {Math.round((project.qualityScore ?? 0) * 100)}%
                  </p>
                </div>
              </div>

              <DuckyMascot state={duckyState} size="md" />

              {/* Download */}
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={metadata?.filename ?? "output"}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition"
                >
                  <Download className="h-4 w-4" />
                  Download {project.outputFormat.toUpperCase()}
                </a>
              )}
            </div>

            {/* Revision Panel */}
            <div className="bg-card rounded-xl border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Request Revision</h3>
                <span className="text-xs text-muted-foreground">
                  {project.revisionCount}/{project.maxFreeRevisions} free revisions used
                </span>
              </div>

              <textarea
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Describe what you'd like changed..."
                className="w-full min-h-[80px] px-4 py-3 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none resize-y"
              />

              <button
                onClick={() => reviseMutation.mutate()}
                disabled={reviseMutation.isPending || !revisionFeedback}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg font-medium hover:bg-secondary/80 disabled:opacity-50 transition"
              >
                {reviseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {canRevise ? "Revise (Free)" : "Revise (20% credit cost)"}
              </button>
            </div>
          </div>
        )}

        {/* Failed View */}
        {isFailed && (
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-destructive" />
              <div>
                <h3 className="font-semibold">Pipeline Failed</h3>
                <p className="text-sm text-muted-foreground">
                  {metadata?.error ?? "An unexpected error occurred"}
                </p>
              </div>
            </div>
            <DuckyMascot state="apologetic" size="md" />
          </div>
        )}

        {/* Agent Runs Log */}
        {agentRuns.length > 0 && (
          <div className="bg-card rounded-xl border p-6 space-y-3">
            <h3 className="font-semibold text-sm">Pipeline Log</h3>
            <div className="space-y-1">
              {agentRuns.map((run: any) => (
                <div key={run.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground uppercase">{run.runType}</span>
                    <span className="text-muted-foreground">{run.agentName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      run.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                      run.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    }`}>
                      {run.status}
                    </span>
                    {run.completedAt && run.startedAt && (
                      <span className="text-muted-foreground">
                        {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          {BRANDING.duckyFooter} &copy; {new Date().getFullYear()} {BRANDING.parentCompany}
        </div>
      </footer>
    </div>
  );
}
