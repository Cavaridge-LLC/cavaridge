import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoadmapBoard } from "@/components/RoadmapBoard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building,
  Calendar,
  Filter,
  Plus,
  Search,
  Settings,
  Download,
  Activity,
  Target,
  ShieldAlert,
  DollarSign,
  Wand2,
  TrendingUp,
  FileDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { saveAs } from "file-saver";
import { buildBoardPptx } from "@/lib/pptx";
import { clientsQuery, initiativesQuery, snapshotQuery, useSeed } from "@/lib/api";
import type { Client, Initiative, Snapshot } from "@shared/schema";

export default function Roadmap() {
  const seedMutation = useSeed();
  const { data: clients = [], isLoading: loadingClients } = useQuery(clientsQuery());
  const [activeClientId, setActiveClientId] = useState<string>("");

  useEffect(() => {
    if (clients.length > 0 && !activeClientId) {
      setActiveClientId(clients[0].id);
    }
  }, [clients, activeClientId]);

  useEffect(() => {
    if (!loadingClients && clients.length === 0) {
      seedMutation.mutate();
    }
  }, [loadingClients, clients.length]);

  const { data: initiatives = [] } = useQuery(initiativesQuery(activeClientId));
  const { data: snapshot } = useQuery(snapshotQuery(activeClientId));

  const activeClient = clients.find((c: Client) => c.id === activeClientId);

  const exportPptx = async () => {
    if (!activeClient) return;
    const pptx = buildBoardPptx({
      clientName: activeClient.name,
      timeframeLabel: "FY 2024–2025",
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

  if (loadingClients) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-primary">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-xl">
              M
            </div>
            <span className="font-display font-bold text-xl hidden sm:inline-block">Midas</span>
          </div>
          <div className="h-6 w-px bg-border mx-2 hidden sm:block"></div>

          <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5 border border-border">
            <Building className="w-4 h-4 text-muted-foreground" />
            <select
              className="bg-transparent border-none text-sm font-medium outline-none cursor-pointer"
              data-testid="select-client"
              value={activeClientId}
              onChange={(e) => setActiveClientId(e.target.value)}
            >
              {clients.map((c: Client) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search initiatives..."
              className="pl-9 h-9 w-64 rounded-full bg-muted/30 border-border"
              data-testid="input-search"
            />
          </div>
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
            <Settings className="w-4 h-4" />
          </Button>
          <Avatar className="w-9 h-9 border border-border">
            <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026024d" />
            <AvatarFallback>AM</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-border/50">
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight" data-testid="text-page-title">
              Strategic Client Roadmap
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {activeClient ? `${activeClient.name} • FY 2024–2025` : "FY 2024–2025 Strategic Initiatives"}
            </p>
          </div>

          <div className="flex items-center gap-6">
            {snapshot && (
              <div className="hidden lg:flex items-stretch gap-2 bg-card border border-border rounded-xl px-2 py-2 shadow-sm">
                <SnapshotKpi icon={<Activity className="w-4 h-4" />} label="Engagement" value={`${snapshot.engagementScore}/100`} color="green" />
                <div className="w-px bg-border/80"></div>
                <SnapshotKpi icon={<Target className="w-4 h-4" />} label="Goals" value={`${snapshot.goalsAligned} aligned`} color="blue" />
                <div className="w-px bg-border/80"></div>
                <SnapshotKpi icon={<ShieldAlert className="w-4 h-4" />} label="Risk" value={snapshot.riskLevel} color="amber" />
                <div className="w-px bg-border/80"></div>
                <SnapshotKpi icon={<DollarSign className="w-4 h-4" />} label="Budget" value={`$${(snapshot.budgetTotal / 1000).toFixed(0)}k`} color="purple" />
                <div className="w-px bg-border/80"></div>
                <SnapshotKpi icon={<Wand2 className="w-4 h-4" />} label="Adoption" value={`${snapshot.adoptionPercent}%`} color="cyan" />
                <div className="w-px bg-border/80"></div>
                <SnapshotKpi icon={<TrendingUp className="w-4 h-4" />} label="ROI" value={snapshot.roiStatus} color="slate" />
              </div>
            )}

            <div className="h-8 w-px bg-border hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-9 gap-2" data-testid="button-filters">
                <Filter className="w-4 h-4" />
                Filters
              </Button>

              <Button variant="outline" className="h-9 gap-2" data-testid="button-export-pptx" onClick={exportPptx}>
                <FileDown className="w-4 h-4" />
                Board PPTX
              </Button>

              <Button
                variant="outline"
                className="h-9 gap-2"
                data-testid="button-go-qbr"
                onClick={() => (window.location.href = "/qbr")}
              >
                QBR Workspace
              </Button>

              <Button variant="outline" className="h-9 gap-2" data-testid="button-export">
                <Download className="w-4 h-4" />
                Export
              </Button>

              <Button className="h-9 gap-2 shadow-sm" data-testid="button-new-initiative">
                <Plus className="w-4 h-4" />
                New Initiative
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex items-center gap-6 shrink-0 text-sm overflow-x-auto">
          <span className="text-muted-foreground font-medium whitespace-nowrap">Service Categories:</span>
          <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span>Infrastructure</span></div>
          <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span>Cloud</span></div>
          <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-red-500"></div><span>Security</span></div>
          <div className="flex items-center gap-2 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span>Strategy</span></div>
        </div>

        <div className="flex-1 overflow-x-auto roadmap-timeline p-6 pt-0 bg-muted/10">
          <RoadmapBoard initiatives={initiatives} />
        </div>
      </main>

      <footer className="flex items-center justify-center px-6 py-3 border-t border-border bg-card/50 text-xs text-muted-foreground">
        <span data-testid="text-copyright">&copy; 2026 Cavaridge, LLC. All rights reserved.</span>
      </footer>
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
