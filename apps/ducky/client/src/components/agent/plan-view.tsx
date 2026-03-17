/**
 * PlanView — displays a generated research plan for user review/approval
 */

import { CheckCircle, XCircle, BookOpen, Brain, Pencil, Trash2, ArrowRight } from "lucide-react";

interface PlanStep {
  id: string;
  orderIndex: number;
  type: string;
  description: string;
  dependsOn: string[];
  status: string;
}

interface PlanViewProps {
  planId: string;
  query: string;
  steps: PlanStep[];
  status: string;
  onApprove: () => void;
  onReject: () => void;
  isApproving?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof BookOpen }> = {
  read: { label: "Research", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: BookOpen },
  reason: { label: "Analyze", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Brain },
  write: { label: "Write", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Pencil },
  delete: { label: "Delete", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: Trash2 },
};

export function PlanView({ planId, query, steps, status, onApprove, onReject, isApproving }: PlanViewProps) {
  const isPending = status === "pending_approval";

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--theme-border)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--bg-hover)]">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Research Plan</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
            {steps.length} steps
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{query}</p>
      </div>

      {/* Steps */}
      <div className="px-4 py-3 space-y-2">
        {steps.map((step, i) => {
          const config = TYPE_CONFIG[step.type] || TYPE_CONFIG.reason;
          const Icon = config.icon;
          const deps = step.dependsOn.length > 0
            ? steps.filter((s) => step.dependsOn.includes(s.id)).map((s) => s.orderIndex + 1)
            : [];

          return (
            <div key={step.id} className="flex items-start gap-3 py-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                  {deps.length > 0 && (
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-0.5">
                      <ArrowRight className="w-3 h-3" />
                      after step{deps.length > 1 ? "s" : ""} {deps.join(", ")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-primary)]">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="px-4 py-3 border-t border-[var(--theme-border)] flex items-center justify-end gap-2">
          <button
            onClick={onReject}
            disabled={isApproving}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={isApproving}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isApproving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Approve & Run
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
