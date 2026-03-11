import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, MessageSquare, Upload, Users, BookOpen, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics", `?days=${days}`],
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Usage Analytics</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Track how your organization uses Ducky
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                days === d
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--theme-border)] hover:text-[var(--text-primary)]"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Questions Asked", value: data.totals.questions, icon: MessageSquare },
              { label: "Conversations", value: data.totals.conversations, icon: Activity },
              { label: "Sources Uploaded", value: data.totals.uploads, icon: Upload },
              { label: "Knowledge Sources", value: data.totals.knowledgeSources, icon: BookOpen },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>

          {/* Questions Per Day Chart */}
          <div className="mb-8 p-6 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
              Questions Per Day
            </h3>
            {data.questionsPerDay && data.questionsPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.questionsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    stroke="var(--theme-border)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    stroke="var(--theme-border)"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--theme-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={formatDate}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Questions" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-[var(--text-disabled)] text-center py-8">No questions in this period</p>
            )}
          </div>

          {/* Top Users + Recent Activity */}
          <div className="grid grid-cols-2 gap-6">
            {/* Top Users */}
            <div className="p-6 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
                Top Users
              </h3>
              {data.topUsers && data.topUsers.length > 0 ? (
                <div className="space-y-3">
                  {data.topUsers.map((u: any, i: number) => (
                    <div key={u.userId} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-disabled)] w-4">{i + 1}.</span>
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-[10px] font-bold">
                        {u.userName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{u.userName}</span>
                      <span className="text-xs text-[var(--text-secondary)] font-mono">{u.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-disabled)] text-center py-4">No usage data</p>
              )}
            </div>

            {/* Recent Activity */}
            <div className="p-6 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)]">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
                Recent Activity
              </h3>
              {data.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {data.recentActivity.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded ${
                        a.actionType === "question" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"
                      }`}>
                        {a.actionType}
                      </span>
                      <span className="text-[var(--text-primary)] truncate flex-1">{a.userName}</span>
                      <span className="text-[var(--text-disabled)]">
                        {new Date(a.createdAt).toLocaleString(undefined, {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-disabled)] text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <BarChart3 className="h-12 w-12 text-[var(--text-disabled)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">Unable to load analytics</p>
        </div>
      )}
    </div>
  );
}
