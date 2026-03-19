-- ============================================================================
-- CVG-CERES Migration 001: UTM Multitenancy + RLS
--
-- Adds tenant-scoped tables for calculator results and scan results.
-- Enables Row-Level Security for all tenant-scoped data.
-- Assumes the UTM bootstrap migration (tenants, user_tenants, profiles)
-- has already been applied from packages/auth/.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Calculator Results — tenant-scoped storage of saved frequency calculations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calculator_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_ref VARCHAR(100),
  soc_date VARCHAR(10) NOT NULL,
  visits JSONB NOT NULL,
  frequency_str VARCHAR(255),
  total_visits INTEGER NOT NULL,
  period1_visits INTEGER,
  period2_visits INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculator_results_tenant ON calculator_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calculator_results_user ON calculator_results(user_id);
CREATE INDEX IF NOT EXISTS idx_calculator_results_soc ON calculator_results(soc_date);

-- ---------------------------------------------------------------------------
-- 2. Scan Results — tenant-scoped storage of AI-extracted EMR schedule data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculator_result_id UUID REFERENCES calculator_results(id) ON DELETE SET NULL,
  soc_date VARCHAR(10) NOT NULL,
  visits JSONB NOT NULL,
  visit_dates JSONB,
  emr_system VARCHAR(50),
  confidence VARCHAR(10),
  ai_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_results_tenant ON scan_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_user ON scan_results(user_id);

-- ---------------------------------------------------------------------------
-- 3. Enable RLS on all tenant-scoped tables
-- ---------------------------------------------------------------------------

ALTER TABLE calculator_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. RLS Policies — Calculator Results
-- ---------------------------------------------------------------------------

-- Users can read calculator results within their own tenant
CREATE POLICY "calculator_results_select_tenant" ON calculator_results
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Users can insert calculator results into their own tenant
CREATE POLICY "calculator_results_insert_tenant" ON calculator_results
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Users can update their own calculator results within their tenant
CREATE POLICY "calculator_results_update_own" ON calculator_results
  FOR UPDATE USING (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own calculator results within their tenant
CREATE POLICY "calculator_results_delete_own" ON calculator_results
  FOR DELETE USING (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Platform admins and tenant admins can manage all results in their tenant
CREATE POLICY "calculator_results_admin_all" ON calculator_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('platform_owner', 'platform_admin', 'tenant_admin')
    )
    AND tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. RLS Policies — Scan Results
-- ---------------------------------------------------------------------------

-- Users can read scan results within their own tenant
CREATE POLICY "scan_results_select_tenant" ON scan_results
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Users can insert scan results into their own tenant
CREATE POLICY "scan_results_insert_tenant" ON scan_results
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own scan results
CREATE POLICY "scan_results_delete_own" ON scan_results
  FOR DELETE USING (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- Platform/tenant admins can manage all scan results in their tenant
CREATE POLICY "scan_results_admin_all" ON scan_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('platform_owner', 'platform_admin', 'tenant_admin')
    )
    AND tenant_id IN (
      SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Updated_at trigger for calculator_results
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculator_results_updated_at
  BEFORE UPDATE ON calculator_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
