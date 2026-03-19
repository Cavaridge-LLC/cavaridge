-- ============================================================
-- Cavaridge Platform — Vespar (CVG-VESPAR) Schema
-- Run AFTER 008_astra.sql
--
-- Cloud Migration Planning tables in the `vespar` schema.
-- All tables reference public.tenants(id) for UTM isolation.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS vespar;

-- ─── 1. migration_projects ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vespar.migration_projects (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  source_environment text NOT NULL,
  target_environment text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  readiness_score integer,
  created_by varchar(36),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vespar_projects_tenant ON vespar.migration_projects(tenant_id);
ALTER TABLE vespar.migration_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_projects ON vespar.migration_projects
  FOR ALL USING (tenant_id = public.tenant_id());
CREATE TRIGGER set_updated_at_vespar_projects
  BEFORE UPDATE ON vespar.migration_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. workloads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vespar.workloads (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(36) NOT NULL REFERENCES vespar.migration_projects(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  type text NOT NULL,
  environment_details jsonb,
  current_hosting text,
  criticality text NOT NULL DEFAULT 'medium',
  migration_strategy text,
  status text NOT NULL DEFAULT 'discovered',
  estimated_effort_hours integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vespar_workloads_tenant ON vespar.workloads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vespar_workloads_project ON vespar.workloads(project_id);
ALTER TABLE vespar.workloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workloads ON vespar.workloads
  FOR ALL USING (tenant_id = public.tenant_id());
CREATE TRIGGER set_updated_at_vespar_workloads
  BEFORE UPDATE ON vespar.workloads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 3. dependencies ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vespar.dependencies (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(36) NOT NULL REFERENCES vespar.migration_projects(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  source_workload_id varchar(36) NOT NULL REFERENCES vespar.workloads(id),
  target_workload_id varchar(36) NOT NULL REFERENCES vespar.workloads(id),
  dependency_type text NOT NULL,
  description text,
  blocks_migration boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vespar_dep_source_target
  ON vespar.dependencies(source_workload_id, target_workload_id);
CREATE INDEX IF NOT EXISTS idx_vespar_dependencies_tenant ON vespar.dependencies(tenant_id);
ALTER TABLE vespar.dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dependencies ON vespar.dependencies
  FOR ALL USING (tenant_id = public.tenant_id());

-- ─── 4. risk_findings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vespar.risk_findings (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(36) NOT NULL REFERENCES vespar.migration_projects(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  workload_id varchar(36) REFERENCES vespar.workloads(id),
  title text NOT NULL,
  description text,
  severity text NOT NULL,
  category text NOT NULL,
  mitigation text,
  status text NOT NULL DEFAULT 'open',
  risk_score integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vespar_risk_findings_tenant ON vespar.risk_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vespar_risk_findings_project ON vespar.risk_findings(project_id);
ALTER TABLE vespar.risk_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_risk_findings ON vespar.risk_findings
  FOR ALL USING (tenant_id = public.tenant_id());
CREATE TRIGGER set_updated_at_vespar_risk_findings
  BEFORE UPDATE ON vespar.risk_findings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 5. cost_projections ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vespar.cost_projections (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(36) NOT NULL REFERENCES vespar.migration_projects(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  workload_id varchar(36) REFERENCES vespar.workloads(id),
  current_monthly_cost text,
  projected_monthly_cost text,
  migration_cost_onetime text,
  savings_monthly text,
  savings_annual text,
  assumptions jsonb,
  cost_breakdown jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vespar_cost_projections_tenant ON vespar.cost_projections(tenant_id);
ALTER TABLE vespar.cost_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cost_projections ON vespar.cost_projections
  FOR ALL USING (tenant_id = public.tenant_id());
CREATE TRIGGER set_updated_at_vespar_cost_projections
  BEFORE UPDATE ON vespar.cost_projections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 6. runbooks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vespar.runbooks (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(36) NOT NULL REFERENCES vespar.migration_projects(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  content text,
  generated_by text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vespar_runbooks_tenant ON vespar.runbooks(tenant_id);
ALTER TABLE vespar.runbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_runbooks ON vespar.runbooks
  FOR ALL USING (tenant_id = public.tenant_id());
CREATE TRIGGER set_updated_at_vespar_runbooks
  BEFORE UPDATE ON vespar.runbooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── GRANTS ───────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA vespar TO cavaridge_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA vespar TO role_core;
GRANT SELECT ON ALL TABLES IN SCHEMA vespar TO role_vespar;
GRANT SELECT ON ALL TABLES IN SCHEMA vespar TO cavaridge_app;

COMMENT ON SCHEMA vespar IS 'CVG-VESPAR: Cloud Migration Planning with workload analysis';

COMMIT;
