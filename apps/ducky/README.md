# Ducky Intelligence (CVG-RESEARCH)

**User-facing intelligence platform** by Cavaridge, LLC.

## Overview

Ducky Intelligence is the AI reasoning API and user-facing research platform for all Cavaridge apps. Provides agentic research (plan → approve → execute → synthesize), RAG-powered Q&A, CVGBuilder v3 Plan Mode, and knowledge base management. Built with the Universal Tenant Model for full multitenancy.

## Stack

- **Runtime:** Node.js 20.x, ESM
- **Backend:** Express 5.x, Drizzle ORM, PostgreSQL (Supabase)
- **Frontend:** React 18, Tailwind CSS v4, Radix UI, wouter
- **AI:** @cavaridge/spaniel (LLM gateway — all calls route through Spaniel, never direct OpenRouter)
- **Auth:** Supabase Auth with 5-tier RBAC (platform_owner → viewer)

## Development

```bash
pnpm install
pnpm --filter @cavaridge/ducky dev
```

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (shared Supabase instance)
- `OPENROUTER_API_KEY` — Master Cavaridge OpenRouter key (read by @cavaridge/spaniel)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
