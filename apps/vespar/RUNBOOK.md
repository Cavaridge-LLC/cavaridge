# SkyShift Runbook

## Project Overview
**Name:** SkyShift
**Description:** A friendly, step-by-step web application that helps non-technical teams design cloud migration plans across platforms (on-premises, AWS, Azure, GCP).
**Target Audience:** Non-technical teams looking for a simple, jargon-free way to plan their cloud migration.

## Architecture
- **Frontend:** React 19 + Vite 7 + TypeScript 5.6
- **Backend:** Express 5 + Node.js
- **Database:** PostgreSQL with Drizzle ORM (v0.39)
- **Styling:** Tailwind CSS v4, Lucide React (Icons), `tw-animate-css`
- **Routing:** `wouter` (frontend), Express (backend API)
- **Data Fetching:** TanStack React Query v5
- **Design System:** "Soft Tech"
  - *Typography:* Outfit (Headings) and Inter (Body)
  - *Color Palette:* Primary bright blue (`221 83% 53%`), secondary soft purple, clean white cards, subtle gradients.
  - *UI Patterns:* Glassmorphism panels, soft shadows, rounded corners (`radius: 1rem`), and subtle transitions.
  - *Note on Tailwind v4:* Custom CSS variables for fonts and colors must be placed in `@theme inline` inside `client/src/index.css`.

## Database Schema
- **`users`**: id (UUID varchar PK), username (text unique), password (text)
- **`migration_plans`**: id (UUID varchar PK), source (text), destination (text), resources (text[]), timeline_estimate (text), downtime_estimate (text), complexity (text), risk_level (text), steps (jsonb string[]), created_at (timestamp)

## API Endpoints
- `POST /api/migration-plans` — Create a new migration plan (blueprint generation logic runs server-side)
- `GET /api/migration-plans` — List all migration plans (ordered by newest first)
- `GET /api/migration-plans/:id` — Get a single migration plan by ID

## Features Built
1. **Landing Page (`/`)**
   - Clean, animated hero section with floating UI cards.
   - "How it works" steps explaining the migration flow.
   - Custom 3D soft cloud illustration background (`client/src/assets/hero-bg.png`).

2. **Migration Wizard (`/wizard`)**
   - **Step 1 (Source):** Choose current infrastructure (On-Premises, AWS, Azure, GCP).
   - **Step 2 (Destination):** Choose target cloud platform (AWS, Azure, GCP).
   - **Step 3 (Resources):** Select what needs to be moved (Websites, Databases, Files, Internal Tools).
   - **Step 4 (Result):** Generates a real server-side blueprint with dynamic timeline estimates, downtime expectations, risk level, complexity, and recommended next steps. Plan is persisted to PostgreSQL.
   - *State Management:* React `useState` for wizard steps, `useMutation` for API calls.

3. **Plan History (`/history`)**
   - Lists all previously generated migration plans from the database.
   - Each plan card shows source → destination, risk level, resource count, timeline, and creation date.

4. **Plan Detail (`/plan/:id`)**
   - Full read-only view of a saved migration plan, loaded from database by ID.

## Blueprint Generation Logic (server-side)
The `generateBlueprint()` function in `server/routes.ts` dynamically calculates:
- **Timeline** based on resource count and type (databases and internal tools add complexity)
- **Downtime** scaled by migration size
- **Complexity** (Low/Moderate/High) based on resource types selected
- **Risk Level** adjusted higher for cross-cloud migrations (e.g., AWS → Azure)
- **Steps** dynamically assembled based on which resources are selected

## Important Notes & Constraints
- **Images:** Image assets are stored in `client/src/assets/` and must be imported via JavaScript (`import img from '@/assets/img.png'`), not referenced via static URL paths.
- **Workflow:** Run `npm run dev` (mapped to "Start application" workflow) which starts the full Express server serving both API and frontend.
- **Database:** PostgreSQL via `DATABASE_URL` environment variable. Schema sync via `npm run db:push`.
- **Copyright:** © 2026 Cavaridge, LLC. All rights reserved. (footer on all pages)

## File Structure
- `shared/schema.ts` — Drizzle ORM table definitions and Zod validation schemas
- `server/db.ts` — Database connection pool
- `server/storage.ts` — Storage interface (DatabaseStorage) with CRUD methods
- `server/routes.ts` — API routes and blueprint generation logic
- `client/src/App.tsx` — Router configuration
- `client/src/pages/home.tsx` — Landing page
- `client/src/pages/migration-wizard.tsx` — Step-by-step wizard with API integration
- `client/src/pages/history.tsx` — Plan history list
- `client/src/pages/plan-detail.tsx` — Single plan detail view
- `client/src/index.css` — Global styles and Tailwind v4 theme config