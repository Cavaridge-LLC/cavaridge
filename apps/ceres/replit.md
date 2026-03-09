# Ceres - Medicare 60-Day Visit Frequency Calculator

## Overview
Clinical home health care visit frequency calculator based on Start of Care (SOC) date and the Medicare 60-day certification calendar.

## Architecture
- **Web Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui components
- **Mobile App**: Expo (React Native) with Expo Router — native iOS/Android app
- **Backend**: Express.js (minimal — only serves the EMR scan API)
- **AI**: OpenRouter (GPT-4o vision) for EMR schedule image analysis
- **No database** — this is a pure calculator tool with no persistence needs

## Key Features
1. **Visual Calendar Picker**: Click/tap dates on an interactive calendar to auto-calculate frequency
2. **Frequency Input**: Type frequency notation (e.g., "1W1, 3W8") → parser generates weekly visit plan with total cross-check
3. **Interval Scheduler**: Define custom intervals (every N days, specific weekdays like Mon/Wed/Fri)
4. **Manual Input**: Weekly visit frequency allocation with ±stepper per week
5. **EMR Schedule Scanner**: Upload/photograph an EMR schedule → AI auto-detects SOC date + visits → compare/apply
6. **Smart Scheduling**: Clinically-optimized visit date suggestions (weekday preference, consistent patterns, minimum spacing)
7. **Calendar Export**: Export visit plans as .ics (iCalendar) or CSV files
8. **Visual Timeline**: Horizontal 60-day episode timeline with week boundaries, PDGM split, and visit dots
9. **Plan Comparison**: Save up to 3 plans and compare side-by-side with difference highlighting
10. **Light/Dark Mode**: System-default with manual toggle

## Project Structure

### Web App
- `client/src/pages/Home.tsx` — Main calculator page (5 tabs: Visual, Frequency, Interval, Input, EMR Scan)
- `client/src/components/IntervalScheduler.tsx` — Custom visit interval scheduling (every N days / specific weekdays)
- `client/src/components/SmartScheduler.tsx` — Smart scheduling algorithm with clinical rationale
- `client/src/components/CalendarExport.tsx` — .ics and CSV export functionality
- `client/src/components/Timeline.tsx` — Visual 60-day episode timeline
- `client/src/components/PlanComparison.tsx` — Side-by-side plan comparison + SavePlanButton
- `server/routes.ts` — `/api/scan-schedule` endpoint (OpenRouter GPT-4o vision)
- `shared/schema.ts` — Zod schemas for scan request/response
- `server/storage.ts` — Empty storage (no DB needed)

### Mobile App (Expo)
- `mobile/app/_layout.tsx` — Root layout with theme provider
- `mobile/app/index.tsx` — Main calculator screen (4 tabs: Visual, Frequency, Input, EMR Scan)
- `mobile/components/` — Native UI components (calendar-grid, week-row, frequency-card, scan-tab, episode-info, theme-context)
- `mobile/utils/episode.ts` — Episode calculation logic + frequency string parser (shared with web)
- `mobile/utils/theme.ts` — Light/dark theme colors
- `mobile/package.json` — Expo dependencies
- `mobile/app.json` — Expo config (bundle ID: com.cavaridge.ceres)

### Running the Mobile App
1. Install Expo Go on your phone
2. From the `mobile/` directory, run `npx expo start`
3. Scan the QR code with Expo Go
4. The EMR scan feature connects to the deployed web backend at `https://ceres.replit.app`

## Environment Variables
- `OPENROUTER_API_KEY` — Required for EMR schedule scanning feature

## Frequency Notation
Uses clinical shorthand: `{visits}W{weeks}` (e.g., `1W1, 3W8` = 1 visit for 1 week, then 3 visits for 8 weeks). The Frequency Input tab parses this notation bidirectionally — users can type a frequency string and the app generates the weekly visit plan. Week count is dynamic (9–10 weeks depending on SOC day-of-week) using Sunday–Saturday calendar weeks per CMS CY 2026 guidelines.

## Branding
- App name: Ceres
- Owner: Cavaridge, LLC
- Footer: © 2026 Cavaridge, LLC. All rights reserved.
