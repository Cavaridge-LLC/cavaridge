# Technical State Summary — Ceres

## 1. Project Name and Primary Purpose

**Ceres** — A Medicare 60-Day Visit Frequency Calculator for home health services. Helps clinical staff plan and schedule patient visits within the 60-day certification period following CMS CY 2026 Guidelines and the PDGM (Patient-Driven Groupings Model). Owned by **Cavaridge, LLC**.

---

## 2. Current Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | 20.x |
| **Language** | TypeScript | 5.6.3 |
| **Web Framework** | Express.js | ^5.0.1 |
| **Frontend Framework** | React | ^19.2.0 |
| **Bundler** | Vite | ^7.1.9 |
| **Bundler (direct dep)** | Rollup | ^2.80.0 |
| **Bundler (vite internal)** | Rollup | 4.59.0 |
| **CSS** | Tailwind CSS v4 | ^4.1.14 |
| **UI Components** | shadcn/ui (Radix primitives) | Various |
| **Routing (client)** | Wouter | ^3.3.5 |
| **Data Fetching** | TanStack React Query | ^5.60.5 |
| **Forms** | React Hook Form + Zod | ^7.66.0 / ^3.25.76 |
| **Date Utils** | date-fns | ^3.6.0 |
| **Animation** | Framer Motion | ^12.23.24 |
| **Theming** | next-themes | ^0.4.6 |
| **AI SDK** | OpenAI (via OpenRouter) | ^6.25.0 |
| **ORM** | Drizzle ORM | ^0.39.3 |
| **Database** | PostgreSQL | 16 (provisioned but unused) |
| **Mobile** | Expo / React Native | ^55.0.3 / ^0.84.0 |
| **Mobile Router** | Expo Router | ^55.0.3 |
| **Build (server)** | esbuild | ^0.25.0 |
| **Dev runner** | tsx | ^4.20.5 |

---

## 3. Folder and File Structure

```
.
├── client/                          # Web frontend (React SPA)
│   ├── index.html                   # HTML entry point with OG meta tags
│   ├── public/
│   │   ├── favicon.png              # App favicon
│   │   └── opengraph.jpg            # OG image for social sharing
│   ├── replit_integrations/
│   │   └── audio/                   # Audio playback/recording utilities (Replit integration)
│   │       ├── audio-playback-worklet.js
│   │       ├── audio-utils.ts
│   │       ├── index.ts
│   │       ├── useAudioPlayback.ts
│   │       ├── useVoiceRecorder.ts
│   │       └── useVoiceStream.ts
│   └── src/
│       ├── App.tsx                  # Root component with wouter routing
│       ├── main.tsx                 # React DOM entry point
│       ├── index.css                # Tailwind v4 imports + theme variables
│       ├── components/
│       │   ├── CalendarExport.tsx    # .ics and CSV export functionality
│       │   ├── IntervalScheduler.tsx # Every-N-days / specific-weekdays scheduling
│       │   ├── PlanComparison.tsx    # Side-by-side plan comparison + save button
│       │   ├── SmartScheduler.tsx    # Clinically-optimized auto-scheduling algorithm
│       │   ├── Timeline.tsx         # Visual 60-day episode timeline with visit dots
│       │   └── ui/                  # ~50 shadcn/ui primitives (button, card, dialog, etc.)
│       ├── hooks/
│       │   ├── use-mobile.tsx       # Responsive breakpoint hook
│       │   └── use-toast.ts         # Toast notification hook
│       ├── lib/
│       │   ├── queryClient.ts       # TanStack Query client setup
│       │   └── utils.ts             # cn() class merge utility
│       └── pages/
│           ├── Home.tsx             # Main calculator page (5 tabs: Visual, Frequency, Interval, Input, EMR Scan)
│           └── not-found.tsx        # 404 page
│
├── server/                          # Express backend
│   ├── index.ts                     # Express app setup, HTTP server, logging middleware
│   ├── routes.ts                    # API route: POST /api/scan-schedule (OpenRouter GPT-4o vision)
│   ├── storage.ts                   # Empty IStorage interface + MemStorage (no DB operations)
│   ├── static.ts                    # Production static file serving
│   ├── vite.ts                      # Vite dev server middleware integration
│   └── replit_integrations/         # Replit AI integration scaffolding
│       ├── audio/                   # Voice/audio conversation routes + client
│       ├── batch/                   # Batch processing utilities
│       ├── chat/                    # Chat conversation routes + storage
│       └── image/                   # Image generation routes + client
│
├── shared/                          # Shared types between client and server
│   ├── schema.ts                    # Zod schemas: scanScheduleRequest/Response
│   └── models/
│       └── chat.ts                  # Chat message/conversation types (Replit integration)
│
├── mobile/                          # Expo React Native app
│   ├── app/
│   │   ├── _layout.tsx              # Root layout with theme provider
│   │   └── index.tsx                # Main calculator screen (4 tabs)
│   ├── components/
│   │   ├── calendar-grid.tsx        # Native calendar grid component
│   │   ├── episode-info.tsx         # Episode info display
│   │   ├── frequency-card.tsx       # Frequency order card
│   │   ├── scan-tab.tsx             # EMR scan tab (camera/upload)
│   │   ├── theme-context.tsx        # React Native theme provider
│   │   └── week-row.tsx             # Weekly visit row component
│   ├── utils/
│   │   ├── episode.ts              # Episode calculation + frequency parser
│   │   └── theme.ts                # Light/dark theme color definitions
│   ├── app.json                    # Expo config (bundle ID: com.cavaridge.ceres)
│   ├── package.json                # Mobile-specific dependencies
│   └── tsconfig.json               # Mobile TypeScript config
│
├── script/
│   └── build.ts                    # Production build script (Vite client + esbuild server)
│
├── vite.config.ts                  # Vite configuration (plugins, aliases, dev server)
├── vite-plugin-meta-images.ts      # Custom Vite plugin for OG image tag injection
├── postcss.config.js               # PostCSS config (tailwindcss + autoprefixer)
├── drizzle.config.ts               # Drizzle Kit config (PostgreSQL, migrations)
├── tsconfig.json                   # Root TypeScript config
├── components.json                 # shadcn/ui configuration
├── package.json                    # Dependencies and scripts
├── package-lock.json               # Lockfile
├── app.json                        # Root app config
├── replit.md                       # Project documentation
├── RUNBOOK.md                      # Operational runbook
├── .replit                         # Replit environment configuration
└── .gitignore                      # Git ignore rules
```

---

## 4. Environment Variables Currently in Use

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | API key for OpenRouter (GPT-4o vision) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API key for Replit AI integrations |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Base URL for Replit AI integrations |
| `DATABASE_URL` | PostgreSQL connection string (Drizzle config) |
| `NODE_ENV` | Runtime environment (`development` / `production`) |
| `PORT` | Server port (defaults to `5000`) |
| `REPL_ID` | Replit environment identifier |
| `REPLIT_DEV_DOMAIN` | Replit dev preview domain |
| `REPLIT_INTERNAL_APP_DOMAIN` | Replit deployed app domain |

---

## 5. Authentication and Authorization

**Status: Not implemented.**

- No Passport.js session configuration despite `passport` and `passport-local` being in dependencies.
- No `express-session` middleware is initialized.
- No login, signup, or logout routes exist.
- No auth middleware or route guards on any endpoint.
- No user model or identity-related schema fields.
- All API endpoints are publicly accessible.
- The client has no protected routes or auth context.

**What's missing for a complete implementation:**
- Session/JWT setup and user model
- Login/signup/logout routes
- Auth middleware for protected endpoints
- Client-side auth state management and route protection

---

## 6. Multitenancy Status

**Status: Absent.**

- No `tenant_id`, `org_id`, or `user_id` fields in any schema.
- No data isolation or scoping logic.
- The application is designed as a single-user/public-access calculator tool.
- The Replit integration routes (chat, audio) return all data globally without any user filtering.

---

## 7. UI Theming

**Status: Fully implemented (Light/Dark/System).**

- Uses `next-themes` with `ThemeProvider` wrapping the app.
- System preference is the default; manual toggle button in the header.
- Tailwind CSS v4 with CSS custom properties for theme colors (defined in `client/src/index.css`).
- Dark mode uses the `@custom-variant dark (&:is(.dark *))` selector.
- Mobile app has its own theme system via `mobile/components/theme-context.tsx` with color definitions in `mobile/utils/theme.ts`.

---

## 8. Database Schema / Data Model Summary

**No database tables are defined.** The PostgreSQL module is provisioned but the application is stateless.

`shared/schema.ts` defines only Zod validation schemas (not Drizzle tables):

| Schema | Fields | Purpose |
|---|---|---|
| `scanScheduleRequestSchema` | `image` (string), `socDate` (string) | Validates EMR scan API request |
| `scanScheduleResponseSchema` | `visits` (number[9]), `notes` (string), `confidence` (enum: high/medium/low) | Validates AI scan response |

The `IStorage` interface and `MemStorage` class in `server/storage.ts` are empty shells with no methods.

The Replit chat integration uses an in-memory `Map` for conversation storage (`server/replit_integrations/chat/storage.ts`).

---

## 9. API Endpoints / Routes Currently Defined

### Application Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/scan-schedule` | Accepts base64 image + SOC date, uses GPT-4o vision via OpenRouter to extract visit schedule from EMR screenshots |

### Replit Integration Routes (Scaffolded)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/conversations` | List all conversations (chat/audio) |
| `GET` | `/api/conversations/:id` | Get single conversation |
| `POST` | `/api/conversations` | Create new conversation |
| `DELETE` | `/api/conversations/:id` | Delete conversation |
| `POST` | `/api/conversations/:id/messages` | Send message to conversation |
| `POST` | `/api/generate-image` | Generate image via AI |

---

## 10. Third-Party Integrations

| Service | SDK/Package | Usage |
|---|---|---|
| **OpenRouter** | `openai` SDK with custom base URL | EMR schedule image analysis (GPT-4o vision) in `server/routes.ts` |
| **Replit AI Integrations** | `openai` SDK with Replit-provided keys | Chat, audio, and image generation modules (scaffolded) |
| **Google Fonts** | CDN link in `index.html` | Inter font family |

---

## 11. Hardcoded Values That Should Be Configurable

| Value | Location | Current Value | Recommendation |
|---|---|---|---|
| API base URL (mobile) | `mobile/app/index.tsx:18` | `"https://ceres.replit.app"` | Use environment variable or config |
| API URL placeholder | `mobile/components/scan-tab.tsx:8` | `"__API_URL__"` | Implement build-time substitution |
| OpenRouter base URL | `server/routes.ts:8` | `"https://openrouter.ai/api/v1"` | Move to environment variable |
| AI model name | `server/routes.ts:55` | `"openai/gpt-4o"` | Make configurable |
| Chat AI model | `server/replit_integrations/chat/routes.ts:85` | `"gpt-5.1"` | Verify and make configurable |
| Episode duration | `server/routes.ts` | `60` days (hardcoded in logic) | Extract as constant/config |
| ICS event time | `client/src/components/CalendarExport.tsx:56-57` | `9:00 AM – 9:30 AM` | Make user-configurable |
| CMS documentation URL | `client/src/pages/Home.tsx:395` | Full CMS URL | Extract to config |
| JSON body size limit | `server/index.ts:17` | `"20mb"` | Move to config |

---

## 12. Known Bugs, Incomplete Features, and Technical Debt

### Bugs
- **Browser console error** (previously observed): `Cannot access 'parsedFrequency' before initialization` in `Home.tsx` — a temporal dead zone issue with variable declaration ordering.
- **Invalid hook call error** (previously observed): Possible duplicate React instances or mismatched versions.

### Incomplete Features
- **Database**: PostgreSQL is provisioned and Drizzle ORM is configured, but no tables or migrations exist. The storage interface is empty.
- **Authentication**: Passport.js and express-session are in dependencies but completely unconfigured.
- **Replit integrations** (chat, audio, image): Routes are scaffolded but appear to be generic templates, not tailored to the app's domain.
- **Mobile EMR scan**: The `__API_URL__` placeholder in `scan-tab.tsx` is not being substituted.

### Technical Debt
- `rollup@2.80.0` is installed as a direct dependency for security compliance, but Vite internally still uses `rollup@4.59.0`. The two coexist without conflict, but the transitive rollup is not actually replaced.
- `@tailwindcss/postcss` and `@tailwindcss/vite` are both installed — only `@tailwindcss/vite` is actively used in the Vite config. The PostCSS version is redundant.
- Unused dependencies in `package.json`: `passport`, `passport-local`, `express-session`, `connect-pg-simple`, `memorystore`, `drizzle-orm`, `drizzle-zod`, `pg`, and multiple Expo/React Native packages in the web app's package.json.
- The `postcss.config.js` references `tailwindcss` and `autoprefixer` plugins, but Tailwind processing is handled by `@tailwindcss/vite` — the PostCSS config may be redundant.
- No test suite exists.

---

## 13. Production-Ready vs. Prototype/Draft

### Production-Ready
- Core calculator logic (frequency parsing, episode timeline, visual calendar, interval scheduling)
- Smart scheduling algorithm with clinical rationale
- Calendar export (.ics / CSV)
- Plan comparison feature
- Light/dark theme system
- EMR scan via OpenRouter (functional when API key is set)
- Production build pipeline (Vite + esbuild)
- Deployment configuration

### Prototype / Draft
- Mobile Expo app (functional but uses hardcoded API URL, no build/release pipeline)
- Replit AI integration modules (chat, audio, image) — generic scaffolding, not integrated into the app's UI
- Database/storage layer — provisioned but empty
- Authentication system — dependencies installed but nothing implemented
- Audio recording/playback utilities — present but not connected to any feature

---

## 14. Deployment Status

| Aspect | Details |
|---|---|
| **Hosting** | Replit (Autoscale deployment) |
| **Production URL** | `https://ceres.replit.app` |
| **Deployment target** | `autoscale` |
| **Build command** | `npm run build` (Vite client build + esbuild server bundle) |
| **Run command** | `node ./dist/index.cjs` |
| **Public directory** | `dist/public` |
| **Output format** | Server bundled as single CJS file (`dist/index.cjs`), client as static assets (`dist/public/`) |
| **Dev workflow** | `npm run dev` → `tsx server/index.ts` with Vite middleware on port 5000 |
| **Port** | 5000 (mapped to external port 80) |
| **Status** | Published and live |
