/**
 * ExecutionMonitor — live tracker for agent plan execution
 *
 * Polls /api/agent/plans/:id/status every 2 seconds while executing.
 * Shows step progress, handles approval prompts, and displays final answer.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, XCircle, Loader2, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface StepData {
  id: string;
  orderIndex: number;
  type: string;
  description: string;
  status: string;
  output: string | null;
  confidence: number | null;
}

interface PlanStatusData {
  planId: string;
  status: string;
  query: string;
  stepCount: number;
  steps: StepData[];
  awaitingStepId: string | null;
}

interface ExecutionMonitorProps {
  planId: string;
  onComplete?: (answer: string) => void;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-gray-400", label: "Pending" },
  running: { icon: Loader2, color: "text-amber-500", label: "Running" },
  completed: { icon: CheckCircle, color: "text-green-500", label: "Done" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  skipped: { icon: AlertTriangle, color: "text-gray-400", label: "Skipped" },
};

export function ExecutionMonitor({ planId, onComplete }: ExecutionMonitorProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [approvalComment, setApprovalComment] = useState("");
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);

  const { data: planStatus, refetch } = useQuery<PlanStatusData>({
    queryKey: ["/api/agent/plans", planId, "status"],
    refetchInterval: (query) => {
      const data = query.state.data as PlanStatusData | undefined;
      if (!data) return 2000;
      if (data.status === "executing" || data.status === "approved") return 2000;
      return false;
    },
  });

  // Detect completion
  useEffect(() => {
    if (planStatus?.status === "completed") {
      // Find synthesized answer from the last completed step
      const completedSteps = planStatus.steps.filter((s) => s.status === "completed" && s.output);
      const lastOutput = completedSteps[completedSteps.length - 1]?.output;
      if (lastOutput && !finalAnswer) {
        setFinalAnswer(lastOutput);
        onComplete?.(lastOutput);
      }
    }
  }, [planStatus?.status]);

  const approveStepMutation = useMutation({
    mutationFn: async ({ stepId, approved }: { stepId: string; approved: boolean }) => {
      const res = await apiRequest("POST", `/api/agent/plans/${planId}/steps/${stepId}/approve`, {
        approved,
        comment: approvalComment || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setApprovalComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/agent/plans", planId, "status"] });
    },
  });

  if (!planStatus) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        <span className="text-sm text-[var(--text-secondary)]">Loading execution status...</span>
      </div>
    );
  }

  const completedCount = planStatus.steps.filter((s) => s.status === "completed").length;
  const progressPct = planStatus.stepCount > 0 ? (completedCount / planStatus.stepCount) * 100 : 0;

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--theme-border)] overflow-hidden">
      {/* Header + Progress */}
      <div className="px-4 py-3 border-b border-[var(--theme-border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {planStatus.status === "completed" ? "Research Complete" :
             planStatus.status === "failed" ? "Research Failed" :
             "Researching..."}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {completedCount}/{planStatus.stepCount} steps
          </span>
        </div>
        <div className="w-full h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-[var(--theme-border)]">
        {planStatus.steps.map((step) => {
          const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
          const Icon = config.icon;
          const isExpanded = expandedSteps.has(step.id);
          const isAwaiting = planStatus.awaitingStepId === step.id;

          return (
            <div key={step.id} className="px-4 py-2.5">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => step.output && toggleStep(step.id)}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${config.color} ${step.status === "running" ? "animate-spin" : ""}`} />
                <span className="text-sm text-[var(--text-primary)] flex-1">{step.description}</span>
                {step.output && (
                  isExpanded
                    ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                    : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </div>

              {/* Expanded output */}
              {isExpanded && step.output && (
                <div className="mt-2 ml-7 p-3 bg-[var(--bg-hover)] rounded-lg text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {step.output}
                </div>
              )}

              {/* Approval prompt */}
              {isAwaiting && (
                <div className="mt-2 ml-7 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <p className="text-sm font-medium text-amber-600 mb-2">This step requires your approval</p>
                  <textarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Optional comment..."
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg mb-2 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveStepMutation.mutate({ stepId: step.id, approved: true })}
                      disabled={approveStepMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => approveStepMutation.mutate({ stepId: step.id, approved: false })}
                      disabled={approveStepMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-50"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final Answer */}
      {finalAnswer && (
        <div className="px-4 py-3 border-t border-[var(--theme-border)] bg-green-500/5">
          <p className="text-xs font-semibold text-green-600 mb-2">Synthesized Answer</p>
          <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap prose prose-sm max-w-none">
            {finalAnswer}
          </div>
        </div>
      )}
    </div>
  );
}
