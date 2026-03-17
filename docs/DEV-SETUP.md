# Cavaridge Platform — Development Setup

Last updated: 2026-03-16

---

## Prerequisites

### macOS (Homebrew)

Install the following tools:

```bash
# Node.js 20 (via nvm or brew)
brew install node@20

# pnpm (package manager)
brew install pnpm

# Doppler CLI (secret management)
brew install doppler

# PostgreSQL client (psql, pg_dump — no server needed)
brew install libpq
```

**libpq PATH note:** libpq is keg-only (not symlinked). Add to your shell profile:

```bash
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Authenticate Doppler

```bash
doppler login
```

This opens a browser for OAuth. You'll see an auth code in the terminal — confirm it matches in the browser.

### Verify Doppler Access

```bash
doppler run -p cavaridge-platform -c dev -- printenv DATABASE_URL
```

If this returns a PostgreSQL connection string, you're good.

---

## Doppler Projects

| Doppler Project | Purpose | Key Secrets |
|-----------------|---------|-------------|
| `cavaridge-platform` | Shared platform database + core services | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |

Each app will have its own Doppler project (e.g., `cavaridge-meridian`, `cavaridge-caelum`) with app-specific secrets plus a `CAVARIDGE_PLATFORM_DB_URL` pointing to the shared database.

---

## Database Setup

The platform uses a single Supabase PostgreSQL instance shared across all apps, with per-app roles for least-privilege access and RLS for tenant isolation.

### Run Migrations

Execute these 4 scripts **in order** from the `migrations/` directory:

```bash
cd migrations/

# 1. Platform setup: pgaudit, 8 app roles, audit table, session context functions
doppler run -p cavaridge-platform -c dev -- sh -c 'psql $DATABASE_URL -f 000_platform_setup.sql'

# 2. Tenants bootstrap: tenants + users tables (UTM 4-tier hierarchy)
doppler run -p cavaridge-platform -c dev -- sh -c 'psql $DATABASE_URL -f 000b_tenants_bootstrap.sql'

# 3. Cavalier Partners: 13 operational tables (PSA + connectors), 14 enums
doppler run -p cavaridge-platform -c dev -- sh -c 'psql $DATABASE_URL -f 001_cavalier_partners.sql'

# 4. Role grants + RLS policies: least-privilege matrix, tenant isolation
doppler run -p cavaridge-platform -c dev -- sh -c 'psql $DATABASE_URL -f 002_role_grants.sql'
```

**Important:** Use `sh -c 'psql $DATABASE_URL ...'` (single quotes) so the shell inside Doppler expands `$DATABASE_URL`, not your local shell.

### Verify

```bash
# Check all tables exist (expect 16 tables)
doppler run -p cavaridge-platform -c dev -- sh -c 'psql $DATABASE_URL -c "\dt"'

# Check RLS is enabled on all tables
doppler run -p cavaridge-platform -c dev -- sh -c 'psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = '\''public'\'' AND rowsecurity = true;"'
```

### Supabase-Specific Notes

- **auth schema is read-only.** Supabase owns the `auth` schema. Session context functions (`tenant_id()`, `user_id()`, `user_role()`) live in `public` schema. All RLS policies reference `public.tenant_id()`.
- **pgaudit config** is managed via Supabase Dashboard > Database > Extensions, not via `ALTER SYSTEM SET`. The extension itself is enabled via SQL.
- **Connection string** is found at Supabase Dashboard > Settings > Database > Connection string (URI).

---

## Monorepo Setup

```bash
# Clone and install
git clone git@github.com:Cavaridge-LLC/cavaridge.git
cd cavaridge
pnpm install
```

### Workspace Structure

```
cavaridge/
├── apps/          # Deployable applications
├── packages/      # Shared libraries (@cavaridge/*)
├── migrations/    # Platform database migrations (run via psql)
├── docs/          # Architecture specs, this setup guide
├── scripts/       # CI/CD utilities
└── templates/     # New app scaffolds
```

### Common Commands

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm -r build

# Typecheck
pnpm -r typecheck

# Run a specific app in dev mode
pnpm --filter @cavaridge/meridian dev
```

---

## Database Schema Summary

### Tables (16 total)

| Table | Owner | Purpose |
|-------|-------|---------|
| `tenants` | Core | UTM 4-tier hierarchy (platform > msp > client > site/prospect) |
| `users` | Core | Platform users with RBAC roles |
| `tickets` | Core | PSA ticket management |
| `ticket_comments` | Core | Threaded ticket comments (internal + public) |
| `ticket_tags` | Core | Ticket categorization tags |
| `sla_policies` | Core | SLA definitions per tenant/priority |
| `business_hours` | Core | Tenant business hours for SLA calculation |
| `contracts` | Midas | Service contracts and agreements |
| `invoices` | Midas | Invoice headers |
| `invoice_lines` | Midas | Invoice line items |
| `time_entries` | Core | Technician time tracking |
| `dispatch_slots` | Core | Technician scheduling |
| `service_catalog_items` | Core | Service offerings catalog |
| `connector_configs` | Core | External platform connector settings |
| `connector_sync_logs` | Core | Connector sync history and status |
| `platform_audit_log` | All | SOC 2 CC7.2 application-level audit trail |

### App Roles (8)

| Role | App | Access Pattern |
|------|-----|---------------|
| `role_core` | CVG-CORE | Broadest: CRUD on operational tables |
| `role_midas` | CVG-MIDAS | Billing: owns contracts, invoices, time entries |
| `role_astra` | CVG-ASTRA | Client portal: create tickets, view own data |
| `role_ai` | CVG-AI (Spaniel) | AI enrichment: read tickets, write AI fields only |
| `role_aegis` | CVG-AEGIS | Security: manage security connectors |
| `role_ducky` | CVG-RESEARCH (Ducky) | Read-only across operational tables |
| `role_vespar` | CVG-VESPAR | Reporting: read-only everything |
| `role_caelum` | CVG-CAELUM | SoW generation: read contracts, tickets, SLA |

### RLS Tenant Isolation

Every table has a `tenant_isolation_*` policy enforcing `tenant_id = public.tenant_id()`. Apps set the session context before queries:

```sql
SET LOCAL app.current_tenant_id = '<tenant-uuid>';
SET LOCAL app.current_user_id = '<user-uuid>';
SET LOCAL app.current_user_role = '<role>';
```

---

## Troubleshooting

### `doppler: command not found`
```bash
brew install doppler
doppler login
```

### `psql: command not found`
```bash
brew install libpq
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
```

### `psql: error: connection to server on socket "/tmp/.s.PGSQL.5432"`
The `$DATABASE_URL` isn't being expanded. Wrap the command in `sh -c '...'`:
```bash
doppler run -p cavaridge-platform -c dev -- sh -c 'psql $DATABASE_URL -f script.sql'
```

### `permission denied for schema auth`
Expected on Supabase. Session context functions are in `public` schema instead. The migration scripts are already patched for this.
