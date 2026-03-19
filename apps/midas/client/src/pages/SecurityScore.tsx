import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  latestScoreQuery,
  scoreTrendQuery,
  useRunAdvisor,
  useRunWhatIf,
} from "@/lib/api";
import type {
  AdjustedSecurityScoreReport,
  RealGap,
  CategoryScore,
  ScoreTrend,
  SecurityAdvisorOutput,
} from "@shared/types/security-scoring";

interface Props {
  clientId: string;
}

function confidenceBadge(c: string) {
  const style = c === "high" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    : c === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  return <Badge variant="outline" className={`text-[10px] border-none ${style}`}>{c}</Badge>;
}

function effortBadge(e: string) {
  const style = e === "low" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    : e === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  return <Badge variant="outline" className={`text-[10px] border-none ${style}`}>{e} effort</Badge>;
}

const CATEGORY_LABELS: Record<string, string> = {
  identity_mfa: "Identity/MFA",
  identity_access: "Identity/Access",
  email_protection: "Email",
  endpoint_protection: "Endpoint",
  data_protection: "Data",
  backup_recovery: "Backup",
  device_management: "Devices",
  network_security: "Network",
  application_security: "Apps",
  logging_monitoring: "Logging",
};

export default function SecurityScore({ clientId }: Props) {
  const { data: report, isLoading } = useQuery(latestScoreQuery(clientId));
  const { data: trend } = useQuery(scoreTrendQuery(clientId));
  const runAdvisor = useRunAdvisor();
  const runWhatIf = useRunWhatIf();
  const [advisorOutput, setAdvisorOutput] = useState<SecurityAdvisorOutput | null>(null);
  const [selectedGapIds, setSelectedGapIds] = useState<string[]>([]);
  const [whatIfResult, setWhatIfResult] = useState<{ projectedScore: number; scoreDelta: number } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Security Score Data</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Run a security score calculation to see your Cavaridge Adjusted Score.
          </p>
        </Card>
      </div>
    );
  }

  const scoreReport = report as AdjustedSecurityScoreReport;
  const trendData = trend as ScoreTrend | undefined;
  const TrendIcon = trendData?.trendDirection === "improving" ? TrendingUp
    : trendData?.trendDirection === "declining" ? TrendingDown : Minus;

  const radarData = scoreReport.categories.map((c: CategoryScore) => ({
    category: CATEGORY_LABELS[c.category] ?? c.category,
    native: c.nativeScore,
    adjusted: c.adjustedScore,
  }));

  const trendChartData = trendData?.dataPoints.map((p) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    native: p.nativeScore,
    adjusted: p.adjustedScore,
  })) ?? [];

  const toggleGap = (id: string) => {
    setSelectedGapIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
    setWhatIfResult(null);
  };

  const handleWhatIf = () => {
    if (selectedGapIds.length === 0) return;
    runWhatIf.mutate(
      { clientId, gapIds: selectedGapIds },
      { onSuccess: (data: any) => setWhatIfResult(data) },
    );
  };

  const handleRunAdvisor = () => {
    runAdvisor.mutate(
      { clientId },
      { onSuccess: (data: any) => setAdvisorOutput(data) },
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security Score</h1>
          <p className="text-sm text-muted-foreground mt-1">Cavaridge Adjusted Security Posture</p>
        </div>
        <Button onClick={handleRunAdvisor} disabled={runAdvisor.isPending} className="gap-2">
          {runAdvisor.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Run SecurityAdvisor
        </Button>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-24">
              <svg width={96} height={96} className="-rotate-90">
                <circle cx={48} cy={48} r={40} fill="none" className="stroke-muted" strokeWidth={8} />
                <circle cx={48} cy={48} r={40} fill="none" className={scoreReport.adjustedScore >= 80 ? "stroke-green-500" : scoreReport.adjustedScore >= 60 ? "stroke-amber-500" : "stroke-red-500"} strokeWidth={8} strokeLinecap="round" strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - scoreReport.adjustedScore / 100)} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{scoreReport.adjustedScore}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">Cavaridge Adjusted</div>
              <div className="text-xs text-muted-foreground mt-1">Your real security score</div>
              <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-none">
                +{scoreReport.scoreDelta} from native
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-24">
              <svg width={96} height={96} className="-rotate-90">
                <circle cx={48} cy={48} r={40} fill="none" className="stroke-muted" strokeWidth={8} />
                <circle cx={48} cy={48} r={40} fill="none" className="stroke-blue-400" strokeWidth={8} strokeLinecap="round" strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - scoreReport.nativeScore / 100)} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-blue-500">{scoreReport.nativeScore}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">Native Score</div>
              <div className="text-xs text-muted-foreground mt-1">What {scoreReport.vendor === "microsoft" ? "Microsoft" : "Google"} reports</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              <span className="text-sm font-semibold">{scoreReport.compensatedControls.length} Compensated</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <span className="text-sm font-semibold">{scoreReport.realGaps.length} Real Gaps</span>
            </div>
            {trendData && (
              <div className="flex items-center gap-2">
                <TrendIcon className={`w-5 h-5 ${trendData.trendDirection === "improving" ? "text-green-500" : trendData.trendDirection === "declining" ? "text-red-500" : "text-muted-foreground"}`} />
                <span className="text-sm font-semibold capitalize">{trendData.trendDirection}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Category Radar + Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Category Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid strokeDasharray="3 3" className="stroke-border" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Native" dataKey="native" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.15} strokeWidth={1.5} />
              <Radar name="Adjusted" dataKey="adjusted" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 justify-center mt-2 text-xs">
            <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-400 rounded" /> Native</span>
            <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-green-500 rounded" /> Adjusted</span>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Score Trend</h3>
          {trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="native" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Native" />
                <Line type="monotone" dataKey="adjusted" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Adjusted" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
              Trend data requires at least 2 score calculations.
            </div>
          )}
        </Card>
      </div>

      {/* Real Gaps + What-If */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Real Gaps ({scoreReport.realGaps.length})</h3>
              {selectedGapIds.length > 0 && (
                <Button size="sm" variant="outline" onClick={handleWhatIf} disabled={runWhatIf.isPending} className="gap-1 text-xs">
                  {runWhatIf.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                  What-If ({selectedGapIds.length})
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {scoreReport.realGaps.map((gap: RealGap) => (
                <div key={gap.controlId} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted/30 transition-colors">
                  <Checkbox
                    checked={selectedGapIds.includes(gap.controlId)}
                    onCheckedChange={() => toggleGap(gap.controlId)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{gap.controlName}</span>
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[gap.category] ?? gap.category}</Badge>
                      {effortBadge(gap.estimatedEffort)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{gap.vendorRecommendation}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-red-500">-{gap.pointsAtStake}</div>
                    <div className="text-[10px] text-muted-foreground">pts</div>
                  </div>
                </div>
              ))}
              {scoreReport.realGaps.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No unaddressed security gaps. Excellent posture!
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* What-If Panel */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">What-If Analysis</h3>
          {whatIfResult ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-xs text-muted-foreground mb-1">Projected Score</div>
                <div className="text-4xl font-bold text-green-500">{whatIfResult.projectedScore}</div>
                <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-none">
                  +{whatIfResult.scoreDelta} points
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Resolving {selectedGapIds.length} selected gap{selectedGapIds.length !== 1 ? "s" : ""} would improve your score from {scoreReport.adjustedScore} to {whatIfResult.projectedScore}.
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Select gaps from the list and click "What-If" to see the projected score impact.
            </div>
          )}

          {/* Advisor Output */}
          {advisorOutput && (
            <div className="mt-6 pt-6 border-t border-border space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Analysis</h4>
              <div className="text-sm">{advisorOutput.executiveSummary}</div>
              {advisorOutput.talkingPoints.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-2">Talking Points</div>
                  <ul className="space-y-1.5">
                    {advisorOutput.talkingPoints.map((tp, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-2">
                        <span className="text-primary shrink-0">{i + 1}.</span>
                        {tp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Compensated Controls */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Compensated Controls ({scoreReport.compensatedControls.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {scoreReport.compensatedControls.map((c) => (
            <div key={c.controlId} className="rounded-lg border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{c.controlName}</span>
                {confidenceBadge(c.confidence)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px]">{c.thirdPartyProduct}</Badge>
                <Badge variant="outline" className="text-[10px]">{c.compensationLevel}</Badge>
                <span className="text-[10px] text-green-600 dark:text-green-400 ml-auto">+{c.pointsAwarded} pts</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
