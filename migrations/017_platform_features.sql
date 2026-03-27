-- Migration: 017_platform_features.sql
-- Platform-wide feature tables for session buildout
-- Date: 2026-03-27
--
-- Adds:
--   1. spaniel.semantic_cache — LLM response caching (Redis + pgvector)
--   2. hipaa.quickcheck_leads — Freemium HIPAA quick-check lead capture
--   3. vespar.readiness_leads — Freemium cloud readiness lead capture
--   4. midas.security_check_leads — Freemium security score lead capture
--   5. cavalier.partner_commissions — Partner commission tracking
--   6. cavalier.partner_leads — Partner-attributed lead tracking
--   7. forge.credit_transactions — Forge credit purchase/deduction ledger

-- ============================================================================
-- 1. spaniel.semantic_cache
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS spaniel;

CREATE TABLE IF NOT EXISTS spaniel.semantic_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES auth.tenants(id),
  cache_key       VARCHAR(64) NOT NULL,
  model           TEXT NOT NULL,
  task_type       TEXT NOT NULL,
  prompt_hash     VARCHAR(64) NOT NULL,
  response_text   TEXT NOT NULL,
  response_meta   JSONB DEFAULT '{}',
  token_count     INTEGER DEFAULT 0,
  hit_count       INTEGER DEFAULT 0,
  last_hit_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_semantic_cache_key UNIQUE (cache_key)
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_tenant ON spaniel.semantic_cache(tenant_id);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_expires ON spaniel.semantic_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_model_task ON spaniel.semantic_cache(model, task_type);

ALTER TABLE spaniel.semantic_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE spaniel.semantic_cache IS
  'Semantic LLM response cache — exact-match by cache_key (sha256 of model+task+tenant+prompt)';

-- ============================================================================
-- 2. hipaa.quickcheck_leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS hipaa.quickcheck_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES auth.tenants(id),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  company         TEXT,
  phone           TEXT,
  score           INTEGER NOT NULL,
  risk_rating     TEXT NOT NULL,
  question_count  INTEGER DEFAULT 20,
  answers         JSONB DEFAULT '{}',
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quickcheck_leads_email ON hipaa.quickcheck_leads(email);
CREATE INDEX IF NOT EXISTS idx_quickcheck_leads_created ON hipaa.quickcheck_leads(created_at);

ALTER TABLE hipaa.quickcheck_leads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE hipaa.quickcheck_leads IS
  'Lead capture from freemium HIPAA QuickCheck assessment';

-- ============================================================================
-- 3. vespar.readiness_leads
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS vespar;

CREATE TABLE IF NOT EXISTS vespar.readiness_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES auth.tenants(id),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  company         TEXT,
  phone           TEXT,
  complexity_score INTEGER NOT NULL,
  migration_rating TEXT NOT NULL,
  tco_current     NUMERIC(12,2),
  tco_cloud       NUMERIC(12,2),
  tco_savings     NUMERIC(12,2),
  survey_data     JSONB DEFAULT '{}',
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_leads_email ON vespar.readiness_leads(email);
CREATE INDEX IF NOT EXISTS idx_readiness_leads_created ON vespar.readiness_leads(created_at);

ALTER TABLE vespar.readiness_leads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE vespar.readiness_leads IS
  'Lead capture from freemium Vespar Cloud Readiness Calculator';

-- ============================================================================
-- 4. midas.security_check_leads
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS midas;

CREATE TABLE IF NOT EXISTS midas.security_check_leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES auth.tenants(id),
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  company               TEXT,
  phone                 TEXT,
  ms_secure_score       INTEGER,
  gws_health_score      INTEGER,
  adjusted_score        NUMERIC(5,2) NOT NULL,
  compensating_controls JSONB DEFAULT '[]',
  gap_count             INTEGER DEFAULT 0,
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_check_leads_email ON midas.security_check_leads(email);
CREATE INDEX IF NOT EXISTS idx_security_check_leads_created ON midas.security_check_leads(created_at);

ALTER TABLE midas.security_check_leads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE midas.security_check_leads IS
  'Lead capture from freemium Midas Security Score Widget';

-- ============================================================================
-- 5. cavalier.partner_commissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS cavalier.partner_commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES auth.tenants(id),
  partner_id      UUID NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  revenue         NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  commission_amt  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON cavalier.partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_period ON cavalier.partner_commissions(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_tenant ON cavalier.partner_commissions(tenant_id);

ALTER TABLE cavalier.partner_commissions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cavalier.partner_commissions IS
  'Partner commission tracking for Cavalier channel program';

-- ============================================================================
-- 6. cavalier.partner_leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS cavalier.partner_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES auth.tenants(id),
  partner_id      UUID NOT NULL,
  lead_name       TEXT NOT NULL,
  lead_email      TEXT NOT NULL,
  lead_company    TEXT,
  lead_phone      TEXT,
  source          TEXT NOT NULL DEFAULT 'iar'
                  CHECK (source IN ('iar', 'security_check', 'quickcheck', 'readiness', 'referral', 'other')),
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  converted_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_leads_partner ON cavalier.partner_leads(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_leads_status ON cavalier.partner_leads(status);
CREATE INDEX IF NOT EXISTS idx_partner_leads_tenant ON cavalier.partner_leads(tenant_id);

ALTER TABLE cavalier.partner_leads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cavalier.partner_leads IS
  'Partner-attributed leads from freemium tools and referrals';

-- ============================================================================
-- 7. forge.credit_transactions
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS forge;

CREATE TABLE IF NOT EXISTS forge.credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES auth.tenants(id),
  user_id         UUID NOT NULL,
  type            TEXT NOT NULL
                  CHECK (type IN ('purchase', 'deduction', 'refund', 'bonus', 'adjustment')),
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  description     TEXT,
  reference_id    TEXT,
  reference_type  TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_tenant ON forge.credit_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON forge.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON forge.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON forge.credit_transactions(created_at);

ALTER TABLE forge.credit_transactions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE forge.credit_transactions IS
  'Immutable ledger of Forge credit purchases, deductions, and adjustments';

-- ============================================================================
-- Done
-- ============================================================================
