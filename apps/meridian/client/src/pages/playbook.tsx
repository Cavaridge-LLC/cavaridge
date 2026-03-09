import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ListChecks,
  AlertTriangle,
  DollarSign,
  Clock,
  Users,
  ChevronDown,
  Zap,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { Deal, PlaybookPhase, PlaybookTask } from "@shared/schema";

type PhaseWithTasks = PlaybookPhase & { tasks: PlaybookTask[] };

const statusStyles: Record<string, { border: string; badge: string; badgeBg: string; label: string }> = {
  ready: { border: "#3B82F6", badge: "#3B82F6", badgeBg: "rgba(59,130,246,0.12)", label: "Ready" },
  active: { border: "#F59E0B", badge: "#F59E0B", badgeBg: "rgba(245,158,11,0.12)", label: "Active" },
  pending: { border: "#4B5563", badge: "var(--text-disabled)", badgeBg: "rgba(107,114,128,0.12)", label: "Pending" },
  complete: { border: "#10B981", badge: "#10B981", badgeBg: "rgba(16,185,129,0.12)", label: "Complete" },
};

function taskDotColor(task: PlaybookTask): string {
  if (task.isCriticalPath) return "#EF4444";
  if (task.status === "complete") return "#10B981";
  if (task.status === "in-progress") return "#F59E0B";
  return "#4B5563";
}

function PhaseCard({ phase }: { phase: PhaseWithTasks }) {
  const style = statusStyles[phase.status] || statusStyles.pending;
  const completedCount = phase.tasks.filter(t => t.status === "complete").length;

  return (
    <Card
      className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 flex-shrink-0 flex flex-col"
      style={{ minWidth: 220, maxWidth: 260, borderTopWidth: 3, borderTopColor: style.border }}
      data-testid={`phase-card-${phase.sortOrder}`}
    >
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{phase.phaseName}</h3>
          <Badge
            className="text-[10px] px-2 py-0.5 no-default-hover-elevate no-default-active-elevate border"
            style={{ backgroundColor: style.badgeBg, color: style.badge, borderColor: `${style.badge}30` }}
            data-testid={`badge-phase-${phase.status}`}
          >
            {style.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-[var(--text-disabled)] font-data">{phase.timeRange}</span>
          {phase.tasks.length > 0 && (
            <span className="text-[10px] text-[var(--text-disabled)] font-data">
              {completedCount}/{phase.tasks.length}
            </span>
          )}
        </div>

        <div className="space-y-2 flex-1">
          {phase.tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2" data-testid={`task-${task.taskName}`}>
              <div
                className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: taskDotColor(task) }}
              />
              <span
                className={`text-xs leading-snug ${
                  task.status === "complete" ? "text-[var(--text-disabled)] line-through" : "text-[var(--text-secondary)]"
                }`}
              >
                {task.taskName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function PlaybookPage() {
  const { toast } = useToast();
  const { data: dealsList = [] } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const activeDeal = dealsList.find((d) => d.id === selectedDealId) || dealsList[0];
  const dealId = activeDeal?.id;

  const { data: phases = [], isLoading } = useQuery<PhaseWithTasks[]>({
    queryKey: ["/api/deals", dealId, "playbook"],
    enabled: !!dealId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/deals/${dealId}/generate-playbook`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "playbook"] });
      toast({ title: "Playbook generated", description: `Created ${data.phaseCount} phases with ${data.taskCount} tasks.` });
    },
    onError: (error: any) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const allTasks = phases.flatMap((p) => p.tasks);
  const totalTasks = allTasks.length;
  const criticalPathCount = allTasks.filter((t) => t.isCriticalPath).length;
  const completedTasks = allTasks.filter(t => t.status === "complete").length;

  const timelineText = phases.length > 0
    ? phases[phases.length - 1]?.timeRange?.split("-").pop()?.trim() || "TBD"
    : "TBD";

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]" data-testid="text-playbook-title">Integration Playbook</h1>
            <Badge
              className="text-[10px] px-2 py-0.5 no-default-hover-elevate no-default-active-elevate border"
              style={{ backgroundColor: "rgba(139,92,246,0.10)", color: "#8B5CF6", borderColor: "rgba(139,92,246,0.2)" }}
            >
              AI-Powered
            </Badge>
          </div>
          <p className="text-xs text-[var(--text-disabled)] mt-0.5">
            Structured integration methodology and task sequencing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={dealId || ""}
              onChange={(e) => setSelectedDealId(e.target.value)}
              className="appearance-none bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-md px-3 py-1.5 pr-8 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#3B82F6]/50"
              data-testid="select-deal"
            >
              {dealsList.map((d) => (
                <option key={d.id} value={d.id}>{d.targetName}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-disabled)] pointer-events-none" />
          </div>
          {phases.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="h-8 text-xs gap-1.5"
              data-testid="button-regenerate-playbook"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {phases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="kpi-strip">
          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#3B82F6]/10">
                <ListChecks className="w-4 h-4 text-[#3B82F6]" />
              </div>
              <span className="text-[10px] text-[var(--text-disabled)]">Total Tasks</span>
            </div>
            <p className="font-data text-2xl font-bold text-[var(--text-primary)]" data-testid="kpi-total-tasks">{totalTasks}</p>
          </Card>

          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#10B981]/10">
                <ListChecks className="w-4 h-4 text-[#10B981]" />
              </div>
              <span className="text-[10px] text-[var(--text-disabled)]">Completed</span>
            </div>
            <p className="font-data text-2xl font-bold text-[var(--text-primary)]" data-testid="kpi-completed">{completedTasks}</p>
          </Card>

          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#EF4444]/10">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              </div>
              <span className="text-[10px] text-[var(--text-disabled)]">Critical Path</span>
            </div>
            <p className="font-data text-2xl font-bold text-[var(--text-primary)]" data-testid="kpi-critical-path">{criticalPathCount}</p>
          </Card>

          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#8B5CF6]/10">
                <DollarSign className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <span className="text-[10px] text-[var(--text-disabled)]">Phases</span>
            </div>
            <p className="font-data text-2xl font-bold text-[var(--text-primary)]" data-testid="kpi-phases">{phases.length}</p>
          </Card>

          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#F59E0B]/10">
                <Clock className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <span className="text-[10px] text-[var(--text-disabled)]">Timeline</span>
            </div>
            <p className="font-data text-2xl font-bold text-[var(--text-primary)]" data-testid="kpi-timeline">{timelineText}</p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin" />
          <span className="text-xs text-[var(--text-disabled)]">Loading playbook...</span>
        </div>
      ) : phases.length === 0 ? (
        <Card className="bg-gradient-to-r from-[#8B5CF6]/5 to-[#3B82F6]/5 border-[#8B5CF6]/20 p-6" data-testid="banner-generate-playbook">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#8B5CF6]/10 shrink-0">
              <Zap className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">No playbook generated yet</h3>
              <p className="text-xs text-[var(--text-disabled)] mb-3">
                MERIDIAN can analyze your deal documents, findings, and infrastructure data to generate
                a tailored integration playbook with phased tasks and critical path identification.
              </p>
              <Button
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !dealId}
                className="h-8 text-xs gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED]"
                data-testid="button-generate-playbook"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Generate Integration Playbook
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-2" data-testid="phases-scroll-container">
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {phases.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
