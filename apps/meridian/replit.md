# MERIDIAN - M&A IT Intelligence Platform

## Overview
MERIDIAN is an M&A IT Intelligence Platform designed to streamline the due diligence process for mergers and acquisitions. It provides tools for deal pipeline management, risk assessment, IT infrastructure analysis, and integration planning. The platform features a robust document ingestion pipeline, multi-tenant architecture with session-based authentication, role-based permissions, and complete data isolation. Its core purpose is to enhance decision-making and efficiency for M&A professionals.

## User Preferences
I want iterative development. Ask before making major changes. I prefer simple language. I like functional programming. Always review and update RUNBOOK.md at the end of each session to reflect any codebase changes.

## System Architecture
MERIDIAN is built with a React (Vite, TypeScript, Tailwind CSS) frontend, an Express.js backend, and PostgreSQL with Drizzle ORM. Authentication is session-based using `express-session` and `connect-pg-simple`. Replit Object Storage handles file uploads.

The platform utilizes a comprehensive theme system supporting light, dark, and system modes, with CSS variables for consistent styling.

### Server Route Architecture (v2.5.0)
Routes are split into 11 domain modules under `server/routes/`:
- `auth.ts` — /api/auth/*, invitations, password reset
- `deals.ts` — /api/deals/* CRUD, pillars, findings, scores
- `documents.ts` — /api/documents/*, upload, preview, classify, embed, search, cascade delete, image analysis
- `reports.ts` — /api/deals/:id/export/* (DOCX, executive, CSV, Excel, SSE streams)
- `platform.ts` — /api/platform/*, sterilize, account-requests
- `qa.ts` — /api/deals/:dealId/qa/*
- `portfolio.ts` — /api/portfolio/*
- `org.ts` — /api/org/*, settings, members, branding, pillar-templates, tech-categories
- `system.ts` — /api/version, /api/system-status, /api/pipeline-stats, /api/ai/status
- `infra.ts` — tech-stack, topology, baseline-comparison, infra-analysis, playbook, simulate
- `deal-access.ts` — /api/deals/:id/access
- `_helpers.ts` — shared constants, scoring functions, middleware helpers
- `index.ts` — orchestrator that imports and registers all route modules

Key architectural components and features include:
- **Authentication & Authorization**: Session-based authentication with a 7-tier role hierarchy for granular control, multi-tenancy, platform administration, user invitation systems, and password reset flow.
- **Platform Administration**: Dedicated section for `platform_owners` and `platform_admins` to manage organizations, users, and platform settings.
- **Report Branding**: Organization-level branding for DOCX reports, including logo, colors, and textual elements.
- **Plan-Based Usage Limits**: Enforces limits on platform resources (users, deals, storage, documents, AI queries) and gates feature access based on subscription plans.
- **Document Management**: Secure document deletion with impact analysis, batch operations, and protection for closed deals.
- **Document Ingestion Pipeline**: Processes various document types, performs text extraction, AI vision analysis for image-based finding creation, content-based classification, recursive ZIP extraction, SHA-256 deduplication, and sentence-aware text chunking.
- **Document Preview System**: Generates and displays previews for various document types (images, PDF, text, HTML, spreadsheets, slides, email) with a slide-over panel.
- **Vector Embeddings & Semantic Search**: Uses OpenAI embeddings with `pgvector` for similarity search, implementing a three-tier search fallback (vector, full-text, keyword).
- **Infrastructure Intelligence (AI-Powered)**: Extracts and reconstructs IT infrastructure data from documents using Claude AI, including tech stack detection, network topology mapping, and acquirer baseline alignment with gap analysis.
- **Evidence Confidence Weighted Scoring**: Adjusts pillar risk scores based on document evidence coverage, using a four-tier confidence model linked to specific document classifications.
- **AI-Powered Integration Playbook**: Generates structured, phased integration playbooks using Claude AI, based on deal documents, tech stack, and findings.
- **Digital Twin Simulator**: Provides Monte Carlo cost forecasting for M&A integration across different migration scenarios, using deal data to compute complexity and risk multipliers.
- **Portfolio Analytics**: Offers cross-deal analytics, including KPI summaries, risk trend charts, deal score comparisons, and pillar matrices, with filtering by deal lifecycle stage.
- **Report Export (AI-Powered)**: Generates IC-grade DOCX and Excel reports with AI-powered finding consolidation, executive summaries, pillar narratives, and detailed appendices.
- **Security Middleware**: Implements API rate limiting (global, auth, AI) and CSRF protection using `express-rate-limit` and CSRF token validation.
- **Structured Logging**: Utilizes Pino for structured JSON logging, with request-specific child loggers.
- **Error Boundaries**: Client-side error boundaries for graceful handling of fatal and page-specific crashes, with optional Sentry reporting.
- **Error Monitoring**: Optional Sentry integration (@sentry/node + @sentry/react) configured via SENTRY_DSN / VITE_SENTRY_DSN env vars.
- **Deal Lifecycle Stage**: Tracks deals through five stages: Screening, Assessment, Day-1 Ready, Integration, and Monitoring.
- **Baseline Profiles**: Organization-level acquirer technology baseline profiles with CRUD operations.
- **Configurable Pillar Templates**: Organization-level pillar template overrides; platform defaults seeded (6 pillars). New deals copy from org templates or platform defaults.
- **Configurable Tech Categories**: Organization-level tech category overrides; platform defaults seeded (12 categories).
- **Password Reset**: Token-based password reset with 1-hour expiry, Forgot Password UI on login page.
- **Email Delivery**: Resend SDK with console fallback (no RESEND_API_KEY = log to console). Handles invitations, password resets, account approvals/rejections.
- **Ask MERIDIAN (Unified AI Chat)**: A RAG-powered AI assistant with persistent conversation threads, contextual retrieval (chunks, findings, pillar scores), document/finding citation parsing, confidence scores, source attribution, and saved answer similarity matching.

The UI employs a dark theme by default, with a specific color palette (blue, green, amber, red, purple, cyan) and DM Sans for UI text, JetBrains Mono for data. Navigation includes Pipeline, Risk, Ask AI, Infra, Playbook, Simulator, Portfolio, Reports, and Settings.

## Testing
- **Vitest**: 28 unit tests across 5 files (auth, deals, documents, RBAC, org-isolation) with mocked storage layer. Run with `npx vitest run`.
- **GitHub Actions CI**: `.github/workflows/ci.yml` — runs on PRs to main/dev with checkout, Node 20, npm ci, tsc, build.

## Database Migrations
- **Drizzle migrations** in `drizzle/migrations/` — baseline migration generated from current 30+ table schema.
- **Programmatic migration runner** in `server/db.ts` — `runMigrations()` called on app startup (warns gracefully if tables already exist from db:push).
- **Emergency push**: `npm run db:push` for direct schema sync.

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Object Relational Mapper for PostgreSQL.
- **express-session**: Middleware for session management.
- **connect-pg-simple**: PostgreSQL session store.
- **Replit Object Storage**: Cloud storage for file uploads.
- **pdf-parse v1**: PDF text extraction library.
- **mammoth**: DOCX to HTML conversion.
- **exceljs**: XLSX/CSV parsing and generation.
- **mailparser**: Email parsing library.
- **sharp**: High-performance image processing.
- **OpenRouter API**: Unified AI gateway for LLM, embedding, and vision models.
- **pgvector**: PostgreSQL extension for vector similarity search.
- **docx**: Library for generating `.docx` files.
- **express-rate-limit**: Middleware for rate limiting API requests.
- **cookie-parser**: Middleware for parsing cookies.
- **pino**: Fast, JSON-based logger.
- **@sentry/node** + **@sentry/react**: Optional error monitoring (reads SENTRY_DSN / VITE_SENTRY_DSN).
- **vitest**: Unit testing framework.
- **resend**: Email delivery SDK (reads RESEND_API_KEY, falls back to console logging).
