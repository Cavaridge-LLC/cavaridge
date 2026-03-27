# CVG-PVT — The Paw Vault

## Product Architecture Specification v1.0

**Status:** Approved — Ready for Build  
**Division:** Cavaridge Puppies (consumer division of Cavaridge, LLC)  
**App Code:** CVG-PVT  
**Store:** `apps/pawvault/`  
**Date:** 2026-03-27  
**Author:** Architecture by Claude — Build by Claude Code CLI

-----

## 1. PRODUCT OVERVIEW

**The Paw Vault** is a family-first, mobile-primary freemium consumer app that documents the complete life of a family’s pets — health records, memories, milestones, and family sharing — from day one through the rainbow bridge.

**Primary tagline:** *“Their story, from first day to last.”*  
**Brand entity:** Cavaridge Puppies (shown on splash/about screen only)  
**Consumer domain:** pawvault.com / pawvault.app  
**App handles:** @pawvaultapp (Instagram, TikTok, X)

### 1.1 What Makes It Different

No existing app in the $868M pet care app market combines:

- Full health record management with longitudinal version control
- Memory/milestone/scrapbook timeline on the same chronological view as health events
- Family-first RBAC architecture with caregiver attribution
- Child/teen account model with COPPA compliance
- Generational ownership transfer at age 18
- Memorial/legacy mode for deceased pets with permanent archival

### 1.2 Isolation from cavaridge-platform

**CVG-PVT is fully standalone.** It is NOT a tenant of the cavaridge-platform UTM hierarchy.

|Concern          |cavaridge-platform apps      |CVG-PVT                                   |
|-----------------|-----------------------------|------------------------------------------|
|Supabase instance|`cavaridge-platform` (shared)|Dedicated consumer instance               |
|Auth system      |packages/auth UTM RBAC       |Custom family vault RBAC (see §5)         |
|Railway service  |cavaridge platform cluster   |Independent service                       |
|Billing          |N/A (B2B)                    |RevenueCat (iOS/Android/Web)              |
|AI               |Ducky → Spaniel → OpenRouter |Ducky Intelligence API (consumer endpoint)|

The only platform dependency is the **Ducky Intelligence API** (`CVG-RESEARCH`) consumed via the standard Ducky → Spaniel → OpenRouter call chain. No direct LLM keys in CVG-PVT.

-----

## 2. LOCKED ARCHITECTURAL DECISIONS

1. **Standalone consumer Supabase instance** — isolated from cavaridge-platform; separate project, separate connection string, separate billing bucket
1. **React Native (Expo)** for iOS + Android; React (Vite) for web companion — shared component library via `packages/pawvault-ui/`
1. **Vault as unit of data ownership** — all data belongs to the vault, not the user account; enables ownership transfer without data migration
1. **RevenueCat** for all subscription management (iOS IAP, Android IAP, Stripe web) — single source of truth for entitlements
1. **Version control on all health records** — every edit creates a new immutable version; no record is ever destroyed
1. **Ducky Intelligence AI** routes through the standard Ducky → Spaniel → OpenRouter chain; no app-level LLM keys permitted
1. **COPPA compliance** — users under 13 have no independent account; teen accounts (13–17) require parental consent flow
1. **Memorial archival guarantee** — vaults for deceased pets enter read-only mode; data retained indefinitely regardless of subscription status; no commercial messaging in memorial mode

-----

## 3. TECH STACK

|Layer             |Technology                            |Notes                                    |
|------------------|--------------------------------------|-----------------------------------------|
|Mobile            |React Native (Expo SDK 52+)           |iOS + Android                            |
|Web               |React 18 + Vite                       |Companion web app                        |
|Shared UI         |`packages/pawvault-ui/`               |Tailwind + Radix, warm design system     |
|Backend API       |Express 5 / Node.js                   |Railway-hosted, standalone service       |
|Database          |Supabase (dedicated consumer instance)|Drizzle ORM                              |
|File Storage      |Supabase Storage (S3-compatible)      |Photos, videos, documents                |
|Auth              |Supabase Auth + custom family RBAC    |See §5                                   |
|Background Jobs   |BullMQ + Redis                        |Reminders, notifications, AI queue       |
|AI Layer          |Ducky Intelligence API (CVG-RESEARCH) |Routed via Spaniel → OpenRouter          |
|Payments          |RevenueCat                            |Multi-platform subscription + IAP        |
|Push Notifications|Expo Push + email (Resend)            |Reminders, milestones, alerts            |
|Analytics         |PostHog                               |Product analytics, funnel, A/B           |
|Secrets           |Doppler                               |All environments                         |
|Deployment        |Railway                               |Standalone service (not platform cluster)|
|TypeScript        |5.6+ strict mode                      |Zero errors required pre-deploy          |

-----

## 4. FEATURE MODULES

### 4.1 Pet Profiles

- Multi-pet, multi-species support (dogs, cats, birds, reptiles, small animals, exotics)
- Fields: name, species, breed, birthday, gotcha/adoption day, microchip ID, insurance policy, color/markings, spayed/neutered status
- Primary vet + specialist contacts per pet
- Profile photo with compression pipeline
- Co-owner designation (shared custody / multi-household)

### 4.2 Health Records (version-controlled)

- **Vet visits:** date, clinic, attending vet, reason, diagnosis, treatment, cost, documents attached
- **Vaccinations:** vaccine name, date, lot number, administered by, expiration, reminder scheduling
- **Medications:** name, dose, frequency, prescribing vet, start/end dates, caregiver attribution, refill alerts
- **Weight & vitals:** weight, temperature, heart rate, respiration — with trend charts
- **Lab results:** upload + text entry; comparison view across time
- **Surgeries & procedures:** type, date, surgeon, notes, recovery instructions
- **Dental care log**
- Every record: version history sidebar, edit attribution (which family member made the change)

### 4.3 Memory & Scrapbook Timeline

- Unified chronological timeline — health events and memories on the same view
- Photo + video upload (compression, HEIC support, caption, tags, date, location)
- Milestone tagging system: system milestones (First walk, Gotcha day, First vet visit, First birthday) + custom milestones
- Gotcha day / birthday auto-celebration notifications
- “On This Day” daily push notification surfacing memories from prior years
- Annual video compilation (1-Second-Everyday model) — V2
- Journal entries with mood tags (happy, anxious, sick, playful, sleepy)
- Location tagging on memories (optional, privacy-default off)

### 4.4 Family Vault — Sharing & Collaboration

- Invite members by email or deep link
- Role-based access (see §5)
- Caregiver attribution on all logged events (“Medication given by: Sarah”)
- Activity feed: timestamped log of what each family member has added
- Child viewer mode: parent renders curated photo/memory view (no independent account, no PII)
- Teen account flow: parental consent email, restricted scope, upgradeable at 18

### 4.5 Reports & Export

- **Vet-ready health summary PDF** — one tap; includes vaccinations, medications, weight history, recent visits; branded with The Paw Vault mark
- Vaccination certificate export
- Full health history export (PDF + CSV)
- Insurance claim packet generator (V2)
- Boarding/groomer intake form pre-fill (V2)
- Full vault ZIP export (JSON + media) — data portability guarantee, available to all tiers

### 4.6 Ducky Intelligence AI (Premium tier)

- Health trend insights (“Luna’s weight has increased 8% over 60 days — consider discussing with your vet”)
- Breed-specific milestone and health prompts (requires breed field on pet profile)
- Medication interaction awareness (flags potential conflicts in medication list)
- Smart reminder suggestions based on pet age, breed, and history
- Natural language vault search (“when did Ducky last have a rabies shot?”)
- Behavioral pattern detection from journal mood tags
- AI attribution always displayed: “Powered by Ducky Intelligence”
- Never framed as medical advice — always “consider discussing with your vet”

### 4.7 Memorial Mode

- Triggered by owner marking pet as passed (with confirmation flow)
- Vault enters read-only archival mode
- Tribute page auto-generated: life stats, favorite memories, health timeline summary
- “Rainbow Bridge” notification sent to all family vault members
- Memorial PDF / memory book export
- No commercial messaging, upgrade prompts, or upsell in memorial mode
- Data retained indefinitely regardless of subscription status

### 4.8 Reminders & Notifications

- Medication due reminders (configurable: 30 min, 1 hr, 1 day before)
- Vaccination expiration alerts (30-day, 7-day, day-of)
- Annual wellness visit reminders (based on last vet visit date + pet age)
- Gotcha day / birthday celebrations
- “On This Day” daily memory flashback
- Family activity notifications (opt-in per member)
- All notifications: customizable per pet per user; quiet hours respected

-----

## 5. AUTH & RBAC — FAMILY VAULT MODEL

This is a **custom auth system** — not the platform UTM RBAC. The organizational unit is the **Vault**, not a tenant.

### 5.1 Roles

|Role       |Code        |Permissions                                                                                                                                                                                      |
|-----------|------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Vault Owner|`owner`     |Full access. Billing. Member management. Ownership transfer. Delete vault. Only one per pet.                                                                                                     |
|Co-Owner   |`co_owner`  |Full access except billing and vault deletion. Can manage members. For partners, co-parents.                                                                                                     |
|Caregiver  |`caregiver` |Read/write health records and memories. Cannot delete records or manage members. For vets, sitters, groomers.                                                                                    |
|Viewer     |`viewer`    |Read-only. Sees memories and photos (not health records unless explicitly granted). For grandparents, extended family.                                                                           |
|Teen       |`teen`      |Own Supabase Auth account. Access to permitted pets only. Can add memories and photos. Cannot view medications/clinical records without parent grant. Requires parental consent flow. Ages 13–17.|
|Child View |`child_view`|No independent account. Parent renders curated view. No PII collected. COPPA compliant. Under 13.                                                                                                |

### 5.2 Multi-Household Support

- A pet vault can have members from multiple households
- Useful for: divorced/separated families sharing a pet, grandparents, boarding caregivers
- Co-Owner role designed for peer-level partners; Caregiver for recurring service providers

### 5.3 Generational Ownership Transfer

**The defining differentiator of The Paw Vault.**

Flow:

1. Owner initiates transfer in vault settings → selects recipient (must be member, age 18+, verified email)
1. Recipient receives push + email notification with full transfer summary (what transfers: all records, all memories, all photos, all documents)
1. 7-day review window — owner can cancel at any time
1. On day 7: ownership transfers atomically; former owner becomes Co-Owner by default
1. Billing subscription transfers to new owner’s payment method
1. Partial transfer: individual pet vaults within a multi-pet household can be transferred independently

Database: transfer initiated via `vault_transfer_requests` table with status enum (`pending` | `confirmed` | `cancelled` | `expired`); cron job processes confirmations at T+7 days.

-----

## 6. DATABASE SCHEMA

**Instance:** Dedicated Supabase consumer project (separate from `cavaridge-platform`)  
**ORM:** Drizzle  
**Naming:** snake_case throughout  
**RLS:** Enabled on all tables; vault membership drives access

### 6.1 Core Tables

```sql
-- Vaults (one per family, contains multiple pets)
vaults (
  id uuid PK,
  name text,
  created_by uuid FK users,
  subscription_tier text CHECK ('free'|'plus'|'premium'|'lifetime'),
  revenuecat_customer_id text,
  memorial_mode boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
)

-- Vault members (family/caregiver roster)
vault_members (
  id uuid PK,
  vault_id uuid FK vaults,
  user_id uuid FK users,
  role text CHECK ('owner'|'co_owner'|'caregiver'|'viewer'|'teen'),
  invited_by uuid FK users,
  consent_granted_by uuid FK users,  -- for teen accounts
  created_at timestamptz
)

-- Pets
pets (
  id uuid PK,
  vault_id uuid FK vaults,
  name text NOT NULL,
  species text,
  breed text,
  birthday date,
  gotcha_day date,
  microchip_id text,
  insurance_policy text,
  primary_vet_id uuid FK contacts,
  profile_photo_url text,
  is_deceased boolean DEFAULT false,
  deceased_at date,
  created_at timestamptz,
  updated_at timestamptz
)

-- Health records (version-controlled)
health_records (
  id uuid PK,
  pet_id uuid FK pets,
  record_type text CHECK ('vet_visit'|'vaccination'|'medication'|'weight'|'lab'|'surgery'|'dental'|'vital'|'note'),
  version integer DEFAULT 1,
  is_current boolean DEFAULT true,
  data jsonb NOT NULL,       -- flexible per record_type
  documents jsonb,           -- array of storage URLs
  logged_by uuid FK users,   -- caregiver attribution
  recorded_at timestamptz,
  created_at timestamptz
)

-- Memories (timeline entries)
memories (
  id uuid PK,
  pet_id uuid FK pets,
  vault_id uuid FK vaults,
  memory_type text CHECK ('photo'|'video'|'journal'|'milestone'),
  title text,
  caption text,
  media_urls jsonb,
  milestone_tag text,
  mood_tag text,
  location_name text,
  location_lat numeric,
  location_lng numeric,
  logged_by uuid FK users,
  occurred_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)

-- Medications (active tracking)
medications (
  id uuid PK,
  pet_id uuid FK pets,
  name text NOT NULL,
  dose text,
  frequency text,
  prescribing_vet text,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  refill_reminder_days integer DEFAULT 7,
  notes text,
  created_by uuid FK users,
  created_at timestamptz
)

-- Contacts (vets, specialists, groomers)
contacts (
  id uuid PK,
  vault_id uuid FK vaults,
  name text,
  role text CHECK ('vet'|'specialist'|'groomer'|'boarder'|'sitter'|'other'),
  clinic text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz
)

-- Vault transfer requests
vault_transfer_requests (
  id uuid PK,
  vault_id uuid FK vaults,
  initiated_by uuid FK users,
  recipient_id uuid FK users,
  status text CHECK ('pending'|'confirmed'|'cancelled'|'expired') DEFAULT 'pending',
  transfer_scope jsonb,     -- which pets are included
  initiated_at timestamptz,
  confirms_at timestamptz,  -- T+7 days
  completed_at timestamptz
)

-- Teen consent requests
teen_consent_requests (
  id uuid PK,
  vault_id uuid FK vaults,
  teen_user_id uuid FK users,
  parent_user_id uuid FK users,
  status text CHECK ('pending'|'approved'|'denied') DEFAULT 'pending',
  created_at timestamptz
)

-- Notification preferences
notification_prefs (
  id uuid PK,
  user_id uuid FK users,
  pet_id uuid FK pets,
  medication_reminders boolean DEFAULT true,
  vaccination_alerts boolean DEFAULT true,
  wellness_reminders boolean DEFAULT true,
  milestone_celebrations boolean DEFAULT true,
  on_this_day boolean DEFAULT true,
  family_activity boolean DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz
)
```

### 6.2 Storage Buckets

```
pawvault-media/
  ├── {vault_id}/pets/{pet_id}/profile/
  ├── {vault_id}/pets/{pet_id}/memories/
  ├── {vault_id}/pets/{pet_id}/health-docs/
  └── {vault_id}/exports/
```

### 6.3 RLS Policy Pattern

```sql
-- Members can only access their vault's data
CREATE POLICY "vault_member_access" ON pets
  USING (vault_id IN (
    SELECT vault_id FROM vault_members
    WHERE user_id = auth.uid()
  ));
-- Same pattern applies to all pet-scoped tables
```

-----

## 7. API ROUTES

Base: `/api/v1`  
Auth: Bearer token (Supabase JWT)  
All routes require vault membership verification.

```
# Vaults
GET    /vaults/:id
POST   /vaults
PATCH  /vaults/:id
DELETE /vaults/:id

# Vault Members
GET    /vaults/:id/members
POST   /vaults/:id/members/invite
PATCH  /vaults/:id/members/:memberId
DELETE /vaults/:id/members/:memberId

# Pets
GET    /vaults/:id/pets
POST   /vaults/:id/pets
GET    /pets/:id
PATCH  /pets/:id
DELETE /pets/:id
POST   /pets/:id/memorial      -- marks pet as deceased, triggers memorial mode

# Health Records
GET    /pets/:id/health-records
POST   /pets/:id/health-records
GET    /pets/:id/health-records/:recordId
PATCH  /pets/:id/health-records/:recordId  -- creates new version
GET    /pets/:id/health-records/:recordId/history  -- version history

# Memories
GET    /pets/:id/memories
POST   /pets/:id/memories
PATCH  /pets/:id/memories/:memoryId
DELETE /pets/:id/memories/:memoryId

# Timeline (unified health + memory)
GET    /pets/:id/timeline      -- merged, paginated, date-filtered

# Medications
GET    /pets/:id/medications
POST   /pets/:id/medications
PATCH  /pets/:id/medications/:medId
DELETE /pets/:id/medications/:medId

# Reports & Export
GET    /pets/:id/report/vet-summary   -- returns PDF stream
GET    /vaults/:id/export             -- returns ZIP (full vault export)

# Ducky AI (Premium only — entitlement check via RevenueCat)
POST   /pets/:id/ai/insights          -- health trend insights
POST   /pets/:id/ai/search            -- NL search across vault
POST   /pets/:id/ai/milestone-prompts -- breed-specific prompt suggestions

# Transfers
POST   /vaults/:id/transfer/initiate
POST   /vaults/:id/transfer/:requestId/cancel
GET    /vaults/:id/transfer/:requestId

# Webhooks
POST   /webhooks/revenuecat           -- subscription events
POST   /webhooks/expo                 -- push delivery status
```

-----

## 8. FREEMIUM TIER ENFORCEMENT

Entitlement source of truth: **RevenueCat** (not Supabase). Middleware checks `rc_entitlements` on all gated routes.

|Feature               |Free         |Plus                  |Premium               |Lifetime              |
|----------------------|-------------|----------------------|----------------------|----------------------|
|Pet profiles          |2            |Unlimited             |Unlimited             |Unlimited             |
|Family members        |2            |10                    |Unlimited             |Unlimited             |
|Photo storage         |50 photos    |Unlimited             |Unlimited             |Unlimited             |
|Health records        |Basic        |Full + version history|Full + version history|Full + version history|
|PDF vet export        |✗            |✓                     |✓                     |✓                     |
|Full vault ZIP export |✓            |✓                     |✓                     |✓                     |
|Ducky AI insights     |✗            |✗                     |✓                     |✓                     |
|Teen accounts         |✗            |✓                     |✓                     |✓                     |
|Memorial mode         |✓ (read-only)|✓ (full)              |✓ (full)              |✓ (full)              |
|Ownership transfer    |✗            |✓                     |✓                     |✓                     |
|Printable memory books|✗            |✗                     |✓                     |✓                     |

**Pricing:**

- Free: $0
- Plus: $4.99/month or $34.99/year
- Premium: $8.99/month or $69.99/year
- Lifetime: $129.99 one-time

**RevenueCat product IDs (register before App Store submission):**

```
com.cavaridge.pawvault.plus.monthly
com.cavaridge.pawvault.plus.annual
com.cavaridge.pawvault.premium.monthly
com.cavaridge.pawvault.premium.annual
com.cavaridge.pawvault.lifetime
```

-----

## 9. DUCKY INTELLIGENCE INTEGRATION

The Paw Vault consumes Ducky Intelligence as an API client. It does NOT embed LLM logic directly.

```typescript
// packages/pawvault-ai/src/ducky-client.ts
// All AI calls route through Ducky → Spaniel → OpenRouter
// API key managed in Doppler under CVG-PVT service

const duckyClient = new DuckyIntelligenceClient({
  endpoint: process.env.DUCKY_API_URL,        // CVG-RESEARCH endpoint
  apiKey: process.env.DUCKY_API_KEY,          // Cavaridge platform key
  appCode: 'CVG-PVT',
  appVersion: process.env.APP_VERSION,
});
```

**Consumer-facing AI attribution:** “Powered by Ducky Intelligence” — shown in AI insight cards, search results, and milestone prompt surfaces.  
**Never:** “Powered by AI”, “AI-powered”, or any reference to underlying models.

-----

## 10. BUILD PHASES

### Phase 1 — V1 Core Vault (MVP)

**Target:** App Store + Google Play launch

- [ ] `apps/pawvault/` React Native (Expo) scaffold
- [ ] `apps/pawvault-web/` React + Vite web companion scaffold
- [ ] `packages/pawvault-ui/` component library (warm design system)
- [ ] Supabase consumer instance provisioned (Doppler: CVG-PVT environment)
- [ ] All V1 tables + RLS (migration `001_pvt_init.sql`)
- [ ] Auth: email + Apple/Google OAuth, family RBAC
- [ ] Pet profiles (all species)
- [ ] Health records module (vet visits, vaccines, meds, weight)
- [ ] Memory timeline (photos, milestones, journal)
- [ ] Family sharing (Owner + Co-Owner + Caregiver + Viewer)
- [ ] Basic reminders (medication, vaccination, wellness)
- [ ] PDF vet report export (Plus gate)
- [ ] Full vault ZIP export (all tiers)
- [ ] RevenueCat integration (Free + Plus tiers live)
- [ ] iOS first; Android follows same sprint
- [ ] Zero TypeScript errors (`pnpm typecheck` passes)

### Phase 2 — V2 Intelligence & Family

**Target:** 3–4 months post-launch

- [ ] Ducky AI integration (health insights, NL search, milestone prompts) — Premium tier
- [ ] Breed-specific prompt library
- [ ] Teen accounts + COPPA consent flow
- [ ] Memorial mode (full — tribute page, memory book export, Rainbow Bridge notification)
- [ ] “On This Day” push notifications
- [ ] Annual video compilation generator
- [ ] Premium tier + Lifetime tier live in RevenueCat
- [ ] Ownership transfer mechanic (vault_transfer_requests flow)
- [ ] PostHog analytics dashboards (funnel, retention, tier conversion)

### Phase 3 — V3 Ecosystem

**Target:** 6–9 months post-launch

- [ ] Wearable sync: Fi Collar, Tractive, Whistle (connector framework)
- [ ] Genetic testing import: Embark, Wisdom Panel
- [ ] Smart feeder sync: SureFeed, Petlibro
- [ ] Pet insurance export packets: Trupanion, Lemonade
- [ ] Printable memory books (partner print service integration)
- [ ] Breeder pre-population API (vault pre-created at adoption)

-----

## 11. MONOREPO PLACEMENT

```
cavaridge/
├── apps/
│   ├── pawvault/                    ← React Native (Expo) — iOS + Android
│   └── pawvault-web/                ← React + Vite — web companion
├── packages/
│   ├── pawvault-ui/                 ← Warm design system (Tailwind + Radix)
│   └── pawvault-ai/                 ← Ducky Intelligence client wrapper
├── docs/
│   └── architecture/
│       └── CVG-PVT-SPEC-v1.0-20260327.md   ← this file
└── registry/
    └── apps.json                    ← CVG-PVT row added (see §12)
```

-----

## 12. REGISTRY ENTRY (apps.json addition)

```json
{
  "code": "CVG-PVT",
  "name": "The Paw Vault",
  "directory": "apps/pawvault",
  "status": "Planned",
  "division": "Cavaridge Puppies",
  "description": "Family pet scrapbook and health record app. Freemium consumer mobile-first product. Standalone — not a cavaridge-platform UTM tenant.",
  "consumer_domain": "pawvault.com",
  "platform": ["ios", "android", "web"],
  "supabase_instance": "dedicated-consumer",
  "billing": "revenuecat",
  "ai_dependency": "CVG-RESEARCH",
  "coppa_compliant": true
}
```

-----

## 13. RUNBOOK REQUIREMENT

Per Cavaridge runbook policy (new app = Major version):

Generate on first build sprint start:

```
CVG-PVT-RB-v1.0.0-20260327.md
```

Store at: `runbooks/CVG-PVT-RB-v1.0.0-20260327.md`

Runbook must cover:

- Railway service provisioning (standalone, not platform cluster)
- Supabase consumer instance setup and Doppler secret mapping
- RevenueCat product ID registration (iOS + Android + Web)
- Expo build and App Store / Google Play submission checklist
- COPPA compliance verification checklist
- Ducky Intelligence API key setup in Doppler

-----

## 14. SUCCESS CRITERIA

This spec is complete when:

- [ ] CLAUDE.md is at v2.11 with CVG-PVT in app registry (16 apps total)
- [ ] `apps/pawvault/` scaffold exists with Expo config and package.json
- [ ] `apps/pawvault-web/` scaffold exists with Vite config
- [ ] `packages/pawvault-ui/` exists with base component stubs
- [ ] `packages/pawvault-ai/` exists with Ducky client wrapper stub
- [ ] Supabase consumer instance provisioned; `001_pvt_init.sql` migration applied
- [ ] All tables from §6.1 exist with RLS policies enabled
- [ ] Storage buckets provisioned per §6.2 structure
- [ ] RevenueCat project created; product IDs from §8 registered
- [ ] Free and Plus tiers enforced in API middleware
- [ ] Pet profile CRUD with photo upload working end-to-end
- [ ] Health record create + version history working
- [ ] Memory timeline showing unified health + memory entries
- [ ] Family invite flow working (Owner → Caregiver role)
- [ ] PDF vet report generates correctly (Plus gate enforced)
- [ ] Zero TypeScript errors (`pnpm typecheck` passes across all CVG-PVT packages)
- [ ] CVG-PVT row added to `registry/apps.json`
- [ ] Runbook `CVG-PVT-RB-v1.0.0-20260327.md` generated and committed

-----

*CVG-PVT-SPEC-v1.0 — Architecture by Claude — Build by Claude Code CLI*  
*Store at: `docs/architecture/CVG-PVT-SPEC-v1.0-20260327.md`*  
*IP Owner: Cavaridge, LLC (D-U-N-S: 138750552)*