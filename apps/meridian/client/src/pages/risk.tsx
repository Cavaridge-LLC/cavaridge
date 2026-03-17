import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Layers,
  Pencil,
  Plus,
  Upload,
  File,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  Mail,
  FileCode,
  Search,
  Sparkles,
  Zap,
  ChevronUp,
  RotateCcw,
  BarChart3,
  Clock,
  Eye,
  AlertTriangleIcon,
  Trash2,
  CheckSquare,
  Link2,
} from "lucide-react";
import type { Deal, Pillar, Finding, Document, DocumentClassification } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpload } from "@/hooks/use-upload";
import {
  getScoreColor,
  getSeverityColor,
  getSeverityOrder,
  computeCompositeScore,
  compositeToPercent,
  getConfidenceTier,
  getOverallConfidenceLabel,
  CONFIDENCE_TIERS,
  type ConfidenceLabel,
} from "@/lib/scoring";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";
import DocumentPreview from "@/components/document-preview";

const PILLAR_SHORT_NAMES: Record<string, string> = {
  "Infrastructure & Architecture": "Infrastructure",
  "Cybersecurity Posture": "Cybersecurity",
  "Regulatory Compliance": "Compliance",
  "Integration Complexity": "Integration",
  "Technology Org & Talent": "Talent",
  "Data Assets & Governance": "Data Gov.",
};

const BASELINE_DEFAULT = 4.2;

const DOC_TYPE_COLORS: Record<string, string> = {
  network_diagram: "#3B82F6",
  security_policy: "#EF4444",
  backup_config: "#F97316",
  vendor_contract: "#8B5CF6",
  org_chart: "#10B981",
  asset_inventory: "#14B8A6",
  firewall_rules: "#EF4444",
  compliance_report: "#10B981",
  disaster_recovery_plan: "#F97316",
  cloud_config: "#3B82F6",
  email_migration: "#06B6D4",
  software_license: "#8B5CF6",
  sla_agreement: "#8B5CF6",
  penetration_test: "#EF4444",
  vulnerability_scan: "#EF4444",
  configuration_export: "#06B6D4",
  screenshot: "#6B7280",
  invoice: "#F59E0B",
  proposal: "#F59E0B",
  meeting_notes: "#6B7280",
  unknown: "#4B5563",
};

const PILLAR_COLORS: Record<string, string> = {
  infrastructure: "#3B82F6",
  security: "#EF4444",
  operations: "#F59E0B",
  compliance: "#10B981",
  scalability: "#8B5CF6",
  strategy: "#06B6D4",
};

const PILLAR_LABELS: Record<string, string> = {
  infrastructure: "Infrastructure",
  security: "Security",
  operations: "Operations",
  compliance: "Compliance",
  scalability: "Scalability",
  strategy: "Strategy",
};

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

function SeverityBadge({ severity }: { severity: string }) {
  const color = getSeverityColor(severity);
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-data capitalize px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate"
      style={{ borderColor: `${color}40`, color, backgroundColor: `${color}10` }}
      data-testid={`badge-severity-${severity}`}
    >
      {severity}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "#EF4444",
    acknowledged: "#F59E0B",
    remediated: "#10B981",
  };
  const color = colors[status] || "var(--text-disabled)";
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-data capitalize px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate"
      style={{ borderColor: `${color}30`, color }}
    >
      {status}
    </Badge>
  );
}

function FilterButton({
  label,
  active,
  count,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer
        ${active
          ? "text-[var(--text-primary)]"
          : "text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
        }
      `}
      style={active ? { backgroundColor: `${color}15`, color } : undefined}
      data-testid={`button-filter-${label.toLowerCase()}`}
    >
      {label}
      {count !== undefined && (
        <span className="font-data ml-1 text-[10px] opacity-70">{count}</span>
      )}
    </button>
  );
}

function PillarMiniCard({ pillar }: { pillar: Pillar }) {
  const score = Number(pillar.score) || 0;
  const weight = Number(pillar.weight) || 0;
  const color = getScoreColor(score, "pillar");
  const shortName = PILLAR_SHORT_NAMES[pillar.pillarName] || pillar.pillarName;
  const tier = getConfidenceTier(pillar.confidenceLabel);
  const docCount = pillar.documentCount || 0;
  const scoreCap = Number(pillar.scoreCap) || 3.0;
  const isNotAssessed = pillar.confidenceLabel === "insufficient";

  return (
    <div
      className="bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md p-3.5"
      data-testid={`pillar-card-${shortName.toLowerCase().replace(/[^a-z]/g, "-")}`}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className={`text-[11px] leading-tight truncate ${isNotAssessed ? "text-[var(--text-disabled)] italic" : "text-[var(--text-secondary)]"}`}>{shortName}</span>
        <span className="font-data text-[10px] text-[var(--text-disabled)] flex-shrink-0">
          {Math.round(weight * 100)}%
        </span>
      </div>
      <div className="flex items-end justify-between gap-2 mb-2">
        <span
          className="font-data text-2xl font-bold leading-none"
          style={{ color }}
          data-testid={`text-pillar-score-${shortName.toLowerCase().replace(/[^a-z]/g, "-")}`}
        >
          {score.toFixed(1)}
        </span>
        <div className="flex items-center gap-1 text-[var(--text-disabled)]">
          <AlertCircle className="w-3 h-3" />
          <span className="font-data text-[10px]">{pillar.findingCount || 0}</span>
        </div>
      </div>
      <div className="space-y-1">
        <div
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm w-fit"
          style={{ backgroundColor: tier.badgeBg }}
          data-testid={`badge-confidence-${shortName.toLowerCase().replace(/[^a-z]/g, "-")}`}
        >
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }} />
          <span className="text-[9px] font-medium" style={{ color: tier.color }}>{tier.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span
            className="font-data text-[9px] text-[var(--text-disabled)]"
            data-testid={`text-evidence-count-${shortName.toLowerCase().replace(/[^a-z]/g, "-")}`}
          >
            {docCount} doc{docCount !== 1 ? "s" : ""} &bull; {pillar.findingCount || 0} finding{(pillar.findingCount || 0) !== 1 ? "s" : ""}
          </span>
        </div>
        {scoreCap < 5.0 && (
          <span
            className="font-data text-[9px] text-[var(--text-disabled)]"
            data-testid={`text-score-cap-${shortName.toLowerCase().replace(/[^a-z]/g, "-")}`}
          >
            Score cap: {scoreCap.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

function CompositeRadarChart({ pillars }: { pillars: Pillar[] }) {
  const data = pillars.map((p) => ({
    pillar: PILLAR_SHORT_NAMES[p.pillarName] || p.pillarName,
    target: Number(p.score) || 0,
    baseline: BASELINE_DEFAULT,
    ceiling: Number(p.scoreCap) || 3.0,
  }));

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-radar-chart">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Composite Risk Profile</h3>
      <div className="w-full" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
            <PolarGrid stroke="var(--theme-border)" />
            <PolarAngleAxis
              dataKey="pillar"
              tick={({ payload, x, y, textAnchor }: any) => {
                const p = pillars.find((pl) => (PILLAR_SHORT_NAMES[pl.pillarName] || pl.pillarName) === payload.value);
                const isInsufficient = p?.confidenceLabel === "insufficient";
                return (
                  <text
                    x={x} y={y}
                    textAnchor={textAnchor}
                    fill={isInsufficient ? "var(--text-disabled)" : "var(--text-secondary)"}
                    fontSize={10}
                    fontFamily="'DM Sans', sans-serif"
                    fontStyle={isInsufficient ? "italic" : "normal"}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 5]}
              tick={{ fill: "var(--text-disabled)", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
              tickCount={6}
              axisLine={false}
            />
            <Radar
              name="Evidence Ceiling"
              dataKey="ceiling"
              stroke="#F59E0B"
              fill="transparent"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            <Radar
              name="Baseline"
              dataKey="baseline"
              stroke="#10B981"
              fill="transparent"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            <Radar
              name="Target"
              dataKey="target"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
              iconSize={10}
              formatter={(value: string) => (
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{value}</span>
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function EvidenceCoverageSummary({ pillars }: { pillars: Pillar[] }) {
  const total = pillars.length;
  const counts = {
    high: pillars.filter((p) => p.confidenceLabel === "high").length,
    moderate: pillars.filter((p) => p.confidenceLabel === "moderate").length,
    low: pillars.filter((p) => p.confidenceLabel === "low").length,
    insufficient: pillars.filter((p) => !p.confidenceLabel || p.confidenceLabel === "insufficient").length,
  };
  const assessed = total - counts.insufficient;
  const coveragePct = total > 0 ? Math.round((pillars.filter((p) => p.confidenceLabel === "moderate" || p.confidenceLabel === "high").length / total) * 100) : 0;

  return (
    <div
      className="bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      data-testid="card-evidence-coverage"
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <FileText className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
        <span className="text-xs text-[var(--text-secondary)]">
          Evidence Coverage: <span className="font-data font-medium">{assessed} of {total}</span> pillars assessed
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {counts.high > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-data px-1.5 py-0.5 rounded" style={{ backgroundColor: CONFIDENCE_TIERS.high.badgeBg, color: CONFIDENCE_TIERS.high.color }} data-testid="chip-coverage-high">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONFIDENCE_TIERS.high.color }} />
            {counts.high} Well Documented
          </span>
        )}
        {counts.moderate > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-data px-1.5 py-0.5 rounded" style={{ backgroundColor: CONFIDENCE_TIERS.moderate.badgeBg, color: CONFIDENCE_TIERS.moderate.color }} data-testid="chip-coverage-moderate">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONFIDENCE_TIERS.moderate.color }} />
            {counts.moderate} Partial
          </span>
        )}
        {counts.low > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-data px-1.5 py-0.5 rounded" style={{ backgroundColor: CONFIDENCE_TIERS.low.badgeBg, color: CONFIDENCE_TIERS.low.color }} data-testid="chip-coverage-low">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONFIDENCE_TIERS.low.color }} />
            {counts.low} Limited
          </span>
        )}
        {counts.insufficient > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-data px-1.5 py-0.5 rounded" style={{ backgroundColor: CONFIDENCE_TIERS.insufficient.badgeBg, color: CONFIDENCE_TIERS.insufficient.color }} data-testid="chip-coverage-insufficient">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONFIDENCE_TIERS.insufficient.color }} />
            {counts.insufficient} Not Assessed
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 sm:max-w-[180px]">
        <div className="h-1.5 bg-[var(--theme-border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${coveragePct}%`, backgroundColor: coveragePct >= 80 ? "#10B981" : coveragePct >= 50 ? "#3B82F6" : "#F59E0B" }}
          />
        </div>
        <span className="font-data text-[9px] text-[var(--text-disabled)]" data-testid="text-coverage-pct">{coveragePct}% coverage</span>
      </div>
    </div>
  );
}

function PillarBreakdown({ pillars }: { pillars: Pillar[] }) {
  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5" data-testid="card-pillar-breakdown">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Pillar Breakdown</h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {pillars.map((p) => (
          <PillarMiniCard key={p.id} pillar={p} />
        ))}
      </div>
    </Card>
  );
}

interface CrossRefMatch {
  id: string;
  similarFindingId: string;
  similarityScore: number;
  similarDealId: string;
  dealTargetName: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  remediationNotes: string | null;
}

function FindingsTable({
  findings,
  pillars,
  onAddFinding,
  documents,
  onPreviewDocument,
  crossRefs,
  totalDeals,
}: {
  findings: Finding[];
  pillars: Pillar[];
  onAddFinding?: () => void;
  documents?: Document[];
  onPreviewDocument?: (docId: string) => void;
  crossRefs?: Record<string, CrossRefMatch[]>;
  totalDeals?: number;
}) {
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [expandedCrossRef, setExpandedCrossRef] = useState<string | null>(null);

  const pillarMap = useMemo(() => {
    const map: Record<string, string> = {};
    pillars.forEach((p) => (map[p.id] = p.pillarName));
    return map;
  }, [pillars]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach((f) => {
      if (f.severity in counts) counts[f.severity as keyof typeof counts]++;
    });
    return counts;
  }, [findings]);

  const filtered = useMemo(() => {
    const list = filter === "all" ? findings : findings.filter((f) => f.severity === filter);
    return [...list].sort((a, b) => getSeverityOrder(a.severity) - getSeverityOrder(b.severity));
  }, [findings, filter]);

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50" data-testid="card-findings">
      <div className="px-5 py-4 border-b border-[var(--theme-border)]/50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Findings Detail</h3>
          <span className="font-data text-[11px] text-[var(--text-disabled)]">({findings.length})</span>
          {onAddFinding && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#3B82F6] text-xs gap-1"
              onClick={onAddFinding}
              data-testid="button-add-finding"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Finding
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1" data-testid="findings-filters">
          <FilterButton
            label="All"
            active={filter === "all"}
            count={findings.length}
            color="#3B82F6"
            onClick={() => setFilter("all")}
          />
          <FilterButton
            label="Critical"
            active={filter === "critical"}
            count={severityCounts.critical}
            color="#EF4444"
            onClick={() => setFilter("critical")}
          />
          <FilterButton
            label="High"
            active={filter === "high"}
            count={severityCounts.high}
            color="#F59E0B"
            onClick={() => setFilter("high")}
          />
          <FilterButton
            label="Medium"
            active={filter === "medium"}
            count={severityCounts.medium}
            color="#8B5CF6"
            onClick={() => setFilter("medium")}
          />
          <FilterButton
            label="Low"
            active={filter === "low"}
            count={severityCounts.low}
            color="#10B981"
            onClick={() => setFilter("low")}
          />
        </div>
      </div>

      <div className="divide-y divide-[var(--theme-border)]/30">
        {filtered.length > 0 ? (
          filtered.map((f) => {
            const refs = crossRefs?.[f.id];
            const hasRefs = refs && refs.length > 0;
            const isExpanded = expandedCrossRef === f.id;

            return (
            <div key={f.id}>
              <div
                className="px-5 py-3.5 flex items-center gap-3 hover-elevate"
                data-testid={`finding-row-${f.id}`}
              >
                <SeverityBadge severity={f.severity} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px] text-[#3B82F6] font-medium flex-shrink-0">
                      {PILLAR_SHORT_NAMES[pillarMap[f.pillarId || ""] || ""] || pillarMap[f.pillarId || ""] || "Unknown"}
                    </span>
                    <span className="text-[var(--theme-border)]">/</span>
                    <span className="text-xs text-[var(--text-primary)] truncate">{f.title}</span>
                  </div>
                  {f.description && (
                    <p className="text-[11px] text-[var(--text-disabled)] line-clamp-1 mt-0.5">{f.description}</p>
                  )}
                  {hasRefs && (
                    <button
                      onClick={() => setExpandedCrossRef(isExpanded ? null : f.id)}
                      className="flex items-center gap-1.5 mt-1 text-[10px] text-[#06B6D4] hover:text-[#22D3EE] transition-colors"
                      data-testid={`btn-cross-ref-${f.id}`}
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Similar finding in {refs.length} other deal{refs.length > 1 ? "s" : ""}</span>
                      <span className="text-[var(--text-disabled)] ml-1">[{isExpanded ? "Hide" : "View"}]</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {f.impactEstimate && (
                    <span className="font-data text-[11px] text-[#F59E0B]" data-testid={`text-impact-${f.id}`}>
                      {f.impactEstimate}
                    </span>
                  )}
                  {f.sourceDocumentId && documents && onPreviewDocument ? (() => {
                    const srcDoc = documents.find((d) => d.id === f.sourceDocumentId);
                    if (!srcDoc) return null;
                    const ext = srcDoc.filename.split(".").pop()?.toLowerCase() || "";
                    const isImg = ["png","jpg","jpeg","gif","webp","tiff"].includes(ext);
                    return (
                      <button
                        onClick={() => onPreviewDocument(srcDoc.id)}
                        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 transition-colors"
                        title={`Source: ${srcDoc.filename}`}
                        data-testid={`btn-finding-source-${f.id}`}
                      >
                        {isImg ? (
                          <img
                            src={`/api/documents/${srcDoc.id}/preview?size=thumb`}
                            alt=""
                            className="w-4 h-4 rounded object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <FileText className="w-3 h-3 text-[#8B5CF6]" />
                        )}
                        <span className="font-data text-[9px] text-[#8B5CF6] truncate max-w-[80px]">{srcDoc.filename}</span>
                      </button>
                    );
                  })() : (
                    <div className="flex items-center gap-1 text-[var(--text-disabled)]">
                      <FileText className="w-3 h-3" />
                      <span className="font-data text-[10px]">{f.sourceCount || 0} src</span>
                    </div>
                  )}
                  <StatusBadge status={f.status} />
                </div>
              </div>

              {hasRefs && isExpanded && (
                <div className="mx-5 mb-3 rounded-lg border border-[#06B6D4]/20 bg-[#06B6D4]/5 p-4" data-testid={`cross-ref-panel-${f.id}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="w-4 h-4 text-[#06B6D4]" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Similar Findings Across Portfolio</span>
                  </div>
                  {totalDeals && totalDeals > 0 && (
                    <p className="text-xs text-[var(--text-secondary)] mb-3">
                      This issue was found in {refs.length} of {totalDeals} portfolio deal{totalDeals > 1 ? "s" : ""}{" "}
                      ({Math.round((refs.length / totalDeals) * 100)}% occurrence rate)
                    </p>
                  )}
                  <div className="space-y-2">
                    {refs.map((ref, idx) => (
                      <div key={ref.similarFindingId} className="rounded border border-[var(--theme-border)]/30 bg-[var(--bg-surface)] p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {idx + 1}. {ref.dealTargetName}
                          </span>
                          <span className="font-data text-[10px] text-[#06B6D4]">
                            {Math.round(ref.similarityScore * 100)}% similar
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mb-1">"{ref.title}"</p>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={ref.status} />
                          {ref.remediationNotes && (
                            <span className="text-[10px] text-[var(--text-disabled)] truncate">
                              Resolution: {ref.remediationNotes}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })
        ) : (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 className="w-6 h-6 text-[var(--theme-border)] mx-auto mb-2" />
            <p className="text-xs text-[var(--text-disabled)]">
              {filter === "all"
                ? "No findings yet. Add your first finding to begin the risk assessment."
                : `No ${filter} severity findings`}
            </p>
            {filter === "all" && onAddFinding && (
              <Button
                size="sm"
                className="mt-3 bg-[#3B82F6] text-white text-xs gap-1"
                onClick={onAddFinding}
                data-testid="button-add-first-finding"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Finding
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

const STAGES = [
  "Initial Screening",
  "Due Diligence",
  "Technical Assessment",
  "Negotiation",
  "Integration Planning",
  "Closed",
];

const STATUSES = ["on-track", "ahead", "at-risk", "blocked"];

function EditDealModal({
  open,
  onOpenChange,
  deal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
}) {
  const { toast } = useToast();
  const [stage, setStage] = useState(deal.stage);
  const [status, setStatus] = useState(deal.status);
  const [facilityCount, setFacilityCount] = useState(String(deal.facilityCount || 0));
  const [userCount, setUserCount] = useState(String(deal.userCount || 0));
  const [estimatedCost, setEstimatedCost] = useState(deal.estimatedIntegrationCost || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/deals/${deal.id}`, {
        stage,
        status,
        facilityCount: parseInt(facilityCount) || 0,
        userCount: parseInt(userCount) || 0,
        estimatedIntegrationCost: estimatedCost || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stats"] });
      toast({ title: "Deal updated", description: `${deal.targetName} has been updated` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] text-[var(--text-primary)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base">Edit Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-sm text-[var(--text-primary)]" data-testid="select-edit-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs text-[var(--text-primary)]">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-sm text-[var(--text-primary)]" data-testid="select-edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs text-[var(--text-primary)] capitalize">{s.replace("-", " ")}</SelectItem>
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
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data"
                data-testid="input-edit-facilities"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">User Count</Label>
              <Input
                type="number"
                value={userCount}
                onChange={(e) => setUserCount(e.target.value)}
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data"
                data-testid="input-edit-users"
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
              data-testid="input-edit-cost"
            />
          </div>

          <Button
            className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            data-testid="button-save-deal"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddFindingModal({
  open,
  onOpenChange,
  dealId,
  pillars,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  pillars: Pillar[];
}) {
  const { toast } = useToast();
  const [pillarId, setPillarId] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impactEstimate, setImpactEstimate] = useState("");
  const [sourceCount, setSourceCount] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/deals/${dealId}/findings`, {
        pillarId,
        severity,
        title,
        description: description || null,
        impactEstimate: impactEstimate || null,
        sourceCount: parseInt(sourceCount) || 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "pillars"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/findings"] });
      toast({ title: "Finding added", description: `${title} recorded and scores recalculated` });
      onOpenChange(false);
      setPillarId("");
      setSeverity("medium");
      setTitle("");
      setDescription("");
      setImpactEstimate("");
      setSourceCount("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = pillarId && severity && title.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] text-[var(--text-primary)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base">Add Finding</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Pillar</Label>
            <Select value={pillarId} onValueChange={setPillarId}>
              <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-sm text-[var(--text-primary)]" data-testid="select-finding-pillar">
                <SelectValue placeholder="Select pillar" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                {pillars.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs text-[var(--text-primary)]">
                    {PILLAR_SHORT_NAMES[p.pillarName] || p.pillarName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-sm text-[var(--text-primary)]" data-testid="select-finding-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                <SelectItem value="critical" className="text-xs text-[#EF4444]">Critical</SelectItem>
                <SelectItem value="high" className="text-xs text-[#F59E0B]">High</SelectItem>
                <SelectItem value="medium" className="text-xs text-[#8B5CF6]">Medium</SelectItem>
                <SelectItem value="low" className="text-xs text-[#10B981]">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Finding title"
              className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm placeholder:text-[#4B5563]"
              data-testid="input-finding-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the finding..."
              className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm resize-none placeholder:text-[#4B5563]"
              rows={3}
              data-testid="input-finding-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">Impact Estimate</Label>
              <Input
                value={impactEstimate}
                onChange={(e) => setImpactEstimate(e.target.value)}
                placeholder="e.g. $50K"
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data placeholder:text-[#4B5563]"
                data-testid="input-finding-impact"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">Source Count</Label>
              <Input
                type="number"
                value={sourceCount}
                onChange={(e) => setSourceCount(e.target.value)}
                placeholder="0"
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data placeholder:text-[#4B5563]"
                data-testid="input-finding-sources"
              />
            </div>
          </div>

          <Button
            className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            data-testid="button-add-finding"
          >
            {createMutation.isPending ? "Adding..." : "Add Finding"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  "Security Assessment": "#EF4444",
  "Network Documentation": "#3B82F6",
  "Compliance Documentation": "#F59E0B",
  "Vendor Contract": "#8B5CF6",
  "IT Policy": "#06B6D4",
  "Asset Inventory": "#10B981",
  "Organization & Staffing": "#10B981",
  "IT Financial": "#F59E0B",
  "Backup & DR": "#06B6D4",
  "Identity & Access": "#3B82F6",
  "Clinical Systems": "#EF4444",
  "OT/ICS Systems": "#F59E0B",
  Unclassified: "var(--text-disabled)",
  Security: "#EF4444",
  Network: "#3B82F6",
  Compliance: "#F59E0B",
  Contract: "#8B5CF6",
  Policy: "#06B6D4",
  Inventory: "#10B981",
  Architecture: "#3B82F6",
  Infrastructure: "#3B82F6",
  Integration: "#8B5CF6",
  Financial: "#F59E0B",
  Data: "#06B6D4",
  "HR & Talent": "#10B981",
  General: "var(--text-disabled)",
};

const EXTRACTION_STATUS_CONFIG: Record<string, { color: string; label: string; pulse?: boolean }> = {
  pending: { color: "var(--text-disabled)", label: "Pending" },
  extracting: { color: "#F59E0B", label: "Extracting", pulse: true },
  extracted: { color: "#10B981", label: "Extracted" },
  failed: { color: "#EF4444", label: "Failed" },
  skipped: { color: "#F59E0B", label: "Skipped" },
  stored: { color: "#06B6D4", label: "Stored" },
  image_pending: { color: "#8B5CF6", label: "Image Pending" },
  vision_failed: { color: "#EF4444", label: "Vision Failed" },
  skipped_too_small: { color: "#F59E0B", label: "Too Small" },
  skipped_too_large: { color: "#F59E0B", label: "Too Large" },
};

const IMAGE_EXTENSIONS_SET = new Set(["png", "jpg", "jpeg", "gif", "tiff", "webp"]);

function isImageDoc(doc: Document): boolean {
  const ext = doc.filename.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS_SET.has(ext);
}

function getVisionFindings(doc: Document): Array<{ observation: string; risk_relevance: string; severity: string }> {
  const meta = doc.metadataJson as any;
  if (!meta?.vision_findings) return [];
  return Array.isArray(meta.vision_findings) ? meta.vision_findings : [];
}

function hasVisionAnalysis(doc: Document): boolean {
  const meta = doc.metadataJson as any;
  return !!meta?.vision_analysis;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return FileText;
  if (["doc", "docx"].includes(ext)) return FileText;
  if (["xls", "xlsx"].includes(ext)) return FileSpreadsheet;
  if (["csv", "tsv"].includes(ext)) return FileSpreadsheet;
  if (["pptx", "ppt"].includes(ext)) return Layers;
  if (["png", "jpg", "jpeg", "gif", "tiff", "bmp", "webp"].includes(ext)) return FileImage;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  if (["eml", "msg"].includes(ext)) return Mail;
  if (["txt", "md", "log", "cfg", "conf", "json", "xml", "yaml", "yml", "ini", "sh", "sql"].includes(ext)) return FileCode;
  return File;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface DocStats {
  totalFiles: number;
  analyzed: number;
  failed: number;
  chunksIndexed: number;
  chunksWithEmbeddings: number;
  pending: number;
  totalTextLength: number;
  classificationBreakdown: Record<string, number>;
}

interface QueueStatusData {
  totalFiles: number;
  completedFiles: number;
  activeFiles: number;
  failedFiles: number;
  items: Array<{
    documentId: string;
    filename: string;
    currentStep: string;
    stepStatus: string;
    errorMessage: string | null;
    estimatedTimeMs: number;
    steps: Array<{
      step: string;
      status: string;
      errorMessage: string | null;
    }>;
  }>;
  errors: Array<{
    documentId: string;
    filename: string;
    step: string;
    error: string;
  }>;
  estimatedRemainingMs: number;
}

function ExtractionBadge({ status }: { status: string }) {
  const config = EXTRACTION_STATUS_CONFIG[status] || EXTRACTION_STATUS_CONFIG.pending;
  return (
    <Badge
      variant="outline"
      className={`text-[9px] font-data px-1.5 py-0 h-[16px] no-default-hover-elevate no-default-active-elevate flex-shrink-0 ${config.pulse ? "animate-pulse" : ""}`}
      style={{
        borderColor: `${config.color}40`,
        color: config.color,
        backgroundColor: `${config.color}10`,
      }}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

interface ImpactData {
  documentName: string;
  chunks: number;
  findings: number;
  childDocs: number;
  chatCitations: number;
  affectedPillars: string[];
  totalFileSize: number;
}

function DeleteDocumentModal({
  open,
  onOpenChange,
  doc,
  dealId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: Document;
  dealId: string;
}) {
  const { toast } = useToast();
  const [keepFindings, setKeepFindings] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const isArchive = doc.filename.toLowerCase().endsWith(".zip") || doc.filename.toLowerCase().endsWith(".rar");

  const { data: impact, isLoading: impactLoading } = useQuery<ImpactData>({
    queryKey: ["/api/documents", doc.id, "impact"],
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/documents/${doc.id}`, { keepFindings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "pillars"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
      toast({ title: "Document deleted", description: `${doc.filename} has been removed` });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const canDelete = isArchive ? confirmText === doc.filename : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] text-[var(--text-primary)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base">Delete Document</DialogTitle>
        </DialogHeader>
        {impactLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[var(--text-disabled)] animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="bg-[var(--bg-panel)] rounded-md p-3 border border-[var(--theme-border)]/30">
              <p className="text-xs text-[var(--text-primary)] font-medium truncate" data-testid="text-delete-filename">{doc.filename}</p>
              {doc.fileSize != null && doc.fileSize > 0 && (
                <p className="font-data text-[10px] text-[var(--text-disabled)] mt-0.5">{formatFileSize(doc.fileSize)}</p>
              )}
            </div>

            {impact && (
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--text-secondary)] font-medium">Impact Analysis</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[var(--bg-panel)] rounded-md p-2 border border-[var(--theme-border)]/30">
                    <span className="text-[9px] text-[var(--text-disabled)] block">Chunks</span>
                    <span className="font-data text-sm text-[var(--text-primary)]" data-testid="text-impact-chunks">{impact.chunks}</span>
                  </div>
                  <div className="bg-[var(--bg-panel)] rounded-md p-2 border border-[var(--theme-border)]/30">
                    <span className="text-[9px] text-[var(--text-disabled)] block">Findings</span>
                    <span className="font-data text-sm text-[var(--text-primary)]" data-testid="text-impact-findings">{impact.findings}</span>
                  </div>
                  {impact.childDocs > 0 && (
                    <div className="bg-[var(--bg-panel)] rounded-md p-2 border border-[var(--theme-border)]/30">
                      <span className="text-[9px] text-[var(--text-disabled)] block">Child Docs</span>
                      <span className="font-data text-sm text-[var(--text-primary)]" data-testid="text-impact-children">{impact.childDocs}</span>
                    </div>
                  )}
                  {impact.chatCitations > 0 && (
                    <div className="bg-[var(--bg-panel)] rounded-md p-2 border border-[var(--theme-border)]/30">
                      <span className="text-[9px] text-[var(--text-disabled)] block">Chat Citations</span>
                      <span className="font-data text-sm text-[#F59E0B]" data-testid="text-impact-citations">{impact.chatCitations}</span>
                    </div>
                  )}
                </div>
                {impact.affectedPillars.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[var(--text-disabled)]">Affected:</span>
                    {impact.affectedPillars.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="text-[9px] font-data px-1.5 py-0 h-[16px] no-default-hover-elevate no-default-active-elevate border-[#3B82F6]/30 text-[#3B82F6]"
                      >
                        {PILLAR_SHORT_NAMES[p] || p}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={keepFindings}
                onCheckedChange={(checked) => setKeepFindings(checked === true)}
                data-testid="checkbox-keep-findings"
              />
              <span className="text-xs text-[var(--text-secondary)]">Keep auto-generated findings</span>
            </label>

            {isArchive && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-[#EF4444]">
                  Type <span className="font-data font-bold">{doc.filename}</span> to confirm deletion of this archive and all child documents.
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={doc.filename}
                  className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm font-data"
                  data-testid="input-confirm-delete"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="border-[var(--theme-border)] text-[var(--text-secondary)]"
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#EF4444] text-white"
                onClick={() => deleteMutation.mutate()}
                disabled={!canDelete || deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BatchDeleteModal({
  open,
  onOpenChange,
  documents: selectedDocs,
  dealId,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: Document[];
  dealId: string;
  onComplete: () => void;
}) {
  const { toast } = useToast();
  const [keepFindings, setKeepFindings] = useState(false);

  const totalSize = selectedDocs.reduce((sum, d) => sum + (d.fileSize || 0), 0);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/documents/batch`, {
        documentIds: selectedDocs.map((d) => d.id),
        keepFindings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "pillars"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
      toast({ title: "Documents deleted", description: `${selectedDocs.length} document${selectedDocs.length > 1 ? "s" : ""} removed` });
      onOpenChange(false);
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Batch delete failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] text-[var(--text-primary)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base">Delete {selectedDocs.length} Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="bg-[var(--bg-panel)] rounded-md p-3 border border-[var(--theme-border)]/30 max-h-40 overflow-y-auto">
            {selectedDocs.map((d) => (
              <p key={d.id} className="text-[11px] text-[var(--text-secondary)] truncate py-0.5" data-testid={`text-batch-doc-${d.id}`}>
                {d.filename}
                {d.fileSize != null && d.fileSize > 0 && (
                  <span className="font-data text-[10px] text-[var(--text-disabled)] ml-1.5">({formatFileSize(d.fileSize)})</span>
                )}
              </p>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-disabled)]">
            Total size: <span className="font-data">{formatFileSize(totalSize)}</span>
          </p>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={keepFindings}
              onCheckedChange={(checked) => setKeepFindings(checked === true)}
              data-testid="checkbox-batch-keep-findings"
            />
            <span className="text-xs text-[var(--text-secondary)]">Keep auto-generated findings</span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-[var(--theme-border)] text-[var(--text-secondary)]"
              data-testid="button-cancel-batch-delete"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#EF4444] text-white"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-batch-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete {selectedDocs.length}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PillarDots({ classification }: { classification?: DocumentClassification }) {
  if (!classification) return null;
  const pillars = [
    { key: "infrastructure", active: classification.pillarInfrastructure },
    { key: "security", active: classification.pillarSecurity },
    { key: "operations", active: classification.pillarOperations },
    { key: "compliance", active: classification.pillarCompliance },
    { key: "scalability", active: classification.pillarScalability },
    { key: "strategy", active: classification.pillarStrategy },
  ].filter(p => p.active);
  if (pillars.length === 0) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5">
        {pillars.map(p => (
          <Tooltip key={p.key}>
            <TooltipTrigger asChild>
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: PILLAR_COLORS[p.key] || "#6B7280" }}
                data-testid={`pillar-dot-${p.key}`}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] px-2 py-1">
              {PILLAR_LABELS[p.key] || p.key}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

function DocTypeBadge({ classification }: { classification?: DocumentClassification }) {
  if (!classification || classification.documentType === "unknown") return null;
  const color = DOC_TYPE_COLORS[classification.documentType] || "#4B5563";
  const label = classification.documentType.replace(/_/g, " ");
  return (
    <Badge
      variant="outline"
      className="text-[8px] font-data px-1 py-0 h-[14px] no-default-hover-elevate no-default-active-elevate flex-shrink-0 capitalize"
      style={{ borderColor: `${color}40`, color, backgroundColor: `${color}10` }}
      data-testid={`badge-doc-type-${classification.documentType}`}
    >
      {label}
    </Badge>
  );
}

function DocumentRow({
  doc,
  isChild,
  expandedArchives,
  toggleArchive,
  childDocs,
  onRetry,
  onAnalyzeImage,
  isAnalyzingImage,
  onDelete,
  selectionMode,
  isSelected,
  onToggleSelect,
  onPreview,
  aiClassification,
}: {
  doc: Document;
  isChild?: boolean;
  expandedArchives: Set<string>;
  toggleArchive: (id: string) => void;
  childDocs: Document[];
  onRetry?: (docId: string) => void;
  onAnalyzeImage?: (docId: string) => void;
  isAnalyzingImage?: boolean;
  onDelete?: (doc: Document) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (docId: string) => void;
  onPreview?: (docId: string) => void;
  aiClassification?: DocumentClassification;
}) {
  const Icon = getFileIcon(doc.filename);
  const clsColor = CLASSIFICATION_COLORS[doc.classification || "General"] || "var(--text-disabled)";
  const isArchive = doc.filename.toLowerCase().endsWith(".zip") || doc.filename.toLowerCase().endsWith(".rar");
  const hasChildren = childDocs.length > 0;
  const isExpanded = expandedArchives.has(doc.id);
  const displayName = doc.folderPath && isChild ? doc.folderPath : doc.filename;
  const canRetry = doc.extractionStatus === "failed" || doc.extractionStatus === "skipped" || doc.extractionStatus === "vision_failed";
  const isImage = isImageDoc(doc);
  const visionFindings = getVisionFindings(doc);
  const hasVision = hasVisionAnalysis(doc);
  const descriptionPreview = isImage && hasVision && doc.extractedText
    ? doc.extractedText.split("\n\nEXTRACTED TEXT:")[0].slice(0, 150)
    : null;

  return (
    <>
      <div
        className={`px-5 py-2.5 flex items-center gap-2.5 hover-elevate ${isChild ? "pl-10" : ""}`}
        data-testid={`document-row-${doc.id}`}
      >
        {selectionMode && onToggleSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(doc.id)}
            className="flex-shrink-0"
            data-testid={`checkbox-select-${doc.id}`}
          />
        )}
        {isArchive && hasChildren ? (
          <button
            onClick={() => toggleArchive(doc.id)}
            className="w-4 h-4 flex-shrink-0 text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
            data-testid={`btn-expand-${doc.id}`}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${clsColor}10` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: clsColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onPreview?.(doc.id)}
            className={`text-xs truncate text-left hover:text-[#3B82F6] transition-colors cursor-pointer ${isChild ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
            data-testid={`btn-preview-${doc.id}`}
          >
            {displayName}
          </button>
          {descriptionPreview && (
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-tight">
              {descriptionPreview}{descriptionPreview.length >= 150 ? "..." : ""}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {doc.fileSize != null && doc.fileSize > 0 && (
              <span className="font-data text-[10px] text-[var(--text-disabled)]">{formatFileSize(doc.fileSize)}</span>
            )}
            {doc.textLength != null && doc.textLength > 0 && (
              <span className="font-data text-[10px] text-[var(--text-disabled)]">{formatNumber(doc.textLength)} chars</span>
            )}
            {doc.extractionError && (
              <span className="font-data text-[10px] text-red-400/70 truncate max-w-[180px]" title={doc.extractionError}>
                {doc.extractionError}
              </span>
            )}
            {doc.createdAt && (
              <span className="font-data text-[10px] text-[var(--text-disabled)]">
                {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
            {visionFindings.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-data text-amber-400">
                <AlertTriangleIcon className="w-2.5 h-2.5" />
                {visionFindings.length} finding{visionFindings.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {onPreview && (
          <button
            onClick={() => onPreview(doc.id)}
            className="text-[9px] font-data px-1.5 py-0.5 rounded border border-[var(--theme-border)] text-[var(--text-secondary)] hover:bg-[var(--theme-border)]/30 transition-colors flex-shrink-0"
            data-testid={`btn-eye-preview-${doc.id}`}
          >
            <Eye className="w-3 h-3" />
          </button>
        )}
        {isImage && onAnalyzeImage && (
          <button
            onClick={() => onAnalyzeImage(doc.id)}
            disabled={isAnalyzingImage}
            className="text-[9px] font-data px-2 py-0.5 rounded border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors flex-shrink-0 disabled:opacity-50"
            data-testid={`btn-analyze-image-${doc.id}`}
          >
            {isAnalyzingImage ? "Analyzing..." : hasVision ? "Re-analyze" : "Analyze"}
          </button>
        )}
        {canRetry && onRetry && !isImage && (
          <button
            onClick={() => onRetry(doc.id)}
            className="text-[9px] font-data px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors flex-shrink-0"
            data-testid={`btn-retry-${doc.id}`}
          >
            Retry
          </button>
        )}
        {onDelete && !selectionMode && (
          <button
            onClick={() => onDelete(doc)}
            className="text-[var(--text-disabled)] hover:text-[#EF4444] transition-colors flex-shrink-0"
            style={{ visibility: "visible" }}
            data-testid={`btn-delete-${doc.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <ExtractionBadge status={doc.extractionStatus} />
        <Badge
          variant="outline"
          className="text-[9px] font-data px-1.5 py-0 h-[16px] no-default-hover-elevate no-default-active-elevate flex-shrink-0"
          style={{
            borderColor: `${clsColor}30`,
            color: clsColor,
            backgroundColor: `${clsColor}08`,
          }}
          data-testid={`badge-classification-${doc.id}`}
        >
          {doc.classification || "Unclassified"}
        </Badge>
        <DocTypeBadge classification={aiClassification} />
        <PillarDots classification={aiClassification} />
      </div>
      {isArchive && isExpanded && childDocs.map((child) => (
        <DocumentRow
          key={child.id}
          doc={child}
          isChild
          expandedArchives={expandedArchives}
          toggleArchive={toggleArchive}
          childDocs={[]}
          onRetry={onRetry}
          onAnalyzeImage={onAnalyzeImage}
          isAnalyzingImage={isAnalyzingImage}
          onDelete={onDelete}
          selectionMode={selectionMode}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          aiClassification={undefined}
        />
      ))}
    </>
  );
}

interface EmbedProgress {
  total: number;
  completed: number;
  failed: number;
  status: "idle" | "running" | "completed" | "error";
  message: string;
}

interface SearchResultItem {
  chunkText: string;
  documentId: string;
  chunkIndex: number;
  similarity: number;
  filename: string;
  classification: string | null;
}

function DocumentsPanel({
  dealId,
  documents,
  isLoading,
  canUpload = true,
}: {
  dealId: string;
  documents: Document[];
  isLoading: boolean;
  canUpload?: boolean;
}) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [expandedArchives, setExpandedArchives] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [embedProgress, setEmbedProgress] = useState<EmbedProgress | null>(null);
  const [processingExpanded, setProcessingExpanded] = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [showBatchDelete, setShowBatchDelete] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const { data: queueStatus } = useQuery<QueueStatusData>({
    queryKey: ["/api/deals", dealId, "queue-status"],
    refetchInterval: (query) => {
      const data = query.state.data;
      return uploadingFiles.length > 0 || (data?.activeFiles ?? 0) > 0 ? 2000 : 10000;
    },
  });

  const isProcessing = (queueStatus?.activeFiles ?? 0) > 0 || uploadingFiles.length > 0;

  const { data: docStats } = useQuery<DocStats>({
    queryKey: ["/api/deals", dealId, "document-stats"],
    refetchInterval: isProcessing || embedProgress?.status === "running" ? 2000 : false,
  });

  const { data: aiClassifications } = useQuery<DocumentClassification[]>({
    queryKey: ["/api/deals", dealId, "classifications"],
  });

  const classificationMap = useMemo(() => {
    const map: Record<string, DocumentClassification> = {};
    (aiClassifications || []).forEach(c => { map[c.documentId] = c; });
    return map;
  }, [aiClassifications]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    (aiClassifications || []).forEach(c => { if (c.documentType !== "unknown") types.add(c.documentType); });
    return Array.from(types).sort();
  }, [aiClassifications]);

  const retryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/deals/${dealId}/retry-failed`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Retrying", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "queue-status"] });
    },
    onError: () => {
      toast({ title: "Retry failed", variant: "destructive" });
    },
  });

  const retryDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await apiRequest("POST", `/api/documents/${docId}/retry`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Retrying document", description: "Document has been re-queued for processing" });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
    },
    onError: () => {
      toast({ title: "Retry failed", variant: "destructive" });
    },
  });

  const { uploadFile } = useUpload({
    onSuccess: () => {},
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const registerDocument = useMutation({
    mutationFn: async (fileData: { filename: string; fileType: string; fileSize: number; objectPath: string }) => {
      const res = await apiRequest("POST", `/api/deals/${dealId}/documents`, fileData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stats"] });
      if (data?.isDuplicate) {
        toast({ title: "Duplicate detected", description: `${data.filename} already exists in this deal.` });
      }
    },
  });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const uploads = fileArray.map(async (file) => {
      setUploadingFiles((prev) => [...prev, file.name]);
      try {
        const result = await uploadFile(file);
        if (result) {
          const doc = await registerDocument.mutateAsync({
            filename: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
            objectPath: result.objectPath,
          });
          if (!doc?.isDuplicate) {
            toast({ title: "Document ingested", description: `${file.name} extracted and classified` });
          }
        }
      } catch {
        toast({ title: "Upload failed", description: `Failed to process ${file.name}`, variant: "destructive" });
      } finally {
        setUploadingFiles((prev) => prev.filter((n) => n !== file.name));
      }
    });
    await Promise.allSettled(uploads);
  }, [uploadFile, registerDocument, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const toggleArchive = useCallback((id: string) => {
    setExpandedArchives((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canDelete = hasPermission("delete_documents");

  const toggleSelect = useCallback((docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const handleDeleteDoc = useCallback((doc: Document) => {
    setDeleteDoc(doc);
  }, []);

  const selectedDocuments = useMemo(() => {
    return documents.filter((d) => selectedIds.has(d.id));
  }, [documents, selectedIds]);

  const topLevelDocs = useMemo(() => {
    return documents.filter((d) => {
      if (d.parentArchiveId) return false;
      if (typeFilter !== "all" || pillarFilter !== "all") {
        const cls = classificationMap[d.id];
        if (typeFilter !== "all" && (!cls || cls.documentType !== typeFilter)) return false;
        if (pillarFilter !== "all" && cls) {
          const pillarKey = `pillar${pillarFilter.charAt(0).toUpperCase() + pillarFilter.slice(1)}` as keyof DocumentClassification;
          if (!cls[pillarKey]) return false;
        } else if (pillarFilter !== "all" && !cls) return false;
      }
      return true;
    });
  }, [documents, typeFilter, pillarFilter, classificationMap]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === topLevelDocs.length) return new Set();
      return new Set(topLevelDocs.map((d) => d.id));
    });
  }, [topLevelDocs]);

  const childDocsByParent = useMemo(() => {
    const map: Record<string, Document[]> = {};
    documents.forEach((d) => {
      if (d.parentArchiveId) {
        if (!map[d.parentArchiveId]) map[d.parentArchiveId] = [];
        map[d.parentArchiveId].push(d);
      }
    });
    return map;
  }, [documents]);

  const classificationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => {
      const cls = d.classification || "Unclassified";
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await apiRequest("POST", "/api/documents/search", {
        dealId,
        query: searchQuery.trim(),
        topK: 10,
      });
      const results = await res.json();
      setSearchResults(results);
    } catch {
      toast({ title: "Search failed", description: "Could not search documents", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, dealId, toast]);

  const embedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/documents/embed", { dealId });
      return res.json() as Promise<EmbedProgress>;
    },
    onSuccess: (data) => {
      setEmbedProgress(data);
      if (data.status === "running") {
        pollEmbedProgress();
      }
    },
    onError: () => {
      toast({ title: "Embedding failed", description: "Could not generate embeddings", variant: "destructive" });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/documents/reprocess", { dealId });
      return res.json() as Promise<{ total: number; processed: number; failed: number; skippedImages: number; message: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Reprocess complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
    },
    onError: () => {
      toast({ title: "Reprocess failed", description: "Could not reprocess documents", variant: "destructive" });
    },
  });

  const [imageAnalysisProgress, setImageAnalysisProgress] = useState<{
    total: number; completed: number; current: string; status: string; findingsDetected: number;
  } | null>(null);
  const imageAnalysisPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unanalyzedImageCount = useMemo(() => {
    return documents.filter((d) => {
      if (!isImageDoc(d)) return false;
      return d.extractionStatus === "stored" || d.extractionStatus === "vision_failed" ||
        d.extractionStatus === "image_pending" ||
        (d.extractedText && d.extractedText.includes("visual analysis pending"));
    }).length;
  }, [documents]);

  const analyzeImagesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/documents/analyze-images", { dealId });
      return res.json() as Promise<{ total: number; message: string }>;
    },
    onSuccess: (data) => {
      if (data.total > 0) {
        pollImageAnalysis();
      } else {
        toast({ title: "No images to analyze", description: data.message });
      }
    },
    onError: () => {
      toast({ title: "Image analysis failed", description: "Could not start image analysis", variant: "destructive" });
    },
  });

  const pollImageAnalysis = useCallback(() => {
    if (imageAnalysisPollRef.current) clearInterval(imageAnalysisPollRef.current);
    imageAnalysisPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/analyze-images/status?dealId=${dealId}`);
        const progress = await res.json();
        setImageAnalysisProgress(progress);
        if (progress.status !== "running") {
          if (imageAnalysisPollRef.current) clearInterval(imageAnalysisPollRef.current);
          imageAnalysisPollRef.current = null;
          if (progress.status === "complete") {
            toast({
              title: "Image analysis complete",
              description: `Analyzed ${progress.completed} images. ${progress.findingsDetected} findings detected.`,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "findings"] });
            queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "pillars"] });
          }
        }
      } catch {
        if (imageAnalysisPollRef.current) clearInterval(imageAnalysisPollRef.current);
        imageAnalysisPollRef.current = null;
      }
    }, 2000);
  }, [dealId, toast]);

  useEffect(() => {
    return () => {
      if (imageAnalysisPollRef.current) clearInterval(imageAnalysisPollRef.current);
    };
  }, []);

  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const singleImageAnalysisMutation = useMutation({
    mutationFn: async (docId: string) => {
      setAnalyzingDocId(docId);
      const res = await apiRequest("POST", `/api/documents/${docId}/analyze-image`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      setAnalyzingDocId(null);
      const msg = data.findingsCreated > 0
        ? `Image analyzed. ${data.findingsCreated} findings detected.`
        : "Image analyzed successfully.";
      toast({ title: "Analysis complete", description: msg });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "findings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "pillars"] });
    },
    onError: () => {
      setAnalyzingDocId(null);
      toast({ title: "Analysis failed", description: "Could not analyze image", variant: "destructive" });
    },
  });

  const pollEmbedProgress = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/embed-progress/${dealId}`);
        const progress = await res.json() as EmbedProgress;
        setEmbedProgress(progress);
        if (progress.status !== "running") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (progress.status === "completed") {
            toast({ title: "Embeddings complete", description: progress.message });
            queryClient.invalidateQueries({ queryKey: ["/api/deals", dealId, "document-stats"] });
          }
        }
      } catch {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 1500);
  }, [dealId, toast]);

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50" data-testid="card-documents">
      <div className="px-5 py-4 border-b border-[var(--theme-border)]/50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#06B6D4]" />
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Documents</h3>
          <span className="font-data text-[11px] text-[var(--text-disabled)]">({documents.length})</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unanalyzedImageCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] border-[var(--theme-border)] text-[#8B5CF6] gap-1"
              onClick={() => analyzeImagesMutation.mutate()}
              disabled={analyzeImagesMutation.isPending || imageAnalysisProgress?.status === "running"}
              data-testid="button-analyze-images"
            >
              {imageAnalysisProgress?.status === "running" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              {imageAnalysisProgress?.status === "running"
                ? `Analyzing ${imageAnalysisProgress.completed}/${imageAnalysisProgress.total}...`
                : `Analyze Images (${unanalyzedImageCount})`}
            </Button>
          )}
          {docStats && ((docStats.failed || 0) > 0 || (docStats.pending || 0) > 0) && (
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] border-[var(--theme-border)] text-[#F59E0B] gap-1"
              onClick={() => reprocessMutation.mutate()}
              disabled={reprocessMutation.isPending}
              data-testid="button-reprocess-documents"
            >
              {reprocessMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3" />
              )}
              {reprocessMutation.isPending ? "Reprocessing..." : "Reprocess Documents"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-[10px] border-[var(--theme-border)] text-[#8B5CF6] gap-1"
            onClick={() => embedMutation.mutate()}
            disabled={embedMutation.isPending || embedProgress?.status === "running" || (docStats?.analyzed || 0) === 0}
            data-testid="button-generate-embeddings"
          >
            {embedProgress?.status === "running" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            {embedProgress?.status === "running" ? "Embedding..." : "Generate Embeddings"}
          </Button>
          {canDelete && documents.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className={`text-[10px] border-[var(--theme-border)] gap-1 ${selectionMode ? "text-[#06B6D4] border-[#06B6D4]/40" : "text-[var(--text-secondary)]"} toggle-elevate ${selectionMode ? "toggle-elevated" : ""}`}
              onClick={() => {
                setSelectionMode((prev) => !prev);
                if (selectionMode) setSelectedIds(new Set());
              }}
              data-testid="button-toggle-select"
            >
              <CheckSquare className="w-3 h-3" />
              {selectionMode ? "Cancel" : "Select"}
            </Button>
          )}
          {Object.entries(classificationCounts).slice(0, 4).map(([cls, count]) => (
            <Badge
              key={cls}
              variant="outline"
              className="text-[9px] font-data px-1.5 py-0 h-[16px] no-default-hover-elevate no-default-active-elevate"
              style={{
                borderColor: `${CLASSIFICATION_COLORS[cls] || "var(--text-disabled)"}30`,
                color: CLASSIFICATION_COLORS[cls] || "var(--text-disabled)",
              }}
            >
              {cls} {count}
            </Badge>
          ))}
        </div>
      </div>

      {imageAnalysisProgress?.status === "running" && (
        <div className="px-5 py-2 border-b border-[var(--theme-border)]/30">
          <div className="flex items-center justify-between mb-1">
            <span className="font-data text-[10px] text-[#8B5CF6]">
              Analyzing image {imageAnalysisProgress.completed + 1} of {imageAnalysisProgress.total}: {imageAnalysisProgress.current}
            </span>
            <span className="font-data text-[10px] text-[var(--text-disabled)]">
              {imageAnalysisProgress.total > 0 ? Math.round((imageAnalysisProgress.completed / imageAnalysisProgress.total) * 100) : 0}%
            </span>
          </div>
          <div className="w-full h-1 bg-[var(--bg-panel)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] rounded-full transition-all duration-500"
              style={{ width: `${imageAnalysisProgress.total > 0 ? (imageAnalysisProgress.completed / imageAnalysisProgress.total) * 100 : 0}%` }}
            />
          </div>
          {imageAnalysisProgress.findingsDetected > 0 && (
            <span className="font-data text-[10px] text-amber-400 mt-1 inline-block">
              {imageAnalysisProgress.findingsDetected} findings detected so far
            </span>
          )}
        </div>
      )}

      {embedProgress?.status === "running" && (
        <div className="px-5 py-2 border-b border-[var(--theme-border)]/30">
          <div className="flex items-center justify-between mb-1">
            <span className="font-data text-[10px] text-[#8B5CF6]">{embedProgress.message}</span>
            <span className="font-data text-[10px] text-[var(--text-disabled)]">
              {embedProgress.total > 0 ? Math.round((embedProgress.completed / embedProgress.total) * 100) : 0}%
            </span>
          </div>
          <div className="w-full h-1 bg-[var(--bg-panel)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] rounded-full transition-all duration-500"
              style={{ width: `${embedProgress.total > 0 ? (embedProgress.completed / embedProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {docStats && (docStats.totalFiles > 0 || uploadingFiles.length > 0) && (
        <div className="px-5 py-2.5 border-b border-[var(--theme-border)]/30 flex items-center gap-4 flex-wrap" data-testid="doc-stats-bar">
          <span className="font-data text-[10px] text-[var(--text-secondary)]">
            {docStats.totalFiles} uploaded
          </span>
          <span className="font-data text-[10px] text-[#10B981]">
            {docStats.analyzed} analyzed
          </span>
          {docStats.failed > 0 && (
            <span className="font-data text-[10px] text-[#EF4444]">
              {docStats.failed} failed
            </span>
          )}
          <span className="font-data text-[10px] text-[#3B82F6]">
            {formatNumber(docStats.chunksIndexed)} chunks
          </span>
          <span className="font-data text-[10px] text-[#8B5CF6]">
            {formatNumber(docStats.chunksWithEmbeddings || 0)}/{formatNumber(docStats.chunksIndexed)} embedded
          </span>
          {docStats.pending > 0 && (
            <span className="font-data text-[10px] text-[#F59E0B] animate-pulse">
              {docStats.pending} processing...
            </span>
          )}
        </div>
      )}

      {queueStatus && (queueStatus.totalFiles > 0) && (
        <div className="border-b border-[var(--theme-border)]/30" data-testid="processing-monitor">
          <button
            onClick={() => setProcessingExpanded(!processingExpanded)}
            className="w-full px-5 py-2 flex items-center justify-between gap-2 cursor-pointer"
            data-testid="button-toggle-processing"
          >
            <div className="flex items-center gap-2">
              {queueStatus.activeFiles > 0 ? (
                <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />
              ) : queueStatus.failedFiles > 0 ? (
                <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              )}
              <span className="text-[11px] text-[var(--text-primary)] font-medium">
                Processing: {queueStatus.completedFiles} of {queueStatus.totalFiles} files complete
              </span>
              {queueStatus.failedFiles > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] font-data px-1 py-0 h-[14px] border-[#EF4444]/30 text-[#EF4444] no-default-hover-elevate no-default-active-elevate"
                >
                  {queueStatus.failedFiles} failed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {queueStatus.estimatedRemainingMs > 0 && (
                <span className="font-data text-[10px] text-[var(--text-disabled)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{Math.ceil(queueStatus.estimatedRemainingMs / 1000)}s remaining
                </span>
              )}
              {processingExpanded ? (
                <ChevronUp className="w-3 h-3 text-[var(--text-disabled)]" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[var(--text-disabled)]" />
              )}
            </div>
          </button>

          {queueStatus.totalFiles > 0 && (
            <div className="px-5 pb-1">
              <div className="w-full h-1 bg-[var(--bg-panel)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
                  style={{ width: `${queueStatus.totalFiles > 0 ? (queueStatus.completedFiles / queueStatus.totalFiles) * 100 : 0}%` }}
                  data-testid="progress-bar-processing"
                />
              </div>
            </div>
          )}

          {processingExpanded && (
            <div className="px-5 pb-3 pt-1 space-y-1" data-testid="processing-details">
              {queueStatus.items.map((item) => {
                const stepLabels: Record<string, string> = { extract: "Extracting", classify: "Classifying", chunk: "Chunking", embed: "Embedding" };
                const isActive = item.stepStatus === "processing";
                const isDone = item.steps.every((s) => s.status === "complete");
                const hasFailed = item.steps.some((s) => s.status === "failed");
                const completedSteps = item.steps.filter((s) => s.status === "complete").length;
                return (
                  <div
                    key={item.documentId}
                    className="flex items-center gap-2 py-1"
                    data-testid={`queue-item-${item.documentId}`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                    ) : hasFailed ? (
                      <AlertCircle className="w-3 h-3 text-[#EF4444] flex-shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 text-[#3B82F6] animate-spin flex-shrink-0" />
                    ) : (
                      <Clock className="w-3 h-3 text-[var(--text-disabled)] flex-shrink-0" />
                    )}
                    <span className="text-[10px] text-[var(--text-secondary)] truncate flex-1">{item.filename}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.steps.map((s) => (
                        <div
                          key={s.step}
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.status === "complete" ? "bg-[#10B981]" :
                            s.status === "failed" ? "bg-[#EF4444]" :
                            s.status === "processing" ? "bg-[#3B82F6] animate-pulse" :
                            "bg-[var(--theme-border)]"
                          }`}
                          title={`${s.step}: ${s.status}`}
                        />
                      ))}
                    </div>
                    <span className="font-data text-[9px] text-[var(--text-disabled)] flex-shrink-0 w-16 text-right">
                      {isDone ? "Done" : hasFailed ? "Failed" : `${stepLabels[item.currentStep] || item.currentStep}`}
                    </span>
                  </div>
                );
              })}

              {queueStatus.errors.length > 0 && (
                <div className="mt-2 space-y-1" data-testid="processing-errors">
                  {queueStatus.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 bg-[#EF4444]/5 rounded-md px-2.5 py-1.5 border border-[#EF4444]/20">
                      <AlertCircle className="w-3 h-3 text-[#EF4444] flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-[#EF4444] font-medium">{err.filename}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]"> ({err.step}): </span>
                        <span className="text-[10px] text-[var(--text-disabled)]">{err.error}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {queueStatus.failedFiles > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px] border-[#EF4444]/30 text-[#EF4444] gap-1 mt-1"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                  data-testid="button-retry-failed"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry Failed
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {docStats && docStats.totalFiles > 0 && (
        <div className="border-b border-[var(--theme-border)]/30" data-testid="statistics-card">
          <button
            onClick={() => setStatsExpanded(!statsExpanded)}
            className="w-full px-5 py-2 flex items-center justify-between gap-2 cursor-pointer"
            data-testid="button-toggle-stats"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span className="text-[11px] text-[var(--text-primary)] font-medium">Statistics</span>
            </div>
            {statsExpanded ? (
              <ChevronUp className="w-3 h-3 text-[var(--text-disabled)]" />
            ) : (
              <ChevronDown className="w-3 h-3 text-[var(--text-disabled)]" />
            )}
          </button>

          {statsExpanded && (
            <div className="px-5 pb-3 space-y-3" data-testid="stats-details">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[var(--bg-panel)] rounded-md p-2.5 border border-[var(--theme-border)]/30">
                  <span className="text-[9px] text-[var(--text-disabled)] block mb-0.5">Total Files</span>
                  <span className="font-data text-sm text-[var(--text-primary)]" data-testid="text-total-files">{docStats.totalFiles}</span>
                </div>
                <div className="bg-[var(--bg-panel)] rounded-md p-2.5 border border-[var(--theme-border)]/30">
                  <span className="text-[9px] text-[var(--text-disabled)] block mb-0.5">Text Extracted</span>
                  <span className="font-data text-sm text-[var(--text-primary)]" data-testid="text-total-chars">
                    {docStats.totalTextLength >= 1000000
                      ? `${(docStats.totalTextLength / 1000000).toFixed(1)}M`
                      : docStats.totalTextLength >= 1000
                        ? `${(docStats.totalTextLength / 1000).toFixed(1)}K`
                        : String(docStats.totalTextLength)} chars
                  </span>
                </div>
                <div className="bg-[var(--bg-panel)] rounded-md p-2.5 border border-[var(--theme-border)]/30">
                  <span className="text-[9px] text-[var(--text-disabled)] block mb-0.5">Total Chunks</span>
                  <span className="font-data text-sm text-[var(--text-primary)]" data-testid="text-total-chunks">{formatNumber(docStats.chunksIndexed)}</span>
                </div>
                <div className="bg-[var(--bg-panel)] rounded-md p-2.5 border border-[var(--theme-border)]/30">
                  <span className="text-[9px] text-[var(--text-disabled)] block mb-0.5">Embedded</span>
                  <span className="font-data text-sm text-[var(--text-primary)]" data-testid="text-embedded-chunks">
                    {formatNumber(docStats.chunksWithEmbeddings || 0)} / {formatNumber(docStats.chunksIndexed)}
                  </span>
                </div>
              </div>

              {Object.keys(docStats.classificationBreakdown || {}).length > 0 && (
                <div>
                  <span className="text-[9px] text-[var(--text-disabled)] block mb-1.5">Classification Breakdown</span>
                  <div className="space-y-1">
                    {Object.entries(docStats.classificationBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cls, count]) => {
                        const maxCount = Math.max(...Object.values(docStats.classificationBreakdown));
                        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        const color = CLASSIFICATION_COLORS[cls] || "var(--text-disabled)";
                        return (
                          <div key={cls} className="flex items-center gap-2" data-testid={`stat-classification-${cls.toLowerCase().replace(/\s/g, "-")}`}>
                            <span className="text-[9px] w-28 truncate flex-shrink-0" style={{ color }}>{cls}</span>
                            <div className="flex-1 h-1.5 bg-[var(--bg-panel)] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                            <span className="font-data text-[9px] text-[var(--text-disabled)] w-6 text-right flex-shrink-0">{count}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center gap-2 bg-[var(--bg-panel)] rounded-md px-3 py-1.5 border border-[var(--theme-border)]/30">
          <Search className="w-3.5 h-3.5 text-[var(--text-disabled)] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search document content..."
            className="bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none w-full font-data"
            data-testid="input-doc-search"
          />
          {isSearching && <Loader2 className="w-3 h-3 text-[#3B82F6] animate-spin flex-shrink-0" />}
        </div>
        {(availableTypes.length > 0) && (
          <div className="flex items-center gap-2 mt-2" data-testid="filter-bar">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-7 text-[10px] font-data bg-[var(--bg-panel)] border-[var(--theme-border)]/30 w-[140px]" data-testid="select-type-filter">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {availableTypes.map(t => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: DOC_TYPE_COLORS[t] || "#6B7280" }} />
                      {t.replace(/_/g, " ")}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pillarFilter} onValueChange={setPillarFilter}>
              <SelectTrigger className="h-7 text-[10px] font-data bg-[var(--bg-panel)] border-[var(--theme-border)]/30 w-[140px]" data-testid="select-pillar-filter">
                <SelectValue placeholder="Filter by pillar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pillars</SelectItem>
                {Object.entries(PILLAR_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: PILLAR_COLORS[key] }} />
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(typeFilter !== "all" || pillarFilter !== "all") && (
              <button
                onClick={() => { setTypeFilter("all"); setPillarFilter("all"); }}
                className="text-[10px] font-data text-[var(--text-disabled)] hover:text-[var(--text-secondary)] transition-colors"
                data-testid="button-clear-filters"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="px-5 py-2 space-y-1.5" data-testid="search-results">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">{searchResults.length} results</span>
            <button
              onClick={() => { setSearchResults([]); setSearchQuery(""); }}
              className="text-[10px] text-[var(--text-disabled)] hover:text-[var(--text-secondary)] cursor-pointer"
              data-testid="button-clear-search"
            >
              Clear
            </button>
          </div>
          {searchResults.map((result, i) => {
            const clsColor = CLASSIFICATION_COLORS[result.classification || "General"] || "var(--text-disabled)";
            return (
              <div
                key={`${result.documentId}-${result.chunkIndex}`}
                className="bg-[var(--bg-panel)] rounded-md p-3 border border-[var(--theme-border)]/30"
                data-testid={`search-result-${i}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] text-[#3B82F6] font-medium truncate">{result.filename}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[9px] font-data px-1 py-0 h-[14px] no-default-hover-elevate no-default-active-elevate"
                      style={{ borderColor: `${clsColor}30`, color: clsColor }}
                    >
                      {result.classification || "General"}
                    </Badge>
                    <span className="font-data text-[10px] text-[#10B981]">
                      {Math.round(result.similarity * 100)}%
                    </span>
                  </div>
                </div>
                <p className="font-data text-[10px] text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                  {result.chunkText}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {canUpload && (
        <div
          className={`mx-5 mt-4 mb-2 border-2 border-dashed rounded-md p-5 text-center transition-colors duration-200 ${
            isDragging
              ? "border-[#3B82F6] bg-[#3B82F6]/5"
              : "border-[var(--theme-border)] hover:border-[#3B82F6]/40"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="drop-zone"
          data-onboarding="upload-docs"
        >
          <Upload className={`w-5 h-5 mx-auto mb-1.5 ${isDragging ? "text-[#3B82F6]" : "text-[var(--text-disabled)]"}`} />
          <p className="text-xs text-[var(--text-secondary)] mb-1">
            {isDragging ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-[10px] text-[var(--text-disabled)] mb-2">or</p>
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.csv,.tsv,.pptx,.zip,.rar,.txt,.md,.log,.cfg,.conf,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.gif,.tiff,.eml,.msg"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              data-testid="input-file-upload"
            />
            <Button size="sm" variant="outline" className="text-xs border-[var(--theme-border)] text-[var(--text-secondary)]" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
          <p className="text-[9px] text-[var(--text-disabled)] mt-2">
            PDF, DOCX, XLSX, CSV, PPTX, ZIP, Images, Email, and more. Max 50MB per file.
          </p>
        </div>
      )}

      {uploadingFiles.length > 0 && (
        <div className="px-5 py-2 space-y-1">
          {uploadingFiles.map((name) => (
            <div key={name} className="flex items-center gap-2 bg-[var(--bg-panel)] rounded-md px-3 py-2 border border-[var(--theme-border)]/30">
              <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin flex-shrink-0" />
              <span className="text-[11px] text-[var(--text-secondary)] truncate flex-1">{name}</span>
              <span className="text-[10px] text-[#3B82F6] font-data flex-shrink-0">Processing...</span>
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-[var(--theme-border)]/30">
        {topLevelDocs.length > 0 ? (
          topLevelDocs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              expandedArchives={expandedArchives}
              toggleArchive={toggleArchive}
              childDocs={childDocsByParent[doc.id] || []}
              onRetry={(docId) => retryDocMutation.mutate(docId)}
              onAnalyzeImage={(docId) => singleImageAnalysisMutation.mutate(docId)}
              isAnalyzingImage={analyzingDocId === doc.id}
              onDelete={canDelete ? handleDeleteDoc : undefined}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(doc.id)}
              onToggleSelect={toggleSelect}
              onPreview={setPreviewDocId}
              aiClassification={classificationMap[doc.id]}
            />
          ))
        ) : (
          !isLoading && (
            <div className="px-5 py-10 text-center">
              <FileText className="w-6 h-6 text-[var(--theme-border)] mx-auto mb-2" />
              <p className="text-xs text-[var(--text-disabled)]">No documents uploaded yet.</p>
              <p className="text-[10px] text-[var(--text-disabled)] mt-1">
                Drag and drop your due diligence files above to get started.
              </p>
            </div>
          )
        )}
      </div>

      {selectionMode && selectedIds.size > 0 && (
        <div className="sticky bottom-0 px-5 py-3 bg-[var(--bg-card)] border-t border-[var(--theme-border)]/50 flex items-center justify-between gap-3 flex-wrap z-50" data-testid="bar-selection-actions">
          <div className="flex items-center gap-3">
            <span className="font-data text-[11px] text-[var(--text-secondary)]" data-testid="text-selected-count">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] text-[var(--text-secondary)] gap-1"
              onClick={toggleSelectAll}
              data-testid="button-select-all"
            >
              <CheckSquare className="w-3 h-3" />
              {selectedIds.size === topLevelDocs.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <Button
            size="sm"
            className="bg-[#EF4444] text-white text-[10px] gap-1"
            onClick={() => setShowBatchDelete(true)}
            data-testid="button-delete-selected"
          >
            <Trash2 className="w-3 h-3" />
            Delete Selected
          </Button>
        </div>
      )}

      {deleteDoc && (
        <DeleteDocumentModal
          open={!!deleteDoc}
          onOpenChange={(open) => { if (!open) setDeleteDoc(null); }}
          doc={deleteDoc}
          dealId={dealId}
        />
      )}

      {showBatchDelete && selectedDocuments.length > 0 && (
        <BatchDeleteModal
          open={showBatchDelete}
          onOpenChange={setShowBatchDelete}
          documents={selectedDocuments}
          dealId={dealId}
          onComplete={() => {
            setSelectedIds(new Set());
            setSelectionMode(false);
          }}
        />
      )}

      {previewDocId && (
        <DocumentPreview
          documentId={previewDocId}
          onClose={() => setPreviewDocId(null)}
          dealDocuments={documents.map((d) => ({ id: d.id, filename: d.filename }))}
        />
      )}
    </Card>
  );
}

function RiskSkeleton() {
  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-6 bg-[var(--bg-panel)] rounded w-52 animate-pulse" />
        <div className="h-5 bg-[var(--bg-panel)] rounded w-24 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5 animate-pulse">
          <div className="h-4 bg-[var(--bg-panel)] rounded w-40 mb-4" />
          <div className="w-full flex items-center justify-center" style={{ height: 280 }}>
            <div className="w-48 h-48 rounded-full border-2 border-[var(--bg-panel)]" />
          </div>
        </Card>
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-5 animate-pulse">
          <div className="h-4 bg-[var(--bg-panel)] rounded w-32 mb-4" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[var(--bg-panel)] rounded-md p-3.5 h-[80px]" />
            ))}
          </div>
        </Card>
      </div>
      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 animate-pulse">
        <div className="px-5 py-4 border-b border-[var(--theme-border)]/50">
          <div className="h-4 bg-[var(--bg-panel)] rounded w-32" />
        </div>
        <div className="divide-y divide-[var(--theme-border)]/30">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-3">
              <div className="h-[18px] w-16 bg-[var(--bg-panel)] rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[var(--bg-panel)] rounded w-48" />
                <div className="h-2.5 bg-[var(--bg-panel)] rounded w-72" />
              </div>
              <div className="h-[18px] w-20 bg-[var(--bg-panel)] rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const LIFECYCLE_STAGES = ["screening", "assessment", "day1_readiness", "integration", "monitoring"] as const;
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

function LifecycleStepper({ deal, canEdit }: { deal: Deal; canEdit: boolean }) {
  const { toast } = useToast();
  const currentStage = (deal as any).lifecycleStage || "assessment";
  const currentIndex = LIFECYCLE_STAGES.indexOf(currentStage as typeof LIFECYCLE_STAGES[number]);

  const updateMutation = useMutation({
    mutationFn: async (newStage: string) => {
      await apiRequest("PATCH", `/api/deals/${deal.id}`, { lifecycleStage: newStage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Lifecycle stage updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleStageClick = (stage: string) => {
    if (!canEdit) return;
    if (stage === currentStage) return;
    const confirmed = window.confirm(`Change lifecycle stage to "${LIFECYCLE_LABELS[stage]}"?`);
    if (confirmed) {
      updateMutation.mutate(stage);
    }
  };

  return (
    <div
      className="bg-[var(--bg-panel)] border border-[var(--theme-border)] rounded-md px-5 py-3.5 flex items-center gap-1 overflow-x-auto"
      data-testid="lifecycle-stepper"
    >
      {LIFECYCLE_STAGES.map((stage, idx) => {
        const isActive = stage === currentStage;
        const isCompleted = idx < currentIndex;
        const color = LIFECYCLE_COLORS[stage];
        const label = LIFECYCLE_LABELS[stage];

        return (
          <div key={stage} className="flex items-center gap-1 flex-shrink-0">
            {idx > 0 && (
              <div
                className="w-6 h-[2px] flex-shrink-0"
                style={{ backgroundColor: isCompleted || isActive ? color : "var(--theme-border)" }}
              />
            )}
            <button
              onClick={() => handleStageClick(stage)}
              disabled={!canEdit || updateMutation.isPending}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                canEdit ? "cursor-pointer" : "cursor-default"
              }`}
              style={
                isActive
                  ? { backgroundColor: `${color}15`, color, fontWeight: 600 }
                  : isCompleted
                  ? { color: "#10B981" }
                  : { color: "var(--text-disabled)" }
              }
              data-testid={`lifecycle-stage-${stage}`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2"
                style={
                  isActive
                    ? { backgroundColor: color, borderColor: color }
                    : isCompleted
                    ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                    : { backgroundColor: "transparent", borderColor: "var(--theme-border)" }
                }
              />
              {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function RiskPage() {
  const { hasPermission } = useAuth();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const dealParam = params.get("deal");

  const { data: deals, isLoading: dealsLoading, isError: dealsError } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const [selectedDealId, setSelectedDealId] = useState<string | null>(dealParam);
  const [editDealOpen, setEditDealOpen] = useState(false);
  const [addFindingOpen, setAddFindingOpen] = useState(false);
  const [findingPreviewDocId, setFindingPreviewDocId] = useState<string | null>(null);

  const activeDealId = selectedDealId || deals?.[0]?.id || null;
  const activeDeal = deals?.find((d) => d.id === activeDealId);

  const { data: pillars, isLoading: pillarsLoading } = useQuery<Pillar[]>({
    queryKey: ["/api/deals", activeDealId, "pillars"],
    enabled: !!activeDealId,
  });

  const { data: findings, isLoading: findingsLoading } = useQuery<Finding[]>({
    queryKey: ["/api/deals", activeDealId, "findings"],
    enabled: !!activeDealId,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ["/api/deals", activeDealId, "documents"],
    enabled: !!activeDealId,
  });

  const { data: crossRefs } = useQuery<Record<string, CrossRefMatch[]>>({
    queryKey: ["/api/deals", activeDealId, "finding-cross-refs"],
    enabled: !!activeDealId,
  });

  const isLoading = dealsLoading || pillarsLoading || findingsLoading;

  const compositeScore = useMemo(() => {
    if (!pillars || !findings) return 0;
    return computeCompositeScore(pillars, findings);
  }, [pillars, findings]);

  const scoreColor = getScoreColor(compositeScore, "pillar");

  if (dealsLoading) return <RiskSkeleton />;

  if (dealsError) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]/50 p-8">
          <div className="flex flex-col items-center justify-center text-[var(--text-disabled)]">
            <AlertCircle className="w-6 h-6 mb-2 text-[#F59E0B]" />
            <p className="text-xs text-[var(--text-secondary)]">Unable to load risk data. Please try again later.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]" data-testid="text-risk-title">
            {activeDeal?.targetName || "Risk Dashboard"}
          </h1>
          {activeDeal && (
            <>
              <Badge
                variant="outline"
                className="text-[10px] font-data border-[#06B6D4]/25 text-[#06B6D4] bg-[#06B6D4]/5 px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate"
              >
                {activeDeal.industry}
              </Badge>
              {hasPermission("edit_deal_metadata") && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditDealOpen(true)}
                  data-testid="button-edit-deal"
                >
                  <Pencil className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
                </Button>
              )}
            </>
          )}
          {pillars && findings && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--text-disabled)]">Composite:</span>
                <span className="font-data text-sm font-bold" style={{ color: scoreColor }} data-testid="text-composite-score">
                  {compositeScore.toFixed(1)}
                </span>
                <span className="text-[10px] text-[var(--text-disabled)]">/ 5.0</span>
              </div>
              {activeDeal && (() => {
                const confTier = getConfidenceTier(activeDeal.overallConfidence);
                const confLabel = getOverallConfidenceLabel(activeDeal.overallConfidence);
                return (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: confTier.badgeBg }} data-testid="badge-overall-confidence">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confTier.color }} />
                    <span className="text-[9px] font-medium" style={{ color: confTier.color }}>{confLabel}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
          <Select
            value={activeDealId || ""}
            onValueChange={(val) => setSelectedDealId(val)}
          >
            <SelectTrigger
              className="h-8 w-[220px] bg-[var(--bg-panel)] border-[var(--theme-border)] text-xs text-[var(--text-primary)]"
              data-testid="select-deal"
            >
              <SelectValue placeholder="Select a deal" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
              {deals?.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs text-[var(--text-primary)]">
                  {d.targetName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeDeal && (
        <EditDealModal open={editDealOpen} onOpenChange={setEditDealOpen} deal={activeDeal} />
      )}
      {activeDealId && pillars && (
        <AddFindingModal
          open={addFindingOpen}
          onOpenChange={setAddFindingOpen}
          dealId={activeDealId}
          pillars={pillars}
        />
      )}

      {activeDeal && (
        <LifecycleStepper
          deal={activeDeal}
          canEdit={hasPermission("edit_deal_metadata")}
        />
      )}

      {isLoading ? (
        <RiskSkeleton />
      ) : (
        <>
          {pillars && pillars.length > 0 && (
            <EvidenceCoverageSummary pillars={pillars} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            <CompositeRadarChart pillars={pillars || []} />
            <PillarBreakdown pillars={pillars || []} />
          </div>

          <FindingsTable
            findings={findings || []}
            pillars={pillars || []}
            onAddFinding={hasPermission("add_findings") ? () => setAddFindingOpen(true) : undefined}
            documents={documents}
            onPreviewDocument={setFindingPreviewDocId}
            crossRefs={crossRefs}
            totalDeals={deals?.length}
          />

          {activeDealId && (
            <DocumentsPanel
              dealId={activeDealId}
              documents={documents || []}
              isLoading={documentsLoading}
              canUpload={hasPermission("upload_documents")}
            />
          )}
        </>
      )}

      {findingPreviewDocId && (
        <DocumentPreview
          documentId={findingPreviewDocId}
          onClose={() => setFindingPreviewDocId(null)}
          defaultTab="preview"
          dealDocuments={documents?.map((d) => ({ id: d.id, filename: d.filename }))}
        />
      )}
    </div>
  );
}
