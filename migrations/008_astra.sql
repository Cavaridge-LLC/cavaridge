-- ============================================================
-- Cavaridge Platform — Astra (CVG-ASTRA) Schema
-- Run AFTER 007_caelum.sql
--
-- M365 License Optimization tables in the `astra` schema.
-- All tables reference public.tenants(id) for UTM isolation.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS astra;

-- ─── 1. reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astra.reports (
  id serial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  strategy text NOT NULL DEFAULT 'current',
  commitment text NOT NULL DEFAULT 'monthly',
  user_data jsonb NOT NULL,
  custom_rules jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_astra_reports_tenant ON astra.reports(tenant_id);
ALTER TABLE astra.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_reports ON astra.reports
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 2. executive_summaries ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astra.executive_summaries (
  id serial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  report_id integer NOT NULL REFERENCES astra.reports(id) ON DELETE CASCADE,
  content text NOT NULL,
  cost_current real NOT NULL,
  cost_security real NOT NULL,
  cost_saving real NOT NULL,
  cost_balanced real NOT NULL,
  cost_custom real,
  commitment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_astra_exec_summaries_tenant ON astra.executive_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_astra_exec_summaries_report ON astra.executive_summaries(report_id);
ALTER TABLE astra.executive_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_exec_summaries ON astra.executive_summaries
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 3. microsoft_tokens ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astra.microsoft_tokens (
  id serial PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  session_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  m365_tenant_id text,
  user_email text,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_astra_tokens_tenant ON astra.microsoft_tokens(tenant_id);
ALTER TABLE astra.microsoft_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tokens ON astra.microsoft_tokens
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 4. login_history ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS astra.login_history (
  id serial PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  user_email text NOT NULL,
  user_name text,
  m365_tenant_id text,
  login_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_astra_login_history_tenant ON astra.login_history(tenant_id);
ALTER TABLE astra.login_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_login_history ON astra.login_history
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── GRANTS ───────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA astra TO cavaridge_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA astra TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA astra TO role_astra;
GRANT SELECT ON ALL TABLES IN SCHEMA astra TO cavaridge_app;

-- Serial sequences need explicit grants
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA astra TO role_core;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA astra TO role_astra;

COMMENT ON SCHEMA astra IS 'CVG-ASTRA: M365 License Optimization with tenant-scoped reports';

COMMIT;
