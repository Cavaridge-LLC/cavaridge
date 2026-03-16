# CLAUDE.md

This file governs all Claude Code work in the Cavaridge monorepo.

## What This Repo Is

Monorepo for the entire Cavaridge application portfolio. Contains all apps, shared packages, governance standards, templates, prompts, and runbooks.

**Owner:** Cavaridge, LLC (D-U-N-S: 138750552). Sole IP owner of all code, documentation, and applications.

**Operator:** Benjamin Posner — communicates intent in natural language. Claude Code translates to implementation.

## Repo Structure

```
cavaridge/
├── apps/           ← Each app is an independent deployable
│   ├── meridian/   ← M&A IT Intelligence Platform (CVG-MER)
│   ├── caelum/     ← SoW Builder (CVG-CAELUM)
│   ├── midas/      ← IT Roadmap / QBR Platform (CVG-MIDAS)
│   ├── vespar/     ← Cloud Migration Planning (CVG-VESPAR)
│   ├── astra/      ← M365 License Optimization (CVG-ASTRA)
│   ├── hipaa/      ← HIPAA Risk Assessment Toolkit (CVG-HIPAA)
│   ├── ducky/      ← AI-Native Research & Intelligence Platform (CVG-RESEARCH)
│   └── brain/      ← Voice-First Knowledge Capture & Recall (CVG-BRAIN)
├── packages/       ← Shared code imported by apps
│   ├── ui/         ← Radix + Tailwind component library
│   ├── auth/       ← Supabase auth, RBAC, tenant isolation
│   ├── db/         ← Supabase client, Drizzle utilities
│   ├── config/     ← Theme (light/dark/system), tenant config
│   ├── types/      ← Shared TypeScript types
│   ├── spaniel/    ← LLM Gateway wrapping OpenRouter (CVG-AI)
│   ├── agent-core/ ← Shared agent types, base class, tool definitions
│   ├── agent-runtime/ ← Execution engine (Vercel AI SDK wrapper)
│   ├── agents/     ← 7 shared parameterized agents
│   ├── tenant-intel/ ← Shared M365/GWS tenant ingestion & intelligence layer
│   ├── ducky-animations/ ← Lottie animations for Ducky mascot
│   ├── security/   ← Input validation, PII detection, prompt injection prevention
│   └── audit/      ← Immutable append-only agent audit logging
├── standards/      ← YAML build standards (machine-readable)
├── templates/      ← SOW, diligence report, project templates
├── prompts/        ← AI prompt pipeline (Phase 1-4)
└── runbooks/       ← Versioned runbooks per app
```

## App Registry

| Code | App | Directory | Status | Supabase Project | Railway Service |
|------|-----|-----------|--------|------------------|----------------|
| CVG-MER | Meridian | apps/meridian | Active | TBD | TBD |
| CVG-CAELUM | Caelum | apps/caelum | Active | TBD | TBD |
| CVG-MIDAS | Midas | apps/midas | Active | TBD | TBD |
| CVG-VESPAR | Vespar | apps/vespar | Active | TBD | TBD |
| CVG-ASTRA | Astra | apps/astra | Active | TBD | TBD |
| CVG-HIPAA | HIPAA Toolkit | apps/hipaa | Active | TBD | TBD |
| CVG-CERES | Ceres | apps/ceres | Active | TBD | TBD |
| CVG-RESEARCH | Ducky | apps/ducky | Active | TBD | TBD |
| CVG-BRAIN | Brain | apps/brain | Active | TBD | TBD |
| CVG-AI | Spaniel | packages/spaniel | Active | N/A | TBD |

## Common Stack (all apps)

- **Runtime:** Node.js 20.x, ESM modules
- **Backend:** Express 5.x
- **Frontend:** React 18-19, Radix UI, Recharts, Tailwind CSS 4
- **Database:** PostgreSQL via Supabase, Drizzle ORM
- **Auth:** Supabase Auth with RBAC (see RBAC Taxonomy below)
- **LLM:** OpenRouter (OpenAI SDK compatible) — Cavaridge master key only
- **Build:** Turborepo + pnpm workspaces
- **Hosting:** Railway (one service per app, auto-deploy from GitHub)
- **Secrets:** Environment variables via Doppler + .env (local dev)

## Commands

```bash
pnpm install              # Install all dependencies
pnpm dev --filter=meridian  # Dev one app
pnpm build                # Build everything
pnpm db:push --filter=meridian  # Push schema for one app
pnpm compliance           # Run portfolio compliance check
```

## Critical Rules

### Tenant Isolation
- DIT (Dedicated IT) is a client/tenant of Cavaridge apps — NEVER a co-owner, co-developer, or hardcoded reference
- Every data table includes `tenant_id`
- Row-Level Security (RLS) enforced in Supabase on every table
- No hardcoded client data anywhere — all client config in tenant records or env vars

### Multitenancy
- All apps are multitenant from day one
- RBAC enforced at data (RLS), API (middleware), and UI (conditional rendering) layers
- Shared auth package handles tenant context propagation

### LLM Access
- All LLM calls route through OpenRouter under the Cavaridge master key
- No app-level LLM API keys permitted
- Model selection defined by task type in shared config — never hardcoded per feature
- All LLM calls import from `@cavaridge/spaniel` — direct OpenRouter imports are forbidden (enforced by ESLint)

### Secrets
- No plaintext keys in any file, ever
- `.env` files gitignored
- Production secrets managed via Doppler or host-level env vars
- Database credentials from Supabase dashboard → .env (local) or Doppler (production)
- Master OpenRouter key scoped via env var, never committed

### Theming
- All apps support light, dark, and system theme modes
- Theme logic lives in `@cavaridge/config`
- Apps import and apply — never implement their own theme toggle

### Shared Packages
- Import shared code as `@cavaridge/ui`, `@cavaridge/auth`, `@cavaridge/db`, `@cavaridge/config`, `@cavaridge/types`
- Never duplicate shared logic in an app directory
- When building a feature that could be reused, put it in the appropriate package

## Shared Platform Packages
- Tenant Intelligence Layer: `docs/architecture/TENANT-INTEL-ARCH-v1.0.0-20260313.md`

## RBAC Taxonomy (minimum roles — apps may extend, never omit)

1. **Platform Owner** — Cavaridge admin, full access to all tenants
2. **Platform Admin** — Manages platform config, can view all tenants
3. **Tenant Admin** — Full access within their tenant
4. **User** — Standard access within their tenant
5. **Viewer** — Read-only access within their tenant

## Code Conventions

- TypeScript strict mode. No `any` unless justified with a comment.
- Functional components with hooks. No class components.
- Named exports for components. Default export only for page-level modules.
- Feature-based directory structure within each app.
- Commit messages: imperative mood, < 72 chars. Prefix: `feat:`, `fix:`, `chore:`, `docs:`.
- All user-facing text must support tenant customization (no hardcoded product names in UI).

## Versioning

- Runbook format: `[AppCode]-RB-v[Major].[Minor].[Patch]-[YYYYMMDD]`
- Regenerate runbook on every Major or Minor version increment
- Semantic versioning for all packages and apps

## Labor & Pricing Reference

For SOWs, diligence reports, or cost estimates generated from templates:

- Standard: $185/hr | Senior: $225/hr | Emergency: $285/hr
- Hardware margins: 15–25% | Licensing margins: 10%
- All pricing presented as budgetary estimates
- Equipment/licensing costs researched at assessment time — never hardcoded

## CVG-CAELUM (SoW Builder)
- All generated SoWs MUST conform to `docs/architecture/SOW-MASTER-SPEC-v2_1.md`
- This spec is LOCKED (v2.1, 2026-03-12) — do not deviate without explicit instruction
- Approval section excluded by default (8 sections). Include only when requested.
- Labor Hours table: Role | Scope | Hour ranges ONLY. No rates, no pricing, no dollar amounts.

## CVG-MIDAS
- Security Scoring Module: `docs/architecture/CVG-MIDAS-SECURITY-SCORING-ADDENDUM-v1.0.0-20260313.md`

## Agent-First Platform Architecture
- Master spec: `docs/architecture/CVG-AGENT-FIRST-PLATFORM-ARCHITECTURE-v1.docx`
- This spec is APPROVED (2026-03-13) — all apps built as agents first, interfaces second
- Build order: Spaniel → Ducky → security/audit packages → @cavaridge/tenant-intel → Midas (with security scoring) → Caelum → Meridian → HIPAA → rest
- All LLM calls route through @cavaridge/spaniel (not directly to OpenRouter)
- 7 shared parameterized agents in @cavaridge/agents
- Animated Ducky (Blenheim Cavalier) is the AI companion in ALL apps — non-optional, persists across tenant branding

## Communication Standards

- Author name: "Benjamin Posner" (never "Ben Posner" or "Benjamin Rogan")
- Company: Cavaridge, LLC
- Evidence tagging: OBSERVED / REPRESENTED / UNVERIFIED
- Risk color-coding: Critical (red) / High (orange) / Medium (yellow) / Low (green)
- Tone: direct, professional, no filler
- Call out assumptions explicitly