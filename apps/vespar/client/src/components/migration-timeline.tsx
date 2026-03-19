import { useMemo } from "react";
import { useWorkloads, useDependencies } from "@/lib/api";
import type { Workload, Dependency } from "@shared/schema";

const STRATEGY_COLORS: Record<string, string> = {
  rehost: "#3B82F6",
  replatform: "#8B5CF6",
  refactor: "#EC4899",
  repurchase: "#F59E0B",
  retire: "#6B7280",
  retain: "#9CA3AF",
};

const CRITICALITY_DOTS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#22C55E",
};

function computePhases(
  workloads: Workload[],
  deps: Dependency[]
): Map<number, Workload[]> {
  const depthMap = new Map<string, number>();

  function getDepth(wId: string, visited: Set<string>): number {
    if (depthMap.has(wId)) return depthMap.get(wId)!;
    if (visited.has(wId)) return 0; // cycle guard
    visited.add(wId);

    const incoming = deps.filter((d) => d.targetWorkloadId === wId);
    if (incoming.length === 0) {
      depthMap.set(wId, 0);
      return 0;
    }
    const d =
      1 +
      Math.max(
        ...incoming.map((dep) => getDepth(dep.sourceWorkloadId, visited))
      );
    depthMap.set(wId, d);
    return d;
  }

  workloads.forEach((w) => getDepth(w.id, new Set()));

  // workloads with no dependencies all go to phase 0
  workloads.forEach((w) => {
    if (!depthMap.has(w.id)) depthMap.set(w.id, 0);
  });

  const phases = new Map<number, Workload[]>();
  workloads.forEach((w) => {
    const phase = depthMap.get(w.id) || 0;
    if (!phases.has(phase)) phases.set(phase, []);
    phases.get(phase)!.push(w);
  });

  return phases;
}

interface MigrationTimelineProps {
  projectId: string;
}

export default function MigrationTimeline({ projectId }: MigrationTimelineProps) {
  const { data: workloads = [], isLoading: wLoading } = useWorkloads(projectId);
  const { data: deps = [], isLoading: dLoading } = useDependencies(projectId);

  const phases = useMemo(
    () => computePhases(workloads, deps),
    [workloads, deps]
  );
  const sortedPhaseKeys = useMemo(
    () => Array.from(phases.keys()).sort((a, b) => a - b),
    [phases]
  );
  const totalPhases = sortedPhaseKeys.length;

  if (wLoading || dLoading) {
    return (
      <div style={{ padding: 32, color: "var(--text-secondary)" }}>
        Loading timeline...
      </div>
    );
  }

  if (workloads.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          color: "var(--text-secondary)",
        }}
      >
        No workloads yet. Add workloads to generate a migration timeline.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
          fontSize: 11,
          color: "var(--text-secondary)",
        }}
      >
        {Object.entries(STRATEGY_COLORS).map(([strategy, color]) => (
          <div
            key={strategy}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: color,
              }}
            />
            <span style={{ textTransform: "capitalize" }}>{strategy}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
          borderRadius: 8,
          padding: 16,
          overflowX: "auto",
        }}
      >
        {sortedPhaseKeys.map((phaseNum) => {
          const phaseWorkloads = phases.get(phaseNum) || [];
          return (
            <div
              key={phaseNum}
              style={{
                display: "flex",
                alignItems: "stretch",
                marginBottom: 12,
                minHeight: 40,
              }}
            >
              {/* Phase label */}
              <div
                style={{
                  width: 90,
                  minWidth: 90,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  borderRight: "2px solid var(--border-primary)",
                }}
              >
                Phase {phaseNum + 1}
              </div>

              {/* Workload bars */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  paddingLeft: 12,
                }}
              >
                {phaseWorkloads.map((w) => {
                  const strategy = w.migrationStrategy || "retain";
                  const barColor = STRATEGY_COLORS[strategy] || "#9CA3AF";
                  const critColor =
                    CRITICALITY_DOTS[w.criticality] || "#6B7280";
                  // Bar width proportional to phase position
                  const widthPct =
                    totalPhases > 1
                      ? 40 + ((totalPhases - phaseNum) / totalPhases) * 50
                      : 90;

                  return (
                    <div
                      key={w.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          height: 30,
                          width: `${widthPct}%`,
                          minWidth: 120,
                          background: barColor,
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          padding: "0 10px",
                          gap: 6,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {/* Criticality dot */}
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: critColor,
                            border: "1px solid rgba(255,255,255,0.5)",
                            flexShrink: 0,
                          }}
                          title={`${w.criticality} criticality`}
                        />
                        <span
                          style={{
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {w.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-disabled)",
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {strategy}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
