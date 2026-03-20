/**
 * Knowledge Page — Browse, filter, and manage knowledge objects
 *
 * Three views: Timeline, Entity Graph, List
 * Filter by type, tags, date range, entity
 */

import { useState, useEffect } from "react";
import { Calendar, List, Network, Filter, ChevronDown, CheckCircle2, Circle, Search } from "lucide-react";
import { api } from "../hooks/useApi.js";

type ViewMode = "timeline" | "list" | "graph";
type KnowledgeType = "fact" | "decision" | "action_item" | "question" | "insight" | "meeting_note" | "reference";

const TYPE_LABELS: Record<KnowledgeType, string> = {
  fact: "Fact",
  decision: "Decision",
  action_item: "Action Item",
  question: "Question",
  insight: "Insight",
  meeting_note: "Meeting Note",
  reference: "Reference",
};

const TYPE_COLORS: Record<KnowledgeType, string> = {
  decision: "border-purple-400 bg-purple-50 dark:bg-purple-950/20",
  action_item: "border-orange-400 bg-orange-50 dark:bg-orange-950/20",
  fact: "border-green-400 bg-green-50 dark:bg-green-950/20",
  question: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
  insight: "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20",
  meeting_note: "border-gray-400 bg-gray-50 dark:bg-gray-800/40",
  reference: "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20",
};

export function KnowledgePage() {
  const [view, setView] = useState<ViewMode>("list");
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [filterType, setFilterType] = useState<KnowledgeType | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    api.getKnowledgeStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brain-text)]">Knowledge Base</h1>
          <p className="text-sm text-[var(--brain-text-muted)]">
            {stats ? `${(stats as Record<string, number>).totalKnowledgeObjects || 0} objects captured` : "Loading..."}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex bg-[var(--brain-surface-alt)] rounded-lg border border-[var(--brain-border)] p-0.5">
          {([
            { mode: "list" as ViewMode, icon: List, label: "List" },
            { mode: "timeline" as ViewMode, icon: Calendar, label: "Timeline" },
            { mode: "graph" as ViewMode, icon: Network, label: "Graph" },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                view === mode
                  ? "bg-[var(--brain-primary)] text-white"
                  : "text-[var(--brain-text-muted)] hover:text-[var(--brain-text)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(TYPE_LABELS).slice(0, 4).map(([type, label]) => (
            <div key={type} className="bg-[var(--brain-surface-alt)] rounded-lg p-3 border border-[var(--brain-border)]">
              <p className="text-2xl font-bold text-[var(--brain-text)]">
                {((stats as Record<string, Record<string, number>>).byType)?.[type] || 0}
              </p>
              <p className="text-xs text-[var(--brain-text-muted)]">{label}s</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--brain-text-muted)]" />
          <input
            type="text"
            placeholder="Search knowledge..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--brain-border)] bg-[var(--brain-surface)] text-sm text-[var(--brain-text)] placeholder:text-[var(--brain-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brain-primary)]/30"
          />
        </div>
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as KnowledgeType | "")}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-[var(--brain-border)] bg-[var(--brain-surface)] text-sm text-[var(--brain-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brain-primary)]/30"
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--brain-text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Content Area */}
      {view === "list" && <ListView />}
      {view === "timeline" && <TimelineView />}
      {view === "graph" && <GraphView />}
    </div>
  );
}

function ListView() {
  return (
    <div className="space-y-3">
      <EmptyState message="No knowledge objects yet. Start by recording a voice note." />
    </div>
  );
}

function TimelineView() {
  return (
    <div className="relative pl-6 border-l-2 border-[var(--brain-border)] space-y-6">
      <EmptyState message="Timeline will populate as you capture knowledge." />
    </div>
  );
}

function GraphView() {
  return (
    <div className="flex items-center justify-center h-96 bg-[var(--brain-surface-alt)] rounded-xl border border-[var(--brain-border)]">
      <div className="text-center">
        <Network className="w-12 h-12 mx-auto text-[var(--brain-text-muted)] mb-3" />
        <p className="text-sm text-[var(--brain-text-muted)]">Entity relationship graph</p>
        <p className="text-xs text-[var(--brain-text-muted)] mt-1">
          Visualizes connections between people, projects, technologies, and concepts
        </p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-full bg-[var(--brain-surface-alt)] flex items-center justify-center mb-4">
        <Circle className="w-8 h-8 text-[var(--brain-text-muted)]" />
      </div>
      <p className="text-sm text-[var(--brain-text-muted)]">{message}</p>
    </div>
  );
}
