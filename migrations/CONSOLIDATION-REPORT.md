# Database Consolidation Report

**Date:** 2026-03-19
**Target Database:** cavaridge-platform (shared Supabase instance)
**Architecture Decision:** Per-app Postgres schemas (meridian, midas, ducky, caelum, astra, vespar)

---

## Migration Summary

| Migration File | App | Schema | Tables Created | Status |
|---------------|-----|--------|---------------|--------|
| 004_meridian.sql | CVG-MER Meridian | `meridian` | 29 | Ready to apply |
| 005_midas.sql | CVG-MIDAS Midas | `midas` | 7 | Ready to apply |
| 006_ducky.sql | CVG-RESEARCH Ducky | `ducky` | 11 | Ready to apply |
| 007_caelum.sql | CVG-CAELUM Caelum | `caelum` | 3 | Ready to apply |
| 008_astra.sql | CVG-ASTRA Astra | `astra` | 4 | Ready to apply |
| 009_vespar.sql | CVG-VESPAR Vespar | `vespar` | 6 | Ready to apply |
| 010_data_import.sql | (all) | — | Template | Requires manual execution |
| **Total** | | | **60 app tables** | |

---

## Data to Preserve

| App | Table | Expected Rows | Source DB |
|-----|-------|--------------|-----------|
| Meridian | deals | 5 | meridian-specific Supabase |
| Meridian | pillars | 30 | meridian-specific Supabase |
| Meridian | findings | 8 | meridian-specific Supabase |
| Meridian | documents + chunks | varies | meridian-specific Supabase |
| Meridian | tech_stack_items | varies | meridian-specific Supabase |
| Meridian | topology_nodes | varies | meridian-specific Supabase |
| Midas | clients | 3 | midas-specific Supabase |
| Midas | initiatives | 9 | midas-specific Supabase |
| Midas | meetings | varies | midas-specific Supabase |
| Midas | snapshots | varies | midas-specific Supabase |
| Ducky | organizations | 1 | ducky-specific Supabase |
| Ducky | profiles | 1 | ducky-specific Supabase |
| Ducky | messages | 2 | ducky-specific Supabase |

**Tenant Mapping:** All existing data maps to the "Dedicated IT" MSP tenant in `public.tenants`. The old `organization_id` values will be replaced with the DIT `tenant_id` UUID during import.

---

## Code Changes

### Drizzle Schema Updates (per app)
- `pgTable(...)` replaced with `appSchema.table(...)` using `pgSchema("appname")`
- `organizations` / `profiles` table definitions removed (now shared via `public.tenants` / `public.users`)
- `organization_id` columns renamed to `tenant_id` with FK to `public.tenants(id)`
- All `createInsertSchema`, type exports, and Zod schemas preserved

### server/db.ts Updates (all 6 apps)
- Added `withTenantContext()` helper (standardized to `app.current_tenant_id`)
- Ducky: fixed existing `app.tenant_id` → `app.current_tenant_id` to match platform function

### Files Updated
| File | Change |
|------|--------|
| apps/meridian/shared/schema.ts | pgSchema("meridian"), org→tenant mapping |
| apps/midas/shared/schema.ts | pgSchema("midas"), org→tenant mapping |
| apps/ducky/shared/schema.ts | pgSchema("ducky"), removed org/profiles |
| apps/caelum/shared/models/auth.ts | Minimal FK-only tenants/users reference |
| apps/caelum/shared/models/chat.ts | pgSchema("caelum"), removed UTM tables |
| apps/astra/shared/models/auth.ts | Minimal FK-only reference |
| apps/astra/shared/models/utm.ts | Minimal tenants reference |
| apps/astra/shared/models/license.ts | pgSchema("astra") |
| apps/vespar/shared/schema.ts | pgSchema("vespar"), removed org/profiles/audit |
| apps/*/server/db.ts (all 6) | Added withTenantContext() |

---

## Execution Plan

### Step 1: Apply Schema Migrations
Run in order against cavaridge-platform:
```bash
psql $PLATFORM_DB_URL -f migrations/004_meridian.sql
psql $PLATFORM_DB_URL -f migrations/005_midas.sql
psql $PLATFORM_DB_URL -f migrations/006_ducky.sql
psql $PLATFORM_DB_URL -f migrations/007_caelum.sql
psql $PLATFORM_DB_URL -f migrations/008_astra.sql
psql $PLATFORM_DB_URL -f migrations/009_vespar.sql
```

### Step 2: Create DIT Tenant
Ensure the Dedicated IT MSP tenant exists in `public.tenants` (see 010_data_import.sql).

### Step 3: Export Data from Old Databases
For each app with data:
```bash
# Meridian
psql $MERIDIAN_DB_URL -c "\copy deals TO '/tmp/meridian_deals.csv' CSV HEADER"
psql $MERIDIAN_DB_URL -c "\copy pillars TO '/tmp/meridian_pillars.csv' CSV HEADER"
psql $MERIDIAN_DB_URL -c "\copy findings TO '/tmp/meridian_findings.csv' CSV HEADER"
# ... all populated tables

# Midas
psql $MIDAS_DB_URL -c "\copy clients TO '/tmp/midas_clients.csv' CSV HEADER"
psql $MIDAS_DB_URL -c "\copy initiatives TO '/tmp/midas_initiatives.csv' CSV HEADER"
# ... all populated tables

# Ducky
psql $DUCKY_DB_URL -c "\copy conversations TO '/tmp/ducky_conversations.csv' CSV HEADER"
psql $DUCKY_DB_URL -c "\copy messages TO '/tmp/ducky_messages.csv' CSV HEADER"
```

### Step 4: Import Data
Use 010_data_import.sql as template. Replace `{{DIT_TENANT_ID}}` with actual UUID. Map `organization_id` columns to `tenant_id`.

### Step 5: Verify Row Counts
Run verification queries from 010_data_import.sql to confirm data integrity.

### Step 6: Update Environment Variables
For each app, update `DATABASE_URL` to point to cavaridge-platform:

| App | Doppler Project | Railway Service | New DATABASE_URL |
|-----|----------------|-----------------|------------------|
| Meridian | meridian | meridian-web | cavaridge-platform connection string |
| Midas | midas | midas-web | cavaridge-platform connection string |
| Ducky | ducky | ducky-web | cavaridge-platform connection string |
| Caelum | caelum | caelum-web | cavaridge-platform connection string |
| Astra | astra | astra-web | cavaridge-platform connection string |
| Vespar | vespar | vespar-web | cavaridge-platform connection string |

### Step 7: Deploy and Verify
Redeploy each app. Verify:
- Build succeeds
- Health endpoint returns 200
- Existing data accessible (Meridian: 5 deals, Midas: 3 clients)

---

## Old Database Deletion Assessment

| Old Supabase Project | App | Has Live Data? | Data Migrated? | Safe to Delete? |
|---------------------|-----|---------------|----------------|-----------------|
| meridian-supabase | CVG-MER | YES (5 deals, 30 pillars, 8 findings) | PENDING | NO — verify after import |
| midas-supabase | CVG-MIDAS | YES (3 clients, 9 initiatives) | PENDING | NO — verify after import |
| ducky-supabase | CVG-RESEARCH | YES (1 org, 1 user, 2 msgs) | PENDING | NO — verify after import |
| caelum-supabase | CVG-CAELUM | Minimal/empty | PENDING | NO — verify after import |
| astra-supabase | CVG-ASTRA | Minimal/empty | PENDING | NO — verify after import |
| vespar-supabase | CVG-VESPAR | Empty | PENDING | NO — verify after import |

**DO NOT DELETE any old database until:**
1. All schema migrations applied successfully
2. All data imported and row counts verified
3. All apps redeployed and health checks pass
4. Benjamin manually confirms each app works against the shared DB

---

## RLS Enforcement

Every table in every app schema has:
- `tenant_id uuid NOT NULL REFERENCES public.tenants(id)`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY tenant_isolation_... FOR ALL USING (tenant_id = public.tenant_id())`

The `public.tenant_id()` function reads `app.current_tenant_id` from the session, set by `withTenantContext()` in each app's `server/db.ts`.

---

## Known Follow-up Work

1. **Server-side code updates:** Each app's route handlers and storage layers still reference `organizationId` in many places. These need updating to `tenantId`. The schema changes are backward-compatible at the Drizzle level but the column names changed in the DB.

2. **Drizzle config updates:** Each app's `drizzle.config.ts` may need `schemaFilter` to target the correct Postgres schema for `drizzle-kit push/pull`.

3. **Auth middleware:** Apps that check `organizationId` in auth middleware need updating to use `tenantId` with the shared `public.tenants` table.

4. **packages/auth schema.ts:** The canonical auth schema in `packages/auth/src/schema.ts` should be updated to export the shared `tenants` reference instead of the legacy `organizations` table.

5. **Role grants (002_role_grants.sql):** Needs an update to grant app roles access to their respective app schemas (currently only grants to public schema tables).
