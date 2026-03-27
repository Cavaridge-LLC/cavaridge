# The Paw Vault — CVG-PVT

> *Their story, from first day to last.*

Family pet scrapbook and health record app. Built by Cavaridge Puppies, a consumer division of Cavaridge, LLC.

**Platform:** iOS + Android (Expo) | **Web:** `apps/pawvault-web/`  
**Spec:** `docs/architecture/CVG-PVT-SPEC-v1.0-20260327.md`  
**Status:** Planned — V1 MVP build

-----

## Architecture Note

**This app is standalone.** It is NOT a tenant of the cavaridge-platform UTM hierarchy.

|Concern |Value                                                 |
|--------|------------------------------------------------------|
|Supabase|Dedicated consumer instance (not `cavaridge-platform`)|
|Auth    |Custom family vault RBAC                              |
|Billing |RevenueCat                                            |
|Railway |Independent service                                   |
|AI      |Ducky Intelligence API (CVG-RESEARCH) only            |

-----

## Getting Started

```bash
# From monorepo root
pnpm install

# Start mobile app (Expo)
pnpm --filter pawvault dev

# Start web companion
pnpm --filter pawvault-web dev

# Type check
pnpm --filter pawvault typecheck
pnpm --filter pawvault-web typecheck
```

-----

## Environment Variables (Doppler — CVG-PVT service)

```
SUPABASE_URL=                    # consumer Supabase project
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DUCKY_API_URL=                   # CVG-RESEARCH Ducky Intelligence endpoint
DUCKY_API_KEY=                   # Cavaridge platform key (never app-level)
REVENUECAT_API_KEY_IOS=
REVENUECAT_API_KEY_ANDROID=
REVENUECAT_SECRET_KEY=           # for server-side webhook verification
REDIS_URL=                       # BullMQ (shared Railway Redis or dedicated)
RESEND_API_KEY=                  # transactional email
POSTHOG_API_KEY=
```

-----

## Packages

|Package                |Purpose                                                         |
|-----------------------|----------------------------------------------------------------|
|`packages/pawvault-ui/`|Warm design system — Tailwind + Radix, typography, color palette|
|`packages/pawvault-ai/`|Ducky Intelligence client wrapper for CVG-PVT                   |

-----

## Key Directories

```
apps/pawvault/
├── src/
│   ├── screens/          ← Expo screens (Home, Pet, Timeline, Family, Settings)
│   ├── components/       ← App-specific components (imports from pawvault-ui)
│   ├── navigation/       ← React Navigation config
│   ├── api/              ← API client (typed, generated from routes)
│   ├── stores/           ← Zustand state (vault, pets, auth)
│   ├── hooks/            ← usePet, useVault, useDucky, useEntitlements
│   └── lib/              ← RevenueCat config, Supabase client, push setup
├── app.config.ts         ← Expo config (bundle ID: com.cavaridge.pawvault)
├── package.json
└── tsconfig.json
```

-----

## Runbook

`runbooks/CVG-PVT-RB-v1.0.0-20260327.md` — generate before first build sprint.

-----

## IP

Cavaridge, LLC (D-U-N-S: 138750552) is the sole IP owner.  
Published by Cavaridge Puppies. Powered by Ducky Intelligence.