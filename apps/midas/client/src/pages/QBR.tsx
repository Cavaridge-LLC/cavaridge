import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  Plus,
  Users,
  Wand2,
} from "lucide-react";
import { saveAs } from "file-saver";
import { buildBoardPptx } from "@/lib/pptx";
import {
  meetingsQuery,
  clientsQuery,
  useCreateMeeting,
  useUpdateMeeting,
  snapshotQuery,
  initiativesQuery,
} from "@/lib/api";
import type { Meeting, Client, Initiative } from "@shared/schema";

type MeetingState = "Draft" | "Scheduled" | "In Progress" | "Closed";
type MeetingType = "QBR" | "Strategy Review" | "Security Review" | "Budget Review";

const stateStyle: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700",
  Scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 border-blue-100 dark:border-blue-900",
  "In Progress": "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border-amber-100 dark:border-amber-900",
  Closed: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200 border-green-100 dark:border-green-900",
};

const typeStyle: Record<string, string> = {
  QBR: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200 border-violet-100 dark:border-violet-900",
  "Strategy Review": "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200 border-cyan-100 dark:border-cyan-900",
  "Security Review": "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200 border-rose-100 dark:border-rose-900",
  "Budget Review": "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900",
};

interface QBRProps {
  clientId: string;
}

export default function QBR({ clientId }: QBRProps) {
  const { data: meetingsList = [], isLoading } = useQuery(meetingsQuery(clientId));
  const { data: clients = [] } = useQuery(clientsQuery());
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();

  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (meetingsList.length > 0 && !selectedId) {
      setSelectedId(meetingsList[0].id);
    }
  }, [meetingsList, selectedId]);

  const selected: Meeting | undefined = useMemo(
    () => meetingsList.find((m: Meeting) => m.id === selectedId),
    [meetingsList, selectedId]
  );

  const defaultClient = clients.find((c: Client) => c.id === clientId) ?? clients[0] as Client | undefined;

  const { data: snapshot } = useQuery(snapshotQuery(selected?.clientId ?? clientId));
  const { data: initiatives = [] } = useQuery(initiativesQuery(selected?.clientId ?? clientId));

  const patchSelected = (patch: Record<string, any>) => {
    if (!selected) return;
    updateMeeting.mutate({ id: selected.id, ...patch });
  };

  const closeMeeting = () => {
    if (!selected) return;
    const execSummary =
      selected.executiveSummary ||
      "This quarter we focused on stabilizing core operations, reducing security exposure, and aligning the next 90 days of work to leadership goals. The roadmap below prioritizes risk reduction first, then efficiency and modernization.";
    const nextSteps =
      (selected.nextSteps && selected.nextSteps.length > 0)
        ? selected.nextSteps
        : ["Confirm initiative owners and target dates", "Approve budget band for Q2-Q3", "Send board pack to leadership"];

    patchSelected({ state: "Closed", executiveSummary: execSummary, nextSteps });
  };

  const exportBoardPptx = async () => {
    if (!selected) return;
    const pptx = buildBoardPptx({
      clientName: selected.clientName,
      timeframeLabel: selected.title,
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
      executiveSummary: selected.executiveSummary || undefined,
    });
    const blob = (await (pptx as any).write({ outputType: "blob" })) as Blob;
    saveAs(blob, `board-pack-${selected.clientName.toLowerCase().replace(/\s+/g, "-")}.pptx`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading meetings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QBR Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">Create meetings, track states, and close with a board-ready pack.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 gap-2"
            data-testid="button-new-meeting"
            onClick={() => {
              if (!defaultClient) return;
              createMeeting.mutate(
                {
                  clientId: defaultClient.id,
                  clientName: defaultClient.name,
                  title: "New QBR",
                  type: "QBR",
                  state: "Draft",
                  dateLabel: "TBD",
                  attendees: ["vCIO"],
                  agenda: "Executive snapshot, risks, roadmap approvals, next steps.",
                  notes: "",
                },
                {
                  onSuccess: (data: Meeting) => setSelectedId(data.id),
                }
              );
            }}
          >
            <Plus className="w-4 h-4" />
            New meeting
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 p-6 bg-muted/10 overflow-auto">
        {/* Left: Meeting List */}
        <div className="flex flex-col gap-4">
          <Card className="p-4 border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold" data-testid="text-meeting-list-title">Meetings</div>
                <div className="text-xs text-muted-foreground">Types, states, and clients</div>
              </div>
              <Badge variant="outline" className="text-xs" data-testid="badge-meeting-count">
                {meetingsList.length}
              </Badge>
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            {meetingsList.map((m: Meeting) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  className={
                    "text-left rounded-xl border p-4 transition-all " +
                    (active
                      ? "bg-card border-primary/30 shadow-sm"
                      : "bg-card/60 border-border/60 hover:bg-card hover:border-primary/20")
                  }
                  data-testid={`row-meeting-${m.id}`}
                  onClick={() => setSelectedId(m.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display font-semibold leading-snug" data-testid={`text-meeting-title-${m.id}`}>
                        {m.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1" data-testid={`text-meeting-client-${m.id}`}>
                        {m.clientName} • {m.dateLabel}
                      </div>
                    </div>
                    <ChevronRight className={"w-4 h-4 mt-1 " + (active ? "text-primary" : "text-muted-foreground")} />
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline" className={"text-[11px] border " + (typeStyle[m.type] || "")} data-testid={`badge-meeting-type-${m.id}`}>
                      {m.type}
                    </Badge>
                    <Badge variant="outline" className={"text-[11px] border " + (stateStyle[m.state] || "")} data-testid={`badge-meeting-state-${m.id}`}>
                      {m.state}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Meeting Detail */}
        {selected && (
          <div className="flex flex-col gap-4">
            <Card className="p-5 border-border/60">
              <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-display font-bold" data-testid="text-selected-meeting-title">
                      {selected.title}
                    </h1>
                    <Badge variant="outline" className={"text-[11px] border " + (typeStyle[selected.type] || "")} data-testid="badge-selected-type">
                      {selected.type}
                    </Badge>
                    <Badge variant="outline" className={"text-[11px] border " + (stateStyle[selected.state] || "")} data-testid="badge-selected-state">
                      {selected.state}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1" data-testid="text-selected-meeting-meta">
                    {selected.clientName} • {selected.dateLabel}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    className="h-9 gap-2"
                    data-testid="button-generate-summary"
                    onClick={() => {
                      patchSelected({
                        executiveSummary:
                          "Leadership reviewed current state and approved a risk-first roadmap: strengthen identity & access controls, validate recoverability, and modernize collaboration. Budget band accepted with quarter-by-quarter checkpoints.",
                        nextSteps: [
                          "Finalize owners for Q2 initiatives",
                          "Send board pack for signature",
                          "Schedule mid-quarter progress update",
                        ],
                      });
                    }}
                  >
                    <Wand2 className="w-4 h-4" />
                    Draft summary
                  </Button>

                  <Button variant="outline" className="h-9 gap-2" data-testid="button-export-board-pack" onClick={exportBoardPptx}>
                    <FileDown className="w-4 h-4" />
                    Export board PPTX
                  </Button>

                  <Button className="h-9 gap-2" data-testid="button-close-meeting" onClick={closeMeeting}>
                    <ClipboardCheck className="w-4 h-4" />
                    Close meeting
                  </Button>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="p-5 border-border/60">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm font-semibold" data-testid="text-section-meeting-details">Meeting details</div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Title</div>
                    <Input
                      value={selected.title}
                      data-testid="input-meeting-title"
                      onChange={(e) => patchSelected({ title: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Date</div>
                    <Input
                      value={selected.dateLabel}
                      data-testid="input-meeting-date"
                      onChange={(e) => patchSelected({ dateLabel: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Client</div>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      value={selected.clientId}
                      data-testid="select-meeting-client"
                      onChange={(e) => {
                        const client = clients.find((c: Client) => c.id === e.target.value);
                        if (client) patchSelected({ clientId: client.id, clientName: client.name });
                      }}
                    >
                      {clients.map((c: Client) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Type</div>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      value={selected.type}
                      data-testid="select-meeting-type"
                      onChange={(e) => patchSelected({ type: e.target.value })}
                    >
                      <option value="QBR">QBR</option>
                      <option value="Strategy Review">Strategy Review</option>
                      <option value="Security Review">Security Review</option>
                      <option value="Budget Review">Budget Review</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">State</div>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      value={selected.state}
                      data-testid="select-meeting-state"
                      onChange={(e) => patchSelected({ state: e.target.value })}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-1">Attendees</div>
                  <div className="flex items-center gap-2 flex-wrap" data-testid="list-attendees">
                    {(selected.attendees || []).map((a, idx) => (
                      <Badge key={`${a}-${idx}`} variant="outline" className="text-xs" data-testid={`badge-attendee-${idx}`}>
                        <Users className="w-3.5 h-3.5 mr-1" />
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-1">Agenda</div>
                  <Textarea
                    value={selected.agenda}
                    data-testid="input-meeting-agenda"
                    onChange={(e) => patchSelected({ agenda: e.target.value })}
                    rows={7}
                  />
                </div>
              </Card>

              <Card className="p-5 border-border/60">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm font-semibold" data-testid="text-section-closeout">Closeout outputs</div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-1">Executive summary</div>
                  <Textarea
                    value={selected.executiveSummary || ""}
                    data-testid="input-executive-summary"
                    placeholder="Draft the board-facing summary here (or use Draft summary)."
                    onChange={(e) => patchSelected({ executiveSummary: e.target.value })}
                    rows={6}
                  />
                </div>

                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-2">Next steps</div>
                  <div className="flex flex-col gap-2" data-testid="list-next-steps">
                    {(selected.nextSteps || []).map((s, idx) => (
                      <div
                        key={`${s}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2"
                        data-testid={`row-next-step-${idx}`}
                      >
                        <div className="text-sm">{s}</div>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          data-testid={`button-remove-next-step-${idx}`}
                          onClick={() => {
                            const next = (selected.nextSteps || []).filter((_, i) => i !== idx);
                            patchSelected({ nextSteps: next });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button
                      className="rounded-lg border border-dashed border-border/70 bg-transparent px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      data-testid="button-add-next-step"
                      onClick={() => {
                        const next = [...(selected.nextSteps || []), "New action item"];
                        patchSelected({ nextSteps: next });
                      }}
                    >
                      + Add next step
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-1">Meeting notes</div>
                  <Textarea
                    value={selected.notes}
                    data-testid="input-meeting-notes"
                    placeholder="Internal notes (not client-facing)."
                    onChange={(e) => patchSelected({ notes: e.target.value })}
                    rows={5}
                  />
                </div>
              </Card>
            </div>

            <Card className="p-5 border-border/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold" data-testid="text-section-roadmap-link">Roadmap linkage</div>
                  <div className="text-xs text-muted-foreground">This is where meeting outputs become approved initiatives.</div>
                </div>
                <Button
                  variant="outline"
                  className="h-9 gap-2"
                  data-testid="button-open-roadmap"
                  onClick={() => (window.location.href = "/")}
                >
                  <ChevronRight className="w-4 h-4" />
                  View roadmap
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card/60 p-4" data-testid="card-approval-summary">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Initiatives</div>
                  <div className="mt-1 text-2xl font-display font-bold">{initiatives.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Active initiatives for this client</div>
                </div>
                <div className="rounded-xl border border-border bg-card/60 p-4" data-testid="card-budget-band">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Budget band</div>
                  <div className="mt-1 text-2xl font-display font-bold">
                    {snapshot ? `$${(snapshot.budgetTotal / 1000).toFixed(0)}k` : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Recommended total investment</div>
                </div>
                <div className="rounded-xl border border-border bg-card/60 p-4" data-testid="card-risk-focus">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Risk level</div>
                  <div className="mt-1 text-2xl font-display font-bold">{snapshot?.riskLevel ?? "—"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Current client risk posture</div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
