/**
 * AgentChatIntegration — toggle between quick answer and deep research mode
 *
 * Manages the agent flow: create plan → review → approve → monitor → answer.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PlanView } from "./plan-view";
import { ExecutionMonitor } from "./execution-monitor";
import { DuckyAnimation } from "@cavaridge/ducky-animations";
import { Brain, Zap } from "lucide-react";

type AgentPhase = "idle" | "generating" | "review" | "executing" | "complete";

interface AgentPlan {
  id: string;
  query: string;
  status: string;
  steps: Array<{
    id: string;
    orderIndex: number;
    type: string;
    description: string;
    dependsOn: string[];
    status: string;
  }>;
  stepCount: number;
}

interface AgentChatIntegrationProps {
  onAgentAnswer: (answer: string, planId: string) => void;
}

export function useAgentMode() {
  const [isAgentMode, setIsAgentMode] = useState(false);
  return { isAgentMode, setIsAgentMode };
}

export function AgentModeToggle({
  isAgentMode,
  onToggle,
}: {
  isAgentMode: boolean;
  onToggle: (mode: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!isAgentMode)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        isAgentMode
          ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
          : "bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-transparent hover:border-[var(--theme-border)]"
      }`}
      title={isAgentMode ? "Switch to quick answer" : "Switch to deep research"}
    >
      {isAgentMode ? (
        <>
          <Brain className="w-3.5 h-3.5" />
          Deep Research
        </>
      ) : (
        <>
          <Zap className="w-3.5 h-3.5" />
          Quick Answer
        </>
      )}
    </button>
  );
}

export function AgentChatIntegration({ onAgentAnswer }: AgentChatIntegrationProps) {
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createPlanMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/agent/plan", { query });
      return res.json() as Promise<AgentPlan>;
    },
    onSuccess: (data) => {
      setPlan(data);
      setPhase("review");
    },
    onError: (err: Error) => {
      setError(err.message);
      setPhase("idle");
    },
  });

  const approvePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest("POST", `/api/agent/plans/${planId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      setPhase("executing");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const rejectPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest("POST", `/api/agent/plans/${planId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      setPlan(null);
      setPhase("idle");
    },
  });

  const startResearch = (query: string) => {
    setError(null);
    setPhase("generating");
    createPlanMutation.mutate(query);
  };

  const reset = () => {
    setPlan(null);
    setPhase("idle");
    setError(null);
  };

  return {
    phase,
    plan,
    error,
    startResearch,
    reset,
    renderAgent: () => {
      if (phase === "generating") {
        return (
          <div className="flex items-center gap-3 py-4 px-4 bg-[var(--bg-card)] rounded-xl border border-[var(--theme-border)]">
            <DuckyAnimation state="thinking" size="sm" />
            <span className="text-sm text-[var(--text-secondary)]">Ducky is planning your research...</span>
          </div>
        );
      }

      if (phase === "review" && plan) {
        return (
          <PlanView
            planId={plan.id}
            query={plan.query}
            steps={plan.steps}
            status={plan.status}
            onApprove={() => approvePlanMutation.mutate(plan.id)}
            onReject={() => rejectPlanMutation.mutate(plan.id)}
            isApproving={approvePlanMutation.isPending}
          />
        );
      }

      if (phase === "executing" && plan) {
        return (
          <ExecutionMonitor
            planId={plan.id}
            onComplete={(answer) => {
              setPhase("complete");
              onAgentAnswer(answer, plan.id);
            }}
          />
        );
      }

      if (error) {
        return (
          <div className="py-3 px-4 bg-red-500/5 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={reset}
              className="mt-2 text-xs text-red-600 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        );
      }

      return null;
    },
  };
}
