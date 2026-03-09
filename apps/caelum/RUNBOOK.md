# Caelum — Operations Runbook v1.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [File Map](#2-file-map)
3. [Database Schema](#3-database-schema-5-tables)
4. [API Routes](#4-api-routes)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Environment Variables & Secrets](#6-environment-variables--secrets)
7. [Frontend Navigation](#7-frontend-navigation)
8. [AI Pipeline](#8-ai-pipeline)
9. [Operational Troubleshooting](#9-operational-troubleshooting)

---

## 1. System Overview

Caelum is a conversational Scope of Work builder. Users authenticate via Replit Auth, chat with Claude (via OpenRouter), paste notes or attach files, answer follow-up questions, and generate structured client-ready SoW documents following a 12-section v2 runbook standard. SoWs can be inline-edited with undo/redo, versioned, compared, and exported as PDF, Word, Jira CSV, Asana CSV, or JSON. A dashboard provides aggregate metrics across all scopes.

### Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS v4 + shadcn/ui + wouter + framer-motion |
| Backend | Express.js (TypeScript, tsx runner) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Replit Auth (OpenID Connect, express-session, connect-pg-simple) |
| AI | Claude (anthropic/claude-sonnet-4) via OpenRouter REST API |
| File Processing | multer, pdf-parse, mammoth, xlsx |
| Exports | jsPDF (PDF), docx (Word), client-side CSV/JSON |

---

## 2. File Map

### Server Files (`server/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~103 | App bootstrap, middleware stack, HTTP server startup |
| `routes.ts` | ~372 | Custom API routes: chat streaming, upload, SoW CRUD, export, profile |
| `sowExport.ts` | ~857 | PDF generation (jsPDF/Helvetica) and DOCX generation (docx/Calibri) |
| `fileExtractor.ts` | ~51 | Extract text from uploaded files (PDF, DOCX, XLSX, CSV, TXT, etc.) |
| `db.ts` | ~14 | PostgreSQL pool and Drizzle ORM instance |
| `storage.ts` | ~1 | Re-exports storage interface |
| `vite.ts` | ~58 | Vite dev server middleware integration |
| `static.ts` | ~19 | Static file serving for production |

### Server Integration Files (`server/replit_integrations/`)

| File | Lines | Purpose |
|------|-------|---------|
| `auth/replitAuth.ts` | ~160 | Replit Auth OIDC setup, session config, login/callback/logout routes |
| `auth/routes.ts` | ~18 | `/api/auth/user` endpoint |
| `auth/storage.ts` | ~34 | User upsert on login |
| `auth/index.ts` | ~3 | Auth module re-export |
| `chat/routes.ts` | ~121 | Base conversation/message CRUD routes (extended by custom routes.ts) |
| `chat/storage.ts` | ~95 | Conversation & message DB operations with user scoping |
| `chat/index.ts` | ~3 | Chat module re-export |

### Client Files (`client/src/`)

| File | Lines | Purpose |
|------|-------|---------|
| `pages/home.tsx` | ~2283 | Main app: chat UI, sidebar + search, SoW renderer/editor, dashboard, dark mode, templates, export, version history, profile panel |
| `pages/landing.tsx` | ~91 | Landing page for unauthenticated users |
| `pages/not-found.tsx` | ~21 | 404 page |
| `App.tsx` | ~45 | Root component, auth-gated routing |
| `main.tsx` | ~5 | React DOM entry point |
| `index.css` | ~83 | Tailwind v4 config, dark mode variant, CSS custom properties |
| `hooks/use-auth.ts` | ~47 | Auth hook (user state, loading, logout) |
| `hooks/use-toast.ts` | ~191 | Toast notification hook |
| `hooks/use-mobile.tsx` | ~19 | Mobile breakpoint hook |
| `lib/queryClient.ts` | ~57 | TanStack Query client config |
| `lib/auth-utils.ts` | ~17 | Auth utility helpers |
| `lib/utils.ts` | ~6 | cn() class merge utility |

### Shared Files (`shared/`)

| File | Lines | Purpose |
|------|-------|---------|
| `models/auth.ts` | ~29 | Users and sessions table schemas (Drizzle) |
| `models/chat.ts` | ~54 | Conversations, messages, sow_versions table schemas + Zod insert schemas |
| `schema.ts` | ~2 | Re-exports all schemas |

### Config Files (root)

| File | Lines | Purpose |
|------|-------|---------|
| `package.json` | ~120 | Dependencies, scripts (dev, build, db:push) |
| `tsconfig.json` | ~23 | TypeScript config with path aliases |
| `vite.config.ts` | ~51 | Vite config with React plugin, path aliases |
| `drizzle.config.ts` | ~14 | Drizzle Kit config for migrations |

---

## 3. Database Schema (5 tables)

### `users`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | varchar | PK, default `gen_random_uuid()` |
| `email` | varchar | UNIQUE |
| `first_name` | varchar | nullable |
| `last_name` | varchar | nullable |
| `profile_image_url` | varchar | nullable |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now() |

### `sessions`

| Column | Type | Constraints |
|--------|------|------------|
| `sid` | varchar | PK |
| `sess` | jsonb | NOT NULL |
| `expire` | timestamp | NOT NULL, indexed (IDX_session_expire) |

### `conversations`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | serial | PK |
| `user_id` | text | NOT NULL |
| `title` | text | NOT NULL |
| `sow_json` | jsonb | nullable |
| `created_at` | timestamp | NOT NULL, DEFAULT now() |
| `updated_at` | timestamp | NOT NULL, DEFAULT now() |

### `messages`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | serial | PK |
| `conversation_id` | integer | NOT NULL, FK → conversations.id ON DELETE CASCADE |
| `role` | text | NOT NULL ("user" or "assistant") |
| `content` | text | NOT NULL |
| `created_at` | timestamp | NOT NULL, DEFAULT now() |

### `sow_versions`

| Column | Type | Constraints |
|--------|------|------------|
| `id` | serial | PK |
| `conversation_id` | integer | NOT NULL, FK → conversations.id ON DELETE CASCADE |
| `version` | integer | NOT NULL |
| `sow_json` | jsonb | NOT NULL |
| `label` | text | NOT NULL |
| `created_at` | timestamp | NOT NULL, DEFAULT now() |

---

## 4. API Routes

### 4.1 Authentication (Replit Auth Integration)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/login` | Initiate OIDC login flow | No |
| GET | `/api/callback` | OIDC callback handler | No |
| GET | `/api/logout` | Destroy session, redirect to `/` | No |
| GET | `/api/auth/user` | Return current authenticated user | Yes |
| PATCH | `/api/auth/profile` | Update user firstName, lastName, email | Yes |

### 4.2 File Upload

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/upload` | Upload up to 10 files (20MB each), return extracted text | Yes |

### 4.3 Conversations

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/conversations` | List user's conversations (newest first) | Yes |
| GET | `/api/conversations/:id` | Load conversation with all messages | Yes |
| POST | `/api/conversations` | Create a new conversation | Yes |
| DELETE | `/api/conversations/:id` | Delete conversation and cascade messages/versions | Yes |
| PATCH | `/api/conversations/:id/sow` | Save/update SoW JSON + auto-create version snapshot | Yes |

### 4.4 SoW Versions

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/conversations/:id/versions` | List all version snapshots for a conversation | Yes |
| POST | `/api/conversations/:id/versions/:versionId/restore` | Restore a previous version as current SoW | Yes |

### 4.5 SoW Export

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/conversations/:id/export/:format` | Export SoW as PDF or DOCX (format = "pdf" or "docx") | Yes |

### 4.6 Chat (AI Streaming)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/chat` | Stream chat with Claude via SSE. Auto-creates conversation on first message. Persists all messages. | Yes |

### 4.7 Conversation Messages (Integration Base Routes)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/conversations/:id/messages` | Add a message to a conversation | Yes |

---

## 5. Authentication & Authorization

- **Method**: Replit Auth via OpenID Connect (OIDC)
- **Session**: express-session backed by connect-pg-simple (PostgreSQL `sessions` table)
- **User ID**: Stored at `req.user.claims.sub` (NOT `req.user.id`)
- **Middleware**: `isAuthenticated` checks for valid session on all `/api/*` routes except login/callback/logout
- **User Scoping**: All conversation/message queries filter by `userId` matching `req.user.claims.sub`
- **Roles**: Single role (authenticated user). No admin/role distinction.
- **Protected routes**: All `/api/*` except `/api/login`, `/api/callback`, `/api/logout`
- **Public routes**: `/api/login`, `/api/callback`, `/api/logout`, all static frontend assets

---

## 6. Environment Variables & Secrets

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-provided by Replit) |
| `OPENAI_API_KEY` | Yes | OpenRouter API key for Claude access (user-supplied) |
| `REPLIT_DOMAINS` | Yes | Replit domain for OIDC callback (auto-provided) |
| `REPL_ID` | Yes | Repl identifier for auth (auto-provided) |
| `PORT` | No | Server port, defaults to 5000 |
| `NODE_ENV` | No | "development" or "production" |
| `SESSION_SECRET` | No | Auto-generated if not set |

---

## 7. Frontend Navigation

| Path | Page | Auth Required | Description |
|------|------|--------------|-------------|
| `/` | Landing / Home | No / Yes | Shows Landing page if unauthenticated, Home if authenticated |

### Home Page Views (all at `/`)

| View | Trigger | Description |
|------|---------|-------------|
| Empty State | No messages in current conversation | Template cards + chat input |
| Chat | Messages exist, SoW panel closed | Chat messages + input |
| SoW Document | "View SoW" button clicked | Full SoW renderer/editor with version history |
| Dashboard | "Dashboard" button clicked | Metrics: scopes, hours, cost, risks, types, activity |

---

## 8. AI Pipeline

| Component | Detail |
|-----------|--------|
| Provider | OpenRouter (`https://openrouter.ai/api/v1`) |
| Model | `anthropic/claude-sonnet-4` |
| Streaming | SSE via `fetch` with `ReadableStream` reader |
| System Prompt | Embedded in `server/routes.ts` — defines 12-section SoW structure, scope type add-ons, risk format, workload roles/rates, 3 mandatory PM tasks |
| SoW Markers | Claude wraps JSON in `<<<SOW_START>>>` / `<<<SOW_END>>>` markers |
| Client Parsing | `parseSow()` function in `home.tsx` extracts and normalizes JSON |

### Workload Estimate Roles & Fixed Rates

| Role | Rate |
|------|------|
| Executive/Shareholder | $285/hr |
| Architect | $225/hr |
| Systems Engineer | $185/hr |
| Security Engineer | $225/hr |
| Network Technician | $185/hr |
| Field Technician | $185/hr |

---

## 9. Operational Troubleshooting

### 9.1 PDF / DOCX Export

| Symptom | Cause | Fix |
|---------|-------|-----|
| Unicode bullets (triangle, warning) render as boxes in PDF | Helvetica font doesn't support Unicode glyphs | Use ASCII replacements only: `-` for bullet, `!` for warning, `[ ]` for checkbox, `x` for cross |
| DOCX renders Unicode fine | Calibri font supports Unicode | No action needed — keep Unicode in DOCX exports |

### 9.2 Authentication

| Symptom | Cause | Fix |
|---------|-------|-----|
| `req.user.id` returns undefined | Replit Auth stores user ID at `req.user.claims.sub` | Always use `req.user.claims.sub` for user ID |
| Login redirects fail | Missing `REPLIT_DOMAINS` env var | Ensure running on Replit (auto-provided) |

### 9.3 Chat / AI

| Symptom | Cause | Fix |
|---------|-------|-----|
| Chat returns 500 or empty response | Invalid or missing `OPENAI_API_KEY` | Verify key is set and valid for OpenRouter |
| SoW not detected from response | Claude didn't wrap output in markers | User should explicitly say "generate" to trigger SoW output |

### 9.4 Frontend

| Symptom | Cause | Fix |
|---------|-------|-----|
| Dark mode not persisting | localStorage blocked or cleared | Check browser localStorage access for `caelum-dark-mode` key |
| Search matches unexpected results | Filtering uses `JSON.stringify(sowJson)` which includes JSON keys | Expected behavior — searches all SoW content including field names |

---

*Caelum — Operations Runbook v1.0*
*Updated February 2026 — Initial runbook covering full application architecture, all API routes, database schema, auth flow, AI pipeline, export system, and UI features*
