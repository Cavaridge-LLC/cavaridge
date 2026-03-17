-- ============================================================
-- Cavaridge Platform — SOC 2 Baseline Setup
-- Run FIRST, before 001_cavalier_partners.sql
--
-- Prerequisites: Fresh Supabase Pro project
-- Run as: postgres (default superuser)
-- ============================================================

-- ─── 1. ENABLE PGAUDIT ──────────────────────────────────────────────
-- SOC 2 CC7.2: Audit logging for all DDL and sensitive DML.
-- Supabase Pro includes pgaudit. Enable it and configure.

CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Log all DDL (CREATE, ALTER, DROP) at the instance level.
-- DML auditing (SELECT, INSERT, UPDATE, DELETE) is configured
-- per-role below so we only audit what matters.
--
-- NOTE: On Supabase, pgaudit config is managed at the instance level
-- via Dashboard > Database > Extensions. These ALTER SYSTEM commands
-- will fail with "permission denied" — configure via Supabase Dashboard instead.
-- ALTER SYSTEM SET pgaudit.log = 'ddl';
-- ALTER SYSTEM SET pgaudit.log_catalog = off;
-- ALTER SYSTEM SET pgaudit.log_relation = on;
-- ALTER SYSTEM SET pgaudit.log_statement_once = on;
SELECT pg_reload_conf();

-- ─── 2. APPLICATION ROLES ───────────────────────────────────────────
-- SOC 2 CC6.1, CC6.3: Principle of least privilege.
-- Each app gets its own role with scoped permissions.
-- Apps connect via Supabase client using these roles for RLS context.

-- Base role all app roles inherit from
DO $$ BEGIN
  CREATE ROLE cavaridge_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-CORE: Platform foundation. Full PSA, dispatch, connectors, tenant admin.
DO $$ BEGIN
  CREATE ROLE role_core NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-MIDAS: Billing engine. Contracts, invoices, time entries (billing context).
DO $$ BEGIN
  CREATE ROLE role_midas NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-ASTRA: Client portal. Tickets (read+create), service catalog, client views.
DO $$ BEGIN
  CREATE ROLE role_astra NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-AI (Spaniel): AI enrichment. Ticket AI fields (write), ticket content (read).
DO $$ BEGIN
  CREATE ROLE role_ai NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-AEGIS: Security posture. Connector configs (security type), posture data.
DO $$ BEGIN
  CREATE ROLE role_aegis NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-RESEARCH (Ducky): User-facing AI. Read access to tickets, knowledge, catalog.
DO $$ BEGIN
  CREATE ROLE role_ducky NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-VESPAR: Reporting/analytics. Read-only across all operational tables.
DO $$ BEGIN
  CREATE ROLE role_vespar NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CVG-CAELUM: SoW generation. Read contracts, clients. Write proposals (future table).
DO $$ BEGIN
  CREATE ROLE role_caelum NOLOGIN IN ROLE cavaridge_app;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. PGAUDIT PER-ROLE CONFIG ─────────────────────────────────────
-- Audit all DML from app roles so we have a complete trail of
-- who read/wrote what. This is critical for SOC 2 CC7.2.

ALTER ROLE role_core SET pgaudit.log = 'write';
ALTER ROLE role_midas SET pgaudit.log = 'write';
ALTER ROLE role_astra SET pgaudit.log = 'write';
ALTER ROLE role_ai SET pgaudit.log = 'write';
ALTER ROLE role_aegis SET pgaudit.log = 'write';
ALTER ROLE role_ducky SET pgaudit.log = 'read';
ALTER ROLE role_vespar SET pgaudit.log = 'read';
ALTER ROLE role_caelum SET pgaudit.log = 'read, write';

-- ─── 4. SCHEMA SETUP ────────────────────────────────────────────────
-- Keep Cavalier Partners tables in the public schema (Supabase convention)
-- but grant schema-level access only to app roles.

GRANT USAGE ON SCHEMA public TO cavaridge_app;

-- Ensure future tables created in public are accessible to app roles
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO cavaridge_app;

-- ─── 5. AUDIT TABLE ─────────────────────────────────────────────────
-- SOC 2 CC7.2: Application-level audit log for events pgaudit
-- doesn't capture (business logic events, login attempts, etc.)

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_id uuid,
  actor_type text NOT NULL DEFAULT 'user',        -- user, system, connector, ai
  action text NOT NULL,                            -- e.g., 'ticket.created', 'connector.sync', 'role.changed'
  resource_type text NOT NULL,                     -- e.g., 'ticket', 'contract', 'connector_config'
  resource_id uuid,
  details jsonb DEFAULT '{}',                      -- Action-specific context
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON platform_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON platform_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON platform_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON platform_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON platform_audit_log(created_at DESC);

ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

-- All app roles can INSERT audit entries
GRANT INSERT ON platform_audit_log TO cavaridge_app;
-- Only Core and Vespar can READ audit entries
GRANT SELECT ON platform_audit_log TO role_core, role_vespar;

COMMENT ON TABLE platform_audit_log IS 'SOC 2 CC7.2: Application-level audit trail for all significant platform events';

-- ─── 6. SESSION CONTEXT FUNCTION ────────────────────────────────────
-- Used by RLS policies to identify the current tenant.
-- Apps set this via SET LOCAL before queries.

-- NOTE: On Supabase, the auth schema is owned by supabase_admin and cannot
-- be written to by the postgres role. These functions live in public schema.
-- All RLS policies reference public.tenant_id() instead of auth.tenant_id().

CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_user_role', true);
$$;

-- ─── 7. UPDATED_AT TRIGGER ──────────────────────────────────────────
-- Auto-maintain updated_at columns across all tables.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 8. DATA RETENTION POLICY (INFORMATIONAL) ───────────────────────
-- SOC 2 CC6.5: Data retention and disposal.
-- connector_sync_logs: Retain 90 days, then archive/purge.
-- platform_audit_log: Retain 1 year minimum (SOC 2 requirement).
-- tickets (closed): Retain 3 years.
-- invoices: Retain 7 years (tax compliance).
--
-- Implement via pg_cron or application-level scheduled jobs.
-- Document retention policy in SOC 2 policy manual.

-- ============================================================
-- SETUP COMPLETE
-- Next: Run 001_cavalier_partners.sql to create operational tables.
-- Then: Run 002_role_grants.sql to apply least-privilege grants.
-- ============================================================
