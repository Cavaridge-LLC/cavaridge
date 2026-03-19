import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import RiskBadge from "@/components/RiskBadge";
import DuckyMascot from "@/components/DuckyMascot";
import { ArrowLeft, CheckCircle, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function AssessmentDetailPage() {
  const [, params] = useRoute("/assessments/:id");
  const id = params?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => apiRequest(`/api/assessments/${id}`),
    enabled: !!id,
  });

  const { data: reportsData } = useQuery({
    queryKey: ["assessment-reports", id],
    queryFn: () => apiRequest(`/api/assessments/${id}/reports`),
    enabled: !!id,
  });

  const generateReport = useMutation({
    mutationFn: (reportType: string) => apiRequest(`/api/assessments/${id}/reports`, {
      method: "POST",
      body: JSON.stringify({ reportType }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assessment-reports", id] }),
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/assessments/${id}/approve`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assessment", id] }),
  });

  if (isLoading) return <div className="flex justify-center p-8"><DuckyMascot state="thinking" size="lg" /></div>;

  const assessment = data?.assessment;
  const controls = data?.controls || [];
  const reports = reportsData?.reports || [];

  if (!assessment) return <div className="p-8 text-center text-muted-foreground">Assessment not found.</div>;

  const implemented = controls.filter((c: any) => c.currentState === "implemented").length;
  const complianceRate = controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0;
  const findings = controls.filter((c: any) => c.currentState !== "implemented");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "controls", label: `Controls (${controls.length})` },
    { id: "findings", label: `Findings (${findings.length})` },
    { id: "reports", label: `Reports (${reports.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <button className="p-2 rounded-lg hover:bg-muted transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{assessment.title}</h1>
          <p className="text-sm text-muted-foreground">
            {assessment.framework?.replace("_", " ")} &middot; {assessment.status?.replace("_", " ")} &middot; Created {new Date(assessment.createdAt).toLocaleDateString()}
          </p>
        </div>
        {assessment.status === "completed" && (
          <button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <CheckCircle className="h-4 w-4" />
            {approveMutation.isPending ? "Approving..." : "Approve"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-primary">{complianceRate}%</p>
            <p className="text-sm text-muted-foreground mt-1">Compliance Rate</p>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold">{controls.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Controls</p>
          </div>
          <div className="bg-card rounded-xl border p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{findings.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Open Findings</p>
          </div>

          {/* Gap analysis by category */}
          {["administrative", "physical", "technical"].map(cat => {
            const catControls = controls.filter((c: any) => c.category === cat);
            const catImpl = catControls.filter((c: any) => c.currentState === "implemented").length;
            const pct = catControls.length > 0 ? Math.round((catImpl / catControls.length) * 100) : 0;
            return (
              <div key={cat} className="bg-card rounded-xl border p-4">
                <h3 className="font-medium capitalize">{cat} Safeguards</h3>
                <div className="mt-2 w-full bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{catImpl}/{catControls.length} implemented ({pct}%)</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Controls tab */}
      {activeTab === "controls" && (
        <div className="bg-card rounded-xl border divide-y">
          {controls.map((c: any) => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <span className="text-xs font-mono text-muted-foreground">{c.controlRef}</span>
                <p className="text-sm font-medium">{c.controlName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-xs px-2 py-1 rounded capitalize",
                  c.currentState === "implemented" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : c.currentState === "partial" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                )}>
                  {c.currentState?.replace("_", " ")}
                </span>
                {c.riskLevel && c.currentState !== "implemented" && <RiskBadge level={c.riskLevel} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Findings tab */}
      {activeTab === "findings" && (
        <div className="bg-card rounded-xl border divide-y">
          {findings.length === 0 ? (
            <div className="p-8 text-center">
              <DuckyMascot state="celebrating" />
              <p className="mt-2 text-muted-foreground">No open findings. All controls are implemented.</p>
            </div>
          ) : (
            findings.sort((a: any, b: any) => (b.riskScore || 0) - (a.riskScore || 0)).map((c: any) => (
              <div key={c.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-muted-foreground">{c.controlRef}</span>
                    <p className="font-medium">{c.controlName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={c.riskLevel || "low"} />
                    <span className="text-xs text-muted-foreground">{c.riskScore || 0}/25</span>
                  </div>
                </div>
                {c.findingDetail && <p className="text-sm text-muted-foreground mt-2">{c.findingDetail}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Reports tab */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {["executive_summary", "detailed", "gap_analysis", "risk_register"].map(type => (
              <button
                key={type}
                onClick={() => generateReport.mutate(type)}
                disabled={generateReport.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition"
              >
                <FileText className="h-3 w-3" />
                {type.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="bg-card rounded-xl border divide-y">
            {reports.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No reports generated yet. Select a report type above.
              </div>
            ) : (
              reports.map((r: any) => (
                <Link key={r.id} href={`/reports/${r.id}`}>
                  <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition cursor-pointer">
                    <div>
                      <p className="font-medium capitalize">{r.reportType?.replace("_", " ")}</p>
                      <p className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
