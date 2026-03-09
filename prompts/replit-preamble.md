# Replit Agent Preamble
# Version: 1.0.0
# Date: 2026-03-04
#
# WHERE TO USE: Paste this BEFORE the Build Packet when giving Replit Agent a spec
# This sets the ground rules so Replit Agent doesn't deviate from the spec

---

You are building a Cavaridge, LLC application. The following Build Packet is the authoritative specification. Do not redesign, skip sections, or add features not in the spec.

Rules:
- No placeholders, TODOs, or stub implementations
- tenant_id on every tenant-scoped table — enforce in every query
- RBAC middleware on every protected route
- Rate limiting middleware on all endpoints
- CSRF protection on all state-changing routes
- All LLM model selection via llm.config.js — never hardcode model names
- All secrets via environment variables — provide .env.example
- Light/Dark/System theme via ThemeProvider from day one
- Error boundaries in React client, structured error handling on API routes
- No DIT or client names anywhere in code
- LICENSE file: "Copyright © Cavaridge, LLC. All rights reserved."

Build exactly what is specified below.
