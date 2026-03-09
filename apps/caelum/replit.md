# Caelum — Scope of Work Builder

## Overview
A conversational web application for generating client-ready Scope of Work documents. Users chat with multi-model AI (via OpenRouter) — paste messy notes, attach files, answer follow-up questions, and get a structured SoW following the v2 runbook standard (12 sections, scope-type add-ons, full risk format, workload estimate). Conversations and generated SoWs are persisted in the database. Branded as Caelum, copyright Cavaridge, LLC. Multi-tenant with role-based access control.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui components
- **Backend**: Express.js server
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **AI**: Multi-model via OpenRouter (user's own API key stored as `OPENROUTER_API_KEY`, base URL `https://openrouter.ai/api/v1`). Supports 5 models: Claude Sonnet 4, GPT-4o, Gemini 2.5 Flash, DeepSeek R1, Llama 4 Maverick. Three modes: Auto (smart routing based on request classification), Ensemble (parallel query to top 3 models + synthesis), or Direct (pick a specific model).
- **Routing**: wouter (frontend), Express (backend)
- **File Processing**: multer (upload), pdf-parse, mammoth (docx), xlsx (spreadsheets)
- **Exports**: PDFKit (PDF, server-side Node.js native), docx (Word), client-side CSV/JSON generation
- **Deployment**: Autoscale target, build `npm run build`, run `node ./dist/index.cjs`

## Multi-Tenancy
- `tenants` table: id (UUID), name, slug (unique), configJson (jsonb — rate card, branding, system prompt overrides), createdAt
- `user_tenants` table: userId + tenantId composite PK — maps users to tenants
- All data tables (`conversations`, `messages`, `sow_versions`) have `tenantId` (UUID, NOT NULL, FK → tenants.id)
- `server/middleware/tenantScope.ts`: resolves `req.tenantId` from user_tenants lookup; defaults to "Dedicated IT" tenant
- All storage queries filter by tenantId — complete data isolation between tenants
- Default tenant: "Dedicated IT" (slug: `dedicated-it`, ID: `0b24c7e3-51f2-4469-bfd4-8b81f22fbde6`)

## RBAC (Role-Based Access Control)
- `roles` table: id (UUID), name (unique), permissions (jsonb)
- `user_roles` table: userId + roleId + tenantId composite unique
- 5 roles (hierarchy): Platform Owner (50) > Platform Admin (40) > Tenant Admin (30) > User (20) > Viewer (10)
- `server/middleware/rbac.ts`: `loadUserRole` middleware + `requireRole(...roles)` factory
- Route gating: Viewer = GET only; User = create/edit/chat; Tenant Admin+ = delete; Platform Admin+ = cross-tenant
- UI gating: `canEdit` (role !== Viewer) gates chat input, new conversation, SoW edit, message edit/branch; `canDelete` (Tenant Admin+) gates conversation/message delete buttons
- Role endpoint: `GET /api/auth/role` returns `{ role: string }`
- Role cache: in-memory Map in rbac.ts; `clearRoleCache()` available

## DB-Driven Tenant Branding
- `server/tenantConfigLoader.ts`: `getTenantConfig(tenantId)` loads from DB with 5-minute cache
- `TenantConfig` interface: vendorName, vendorAbbreviation, parentCompany, appName, confidentialFooter, vendorSignatureLabel, rateCard[], mandatoryPmTasks[], scopeTypeAddOns[]
- `buildSystemPrompt(config)`: dynamically builds system prompt from tenant config
- `sowExport.ts`: accepts `TenantConfig` parameter for PDF/DOCX generation (falls back to hardcoded defaults)
- `server/tenantConfig.ts`: still exists for `seed.ts` only; NOT imported by runtime code
- Cache: `clearTenantConfigCache(tenantId?)` available

## LLM Configuration
- `server/llm.config.ts`: Centralized model routing
  - `LLM_ROUTES`: maps task types (reportGeneration, sowGeneration, grammarCheck, lightweightUI, synthesisExpert, titleGeneration) to model IDs
  - `MODEL_ROSTER`: user-facing model list with IDs, labels, strengths for auto/ensemble/direct modes
- No hardcoded model IDs in routes.ts — all imported from llm.config.ts

## Error Handling
- `server/utils/errors.ts`: Typed error classes — ValidationError (400), NotFoundError (404), ForbiddenError (403), RateLimitError (429), InternalError (500)
- Centralized Express error middleware in server/index.ts; response format: `{ error, type, statusCode }`
- `client/src/components/ErrorBoundary.tsx`: React class component wrapping app root, chat panel, SoW panel independently

## Key Files
- `client/src/pages/home.tsx` - Main app: chat interface, sidebar with search, SoW document renderer/editor, dashboard, theme toggle, templates, export menus, version history, profile panel, RBAC UI gating
- `client/src/pages/landing.tsx` - Landing page (unauthenticated)
- `client/src/App.tsx` - Root component with auth-gated routing, wrapped in ErrorBoundary
- `client/src/hooks/use-auth.ts` - Auth hook for user state
- `client/src/lib/queryClient.ts` - API request helper with CSRF token management
- `client/src/index.css` - Tailwind v4 config with `@custom-variant dark (&:is(.dark *))` for dark mode
- `client/src/components/ErrorBoundary.tsx` - React error boundary with user-friendly fallback
- `server/routes.ts` - API routes: auth, chat, conversations CRUD, file upload, PDF/DOCX export, rate limiting, CSRF, RBAC-gated
- `server/tenantConfigLoader.ts` - DB-driven tenant config with caching + system prompt builder
- `server/tenantConfig.ts` - Legacy branding config (used only by seed.ts)
- `server/llm.config.ts` - Centralized LLM model routing and roster
- `server/sowExport.ts` - PDF (PDFKit) and DOCX generation, accepts TenantConfig parameter
- `server/fileExtractor.ts` - File text extraction
- `server/utils/errors.ts` - Typed error classes
- `server/middleware/tenantScope.ts` - Tenant resolution middleware
- `server/middleware/rbac.ts` - Role-based access control middleware
- `server/storage.ts` - IStorage interface and DatabaseStorage implementation
- `server/seed.ts` - DB seeding: tenants, roles, user assignments
- `server/replit_integrations/auth/` - Replit Auth integration module (DO NOT modify)
- `server/replit_integrations/chat/storage.ts` - Conversation & message CRUD with user + tenant scoping
- `shared/branding.ts` - Client-side branding constants
- `shared/models/chat.ts` - All DB schemas: users, sessions, conversations, messages, sow_versions, tenants, user_tenants, roles, user_roles

## API Endpoints
- `GET /api/csrf-token` - Returns a CSRF token
- `POST /api/chat` - Multi-model streaming chat (rate limited: 20 req/min). Accepts `{ messages, conversationId?, aiMode? }`. Requires User role.
- `GET /api/models` - Available model roster. Requires Viewer role.
- `POST /api/upload` - File upload (up to 10 files, 20MB each). Requires User role.
- `GET /api/conversations` - List user's conversations (tenant-scoped). Requires Viewer role.
- `GET /api/conversations/:id` - Load conversation with messages. Requires Viewer role.
- `DELETE /api/conversations/:id` - Delete conversation. Requires Tenant Admin role.
- `PATCH /api/conversations/:id/flag` - Toggle flagged status. Requires User role.
- `PATCH /api/conversations/:id/sow` - Save SoW JSON + auto-version. Requires User role.
- `PATCH /api/conversations/:id/title` - Rename conversation. Requires User role.
- `GET /api/conversations/:id/versions` - List SoW versions. Requires Viewer role.
- `POST /api/conversations/:id/versions/:versionId/restore` - Restore version. Requires User role.
- `POST /api/conversations/:id/export/:format` - Export SoW as PDF/DOCX. Requires Viewer role.
- `DELETE /api/messages/:id` - Delete message. Requires Tenant Admin role.
- `DELETE /api/conversations/:id/messages-after/:messageId` - Delete messages after point. Requires User role.
- `POST /api/conversations/:id/branch` - Fork conversation. Requires User role.
- `PATCH /api/auth/profile` - Update profile. Requires Viewer role.
- `GET /api/auth/role` - Returns current user's role name.

## Database Schema
- `users` - id, email, firstName, lastName, profileImageUrl, timestamps
- `sessions` - sid, sess (jsonb), expire
- `tenants` - id (UUID), name, slug (unique), configJson (jsonb), createdAt
- `user_tenants` - userId (FK), tenantId (FK), composite PK
- `roles` - id (UUID), name (unique), permissions (jsonb)
- `user_roles` - userId (FK), roleId (FK), tenantId (FK), composite unique
- `conversations` - id, userId, tenantId (FK → tenants), title, sowJson, flagged, createdAt, updatedAt
- `messages` - id, conversationId (FK cascade), tenantId (FK → tenants), role, content, createdAt
- `sow_versions` - id, conversationId (FK cascade), tenantId (FK → tenants), version, sowJson, label, createdAt

## Critical Implementation Notes
- **Replit Auth**: User ID is at `req.user.claims.sub` NOT `req.user.id` — do NOT change this
- **Do NOT modify** files in `server/replit_integrations/auth/`
- **db:push**: Used instead of drizzle migrations (`npm run db:push`)
- **localStorage keys**: `caelum-theme-mode` (values: "light"|"dark"|"system"), `caelum-ai-mode`
- **env vars**: `OPENROUTER_API_KEY`, `SESSION_SECRET` (required), `DATABASE_URL`
- **isProduction**: `process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT`

## Theme System
- Three-way toggle: Light / Dark / System
- System mode follows OS preference via `window.matchMedia('(prefers-color-scheme: dark)')` and listens for changes
- Persisted in localStorage as `caelum-theme-mode`
- Uses `dark` class on `<html>` with Tailwind v4 `@custom-variant dark`

## Security
- **Rate Limiting**: `express-rate-limit` — 60 req/min default on all `/api` routes; 20 req/min strict on `/api/chat`
- **CSRF Protection**: HMAC-signed double-submit cookie pattern
- **Session Secret**: Read from `SESSION_SECRET` env var
- **RBAC**: All routes gated with role-based middleware
- **Tenant Isolation**: All data queries scoped by tenantId
