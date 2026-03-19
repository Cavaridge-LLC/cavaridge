import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import RiskBadge from "@/components/RiskBadge";
import DuckyMascot from "@/components/DuckyMascot";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  verified: "Verified",
};

const PRIORITY_LABELS: Record<number, { label: string; level: string }> = {
  5: { label: "Critical", level: "critical" },
  4: { label: "High", level: "high" },
  3: { label: "Medium", level: "medium" },
  2: { label: "Low", level: "low" },
  1: { label: "Info", level: "low" },
};

export default function RemediationPage() {
  const { data: statsData } = useQuery({
    queryKey: ["remediation-stats"],
    queryFn: () => apiRequest("/api/remediation/dashboard"),
  });

  const { data: assessmentsData } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => apiRequest("/api/assessments"),
  });

  const assessments = assessmentsData?.assessments || [];
  const stats = statsData?.stats;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Remediation Tracker</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.completed + stats.verified}</p>
            <p className="text-xs text-muted-foreground">Done</p>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>
      )}

      {/* Per-assessment remediation */}
      {assessments.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <DuckyMascot state="idle" />
          <p className="mt-4 text-muted-foreground">No remediation items yet. Complete an assessment first.</p>
        </div>
      ) : (
        assessments.map((assessment: any) => (
          <AssessmentRemediationSection key={assessment.id} assessment={assessment} />
        ))
      )}
    </div>
  );
}

function AssessmentRemediationSection({ assessment }: { assessment: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["remediation", assessment.id],
    queryFn: () => apiRequest(`/api/assessments/${assessment.id}/remediation`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      apiRequest(`/api/remediation/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remediation", assessment.id] });
      queryClient.invalidateQueries({ queryKey: ["remediation-stats"] });
    },
  });

  const items = data?.items || [];

  if (isLoading || items.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border">
      <div className="p-4 border-b">
        <h2 className="font-semibold">{assessment.title}</h2>
        <p className="text-xs text-muted-foreground">{items.length} remediation items</p>
      </div>
      <div className="divide-y">
        {items.map((item: any) => {
          const now = new Date();
          const isOverdue = item.dueDate && new Date(item.dueDate) < now && item.status !== "completed" && item.status !== "verified";
          const priority = PRIORITY_LABELS[item.priority] || PRIORITY_LABELS[3];

          return (
            <div key={item.id} className={cn("p-4 flex items-center gap-4", isOverdue && "bg-destructive/5")}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{item.title}</p>
                  <RiskBadge level={priority.level} />
                  {isOverdue && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Overdue
                    </span>
                  )}
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                {item.dueDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {new Date(item.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <select
                value={item.status}
                onChange={(e) => updateMutation.mutate({ itemId: item.id, status: e.target.value })}
                className="px-2 py-1 text-xs rounded border bg-background"
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
