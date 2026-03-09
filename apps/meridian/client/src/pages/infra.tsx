import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Network, Cpu, GitCompare, ChevronDown, ChevronRight, RefreshCw, Plus, FileText, Loader2, Zap, Eye, X, Building2, Landmark, Hospital, Server, Cloud, Flame, ArrowLeftRight, Globe, Lock, Wifi, Monitor } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deal, TechStackItem, BaselineComparison, TopologyNode, TopologyConnection } from "@shared/schema";

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", border: "#EF4444" },
  high: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B", border: "#F59E0B" },
  medium: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6", border: "#3B82F6" },
  low: { bg: "rgba(16,185,129,0.12)", text: "#10B981", border: "#10B981" },
  aligned: { bg: "rgba(16,185,129,0.12)", text: "#10B981", border: "#10B981" },
};

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  current: { bg: "rgba(16,185,129,0.12)", text: "#10B981", border: "#10B981" },
  eol: { bg: "rgba(239,68,68,0.12)", text: "#EF4444", border: "#EF4444" },
  deprecated: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B", border: "#F59E0B" },
  unknown: { bg: "rgba(107,114,128,0.12)", text: "#6B7280", border: "#6B7280" },
};

const nodeIconMap: Record<string, any> = {
  acquirer: Building2,
  target_hq: Landmark,
  facility: Hospital,
  datacenter: Server,
  cloud: Cloud,
  firewall: Flame,
  switch: ArrowLeftRight,
  server: Monitor,
  wan_link: Wifi,
  vpn: Lock,
  internet: Globe,
};

const nodeStyles: Record<string, { border: string; bg: string }> = {
  acquirer: { border: "#3B82F6", bg: "rgba(59,130,246,0.08)" },
  target_hq: { border: "#F59E0B", bg: "rgba(245,158,11,0.06)" },
  facility: { border: "#10B981", bg: "rgba(16,185,129,0.08)" },
  datacenter: { border: "#8B5CF6", bg: "rgba(139,92,246,0.08)" },
  cloud: { border: "#06B6D4", bg: "rgba(6,182,212,0.08)" },
  firewall: { border: "#EF4444", bg: "rgba(239,68,68,0.06)" },
  switch: { border: "#F59E0B", bg: "rgba(245,158,11,0.06)" },
  server: { border: "#6B7280", bg: "rgba(107,114,128,0.06)" },
  wan_link: { border: "#3B82F6", bg: "rgba(59,130,246,0.06)" },
  vpn: { border: "#8B5CF6", bg: "rgba(139,92,246,0.06)" },
  internet: { border: "#06B6D4", bg: "rgba(6,182,212,0.06)" },
};

const nodeStatusColors: Record<string, string> = {
  healthy: "#10B981",
  warning: "#F59E0B",
  critical: "#EF4444",
  unknown: "#6B7280",
};

function ConfidenceDot({ level }: { level: string }) {
  if (level === "high") return <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" title="High confidence" />;
  if (level === "medium") return (
    <div className="w-2.5 h-2.5 rounded-full border-2 border-[#F59E0B] relative" title="Medium confidence">
      <div className="absolute inset-0 rounded-full bg-[#F59E0B] clip-half" style={{ clipPath: "inset(0 50% 0 0)" }} />
    </div>
  );
  return <div className="w-2.5 h-2.5 rounded-full border-2 border-[#6B7280]" title="Low confidence" />;
}

function NetworkTopologyView({ nodes, connections, onRegenerate, isRegenerating }: {
  nodes: TopologyNode[];
  connections: TopologyConnection[];
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  const layerGroups: Record<string, TopologyNode[]> = {};
  const layerMap: Record<string, number> = {
    acquirer: 0, internet: 0, cloud: 1,
    target_hq: 2, datacenter: 2,
    firewall: 3, switch: 3, server: 3, vpn: 3, wan_link: 3,
    facility: 4,
  };

  nodes.forEach(n => {
    const layer = String(layerMap[n.nodeType] ?? 3);
    if (!layerGroups[layer]) layerGroups[layer] = [];
    layerGroups[layer].push(n);
  });

  const sortedLayers = Object.keys(layerGroups).sort((a, b) => Number(a) - Number(b));

  if (nodes.length === 0) {
    return (
      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-6" data-testid="card-network-topology">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#3B82F6]/10">
              <Network className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Network Topology</h3>
          </div>
        </div>
        <div className="py-10 text-center">
          <Network className="w-10 h-10 text-[var(--text-disabled)] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[var(--text-disabled)] mb-1">No topology data available</p>
          <p className="text-xs text-[var(--text-disabled)]">Analyze documents to generate topology</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-6 relative overflow-hidden" data-testid="card-network-topology">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, var(--text-secondary) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#3B82F6]/10">
              <Network className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Network Topology</h3>
            <Badge className="text-[10px] px-2 py-0 no-default-hover-elevate no-default-active-elevate border" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3B82F6", borderColor: "rgba(59,130,246,0.2)" }}>
              {nodes.length} nodes
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={isRegenerating} className="h-7 text-xs gap-1.5" data-testid="button-regenerate-topology">
            <RefreshCw className={`w-3 h-3 ${isRegenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        </div>

        <div className="flex flex-col items-center gap-0">
          {sortedLayers.map((layer, layerIdx) => (
            <div key={layer}>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {layerGroups[layer].map((node) => {
                  const style = nodeStyles[node.nodeType] || nodeStyles.server;
                  const statusColor = nodeStatusColors[node.status || "unknown"];
                  return (
                    <div
                      key={node.id}
                      className="px-4 py-2.5 rounded-md border-2 text-center cursor-pointer transition-all hover:shadow-md min-w-[140px]"
                      style={{
                        borderColor: style.border,
                        backgroundColor: style.bg,
                        boxShadow: selectedNode?.id === node.id ? `0 0 16px ${style.border}40` : "none",
                      }}
                      onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                      data-testid={`topology-node-${node.nodeType}`}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        {(() => { const Icon = nodeIconMap[node.nodeType] || Monitor; return <Icon className="w-3.5 h-3.5" style={{ color: style.border }} />; })()}
                        <div className="text-[10px] font-medium tracking-wider uppercase" style={{ color: style.border }}>
                          {node.nodeType.replace(/_/g, " ")}
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                      </div>
                      <div className="text-xs font-medium text-[var(--text-primary)]">{node.label}</div>
                      {node.sublabel && <div className="text-[10px] mt-0.5" style={{ color: `${style.border}99` }}>{node.sublabel}</div>}
                    </div>
                  );
                })}
              </div>
              {layerIdx < sortedLayers.length - 1 && (
                <div className="flex items-center justify-center my-2">
                  <div className="w-px h-6 bg-[var(--theme-border)]/60" />
                </div>
              )}
            </div>
          ))}
        </div>

        {connections.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--theme-border)]/40">
            <div className="text-[10px] text-[var(--text-disabled)] mb-2 font-medium uppercase tracking-wider">Connections</div>
            <div className="flex flex-wrap gap-2">
              {connections.map((c) => {
                const fromNode = nodes.find(n => n.id === c.fromNodeId);
                const toNode = nodes.find(n => n.id === c.toNodeId);
                return (
                  <div key={c.id} className="text-[10px] px-2 py-1 rounded-md bg-[var(--bg-panel)] border border-[var(--theme-border)]/30 text-[var(--text-disabled)]">
                    {fromNode?.label || "?"} → {toNode?.label || "?"} ({c.connectionType}{c.bandwidth ? `, ${c.bandwidth}` : ""})
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedNode && (
          <div className="mt-4 p-3 rounded-md bg-[var(--bg-panel)] border border-[var(--theme-border)]/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--text-primary)]">{selectedNode.label}</span>
              <button onClick={() => setSelectedNode(null)} className="text-[var(--text-disabled)] hover:text-[var(--text-primary)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-[var(--text-disabled)] space-y-1">
              <div>Type: {selectedNode.nodeType.replace(/_/g, " ")}</div>
              <div>Status: <span style={{ color: nodeStatusColors[selectedNode.status || "unknown"] }}>{selectedNode.status || "unknown"}</span></div>
              {selectedNode.sublabel && <div>Note: {selectedNode.sublabel}</div>}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const TECH_CATEGORIES = [
  "Identity & Access", "Networking", "Security", "Backup & DR",
  "Productivity", "EHR / Clinical", "Line of Business Apps",
  "Cloud Services", "Endpoints", "Telephony", "Monitoring", "Other"
];

function TechStackView({ items, onReextract, isReextracting, onAdd }: {
  items: TechStackItem[];
  onReextract: () => void;
  isReextracting: boolean;
  onAdd: () => void;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(TECH_CATEGORIES));

  const grouped: Record<string, TechStackItem[]> = {};
  items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-tech-stack">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#06B6D4]/10">
            <Cpu className="w-4 h-4 text-[#06B6D4]" />
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Detected Technology Stack</h3>
        </div>
        <div className="py-8 text-center">
          <Cpu className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3 opacity-40" />
          <p className="text-xs text-[var(--text-disabled)] mb-3">Upload IT assessment documents to auto-detect the technology stack.</p>
          <Button variant="ghost" size="sm" onClick={onReextract} disabled={isReextracting} className="h-7 text-xs gap-1.5" data-testid="button-extract-tech-stack">
            <Zap className="w-3 h-3" />
            Extract from Documents
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-tech-stack">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#06B6D4]/10">
            <Cpu className="w-4 h-4 text-[#06B6D4]" />
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Detected Technology Stack</h3>
          <Badge className="text-[10px] px-2 py-0 no-default-hover-elevate no-default-active-elevate border" style={{ backgroundColor: "rgba(6,182,212,0.1)", color: "#06B6D4", borderColor: "rgba(6,182,212,0.2)" }}>
            {items.length} items
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 text-xs gap-1" data-testid="button-add-tech">
            <Plus className="w-3 h-3" />
            Add
          </Button>
          <Button variant="ghost" size="sm" onClick={onReextract} disabled={isReextracting} className="h-7 text-xs gap-1" data-testid="button-reextract-tech">
            <RefreshCw className={`w-3 h-3 ${isReextracting ? "animate-spin" : ""}`} />
            Re-extract
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {TECH_CATEGORIES.filter(cat => grouped[cat]?.length > 0).map(cat => {
          const isExpanded = expandedCategories.has(cat);
          const categoryItems = grouped[cat] || [];
          return (
            <div key={cat} className="border border-[var(--theme-border)]/30 rounded-md overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-panel)]/50 transition-colors"
                onClick={() => toggleCategory(cat)}
                data-testid={`button-category-${cat.replace(/[^a-zA-Z]/g, "-")}`}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-[var(--text-disabled)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-disabled)]" />}
                  <span className="text-xs font-semibold text-[#3B82F6]">{cat}</span>
                </div>
                <Badge className="text-[9px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate" style={{ backgroundColor: "rgba(107,114,128,0.12)", color: "#6B7280" }}>
                  {categoryItems.length}
                </Badge>
              </button>
              {isExpanded && (
                <div className="border-t border-[var(--theme-border)]/20 divide-y divide-[var(--theme-border)]/20">
                  {categoryItems.map(item => {
                    const statusStyle = statusColors[item.status || "unknown"];
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2 pl-8" data-testid={`tech-item-${item.id}`}>
                        <ConfidenceDot level={item.confidence || "medium"} />
                        <span className="text-xs text-[var(--text-primary)] font-medium flex-1">{item.itemName}</span>
                        {item.version && <span className="text-[10px] text-[var(--text-disabled)] font-data">{item.version}</span>}
                        <Badge
                          className="text-[9px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate border"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, borderColor: `${statusStyle.border}30` }}
                        >
                          {item.status || "unknown"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const priorityOrder: Record<string, number> = { required: 0, recommended: 1, optional: 2 };
const priorityStyles: Record<string, { dot: string; text: string; label: string }> = {
  required: { dot: "bg-red-500", text: "text-red-400", label: "Required" },
  recommended: { dot: "bg-amber-500", text: "text-amber-400", label: "Recommended" },
  optional: { dot: "bg-gray-400", text: "text-gray-400", label: "Optional" },
};

function BaselineAlignment({ comparisons, onRecalculate, isRecalculating }: {
  comparisons: BaselineComparison[];
  onRecalculate: () => void;
  isRecalculating: boolean;
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const alignedCount = comparisons.filter(c => c.gapSeverity === "aligned").length;

  const byPriority = (tiers: string[]) => tiers.reduce((acc, tier) => {
    const items = comparisons.filter(c => (c.priority || "recommended") === tier);
    const aligned = items.filter(c => c.gapSeverity === "aligned").length;
    acc[tier] = { total: items.length, aligned };
    return acc;
  }, {} as Record<string, { total: number; aligned: number }>);

  const tierStats = byPriority(["required", "recommended", "optional"]);

  const sorted = [...comparisons].sort((a, b) => {
    const pa = priorityOrder[a.priority || "recommended"] ?? 1;
    const pb = priorityOrder[b.priority || "recommended"] ?? 1;
    if (pa !== pb) return pa - pb;
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, aligned: 4 };
    return (sevOrder[a.gapSeverity] ?? 2) - (sevOrder[b.gapSeverity] ?? 2);
  });

  if (comparisons.length === 0) {
    return (
      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-baseline-alignment">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#8B5CF6]/10">
            <GitCompare className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Acquirer Baseline Alignment</h3>
        </div>
        <div className="py-8 text-center">
          <GitCompare className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-3 opacity-40" />
          <p className="text-xs text-[var(--text-disabled)] mb-1">Set up your acquirer baseline profile in Settings to enable gap analysis.</p>
          <Button variant="ghost" size="sm" onClick={onRecalculate} disabled={isRecalculating} className="h-7 text-xs gap-1.5 mt-2" data-testid="button-calculate-baseline">
            <Zap className="w-3 h-3" />
            Calculate Alignment
          </Button>
        </div>
      </Card>
    );
  }

  const total = comparisons.length;
  const reqGaps = tierStats.required ? tierStats.required.total - tierStats.required.aligned : 0;
  const recGaps = tierStats.recommended ? tierStats.recommended.total - tierStats.recommended.aligned : 0;
  const alignedPct = total > 0 ? Math.round((alignedCount / total) * 100) : 0;

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-baseline-alignment">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[#8B5CF6]/10">
            <GitCompare className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Acquirer Baseline Alignment</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onRecalculate} disabled={isRecalculating} className="h-7 text-xs gap-1" data-testid="button-recalculate-baseline">
          <RefreshCw className={`w-3 h-3 ${isRecalculating ? "animate-spin" : ""}`} />
          Recalculate
        </Button>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-[var(--text-disabled)]">{alignedCount} of {total} standards aligned</span>
          <span className="text-[#10B981] font-medium font-data">{alignedPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-panel)] overflow-hidden flex">
          {reqGaps > 0 && (
            <div className="h-full bg-red-500/70 transition-all duration-500" style={{ width: `${(reqGaps / total) * 100}%` }} />
          )}
          {recGaps > 0 && (
            <div className="h-full bg-amber-500/70 transition-all duration-500" style={{ width: `${(recGaps / total) * 100}%` }} />
          )}
          <div className="h-full bg-[#10B981] transition-all duration-500 flex-1" style={{ maxWidth: `${alignedPct}%` }} />
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-data" data-testid="tier-summary">
          {tierStats.required?.total > 0 && (
            <span className="text-red-400">{tierStats.required.aligned} of {tierStats.required.total} Required aligned</span>
          )}
          {tierStats.recommended?.total > 0 && (
            <span className="text-amber-400">{tierStats.recommended.aligned} of {tierStats.recommended.total} Recommended</span>
          )}
          {tierStats.optional?.total > 0 && (
            <span className="text-gray-400">{tierStats.optional.aligned} of {tierStats.optional.total} Optional</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-3 text-[10px] uppercase tracking-wider text-[var(--text-disabled)] font-medium mb-2 px-1">
        <span>Priority</span>
        <span>Acquirer Standard</span>
        <span>Current State</span>
        <span>Gap</span>
      </div>

      <div className="divide-y divide-[var(--theme-border)]/40">
        {sorted.map((c) => {
          const sev = severityColors[c.gapSeverity] || severityColors.medium;
          const pri = priorityStyles[c.priority || "recommended"] || priorityStyles.recommended;
          const isExpanded = expandedRow === c.id;
          return (
            <div key={c.id}>
              <div
                className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-3 items-center py-2.5 px-1 cursor-pointer hover:bg-[var(--bg-panel)]/30 transition-colors"
                onClick={() => setExpandedRow(isExpanded ? null : c.id)}
                data-testid={`baseline-row-${c.standardName}`}
              >
                <div className="flex items-center gap-1 min-w-[80px]">
                  <span className={`w-2 h-2 rounded-full ${pri.dot}`} />
                  <span className={`text-[10px] ${pri.text}`}>{pri.label}</span>
                </div>
                <span className="text-xs text-[#10B981] font-medium">{c.standardName}</span>
                <span className="text-xs text-[var(--text-disabled)]">{c.currentState}</span>
                <Badge
                  className="text-[10px] px-2 py-0.5 no-default-hover-elevate no-default-active-elevate border"
                  style={{ backgroundColor: sev.bg, color: sev.text, borderColor: `${sev.border}30` }}
                >
                  {c.gapSeverity}
                </Badge>
              </div>
              {isExpanded && (c.remediationNote || c.estimatedCost) && (
                <div className="px-3 py-2 bg-[var(--bg-panel)]/40 text-[10px] text-[var(--text-disabled)] space-y-1 rounded-md mx-1 mb-1">
                  {c.remediationNote && <div><span className="font-medium text-[var(--text-secondary)]">Remediation:</span> {c.remediationNote}</div>}
                  {c.estimatedCost && <div><span className="font-medium text-[var(--text-secondary)]">Estimated Cost:</span> {c.estimatedCost}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AddTechStackModal({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [category, setCategory] = useState(TECH_CATEGORIES[0]);
  const [itemName, setItemName] = useState("");
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState("current");
  const [notes, setNotes] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/deals/${dealId}/tech-stack`, {
        category, itemName, version: version || null, status, notes: notes || null, confidence: "high",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "tech-stack"] });
      toast({ title: "Item added", description: `${itemName} added to tech stack` });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--theme-border)] rounded-lg p-5 w-[400px] max-w-[90vw] shadow-xl" onClick={e => e.stopPropagation()} data-testid="modal-add-tech">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Add Technology Item</h3>
          <button onClick={onClose} className="text-[var(--text-disabled)] hover:text-[var(--text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider font-medium block mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none" data-testid="select-tech-category">
              {TECH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider font-medium block mb-1">Technology Name</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Microsoft Entra ID" className="w-full bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none" data-testid="input-tech-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider font-medium block mb-1">Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. 2.0" className="w-full bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none" data-testid="input-tech-version" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider font-medium block mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none" data-testid="select-tech-status">
                <option value="current">Current</option>
                <option value="eol">End of Life</option>
                <option value="deprecated">Deprecated</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-disabled)] uppercase tracking-wider font-medium block mb-1">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brief context..." className="w-full bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none" data-testid="input-tech-notes" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={!itemName.trim() || addMutation.isPending} className="h-7 text-xs gap-1" data-testid="button-save-tech">
              {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add Item
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfraBanner({ deal, documentCount, onGenerate, isGenerating }: {
  deal: Deal;
  documentCount: number;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <Card className="bg-gradient-to-r from-[#3B82F6]/5 to-[#8B5CF6]/5 border-[#3B82F6]/20 p-5" data-testid="banner-generate-infra">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#3B82F6]/10 shrink-0">
          <Zap className="w-5 h-5 text-[#3B82F6]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">Infrastructure analysis not yet generated for this deal.</h3>
          <p className="text-xs text-[var(--text-disabled)] mb-3">
            MERIDIAN can analyze your {documentCount} uploaded documents to detect technologies, reconstruct the network topology, and compare against your baseline.
          </p>
          <Button size="sm" onClick={onGenerate} disabled={isGenerating} className="h-8 text-xs gap-2 bg-[#3B82F6] hover:bg-[#2563EB]" data-testid="button-generate-infra">
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Generate Infrastructure Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InfraSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-6 animate-pulse">
        <div className="h-5 bg-[var(--bg-panel)] rounded w-36 mb-4" />
        <div className="flex flex-col items-center gap-4">
          <div className="w-[260px] h-16 bg-[var(--bg-panel)] rounded-md" />
          <div className="w-px h-8 bg-[var(--bg-panel)]" />
          <div className="w-[260px] h-16 bg-[var(--bg-panel)] rounded-md" />
          <div className="w-px h-8 bg-[var(--bg-panel)]" />
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-9 h-9 bg-[var(--bg-panel)] rounded-md" />
            ))}
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5 animate-pulse">
            <div className="h-5 bg-[var(--bg-panel)] rounded w-48 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-4 bg-[var(--bg-panel)] rounded w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function InfraPage() {
  const { toast } = useToast();
  const { data: dealsList = [], isLoading: dealsLoading } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);

  const activeDeal = dealsList.find((d) => d.id === selectedDealId) || dealsList[0];
  const dealId = activeDeal?.id;

  const { data: techStack = [], isLoading: techLoading } = useQuery<TechStackItem[]>({
    queryKey: ["/api/deals", dealId, "tech-stack"],
    enabled: !!dealId,
  });

  const { data: comparisons = [], isLoading: baselineLoading } = useQuery<BaselineComparison[]>({
    queryKey: ["/api/deals", dealId, "baseline-comparisons"],
    enabled: !!dealId,
  });

  const { data: topology, isLoading: topologyLoading } = useQuery<{ nodes: TopologyNode[]; connections: TopologyConnection[] }>({
    queryKey: ["/api/deals", dealId, "topology"],
    enabled: !!dealId,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/deals", dealId, "documents"],
    enabled: !!dealId,
  });

  const extractTechMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/deals/${dealId}/extract-tech-stack`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "tech-stack"] });
      toast({ title: "Tech stack extracted", description: "Technology items have been detected from your documents." });
    },
    onError: (error: any) => toast({ title: "Extraction failed", description: error.message, variant: "destructive" }),
  });

  const extractTopologyMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/deals/${dealId}/extract-topology`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "topology"] });
      toast({ title: "Topology generated", description: "Network topology has been reconstructed from documents." });
    },
    onError: (error: any) => toast({ title: "Topology failed", description: error.message, variant: "destructive" }),
  });

  const baselineMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/deals/${dealId}/compare-baseline`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "baseline-comparisons"] });
      toast({ title: "Baseline compared", description: "Gap analysis has been completed." });
    },
    onError: (error: any) => toast({ title: "Comparison failed", description: error.message, variant: "destructive" }),
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      setGenerationProgress("Step 1 of 3: Extracting technology stack...");
      await apiRequest("POST", `/api/deals/${dealId}/extract-tech-stack`);
      setGenerationProgress("Step 2 of 3: Generating network topology...");
      await apiRequest("POST", `/api/deals/${dealId}/extract-topology`);
      setGenerationProgress("Step 3 of 3: Comparing baseline alignment...");
      await apiRequest("POST", `/api/deals/${dealId}/compare-baseline`);
      setGenerationProgress(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId] });
      toast({ title: "Analysis complete", description: "Infrastructure intelligence has been generated from your documents." });
    },
    onError: (error: any) => {
      setGenerationProgress(null);
      toast({ title: "Analysis failed", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = dealsLoading || (!!dealId && (techLoading || baselineLoading || topologyLoading));
  const hasData = techStack.length > 0 || (topology?.nodes?.length ?? 0) > 0 || comparisons.length > 0;
  const hasDocuments = documents.length > 0;
  const showBanner = !hasData && hasDocuments && !generateAllMutation.isPending;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]" data-testid="text-infra-title">Infrastructure Intelligence</h1>
            <Badge
              className="text-[10px] px-2 py-0.5 no-default-hover-elevate no-default-active-elevate border"
              style={{ backgroundColor: "rgba(6,182,212,0.10)", color: "#06B6D4", borderColor: "rgba(6,182,212,0.2)" }}
            >
              AI-Powered
            </Badge>
          </div>
          <p className="text-xs text-[var(--text-disabled)] mt-0.5">
            {generationProgress || "AI-extracted IT topology, technology stack, and baseline alignment"}
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

      {isLoading ? (
        <InfraSkeleton />
      ) : (
        <>
          {showBanner && activeDeal && (
            <InfraBanner
              deal={activeDeal}
              documentCount={documents.length}
              onGenerate={() => generateAllMutation.mutate()}
              isGenerating={generateAllMutation.isPending}
            />
          )}

          {generateAllMutation.isPending && generationProgress && (
            <Card className="bg-[var(--bg-card)] border-[#3B82F6]/30 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">{generationProgress}</p>
                  <p className="text-[10px] text-[var(--text-disabled)] mt-0.5">This may take a minute...</p>
                </div>
              </div>
            </Card>
          )}

          <NetworkTopologyView
            nodes={topology?.nodes || []}
            connections={topology?.connections || []}
            onRegenerate={() => extractTopologyMutation.mutate()}
            isRegenerating={extractTopologyMutation.isPending}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TechStackView
              items={techStack}
              onReextract={() => extractTechMutation.mutate()}
              isReextracting={extractTechMutation.isPending}
              onAdd={() => setShowAddModal(true)}
            />
            <BaselineAlignment
              comparisons={comparisons}
              onRecalculate={() => baselineMutation.mutate()}
              isRecalculating={baselineMutation.isPending}
            />
          </div>
        </>
      )}

      {showAddModal && dealId && (
        <AddTechStackModal dealId={dealId} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
