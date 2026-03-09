import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  FlaskConical,
  Zap,
  Cloud,
  Layers,
  DollarSign,
  Clock,
  AlertTriangle,
  Target,
  Loader2,
  ChevronDown,
  TrendingUp,
  Activity,
} from "lucide-react";
import type { Deal } from "@shared/schema";

type ScenarioKey = "phased" | "big-bang" | "cloud-first";

interface InputFactor {
  name: string;
  value: number;
  impact: "low" | "medium" | "high";
}

interface SimResult {
  bins: Array<{ cost_label: string; probability: number; inRange: boolean }>;
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  stddev: number;
  inputFactors: InputFactor[];
  complexityFactor: number;
  riskFactor: number;
}

const scenarioMeta: Record<ScenarioKey, {
  label: string;
  icon: typeof Layers;
  description: string;
  riskLabel: string;
  riskColor: string;
  timelineRange: string;
}> = {
  phased: {
    label: "Phased Migration",
    icon: Layers,
    description: "Incremental migration of systems in priority order. Each phase is validated before proceeding, minimizing disruption while extending overall timeline.",
    riskLabel: "Low",
    riskColor: "#10B981",
    timelineRange: "6 - 12 months",
  },
  "big-bang": {
    label: "Big-Bang Migration",
    icon: Zap,
    description: "All systems migrated simultaneously over a concentrated period. Lower cost but significantly higher risk of disruption and rollback complexity.",
    riskLabel: "High",
    riskColor: "#EF4444",
    timelineRange: "2 - 4 months",
  },
  "cloud-first": {
    label: "Cloud-First Migration",
    icon: Cloud,
    description: "Prioritizes cloud-native re-architecture before migration. Higher upfront investment yields long-term operational savings and modern infrastructure.",
    riskLabel: "Medium",
    riskColor: "#F59E0B",
    timelineRange: "9 - 15 months",
  },
};

const impactColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "rgba(16,185,129,0.12)", text: "#10B981" },
  medium: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
  high: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
};

function MonteCarloTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-md px-3 py-2 text-xs shadow-lg">
        <p className="text-[var(--text-primary)] font-medium">{payload[0].payload.cost_label}</p>
        <p className="text-[var(--text-secondary)] mt-0.5">
          Probability: <span className="font-data text-[#8B5CF6]">{payload[0].value}%</span>
        </p>
      </div>
    );
  }
  return null;
}

export default function SimulatorPage() {
  const [selected, setSelected] = useState<ScenarioKey>("phased");
  const { data: dealsList = [] } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const activeDeal = dealsList.find((d) => d.id === selectedDealId) || dealsList[0];
  const dealId = activeDeal?.id;

  const { data: simData, isLoading, isFetching } = useQuery<SimResult>({
    queryKey: ["/api/deals", dealId, "simulate/monte-carlo", selected],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}/simulate/monte-carlo?scenario=${selected}`);
      if (!res.ok) throw new Error("Failed to run simulation");
      return res.json();
    },
    enabled: !!dealId,
  });

  const activeScenario = scenarioMeta[selected];
  const loading = isLoading || isFetching;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]" data-testid="text-simulator-title">
              Integration Simulator
            </h1>
            <Badge
              variant="outline"
              className="text-[10px] font-data border-[#8B5CF6]/30 text-[#8B5CF6] no-default-hover-elevate no-default-active-elevate"
            >
              Digital Twin
            </Badge>
          </div>
          <p className="text-xs text-[var(--text-disabled)] mt-0.5">
            Monte Carlo cost forecasting driven by real deal intelligence
          </p>
        </div>

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="scenario-selector">
        {(Object.keys(scenarioMeta) as ScenarioKey[]).map((key) => {
          const s = scenarioMeta[key];
          const isActive = selected === key;
          const Icon = s.icon;
          return (
            <button
              key={key}
              data-testid={`scenario-btn-${key}`}
              onClick={() => setSelected(key)}
              className={`text-left rounded-md p-4 border transition-colors cursor-pointer ${
                isActive
                  ? "border-[#8B5CF6] bg-[#8B5CF6]/10"
                  : "border-[var(--theme-border)]/50 bg-[var(--bg-card)] hover-elevate"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${isActive ? "bg-[#8B5CF6]/20" : "bg-[var(--bg-panel)]"}`}>
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#8B5CF6]" : "text-[var(--text-disabled)]"}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-[var(--text-disabled)] font-data">
                    Risk: {s.riskLabel}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5 lg:col-span-2" data-testid="card-monte-carlo">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Monte Carlo Cost Distribution</h2>
              <span className="text-[10px] text-[var(--text-disabled)] font-data">10,000 iterations</span>
            </div>
            {loading && <Loader2 className="w-4 h-4 text-[#8B5CF6] animate-spin" data-testid="loading-spinner" />}
          </div>

          {simData && !isLoading ? (
            <>
              <div className="h-[260px]" data-testid="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simData.bins} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <XAxis
                      dataKey="cost_label"
                      tick={{ fill: "var(--text-disabled)", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "var(--theme-border)" }}
                      tickLine={false}
                      interval={3}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-disabled)", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<MonteCarloTooltip />} cursor={{ fill: "var(--theme-border)", opacity: 0.3 }} />
                    <ReferenceLine
                      x={simData.bins.find((b) => {
                        const val = parseInt(b.cost_label.replace(/[$K]/g, "")) * 1000;
                        return val >= simData.p50 - simData.stddev * 0.5;
                      })?.cost_label}
                      stroke="#8B5CF6"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                    />
                    <Bar dataKey="probability" radius={[2, 2, 0, 0]}>
                      {simData.bins.map((entry, index) => (
                        <Cell key={index} fill={entry.inRange ? "#8B5CF6" : "rgba(139, 92, 246, 0.4)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--theme-border)]/40" data-testid="percentile-values">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-disabled)] mb-1">P10 (Optimistic)</p>
                  <p className="font-data text-sm font-bold text-[#10B981]" data-testid="value-p10">
                    ${Math.round(simData.p10 / 1000)}K
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-disabled)] mb-1">P50 (Median)</p>
                  <p className="font-data text-base font-bold text-[#8B5CF6]" data-testid="value-p50">
                    ${Math.round(simData.p50 / 1000)}K
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-disabled)] mb-1">P90 (Conservative)</p>
                  <p className="font-data text-sm font-bold text-[#EF4444]" data-testid="value-p90">
                    ${Math.round(simData.p90 / 1000)}K
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center min-h-[260px]">
              <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-scenario-detail">
            <div className="flex items-center gap-2 mb-3">
              <activeScenario.icon className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-sm font-medium text-[var(--text-primary)]">{activeScenario.label}</h2>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[var(--bg-panel)] rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-[#3B82F6]" />
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-disabled)]">Timeline</span>
                </div>
                <p className="font-data text-sm font-bold text-[#3B82F6]" data-testid="metric-timeline">
                  {activeScenario.timelineRange}
                </p>
              </div>
              <div className="bg-[var(--bg-panel)] rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3 h-3" style={{ color: activeScenario.riskColor }} />
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-disabled)]">Risk</span>
                </div>
                <p className="font-data text-sm font-bold" style={{ color: activeScenario.riskColor }} data-testid="metric-risk">
                  {activeScenario.riskLabel}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed" data-testid="scenario-description">
              {activeScenario.description}
            </p>
          </Card>

          {simData && (
            <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-input-factors">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-[#06B6D4]" />
                <h2 className="text-sm font-medium text-[var(--text-primary)]">Input Factors</h2>
              </div>

              <div className="flex items-center gap-3 mb-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-[#8B5CF6]" />
                  <span className="text-[var(--text-disabled)]">
                    Complexity: <span className="font-data text-[var(--text-primary)]">{simData.complexityFactor}x</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
                  <span className="text-[var(--text-disabled)]">
                    Risk: <span className="font-data text-[var(--text-primary)]">{simData.riskFactor}x</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-4" data-testid="input-factors-list">
                {simData.inputFactors.map((f, i) => {
                  const ic = impactColors[f.impact] || impactColors.low;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-secondary)]">{f.name}</span>
                        <span className="font-data text-[var(--text-disabled)]">({f.value})</span>
                      </div>
                      <Badge
                        className="text-[9px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate border"
                        style={{ backgroundColor: ic.bg, color: ic.text, borderColor: `${ic.text}30` }}
                      >
                        {f.impact}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[var(--theme-border)]/40 pt-3" data-testid="cost-explanation">
                <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-disabled)] font-medium mb-2">Cost Breakdown</h3>
                <div className="space-y-1.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <p>
                    <span className="text-[var(--text-primary)] font-medium">Base estimate: </span>
                    {selected === "phased" && "~$310K for incremental phased migration (lowest risk premium)."}
                    {selected === "big-bang" && "~$230K for compressed timeline (lower labor hours, higher risk premium)."}
                    {selected === "cloud-first" && "~$370K for cloud re-architecture (includes modernization investment)."}
                  </p>
                  <p>
                    <span className="text-[var(--text-primary)] font-medium">Adjusted by: </span>
                    {simData.complexityFactor > 1.2
                      ? `${simData.complexityFactor}x complexity multiplier from ${simData.inputFactors.filter(f => f.value > 0).length} active cost drivers (tech stack size, gaps, and findings).`
                      : "Minimal complexity adjustment — few risk factors detected in deal data."}
                  </p>
                  <p>
                    <span className="text-[var(--text-primary)] font-medium">P10/P50/P90: </span>
                    There is a 10% chance costs fall below <span className="font-data text-[#10B981]">${Math.round(simData.p10 / 1000)}K</span>,
                    a 50% chance below <span className="font-data text-[#8B5CF6]">${Math.round(simData.p50 / 1000)}K</span>,
                    and a 90% chance below <span className="font-data text-[#EF4444]">${Math.round(simData.p90 / 1000)}K</span>.
                    Budget to the P90 for conservative planning.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
