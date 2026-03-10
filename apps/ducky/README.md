# Ducky (CVG-DUCKY)

**THE AI-native answer engine** by Cavaridge, LLC.

## Overview

Ducky is an AI-powered answer engine that provides instant, intelligent responses backed by configurable knowledge sources. Built for organizations that need a reliable, multitenant Q&A platform.

## Stack

- **Runtime:** Node.js 20.x, ESM
- **Backend:** Express 5.x, Drizzle ORM, PostgreSQL (Supabase)
- **Frontend:** React 18, Tailwind CSS, Radix UI, wouter
- **AI:** OpenRouter (Claude Sonnet 4 via OpenAI SDK)
- **Auth:** Session-based with 5-tier RBAC

## Development

```bash
pnpm install
pnpm dev --filter=ducky
```

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Session encryption key
- `OPENROUTER_API_KEY` — OpenRouter API key for AI features
