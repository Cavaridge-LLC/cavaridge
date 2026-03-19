import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useCosts, useAnalyzeCosts } from "@/lib/api";

function parseCost(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
}

interface CostChartProps {
  projectId: string;
}

export default function CostChart({ projectId }: CostChartProps) {
  const { data: costs = [], isLoading } = useCosts(projectId);
  const analyzeCosts = useAnalyzeCosts(projectId);

  const chartData = useMemo(() => {
    return costs.map((c, i) => ({
      name: c.workloadId ? `Workload ${i + 1}` : `Projection ${i + 1}`,
      current: parseCost(c.currentMonthlyCost),
      projected: parseCost(c.projectedMonthlyCost),
    }));
  }, [costs]);

  const summary = useMemo(() => {
    let totalCurrent = 0;
    let totalProjected = 0;
    let totalMigration = 0;
    let totalSavingsMonthly = 0;

    costs.forEach((c) => {
      totalCurrent += parseCost(c.currentMonthlyCost);
      totalProjected += parseCost(c.projectedMonthlyCost);
      totalMigration += parseCost(c.migrationCostOnetime);
      totalSavingsMonthly += parseCost(c.savingsMonthly);
    });

    const monthlySavings =
      totalSavingsMonthly > 0
        ? totalSavingsMonthly
        : totalCurrent - totalProjected;
    const breakevenMonths =
      monthlySavings > 0
        ? Math.ceil(totalMigration / monthlySavings)
        : null;
    const threeYearSavings = monthlySavings * 36 - totalMigration;

    return {
      totalCurrent,
      totalProjected,
      totalMigration,
      monthlySavings,
      breakevenMonths,
      threeYearSavings,
    };
  }, [costs]);

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: "var(--text-secondary)" }}>
        Loading cost data...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => analyzeCosts.mutate()}
          disabled={analyzeCosts.isPending}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            background: "var(--accent-blue)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            opacity: analyzeCosts.isPending ? 0.6 : 1,
          }}
        >
          {analyzeCosts.isPending ? "Analyzing..." : "Analyze Costs"}
        </button>
      </div>

      {costs.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          No cost projections yet. Run an analysis to generate cost data.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <SummaryCard
              label="Total Current Monthly"
              value={formatCurrency(summary.totalCurrent)}
              color="#6366F1"
            />
            <SummaryCard
              label="Total Projected Monthly"
              value={formatCurrency(summary.totalProjected)}
              color="#22C55E"
            />
            <SummaryCard
              label="Total Migration Cost"
              value={formatCurrency(summary.totalMigration)}
              color="#F97316"
            />
            <SummaryCard
              label="Monthly Savings"
              value={formatCurrency(summary.monthlySavings)}
              color={summary.monthlySavings >= 0 ? "#22C55E" : "#EF4444"}
            />
            <SummaryCard
              label="Breakeven Month"
              value={
                summary.breakevenMonths !== null
                  ? `Month ${summary.breakevenMonths}`
                  : "N/A"
              }
              color="var(--text-primary)"
            />
            <SummaryCard
              label="3-Year TCO Savings"
              value={formatCurrency(summary.threeYearSavings)}
              color={summary.threeYearSavings >= 0 ? "#22C55E" : "#EF4444"}
            />
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div
              style={{
                background: "var(--bg-secondary)",
                borderRadius: 8,
                border: "1px solid var(--border-primary)",
                padding: 16,
              }}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-primary)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                    tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
                  />
                  <Bar
                    dataKey="current"
                    name="Current Monthly"
                    fill="#6366F1"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="projected"
                    name="Projected Monthly"
                    fill="#22C55E"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div
        style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
