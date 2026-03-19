import { useQuery } from "@tanstack/react-query";
import { RoadmapBoard } from "@/components/RoadmapBoard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Filter,
  Plus,
  Search,
  Download,
  Activity,
  Target,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  Wand2,
  TrendingUp,
  FileDown,
  Import,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { saveAs } from "file-saver";
import { buildBoardPptx } from "@/lib/pptx";
import {
  clientsQuery,
  initiativesQuery,
  snapshotQuery,
  useImportGapsToRoadmap,
  latestScoreQuery,
} from "@/lib/api";
import type { Client, Initiative, Snapshot } from "@shared/schema";

interface Props {
  clientId: string;
}

export default function Roadmap({ clientId }: Props) {
  const { data: clients = [] } = useQuery(clientsQuery());
  const { data: initiatives = [] } = useQuery(initiativesQuery(clientId));
  const { data: snapshot } = useQuery(snapshotQuery(clientId));
  const { data: scoreData } = useQuery(latestScoreQuery(clientId));
  const importGaps = useImportGapsToRoadmap();

  const activeClient = clients.find((c: Client) => c.id === clientId);

  const securityGapCount = initiatives.filter((i: Initiative) => i.source === "security_gap").length;
  const adjustedScore = (scoreData as any)?.adjustedScore;

  const exportPptx = async () => {
    if (!activeClient) return;
    const pptx = buildBoardPptx({
      clientName: activeClient.name,
      timeframeLabel: "FY 2026",
      snapshot: {
        engagementScore: snapshot?.engagementScore ?? 0,
        goalsAligned: snapshot?.goalsAligned ?? 0,
        riskLevel: (snapshot?.riskLevel as any) ?? "Low",
        budgetTotal: snapshot?.budgetTotal ?? 0,
        adoptionPercent: snapshot?.adoptionPercent ?? 0,
        roiStatus: (snapshot?.roiStatus as any) ?? "On track",
      },
      initiatives: initiatives.map((i: Initiative) => ({
        quarter: i.quarter,
        title: i.title,
        category: i.team,
        priority: i.priority,
        status: i.status,
        cost: i.cost ?? undefined,
        businessProblem: i.businessProblem ?? undefined,
      })),
    });
    const blob = (await (pptx as any).write({ outputType: "blob" })) as Blob;
    saveAs(blob, `board-roadmap-${activeClient.name.toLowerCase().replace(/\s+/g, "-")}.pptx`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-border/50">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title" data-onboarding="welcome">
            Strategic Client Roadmap
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {activeClient ? `${activeClient.name} — FY 2026` : "FY 2026 Strategic Initiatives"}
          </p>
        </div>

        <div className="flex items-center gap-6">
          {snapshot && (
            <div className="hidden lg:flex items-stretch gap-2 bg-card border border-border rounded-xl px-2 py-2 shadow-sm" data-onboarding="take-snapshot">
              <SnapshotKpi icon={<Activity className="w-4 h-4" />} label="Engagement" value={`${snapshot.engagementScore}/100`} color="green" />
              <div className="w-px bg-border/80" />
              <SnapshotKpi icon={<Target className="w-4 h-4" />} label="Goals" value={`${snapshot.goalsAligned} aligned`} color="blue" />
              <div className="w-px bg-border/80" />
              <SnapshotKpi icon={<ShieldAlert className="w-4 h-4" />} label="Risk" value={snapshot.riskLevel} color="amber" />
              <div className="w-px bg-border/80" />
              <SnapshotKpi icon={<DollarSign className="w-4 h-4" />} label="Budget" value={`$${(snapshot.budgetTotal / 1000).toFixed(0)}k`} color="purple" />
              {adjustedScore !== undefined && (
                <>
                  <div className="w-px bg-border/80" />
                  <SnapshotKpi icon={<ShieldCheck className="w-4 h-4" />} label="Security" value={`${adjustedScore}/100`} color="cyan" />
                </>
              )}
            </div>
          )}

          <div className="h-8 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 gap-2" data-testid="button-filters">
              <Filter className="w-4 h-4" />
              Filters
            </Button>

            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => importGaps.mutate(clientId)}
              disabled={importGaps.isPending}
            >
              <Import className="w-4 h-4" />
              Import Gaps
            </Button>

            <Button variant="outline" className="h-9 gap-2" data-testid="button-export-pptx" onClick={exportPptx}>
              <FileDown className="w-4 h-4" />
              Board PPTX
            </Button>

            <Button className="h-9 gap-2 shadow-sm" data-testid="button-new-initiative" data-onboarding="create-initiative">
              <Plus className="w-4 h-4" />
              New Initiative
            </Button>
          </div>
        </div>
      </div>

      {/* Security gap indicator */}
      {securityGapCount > 0 && (
        <div className="px-6 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/30 flex items-center gap-2 text-xs">
          <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          <span className="text-red-700 dark:text-red-300 font-medium">{securityGapCount} security gap{securityGapCount !== 1 ? "s" : ""} on the roadmap</span>
        </div>
      )}

      <div className="px-6 py-4 flex items-center gap-6 shrink-0 text-sm overflow-x-auto">
        <span className="text-muted-foreground font-medium whitespace-nowrap">Categories:</span>
        <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-blue-500" /><span>Infrastructure</span></div>
        <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-purple-500" /><span>Cloud</span></div>
        <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-red-500" /><span>Security</span></div>
        <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-amber-500" /><span>Strategy</span></div>
      </div>

      <div className="flex-1 overflow-x-auto roadmap-timeline p-6 pt-0 bg-muted/10">
        <RoadmapBoard initiatives={initiatives} />
      </div>
    </div>
  );
}

function SnapshotKpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted/40 transition-colors">
      <div className={`bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 p-1 rounded-md`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-sm font-bold leading-none">{value}</span>
      </div>
    </div>
  );
}
