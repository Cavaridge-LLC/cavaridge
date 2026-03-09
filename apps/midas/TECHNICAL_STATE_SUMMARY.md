# Midas — Technical State Summary

_Generated: March 3, 2026_

---

## 1. Project Name and Primary Purpose

**Midas** — A strategic IT roadmap and QBR (Quarterly Business Review) platform for managed service providers. Enables vCIOs, fCTOs, onboarding engineers, and account managers to create quarterly client technology roadmaps with drag-and-drop initiative cards, executive KPI snapshots, meeting lifecycle management, and board-level PPTX export.

---

## 2. Current Tech Stack

| Layer            | Technology              | Version     |
|------------------|-------------------------|-------------|
| Language         | TypeScript              | 5.6.3       |
| Runtime          | Node.js (via tsx)       | 20.x        |
| Frontend         | React                   | 19.2.0      |
| Bundler          | Vite                    | 7.1.9       |
| CSS              | Tailwind CSS            | 4.1.14      |
| UI Components    | shadcn/ui + Radix UI    | latest      |
| Client Routing   | wouter                  | 3.3.5       |
| Server State     | TanStack React Query    | 5.60.5      |
| Backend          | Express.js              | 5.0.1       |
| ORM              | Drizzle ORM             | 0.39.3      |
| Database         | PostgreSQL              | (Replit-managed) |
| Schema Validation| Zod + drizzle-zod       | 3.25.76 / 0.7.0 |
| Drag & Drop      | @dnd-kit                | core 6.3.1, sortable 10.0.0 |
| PPTX Generation  | pptxgenjs               | 4.0.1       |
| File Download    | file-saver              | 2.0.5       |
| Icons            | lucide-react            | 0.545.0     |
| Animations       | framer-motion           | 12.23.24    |
| Charts           | recharts                | 2.15.4      |

---

## 3. Folder and File Structure

```
/
├── client/
│   ├── index.html                          # HTML entry point with OG meta tags
│   └── src/
│       ├── main.tsx                        # React DOM mount point
│       ├── App.tsx                         # Route definitions (/, /qbr, 404)
│       ├── index.css                       # Tailwind v4 + CSS custom properties
│       ├── pages/
│       │   ├── Roadmap.tsx                 # Main roadmap board + KPI strip + client selector
│       │   ├── QBR.tsx                     # QBR meeting workspace (CRUD, close, export)
│       │   └── not-found.tsx               # 404 page
│       ├── components/
│       │   ├── RoadmapBoard.tsx            # DnD kanban board (quarter columns)
│       │   ├── Column.tsx                  # Droppable quarter column
│       │   ├── InitiativeCard.tsx          # Sortable initiative card
│       │   └── ui/                         # ~40 shadcn/ui primitives
│       ├── lib/
│       │   ├── api.ts                      # TanStack Query options + mutation hooks
│       │   ├── pptx.ts                     # 6-slide board PPTX generation
│       │   ├── queryClient.ts              # Query client config
│       │   └── utils.ts                    # cn() utility
│       └── hooks/
│           ├── use-mobile.tsx              # Mobile breakpoint hook
│           └── use-toast.ts                # Toast notification hook
├── server/
│   ├── index.ts                            # Express app bootstrap + listen
│   ├── routes.ts                           # All REST API route handlers + seed logic
│   ├── storage.ts                          # IStorage interface + DatabaseStorage class
│   ├── db.ts                               # PostgreSQL connection pool (drizzle + pg)
│   ├── vite.ts                             # Vite dev middleware integration
│   └── static.ts                           # Production static file serving
├── shared/
│   └── schema.ts                           # Drizzle table definitions + Zod schemas + types
├── script/
│   └── build.ts                            # Production build script (esbuild + vite)
├── package.json                            # Dependencies and scripts
├── tsconfig.json                           # TypeScript config
├── vite.config.ts                          # Vite config with plugins
├── drizzle.config.ts                       # Drizzle Kit config
├── postcss.config.js                       # PostCSS config
├── components.json                         # shadcn/ui config
├── replit.md                               # Agent memory / project context
├── RUNBOOK.md                              # Operational runbook
└── STATE_SUMMARY.md                        # This file
```

---

## 4. Environment Variables in Use

| Variable       | Purpose                              |
|----------------|--------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string         |
| `NODE_ENV`     | development / production mode toggle |
| `PORT`         | Server listen port (default: 5000)   |

---

## 5. Authentication and Authorization

**Status: Not implemented.**

- No authentication layer exists. All API routes are open/public.
- `passport` and `passport-local` are listed as dependencies but are **not imported or used** anywhere in the codebase.
- `express-session`, `connect-pg-simple`, and `memorystore` are installed but unused.
- There is no user model, no login/signup flow, no session management, no role-based access.

**What's missing:**
- User accounts and login
- Role-based access control (vCIO, engineer, account manager, client viewer)
- Per-user scoping of clients and data
- API route protection / middleware

---

## 6. Multitenancy Status

**Status: Absent.**

- All data is globally accessible. Any user sees all clients, initiatives, meetings, and snapshots.
- There is no organization/tenant concept in the data model.
- No row-level security or tenant scoping on queries.
- Single-org usage only in current form.

---

## 7. UI Theming

**Status: Light mode only (partial dark mode support).**

- CSS custom properties define light/dark themes in `index.css`.
- Dark mode class-based variables are defined but there is **no theme toggle** in the UI.
- No system preference detection is wired up.
- `next-themes` is installed but not used in the app.

---

## 8. Database Schema Summary

**4 tables, all using UUID primary keys (`varchar` + `gen_random_uuid()`):**

### `clients`
| Column     | Type    | Notes          |
|------------|---------|----------------|
| id         | varchar | PK, UUID       |
| name       | text    | NOT NULL       |
| industry   | text    | nullable       |
| headcount  | integer | nullable       |

### `initiatives`
| Column          | Type    | Notes              |
|-----------------|---------|---------------------|
| id              | varchar | PK, UUID            |
| client_id       | varchar | FK → clients.id     |
| title           | text    | NOT NULL            |
| description     | text    | NOT NULL            |
| team            | text    | NOT NULL            |
| priority        | text    | NOT NULL            |
| status          | text    | NOT NULL            |
| quarter         | text    | NOT NULL            |
| cost            | text    | nullable            |
| business_problem| text    | nullable            |
| service_area    | text    | nullable            |
| sort_order      | integer | NOT NULL, default 0 |

### `meetings`
| Column             | Type      | Notes                  |
|--------------------|-----------|------------------------|
| id                 | varchar   | PK, UUID               |
| client_id          | varchar   | FK → clients.id        |
| client_name        | text      | NOT NULL (denormalized) |
| title              | text      | NOT NULL               |
| type               | text      | NOT NULL               |
| state              | text      | NOT NULL, default Draft|
| date_label         | text      | NOT NULL               |
| attendees          | text[]    | NOT NULL, default {}   |
| agenda             | text      | NOT NULL, default ''   |
| notes              | text      | NOT NULL, default ''   |
| executive_summary  | text      | nullable               |
| next_steps         | text[]    | default {}             |
| created_at         | timestamp | default now()          |

### `snapshots`
| Column            | Type    | Notes                        |
|-------------------|---------|------------------------------|
| id                | varchar | PK, UUID                     |
| client_id         | varchar | FK → clients.id              |
| engagement_score  | integer | NOT NULL, default 0          |
| goals_aligned     | integer | NOT NULL, default 0          |
| risk_level        | text    | NOT NULL, default 'Low'      |
| budget_total      | integer | NOT NULL, default 0          |
| adoption_percent  | integer | NOT NULL, default 0          |
| roi_status        | text    | NOT NULL, default 'On track' |

---

## 9. API Endpoints

| Method | Path                                  | Purpose                          |
|--------|---------------------------------------|----------------------------------|
| GET    | `/api/clients`                        | List all clients                 |
| GET    | `/api/clients/:id`                    | Get single client                |
| POST   | `/api/clients`                        | Create a client                  |
| GET    | `/api/clients/:clientId/initiatives`  | Initiatives for a client         |
| POST   | `/api/initiatives`                    | Create an initiative             |
| PATCH  | `/api/initiatives/:id`               | Update an initiative             |
| DELETE | `/api/initiatives/:id`               | Delete an initiative             |
| PATCH  | `/api/initiatives/reorder/batch`      | Batch reorder (DnD persistence)  |
| GET    | `/api/meetings`                       | List all meetings                |
| GET    | `/api/meetings/:id`                   | Get single meeting               |
| POST   | `/api/meetings`                       | Create a meeting                 |
| PATCH  | `/api/meetings/:id`                   | Update a meeting                 |
| DELETE | `/api/meetings/:id`                   | Delete a meeting                 |
| GET    | `/api/clients/:clientId/snapshot`     | Get executive snapshot           |
| PUT    | `/api/clients/:clientId/snapshot`     | Upsert executive snapshot        |
| POST   | `/api/seed`                           | Seed sample data (dev only)      |

---

## 10. Third-Party Integrations

**Status: None connected.**

- No external APIs, SDKs, or services are integrated.
- OpenRouter AI was planned for executive summary generation but is **not yet implemented**.
- No email, notification, calendar, or CRM integrations exist.

---

## 11. Hardcoded Values That Should Be Configurable

| Location                  | Value                        | Should Be                            |
|---------------------------|------------------------------|--------------------------------------|
| `Roadmap.tsx` line 54     | `"FY 2024–2025"`            | Dynamic fiscal year or user-set      |
| `pptx.ts` line 128        | `"Midas by Cavaridge, LLC"` | Configurable per-org or per-user     |
| `pptx.ts` slides          | `"Aptos Display"` / `"Aptos"` font | Configurable or fallback-safe     |
| `routes.ts` seed data     | Sample clients, initiatives  | Should be clearly dev-only / removable |
| `QBR.tsx` draft summary   | Hardcoded executive narrative| Placeholder only, but static text    |
| `pptx.ts` recommendations | 4 fixed recommendation cards | Should be dynamic / user-editable    |
| Copyright footer           | `© 2026 Cavaridge, LLC`     | Configurable per deployment          |

---

## 12. Known Bugs, Incomplete Features, and Technical Debt

### Incomplete Features
- **OpenRouter AI integration** — planned but not built. No backend proxy, no API key management.
- **Templates & Assessments module** — planned (maturity levels, questionnaires, recommendation generation). Not started.
- **Dark mode toggle** — CSS variables exist but no UI switch to activate it.
- **User authentication** — dependencies installed but nothing wired up.

### Technical Debt
- `passport`, `passport-local`, `express-session`, `connect-pg-simple`, `memorystore` are unused dependencies adding bundle weight.
- `client_name` is denormalized on the `meetings` table (duplicated from `clients.name`). Could desync on client rename.
- Seed route (`POST /api/seed`) is accessible in production — should be dev-only guarded.
- No input sanitization beyond Zod schema parsing.
- No rate limiting on API endpoints.
- No error boundaries in the React app.
- PPTX fonts (`Aptos Display`, `Aptos`) may not render on systems without those fonts installed.

### Potential Bugs
- Reorder batch endpoint doesn't validate that all initiative IDs belong to the same client.
- Meeting attendees are stored as a flat text array with no structured user references.
- Snapshot is 1:1 with client but there's no unique constraint enforced in the schema (only in code).

---

## 13. Production-Ready vs. Prototype/Draft

### Production-Ready
- Database schema and migrations (Drizzle + PostgreSQL)
- REST API with Zod validation
- Client/initiative/meeting/snapshot CRUD
- Drag-and-drop kanban board with persistence
- PPTX board deck export (6 professional slides)
- Responsive UI with shadcn/ui components

### Prototype/Draft
- No authentication or authorization (anyone can access everything)
- No multitenancy (single-org only)
- No AI-generated content (summaries are static placeholders)
- No dark mode toggle
- Seed data accessible in production
- No automated tests
- No error monitoring or logging infrastructure

---

## 14. Deployment Status

| Attribute        | Value                                     |
|------------------|-------------------------------------------|
| Host             | Replit                                    |
| Domain           | `.replit.app` (auto-assigned)             |
| Build            | `tsx script/build.ts` (esbuild + vite)    |
| Start (prod)     | `node dist/index.cjs`                     |
| Start (dev)      | `tsx server/index.ts`                     |
| Port             | 5000                                      |
| Database         | Replit-managed PostgreSQL                 |
| CI/CD            | Replit auto-deploy on publish             |
| SSL              | Handled by Replit                         |
| Health checks    | Handled by Replit                         |
| Status           | **Published and live**                    |
