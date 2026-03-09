import { useState, type CSSProperties } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type PlanTier } from "@/lib/auth";
import { PlanLimitModal } from "@/components/plan-limit-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  BarChart3,
  AlertTriangle,
  DollarSign,
  FileText,
  Building2,
  Users,
  ArrowRight,
  Plus,
  CircleDot,
} from "lucide-react";
import type { Deal } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PipelineStats {
  activeDeals: number;
  avgItScore: number;
  openAlerts: number;
  estIntegration: string;
  docsAnalyzed: number;
  docsUploaded: number;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ahead: "#10B981",
    "on-track": "#3B82F6",
    "at-risk": "#EF4444",
    blocked: "#EF4444",
  };
  return (
    <div
      className="w-[7px] h-[7px] rounded-full flex-shrink-0"
      style={{
        backgroundColor: colors[status] || "var(--text-disabled)",
        boxShadow: `0 0 6px ${colors[status] || "var(--text-disabled)"}40`,
      }}
      data-testid={`status-dot-${status}`}
    />
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  const radius = 28;
  const strokeWidth = 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const viewSize = (radius + strokeWidth) * 2;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 72, height: 72 }}>
      <svg className="-rotate-90" width={72} height={72} viewBox={`0 0 ${viewSize} ${viewSize}`}>
        <circle
          cx={viewSize / 2} cy={viewSize / 2} r={radius}
          fill="none" stroke="var(--theme-border)" strokeWidth={strokeWidth}
        />
        <circle
          cx={viewSize / 2} cy={viewSize / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          className="gauge-animate"
          style={{
            "--gauge-circumference": String(circumference),
            "--gauge-offset": String(offset),
          } as CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data text-base font-bold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[8px] text-[var(--text-disabled)] mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function KpiCard({ label, value, valueColor, icon: Icon, iconBg }: {
  label: string;
  value: string;
  valueColor: string;
  icon: any;
  iconBg: string;
}) {
  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4 flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--text-disabled)] mb-1.5 truncate">{label}</p>
          <p className="font-data text-xl font-bold leading-none truncate" style={{ color: valueColor }}>
            {value}
          </p>
        </div>
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-4 h-4" style={{ color: valueColor }} />
        </div>
      </div>
    </Card>
  );
}

function KpiStrip({ stats, isLoading }: { stats?: PipelineStats; isLoading: boolean }) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4 animate-pulse">
            <div className="h-3 bg-[var(--bg-panel)] rounded w-20 mb-3" />
            <div className="h-6 bg-[var(--bg-panel)] rounded w-14" />
          </Card>
        ))}
      </div>
    );
  }

  const scoreColor = stats.avgItScore >= 80 ? "#10B981" : stats.avgItScore >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="kpi-strip">
      <KpiCard
        label="Active Deals"
        value={String(stats.activeDeals)}
        valueColor="#3B82F6"
        icon={Activity}
        iconBg="#3B82F6/10"
      />
      <KpiCard
        label="Avg IT Score"
        value={String(stats.avgItScore)}
        valueColor={scoreColor}
        icon={BarChart3}
        iconBg={`${scoreColor}15`}
      />
      <KpiCard
        label="Open Alerts"
        value={String(stats.openAlerts)}
        valueColor="#EF4444"
        icon={AlertTriangle}
        iconBg="#EF4444/10"
      />
      <KpiCard
        label="Est. Integration"
        value={stats.estIntegration}
        valueColor="#8B5CF6"
        icon={DollarSign}
        iconBg="#8B5CF6/10"
      />
      <KpiCard
        label="Docs Analyzed"
        value={`${stats.docsAnalyzed} / ${stats.docsUploaded}`}
        valueColor="#06B6D4"
        icon={FileText}
        iconBg="#06B6D4/10"
      />
    </div>
  );
}

function DocProgressBar({ analyzed, uploaded }: { analyzed: number; uploaded: number }) {
  const pct = uploaded > 0 ? Math.round((analyzed / uploaded) * 100) : 0;
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--text-disabled)]">Document Analysis</span>
        <span className="font-data text-[10px] text-[var(--text-secondary)]">
          {analyzed} / {uploaded}
          <span className="text-[var(--text-disabled)] ml-1">({pct}%)</span>
        </span>
      </div>
      <div className="h-1 bg-[var(--theme-border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#3B82F6] rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const score = Number(deal.compositeScore) || 0;

  return (
    <Card
      className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4 cursor-pointer hover-elevate group transition-all duration-150"
      onClick={onClick}
      data-testid={`deal-card-${deal.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] font-data border-[#3B82F6]/30 text-[#3B82F6] px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate"
              data-testid={`badge-deal-code-${deal.id}`}
            >
              {deal.dealCode}
            </Badge>
            <StatusDot status={deal.status} />
            <span className="text-[11px] text-[var(--text-secondary)] capitalize">{deal.status.replace("-", " ")}</span>
          </div>

          <h3
            className="text-[15px] font-semibold text-[var(--text-primary)] mb-1 leading-snug"
            data-testid={`text-deal-name-${deal.id}`}
          >
            {deal.targetName}
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] font-data border-[#06B6D4]/25 text-[#06B6D4] bg-[#06B6D4]/5 px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate"
            >
              {deal.industry}
            </Badge>
            <span className="text-[11px] text-[var(--text-disabled)]">{deal.stage}</span>
            {(() => {
              const LIFECYCLE_LABELS: Record<string, string> = {
                screening: "Screening",
                assessment: "Assessment",
                day1_readiness: "Day-1 Ready",
                integration: "Integration",
                monitoring: "Monitoring",
              };
              const LIFECYCLE_COLORS: Record<string, string> = {
                screening: "#F59E0B",
                assessment: "#3B82F6",
                day1_readiness: "#10B981",
                integration: "#8B5CF6",
                monitoring: "#6B7280",
              };
              const stage = (deal as any).lifecycleStage || "assessment";
              const color = LIFECYCLE_COLORS[stage] || "#6B7280";
              const label = LIFECYCLE_LABELS[stage] || stage;
              return (
                <Badge
                  variant="outline"
                  className="text-[10px] font-data px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate"
                  style={{ borderColor: `${color}40`, color, backgroundColor: `${color}10` }}
                  data-testid={`badge-lifecycle-${deal.id}`}
                >
                  {label}
                </Badge>
              );
            })()}
          </div>

          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
              <span className="font-data text-[11px] text-[var(--text-secondary)]" data-testid={`text-facilities-${deal.id}`}>
                {deal.facilityCount} facilities
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
              <span className="font-data text-[11px] text-[var(--text-secondary)]" data-testid={`text-users-${deal.id}`}>
                {(deal.userCount || 0).toLocaleString()} users
              </span>
            </div>
          </div>

          <DocProgressBar
            analyzed={deal.documentsAnalyzed || 0}
            uploaded={deal.documentsUploaded || 0}
          />
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="relative">
            <ScoreGauge score={score} />
            {deal.overallConfidence && (deal.overallConfidence === "insufficient" || deal.overallConfidence === "low") && (
              <div
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#F59E0B20" }}
                title={`Low evidence confidence — pillars not fully assessed`}
                data-testid={`icon-confidence-warning-${deal.id}`}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-[#F59E0B]" />
              </div>
            )}
            {deal.overallConfidence === "moderate" && (
              <div
                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#3B82F620" }}
                title="Moderate evidence coverage"
                data-testid={`icon-confidence-moderate-${deal.id}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
              </div>
            )}
          </div>
          <div className="text-right">
            <p
              className="font-data text-sm font-semibold text-[#8B5CF6]"
              data-testid={`text-cost-${deal.id}`}
            >
              {deal.estimatedIntegrationCost}
            </p>
            <p className="text-[10px] text-[var(--text-disabled)]">Est. Integration</p>
          </div>
        </div>

        <div className="flex items-center self-center ml-1 flex-shrink-0">
          <ArrowRight className="w-4 h-4 text-[var(--text-disabled)] opacity-0 group-hover:opacity-100 transition-opacity invisible group-hover:visible" />
        </div>
      </div>
    </Card>
  );
}

const INDUSTRIES = [
  "Healthcare",
  "Financial Services",
  "Manufacturing",
  "Technology/SaaS",
  "Retail",
  "Professional Services",
];

const STAGES = [
  "Initial Screening",
  "Due Diligence",
  "Technical Assessment",
  "Negotiation",
  "Integration Planning",
  "Closed",
];

function parseLimitError(err: Error): { limitType: string; current: number; limit: number; planTier: PlanTier } | null {
  try {
    const match = err.message.match(/^\d+:\s*(.*)/);
    if (!match) return null;
    const body = JSON.parse(match[1]);
    if (body.limitType) return { limitType: body.limitType, current: body.current ?? 0, limit: body.limit ?? 0, planTier: (body.planTier || "starter") as PlanTier };
  } catch {}
  return null;
}

function NewDealModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [targetName, setTargetName] = useState("");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("Initial Screening");
  const [facilityCount, setFacilityCount] = useState("");
  const [userCount, setUserCount] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [limitInfo, setLimitInfo] = useState<{ limitType: string; current: number; limit: number; planTier: PlanTier } | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deals", {
        targetName,
        industry,
        stage,
        facilityCount: parseInt(facilityCount) || 0,
        userCount: parseInt(userCount) || 0,
        estimatedIntegrationCost: estimatedCost || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stats"] });
      toast({ title: "Deal created", description: `${targetName} added to pipeline` });
      onOpenChange(false);
      setTargetName("");
      setIndustry("");
      setStage("Initial Screening");
      setFacilityCount("");
      setUserCount("");
      setEstimatedCost("");
    },
    onError: (err: Error) => {
      const limit = parseLimitError(err);
      if (limit) {
        setLimitInfo(limit);
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  const canSubmit = targetName.trim() && industry && stage;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] text-[var(--text-primary)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base">New Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Target Name</Label>
            <Input
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="e.g. Acme Corporation"
              className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm placeholder:text-[#4B5563]"
              data-testid="input-target-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-sm text-[var(--text-primary)]"
                data-testid="select-industry"
              >
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind} className="text-xs text-[var(--text-primary)]">
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-sm text-[var(--text-primary)]"
                data-testid="select-stage"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs text-[var(--text-primary)]">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">Facility Count</Label>
              <Input
                type="number"
                value={facilityCount}
                onChange={(e) => setFacilityCount(e.target.value)}
                placeholder="0"
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data placeholder:text-[#4B5563]"
                data-testid="input-facility-count"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">User Count</Label>
              <Input
                type="number"
                value={userCount}
                onChange={(e) => setUserCount(e.target.value)}
                placeholder="0"
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data placeholder:text-[#4B5563]"
                data-testid="input-user-count"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Est. Integration Cost</Label>
            <Input
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="e.g. $2.5M"
              className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data placeholder:text-[#4B5563]"
              data-testid="input-estimated-cost"
            />
          </div>

          <Button
            className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            data-testid="button-create-deal"
          >
            {createMutation.isPending ? "Creating..." : "Create Deal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    {limitInfo && (
      <PlanLimitModal
        open={!!limitInfo}
        onClose={() => setLimitInfo(null)}
        limitType={limitInfo.limitType}
        current={limitInfo.current}
        limit={limitInfo.limit}
        planTier={limitInfo.planTier}
      />
    )}
    </>
  );
}

function DealCardSkeleton() {
  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-[18px] w-24 bg-[var(--bg-panel)] rounded" />
            <div className="w-2 h-2 rounded-full bg-[var(--bg-panel)]" />
          </div>
          <div className="h-5 bg-[var(--bg-panel)] rounded w-56" />
          <div className="h-[18px] bg-[var(--bg-panel)] rounded w-36" />
          <div className="flex items-center gap-4 mt-2">
            <div className="h-3 bg-[var(--bg-panel)] rounded w-24" />
            <div className="h-3 bg-[var(--bg-panel)] rounded w-20" />
          </div>
          <div className="h-1 bg-[var(--bg-panel)] rounded-full w-full mt-2" />
        </div>
        <div className="w-[72px] h-[72px] rounded-full bg-[var(--bg-panel)]" />
      </div>
    </Card>
  );
}

export default function PipelinePage() {
  const [, setLocation] = useLocation();
  const [newDealOpen, setNewDealOpen] = useState(false);
  const { hasPermission } = useAuth();

  const { data: deals, isLoading: dealsLoading, isError: dealsError } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/pipeline-stats"],
  });

  const activeDeals = deals?.filter((d) => d.stage !== "Closed") || [];

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]" data-testid="text-pipeline-title">
            Deal Pipeline
          </h1>
          <p className="text-xs text-[var(--text-disabled)] mt-0.5">
            Active acquisitions and integration assessments
          </p>
        </div>
        {hasPermission("create_deals") && (
          <Button
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm gap-1.5"
            onClick={() => setNewDealOpen(true)}
            data-testid="button-new-deal"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </Button>
        )}
      </div>

      <NewDealModal open={newDealOpen} onOpenChange={setNewDealOpen} />

      <KpiStrip stats={stats} isLoading={statsLoading} />

      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Active Deals</h2>
          <span className="font-data text-[11px] text-[var(--text-disabled)]">
            {activeDeals.length} deal{activeDeals.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="space-y-3" data-testid="deal-list">
          {dealsError ? (
            <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-8">
              <div className="flex flex-col items-center justify-center text-[var(--text-disabled)]">
                <AlertTriangle className="w-6 h-6 mb-2 text-[#F59E0B]" />
                <p className="text-xs text-[var(--text-secondary)]">Unable to load deals. Please try again later.</p>
              </div>
            </Card>
          ) : dealsLoading ? (
            Array.from({ length: 5 }).map((_, i) => <DealCardSkeleton key={i} />)
          ) : activeDeals.length > 0 ? (
            activeDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => setLocation(`/risk?deal=${deal.id}`)}
              />
            ))
          ) : (
            <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-12">
              <div className="flex flex-col items-center justify-center text-[var(--text-disabled)]">
                <FileText className="w-8 h-8 mb-3 text-[var(--theme-border)]" />
                <p className="text-sm">No active deals</p>
                <p className="text-xs mt-1">Deals will appear here once created</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
