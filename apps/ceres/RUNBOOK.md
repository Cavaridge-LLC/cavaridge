# Ceres — Operations Runbook v1.1

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [File Map](#2-file-map)
3. [Database Schema](#3-database-schema)
4. [API Routes](#4-api-routes)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Environment Variables & Secrets](#6-environment-variables--secrets)
7. [Frontend Navigation](#7-frontend-navigation)
8. [Mobile App](#8-mobile-app)
9. [Operational Troubleshooting](#9-operational-troubleshooting)

---

## 1. System Overview

Ceres is a clinical home health care visit frequency calculator for Medicare 60-day certification periods (CMS CY 2026). Given a Start of Care (SOC) date, it calculates a dynamic 9–10 week episode window using Sunday–Saturday calendar weeks and supports five input modes: visual calendar picker, frequency notation input (e.g., "1W1, 3W8"), custom interval scheduler (every N days or specific weekdays), manual weekly entry, and AI-powered EMR schedule image scanning (auto-detects SOC date from WellSky/Kinnser and other EMR systems). The app generates clinical frequency notation with one-click copy, provides smart scheduling with clinical rationale, exports visit plans as .ics/CSV, shows a visual 60-day timeline, and supports side-by-side plan comparison. It is available as both a web app and a native mobile app (Expo/React Native).

### Architecture

| Layer | Technology |
|-------|-----------|
| Web Frontend | React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui + wouter |
| Mobile Frontend | Expo (React Native) + Expo Router + Expo Image Picker |
| Backend | Express.js 5 (Node.js) |
| Database | None — pure calculator, no persistence |
| AI | OpenRouter API (GPT-4o vision) for EMR schedule scanning |
| Theme | Light/dark mode (system default) via next-themes (web) / useColorScheme (mobile) |

### Branding

| Property | Value |
|----------|-------|
| App Name | Ceres |
| Owner | Cavaridge, LLC |
| Bundle ID | com.cavaridge.ceres |
| Copyright | © 2026 Cavaridge, LLC. All rights reserved. |

---

## 2. File Map

### Server Files (`server/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~103 | App bootstrap, middleware, HTTP server, Vite dev integration |
| `routes.ts` | ~100 | `/api/scan-schedule` endpoint — OpenRouter GPT-4o vision call |
| `vite.ts` | ~58 | Vite dev server middleware setup |
| `storage.ts` | ~5 | Empty storage interface (no DB needed) |

### Client Files (`client/`)

| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/Home.tsx` | ~940 | Main calculator page — SOC input, 5 tabs (visual/frequency/interval/manual/scan), frequency output, timeline, plan comparison |
| `src/components/IntervalScheduler.tsx` | ~245 | Custom visit interval scheduling — "every N days" or "specific weekdays" mode |
| `src/components/SmartScheduler.tsx` | ~168 | Smart scheduling algorithm (consistent weekday patterns, spacing, front-loading) + rationale display |
| `src/components/CalendarExport.tsx` | ~140 | Export visit dates as .ics (iCalendar) or CSV file download |
| `src/components/Timeline.tsx` | ~217 | Collapsible horizontal 60-day episode timeline with week/period boundaries and visit dots |
| `src/components/PlanComparison.tsx` | ~229 | Side-by-side plan comparison (up to 3 plans) + SavePlanButton component |
| `src/App.tsx` | ~32 | Root component, ThemeProvider, routing |
| `src/index.css` | ~103 | Tailwind v4 config, CSS custom properties for light/dark themes |
| `index.html` | ~25 | HTML shell, meta tags |

### Shared Files (`shared/`)

| File | Lines | Purpose |
|------|-------|---------|
| `schema.ts` | ~15 | Zod schemas for scan request/response |

### Mobile App Files (`mobile/`)

| File | Lines | Purpose |
|------|-------|---------|
| `app/_layout.tsx` | ~24 | Root layout, theme provider, status bar |
| `app/index.tsx` | ~213 | Main calculator screen — all 3 tabs, header, footer |
| `components/theme-context.tsx` | ~38 | React context for light/dark mode |
| `components/episode-info.tsx` | ~163 | SOC date picker with ±day controls, episode date display |
| `components/frequency-card.tsx` | ~122 | Blue frequency output card with native clipboard copy |
| `components/week-row.tsx` | ~137 | Single week row with ±visit stepper controls |
| `components/calendar-grid.tsx` | ~172 | Full month calendar grid with date selection |
| `components/scan-tab.tsx` | ~300 | Camera/library image picker → API scan → result display |
| `utils/episode.ts` | ~89 | Episode calculation, frequency string generation, date helpers |
| `utils/theme.ts` | ~52 | Light/dark color palettes |

### Config Files (root)

| File | Lines | Purpose |
|------|-------|---------|
| `package.json` | ~122 | Web app dependencies, scripts |
| `mobile/package.json` | ~33 | Mobile app Expo dependencies |
| `mobile/app.json` | ~26 | Expo config (name, bundle ID, splash) |
| `mobile/tsconfig.json` | ~10 | TypeScript config with path aliases |

---

## 3. Database Schema

No database. Ceres is a pure client-side calculator. The backend exists only to proxy the OpenRouter vision API call.

---

## 4. API Routes

### 4.1 EMR Schedule Scanning

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/scan-schedule` | Accepts a base64 image + SOC date, calls OpenRouter GPT-4o to extract visit schedule from EMR screenshot | No |

**Request body:**
```json
{
  "image": "data:image/png;base64,...",
  "socDate": "2026-03-01"
}
```

**Response:**
```json
{
  "visits": [2, 2, 1, 1, 1, 1, 0, 0, 0],
  "notes": "Detected 3x/week tapering schedule",
  "confidence": "high"
}
```

---

## 5. Authentication & Authorization

No authentication. Ceres is a public calculator tool with no user accounts or protected routes.

---

## 6. Environment Variables & Secrets

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | API key for OpenRouter.ai — used to call GPT-4o vision for EMR schedule scanning |
| `DATABASE_URL` | No | Auto-provided by Replit but unused (no database) |

---

## 7. Frontend Navigation (Web)

| Path | Page | Auth Required |
|------|------|--------------|
| `/` | Home — Calculator with 3 tabs (Visual, Input, EMR Scan) | No |

Single-page application. No additional routes.

---

## 8. Mobile App

### Running Locally

1. Install **Expo Go** on iOS or Android
2. From `mobile/` directory: `npx expo start`
3. Scan QR code with Expo Go

### Key Configuration

| Setting | Value |
|---------|-------|
| API Base URL | `https://ceres.replit.app` (in `mobile/app/index.tsx`) |
| Bundle ID (iOS) | `com.cavaridge.ceres` |
| Package (Android) | `com.cavaridge.ceres` |
| Default Tab | Visual Calendar |

### Mobile Screens

| Screen | Description |
|--------|-------------|
| `index` | Single-screen app — SOC date picker, frequency card, 3 input tabs |

---

## 9. Operational Troubleshooting

### 9.1 Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| EMR scan returns 500 | Missing or invalid `OPENROUTER_API_KEY` | Check secret is set in Replit Secrets |
| EMR scan returns "Could not parse AI response" | OpenRouter returned unexpected format | Check OpenRouter API status; may need to retry |
| Mobile scan fails with network error | Wrong `API_BASE_URL` in `mobile/app/index.tsx` | Update to current deployed URL |
| Calendar not showing episode dates | SOC date invalid or not set | Verify date format is valid |
| Dark mode not working (web) | `next-themes` ThemeProvider missing | Ensure `App.tsx` wraps with ThemeProvider |
| Mobile date not syncing with calendar | Calendar month state stale | Fixed — useEffect resets month on SOC change |

### 9.2 Medicare Episode Logic (CMS CY 2026)

| Rule | Detail |
|------|--------|
| Guideline year | CMS Calendar Year 2026 (CY 2026 Final Rule, December 2025) |
| Regulation | 42 CFR §424.22 — Certification and plan requirements |
| Certification period | 60 days (Day 1 = SOC date, Day 60 = SOC + 59) |
| Payment model | PDGM — Patient-Driven Groupings Model (effective Jan 2020) |
| Payment periods | Two 30-day periods per certification (Period 1: Days 1–30, Period 2: Days 31–60) |
| Weeks 1–8 | 7 days each |
| Week 9 | 4 days (Days 57–60) |
| Frequency notation | `{visits}w{weeks}` — e.g., `2w1, 1w3` |
| Consecutive grouping | Same visit count in adjacent weeks → combined (e.g., 1,1,1 → `1w3`) |
| UI indicator | 30-day payment period boundary shown between W4/W5 in weekly breakdown |

---

*Ceres — Operations Runbook v1.1*
*Updated February 2026 — Added CMS CY 2026 guideline badge, PDGM 30-day payment period boundary*
