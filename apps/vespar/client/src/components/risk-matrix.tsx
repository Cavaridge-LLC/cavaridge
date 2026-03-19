import { useState, useMemo } from "react";
import { useRisks, useAnalyzeRisks } from "@/lib/api";
import type { RiskFinding } from "@shared/schema";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const CATEGORIES = [
  "technical",
  "operational",
  "financial",
  "compliance",
  "organizational",
] as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#22C55E",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#EF4444",
  mitigated: "#3B82F6",
  accepted: "#EAB308",
  closed: "#6B7280",
};

function cellColor(severity: string, count: number): string {
  if (count === 0) return "transparent";
  const base = SEVERITY_COLORS[severity] || "#6B7280";
  const opacity = count === 1 ? 0.3 : count === 2 ? 0.55 : 0.8;
  return `${base}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

interface RiskMatrixProps {
  projectId: string;
}

export default function RiskMatrix({ projectId }: RiskMatrixProps) {
  const { data: risks = [], isLoading } = useRisks(projectId);
  const analyzeRisks = useAnalyzeRisks(projectId);

  const [selectedCell, setSelectedCell] = useState<{
    severity: string;
    category: string;
  } | null>(null);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    SEVERITIES.forEach((s) => {
      m[s] = {};
      CATEGORIES.forEach((c) => {
        m[s][c] = 0;
      });
    });
    risks.forEach((r) => {
      if (m[r.severity] && m[r.severity][r.category] !== undefined) {
        m[r.severity][r.category]++;
      }
    });
    return m;
  }, [risks]);

  const filteredRisks = useMemo(() => {
    if (!selectedCell) return [];
    return risks.filter(
      (r) =>
        r.severity === selectedCell.severity &&
        r.category === selectedCell.category
    );
  }, [risks, selectedCell]);

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: "var(--text-secondary)" }}>
        Loading risks...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => analyzeRisks.mutate()}
          disabled={analyzeRisks.isPending}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            background: "var(--accent-blue)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            opacity: analyzeRisks.isPending ? 0.6 : 1,
          }}
        >
          {analyzeRisks.isPending ? "Analyzing..." : "Analyze Risks"}
        </button>
      </div>

      {risks.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          No risk findings yet. Run an analysis to identify risks.
        </div>
      ) : (
        <>
          {/* Heatmap grid */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                minWidth: 520,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      textAlign: "left",
                      fontWeight: 600,
                    }}
                  >
                    Severity / Category
                  </th>
                  {CATEGORIES.map((c) => (
                    <th
                      key={c}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        textTransform: "capitalize",
                        fontWeight: 600,
                        textAlign: "center",
                      }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEVERITIES.map((sev) => (
                  <tr key={sev}>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 600,
                        textTransform: "capitalize",
                        color: SEVERITY_COLORS[sev],
                      }}
                    >
                      {sev}
                    </td>
                    {CATEGORIES.map((cat) => {
                      const count = matrix[sev][cat];
                      const isSelected =
                        selectedCell?.severity === sev &&
                        selectedCell?.category === cat;
                      return (
                        <td
                          key={cat}
                          onClick={() =>
                            setSelectedCell(
                              isSelected ? null : { severity: sev, category: cat }
                            )
                          }
                          style={{
                            padding: 0,
                            textAlign: "center",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              margin: 3,
                              padding: "14px 8px",
                              borderRadius: 6,
                              background: cellColor(sev, count),
                              border: isSelected
                                ? "2px solid var(--accent-blue)"
                                : "1px solid var(--border-primary)",
                              fontWeight: 600,
                              fontSize: 16,
                              color:
                                count > 0
                                  ? "var(--text-primary)"
                                  : "var(--text-disabled)",
                              transition: "all 0.15s",
                            }}
                          >
                            {count}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Filtered risk table */}
          {selectedCell && (
            <div>
              <h4
                style={{
                  margin: "8px 0",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {selectedCell.severity} / {selectedCell.category} Risks (
                {filteredRisks.length})
              </h4>
              {filteredRisks.length === 0 ? (
                <div
                  style={{ fontSize: 13, color: "var(--text-secondary)", padding: 12 }}
                >
                  No findings in this cell.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--border-primary)",
                        }}
                      >
                        {["Title", "Severity", "Category", "Score", "Status", "Mitigation"].map(
                          (h) => (
                            <th
                              key={h}
                              style={{
                                padding: "8px 10px",
                                textAlign: "left",
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                fontSize: 12,
                              }}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRisks.map((r) => (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: "1px solid var(--border-primary)",
                          }}
                        >
                          <td
                            style={{
                              padding: "8px 10px",
                              color: "var(--text-primary)",
                              fontWeight: 500,
                            }}
                          >
                            {r.title}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <Badge
                              label={r.severity}
                              color={SEVERITY_COLORS[r.severity]}
                            />
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <Badge
                              label={r.category}
                              color="var(--accent-blue)"
                            />
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {r.riskScore ?? "—"}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <Badge
                              label={r.status}
                              color={STATUS_COLORS[r.status] || "#6B7280"}
                            />
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              color: "var(--text-secondary)",
                              maxWidth: 240,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.mitigation || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "capitalize",
        color: "#fff",
        background: color,
      }}
    >
      {label}
    </span>
  );
}
