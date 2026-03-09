import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  TrendingUp,
  BarChart3,
  Grid3x3,
  Loader2,
  Lock,
  FileText,
  Target,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import type { Deal } from "@shared/schema";
import { useAuth } from "@/lib/auth";

const LIFECYCLE_STAGES = [
  { key: "all", label: "All" },
  { key: "screening", label: "Screening", color: "#F59E0B" },
  { key: "assessment", label: "Assessment", color: "#3B82F6" },
  { key: "day1_readiness", label: "Day-1 Ready", color: "#10B981" },
  { key: "integration", label: "Integration", color: "#8B5CF6" },
  { key: "monitoring", label: "Monitoring", color: "#6B7280" },
] as const;

interface TrendPoint {
  month: string;
  score: number;
}

interface PillarMatrix {
  deals: Array<{ id: string; name: string; compositeScore: string | null }>;
  pillarNames: string[];
  matrix: Record<string, Record<string, string | null>>;
}

function scoreColor(score: number, scale: "100" | "5" = "100"): string {
  if (scale === "5") {
    if (score >= 4.0) return "#10B981";
    if (score >= 3.0) return "#F59E0B";
    return "#EF4444";
  }
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

function TrendTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-md px-3 py-2 text-xs shadow-lg">
        <p className="text-[var(--text-primary)] font-medium">{payload[0].payload.month}</p>
        <p className="text-[var(--text-secondary)] mt-0.5">
          Avg Score: <span className="font-data text-[#3B82F6]">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
}

function DealScoreTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-md px-3 py-2 text-xs shadow-lg">
        <p className="text-[var(--text-primary)] font-medium">{payload[0].payload.fullName}</p>
        <p className="text-[var(--text-secondary)] mt-0.5">
          Score: <span className="font-data" style={{ color: scoreColor(payload[0].value) }}>{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
}

function truncateName(name: string): string {
  return name.split(" ")[0];
}

function getDealLifecycleStage(deal: Deal): string {
  return (deal as any).lifecycleStage || "assessment";
}

export default function PortfolioPage() {
  const { hasPermission } = useAuth();
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");

  const { data: dealsList = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: trendData = [], isLoading: trendLoading } = useQuery<TrendPoint[]>({
    queryKey: ["/api/portfolio/risk-trend"],
  });

  const { data: matrixData, isLoading: matrixLoading } = useQuery<PillarMatrix>({
    queryKey: ["/api/portfolio/pillar-matrix"],
  });

  const filteredDeals = lifecycleFilter === "all"
    ? dealsList
    : dealsList.filter(d => getDealLifecycleStage(d) === lifecycleFilter);

  const stageCounts: Record<string, number> = { all: dealsList.length };
  for (const stage of LIFECYCLE_STAGES) {
    if (stage.key !== "all") {
      stageCounts[stage.key] = dealsList.filter(d => getDealLifecycleStage(d) === stage.key).length;
    }
  }

  if (!hasPermission("view_portfolio")) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-panel)] flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-[var(--text-disabled)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Access Restricted</h2>
          <p className="text-sm text-[var(--text-disabled)] max-w-md">You don't have access to portfolio analytics. Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  const dealScores = filteredDeals
    .filter((d) => d.compositeScore)
    .map((d) => ({
      name: truncateName(d.targetName),
      fullName: d.targetName,
      score: Number(d.compositeScore),
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]" data-testid="text-portfolio-title">
            Portfolio Overview
          </h1>
          <Badge
            variant="outline"
            className="text-[10px] font-data border-[#06B6D4]/30 text-[#06B6D4] no-default-hover-elevate no-default-active-elevate"
          >
            Cross-Deal
          </Badge>
        </div>
        <p className="text-xs text-[var(--text-disabled)] mt-0.5">
          Aggregated analytics across all acquisition targets
        </p>
      </div>

      <div className="flex items-center gap-1 flex-wrap" data-testid="lifecycle-filter-bar">
        {LIFECYCLE_STAGES.map((stage) => {
          const isActive = lifecycleFilter === stage.key;
          const count = stageCounts[stage.key] || 0;
          return (
            <button
              key={stage.key}
              data-testid={`lifecycle-tab-${stage.key}`}
              onClick={() => setLifecycleFilter(stage.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
              }`}
            >
              {"color" in stage && (
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: stage.color }}
                />
              )}
              {stage.label}
              <span className={`font-data text-[10px] ${isActive ? "text-[#3B82F6]" : "text-[var(--text-disabled)]"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {(() => {
        const scored = filteredDeals.filter(d => d.compositeScore);
        const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, d) => s + Number(d.compositeScore), 0) / scored.length) : 0;
        const highRisk = scored.filter(d => Number(d.compositeScore) < 60).length;
        const activeDeals = filteredDeals.filter(d => d.status === "active" || d.status === "discovery" || d.status === "diligence").length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="portfolio-kpis">
            <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#3B82F6]/10">
                  <FileText className="w-4 h-4 text-[#3B82F6]" />
                </div>
                <span className="text-[10px] text-[var(--text-disabled)]">Total Deals</span>
              </div>
              <p className="font-data text-2xl font-bold text-[var(--text-primary)]" data-testid="kpi-total-deals">{filteredDeals.length}</p>
              <p className="text-[10px] text-[var(--text-disabled)] mt-0.5">{activeDeals} active</p>
            </Card>
            <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#10B981]/10">
                  <Target className="w-4 h-4 text-[#10B981]" />
                </div>
                <span className="text-[10px] text-[var(--text-disabled)]">Avg Score</span>
              </div>
              <p className="font-data text-2xl font-bold" style={{ color: scoreColor(avgScore) }} data-testid="kpi-avg-score">{avgScore}</p>
              <p className="text-[10px] text-[var(--text-disabled)] mt-0.5">across {scored.length} scored</p>
            </Card>
            <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#EF4444]/10">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                </div>
                <span className="text-[10px] text-[var(--text-disabled)]">High Risk</span>
              </div>
              <p className="font-data text-2xl font-bold text-[#EF4444]" data-testid="kpi-high-risk">{highRisk}</p>
              <p className="text-[10px] text-[var(--text-disabled)] mt-0.5">score {"<"} 60</p>
            </Card>
            <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#8B5CF6]/10">
                  <ShieldCheck className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <span className="text-[10px] text-[var(--text-disabled)]">Avg Confidence</span>
              </div>
              <p className="font-data text-2xl font-bold text-[#8B5CF6]" data-testid="kpi-avg-confidence">
                {scored.length > 0 ? Math.round(scored.filter(d => d.overallConfidence).reduce((s, d) => s + (d.overallConfidence === "high" ? 4 : d.overallConfidence === "moderate" ? 3 : d.overallConfidence === "low" ? 2 : 1), 0) / Math.max(scored.filter(d => d.overallConfidence).length, 1) * 25) + "%" : "N/A"}
              </p>
              <p className="text-[10px] text-[var(--text-disabled)] mt-0.5">evidence coverage</p>
            </Card>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-risk-trend">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Portfolio Risk Trend</h2>
            </div>
            {trendLoading && <Loader2 className="w-4 h-4 text-[#3B82F6] animate-spin" />}
          </div>

          {trendData.length > 0 ? (
            <div className="h-[260px]" data-testid="chart-risk-trend">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" strokeOpacity={0.4} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--text-disabled)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: "var(--theme-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[50, 90]}
                    tick={{ fill: "var(--text-disabled)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#blueGrad)"
                    dot={{ fill: "#3B82F6", r: 3, strokeWidth: 0 }}
                    activeDot={{ fill: "#3B82F6", r: 5, strokeWidth: 2, stroke: "var(--bg-card)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[260px]">
              <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
            </div>
          )}
        </Card>

        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-deal-scores">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Deal Scores by Industry</h2>
          </div>

          {dealScores.length > 0 ? (
            <div className="h-[260px]" data-testid="chart-deal-scores">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dealScores} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: "var(--text-disabled)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: "var(--theme-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DealScoreTooltip />} cursor={{ fill: "var(--theme-border)", opacity: 0.3 }} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                    {dealScores.map((entry, index) => (
                      <Cell key={index} fill={scoreColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[260px]">
              <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
            </div>
          )}
        </Card>
      </div>

      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-cross-deal">
        <div className="flex items-center gap-2 mb-4">
          <Grid3x3 className="w-4 h-4 text-[#06B6D4]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Cross-Deal Comparison</h2>
          <Badge
            variant="outline"
            className="text-[10px] font-data border-[#06B6D4]/30 text-[#06B6D4] ml-auto no-default-hover-elevate no-default-active-elevate"
          >
            {lifecycleFilter === "all" ? (matrixData?.deals.length || 0) : filteredDeals.length} Deals
          </Badge>
        </div>

        {matrixLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-6 h-6 text-[#06B6D4] animate-spin" />
          </div>
        ) : matrixData ? (
          (() => {
            const filteredDealIds = new Set(filteredDeals.map(d => d.id));
            const filteredMatrixDeals = lifecycleFilter === "all"
              ? matrixData.deals
              : matrixData.deals.filter(d => filteredDealIds.has(d.id));
            return (
              <div className="overflow-x-auto" data-testid="matrix-table-container">
                <table className="w-full text-xs" data-testid="matrix-table">
                  <thead>
                    <tr className="border-b border-[var(--theme-border)]">
                      <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--text-disabled)] font-medium min-w-[180px]">
                        Pillar
                      </th>
                      {filteredMatrixDeals.map((deal) => (
                        <th
                          key={deal.id}
                          className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--text-disabled)] font-medium min-w-[100px]"
                          data-testid={`col-header-${deal.id}`}
                        >
                          {truncateName(deal.name)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.pillarNames.map((pillarName, idx) => (
                      <tr
                        key={pillarName}
                        className={`border-b border-[var(--theme-border)]/30 ${idx % 2 === 1 ? "bg-[var(--bg-card)]" : ""}`}
                        data-testid={`matrix-row-${idx}`}
                      >
                        <td className="py-3 px-3 text-xs text-[var(--text-secondary)] font-medium">
                          {pillarName}
                        </td>
                        {filteredMatrixDeals.map((deal) => {
                          const val = matrixData.matrix[pillarName]?.[deal.id];
                          const num = val ? Number(val) : null;
                          return (
                            <td key={deal.id} className="text-center py-3 px-3">
                              {num !== null ? (
                                <span
                                  className="font-data text-sm font-semibold"
                                  style={{ color: scoreColor(num, "5") }}
                                  data-testid={`cell-${pillarName}-${deal.id}`}
                                >
                                  {num.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-[var(--theme-border)]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--theme-border)]">
                      <td className="py-3 px-3 text-xs text-[var(--text-primary)] font-semibold">
                        Composite
                      </td>
                      {filteredMatrixDeals.map((deal) => {
                        const num = deal.compositeScore ? Number(deal.compositeScore) : null;
                        return (
                          <td key={deal.id} className="text-center py-3 px-3">
                            {num !== null ? (
                              <span
                                className="font-data text-sm font-bold"
                                style={{ color: scoreColor(num) }}
                                data-testid={`composite-${deal.id}`}
                              >
                                {num.toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-[var(--theme-border)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()
        ) : null}
      </Card>
    </div>
  );
}
