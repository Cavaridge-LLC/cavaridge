-- ============================================================
-- Cavaridge Platform — Midas (CVG-MIDAS) Schema
-- Run AFTER 004_meridian.sql
--
-- IT Roadmap / QBR Platform tables in the `midas` schema.
-- All tables reference public.tenants(id) for UTM isolation.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS midas;

-- ─── 1. clients ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  industry text,
  headcount integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_midas_clients_tenant ON midas.clients(tenant_id);
ALTER TABLE midas.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_clients ON midas.clients
  FOR ALL USING (tenant_id = public.tenant_id());
CREATE TRIGGER set_updated_at_midas_clients
  BEFORE UPDATE ON midas.clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. initiatives ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES midas.clients(id),
  title text NOT NULL,
  description text NOT NULL,
  team text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  quarter text NOT NULL,
  cost text,
  business_problem text,
  service_area text,
  sort_order integer NOT NULL DEFAULT 0,
  source varchar(20) NOT NULL DEFAULT 'manual',
  control_id text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_midas_initiatives_tenant ON midas.initiatives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_midas_initiatives_client ON midas.initiatives(client_id);
ALTER TABLE midas.initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_initiatives ON midas.initiatives
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 3. meetings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES midas.clients(id),
  client_name text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  state text NOT NULL DEFAULT 'Draft',
  date_label text NOT NULL,
  attendees text[] NOT NULL DEFAULT '{}',
  agenda text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  executive_summary text,
  next_steps text[] DEFAULT '{}',
  security_score_report_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_midas_meetings_tenant ON midas.meetings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_midas_meetings_client ON midas.meetings(client_id);
ALTER TABLE midas.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_meetings ON midas.meetings
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 4. snapshots ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES midas.clients(id),
  engagement_score integer NOT NULL DEFAULT 0,
  goals_aligned integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'Low',
  budget_total integer NOT NULL DEFAULT 0,
  adoption_percent integer NOT NULL DEFAULT 0,
  roi_status text NOT NULL DEFAULT 'On track',
  security_adjusted_score integer
);

CREATE INDEX IF NOT EXISTS idx_midas_snapshots_tenant ON midas.snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_midas_snapshots_client ON midas.snapshots(client_id);
ALTER TABLE midas.snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_snapshots ON midas.snapshots
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 5. compensating_control_catalog ──────────────────────────────────
-- Platform-scoped reference data (not tenant-isolated)
CREATE TABLE IF NOT EXISTS midas.compensating_control_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  native_control_id text NOT NULL,
  native_control_name text NOT NULL,
  vendor varchar(20) NOT NULL,
  category varchar(50) NOT NULL,
  third_party_products jsonb NOT NULL DEFAULT '[]',
  compensation_level varchar(10) NOT NULL,
  notes text,
  last_verified timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_midas_catalog
  BEFORE UPDATE ON midas.compensating_control_catalog
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 6. security_scoring_overrides ────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.security_scoring_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES midas.clients(id),
  native_control_id text NOT NULL,
  override_type varchar(20) NOT NULL,
  third_party_product text,
  compensation_level varchar(10) NOT NULL,
  notes text NOT NULL,
  set_by uuid NOT NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_midas_override_tenant_client_control
  ON midas.security_scoring_overrides(tenant_id, client_id, native_control_id);
CREATE INDEX IF NOT EXISTS idx_midas_overrides_tenant ON midas.security_scoring_overrides(tenant_id);
ALTER TABLE midas.security_scoring_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_overrides ON midas.security_scoring_overrides
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 7. security_score_history ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.security_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  client_id uuid NOT NULL REFERENCES midas.clients(id),
  vendor varchar(20) NOT NULL,
  native_score numeric NOT NULL,
  native_max_score numeric NOT NULL,
  adjusted_score numeric NOT NULL,
  adjusted_max_score numeric NOT NULL,
  real_gap_count integer NOT NULL,
  compensated_count integer NOT NULL,
  report_json jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_midas_score_history_tenant ON midas.security_score_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_midas_score_history_client ON midas.security_score_history(client_id);
ALTER TABLE midas.security_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_score_history ON midas.security_score_history
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── GRANTS ───────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA midas TO cavaridge_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA midas TO role_core;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA midas TO role_midas;
GRANT SELECT ON ALL TABLES IN SCHEMA midas TO cavaridge_app;

COMMENT ON SCHEMA midas IS 'CVG-MIDAS: IT Roadmap / QBR Platform with security scoring';

COMMIT;
