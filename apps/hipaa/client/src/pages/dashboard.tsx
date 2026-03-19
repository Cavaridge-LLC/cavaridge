import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import RiskBadge from "@/components/RiskBadge";
import DuckyMascot from "@/components/DuckyMascot";
import {
  ClipboardCheck, AlertTriangle, CheckCircle, Clock,
  Plus, ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiRequest("/api/dashboard/summary"),
  });

  const { data: assessmentsData } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => apiRequest("/api/assessments?limit=5"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <DuckyMascot state="thinking" size="lg" />
      </div>
    );
  }

  const summary = data?.summary;
  const assessments = assessmentsData?.assessments || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">HIPAA Compliance Dashboard</h1>
          <p className="text-muted-foreground">Monitor your security risk assessment status</p>
        </div>
        <Link href="/assessments/new">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
            <Plus className="h-4 w-4" />
            New Assessment
          </button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{summary?.totalAssessments || 0}</p>
              <p className="text-sm text-muted-foreground">Total Assessments</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{summary?.openFindings?.total || 0}</p>
              <p className="text-sm text-muted-foreground">Open Findings</p>
            </div>
          </div>
          {summary?.openFindings && (
            <div className="flex gap-2 mt-2">
              {summary.openFindings.critical > 0 && <RiskBadge level="critical" />}
              {summary.openFindings.high > 0 && <RiskBadge level="high" />}
              {summary.openFindings.medium > 0 && <RiskBadge level="medium" />}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{summary?.remediation?.overdue || 0}</p>
              <p className="text-sm text-muted-foreground">Overdue Items</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{summary?.complianceRate || 0}%</p>
              <p className="text-sm text-muted-foreground">Compliance Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Assessments */}
      <div className="bg-card rounded-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Recent Assessments</h2>
        </div>
        {assessments.length === 0 ? (
          <div className="p-8 text-center">
            <DuckyMascot state="idle" size="md" />
            <p className="mt-4 text-muted-foreground">No assessments yet. Start your first HIPAA risk assessment.</p>
            <Link href="/assessments/new">
              <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
                Start Assessment
              </button>
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {assessments.map((a: any) => (
              <Link key={a.id} href={`/assessments/${a.id}`}>
                <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition cursor-pointer">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.framework?.replace("_", " ")} &middot; {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize">
                      {a.status?.replace("_", " ")}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {data?.recentActivity && data.recentActivity.length > 0 && (
        <div className="bg-card rounded-xl border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y">
            {data.recentActivity.slice(0, 5).map((a: any) => (
              <div key={a.id} className="p-3 px-4 text-sm">
                <span className="text-muted-foreground">{a.action?.replace(/_/g, " ")}</span>
                {a.createdAt && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
