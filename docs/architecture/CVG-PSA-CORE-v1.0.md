# CVG-PSA-CORE-v1.0 — PSA-Lite Module Specification

**Version:** 1.0  
**Date:** 2026-03-15  
**Status:** Approved  
**Owner:** Benjamin Posner, Principal — Cavaridge, LLC  

---

## 1. Overview

`@cavaridge/psa-core` is a shared package providing Professional Services Automation capabilities distributed across the Cavaridge platform. It is not a standalone app — it provides Drizzle ORM schemas, business logic engines, TypeScript types, and BullMQ queue definitions consumed by CVG-CORE, CVG-MIDAS, CVG-ASTRA, and CVG-AI.

## 2. Entity Relationship Model

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   tenants    │────►│   contracts  │────►│ sla_policies │
│ (from auth)  │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │     ┌──────────────┼────────────────────┘
       │     │              │
       ▼     ▼              ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   tickets    │────►│ time_entries │     │   invoices   │
│              │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │                    └──────────┐         │
       │                               ▼         ▼
       │                        ┌──────────────┐
       │                        │invoice_lines │
       │                        └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ticket_comments│    │ticket_tags   │
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│dispatch_slots│     │business_hours│
└──────────────┘     └──────────────┘

┌──────────────────┐
│service_catalog   │
│  _items          │
└──────────────────┘
```

## 3. Schema Definitions

### 3.1 tickets

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| tenant_id | uuid | FK tenants, NOT NULL | Scoped to MSP tenant |
| client_id | uuid | FK tenants, NOT NULL | Client sub-tenant |
| site_id | uuid | FK tenants, NULLABLE | Optional site-level scoping |
| ticket_number | text | UNIQUE per tenant, NOT NULL | Human-readable (e.g., TKT-00001) |
| subject | text | NOT NULL | |
| description | text | | Rich text / markdown |
| status | enum | NOT NULL, default 'new' | new, open, pending, on_hold, resolved, closed, cancelled |
| priority | enum | NOT NULL, default 'medium' | critical, high, medium, low |
| category | text | | AI-assigned or manual |
| subcategory | text | | AI-assigned or manual |
| source | enum | NOT NULL, default 'manual' | manual, email, portal, phone, chat, connector, alert |
| assigned_to | uuid | FK users, NULLABLE | Assigned technician |
| requested_by | uuid | FK users, NULLABLE | End-user who raised ticket |
| sla_policy_id | uuid | FK sla_policies, NULLABLE | |
| sla_response_due | timestamptz | NULLABLE | Calculated by SLA engine |
| sla_resolution_due | timestamptz | NULLABLE | Calculated by SLA engine |
| sla_responded_at | timestamptz | NULLABLE | First response timestamp |
| sla_resolved_at | timestamptz | NULLABLE | Resolution timestamp |
| sla_response_breached | boolean | default false | |
| sla_resolution_breached | boolean | default false | |
| contract_id | uuid | FK contracts, NULLABLE | Associated service contract |
| connector_source | text | NULLABLE | Connector ID that created this ticket (e.g., 'ninjaone', 'halopsa') |
| connector_external_id | text | NULLABLE | External system ticket ID |
| ai_category_confidence | real | NULLABLE | Spaniel's confidence score for auto-categorization |
| ai_priority_score | real | NULLABLE | Spaniel's computed priority score |
| ai_suggested_resolution | text | NULLABLE | Spaniel's resolution suggestion |
| ai_similar_ticket_ids | uuid[] | NULLABLE | IDs of similar historical tickets |
| custom_fields | jsonb | default '{}' | Tenant-configurable custom fields |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |
| closed_at | timestamptz | NULLABLE | |

**Indexes:** tenant_id, client_id, status, priority, assigned_to, sla_response_due, sla_resolution_due, connector_source + connector_external_id (unique), created_at DESC.

**RLS Policy:** `tenant_id = auth.tenant_id()` — enforced at Supabase level.

### 3.2 ticket_comments

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| ticket_id | uuid | FK tickets, NOT NULL | |
| tenant_id | uuid | FK tenants, NOT NULL | Denormalized for RLS |
| author_id | uuid | FK users, NOT NULL | |
| body | text | NOT NULL | Markdown content |
| is_internal | boolean | default false | Internal notes not visible to client |
| is_resolution | boolean | default false | Marks this as the resolution note |
| source | enum | default 'manual' | manual, email, portal, ai, connector |
| created_at | timestamptz | NOT NULL, default now() | |

### 3.3 sla_policies

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK tenants, NOT NULL | |
| name | text | NOT NULL | e.g., "Gold SLA", "Standard SLA" |
| description | text | | |
| response_target_critical | integer | NOT NULL | Minutes for critical priority |
| response_target_high | integer | NOT NULL | |
| response_target_medium | integer | NOT NULL | |
| response_target_low | integer | NOT NULL | |
| resolution_target_critical | integer | NOT NULL | |
| resolution_target_high | integer | NOT NULL | |
| resolution_target_medium | integer | NOT NULL | |
| resolution_target_low | integer | NOT NULL | |
| business_hours_id | uuid | FK business_hours, NULLABLE | NULL = 24/7 |
| escalation_rules | jsonb | default '[]' | Array of escalation rule objects |
| is_default | boolean | default false | Default policy for new tickets |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

**Escalation rules schema:**
```json
[
  {
    "trigger": "response_breach_warning",
    "threshold_percent": 80,
    "action": "notify",
    "target": "assigned_tech",
    "channel": "slack"
  },
  {
    "trigger": "response_breach",
    "threshold_percent": 100,
    "action": "escalate",
    "target": "team_lead",
    "channel": "email+slack"
  }
]
```

### 3.4 business_hours

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK tenants, NOT NULL | |
| name | text | NOT NULL | e.g., "US Eastern Business Hours" |
| timezone | text | NOT NULL | IANA timezone (e.g., "America/New_York") |
| schedule | jsonb | NOT NULL | Weekly schedule object |
| holidays | jsonb | default '[]' | Array of holiday date strings |
| created_at | timestamptz | NOT NULL, default now() | |

**Schedule schema:**
```json
{
  "monday":    { "start": "08:00", "end": "17:00" },
  "tuesday":   { "start": "08:00", "end": "17:00" },
  "wednesday": { "start": "08:00", "end": "17:00" },
  "thursday":  { "start": "08:00", "end": "17:00" },
  "friday":    { "start": "08:00", "end": "17:00" },
  "saturday":  null,
  "sunday":    null
}
```

### 3.5 time_entries

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK tenants, NOT NULL | |
| ticket_id | uuid | FK tickets, NULLABLE | Can exist without a ticket (admin time, meetings) |
| user_id | uuid | FK users, NOT NULL | Technician |
| start_time | timestamptz | NOT NULL | |
| end_time | timestamptz | NULLABLE | NULL = timer still running |
| duration_mins | integer | NULLABLE | Calculated or manual override |
| billable | boolean | default true | |
| rate_override | numeric(10,2) | NULLABLE | NULL = use contract rate |
| work_type | enum | default 'reactive' | reactive, proactive, project, admin, travel |
| notes | text | | |
| approved | boolean | default false | |
| approved_by | uuid | FK users, NULLABLE | |
| approved_at | timestamptz | NULLABLE | |
| invoice_line_id | uuid | FK invoice_lines, NULLABLE | Link to billed invoice line |
| connector_external_id | text | NULLABLE | If synced from external PSA |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

### 3.6 contracts

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK tenants, NOT NULL | MSP tenant |
| client_id | uuid | FK tenants, NOT NULL | Client sub-tenant |
| name | text | NOT NULL | e.g., "Managed Services Agreement - Acme Corp" |
| contract_number | text | UNIQUE per tenant | Human-readable (e.g., CTR-00001) |
| type | enum | NOT NULL | managed, block_hours, time_and_materials, project, retainer |
| status | enum | NOT NULL, default 'draft' | draft, active, expiring, expired, cancelled |
| start_date | date | NOT NULL | |
| end_date | date | NULLABLE | NULL = evergreen |
| monthly_amount | numeric(10,2) | NULLABLE | For managed/retainer contracts |
| hourly_rate | numeric(10,2) | NULLABLE | For T&M contracts |
| block_hours_total | integer | NULLABLE | For block hours contracts |
| block_hours_used | integer | default 0 | Running total of consumed hours |
| block_hours_rollover | boolean | default false | Whether unused hours roll over |
| sla_policy_id | uuid | FK sla_policies, NULLABLE | SLA tier for this contract |
| auto_renew | boolean | default true | |
| renewal_term_months | integer | default 12 | |
| notice_period_days | integer | default 30 | Days before end to alert |
| scope_description | text | | What's covered under this contract |
| exclusions | text | | What's explicitly excluded |
| connector_external_id | text | NULLABLE | If synced from external PSA |
| custom_fields | jsonb | default '{}' | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

### 3.7 invoices

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK tenants, NOT NULL | |
| client_id | uuid | FK tenants, NOT NULL | |
| invoice_number | text | UNIQUE per tenant | Human-readable (e.g., INV-2026-00001) |
| status | enum | NOT NULL, default 'draft' | draft, approved, sent, paid, overdue, void |
| period_start | date | NOT NULL | Billing period start |
| period_end | date | NOT NULL | Billing period end |
| due_date | date | NOT NULL | |
| subtotal | numeric(10,2) | NOT NULL, default 0 | |
| tax_rate | numeric(5,4) | default 0 | |
| tax_amount | numeric(10,2) | default 0 | |
| total | numeric(10,2) | NOT NULL, default 0 | |
| paid_amount | numeric(10,2) | default 0 | |
| paid_at | timestamptz | NULLABLE | |
| notes | text | | |
| external_id | text | NULLABLE | QuickBooks/Xero invoice ID |
| external_system | text | NULLABLE | 'quickbooks', 'xero' |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

### 3.8 invoice_lines

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| invoice_id | uuid | FK invoices, NOT NULL | |
| tenant_id | uuid | FK tenants, NOT NULL | Denormalized for RLS |
| description | text | NOT NULL | |
| quantity | numeric(10,2) | NOT NULL, default 1 | |
| unit_price | numeric(10,2) | NOT NULL | |
| amount | numeric(10,2) | NOT NULL | quantity × unit_price |
| source_type | enum | NOT NULL | contract_recurring, time_entry, ad_hoc, expense |
| source_id | uuid | NULLABLE | FK to contract or time_entry |
| sort_order | integer | default 0 | Display order on invoice |
| created_at | timestamptz | NOT NULL, default now() | |

### 3.9 service_catalog_items

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK tenants, NOT NULL | |
| name | text | NOT NULL | e.g., "New User Setup", "VPN Access Request" |
| description | text | | |
| category | text | | |
| default_priority | enum | default 'medium' | |
| default_sla_policy_id | uuid | FK sla_policies, NULLABLE | |
| estimated_minutes | integer | NULLABLE | |
| requires_approval | boolean | default false | |
| visible_in_portal | boolean | default true | Shown in Astra client portal |
| form_schema | jsonb | default '{}' | Custom intake form fields |
| active | boolean | default true | |
| sort_order | integer | default 0 | |
| created_at | timestamptz | NOT NULL, default now() | |

### 3.10 dispatch_slots

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PK | |
| tenant_id | uuid | FK tenants, NOT NULL | |
| ticket_id | uuid | FK tickets, NOT NULL | |
| user_id | uuid | FK users, NOT NULL | Assigned technician |
| scheduled_start | timestamptz | NOT NULL | |
| scheduled_end | timestamptz | NOT NULL | |
| actual_start | timestamptz | NULLABLE | |
| actual_end | timestamptz | NULLABLE | |
| status | enum | default 'scheduled' | scheduled, in_progress, completed, cancelled, rescheduled |
| notes | text | | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

## 4. Engine Specifications

### 4.1 SLA Engine (`engine/sla-engine.ts`)

**Responsibilities:**
- Calculate `sla_response_due` and `sla_resolution_due` when a ticket is created or priority changes
- Account for business hours (skip non-working hours, holidays)
- Detect approaching breaches (80%, 90%, 100% thresholds)
- Trigger escalation rules from the associated SLA policy
- Recalculate SLA deadlines when a ticket is placed on hold (pause SLA clock) or taken off hold (resume)

**Key Functions:**
- `calculateDeadlines(ticket, slaPolicy, businessHours): { responseDue, resolutionDue }`
- `checkBreachStatus(ticket): { responseBreached, resolutionBreached, responsePercent, resolutionPercent }`
- `pauseSla(ticketId): void` — called when status changes to `on_hold`
- `resumeSla(ticketId): void` — called when status changes from `on_hold`
- `getBusinessMinutesBetween(start, end, businessHours): number`

### 4.2 Ticket Engine (`engine/ticket-engine.ts`)

**Responsibilities:**
- Ticket lifecycle management (create, update, assign, escalate, resolve, close)
- Auto-generate ticket_number per tenant (TKT-NNNNN, sequential)
- Auto-assign SLA policy from contract or tenant default
- Trigger AI enrichment pipeline on creation
- Manage ticket comment thread
- Handle email-to-ticket ingestion
- Handle connector-sourced ticket creation (dedup by connector_external_id)

**Key Functions:**
- `createTicket(input): Ticket`
- `updateTicket(id, updates): Ticket`
- `assignTicket(id, userId): Ticket`
- `addComment(ticketId, comment): TicketComment`
- `resolveTicket(id, resolutionComment): Ticket`
- `closeTicket(id): Ticket`
- `createFromEmail(parsedEmail): Ticket`
- `createFromConnector(connectorId, externalTicket): Ticket`
- `findSimilarTickets(ticket, limit): Ticket[]`

### 4.3 Billing Engine (`engine/billing-engine.ts`)

**Responsibilities:**
- Generate invoices from contracts (monthly recurring) and time entries (T&M)
- Auto-calculate invoice line amounts
- Block hours tracking (deduct from contract, alert on low balance)
- Contract renewal detection and alerting
- Export to QuickBooks/Xero via accounting connector

**Key Functions:**
- `generateMonthlyInvoices(tenantId, periodStart, periodEnd): Invoice[]`
- `addTimeEntryToInvoice(timeEntryId, invoiceId): InvoiceLine`
- `calculateContractRecurring(contract, period): InvoiceLine`
- `checkBlockHoursBalance(contractId): { total, used, remaining, percentUsed }`
- `getExpiringContracts(tenantId, daysAhead): Contract[]`
- `syncToAccounting(invoiceId, target): { externalId, status }`

### 4.4 Dispatch Engine (`engine/dispatch-engine.ts`)

**Responsibilities:**
- Create and manage dispatch slots for tickets
- Technician workload calculation (hours scheduled per day/week)
- Suggest optimal assignment based on skills, workload, and location
- Calendar integration (sync dispatch slots to Google/Outlook calendar)

**Key Functions:**
- `createSlot(ticketId, userId, start, end): DispatchSlot`
- `getTechnicianWorkload(userId, dateRange): WorkloadSummary`
- `suggestAssignment(ticket): AssignmentSuggestion[]`
- `getDispatchBoard(tenantId, dateRange): DispatchBoardView`

## 5. Queue Definitions

### 5.1 SLA Monitor Queue

- **Queue name:** `psa:sla-monitor`
- **Schedule:** Repeatable job every 60 seconds
- **Job:** Query all open tickets with SLA deadlines within the next warning threshold. For each approaching or breached SLA, execute the escalation rules defined in the ticket's SLA policy.
- **Concurrency:** 1 (sequential processing to avoid duplicate notifications)

### 5.2 Ticket Enrichment Queue

- **Queue name:** `psa:ticket-enrichment`
- **Trigger:** New ticket created (via ticket-engine event)
- **Job:** Send ticket subject + description + device context (from connector) to Spaniel agent pipeline. Receive back: auto-category, auto-subcategory, priority score, confidence score, suggested resolution, similar ticket IDs. Update ticket record with AI fields.
- **Concurrency:** 5 (parallel processing for throughput)
- **Retry:** 3 attempts with exponential backoff

### 5.3 Invoice Generation Queue

- **Queue name:** `psa:invoice-generation`
- **Schedule:** Repeatable job on the 1st of each month at 00:00 UTC
- **Job:** For each active contract with monthly billing, generate an invoice for the previous period. Queue accounting sync jobs for each generated invoice.
- **Concurrency:** 3

### 5.4 Contract Expiry Monitor

- **Queue name:** `psa:contract-expiry`
- **Schedule:** Daily at 06:00 UTC
- **Job:** Find contracts expiring within `notice_period_days`. Send renewal notifications to partner admin. Auto-renew contracts where `auto_renew = true` and generate new contract period.
- **Concurrency:** 1

## 6. API Surface

PSA-core does not expose its own API routes — the consuming apps (CVG-CORE, CVG-MIDAS, CVG-ASTRA) expose routes using psa-core engines and schemas. However, the expected API surface is:

### Tickets (CVG-CORE)
- `GET /api/tickets` — List tickets (filtered, paginated, sorted)
- `POST /api/tickets` — Create ticket
- `GET /api/tickets/:id` — Get ticket detail
- `PATCH /api/tickets/:id` — Update ticket
- `POST /api/tickets/:id/comments` — Add comment
- `POST /api/tickets/:id/assign` — Assign to technician
- `POST /api/tickets/:id/resolve` — Resolve with comment
- `POST /api/tickets/:id/close` — Close ticket

### Dispatch (CVG-CORE)
- `GET /api/dispatch/board` — Get dispatch board view
- `POST /api/dispatch/slots` — Create dispatch slot
- `PATCH /api/dispatch/slots/:id` — Update slot
- `GET /api/dispatch/workload/:userId` — Get technician workload

### Contracts (CVG-MIDAS)
- `GET /api/contracts` — List contracts
- `POST /api/contracts` — Create contract
- `GET /api/contracts/:id` — Get contract detail
- `PATCH /api/contracts/:id` — Update contract

### Invoices (CVG-MIDAS)
- `GET /api/invoices` — List invoices
- `POST /api/invoices/generate` — Trigger invoice generation
- `GET /api/invoices/:id` — Get invoice detail
- `POST /api/invoices/:id/send` — Send invoice to client
- `POST /api/invoices/:id/sync` — Sync to accounting platform

### Time Entries (CVG-CORE / CVG-MIDAS)
- `GET /api/time-entries` — List time entries
- `POST /api/time-entries` — Create time entry
- `POST /api/time-entries/:id/start` — Start timer
- `POST /api/time-entries/:id/stop` — Stop timer
- `POST /api/time-entries/:id/approve` — Approve time entry

### Service Catalog (CVG-ASTRA)
- `GET /api/service-catalog` — List catalog items (portal-visible)
- `POST /api/service-catalog/request` — Submit service request from portal

## 7. Event Bus

PSA-core emits events via a shared event bus (BullMQ or in-process EventEmitter for synchronous consumers):

| Event | Payload | Consumers |
|-------|---------|-----------|
| `ticket.created` | Ticket object | Ticket enrichment queue, connector sync, notification service |
| `ticket.updated` | Ticket + changed fields | SLA engine (priority change → recalc), connector sync |
| `ticket.assigned` | Ticket + assignee | Notification service, dispatch engine |
| `ticket.resolved` | Ticket + resolution | SLA engine (record resolution time), connector sync |
| `ticket.sla.warning` | Ticket + breach details | Notification service, escalation handler |
| `ticket.sla.breached` | Ticket + breach details | Escalation handler, Vespar reporting |
| `contract.expiring` | Contract + days remaining | Notification service, Midas alerting |
| `contract.renewed` | Contract | Midas billing, notification service |
| `invoice.generated` | Invoice | Accounting sync queue, notification service |
| `time_entry.approved` | TimeEntry | Billing engine (ready for invoicing) |
