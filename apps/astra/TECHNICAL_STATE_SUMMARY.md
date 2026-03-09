# Astra — Technical State Summary

**Generated**: March 3, 2026

---

## 1. Project Name and Primary Purpose

**Astra** by **Cavaridge, LLC** — A full-stack Microsoft 365 License & Usage Insights SaaS dashboard. Users sign in via Replit Auth, optionally connect Microsoft 365 via OAuth to pull tenant data (or upload CSV/XLSX exports). The platform provides usage-aware licensing optimization with per-user recommendations, AI-powered executive briefings (PDF/PNG export), personalized greetings, interactive tutorials, M365 news feed, and a license comparison guide.

---

## 2. Current Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Language** | TypeScript | 5.6.3 |
| **Runtime** | Node.js | 20.x (NixOS module) |
| **Frontend Framework** | React | 19.2.0 |
| **Build Tool** | Vite | 7.1.9 |
| **CSS** | Tailwind CSS v4 | 4.1.14 |
| **UI Components** | shadcn/ui (Radix primitives) | Various @radix-ui/* |
| **Backend Framework** | Express.js | 5.0.1 |
| **Database** | PostgreSQL | 16.x (NixOS module) |
| **ORM** | Drizzle ORM | 0.39.3 |
| **Schema Validation** | Zod + drizzle-zod | 3.25.76 / 0.7.1 |
| **Client State** | TanStack React Query | 5.60.5 |
| **Routing (FE)** | wouter | 3.3.5 |
| **Auth (App)** | Replit Auth (OIDC) via openid-client + Passport | 6.8.2 / 0.7.0 |
| **Auth (M365)** | Microsoft OAuth2 (manual implementation) | N/A (raw fetch) |
| **AI** | OpenRouter via OpenAI SDK | openai 6.25.0 |
| **Excel Export** | xlsx (SheetJS) | 0.18.5 |
| **PDF/PNG Export** | html2canvas + jsPDF | 1.4.1 / 4.2.0 |
| **File Upload** | multer | 2.0.2 |
| **Session Store** | connect-pg-simple | 10.0.0 |
| **Animations** | Framer Motion | 12.23.24 |
| **Charts** | Recharts | 2.15.4 |
| **Date Utils** | date-fns | 3.6.0 |
| **Fonts** | Plus Jakarta Sans + Inter (Google Fonts CDN) | — |

---

## 3. Folder and File Structure

```
/
├── .replit                           — Replit config: modules, ports, deployment, workflows
├── package.json                      — Dependencies and scripts (dev, build, start, db:push)
├── tsconfig.json                     — TypeScript config with @/ and @shared/ path aliases
├── vite.config.ts                    — Vite config with React, Tailwind, path aliases, dev plugins
├── vite-plugin-meta-images.ts        — Custom Vite plugin for OG image handling
├── drizzle.config.ts                 — Drizzle Kit config (PostgreSQL, schema path)
├── postcss.config.js                 — PostCSS config (empty plugins — Tailwind v4 via Vite plugin)
├── components.json                   — shadcn/ui component configuration
├── replit.md                         — Project documentation and architecture notes
├── RUNBOOK.md                        — Operational runbook
├── script/
│   └── build.ts                      — Production build script (esbuild for server, vite for client)
│
├── shared/
│   ├── schema.ts                     — Drizzle ORM table definitions (reports, executiveSummaries, microsoftTokens, loginHistory)
│   └── models/
│       ├── auth.ts                   — Auth user type definitions
│       └── chat.ts                   — Chat model types (for AI integration scaffolding)
│
├── server/
│   ├── index.ts                      — Express app setup, middleware, session, error handling, server start
│   ├── routes.ts                     — All API route definitions (1,072 lines)
│   ├── storage.ts                    — IStorage interface + DatabaseStorage implementation
│   ├── db.ts                         — Database connection (Drizzle + pg pool)
│   ├── static.ts                     — Production static file serving
│   ├── vite.ts                       — Dev-mode Vite middleware setup
│   ├── microsoft-graph.ts            — Microsoft Graph API client (OAuth, users, mailbox, activity, SKUs)
│   ├── sku-map.ts                    — SKU part number → display name + cost mapping (155 entries)
│   └── replit_integrations/
│       ├── auth/
│       │   ├── index.ts              — Auth exports
│       │   ├── replitAuth.ts         — Replit Auth OIDC setup (Passport strategy, session, middleware)
│       │   ├── routes.ts             — Auth route registration
│       │   └── storage.ts            — Auth user storage (upsert)
│       ├── chat/
│       │   ├── index.ts              — Chat integration exports
│       │   ├── routes.ts             — Chat API routes
│       │   └── storage.ts            — Chat storage
│       ├── audio/
│       │   ├── index.ts              — Audio integration exports
│       │   ├── client.ts             — Audio client
│       │   └── routes.ts             — Audio routes
│       ├── image/
│       │   ├── index.ts              — Image integration exports
│       │   ├── client.ts             — Image client
│       │   └── routes.ts             — Image routes
│       └── batch/
│           ├── index.ts              — Batch integration exports
│           └── utils.ts              — Batch utilities
│
├── client/
│   ├── index.html                    — HTML entry point with OG/Twitter meta tags, Google Fonts
│   └── src/
│       ├── main.tsx                  — React DOM root render
│       ├── index.css                 — Global styles, Tailwind imports, custom CSS animations
│       ├── App.tsx                   — Route registration (/, /licenses, /report/:id/summary)
│       ├── pages/
│       │   ├── landing.tsx           — Landing page for unauthenticated users (hero, features, CTA)
│       │   ├── dashboard.tsx         — Main dashboard (2,848 lines — KPIs, strategy engine, data table, uploads, overrides)
│       │   ├── executive-summary.tsx — AI briefing viewer with SSE streaming, PDF/PNG export
│       │   ├── license-comparison.tsx— Side-by-side license comparison (up to 3)
│       │   └── not-found.tsx         — 404 page
│       ├── hooks/
│       │   ├── use-auth.ts           — Replit Auth React hook (user, isAuthenticated, logout)
│       │   └── use-toast.ts          — Toast notification hook
│       ├── lib/
│       │   ├── api.ts                — API client functions (auth, upload, reports, sync, subscriptions)
│       │   ├── license-data.ts       — 65-license feature dataset with 8 feature categories (1,961 lines)
│       │   ├── queryClient.ts        — TanStack React Query client config
│       │   ├── auth-utils.ts         — Auth error handling utilities
│       │   └── utils.ts              — Utility functions (cn classname merger)
│       └── components/ui/            — shadcn/ui component library (30+ components)
```

---

## 4. Environment Variables Currently in Use

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-provisioned by Replit) |
| `MICROSOFT_CLIENT_ID` | Azure AD Application (Client) ID for M365 OAuth |
| `MICROSOFT_CLIENT_SECRET` | Azure AD Client Secret for M365 OAuth |
| `MICROSOFT_TENANT_ID` | Azure AD Tenant ID (read but unused — hardcoded to `"common"` for multi-tenant) |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI executive summaries |
| `SESSION_SECRET` | Express session secret (auto-generated by Replit Auth integration) |
| `REPL_ID` | Replit environment identifier (used as OIDC client ID) |
| `ISSUER_URL` | OIDC issuer URL (defaults to `https://replit.com/oidc`) |
| `PORT` | Server port (defaults to `5000`) |
| `NODE_ENV` | Environment mode (`development` / `production`) |

---

## 5. Authentication and Authorization

### What Exists
- **App-level auth**: Replit Auth via OpenID Connect (Passport.js strategy). Supports Google, GitHub, Apple, and email sign-in. Session stored in PostgreSQL via `connect-pg-simple`. Session TTL: 7 days. Token refresh is handled automatically.
- **M365 OAuth**: Separate Microsoft OAuth2 flow for tenant data access. Uses `https://login.microsoftonline.com/common` (multi-tenant). Scopes: `User.Read`, `User.Read.All`, `Reports.Read.All`, `Organization.Read.All`, `offline_access`. Access tokens stored in `microsoft_tokens` DB table keyed by session ID. Token refresh implemented via `refreshAccessToken()`.
- **Route protection**: `isAuthenticated` middleware on all `/api/*` routes (except auth flow endpoints). Checks token expiry and attempts refresh.

### What's Missing
- **Role-based access control (RBAC)**: No admin vs. regular user distinction. All authenticated users have equal access.
- **Organization/tenant isolation**: No server-side tenant scoping — any authenticated user can access any report in the database (reports are not scoped to a user or organization).
- **CSRF protection**: No CSRF tokens on state-mutating endpoints.
- **Rate limiting**: No rate limiting on API endpoints or AI generation.
- **Microsoft token encryption**: Access/refresh tokens stored as plaintext in the database.

---

## 6. Multitenancy Status

**Absent.** The application has no multitenancy implementation:
- Reports (`reports` table) have no `userId`, `tenantId`, or `organizationId` column — all reports are globally visible to any authenticated user.
- Microsoft OAuth tokens are session-scoped but not user-scoped. If two users share a session store bug, they could theoretically access each other's M365 data.
- Login history tracks `userEmail` and `tenantId` but this is informational only (greeting system), not used for data isolation.
- The `GET /api/reports` endpoint returns all reports in the database regardless of who created them.

---

## 7. UI Theming

- **Light mode only** — implemented. The app uses a light color scheme with CSS custom properties for colors.
- **Dark mode** — `next-themes` package is installed as a dependency but **not wired up**. The Tailwind CSS uses `dark:` variant classes throughout the codebase (e.g., `dark:bg-blue-950/20`, `dark:text-blue-300`), suggesting dark mode was planned but the theme provider is not configured in `App.tsx`.
- **System mode** — Not implemented. No `ThemeProvider` wrapper exists in the component tree.
- **Design system**: Enterprise Minimalist — Plus Jakarta Sans (headings), Inter (body), Microsoft blue (`#0078d4`) as primary accent.

---

## 8. Database Schema / Data Model

**PostgreSQL via Drizzle ORM** — 5 tables total:

| Table | Columns | Purpose |
|---|---|---|
| `reports` | `id` (serial PK), `name`, `strategy`, `commitment`, `user_data` (JSONB), `custom_rules` (JSONB), `created_at` | Saved report snapshots with full user dataset and strategy config |
| `executive_summaries` | `id` (serial PK), `report_id` (FK → reports, cascade delete), `content` (text), `cost_current`, `cost_security`, `cost_saving`, `cost_balanced`, `cost_custom`, `commitment`, `created_at` | AI-generated executive briefings linked to reports |
| `microsoft_tokens` | `id` (serial PK), `session_id` (unique), `access_token`, `refresh_token`, `expires_at`, `tenant_id`, `user_email`, `user_name`, `created_at` | Microsoft OAuth tokens per session |
| `login_history` | `id` (serial PK), `user_email`, `user_name`, `tenant_id`, `login_at` | Login tracking for personalized greetings |
| `sessions` | (auto-created by connect-pg-simple) `sid`, `sess` (JSON), `expire` | Express session store |

**Client-side data model** (not persisted, runtime only):
- `UserRow` — display name, UPN, department, job title, city, country, licenses[], usageGB, maxGB, status, activity (UserActivity or null)
- `UserActivity` — per-service active/inactive flags + last activity dates for Exchange, OneDrive, SharePoint, Teams, Yammer, Skype

---

## 9. API Endpoints

### Replit Auth (managed by integration)
| Method | Path | Description |
|---|---|---|
| GET | `/api/login` | Initiate Replit Auth OIDC login |
| GET | `/api/callback` | OIDC callback handler |
| GET | `/api/logout` | Logout + end session |
| GET | `/api/auth/user` | Get current authenticated user |

### Microsoft 365 OAuth
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/microsoft/status` | Check M365 OAuth connection status |
| GET | `/api/auth/microsoft/login` | Start M365 OAuth flow (returns auth URL) |
| GET | `/api/auth/microsoft/callback` | M365 OAuth redirect handler |
| POST | `/api/auth/microsoft/disconnect` | Clear M365 OAuth session |

### Data Sync & Upload
| Method | Path | Description |
|---|---|---|
| GET | `/api/microsoft/sync` | Fetch users + mailbox via Graph API |
| GET | `/api/microsoft/report/active-users` | Office 365 Active User Detail report |
| GET | `/api/microsoft/subscriptions` | Fetch tenant subscribed SKUs |
| POST | `/api/upload/users` | Parse uploaded Active Users CSV/XLSX |
| POST | `/api/upload/mailbox` | Parse uploaded Mailbox Usage CSV/XLSX |
| POST | `/api/upload/activity` | Parse uploaded Active User Detail CSV/XLSX |

### Reports & AI
| Method | Path | Description |
|---|---|---|
| GET | `/api/reports` | List all saved reports |
| POST | `/api/reports` | Save a report snapshot |
| DELETE | `/api/reports/:id` | Delete a report |
| GET | `/api/reports/:id/summary` | Get saved executive summary |
| POST | `/api/reports/:id/summary` | Generate AI executive summary (SSE streaming) |

### Misc
| Method | Path | Description |
|---|---|---|
| GET | `/api/user/greeting` | Personalized greeting based on login history |
| GET | `/api/insights/news` | M365 licensing news feed (RSS, 5-min cache) |

---

## 10. Third-Party Integrations

| Service | SDK / Method | Purpose |
|---|---|---|
| **Replit Auth** | openid-client + Passport.js (OIDC) | App-level authentication |
| **Microsoft Graph API** | Raw `fetch` against `graph.microsoft.com/v1.0` and `/beta` | User data, mailbox usage, active user reports, subscribed SKUs |
| **Microsoft OAuth2** | Raw `fetch` against `login.microsoftonline.com/common` | M365 tenant authorization |
| **OpenRouter** | OpenAI SDK (`openai` package) pointed at `https://openrouter.ai/api/v1` | AI executive briefings (model: `anthropic/claude-sonnet-4`) |
| **Google Fonts** | CDN link in `index.html` | Plus Jakarta Sans + Inter typefaces |
| **Microsoft 365 Blog RSS** | Server-side fetch + XML parse | Industry insights news feed |

---

## 11. Hardcoded Values That Should Be Configurable

| Value | Location | Current Value | Recommendation |
|---|---|---|---|
| `LICENSE_COSTS` map | `dashboard.tsx:720` | 45+ hardcoded license-to-cost mappings | Move to shared config or database; costs change annually |
| `SKU_COST_MAP` | `server/sku-map.ts` | 155 SKU part number-to-cost mappings | Same as above — centralize with LICENSE_COSTS |
| Annual commitment multiplier | `dashboard.tsx:1270` | `0.85` (15% discount) | Should be configurable; actual discounts vary by agreement |
| `SECURITY_DEPTS` set | `dashboard.tsx:772` | `["IT", "Engineering", "Compliance", "Security", "InfoSec"]` | Organization-specific; should be user-configurable |
| `SUITE_LICENSES` set | `dashboard.tsx:764` | Hardcoded list of suite license names | Should derive from license-data.ts |
| AI model | `server/routes.ts` | `anthropic/claude-sonnet-4` | Could be an env var or user preference |
| AI temperature | `server/routes.ts` | `0.4` | Could be configurable |
| AI max tokens | `server/routes.ts` | `8192` | Could be configurable |
| Session TTL | `replitAuth.ts:22` | 7 days | Could be an env var |
| RSS feed URL | `server/routes.ts` | Microsoft 365 blog RSS URL | Could be configurable for different news sources |
| OAuth authority | `microsoft-graph.ts:35` | `login.microsoftonline.com/common` | Correct for multi-tenant, but single-tenant deployments may want tenant-specific |
| Graph API scopes | `microsoft-graph.ts:4-9` | 5 hardcoded scopes | Could be configurable for different permission levels |
| Copyright text | `dashboard.tsx`, `landing.tsx` | `"© 2026 Cavaridge, LLC"` | Client-specific branding |
| App name "Astra" | Multiple files | Hardcoded in UI | Client-specific branding |

---

## 12. Known Bugs, Incomplete Features, and Technical Debt

### Bugs
- **No tenant isolation on reports**: Any authenticated user can see/delete any other user's reports. Critical security gap.
- **`usersWithActivity` computed inside strategy block**: The `usersWithActivity` variable used for recommendations is declared inside the Custom strategy rendering block and may error if referenced before the strategy is set to Custom.

### Incomplete Features
- **Dark mode**: `next-themes` installed, `dark:` classes used throughout, but no `ThemeProvider` wired up — dark mode is non-functional.
- **Manual overrides not persisted**: Lock/exclude states are client-side only (`useState`) — lost on page refresh. Should be saved with reports or to localStorage.
- **Chat/Audio/Image integrations**: Scaffold code exists under `server/replit_integrations/` but none are wired into the UI or used.
- **`users` table**: Referenced in `shared/models/auth.ts` for Replit Auth user storage but is a minimal placeholder (id, email, name, profile image).

### Technical Debt
- **`dashboard.tsx` is 2,848 lines**: Contains the strategy engine, all UI rendering, data parsing, role classification, override management, recommendations, and more. Should be decomposed into separate modules (strategy engine, table component, filter bar, KPI cards, etc.).
- **Duplicate license cost data**: Costs are defined in both `LICENSE_COSTS` (client) and `SKU_COST_MAP` (server) with potential drift. Should be a single source of truth.
- **No automated tests**: Zero unit, integration, or E2E tests.
- **No input sanitization**: CSV/XLSX parsing trusts file content without sanitization.
- **No pagination**: User table loads all data at once — will degrade with large tenants (1,000+ users).
- **No error boundaries**: React error boundaries are not implemented — a component crash takes down the entire app.
- **OAuth state parameter**: Generated but stored only in session (`oauthState`) — not validated with cryptographic binding.
- **Microsoft tokens as plaintext**: Access and refresh tokens stored unencrypted in PostgreSQL.

---

## 13. Production-Ready vs. Prototype/Draft

### Production-Ready
- Replit Auth integration (session management, token refresh, logout)
- Microsoft OAuth2 flow (multi-tenant, token storage, refresh)
- Graph API data pipeline (users, mailbox, activity reports, subscribed SKUs)
- CSV/XLSX file parsing with smart column detection
- Strategy engine (Current, Security, Cost, Balanced, Custom with full rule configuration)
- License comparison guide (65 licenses, 8 feature categories)
- XLSX export
- PDF/PNG export (dashboard and executive briefing)
- AI executive briefing with SSE streaming
- Personalized greetings (login history tracking)
- Interactive tutorial system

### Prototype / Draft
- **Multitenancy** — absent (critical for SaaS)
- **RBAC** — absent (no admin/user roles)
- **Dark mode** — wired with CSS classes but not functional
- **Manual overrides** — client-only state, not persisted
- **Strategic recommendations** (CRM, mobile app, activity dashboard) — informational labels only, no implementation behind them
- **Chat/Audio/Image integrations** — scaffold only, not connected
- **Error handling** — basic; no error boundaries, no structured error reporting

---

## 14. Deployment Status

### Hosting
- **Platform**: Replit (NixOS container)
- **Deployment target**: Autoscale (`deploymentTarget = "autoscale"` in `.replit`)
- **Database**: Replit-managed PostgreSQL 16

### Deployment Process
1. **Build**: `npm run build` — runs `script/build.ts` which:
   - Bundles server with esbuild → `dist/index.cjs` (CommonJS)
   - Bundles client with Vite → `dist/public/`
2. **Run**: `node ./dist/index.cjs` (production mode)
3. **Public directory**: `dist/public` (served as static files in production)
4. **Port**: 5000 internally → mapped to port 80 externally

### Current State
- Development server running via `npm run dev` (Vite dev server proxied through Express)
- Production deployment configured and published (autoscale)
- Schema sync via `npm run db:push` (Drizzle Kit push, no migration files)
