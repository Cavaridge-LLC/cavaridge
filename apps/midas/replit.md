# Midas

## Overview
A professional IT managed services & consulting roadmap planning tool for vCIOs, fCTOs, onboarding engineers, and account managers. Create and visualize quarterly client technology roadmaps with drag-and-drop, priority tags, team color coding, executive snapshots, QBR meeting management, and board-level PPTX export.

## Architecture
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui components
- **Backend**: Express.js API server
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (client), Express (server)
- **State**: TanStack Query for server state, local state for DnD
- **DnD**: @dnd-kit (core + sortable)
- **PPTX Export**: pptxgenjs + file-saver (browser-side generation)
- **Fonts**: Plus Jakarta Sans (display) + Inter (UI)

## Key Files
- `shared/schema.ts` — Drizzle schema: clients, initiatives, meetings, snapshots
- `server/db.ts` — PostgreSQL connection pool
- `server/storage.ts` — IStorage interface + DatabaseStorage implementation
- `server/routes.ts` — REST API routes (/api/clients, /api/initiatives, /api/meetings, /api/seed)
- `client/src/pages/Roadmap.tsx` — Main roadmap page with executive snapshot + board
- `client/src/pages/QBR.tsx` — QBR meeting workspace (create, edit, close, export)
- `client/src/components/RoadmapBoard.tsx` — DnD quarterly board
- `client/src/components/Column.tsx` — Droppable quarter column
- `client/src/components/InitiativeCard.tsx` — Sortable initiative card
- `client/src/lib/pptx.ts` — Board-level PPTX generation
- `client/src/lib/api.ts` — TanStack Query options + mutation hooks

## Data Model
- **Client**: id, name, industry, headcount
- **Initiative**: id, clientId, title, description, team, priority, status, quarter, cost, businessProblem, serviceArea, sortOrder
- **Meeting**: id, clientId, clientName, title, type, state, dateLabel, attendees[], agenda, notes, executiveSummary, nextSteps[]
- **Snapshot**: id, clientId, engagementScore, goalsAligned, riskLevel, budgetTotal, adoptionPercent, roiStatus

## API Routes
- `GET/POST /api/clients`
- `GET /api/clients/:clientId/initiatives`
- `POST /api/initiatives`
- `PATCH /api/initiatives/:id`
- `DELETE /api/initiatives/:id`
- `PATCH /api/initiatives/reorder/batch`
- `GET/POST /api/meetings`
- `PATCH/DELETE /api/meetings/:id`
- `GET/PUT /api/clients/:clientId/snapshot`
- `POST /api/seed` (convenience dev seeder)

## Design System
- Team colors: Infrastructure=blue-500, Cloud=purple-500, Security=red-500, Strategy=amber-500
- Priority: Critical=red, High=orange, Medium=blue, Low=slate
- Status: Planned, In Progress, Completed, Proposed
- Meeting types: QBR, Strategy Review, Security Review, Budget Review
- Meeting states: Draft → Scheduled → In Progress → Closed
- Light/dark mode via CSS custom properties

## Workflow
- `npm run dev` — starts full-stack (Express + Vite)
- `npm run db:push` — push Drizzle schema to PostgreSQL
- Port 5000

## Research References
- Value-forward framing, business problem → initiative mapping
- strategyoverview.com — executive snapshot KPIs, QBR automation
- pendo.io/solutions/pendo-for-it — adoption, ROI, risk, spend optimization
- vcioglobal.com — service area alignment, strategic IT planning
- deepnet.com — vendor management, contract negotiation, SLA tracking
- vciotoolbox.freshdesk.com — meeting types/states, close process, templates, assessments
