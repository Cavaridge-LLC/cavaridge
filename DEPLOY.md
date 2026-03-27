# Cavaridge — Deployment Guide

Quick reference for deploying all revenue-generating apps.

---

## Prerequisites

```bash
# Install dependencies (already done)
pnpm install

# Build everything (already done — 27/27 pass)
pnpm build
```

---

## 1. Database Setup

Run migrations against your Supabase instance:

```bash
# From repo root — uses DATABASE_URL from .env
./scripts/run-migrations.sh
```

This runs all 16 migration files in order, creating schemas for all 14 apps.

---

## 2. Ceres iOS App (App Store)

### Build & Submit

```bash
cd apps/ceres/mobile

# Install Expo dependencies
npx expo install

# Login to EAS
npx eas login

# Configure your EAS project ID in app.json → extra.eas.projectId
# Get it from: https://expo.dev

# Build for iOS
npx eas build --platform ios --profile production

# Submit to App Store
npx eas submit --platform ios
```

### App Store Listing Info
- **Name:** Ceres — Medicare Visit Calculator
- **Bundle ID:** com.cavaridge.ceres
- **Category:** Medical
- **Price:** Free (or $2.99 one-time)
- **Description:** Free Medicare 60-day episode visit frequency calculator for home health professionals. CMS CY 2026 compliant. Features visual calendar scheduling, frequency notation input, manual weekly entry, and EMR schedule scanning.
- **Keywords:** medicare, home health, visit frequency, 60 day, episode, CMS, PDGM, nursing, clinical calculator
- **Privacy Policy:** Built into the app (Privacy screen)

### Deploy Web Backend (for EMR Scan feature)
The Ceres web app serves as the API backend for the mobile app's EMR Scan feature.

```bash
# Railway auto-deploys from GitHub. Configure:
# Root Directory: apps/ceres
# Build Command: pnpm build
# Start Command: pnpm start
# Port: 5000
```

---

## 3. AEGIS IAR Freemium (Web)

### Deploy to Railway

```bash
# Railway configuration:
# Root Directory: apps/aegis
# Build Command: pnpm build
# Start Command: pnpm start
# Port: 5000

# Environment variables needed:
# DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### Access
- **Freemium IAR:** `https://your-aegis-url.railway.app/iar`
- **Freemium Scan:** `https://your-aegis-url.railway.app/scan`
- **Dashboard:** `https://your-aegis-url.railway.app/` (requires auth)

### Sales Usage
Share the `/iar` URL with MSP prospects. They upload M365 CSV exports and get a branded XLSX security report with risk flags and recommendations. Lead capture (name, email, company) is built in.

---

## 4. Caelum SoW Builder (Web)

### Deploy to Railway

```bash
# Railway configuration:
# Root Directory: apps/caelum
# Build Command: pnpm build
# Start Command: pnpm start
# Port: 5000

# Environment variables needed:
# DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# OPENROUTER_API_KEY (for AI-powered SoW generation)
```

---

## 5. Meridian M&A Platform (Web)

### Deploy to Railway

```bash
# Railway configuration:
# Root Directory: apps/meridian
# Build Command: pnpm build
# Start Command: pnpm start
# Port: 5000

# Environment variables needed:
# DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# OPENROUTER_API_KEY
```

---

## Railway Environment Variables (All Apps)

Set these in each Railway service:

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | PostgreSQL connection string | Supabase dashboard |
| `SUPABASE_URL` | `https://rastlfqertdllarbciwv.supabase.co` | Supabase dashboard |
| `SUPABASE_ANON_KEY` | JWT anon key | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT service role key | Supabase dashboard |
| `OPENROUTER_API_KEY` | OpenRouter API key | Doppler |
| `NODE_ENV` | `production` | Static |
| `PORT` | `5000` | Static |

---

## Verification

| App | URL | Test |
|-----|-----|------|
| Ceres Web | `https://ceres.up.railway.app` | Open → 5-tab calculator renders |
| Ceres iOS | App Store / TestFlight | Install → all 4 tabs work |
| AEGIS IAR | `https://aegis.up.railway.app/iar` | Upload CSVs → XLSX downloads |
| Caelum | `https://caelum.up.railway.app` | Login → generate SoW → export PDF |
| Meridian | `https://meridian.up.railway.app` | Login → deal pipeline renders |
