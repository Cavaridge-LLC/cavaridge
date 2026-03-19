-- ============================================================
-- Cavaridge Platform — Data Import from App-Specific Databases
-- Run AFTER all schema migrations (004–009)
--
-- This script imports existing data from the per-app Supabase
-- instances into the shared cavaridge-platform database.
--
-- PREREQUISITES:
--   1. All schema migrations (004–009) have been applied
--   2. The DIT MSP tenant exists in public.tenants
--   3. Data has been exported from each app-specific instance
--
-- USAGE:
--   Replace {{DIT_TENANT_ID}} with the actual UUID of the
--   "Dedicated IT" MSP tenant from public.tenants.
--
--   Export data from each app-specific Supabase instance using:
--     psql $OLD_DB_URL -c "COPY (SELECT * FROM tablename) TO STDOUT WITH CSV HEADER" > tablename.csv
--
--   Then use \copy or COPY FROM to import, OR use the INSERT
--   templates below for small datasets.
-- ============================================================

BEGIN;

-- ─── STEP 0: Ensure DIT tenant exists ────────────────────────────────
-- If not already present, create the Dedicated IT MSP tenant.
-- Replace the UUID below with whatever ID you want to assign.

INSERT INTO public.tenants (id, parent_id, name, slug, tier, status, settings)
VALUES (
  '{{DIT_TENANT_ID}}',
  NULL,  -- top-level MSP (parent is the platform tenant if one exists)
  'Dedicated IT',
  'dedicated-it',
  'msp',
  'active',
  '{"branding": {"primaryColor": "#1a56db"}}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ─── STEP 1: Meridian Data Import ────────────────────────────────────
-- Source: meridian app-specific Supabase (5 deals, 30 pillars, 8 findings)
--
-- Export from old Meridian DB:
--   psql $MERIDIAN_DB_URL -c "\copy (SELECT * FROM deals) TO '/tmp/meridian_deals.csv' CSV HEADER"
--   psql $MERIDIAN_DB_URL -c "\copy (SELECT * FROM pillars) TO '/tmp/meridian_pillars.csv' CSV HEADER"
--   psql $MERIDIAN_DB_URL -c "\copy (SELECT * FROM findings) TO '/tmp/meridian_findings.csv' CSV HEADER"
--   ... repeat for all tables with data
--
-- Import into cavaridge-platform (adjust columns to match new schema):
--   NOTE: Old tables use organization_id; new tables use tenant_id.
--   Map the old organization UUID → DIT_TENANT_ID.
--
-- Option A: CSV import with column mapping
--   CREATE TEMP TABLE meridian_deals_import (LIKE meridian.deals);
--   \copy meridian_deals_import FROM '/tmp/meridian_deals.csv' CSV HEADER
--   INSERT INTO meridian.deals SELECT * FROM meridian_deals_import;
--
-- Option B: Direct INSERT for small datasets (preferred for 5 deals)
--   Use the pg_dump --data-only --table=deals output from old DB,
--   then sed to replace organization_id values with tenant_id.

-- ─── STEP 2: Midas Data Import ──────────────────────────────────────
-- Source: midas app-specific Supabase (3 clients, 9 initiatives)
--
-- Export:
--   psql $MIDAS_DB_URL -c "\copy (SELECT * FROM clients) TO '/tmp/midas_clients.csv' CSV HEADER"
--   psql $MIDAS_DB_URL -c "\copy (SELECT * FROM initiatives) TO '/tmp/midas_initiatives.csv' CSV HEADER"
--   psql $MIDAS_DB_URL -c "\copy (SELECT * FROM meetings) TO '/tmp/midas_meetings.csv' CSV HEADER"
--   psql $MIDAS_DB_URL -c "\copy (SELECT * FROM snapshots) TO '/tmp/midas_snapshots.csv' CSV HEADER"
--
-- Import (organization_id → tenant_id mapping):
--   The old Midas DB uses organization_id (uuid). Replace with {{DIT_TENANT_ID}}.

-- ─── STEP 3: Ducky Data Import ──────────────────────────────────────
-- Source: ducky app-specific Supabase (1 org, 1 user, 2 messages)
--
-- Export:
--   psql $DUCKY_DB_URL -c "\copy (SELECT * FROM conversations) TO '/tmp/ducky_conversations.csv' CSV HEADER"
--   psql $DUCKY_DB_URL -c "\copy (SELECT * FROM messages) TO '/tmp/ducky_messages.csv' CSV HEADER"
--
-- Import: tenant_id in old Ducky already references organizations.id.
-- Map that org UUID → {{DIT_TENANT_ID}}.

-- ─── STEP 4: Verification Queries ───────────────────────────────────

-- Meridian verification
SELECT 'meridian.deals' AS table_name, count(*) AS row_count FROM meridian.deals
UNION ALL SELECT 'meridian.pillars', count(*) FROM meridian.pillars
UNION ALL SELECT 'meridian.findings', count(*) FROM meridian.findings
UNION ALL SELECT 'meridian.documents', count(*) FROM meridian.documents
UNION ALL SELECT 'meridian.document_chunks', count(*) FROM meridian.document_chunks
UNION ALL SELECT 'meridian.document_classifications', count(*) FROM meridian.document_classifications
UNION ALL SELECT 'meridian.tech_stack_items', count(*) FROM meridian.tech_stack_items
UNION ALL SELECT 'meridian.topology_nodes', count(*) FROM meridian.topology_nodes
UNION ALL SELECT 'meridian.qa_conversations', count(*) FROM meridian.qa_conversations

-- Midas verification
UNION ALL SELECT 'midas.clients', count(*) FROM midas.clients
UNION ALL SELECT 'midas.initiatives', count(*) FROM midas.initiatives
UNION ALL SELECT 'midas.meetings', count(*) FROM midas.meetings
UNION ALL SELECT 'midas.snapshots', count(*) FROM midas.snapshots
UNION ALL SELECT 'midas.security_scoring_overrides', count(*) FROM midas.security_scoring_overrides
UNION ALL SELECT 'midas.security_score_history', count(*) FROM midas.security_score_history

-- Ducky verification
UNION ALL SELECT 'ducky.conversations', count(*) FROM ducky.conversations
UNION ALL SELECT 'ducky.messages', count(*) FROM ducky.messages
UNION ALL SELECT 'ducky.threads', count(*) FROM ducky.threads

ORDER BY table_name;

COMMIT;
