/**
 * Roadmap & Project Types — CVG-MIDAS
 *
 * Multi-year IT roadmaps, projects with dependencies,
 * and structured data for frontend Gantt/timeline rendering.
 */

// ── Project Status ──────────────────────────────────────────────────

export type ProjectStatus =
  | "proposed"
  | "approved"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ProjectPriority = "critical" | "high" | "medium" | "low";

export type ExpenseType = "capex" | "opex";

// ── Roadmap ─────────────────────────────────────────────────────────

export interface Roadmap {
  id: string;
  tenantId: string;
  clientId: string;
  title: string;
  description: string | null;
  startYear: number;
  endYear: number;
  status: "draft" | "active" | "archived";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoadmapWithProjects extends Roadmap {
  projects: Project[];
}

// ── Project ─────────────────────────────────────────────────────────

export interface Project {
  id: string;
  tenantId: string;
  roadmapId: string;
  clientId: string;
  title: string;
  description: string | null;
  category: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  dependencies: string[];
  tags: string[];
  assignedTeam: string | null;
  source: "manual" | "security_gap" | "recommendation" | "aegis";
  sourceRefId: string | null;
  completionPct: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Timeline Item (for frontend Gantt rendering) ─────────────────────

export interface TimelineItem {
  id: string;
  title: string;
  category: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  completionPct: number;
  dependencies: string[];
  assignedTeam: string | null;
}

export interface RoadmapTimeline {
  roadmapId: string;
  title: string;
  startYear: number;
  endYear: number;
  items: TimelineItem[];
}
