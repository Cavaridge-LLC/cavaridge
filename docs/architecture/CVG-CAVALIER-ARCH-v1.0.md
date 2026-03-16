# CVG-CAVALIER-ARCH-v1.0 — Cavaridge Cavalier Partners Architecture

**Version:** 1.0  
**Date:** 2026-03-15  
**Status:** Approved  
**Owner:** Benjamin Posner, Principal — Cavaridge, LLC  

---

## 1. Overview

Cavaridge Cavalier Partners is the channel partner program enabling MSPs, IT consultants, and managed services operators to deliver AI-native, compliance-first managed services powered by the Cavaridge platform. This document defines the technical architecture for all Cavalier Partners capabilities within the Cavaridge monorepo.

**Core Positioning:** "Bring your RMM, we handle everything else — including making your RMM smarter."

## 2. Architecture Principles

1. **Tenant isolation is non-negotiable.** Every partner, client, and site operates within the Universal Tenant Model (Platform → MSP → Client → Site/Prospect). Supabase RLS enforces isolation at the database layer.
2. **Connectors are the integration surface.** Cavaridge never replaces a partner's RMM. Connectors ingest, enrich, and correlate data from external platforms. All connector logic lives in `packages/connectors/`.
3. **PSA-lite is distributed, not monolithic.** PSA capabilities are spread across existing apps (Core, Midas, Astra, Spaniel) unified by `packages/psa-core/` shared schemas and engines.
4. **AI enrichment is default.** Every ticket, alert, and compliance scan passes through Spaniel for classification, prioritization, and resolution suggestions. Partners don't configure this — it's built in.
5. **Partner branding is config, not code.** All partner-facing surfaces use tenantConfig for branding (logo, colors, domain). "Powered by Ducky AI" footer is mandatory per Cavaridge brand standards.

## 3. Package Architecture

### 3.1 New Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@cavaridge/psa-core` | `packages/psa-core/` | Shared PSA schemas (Drizzle), SLA engine, ticket engine, billing engine, dispatch engine, BullMQ queue definitions |
| `@cavaridge/connector-core` | `packages/connector-core/` | Base connector interfaces, connector registry, sync engine, health monitoring, credential management |
| `@cavaridge/connector-ninjaone` | `packages/connectors/ninjaone/` | NinjaOne RMM connector — device sync, alert ingestion, patch status, scripting triggers |
| `@cavaridge/connector-halopsa` | `packages/connectors/halopsa/` | HaloPSA connector — ticket sync, contract sync, time entry sync, billing alignment |
| `@cavaridge/connector-guardz` | `packages/connectors/guardz/` | Guardz connector — security posture ingestion, threat detection feed, compliance score sync |
| `@cavaridge/connector-atera` | `packages/connectors/atera/` | Atera connector — device sync, alert ingestion, ticket sync (bidirectional) |
| `@cavaridge/connector-syncro` | `packages/connectors/syncro/` | Syncro connector — device sync, alert ingestion, M365 governance data |

### 3.2 Existing Package Modifications

| Package | Modification |
|---------|-------------|
| `packages/auth/` | Add `partner_profiles` and `partner_tiers` to tenant model. Add `partner_admin` and `partner_tech` RBAC roles. |
| `packages/agent-core/` | Add connector event handlers for Spaniel agent pipelines. |
| `packages/agents/` | Add `ticket-triage-agent`, `sla-monitor-agent`, `connector-health-agent`. |

### 3.3 App Modifications

| App | Modification |
|-----|-------------|
| CVG-CORE | Absorb ticket queue UI, dispatch board, SLA dashboard, partner onboarding wizard, connector management UI. |
| CVG-MIDAS | Absorb contract management, recurring billing, invoice generation from psa-core schemas. |
| CVG-ASTRA | Extend client portal with ticket submission, SLA visibility, service catalog, approval workflows. |
| CVG-AI (Spaniel) | Add ticket enrichment pipeline, alert correlation engine, connector event processing. |
| CVG-RESEARCH (Ducky) | Add partner onboarding guided flow, connector setup wizard, Cavalier Partners help content. |
| CVG-AEGIS | Add Guardz posture score ingestion, unified security dashboard combining RMM + Guardz + EDR data. |
| CVG-VESPAR | Add partner-level reporting: MRR tracking, client health rollup, SLA compliance across portfolio. |

## 4. Data Flow Architecture

```
External Platforms          Connector Layer              Cavaridge Platform
─────────────────          ─────────────────            ──────────────────
                           ┌─────────────────┐
NinjaOne ──── alerts ────► │ connector-core   │ ──► Spaniel (AI Triage)
         ──── devices ───► │   sync-engine    │ ──► psa-core (Tickets)
         ──── patches ───► │   registry       │ ──► AEGIS (Compliance)
                           │   health-monitor │
HaloPSA  ──── tickets ──► │                   │ ──► Midas (Billing)
         ──── contracts ─► │   Credential     │ ──► Vespar (Reporting)
         ──── time ──────► │   Vault (Doppler)│
                           │                   │ ──► Astra (Client Portal)
Guardz   ──── posture ──► │                   │
         ──── threats ───► │                   │ ──► Brain (Knowledge)
         ──── compliance ► │                   │
                           └─────────────────┘
Atera    ──── devices ───►
         ──── alerts ────►
         ──── tickets ──►

Syncro   ──── devices ───►
         ──── alerts ────►
         ──── m365 ─────►
```

## 5. Connector Lifecycle

### 5.1 States

```
UNCONFIGURED → CONFIGURING → CONNECTED → SYNCING → ACTIVE → ERROR → DISABLED
```

### 5.2 Sync Modes

| Mode | Description | Frequency |
|------|-------------|-----------|
| `full_sync` | Complete data pull from external platform | Daily (configurable) |
| `incremental_sync` | Delta changes since last sync cursor | Every 5 minutes |
| `webhook` | Real-time push from external platform | Instant |
| `on_demand` | Manual trigger by partner or system | As needed |

### 5.3 Health Monitoring

Every connector reports health metrics to `connector-core`:
- `last_sync_at`: Timestamp of last successful sync
- `last_error_at`: Timestamp of last error
- `sync_lag_seconds`: Time since last expected sync
- `records_synced`: Count of records in last sync cycle
- `error_rate`: Rolling 1-hour error percentage

The `connector-health-agent` (Spaniel) monitors these metrics and alerts partners when connector health degrades.

## 6. PSA-Lite Architecture

See `CVG-PSA-CORE-v1.0.md` for full specification.

**Summary:** PSA-lite is a capability distributed across CVG-CORE (ticket UI, dispatch), CVG-MIDAS (billing, contracts), CVG-ASTRA (client portal), and CVG-AI (ticket enrichment), unified by `packages/psa-core/` which provides:

- Drizzle ORM schemas for all PSA entities
- SLA engine (breach detection, escalation, business hours calculation)
- Ticket engine (lifecycle management, assignment, categorization)
- Billing engine (contract-to-invoice pipeline, time entry aggregation)
- Dispatch engine (technician workload, calendar integration, assignment optimization)
- BullMQ queue definitions for async processing (SLA monitoring, ticket enrichment)

## 7. Partner Tier Capabilities

| Capability | Starter | Professional | Enterprise |
|------------|---------|-------------|-----------|
| Ducky AI + Spaniel | ✓ | ✓ | ✓ |
| PSA-lite (tickets, SLA, time) | ✓ | ✓ | ✓ |
| Client Portal (Astra) | ✓ | ✓ | ✓ |
| Connectors | 2 RMM + 3 standard | 4 RMM + 10 standard | Unlimited |
| Caelum (SoW generation) | — | ✓ | ✓ |
| Midas (billing, contracts) | — | ✓ | ✓ |
| Vespar (reporting) | Basic | Full | Full + custom |
| HIPAA compliance | Templates only | Full automation | Full + audit prep |
| AEGIS (security posture) | — | — | ✓ |
| Meridian (M&A intel) | — | — | ✓ |
| Brain (knowledge capture) | — | — | ✓ |
| Branding | Co-branded | Partner-branded | Full white-label |
| Support | Community | Priority Slack | Dedicated PSM |

## 8. RBAC Extensions

New roles added to the existing 6-role model:

| Role | Scope | Permissions |
|------|-------|------------|
| `partner_admin` | MSP tenant | Full access to all Cavalier Partners features. Manage connectors, partner settings, billing. Equivalent to MSP Admin with Cavalier extensions. |
| `partner_tech` | MSP tenant | Ticket management, dispatch, time entry, client portal admin. Cannot manage connectors or billing. Equivalent to MSP Tech with Cavalier extensions. |
| `partner_viewer` | MSP tenant | Read-only dashboard access. Reporting and SLA visibility. No ticket modification. |

These roles compose with existing RBAC — a user can be both `msp_admin` (base platform) and `partner_admin` (Cavalier extensions).

## 9. Security Considerations

- **Connector credentials** are stored in Doppler (staging/prod) or encrypted tenant config (dev). Never in `.env` files or database columns.
- **OAuth tokens** for NinjaOne, HaloPSA, and others use the standard OAuth 2.0 authorization code flow. Refresh tokens are rotated per platform-specific intervals.
- **Webhook endpoints** validate signatures per platform (HMAC-SHA256 for NinjaOne, custom for others). Invalid signatures are rejected and logged.
- **Rate limiting** per connector instance prevents API abuse. Configurable per platform and tenant.
- **Data residency** follows tenant configuration. Connector data is stored in the same Supabase region as the tenant.

## 10. Observability

- All connector sync operations emit structured logs to the Cavaridge logging pipeline.
- All LLM calls (ticket enrichment, alert correlation) are traced via Langfuse per existing standards.
- Connector health metrics are exposed via `/api/health/connectors` for monitoring.
- SLA breach events emit to the alerting pipeline (BullMQ → notification service).

## 11. References

| Document | Code | Description |
|----------|------|-------------|
| Cavalier Partners GTM | CVG-CAVALIER-GTM-v1.0 | Business strategy, module map, revenue model, go-to-market phases |
| PSA-Core Specification | CVG-PSA-CORE-v1.0 | Detailed PSA-lite module architecture, data model, engine specifications |
| Connector Framework | CVG-CONNECTOR-FRAMEWORK-v1.0 | Connector interfaces, registry, sync engine, health monitoring |
| Agent Architecture Addendum A | CVG-ARCH-ADDENDUM-A-v1.0 | 3-tier agent model, 25-connector architecture, domain agents |
| Core Dev Standards | CVG-CORE-DEV-v2.0 | Monorepo conventions, toolchain, deployment standards |
| SoW Master Spec | SOW-MASTER-SPEC-v2_1 | SoW generation standards for Caelum |
