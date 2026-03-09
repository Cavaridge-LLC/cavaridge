# Caelum — Technical State Summary

## 1. Project Name and Primary Purpose

**Caelum** — A conversational Scope of Work (SoW) builder for **Dedicated IT / Cavaridge, LLC** (MSP/MSSP). Users chat with multi-model AI (via OpenRouter), paste notes, attach files, and generate structured, client-ready SoW documents following the v2 runbook standard. Conversations and generated SoWs persist in PostgreSQL. Branded as Caelum / Cavaridge, LLC.

---

## 2. Current Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js (NixOS `nodejs-20`) | 20.x |
| **Language** | TypeScript | 5.6.3 |
| **Frontend Framework** | React | ^19.2.0 |
| **Bundler** | Vite | ^7.1.9 |
| **CSS** | Tailwind CSS v4 | ^4.1.14 |
| **UI Components** | shadcn/ui (Radix primitives) | Various ^1.x–^2.x |
| **Frontend Routing** | wouter | ^3.3.5 |
| **State/Data Fetching** | @tanstack/react-query | ^5.60.5 |
| **Backend Framework** | Express | ^5.0.1 |
| **ORM** | Drizzle ORM | ^0.39.3 |
| **Database** | PostgreSQL 16 | (Replit-managed) |
| **Schema Validation** | Zod + drizzle-zod | ^3.25.76 / ^0.7.1 |
| **AI Client** | OpenAI SDK (pointed at OpenRouter) | ^6.25.0 |
| **PDF Generation** | PDFKit | ^0.17.2 |
| **DOCX Generation** | docx | ^9.6.0 |
| **File Parsing** | pdf-parse, mammoth, xlsx | Various |
| **Auth** | Replit Auth (OpenID Connect via openid-client ^6.8.2) | — |
| **Session Store** | connect-pg-simple | ^10.0.0 |
| **Rate Limiting** | express-rate-limit | ^7.x |
| **CSRF Protection** | Custom HMAC double-submit cookie | — |
| **Cookie Parsing** | cookie-parser | ^1.x |
| **Charts** | Recharts | ^2.15.4 |
| **Animation** | Framer Motion | ^12.23.24 |
| **Build Tool** | esbuild (for production bundle) | ^0.25.0 |

---

## 3. Folder and File Structure

```
caelum/
├── client/
│   ├── index.html                    # HTML entry point with OG/Twitter meta tags
│   └── src/
│       ├── App.tsx                    # Root component, auth-gated routing (wouter)
│       ├── index.css                  # Tailwind v4 config, dark mode custom variant, theme vars
│       ├── main.tsx                   # React DOM entry
│       ├── hooks/
│       │   └── use-auth.ts            # Auth hook for user state
│       ├── lib/
│       │   ├── queryClient.ts         # React Query client config + CSRF token management (fetchCsrfToken, getCsrfToken, apiRequest)
│       │   └── utils.ts              # Tailwind merge utilities
│       ├── pages/
│       │   ├── home.tsx               # Main app: chat, sidebar, SoW viewer/editor, dashboard, exports (~2900 lines)
│       │   └── landing.tsx            # Unauthenticated landing page
│       └── components/ui/             # shadcn/ui component library (button, dialog, toast, etc.)
├── server/
│   ├── index.ts                       # Express app bootstrap, middleware setup (cookie-parser, JSON, logging), server start
│   ├── routes.ts                      # API routes: chat, conversations CRUD, file upload, PDF/DOCX export, AI system prompt + multi-model logic, rate limiting, CSRF middleware
│   ├── tenantConfig.ts                # Central branding/rates config: vendorName, parentCompany, appName, rateCard, mandatoryPmTasks, scopeTypeAddOns, signature labels, confidential footer
│   ├── sowExport.ts                   # PDF (PDFKit) and DOCX (docx lib) generation — detailed + summary formats, all branding from tenantConfig
│   ├── fileExtractor.ts              # Text extraction from uploaded files (PDF, DOCX, XLSX, CSV, etc.)
│   ├── storage.ts                     # IStorage interface + DatabaseStorage implementation
│   ├── db.ts                          # Drizzle PostgreSQL connection pool
│   ├── static.ts                      # Production static file serving
│   ├── vite.ts                        # Dev-mode Vite middleware integration
│   └── replit_integrations/           # Replit-managed integration modules (DO NOT MODIFY)
│       ├── auth/                      # Replit Auth: OIDC login/logout/session (index, replitAuth, routes, storage)
│       ├── chat/                      # Conversation & message CRUD (index, routes, storage)
│       └── batch/                     # Batch utility helpers (index, utils)
├── shared/
│   ├── schema.ts                      # Re-exports all Drizzle schemas
│   ├── branding.ts                    # Client-side branding constants (vendorName, vendorAbbreviation, parentCompany, appName)
│   └── models/
│       ├── auth.ts                    # Users + sessions tables (Drizzle schema)
│       └── chat.ts                    # Conversations, messages, sow_versions tables (Drizzle schema)
├── script/
│   └── build.ts                       # Production build script (Vite frontend + esbuild backend)
├── .agents/skills/docx/              # User skill: DOCX manipulation helpers (Python scripts)
├── drizzle.config.ts                  # Drizzle Kit config for migrations
├── vite.config.ts                     # Vite dev/build config
├── postcss.config.js                  # PostCSS config (Tailwind + autoprefixer)
├── tsconfig.json                      # TypeScript config
├── package.json                       # Dependencies and scripts
├── replit.md                          # Project documentation (always loaded into agent memory)
├── RUNBOOK.md                         # SoW runbook reference document
└── .replit                            # Replit project config (deployment, workflows, ports)
```

---

## 4. Environment Variables in Use

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key (renamed from `OPENAI_API_KEY` in Phase 1) |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | OpenRouter API key (Replit integration) |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | OpenRouter base URL (Replit integration) |
| `SESSION_SECRET` | Express session encryption secret + CSRF HMAC signing key (**required — server throws on startup if unset**) |
| `REPL_ID` | Replit environment identifier |
| `REPLIT_DEPLOYMENT` | Set in production — used to detect production mode for CSRF cookie `secure` flag |
| `REPLIT_DEV_DOMAIN` | Dev domain for Replit preview |
| `REPLIT_INTERNAL_APP_DOMAIN` | Internal app domain |
| `ISSUER_URL` | OIDC issuer URL for Replit Auth |
| `PORT` | Server port (default 5000) |
| `NODE_ENV` | Environment mode (development/production) |
| `HOST` | Server host binding |

---

## 5. Authentication and Authorization

**What exists:**
- **Replit Auth** via OpenID Connect (`openid-client` + Passport). Full login/logout flow.
- Session persistence in PostgreSQL (`sessions` table via `connect-pg-simple`).
- User records stored in `users` table with `id`, `email`, `firstName`, `lastName`, `profileImageUrl`.
- All API routes protected by `isAuthenticated` middleware.
- User ID accessed via `req.user.claims.sub` (Replit OIDC claim).
- Conversation ownership enforced — users can only access their own conversations.
- **CSRF protection** — HMAC-signed double-submit cookie. `GET /api/csrf-token` issues token (set as `x-csrf-token` cookie + returned in JSON body). All POST/PUT/PATCH/DELETE requests must include `X-CSRF-Token` header matching the cookie. Auth routes (`/login`, `/callback`, `/logout`) are exempt. Cookie `secure` flag is environment-aware (true in production, false in dev). Server throws on startup if `SESSION_SECRET` is unset.
- **Rate limiting** — `express-rate-limit`: 60 req/min default on all `/api` routes; 20 req/min strict on `POST /api/chat`. Returns `429 { error, retryAfter }`.

**What's missing:**
- No role-based access control (RBAC) — all authenticated users have equal access.
- No API key authentication for programmatic access.
- No team/organization-level permissions.
- No admin panel or superuser role.
- Session secret is environment-variable based (no rotation mechanism).

---

## 6. Multitenancy Status

**Partial.** Data is scoped per user via `userId` on conversations, but:
- No organization/team concept — purely individual user accounts.
- No tenant isolation at the database level (shared tables, filtered by `userId`).
- **Branding is now abstracted** (Phase 1): server-side values in `server/tenantConfig.ts`, client-side in `shared/branding.ts`. Zero hardcoded vendor strings in routes, exports, or UI components. To rebrand for a different MSP, edit those two files. Phase 2.6 plans to move config values to the database for runtime multi-tenancy.
- All users share the same AI system prompt and SoW template logic (built dynamically from tenantConfig).

---

## 7. UI Theming

**Light + Dark mode implemented:**
- Toggle via Moon/Sun icon in header.
- Persisted to `localStorage` key `caelum-dark-mode`.
- Uses Tailwind v4 `@custom-variant dark (&:is(.dark *))` with `dark` class on `<html>`.
- Dark variants applied to all major structural elements (header, sidebar, chat bubbles, SoW document, modals, export menus, cards, inputs).
- No system-preference auto-detection (no `prefers-color-scheme` media query).
- Color scheme: Blue-600 accent on slate base.

---

## 8. Database Schema

| Table | Columns | Notes |
|-------|---------|-------|
| `users` | `id` (varchar PK), `email` (unique), `firstName`, `lastName`, `profileImageUrl`, `createdAt`, `updatedAt` | Replit Auth managed |
| `sessions` | `sid` (varchar PK), `sess` (jsonb), `expire` (timestamp) | Replit Auth session store, indexed on expire |
| `conversations` | `id` (serial PK), `userId` (text), `title` (text), `sowJson` (jsonb, nullable), `flagged` (boolean), `createdAt`, `updatedAt` | Core data — userId scopes ownership |
| `messages` | `id` (serial PK), `conversationId` (FK → conversations, cascade delete), `role` (text), `content` (text), `createdAt` | Chat messages (user/assistant/system) |
| `sow_versions` | `id` (serial PK), `conversationId` (FK → conversations, cascade delete), `version` (integer), `sowJson` (jsonb), `label` (text), `createdAt` | SoW version snapshots for history/restore |

SoW JSON is stored as JSONB in `conversations.sowJson` — a ~12-section nested object with title, summary, solution, prerequisites, outline (phases), risks, workload estimate, etc.

---

## 9. API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/csrf-token` | Returns CSRF token (double-submit cookie pattern) |
| `POST` | `/api/chat` | Multi-model streaming chat (SSE), auto-creates conversation — rate limited 20/min |
| `GET` | `/api/models` | Returns available AI model roster |
| `POST` | `/api/upload` | File upload (up to 10 files, 20MB each), returns extracted text |
| `GET` | `/api/conversations` | List user's conversations (newest first) |
| `GET` | `/api/conversations/:id` | Load conversation with all messages |
| `DELETE` | `/api/conversations/:id` | Delete conversation and messages |
| `PATCH` | `/api/conversations/:id/flag` | Toggle flagged/favorite status |
| `PATCH` | `/api/conversations/:id/sow` | Save/update SoW JSON + auto-create version snapshot |
| `PATCH` | `/api/conversations/:id/title` | Rename conversation title |
| `GET` | `/api/conversations/:id/versions` | List SoW version snapshots |
| `POST` | `/api/conversations/:id/versions/:vid/restore` | Restore a previous SoW version |
| `POST` | `/api/conversations/:id/export/:format` | Export SoW (pdf, docx, docx-detailed) |
| `DELETE` | `/api/messages/:id` | Delete a single message |
| `DELETE` | `/api/conversations/:id/messages-after/:mid` | Delete messages from a point onward (edit/regenerate) |
| `POST` | `/api/conversations/:id/branch` | Fork conversation from a message |
| `PATCH` | `/api/auth/profile` | Update user profile |
| `GET` | `/api/login` | Start OIDC auth flow |
| `GET` | `/api/logout` | End session |
| `GET` | `/api/auth/user` | Return current user data |

---

## 10. Third-Party Integrations

| Service | SDK/Library | Purpose |
|---------|------------|---------|
| **OpenRouter** | `openai` SDK (base URL overridden) | Multi-model AI — Claude Sonnet 4, GPT-4o, Gemini 2.5 Flash, DeepSeek R1, Llama 4 Maverick |
| **Replit Auth** | `openid-client`, Passport | OIDC authentication |
| **Replit PostgreSQL** | `pg` + Drizzle ORM | Database |
| **Replit Integrations** | Built-in modules | Auth, chat storage, OpenRouter AI config |

No external payment, notification, analytics, or monitoring services connected.

---

## 11. Hardcoded Values That Should Be Configurable

**Resolved in Phase 1 (now abstracted into config):**

| Value | Config Location | Notes |
|-------|----------------|-------|
| `"Dedicated IT"` / `"DIT"` | `server/tenantConfig.ts` (vendorName, vendorAbbreviation) + `shared/branding.ts` | Zero hardcoded instances in routes, exports, or UI |
| `"Cavaridge, LLC"` | `server/tenantConfig.ts` (parentCompany) + `shared/branding.ts` | Dynamic in footers |
| `"Caelum"` | `server/tenantConfig.ts` (appName) + `shared/branding.ts` | Dynamic in headers |
| Copyright year | `home.tsx`, `landing.tsx` | Now uses `new Date().getFullYear()` |
| Role rates ($285, $225, $185) | `server/tenantConfig.ts` (rateCard) | Built dynamically via `buildRateCardString()` |
| `"Dedicated IT — Confidential"` | `server/tenantConfig.ts` (confidentialFooter) | Dynamic in PDF footers |
| 3 mandatory PM tasks | `server/tenantConfig.ts` (mandatoryPmTasks) | Dynamic in system prompt |
| Scope type add-ons | `server/tenantConfig.ts` (scopeTypeAddOns) | Dynamic in system prompt |
| Vendor signature label | `server/tenantConfig.ts` (vendorSignatureLabel) | Dynamic in PDF/DOCX sig blocks |

**Still hardcoded (not in Phase 1 scope):**

| Value | Location | What It Is |
|-------|----------|-----------|
| `#0f172a`, `#2563eb` | `sowExport.ts` (PDF colors), `index.css` (theme) | Primary branding colors |
| Model roster (5 models) | `routes.ts` | Model IDs, labels, strengths, and the routing logic |
| File upload limits (10 files, 20MB) | `routes.ts` | Multer config |

---

## 12. Known Bugs, Incomplete Features, and Technical Debt

| Item | Type | Severity |
|------|------|----------|
| `home.tsx` is ~2,960 lines | Tech Debt | Medium — should be split into components (chat, sidebar, SoW viewer, dashboard, etc.) |
| No system-preference dark mode detection | Incomplete | Low — only manual toggle, no `prefers-color-scheme` |
| Error handling is generic `console.error` + 500 | Tech Debt | Medium — no structured error types or user-facing error detail |
| No input sanitization on SoW JSON fields | Tech Debt | Medium — stored JSONB is trusted from AI output |
| `accessPrerequisites` only rendered when `responsibilityMatrix` exists in viewer | Minor Bug | Low — if a SoW has access prereqs without matrix, they're hidden |
| No image OCR for uploaded images | Incomplete | Low — images noted as "attached" but content not extracted |
| No automated tests | Tech Debt | High — zero unit, integration, or E2E tests |
| DOCX detailed format doesn't use new `responsibilityMatrix` | Gap | Low — detailed format uses traditional 3-list prereqs only |
| Session secret not rotated | Security | Low — single static secret |
| No request body size limits beyond file uploads | Security | Low |

**Resolved in Phase 1:**
- ~~No rate limiting on API endpoints~~ → 60/min default, 20/min on `/api/chat`
- ~~No CSRF protection~~ → HMAC double-submit cookie, all state-changing requests validated
- ~~Copyright year hardcoded to 2026~~ → Dynamic `new Date().getFullYear()`
- ~~All branding hardcoded~~ → Abstracted to `tenantConfig.ts` + `branding.ts`
- ~~CSRF fallback secret~~ → Server throws on missing `SESSION_SECRET`

---

## 13. Production-Ready vs. Prototype/Draft

**Production-Ready:**
- Core chat flow (multi-model AI with streaming)
- SoW generation, parsing, and persistence
- PDF export (polished, cover page, footers, styled tables)
- DOCX export (both summary and detailed formats)
- Authentication (Replit Auth)
- Conversation management (CRUD, search, flag, branch)
- SoW inline editing with undo/redo
- Version history with compare and restore
- Dark mode
- File upload and text extraction
- Dashboard with metrics
- Rate limiting (60/min default, 20/min chat)
- CSRF protection (HMAC double-submit cookie)
- Branding abstraction (tenantConfig + shared branding — rebrandable via config files)

**Prototype/Draft:**
- Multi-tenancy (config is file-based, not DB-driven; no org/team support)
- Error handling and observability
- Testing infrastructure
- Admin/management interface
- Role-based access control

---

## 14. Deployment Status

| Aspect | Status |
|--------|--------|
| **Hosting** | Replit (Autoscale deployment target) |
| **Build Process** | `npm run build` → Vite frontend build + esbuild backend bundle → `dist/` |
| **Production Command** | `node ./dist/index.cjs` |
| **Public Directory** | `dist/public` |
| **Port** | 5000 (mapped to external port 80) |
| **Database** | Replit-managed PostgreSQL 16 |
| **Domain** | `.replit.app` subdomain (or custom domain if configured) |
| **CI/CD** | None — manual deploy via Replit's publish button |
| **Monitoring** | None — no APM, error tracking, or log aggregation |
| **Backups** | Replit checkpoint system only |
| **Environment Config** | Replit Secrets for env vars |
