-- Migration: 015_iar_subscription_intelligence.sql
-- Addendum A: Subscription Intelligence for AEGIS IAR
-- Spec: CVG-AEGIS-IAR-ADDENDUM-A-v1.0
-- Date: 2026-03-26
--
-- Adds:
--   1. aegis.iar_subscription_snapshots — subscription-level data per review
--   2. aegis.iar_subscription_user_map  — user-to-subscription mapping per review
--   3. Two new columns on aegis.iar_reviews

-- ============================================================================
-- 1. New columns on existing iar_reviews table
-- ============================================================================

ALTER TABLE aegis.iar_reviews
  ADD COLUMN IF NOT EXISTS has_subscription_data BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_source TEXT;

COMMENT ON COLUMN aegis.iar_reviews.has_subscription_data IS
  'Controls conditional subscription intelligence in report generation and UI';
COMMENT ON COLUMN aegis.iar_reviews.subscription_source IS
  'csv_export | graph_api | NULL';

-- ============================================================================
-- 2. aegis.iar_subscription_snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS aegis.iar_subscription_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           UUID NOT NULL REFERENCES aegis.iar_reviews(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES auth.tenants(id),

  -- Subscription identity
  subscription_name   TEXT NOT NULL,
  sku_id              TEXT,

  -- Status & counts
  status              TEXT NOT NULL,
  total_licenses      INTEGER NOT NULL,
  assigned_licenses   INTEGER NOT NULL,
  available_licenses  INTEGER NOT NULL,
  utilization_pct     DECIMAL(5,1),

  -- Licensing terms
  billing_recurrence  TEXT,
  term_duration       TEXT,
  start_date          TIMESTAMPTZ,
  next_charge_date    TIMESTAMPTZ,
  days_until_renewal  INTEGER,
  auto_renew          BOOLEAN,
  is_trial            BOOLEAN DEFAULT false,

  -- Cost (user-confirmed, never inferred)
  est_annual_cost     DECIMAL(12,2),
  cost_per_license    DECIMAL(10,2),
  est_wasted_cost     DECIMAL(12,2),

  -- Flags & audit
  flags               TEXT,
  source              TEXT DEFAULT 'csv_export',
  raw_data            JSONB,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iar_sub_snap_review
  ON aegis.iar_subscription_snapshots (review_id);
CREATE INDEX IF NOT EXISTS idx_iar_sub_snap_tenant
  ON aegis.iar_subscription_snapshots (tenant_id);
CREATE INDEX IF NOT EXISTS idx_iar_sub_snap_renewal
  ON aegis.iar_subscription_snapshots (next_charge_date);

-- RLS
ALTER TABLE aegis.iar_subscription_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY iar_sub_snap_tenant_isolation
  ON aegis.iar_subscription_snapshots
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE aegis.iar_subscription_snapshots IS
  'Subscription-level data captured at time of each IAR review. One row per subscription per review. See CVG-AEGIS-IAR-ADDENDUM-A-v1.0.';

-- ============================================================================
-- 3. aegis.iar_subscription_user_map
-- ============================================================================

CREATE TABLE IF NOT EXISTS aegis.iar_subscription_user_map (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id                 UUID NOT NULL REFERENCES aegis.iar_reviews(id) ON DELETE CASCADE,
  tenant_id                 UUID NOT NULL REFERENCES auth.tenants(id),
  user_snapshot_id          UUID NOT NULL REFERENCES aegis.iar_user_snapshots(id) ON DELETE CASCADE,
  subscription_snapshot_id  UUID NOT NULL REFERENCES aegis.iar_subscription_snapshots(id) ON DELETE CASCADE,

  matched_product_name      TEXT,

  created_at                TIMESTAMPTZ DEFAULT NOW(),

  -- A user can only map to a given subscription once per review
  CONSTRAINT uq_iar_sub_user_mapping
    UNIQUE (review_id, user_snapshot_id, subscription_snapshot_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iar_sub_user_review
  ON aegis.iar_subscription_user_map (review_id);
CREATE INDEX IF NOT EXISTS idx_iar_sub_user_user
  ON aegis.iar_subscription_user_map (user_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_iar_sub_user_sub
  ON aegis.iar_subscription_user_map (subscription_snapshot_id);

-- RLS
ALTER TABLE aegis.iar_subscription_user_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY iar_sub_user_map_tenant_isolation
  ON aegis.iar_subscription_user_map
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE aegis.iar_subscription_user_map IS
  'Maps users to subscriptions within a review. Enables per-user subscription metadata on License Breakdown tab. See CVG-AEGIS-IAR-ADDENDUM-A-v1.0.';

-- ============================================================================
-- 4. Grant standard role access
-- ============================================================================

-- Platform Admin: full access
GRANT ALL ON aegis.iar_subscription_snapshots TO platform_admin;
GRANT ALL ON aegis.iar_subscription_user_map TO platform_admin;

-- MSP Admin: full access (manages client reviews)
GRANT ALL ON aegis.iar_subscription_snapshots TO msp_admin;
GRANT ALL ON aegis.iar_subscription_user_map TO msp_admin;

-- MSP Tech: read + insert (runs reviews, no delete)
GRANT SELECT, INSERT ON aegis.iar_subscription_snapshots TO msp_tech;
GRANT SELECT, INSERT ON aegis.iar_subscription_user_map TO msp_tech;

-- Client Admin: read only (views their own reviews)
GRANT SELECT ON aegis.iar_subscription_snapshots TO client_admin;
GRANT SELECT ON aegis.iar_subscription_user_map TO client_admin;

-- Client Viewer: read only
GRANT SELECT ON aegis.iar_subscription_snapshots TO client_viewer;
GRANT SELECT ON aegis.iar_subscription_user_map TO client_viewer;
