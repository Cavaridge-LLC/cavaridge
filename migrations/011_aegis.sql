-- ============================================================
-- Cavaridge AEGIS — Database Migration
-- CVG-AEGIS-MIGRATION-011
-- Date: 2026-03-20
-- Description: Phase 1 — Policy engine, devices, telemetry,
--   SaaS discovery, scan results, Cavaridge Adjusted Score.
--   All tables in the aegis schema with tenant_id + RLS.
-- ============================================================

-- ─── SCHEMA ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS aegis;

-- ─── ENUMS ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE aegis.device_status AS ENUM ('pending', 'enrolled', 'active', 'inactive', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE aegis.policy_type AS ENUM ('url_block', 'url_allow', 'saas_block', 'dlp', 'credential', 'browser_config', 'dns');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE aegis.saas_classification AS ENUM ('sanctioned', 'unsanctioned', 'unclassified', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE aegis.scan_type AS ENUM ('external_posture', 'dns', 'tls', 'port', 'full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE aegis.scan_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE aegis.severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE aegis.telemetry_event_type AS ENUM (
    'url_visit', 'saas_detected', 'phishing_blocked', 'credential_alert',
    'dlp_violation', 'policy_applied', 'extension_heartbeat', 'enrollment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── ENROLLMENT TOKENS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.enrollment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  token text NOT NULL UNIQUE,
  label text,
  max_uses int DEFAULT 0,          -- 0 = unlimited
  use_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_tenant ON aegis.enrollment_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_token ON aegis.enrollment_tokens(token);

-- ─── DEVICES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  device_id text NOT NULL,
  hostname text,
  os text,
  browser text,
  browser_version text,
  extension_version text,
  enrollment_token_id uuid REFERENCES aegis.enrollment_tokens(id),
  status aegis.device_status NOT NULL DEFAULT 'pending',
  last_seen_at timestamptz,
  enrolled_at timestamptz,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_devices_tenant ON aegis.devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON aegis.devices(tenant_id, status);

-- ─── POLICIES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  type aegis.policy_type NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  rules jsonb NOT NULL DEFAULT '[]',
  -- rules schema varies by type, e.g.:
  -- url_block: [{ "pattern": "*.gambling.com", "action": "block" }]
  -- saas_block: [{ "app_id": "...", "action": "block" }]
  -- dlp: [{ "type": "file_upload", "extensions": ["exe","zip"], "action": "block" }]
  applies_to jsonb DEFAULT '{"all": true}',
  -- target scoping: {"all": true} | {"device_ids": [...]} | {"groups": [...]}
  version int NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON aegis.policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_type ON aegis.policies(tenant_id, type);

-- ─── TELEMETRY EVENTS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  device_id uuid REFERENCES aegis.devices(id),
  event_type aegis.telemetry_event_type NOT NULL,
  domain text,
  url text,
  title text,
  saas_app_id uuid,
  metadata jsonb DEFAULT '{}',
  timestamp timestamptz NOT NULL DEFAULT now(),
  ingested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_tenant_ts ON aegis.telemetry_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_device ON aegis.telemetry_events(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_domain ON aegis.telemetry_events(tenant_id, domain);
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON aegis.telemetry_events(tenant_id, event_type);

-- Partition hint: In production, consider partitioning by month on timestamp.

-- ─── SAAS APPLICATION CATALOG ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.saas_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain_patterns text[] NOT NULL,  -- e.g., ['*.slack.com', 'slack.com']
  category text NOT NULL,            -- e.g., 'collaboration', 'crm', 'devtools'
  vendor text,
  risk_score int DEFAULT 50,         -- 0-100 default risk score
  description text,
  logo_url text,
  is_global boolean NOT NULL DEFAULT true,  -- global catalog vs tenant-custom
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saas_catalog_domain ON aegis.saas_catalog USING gin(domain_patterns);

-- ─── SAAS APPLICATIONS (per-tenant discovered instances) ───────────────

CREATE TABLE IF NOT EXISTS aegis.saas_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  catalog_id uuid REFERENCES aegis.saas_catalog(id),
  name text NOT NULL,
  domain text NOT NULL,
  category text NOT NULL DEFAULT 'uncategorized',
  classification aegis.saas_classification NOT NULL DEFAULT 'unclassified',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  visit_count int NOT NULL DEFAULT 1,
  unique_devices int NOT NULL DEFAULT 1,
  risk_score int DEFAULT 50,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_saas_apps_tenant ON aegis.saas_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_apps_classification ON aegis.saas_applications(tenant_id, classification);

-- ─── SCAN RESULTS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),  -- nullable for prospect scans
  scan_type aegis.scan_type NOT NULL,
  target text NOT NULL,                    -- domain or IP
  status aegis.scan_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  -- Results
  findings jsonb DEFAULT '[]',
  -- findings schema: [{ "type": "open_port", "severity": "high", "detail": {...} }]
  summary jsonb DEFAULT '{}',
  score int,                               -- 0-100 overall score
  -- Lead gen (freemium scans)
  prospect_email text,
  prospect_name text,
  prospect_company text,
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_results_tenant ON aegis.scan_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_target ON aegis.scan_results(target);
CREATE INDEX IF NOT EXISTS idx_scan_results_status ON aegis.scan_results(status);

-- ─── CAVARIDGE ADJUSTED SCORE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.adjusted_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_tenant_id uuid REFERENCES tenants(id),  -- the client being scored
  -- 7 signal sources with raw + weighted values
  microsoft_secure_score_raw numeric,
  microsoft_secure_score_weighted numeric,       -- weight: 25%
  browser_security_raw numeric,
  browser_security_weighted numeric,             -- weight: 20%
  google_workspace_raw numeric,
  google_workspace_weighted numeric,             -- weight: 15%
  credential_hygiene_raw numeric,
  credential_hygiene_weighted numeric,           -- weight: 15%
  dns_filtering_raw numeric,
  dns_filtering_weighted numeric,                -- weight: 10%
  saas_shadow_it_raw numeric,
  saas_shadow_it_weighted numeric,               -- weight: 10%
  compensating_controls_bonus numeric DEFAULT 0, -- max: +5
  -- Composite
  total_score numeric NOT NULL DEFAULT 0,        -- 0-100
  -- Weight overrides (per-MSP configurable)
  weight_config jsonb DEFAULT '{
    "microsoft_secure_score": 0.25,
    "browser_security": 0.20,
    "google_workspace": 0.15,
    "credential_hygiene": 0.15,
    "dns_filtering": 0.10,
    "saas_shadow_it": 0.10,
    "compensating_controls_max": 5
  }',
  -- Compensating controls detail
  compensating_controls jsonb DEFAULT '[]',
  -- e.g., [{"name":"SentinelOne","detected":true,"bonus":1.5},{"name":"Duo","detected":true,"bonus":1.5}]
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adjusted_scores_tenant ON aegis.adjusted_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_adjusted_scores_client ON aegis.adjusted_scores(tenant_id, client_tenant_id);

-- ─── SCORE HISTORY (for trending) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS aegis.score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_tenant_id uuid REFERENCES tenants(id),
  total_score numeric NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_score_history_tenant ON aegis.score_history(tenant_id, recorded_at DESC);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────

ALTER TABLE aegis.enrollment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis.saas_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis.scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis.adjusted_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis.score_history ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant isolation
CREATE POLICY tenant_isolation ON aegis.enrollment_tokens
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON aegis.devices
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON aegis.policies
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON aegis.telemetry_events
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON aegis.saas_applications
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON aegis.scan_results
  USING (tenant_id = current_setting('app.tenant_id')::uuid OR tenant_id IS NULL);
CREATE POLICY tenant_isolation ON aegis.adjusted_scores
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON aegis.score_history
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- saas_catalog is global — no RLS needed (read-only for tenants)
