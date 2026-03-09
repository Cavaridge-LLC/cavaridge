# Midas — RUNBOOK

## Quick Start

```bash
npm run dev          # Start full-stack dev server (Express + Vite) on port 5000
npm run db:push      # Push Drizzle schema to PostgreSQL
```

The app auto-seeds sample data (3 clients with initiatives, meetings, and snapshots) on first load if no clients exist. Trigger manually via `POST /api/seed`.

## Stack

| Layer      | Technology                                  |
|------------|---------------------------------------------|
| Frontend   | React 18, Vite, Tailwind v4, shadcn/ui      |
| Routing    | wouter (client), Express (server)            |
| State      | TanStack Query (server state), local (DnD)   |
| Backend    | Express.js REST API                          |
| Database   | PostgreSQL + Drizzle ORM                     |
| DnD        | @dnd-kit (core + sortable)                   |
| Export     | pptxgenjs + file-saver (browser-side)        |
| Fonts      | Plus Jakarta Sans (display) + Inter (UI)     |

## Pages

| Route  | Component            | Purpose                                               |
|--------|----------------------|-------------------------------------------------------|
| `/`    | `Roadmap.tsx`        | Client roadmap board with drag-and-drop, KPI strip    |
| `/qbr` | `QBR.tsx`            | QBR meeting workspace: create, edit, close, export    |

## Database Schema (4 tables)

- **clients** — id (uuid), name, industry, headcount
- **initiatives** — id (uuid), clientId (FK), title, description, team, priority, status, quarter, cost, businessProblem, serviceArea, sortOrder
- **meetings** — id (uuid), clientId (FK), clientName, title, type, state, dateLabel, attendees[], agenda, notes, executiveSummary, nextSteps[]
- **snapshots** — id (uuid), clientId (FK), engagementScore, goalsAligned, riskLevel, budgetTotal, adoptionPercent, roiStatus

ID columns are `varchar` with `gen_random_uuid()` default. Do NOT change ID column types.

## API Routes

| Method | Path                                  | Purpose                          |
|--------|---------------------------------------|----------------------------------|
| GET    | `/api/clients`                        | List all clients                 |
| POST   | `/api/clients`                        | Create a client                  |
| GET    | `/api/clients/:clientId/initiatives`  | Initiatives for a client         |
| POST   | `/api/initiatives`                    | Create an initiative             |
| PATCH  | `/api/initiatives/:id`               | Update an initiative             |
| DELETE | `/api/initiatives/:id`               | Delete an initiative             |
| PATCH  | `/api/initiatives/reorder/batch`      | Batch reorder (DnD persistence)  |
| GET    | `/api/meetings`                       | List all meetings                |
| POST   | `/api/meetings`                       | Create a meeting                 |
| PATCH  | `/api/meetings/:id`                   | Update a meeting                 |
| DELETE | `/api/meetings/:id`                   | Delete a meeting                 |
| GET    | `/api/clients/:clientId/snapshot`     | Get executive snapshot           |
| PUT    | `/api/clients/:clientId/snapshot`     | Update executive snapshot        |
| POST   | `/api/seed`                           | Seed sample data (dev only)      |

## Key Files

| File                                    | Purpose                                        |
|-----------------------------------------|------------------------------------------------|
| `shared/schema.ts`                      | Drizzle schema + Zod insert schemas + types    |
| `server/db.ts`                          | PostgreSQL connection pool                     |
| `server/storage.ts`                     | IStorage interface + DatabaseStorage class     |
| `server/routes.ts`                      | All REST API route handlers                    |
| `client/src/pages/Roadmap.tsx`          | Main roadmap page + executive snapshot strip   |
| `client/src/pages/QBR.tsx`              | QBR meeting workspace                         |
| `client/src/components/RoadmapBoard.tsx`| DnD quarterly kanban board                     |
| `client/src/components/Column.tsx`      | Droppable quarter column                       |
| `client/src/components/InitiativeCard.tsx`| Sortable initiative card                     |
| `client/src/lib/pptx.ts`               | 6-slide board PPTX generation                 |
| `client/src/lib/api.ts`                | TanStack Query options + mutation hooks        |

## PPTX Board Deck (6 slides)

1. **Cover** — Dark navy, blue accent stripe, client name, date, prepared-by
2. **Executive Summary** — Strategic overview narrative, 6 KPI cards, bar charts by service area, status breakdown
3. **Risk & Security Posture** — Risk assessment callout, metric cards, security initiative table
4. **Quarterly Initiative Roadmap** — Timeline with initiative cards, team-color accent bars, status badges, costs
5. **Budget & Investment Summary** — Budget/adoption/ROI cards, quarter-by-quarter investment breakdown
6. **Next Steps & Recommendations** — 4 numbered recommendation cards with contextual data

## Design System

- **Team colors**: Infrastructure = blue-500, Cloud = purple-500, Security = red-500, Strategy = amber-500
- **Priority**: Critical = red, High = orange, Medium = blue, Low = slate
- **Status**: Planned, In Progress, Completed, Proposed
- **Meeting types**: QBR, Strategy Review, Security Review, Budget Review
- **Meeting states**: Draft → Scheduled → In Progress → Closed
- **Theme**: Light/dark mode via CSS custom properties

## Environment

- `DATABASE_URL` — PostgreSQL connection string (provided by Replit)
- Port 5000 (Express serves both API and Vite dev)

## Planned / Not Yet Implemented

- OpenRouter AI integration for executive summaries, initiative narratives, QBR speaker notes (backend proxy, never expose key in browser)
- Templates & Assessments module (maturity levels, hide questions, generate recommendations → roadmap)
- Service area alignment and vendor management features

## Session Log

- **2026-02-25**: Full-stack conversion complete (PostgreSQL + Drizzle ORM). 4 tables, REST API, TanStack Query frontend. QBR workspace with meeting CRUD and state management. PPTX export revamped to 6-slide professional board deck with color-coded graphics, KPI cards, bar charts, risk assessment callouts, timeline visualization, and contextual recommendations. Removed all "Humanize" references; rebranded to "vCIO Roadmap". App published.
- **2026-03-03**: Renamed application to "Midas". Added "© 2026 Cavaridge, LLC. All rights reserved." copyright to Roadmap footer, QBR footer, and PPTX cover slide. Generated full technical state summary (STATE_SUMMARY.md) covering stack, schema, API, auth gaps, multitenancy status, hardcoded values, and production readiness.
