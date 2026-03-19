import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useDependencies, useWorkloads, useCreateDependency } from "@/lib/api";
import type { Workload, Dependency } from "@shared/schema";

const CRITICALITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#22C55E",
};

const TYPE_ICONS: Record<string, string> = {
  server: "🖥️",
  database: "🗄️",
  application: "📦",
  storage: "💾",
  network: "🌐",
  identity: "🔑",
  other: "⚙️",
};

const EDGE_STYLES: Record<string, string> = {
  hard: "solid",
  soft: "5 5",
  data: "2 2",
  network: "10 5 2 5",
};

function WorkloadNode({ data }: NodeProps) {
  const color = CRITICALITY_COLORS[data.criticality as string] || "#6B7280";
  const icon = TYPE_ICONS[data.type as string] || "⚙️";

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: "10px 16px",
        minWidth: 160,
        color: "var(--text-primary)",
        fontSize: 13,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span>
        <span style={{ fontWeight: 600 }}>{data.label as string}</span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          color: "var(--text-secondary)",
          textTransform: "capitalize",
        }}
      >
        {data.type as string} &middot; {data.criticality as string}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { workload: WorkloadNode };

function computeDepth(
  workloadId: string,
  deps: Dependency[],
  memo: Map<string, number>
): number {
  if (memo.has(workloadId)) return memo.get(workloadId)!;
  const incoming = deps.filter((d) => d.targetWorkloadId === workloadId);
  if (incoming.length === 0) {
    memo.set(workloadId, 0);
    return 0;
  }
  const depth =
    1 +
    Math.max(
      ...incoming.map((d) => computeDepth(d.sourceWorkloadId, deps, memo))
    );
  memo.set(workloadId, depth);
  return depth;
}

function buildLayout(
  workloads: Workload[],
  deps: Dependency[]
): { nodes: Node[]; edges: Edge[] } {
  const depthMemo = new Map<string, number>();
  workloads.forEach((w) => computeDepth(w.id, deps, depthMemo));

  const depthGroups = new Map<number, Workload[]>();
  workloads.forEach((w) => {
    const d = depthMemo.get(w.id) || 0;
    if (!depthGroups.has(d)) depthGroups.set(d, []);
    depthGroups.get(d)!.push(w);
  });

  const COL_GAP = 260;
  const ROW_GAP = 100;

  const nodes: Node[] = workloads.map((w) => {
    const depth = depthMemo.get(w.id) || 0;
    const group = depthGroups.get(depth)!;
    const idx = group.indexOf(w);
    return {
      id: w.id,
      type: "workload",
      position: { x: depth * COL_GAP + 40, y: idx * ROW_GAP + 40 },
      data: {
        label: w.name,
        type: w.type,
        criticality: w.criticality,
      },
    };
  });

  const edges: Edge[] = deps.map((d) => {
    const dashArray = EDGE_STYLES[d.dependencyType] || "solid";
    const isBlocking = d.blocksMigration;
    return {
      id: d.id,
      source: d.sourceWorkloadId,
      target: d.targetWorkloadId,
      style: {
        strokeDasharray: dashArray === "solid" ? undefined : dashArray,
        stroke: isBlocking ? "#EF4444" : "var(--border-primary)",
        strokeWidth: isBlocking ? 3 : 1.5,
      },
      animated: isBlocking,
      label: d.dependencyType,
      labelStyle: { fontSize: 10, fill: "var(--text-secondary)" },
    };
  });

  return { nodes, edges };
}

interface DependencyGraphProps {
  projectId: string;
}

export default function DependencyGraph({ projectId }: DependencyGraphProps) {
  const { data: workloads = [], isLoading: wLoading } = useWorkloads(projectId);
  const { data: deps = [], isLoading: dLoading } = useDependencies(projectId);
  const createDep = useCreateDependency(projectId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [depType, setDepType] = useState<string>("hard");
  const [blocks, setBlocks] = useState(false);

  const { nodes, edges } = useMemo(
    () => buildLayout(workloads, deps),
    [workloads, deps]
  );

  const handleAdd = useCallback(() => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    createDep.mutate({
      sourceWorkloadId: sourceId,
      targetWorkloadId: targetId,
      dependencyType: depType,
      blocksMigration: blocks,
      projectId,
      tenantId: "",
    });
    setShowAddForm(false);
    setSourceId("");
    setTargetId("");
  }, [sourceId, targetId, depType, blocks, createDep, projectId]);

  if (wLoading || dLoading) {
    return (
      <div style={{ padding: 32, color: "var(--text-secondary)" }}>
        Loading dependency graph...
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
        No workloads yet. Add workloads to visualize dependencies.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            background: "var(--accent-blue)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Add Dependency
        </button>
      </div>

      {showAddForm && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: 12,
            background: "var(--bg-secondary)",
            borderRadius: 8,
            border: "1px solid var(--border-primary)",
            flexWrap: "wrap",
          }}
        >
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            <option value="">Source...</option>
            {workloads.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span style={{ color: "var(--text-secondary)" }}>→</span>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            <option value="">Target...</option>
            {workloads.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            value={depType}
            onChange={(e) => setDepType(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            <option value="hard">Hard</option>
            <option value="soft">Soft</option>
            <option value="data">Data</option>
            <option value="network">Network</option>
          </select>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            <input
              type="checkbox"
              checked={blocks}
              onChange={(e) => setBlocks(e.target.checked)}
            />
            Blocking
          </label>
          <button
            onClick={handleAdd}
            disabled={!sourceId || !targetId || sourceId === targetId}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              background: "var(--accent-blue)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              opacity: !sourceId || !targetId || sourceId === targetId ? 0.5 : 1,
            }}
          >
            Save
          </button>
        </div>
      )}

      <div
        style={{
          width: "100%",
          height: 500,
          borderRadius: 8,
          border: "1px solid var(--border-primary)",
          overflow: "hidden",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(n) =>
              CRITICALITY_COLORS[n.data?.criticality as string] || "#6B7280"
            }
          />
        </ReactFlow>
      </div>
    </div>
  );
}
