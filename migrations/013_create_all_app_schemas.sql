-- ============================================================
-- Cavaridge Platform — Migration 013
-- Create missing app schemas: Forge (CVG-FORGE) + HIPAA (CVG-HIPAA)
-- Run AFTER 012_fix_auth_foundation.sql
--
-- Apps already migrated (no changes needed):
--   004_meridian.sql  — Meridian (27 tables in meridian schema)
--   005_midas.sql     — Midas
--   006_ducky.sql     — Ducky (11 tables in ducky schema)
--   007_caelum.sql    — Caelum (3 tables in caelum schema)
--   008_astra.sql     — Astra (4 tables in astra schema)
--   009_vespar.sql    — Vespar (6 tables in vespar schema)
--   011_aegis.sql     — AEGIS (9 tables in aegis schema)
--
-- Apps with no schema definition file (skipped):
--   Brain (CVG-BRAIN) — apps/brain/shared/schema.ts does not exist
--
-- This migration creates:
--   Forge  — 5 enums + 5 tables in public schema (pgTable)
--   HIPAA  — 9 enums + 7 tables in public schema (pgTable)
-- ============================================================

BEGIN;

-- ############################################################
-- PART 1: FORGE (CVG-FORGE) — Autonomous Content Creation
-- Tables use public schema via pgTable (not a custom schema).
-- ############################################################

-- ─── Forge Enums ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE forge_project_status AS ENUM (
    'draft', 'estimating', 'queued', 'running', 'validating',
    'completed', 'failed', 'revised'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forge_output_format AS ENUM (
    'docx', 'pdf', 'markdown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forge_agent_run_type AS ENUM (
    'intake', 'estimate', 'research', 'structure', 'generate', 'validate', 'revise', 'render'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forge_agent_run_status AS ENUM (
    'pending', 'running', 'completed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forge_credit_type AS ENUM (
    'production', 'revision', 'free_revision'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. forge_projects ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS forge_projects (
  id                uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid              NOT NULL REFERENCES tenants(id),
  created_by        uuid              NOT NULL,
  title             text              NOT NULL,
  brief             jsonb             NOT NULL,
  estimated_credits integer,
  actual_credits    integer           DEFAULT 0,
  status            forge_project_status NOT NULL DEFAULT 'draft',
  output_format     forge_output_format  NOT NULL,
  output_url        text,
  revision_count    integer           NOT NULL DEFAULT 0,
  max_free_revisions integer          NOT NULL DEFAULT 3,
  quality_score     real,
  metadata          jsonb,
  created_at        timestamptz       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        timestamptz       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_forge_projects_tenant ON forge_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forge_projects_status ON forge_projects(status);
CREATE INDEX IF NOT EXISTS idx_forge_projects_created_by ON forge_projects(created_by);

ALTER TABLE forge_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_forge_projects ON forge_projects
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at_forge_projects
  BEFORE UPDATE ON forge_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. forge_agent_runs ────────────────────────────────────

CREATE TABLE IF NOT EXISTS forge_agent_runs (
  id                uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid                  NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
  run_type          forge_agent_run_type  NOT NULL,
  agent_name        text                  NOT NULL,
  model_used        text,
  input_tokens      integer,
  output_tokens     integer,
  cost_usd          numeric(10,6),
  langfuse_trace_id text,
  status            forge_agent_run_status NOT NULL DEFAULT 'pending',
  result            jsonb,
  error             jsonb,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz           NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forge_agent_runs_project ON forge_agent_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_forge_agent_runs_run_type ON forge_agent_runs(run_type);

ALTER TABLE forge_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_forge_agent_runs ON forge_agent_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM forge_projects fp
      WHERE fp.id = forge_agent_runs.project_id
        AND fp.tenant_id IN (
          SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
        )
    )
  );

-- ─── 3. forge_templates ────────────────────────────────────

CREATE TABLE IF NOT EXISTS forge_templates (
  id            uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid                REFERENCES tenants(id),
  name          text                NOT NULL,
  description   text,
  output_format forge_output_format NOT NULL,
  template_data jsonb               NOT NULL,
  usage_count   integer             NOT NULL DEFAULT 0,
  is_active     boolean             NOT NULL DEFAULT true,
  created_at    timestamptz         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamptz         NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forge_templates_tenant ON forge_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forge_templates_format ON forge_templates(output_format);

ALTER TABLE forge_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_forge_templates ON forge_templates
  FOR ALL USING (
    tenant_id IS NULL  -- global templates visible to all
    OR tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at_forge_templates
  BEFORE UPDATE ON forge_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. forge_usage (credit tracking) ──────────────────────

CREATE TABLE IF NOT EXISTS forge_usage (
  id             uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid             NOT NULL REFERENCES tenants(id),
  user_id        uuid             NOT NULL,
  project_id     uuid             NOT NULL REFERENCES forge_projects(id),
  credits_used   integer          NOT NULL,
  credit_type    forge_credit_type NOT NULL,
  billing_period timestamptz      NOT NULL,
  created_at     timestamptz      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forge_usage_tenant ON forge_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forge_usage_user ON forge_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_forge_usage_billing_period ON forge_usage(billing_period);

ALTER TABLE forge_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_forge_usage ON forge_usage
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- ─── 5. forge_tenant_credits ───────────────────────────────

CREATE TABLE IF NOT EXISTS forge_tenant_credits (
  tenant_id     uuid    PRIMARY KEY REFERENCES tenants(id),
  total_credits integer NOT NULL DEFAULT 50,
  used_credits  integer NOT NULL DEFAULT 0,
  tier          text    NOT NULL DEFAULT 'free',
  reset_at      timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE forge_tenant_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_forge_tenant_credits ON forge_tenant_credits
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at_forge_tenant_credits
  BEFORE UPDATE ON forge_tenant_credits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Forge Grants ───────────────────────────────────────────

GRANT ALL ON forge_projects         TO authenticated, service_role;
GRANT ALL ON forge_agent_runs       TO authenticated, service_role;
GRANT ALL ON forge_templates        TO authenticated, service_role;
GRANT ALL ON forge_usage            TO authenticated, service_role;
GRANT ALL ON forge_tenant_credits   TO authenticated, service_role;

GRANT SELECT ON forge_projects       TO anon;
GRANT SELECT ON forge_agent_runs     TO anon;
GRANT SELECT ON forge_templates      TO anon;
GRANT SELECT ON forge_usage          TO anon;
GRANT SELECT ON forge_tenant_credits TO anon;


-- ############################################################
-- PART 2: HIPAA (CVG-HIPAA) — Risk Assessment Toolkit
-- Tables use public schema via pgTable (not a custom schema).
-- ############################################################

-- ─── HIPAA Enums ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE hipaa_assessment_type AS ENUM (
    'security_rule', 'privacy_rule', 'breach_notification'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_assessment_status AS ENUM (
    'draft', 'in_progress', 'review', 'completed', 'approved'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_framework AS ENUM (
    'hipaa_security', 'hipaa_privacy', 'hitrust'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_control_category AS ENUM (
    'administrative', 'physical', 'technical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_control_state AS ENUM (
    'not_implemented', 'partial', 'implemented'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_risk_level AS ENUM (
    'critical', 'high', 'medium', 'low'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_risk_treatment AS ENUM (
    'mitigate', 'accept', 'transfer', 'avoid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_remediation_status AS ENUM (
    'open', 'in_progress', 'completed', 'verified'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hipaa_report_type AS ENUM (
    'executive_summary', 'detailed', 'gap_analysis', 'risk_register'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. hipaa_risk_assessments ──────────────────────────────

CREATE TABLE IF NOT EXISTS hipaa_risk_assessments (
  id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid                    NOT NULL REFERENCES tenants(id),
  site_id         uuid                    REFERENCES tenants(id),
  title           text                    NOT NULL,
  assessment_type hipaa_assessment_type   NOT NULL DEFAULT 'security_rule',
  status          hipaa_assessment_status NOT NULL DEFAULT 'draft',
  framework       hipaa_framework         NOT NULL DEFAULT 'hipaa_security',
  created_by      uuid                    NOT NULL,
  assigned_to     uuid,
  completed_at    timestamptz,
  approved_by     uuid,
  approved_at     timestamptz,
  metadata        jsonb,
  created_at      timestamptz             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz             NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hipaa_ra_tenant ON hipaa_risk_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_ra_status ON hipaa_risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_hipaa_ra_framework ON hipaa_risk_assessments(framework);

ALTER TABLE hipaa_risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_hipaa_risk_assessments ON hipaa_risk_assessments
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at_hipaa_risk_assessments
  BEFORE UPDATE ON hipaa_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. hipaa_assessment_controls ───────────────────────────

CREATE TABLE IF NOT EXISTS hipaa_assessment_controls (
  id              uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid                   NOT NULL REFERENCES hipaa_risk_assessments(id) ON DELETE CASCADE,
  control_ref     text                   NOT NULL,
  control_name    text                   NOT NULL,
  category        hipaa_control_category NOT NULL,
  safeguard_type  text,
  current_state   hipaa_control_state    NOT NULL DEFAULT 'not_implemented',
  finding_detail  text,
  likelihood      integer                DEFAULT 1,
  impact          integer                DEFAULT 1,
  risk_score      integer                DEFAULT 1,
  risk_level      hipaa_risk_level       DEFAULT 'low',
  risk_treatment  hipaa_risk_treatment,
  evidence_notes  text,
  tenant_id       uuid                   NOT NULL REFERENCES tenants(id),
  created_at      timestamptz            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz            NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hipaa_ac_assessment ON hipaa_assessment_controls(assessment_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_ac_control_ref ON hipaa_assessment_controls(control_ref);
CREATE INDEX IF NOT EXISTS idx_hipaa_ac_tenant ON hipaa_assessment_controls(tenant_id);

ALTER TABLE hipaa_assessment_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_hipaa_assessment_controls ON hipaa_assessment_controls
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at_hipaa_assessment_controls
  BEFORE UPDATE ON hipaa_assessment_controls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. hipaa_remediation_items ─────────────────────────────

CREATE TABLE IF NOT EXISTS hipaa_remediation_items (
  id              uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id      uuid                     REFERENCES hipaa_assessment_controls(id),
  assessment_id   uuid                     NOT NULL REFERENCES hipaa_risk_assessments(id),
  tenant_id       uuid                     NOT NULL REFERENCES tenants(id),
  title           text                     NOT NULL,
  description     text,
  status          hipaa_remediation_status NOT NULL DEFAULT 'open',
  priority        integer                  NOT NULL DEFAULT 3,
  assigned_to     uuid,
  due_date        timestamptz,
  completed_at    timestamptz,
  verified_by     uuid,
  verified_at     timestamptz,
  notes           text,
  created_at      timestamptz              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz              NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hipaa_ri_assessment ON hipaa_remediation_items(assessment_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_ri_status ON hipaa_remediation_items(status);
CREATE INDEX IF NOT EXISTS idx_hipaa_ri_tenant ON hipaa_remediation_items(tenant_id);

ALTER TABLE hipaa_remediation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_hipaa_remediation_items ON hipaa_remediation_items
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

CREATE TRIGGER set_updated_at_hipaa_remediation_items
  BEFORE UPDATE ON hipaa_remediation_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. hipaa_assessment_evidence ───────────────────────────

CREATE TABLE IF NOT EXISTS hipaa_assessment_evidence (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id  uuid        NOT NULL REFERENCES hipaa_assessment_controls(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),
  file_name   text        NOT NULL,
  file_type   text,
  file_url    text        NOT NULL,
  uploaded_by uuid        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hipaa_ae_control ON hipaa_assessment_evidence(control_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_ae_tenant ON hipaa_assessment_evidence(tenant_id);

ALTER TABLE hipaa_assessment_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_hipaa_assessment_evidence ON hipaa_assessment_evidence
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- ─── 5. hipaa_assessment_reports ────────────────────────────

CREATE TABLE IF NOT EXISTS hipaa_assessment_reports (
  id            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid              NOT NULL REFERENCES hipaa_risk_assessments(id),
  tenant_id     uuid              NOT NULL REFERENCES tenants(id),
  report_type   hipaa_report_type NOT NULL,
  format        text              NOT NULL DEFAULT 'pdf',
  content       jsonb,
  generated_by  uuid              NOT NULL,
  created_at    timestamptz       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hipaa_ar_assessment ON hipaa_assessment_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_ar_tenant ON hipaa_assessment_reports(tenant_id);

ALTER TABLE hipaa_assessment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_hipaa_assessment_reports ON hipaa_assessment_reports
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- ─── 6. hipaa_compliance_frameworks (seed/reference data) ───

CREATE TABLE IF NOT EXISTS hipaa_compliance_frameworks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id text        NOT NULL UNIQUE,
  name         text        NOT NULL,
  version      text        NOT NULL,
  description  text,
  controls     jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- No RLS on compliance_frameworks — it is global reference data.

-- ─── 7. hipaa_assessment_audit_log ──────────────────────────

CREATE TABLE IF NOT EXISTS hipaa_assessment_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid,
  tenant_id     uuid        NOT NULL REFERENCES tenants(id),
  user_id       uuid        NOT NULL,
  action        text        NOT NULL,
  resource_type text,
  resource_id   uuid,
  details       jsonb,
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hipaa_aal_assessment ON hipaa_assessment_audit_log(assessment_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_aal_tenant ON hipaa_assessment_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hipaa_aal_created_at ON hipaa_assessment_audit_log(created_at);

ALTER TABLE hipaa_assessment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_hipaa_assessment_audit_log ON hipaa_assessment_audit_log
  FOR ALL USING (
    tenant_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- ─── HIPAA Grants ───────────────────────────────────────────

GRANT ALL ON hipaa_risk_assessments      TO authenticated, service_role;
GRANT ALL ON hipaa_assessment_controls   TO authenticated, service_role;
GRANT ALL ON hipaa_remediation_items     TO authenticated, service_role;
GRANT ALL ON hipaa_assessment_evidence   TO authenticated, service_role;
GRANT ALL ON hipaa_assessment_reports    TO authenticated, service_role;
GRANT ALL ON hipaa_compliance_frameworks TO authenticated, service_role;
GRANT ALL ON hipaa_assessment_audit_log  TO authenticated, service_role;

GRANT SELECT ON hipaa_risk_assessments      TO anon;
GRANT SELECT ON hipaa_assessment_controls   TO anon;
GRANT SELECT ON hipaa_remediation_items     TO anon;
GRANT SELECT ON hipaa_assessment_evidence   TO anon;
GRANT SELECT ON hipaa_assessment_reports    TO anon;
GRANT SELECT ON hipaa_compliance_frameworks TO anon;
GRANT SELECT ON hipaa_assessment_audit_log  TO anon;

COMMIT;
